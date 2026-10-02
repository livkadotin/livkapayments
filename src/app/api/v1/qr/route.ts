import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import { getSessionFromRequest } from "@/lib/auth";
import { CreateQrPaymentSchema } from "@/lib/validations";
import { createRazorpayOrder, getRazorpayPublicConfig } from "@/lib/razorpay";
import { db } from "@/lib/db";
import QRCode from "qrcode";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  let websiteId: string | null = null;

  if (!session) {
    const auth = await authenticateApiRequest(req, { requireSecretKey: true });
    if (!auth.success) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }
    websiteId = auth.data.website.id;
  }

  try {
    const body = await req.json();
    const parsed = CreateQrPaymentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const targetWebsiteId = websiteId || parsed.data.websiteId;

    const website = await db.website.findUnique({
      where: { id: targetWebsiteId },
    });

    if (!website) {
      return NextResponse.json({ success: false, error: "Website not found" }, { status: 404 });
    }

    // Customer
    let customerId: string | undefined;
    if (parsed.data.customerEmail) {
      const email = parsed.data.customerEmail.toLowerCase().trim();
      let cust = await db.customer.findFirst({ where: { email } });
      if (cust) {
        if (parsed.data.customerName || parsed.data.customerPhone) {
          cust = await db.customer.update({
            where: { id: cust.id },
            data: {
              name: parsed.data.customerName || cust.name,
              phone: parsed.data.customerPhone || cust.phone,
            },
          });
        }
      } else {
        cust = await db.customer.create({
          data: {
            name: parsed.data.customerName || undefined,
            email,
            phone: parsed.data.customerPhone || undefined,
          },
        });
      }
      customerId = cust.id;
    }

    // Generate Order
    const randomSuffix = crypto.randomBytes(4).toString("hex");
    const orderReceipt = parsed.data.orderId || `QR-${Date.now().toString().slice(-6)}`;
    const internalOrderId = `ord_qr_${Date.now().toString().slice(-6)}_${randomSuffix}`;

    const rzpOrder = await createRazorpayOrder({
      amount: parsed.data.amount,
      currency: parsed.data.currency || "INR",
      receipt: orderReceipt,
      notes: {
        website_id: targetWebsiteId,
        is_qr_payment: "true",
        customer_name: parsed.data.customerName,
      },
    });

    const order = await db.order.create({
      data: {
        id: internalOrderId,
        websiteId: targetWebsiteId,
        customerId,
        amount: parsed.data.amount,
        currency: parsed.data.currency || "INR",
        receipt: orderReceipt,
        status: "CREATED",
        razorpayOrderId: rzpOrder.id,
      },
    });

    // Create QR record
    const qrId = `qr_${Date.now().toString().slice(-6)}_${randomSuffix}`;
    const appUrl = process.env.APP_URL || "https://payments.livka.in";
    const paymentPageUrl = `${appUrl}/pay/qr/${qrId}`;

    // Generate Base64 Data URL for the QR
    const qrDataUrl = await QRCode.toDataURL(paymentPageUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    });

    const expiresAt = parsed.data.expiresInMinutes
      ? new Date(Date.now() + parsed.data.expiresInMinutes * 60 * 1000)
      : new Date(Date.now() + 60 * 60 * 1000);

    const qrPayment = await db.qrPayment.create({
      data: {
        id: qrId,
        websiteId: targetWebsiteId,
        orderId: order.id,
        amount: parsed.data.amount,
        currency: parsed.data.currency || "INR",
        customerName: parsed.data.customerName || null,
        customerEmail: parsed.data.customerEmail || null,
        customerPhone: parsed.data.customerPhone || null,
        qrData: paymentPageUrl,
        status: "ACTIVE",
        expiresAt,
      },
    });

    return NextResponse.json(
      {
        success: true,
        qr_payment: {
          id: qrPayment.id,
          order_id: order.id,
          receipt: order.receipt,
          amount: qrPayment.amount,
          currency: qrPayment.currency,
          payment_url: paymentPageUrl,
          qr_image_data_url: qrDataUrl,
          status: qrPayment.status,
          expires_at: qrPayment.expiresAt,
          website: {
            id: website.id,
            name: website.name,
            domain: website.domain,
          },
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("QR payment creation error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to generate QR payment" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  let websiteId: string | null = null;

  if (!session) {
    const auth = await authenticateApiRequest(req, { requireSecretKey: true });
    if (!auth.success) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }
    websiteId = auth.data.website.id;
  }

  const { searchParams } = new URL(req.url);
  const targetWebsiteId = websiteId || searchParams.get("websiteId");
  const limit = Math.min(Number(searchParams.get("limit") || 50), 100);

  const where: any = {};
  if (targetWebsiteId) where.websiteId = targetWebsiteId;

  const qrList = await db.qrPayment.findMany({
    where,
    include: {
      website: { select: { id: true, name: true, domain: true } },
      order: { select: { id: true, receipt: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const appUrl = process.env.APP_URL || "https://payments.livka.in";

  return NextResponse.json({
    success: true,
    qr_payments: qrList.map((qr) => ({
      id: qr.id,
      order_id: qr.orderId,
      receipt: qr.order.receipt,
      amount: qr.amount,
      currency: qr.currency,
      customer_name: qr.customerName,
      customer_email: qr.customerEmail,
      payment_url: `${appUrl}/pay/qr/${qr.id}`,
      status: qr.order.status === "PAID" ? "PAID" : qr.status,
      expires_at: qr.expiresAt,
      created_at: qr.createdAt,
      website: qr.website,
    })),
  });
}
