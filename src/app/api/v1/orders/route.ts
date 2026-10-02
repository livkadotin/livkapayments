import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import { CreateOrderSchema } from "@/lib/validations";
import { createRazorpayOrder, getRazorpayPublicConfig } from "@/lib/razorpay";
import { db } from "@/lib/db";
import { eventBus } from "@/lib/events";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const auth = await authenticateApiRequest(req, { requireSecretKey: true });
  if (!auth.success) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const { website } = auth.data;

  try {
    const body = await req.json();
    const parsed = CreateOrderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { amount, currency, receipt, notes, customer } = parsed.data;

    // Handle Customer
    let customerId: string | undefined;
    if (customer && (customer.email || customer.phone)) {
      let existing = null;
      if (customer.email) {
        existing = await db.customer.findFirst({
          where: { email: customer.email.toLowerCase().trim() },
        });
      }

      if (existing) {
        customerId = existing.id;
        // Optionally update name/phone if newly provided
        if ((!existing.name && customer.name) || (!existing.phone && customer.phone)) {
          await db.customer.update({
            where: { id: existing.id },
            data: {
              name: customer.name || existing.name,
              phone: customer.phone || existing.phone,
            },
          });
        }
      } else {
        const newCust = await db.customer.create({
          data: {
            name: customer.name || undefined,
            email: customer.email ? customer.email.toLowerCase().trim() : undefined,
            phone: customer.phone || undefined,
          },
        });
        customerId = newCust.id;
      }
    }

    // Generate internal order ID
    const randomSuffix = crypto.randomBytes(4).toString("hex");
    const internalOrderId = `ord_${Date.now().toString().slice(-6)}_${randomSuffix}`;

    // Create Razorpay Order
    const rzpOrder = await createRazorpayOrder({
      amount,
      currency,
      receipt: receipt || internalOrderId,
      notes: {
        website_id: website.id,
        internal_order_id: internalOrderId,
        ...(notes || {}),
      },
    });

    // Save in DB
    const order = await db.order.create({
      data: {
        id: internalOrderId,
        websiteId: website.id,
        customerId,
        amount,
        currency,
        receipt: receipt || null,
        status: "CREATED",
        notes: notes ? JSON.stringify(notes) : null,
        razorpayOrderId: rzpOrder.id,
      },
    });

    // Notify event bus
    eventBus.notifyOrderCreated({
      orderId: order.id,
      websiteId: website.id,
      websiteName: website.name,
      amount: order.amount,
    });

    const publicConfig = getRazorpayPublicConfig();

    return NextResponse.json(
      {
        success: true,
        order: {
          id: order.id,
          website_id: order.websiteId,
          amount: order.amount,
          currency: order.currency,
          receipt: order.receipt,
          status: order.status,
          created_at: order.createdAt,
        },
        razorpay_order_id: rzpOrder.id,
        razorpay_key_id: publicConfig.keyId,
        checkout_url: `${process.env.APP_URL || ""}/pay/order/${order.id}`,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("Failed to create order:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to create order" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const auth = await authenticateApiRequest(req, { requireSecretKey: true });
  if (!auth.success) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const limit = Math.min(Number(searchParams.get("limit") || 20), 100);

  const where: any = { websiteId: auth.data.website.id };
  if (status) where.status = status;

  const orders = await db.order.findMany({
    where,
    include: {
      customer: true,
      payments: true,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({
    success: true,
    orders: orders.map((o) => ({
      id: o.id,
      amount: o.amount,
      currency: o.currency,
      receipt: o.receipt,
      status: o.status,
      created_at: o.createdAt,
      customer: o.customer
        ? { name: o.customer.name, email: o.customer.email, phone: o.customer.phone }
        : null,
      payments: o.payments.map((p) => ({
        id: p.id,
        status: p.status,
        method: p.method,
        razorpay_payment_id: p.razorpayPaymentId,
      })),
    })),
  });
}
