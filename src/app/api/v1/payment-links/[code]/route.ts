import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createRazorpayOrder, getRazorpayPublicConfig } from "@/lib/razorpay";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  const paymentLink = await db.paymentLink.findUnique({
    where: { code },
    include: {
      website: {
        select: {
          id: true,
          name: true,
          domain: true,
          logoUrl: true,
          status: true,
          apiKeys: {
            where: { status: "ACTIVE" },
            select: { publishableKey: true },
            take: 1,
          },
        },
      },
      customer: {
        select: { name: true, email: true, phone: true },
      },
    },
  });

  if (!paymentLink) {
    return NextResponse.json({ success: false, error: "Payment link not found" }, { status: 404 });
  }

  // Check if expired
  if (paymentLink.expiresAt && new Date(paymentLink.expiresAt) < new Date()) {
    return NextResponse.json(
      {
        success: false,
        error: "This payment link has expired",
        payment_link: { status: "EXPIRED" },
      },
      { status: 410 }
    );
  }

  if (paymentLink.status === "PAID") {
    return NextResponse.json({
      success: true,
      alreadyPaid: true,
      payment_link: {
        id: paymentLink.id,
        code: paymentLink.code,
        amount: paymentLink.amount,
        currency: paymentLink.currency,
        status: "PAID",
        website: paymentLink.website,
      },
    });
  }

  // Find or create an Order for this payment link session
  let order = await db.order.findFirst({
    where: {
      websiteId: paymentLink.websiteId,
      receipt: `PL-${paymentLink.code}`,
      status: "CREATED",
    },
  });

  let rzpOrderId = order?.razorpayOrderId;

  if (!order || !rzpOrderId) {
    const rzpOrder = await createRazorpayOrder({
      amount: paymentLink.amount,
      currency: paymentLink.currency,
      receipt: `PL-${paymentLink.code}`,
      notes: {
        payment_link_id: paymentLink.id,
        payment_link_code: paymentLink.code,
        website_id: paymentLink.websiteId,
      },
    });

    rzpOrderId = rzpOrder.id;

    order = await db.order.create({
      data: {
        id: `ord_pl_${Date.now().toString().slice(-6)}_${paymentLink.code.slice(-4)}`,
        websiteId: paymentLink.websiteId,
        customerId: paymentLink.customerId,
        amount: paymentLink.amount,
        currency: paymentLink.currency,
        receipt: `PL-${paymentLink.code}`,
        status: "CREATED",
        razorpayOrderId: rzpOrder.id,
      },
    });
  }

  const publicConfig = getRazorpayPublicConfig();
  const publishableKey = paymentLink.website.apiKeys[0]?.publishableKey || "";

  return NextResponse.json({
    success: true,
    payment_link: {
      id: paymentLink.id,
      code: paymentLink.code,
      amount: paymentLink.amount,
      currency: paymentLink.currency,
      description: paymentLink.description,
      status: paymentLink.status,
      expires_at: paymentLink.expiresAt,
      website: {
        id: paymentLink.website.id,
        name: paymentLink.website.name,
        domain: paymentLink.website.domain,
        logoUrl: paymentLink.website.logoUrl,
      },
      customer: paymentLink.customer,
      order: {
        id: order.id,
        razorpay_order_id: rzpOrderId,
      },
      razorpay_key_id: publicConfig.keyId,
      is_simulated: publicConfig.isSimulated,
    },
  });
}
