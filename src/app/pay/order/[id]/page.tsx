import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getRazorpayPublicConfig } from "@/lib/razorpay";
import { OrderCheckoutClient } from "./order-checkout-client";

export default async function OrderCheckoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const order = await db.order.findUnique({
    where: { id },
    include: {
      website: true,
      customer: true,
      payments: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!order) {
    notFound();
  }

  const publicConfig = getRazorpayPublicConfig();

  let parsedNotes: Record<string, any> = {};
  if (order.notes) {
    try {
      parsedNotes = JSON.parse(order.notes);
    } catch {}
  }

  const initialData = {
    order: {
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      status: order.status,
      razorpayOrderId: order.razorpayOrderId,
      createdAt: order.createdAt.toISOString(),
      notes: parsedNotes,
    },
    website: {
      id: order.website.id,
      name: order.website.name,
      domain: order.website.domain,
      logoUrl: order.website.logoUrl,
    },
    customer: order.customer
      ? {
          name: order.customer.name,
          email: order.customer.email,
          phone: order.customer.phone,
        }
      : null,
    razorpayKeyId: publicConfig.keyId,
    isSimulated: publicConfig.isSimulated,
    latestPayment: order.payments[0]
      ? {
          id: order.payments[0].id,
          razorpayPaymentId: order.payments[0].razorpayPaymentId,
          status: order.payments[0].status,
          method: order.payments[0].method,
        }
      : null,
  };

  return <OrderCheckoutClient data={initialData} />;
}
