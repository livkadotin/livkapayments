import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await authenticateApiRequest(req, { requireSecretKey: false });
  if (!auth.success) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const order = await db.order.findUnique({
    where: { id },
    include: {
      website: { select: { id: true, name: true, domain: true } },
      customer: true,
      payments: {
        include: { refunds: true },
      },
      qrPayment: true,
    },
  });

  if (!order || order.websiteId !== auth.data.website.id) {
    return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    order: {
      id: order.id,
      website: order.website,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      status: order.status,
      razorpay_order_id: order.razorpayOrderId,
      notes: order.notes ? JSON.parse(order.notes) : null,
      created_at: order.createdAt,
      updated_at: order.updatedAt,
      customer: order.customer
        ? { name: order.customer.name, email: order.customer.email, phone: order.customer.phone }
        : null,
      payments: order.payments,
      qr_payment: order.qrPayment,
    },
  });
}
