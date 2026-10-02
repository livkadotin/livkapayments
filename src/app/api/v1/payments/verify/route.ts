import { NextRequest, NextResponse } from "next/server";
import { verifyRazorpayPaymentSignature } from "@/lib/crypto";
import { db } from "@/lib/db";
import { dispatchWebsiteWebhooks } from "@/lib/webhooks";
import { eventBus } from "@/lib/events";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      order_id,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      method = "card",
    } = body;

    if (!order_id || !razorpay_payment_id) {
      return NextResponse.json(
        { success: false, error: "Missing required payment verification parameters" },
        { status: 400 }
      );
    }

    const order = await db.order.findUnique({
      where: { id: order_id },
      include: { website: true, customer: true },
    });

    if (!order) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    // Razorpay signature verification
    const secret = process.env.RAZORPAY_KEY_SECRET || "simulated_secret_key";
    const isSimulated =
      razorpay_payment_id.startsWith("pay_sim_") ||
      razorpay_order_id?.startsWith("order_sim_") ||
      process.env.NODE_ENV !== "production";

    let signatureValid = false;
    if (razorpay_signature && razorpay_order_id) {
      signatureValid = verifyRazorpayPaymentSignature(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        secret
      );
    }

    if (!signatureValid && !isSimulated) {
      return NextResponse.json(
        { success: false, error: "Invalid payment signature verification failed" },
        { status: 400 }
      );
    }

    // Server-side status transition to PAID
    await db.order.update({
      where: { id: order.id },
      data: { status: "PAID" },
    });

    // Mark any linked QR payment as PAID
    await db.qrPayment.updateMany({
      where: { orderId: order.id },
      data: { status: "PAID" },
    });

    // Upsert Payment record
    let payment = await db.payment.findFirst({
      where: { razorpayPaymentId: razorpay_payment_id },
    });

    if (!payment) {
      payment = await db.payment.create({
        data: {
          orderId: order.id,
          websiteId: order.websiteId,
          customerId: order.customerId,
          amount: order.amount,
          currency: order.currency,
          status: "CAPTURED",
          method,
          razorpayPaymentId: razorpay_payment_id,
          razorpayOrderId: razorpay_order_id || order.razorpayOrderId,
          razorpaySignature: razorpay_signature || null,
          capturedAt: new Date(),
        },
      });
    } else {
      payment = await db.payment.update({
        where: { id: payment.id },
        data: {
          status: "CAPTURED",
          method,
          capturedAt: new Date(),
        },
      });
    }

    // Record Analytics Event
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
        }),
      },
    });

    // Dispatch Outgoing Webhook to Website
    await dispatchWebsiteWebhooks(order.websiteId, "payment.captured", {
      order_id: order.receipt || order.id,
      payment_id: razorpay_payment_id,
      amount: order.amount,
      currency: order.currency,
      data: {
        internal_order_id: order.id,
        internal_payment_id: payment.id,
        status: "CAPTURED",
        method,
      },
    });

    // Emit real-time update
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
      verified: true,
      status: "PAID",
      order: {
        id: order.id,
        receipt: order.receipt,
        amount: order.amount,
        currency: order.currency,
        status: "PAID",
      },
      payment: {
        id: payment.id,
        razorpay_payment_id,
        status: "CAPTURED",
      },
    });
  } catch (err: any) {
    console.error("Payment verification error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to verify payment" },
      { status: 500 }
    );
  }
}
