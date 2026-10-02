import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dispatchWebsiteWebhooks } from "@/lib/webhooks";
import { eventBus } from "@/lib/events";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { order_id, method = "upi" } = body;

    if (!order_id) {
      return NextResponse.json({ success: false, error: "Missing order_id" }, { status: 400 });
    }

    const order = await db.order.findUnique({
      where: { id: order_id },
      include: { website: true, customer: true },
    });

    if (!order) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    if (order.status === "PAID") {
      return NextResponse.json({ success: true, message: "Order is already paid", order });
    }

    const simPaymentId = `pay_sim_${crypto.randomBytes(8).toString("hex")}`;
    const simOrderId = order.razorpayOrderId || `order_sim_${crypto.randomBytes(6).toString("hex")}`;

    // 1. Update Order
    await db.order.update({
      where: { id: order.id },
      data: { status: "PAID" },
    });

    // 2. Mark QR if any
    await db.qrPayment.updateMany({
      where: { orderId: order.id },
      data: { status: "PAID" },
    });

    // 3. Create Payment
    const payment = await db.payment.create({
      data: {
        orderId: order.id,
        websiteId: order.websiteId,
        customerId: order.customerId,
        amount: order.amount,
        currency: order.currency,
        status: "CAPTURED",
        method,
        razorpayPaymentId: simPaymentId,
        razorpayOrderId: simOrderId,
        capturedAt: new Date(),
      },
    });

    // 4. Record Analytics Event
    await db.analyticsEvent.create({
      data: {
        websiteId: order.websiteId,
        eventType: "payment_captured",
        amount: order.amount,
        currency: order.currency,
        metadata: JSON.stringify({
          orderId: order.id,
          paymentId: payment.id,
          method,
          isSimulated: true,
        }),
      },
    });

    // 5. Dispatch Tenant Webhook
    await dispatchWebsiteWebhooks(order.websiteId, "payment.captured", {
      order_id: order.receipt || order.id,
      payment_id: simPaymentId,
      amount: order.amount,
      currency: order.currency,
      data: {
        internal_order_id: order.id,
        internal_payment_id: payment.id,
        status: "CAPTURED",
        method,
        simulated: true,
      },
    });

    // 6. Broadcast Real-Time SSE
    eventBus.notifyPaymentCaptured({
      paymentId: payment.id,
      orderId: order.id,
      websiteId: order.websiteId,
      websiteName: order.website.name,
      amount: order.amount,
      currency: order.currency,
      method,
    });

    return NextResponse.json({
      success: true,
      message: "Simulated payment captured successfully",
      order: {
        id: order.id,
        receipt: order.receipt,
        amount: order.amount,
        status: "PAID",
      },
      payment: {
        id: payment.id,
        razorpay_payment_id: simPaymentId,
        status: "CAPTURED",
        method,
      },
    });
  } catch (err: any) {
    console.error("Simulation error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
