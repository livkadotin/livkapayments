import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import QRCode from "qrcode";
import { getRazorpayPublicConfig } from "@/lib/razorpay";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const qrPayment = await db.qrPayment.findUnique({
    where: { id },
    include: {
      website: {
        select: {
          id: true,
          name: true,
          domain: true,
          logoUrl: true,
          apiKeys: {
            where: { status: "ACTIVE" },
            select: { publishableKey: true },
            take: 1,
          },
        },
      },
      order: {
        select: {
          id: true,
          receipt: true,
          status: true,
          amount: true,
          currency: true,
          razorpayOrderId: true,
        },
      },
    },
  });

  if (!qrPayment) {
    return NextResponse.json({ success: false, error: "QR payment not found" }, { status: 404 });
  }

  const isPaid = qrPayment.status === "PAID" || qrPayment.order.status === "PAID";
  const isExpired = qrPayment.expiresAt && new Date(qrPayment.expiresAt) < new Date();

  // Generate QR image data URL
  const appUrl = process.env.APP_URL || "https://payments.livka.in";
  const paymentPageUrl = `${appUrl}/pay/qr/${qrPayment.id}`;
  const qrImageDataUrl = await QRCode.toDataURL(paymentPageUrl, {
    width: 400,
    margin: 2,
    color: { dark: "#0f172a", light: "#ffffff" },
  });

  const publicConfig = getRazorpayPublicConfig();

  return NextResponse.json({
    success: true,
    qr_payment: {
      id: qrPayment.id,
      amount: qrPayment.amount,
      currency: qrPayment.currency,
      customer_name: qrPayment.customerName,
      customer_email: qrPayment.customerEmail,
      status: isPaid ? "PAID" : isExpired ? "EXPIRED" : qrPayment.status,
      expires_at: qrPayment.expiresAt,
      payment_url: paymentPageUrl,
      qr_image_data_url: qrImageDataUrl,
      website: qrPayment.website,
      order: qrPayment.order,
      razorpay_key_id: publicConfig.keyId,
      is_simulated: publicConfig.isSimulated,
    },
  });
}
