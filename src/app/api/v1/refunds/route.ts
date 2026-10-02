import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import { getSessionFromRequest } from "@/lib/auth";
import { CreateRefundSchema } from "@/lib/validations";
import { createRazorpayRefund } from "@/lib/razorpay";
import { db } from "@/lib/db";
import { dispatchWebsiteWebhooks } from "@/lib/webhooks";
import { eventBus } from "@/lib/events";
import { createAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  // Check if admin session exists or if API key provided
  const session = await getSessionFromRequest(req);
  let websiteId: string | null = null;
  let adminUserId: string | undefined = session?.userId;

  if (!session) {
    const auth = await authenticateApiRequest(req, { requireSecretKey: true });
    if (!auth.success) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }
    websiteId = auth.data.website.id;
  }

  try {
    const body = await req.json();
    const parsed = CreateRefundSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { paymentId, amount, reason } = parsed.data;

    const payment = await db.payment.findUnique({
      where: { id: paymentId },
      include: {
        order: true,
        website: true,
        refunds: { where: { status: "PROCESSED" } },
      },
    });

    if (!payment) {
      return NextResponse.json({ success: false, error: "Payment not found" }, { status: 404 });
    }

    // If website authenticated, ensure payment belongs to website
    if (websiteId && payment.websiteId !== websiteId) {
      return NextResponse.json({ success: false, error: "Unauthorized access to payment" }, { status: 403 });
    }

    if (payment.status !== "CAPTURED") {
      return NextResponse.json(
        { success: false, error: `Cannot refund payment with status '${payment.status}'` },
        { status: 400 }
      );
    }

    // Calculate previously refunded amount
    const alreadyRefunded = payment.refunds.reduce((acc, r) => acc + r.amount, 0);
    const maxRefundable = payment.amount - alreadyRefunded;

    const refundAmount = amount || maxRefundable;

    if (refundAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "This payment has already been fully refunded" },
        { status: 400 }
      );
    }

    if (refundAmount > maxRefundable) {
      return NextResponse.json(
        {
          success: false,
          error: `Requested refund (₹${refundAmount}) exceeds remaining refundable amount (₹${maxRefundable})`,
        },
        { status: 400 }
      );
    }

    // Call Razorpay Refund
    const rzpRefund = await createRazorpayRefund({
      paymentId: payment.razorpayPaymentId || `pay_sim_${payment.id}`,
      amount: refundAmount,
      notes: { reason, internal_payment_id: payment.id },
    });

    // Create Refund Record
    const refund = await db.refund.create({
      data: {
        paymentId: payment.id,
        websiteId: payment.websiteId,
        amount: refundAmount,
        currency: payment.currency,
        reason,
        status: "PROCESSED",
        razorpayRefundId: rzpRefund.id,
        processedAt: new Date(),
      },
    });

    // Determine new statuses
    const newTotalRefunded = alreadyRefunded + refundAmount;
    const isFullyRefunded = newTotalRefunded >= payment.amount;

    await db.payment.update({
      where: { id: payment.id },
      data: { status: isFullyRefunded ? "REFUNDED" : "CAPTURED" },
    });

    await db.order.update({
      where: { id: payment.orderId },
      data: { status: isFullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED" },
    });

    // Dispatch Outgoing Webhook
    await dispatchWebsiteWebhooks(payment.websiteId, "refund.processed", {
      order_id: payment.order.receipt || payment.orderId,
      payment_id: payment.razorpayPaymentId || payment.id,
      refund_id: refund.razorpayRefundId || refund.id,
      amount: refundAmount,
      currency: payment.currency,
      data: {
        reason,
        fully_refunded: isFullyRefunded,
      },
    });

    // Real-Time SSE Notification
    eventBus.notifyRefundProcessed({
      refundId: refund.id,
      paymentId: payment.id,
      websiteId: payment.websiteId,
      websiteName: payment.website.name,
      amount: refundAmount,
      currency: payment.currency,
    });

    // Audit Log
    await createAuditLog({
      userId: adminUserId,
      action: "PAYMENT_REFUNDED",
      resource: "Payment",
      resourceId: payment.id,
      details: {
        refundId: refund.id,
        amount: refundAmount,
        reason,
        websiteName: payment.website.name,
        orderId: payment.order.id,
      },
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({
      success: true,
      refund: {
        id: refund.id,
        amount: refund.amount,
        currency: refund.currency,
        reason: refund.reason,
        status: refund.status,
        razorpay_refund_id: refund.razorpayRefundId,
        processed_at: refund.processedAt,
      },
      payment_status: isFullyRefunded ? "REFUNDED" : "CAPTURED",
      order_status: isFullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED",
    });
  } catch (err: any) {
    console.error("Refund error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to process refund" },
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
  const filterWebsiteId = websiteId || searchParams.get("websiteId");
  const limit = Math.min(Number(searchParams.get("limit") || 50), 100);

  const where: any = {};
  if (filterWebsiteId) where.websiteId = filterWebsiteId;

  const refunds = await db.refund.findMany({
    where,
    include: {
      website: { select: { id: true, name: true } },
      payment: {
        select: {
          id: true,
          amount: true,
          method: true,
          razorpayPaymentId: true,
          order: { select: { id: true, receipt: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({
    success: true,
    refunds: refunds.map((r) => ({
      id: r.id,
      amount: r.amount,
      currency: r.currency,
      reason: r.reason,
      status: r.status,
      razorpay_refund_id: r.razorpayRefundId,
      created_at: r.createdAt,
      processed_at: r.processedAt,
      website: r.website,
      payment: r.payment,
    })),
  });
}
