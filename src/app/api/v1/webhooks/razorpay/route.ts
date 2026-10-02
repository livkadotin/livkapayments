import { NextRequest, NextResponse } from "next/server";
import { verifyRazorpayWebhookSignature } from "@/lib/crypto";
import { db } from "@/lib/db";
import { dispatchWebsiteWebhooks } from "@/lib/webhooks";
import { eventBus } from "@/lib/events";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature") || "";
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "simulated_webhook_secret";

    // 1. Signature Verification
    // If webhook secret is configured and not default simulated in production, strictly verify HMAC
    const isSimulatedDev = webhookSecret === "simulated_webhook_secret" || process.env.NODE_ENV !== "production";
    
    let isSignatureValid = false;
    if (signature) {
      isSignatureValid = verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret);
    }
    
    // In dev / test mode, allow simulation headers or valid signature
    if (!isSignatureValid && !isSimulatedDev) {
      console.error("Invalid Razorpay webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    let payload: any = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const eventName = payload.event;
    const razorpayEventId = payload.id || null;

    if (!eventName) {
      return NextResponse.json({ error: "Missing event name" }, { status: 400 });
    }

    // 2. Idempotency Check
    if (razorpayEventId) {
      const existingEvent = await db.webhookEvent.findUnique({
        where: { razorpayEventId },
      });

      if (existingEvent && existingEvent.processed) {
        console.log(`[Webhook] Duplicate Razorpay event ${razorpayEventId} already processed. Ignoring.`);
        return NextResponse.json({ success: true, status: "ignored_duplicate" });
      }
    }

    // Record Inbound Webhook Event for Audit Trail
    const webhookEventRecord = await db.webhookEvent.create({
      data: {
        razorpayEventId,
        event: eventName,
        payload: rawBody,
        signature,
        processed: false,
      },
    });

    // 3. Event Handling
    switch (eventName) {
      case "payment.captured":
      case "payment.authorized": {
        const paymentEntity = payload.payload?.payment?.entity;
        if (!paymentEntity) break;

        const rzpPaymentId = paymentEntity.id;
        const rzpOrderId = paymentEntity.order_id;
        const amount = Number(paymentEntity.amount) / 100; // convert paise to INR
        const currency = paymentEntity.currency || "INR";
        const method = paymentEntity.method || "card";

        // Find internal order
        const order = await db.order.findFirst({
          where: { razorpayOrderId: rzpOrderId },
          include: { website: true, customer: true },
        });

        if (order) {
          // Update Order Status to PAID if captured
          const isCaptured = eventName === "payment.captured" || paymentEntity.status === "captured";
          const newOrderStatus = isCaptured ? "PAID" : "PENDING";

          await db.order.update({
            where: { id: order.id },
            data: { status: newOrderStatus },
          });

          // If linked to QR payment, mark QR as PAID
          await db.qrPayment.updateMany({
            where: { orderId: order.id },
            data: { status: "PAID" },
          });

          // Upsert Payment Record
          let payment = await db.payment.findFirst({
            where: { razorpayPaymentId: rzpPaymentId },
          });

          if (!payment) {
            payment = await db.payment.create({
              data: {
                orderId: order.id,
                websiteId: order.websiteId,
                customerId: order.customerId,
                amount,
                currency,
                status: isCaptured ? "CAPTURED" : "AUTHORIZED",
                method,
                razorpayPaymentId: rzpPaymentId,
                razorpayOrderId: rzpOrderId,
                razorpaySignature: signature || null,
                capturedAt: isCaptured ? new Date() : null,
              },
            });
          } else {
            payment = await db.payment.update({
              where: { id: payment.id },
              data: {
                status: isCaptured ? "CAPTURED" : "AUTHORIZED",
                method,
                capturedAt: isCaptured ? new Date() : payment.capturedAt,
              },
            });
          }

          // Record Analytics Event
          await db.analyticsEvent.create({
            data: {
              websiteId: order.websiteId,
              eventType: "payment_captured",
              amount,
              currency,
              metadata: JSON.stringify({
                orderId: order.id,
                paymentId: payment.id,
                method,
              }),
            },
          });

          // Dispatch Outgoing Website Webhook
          await dispatchWebsiteWebhooks(order.websiteId, "payment.captured", {
            order_id: order.receipt || order.id,
            payment_id: rzpPaymentId,
            amount,
            currency,
            data: {
              internal_order_id: order.id,
              internal_payment_id: payment.id,
              status: "CAPTURED",
              method,
            },
          });

          // Notify Real-Time Event Bus for Admin Dashboard
          eventBus.notifyPaymentCaptured({
            paymentId: payment.id,
            orderId: order.id,
            websiteId: order.websiteId,
            websiteName: order.website.name,
            amount,
            currency,
            method,
          });

          console.log(`✅ Payment captured: ₹${amount} for website ${order.website.name} (Order: ${order.id})`);
        }
        break;
      }

      case "payment.failed": {
        const paymentEntity = payload.payload?.payment?.entity;
        if (!paymentEntity) break;

        const rzpPaymentId = paymentEntity.id;
        const rzpOrderId = paymentEntity.order_id;
        const amount = Number(paymentEntity.amount) / 100;
        const currency = paymentEntity.currency || "INR";
        const errorReason = paymentEntity.error_description || "Payment failed at bank gateway";

        const order = await db.order.findFirst({
          where: { razorpayOrderId: rzpOrderId },
          include: { website: true },
        });

        if (order) {
          await db.order.update({
            where: { id: order.id },
            data: { status: "FAILED" },
          });

          await db.payment.create({
            data: {
              orderId: order.id,
              websiteId: order.websiteId,
              customerId: order.customerId,
              amount,
              currency,
              status: "FAILED",
              method: paymentEntity.method || null,
              razorpayPaymentId: rzpPaymentId,
              razorpayOrderId: rzpOrderId,
              errorReason,
            },
          });

          await dispatchWebsiteWebhooks(order.websiteId, "payment.failed", {
            order_id: order.receipt || order.id,
            payment_id: rzpPaymentId,
            amount,
            currency,
            data: {
              error_reason: errorReason,
              internal_order_id: order.id,
            },
          });
        }
        break;
      }

      case "refund.processed": {
        const refundEntity = payload.payload?.refund?.entity;
        if (!refundEntity) break;

        const rzpRefundId = refundEntity.id;
        const rzpPaymentId = refundEntity.payment_id;
        const amount = Number(refundEntity.amount) / 100;

        const payment = await db.payment.findFirst({
          where: { razorpayPaymentId: rzpPaymentId },
          include: { order: true, website: true },
        });

        if (payment) {
          await db.refund.upsert({
            where: { razorpayRefundId: rzpRefundId },
            update: {
              status: "PROCESSED",
              processedAt: new Date(),
            },
            create: {
              paymentId: payment.id,
              websiteId: payment.websiteId,
              amount,
              currency: refundEntity.currency || "INR",
              reason: refundEntity.notes?.reason || "Refund issued",
              status: "PROCESSED",
              razorpayRefundId: rzpRefundId,
              processedAt: new Date(),
            },
          });

          // Check if full or partial
          const totalRefunds = await db.refund.aggregate({
            where: { paymentId: payment.id, status: "PROCESSED" },
            _sum: { amount: true },
          });

          const totalRefundedAmount = totalRefunds._sum.amount || amount;
          const isFullyRefunded = totalRefundedAmount >= payment.amount;

          await db.payment.update({
            where: { id: payment.id },
            data: { status: isFullyRefunded ? "REFUNDED" : "CAPTURED" },
          });

          await db.order.update({
            where: { id: payment.orderId },
            data: { status: isFullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED" },
          });

          await dispatchWebsiteWebhooks(payment.websiteId, "refund.processed", {
            order_id: payment.order.receipt || payment.orderId,
            payment_id: rzpPaymentId,
            refund_id: rzpRefundId,
            amount,
            currency: "INR",
            data: {
              refund_status: "PROCESSED",
              fully_refunded: isFullyRefunded,
            },
          });

          eventBus.notifyRefundProcessed({
            refundId: rzpRefundId,
            paymentId: payment.id,
            websiteId: payment.websiteId,
            websiteName: payment.website.name,
            amount,
            currency: "INR",
          });
        }
        break;
      }

      default:
        console.log(`[Webhook] Unhandled Razorpay event: ${eventName}`);
    }

    // Mark Event as Processed
    await db.webhookEvent.update({
      where: { id: webhookEventRecord.id },
      data: { processed: true, processedAt: new Date() },
    });

    return NextResponse.json({ success: true, processed: true });
  } catch (err: any) {
    console.error("Razorpay webhook error:", err);
    return NextResponse.json({ error: "Internal webhook error", message: err.message }, { status: 500 });
  }
}
