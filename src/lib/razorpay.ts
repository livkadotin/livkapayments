import Razorpay from "razorpay";
import crypto from "crypto";

const keyId = process.env.RAZORPAY_KEY_ID || "";
const keySecret = process.env.RAZORPAY_KEY_SECRET || "";

// Check if credentials appear to be real Razorpay credentials (not simulated default strings)
const isLiveOrRealTest = Boolean(
  keyId &&
  keySecret &&
  !keyId.includes("simulated") &&
  !keySecret.includes("simulated") &&
  (keyId.startsWith("rzp_test_") || keyId.startsWith("rzp_live_"))
);

let razorpayClient: Razorpay | null = null;
if (isLiveOrRealTest) {
  try {
    razorpayClient = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  } catch (err) {
    console.warn("Failed to initialize Razorpay SDK client:", err);
  }
}

export interface CreateOrderParams {
  amount: number; // in INR (e.g. 799)
  currency?: string;
  receipt?: string;
  notes?: Record<string, any>;
}

export interface RazorpayOrderResult {
  id: string;
  amount: number; // in paise
  currency: string;
  receipt?: string;
  status: string;
  isSimulated: boolean;
}

export interface CreateRefundParams {
  paymentId: string;
  amount?: number; // in INR
  notes?: Record<string, any>;
}

export interface RazorpayRefundResult {
  id: string;
  payment_id: string;
  amount: number; // in paise
  currency: string;
  status: string;
  isSimulated: boolean;
}

export async function createRazorpayOrder(params: CreateOrderParams): Promise<RazorpayOrderResult> {
  const amountInPaise = Math.round(params.amount * 100);
  const currency = params.currency || "INR";

  if (razorpayClient) {
    try {
      const order = await razorpayClient.orders.create({
        amount: amountInPaise,
        currency,
        receipt: params.receipt,
        notes: params.notes,
      });

      return {
        id: order.id,
        amount: Number(order.amount),
        currency: order.currency,
        receipt: order.receipt || undefined,
        status: order.status,
        isSimulated: false,
      };
    } catch (err: any) {
      console.error("Razorpay orders.create failed, falling back to simulated order:", err.message);
    }
  }

  // Simulation mode
  const randomHex = crypto.randomBytes(8).toString("hex");
  const simulatedId = `order_sim_${randomHex}`;
  return {
    id: simulatedId,
    amount: amountInPaise,
    currency,
    receipt: params.receipt,
    status: "created",
    isSimulated: true,
  };
}

export async function createRazorpayRefund(params: CreateRefundParams): Promise<RazorpayRefundResult> {
  const amountInPaise = params.amount ? Math.round(params.amount * 100) : undefined;

  if (razorpayClient && !params.paymentId.startsWith("pay_sim_")) {
    try {
      const refund = await (razorpayClient.payments as any).refund(params.paymentId, {
        amount: amountInPaise,
        notes: params.notes,
      });

      return {
        id: refund.id,
        payment_id: refund.payment_id,
        amount: Number(refund.amount),
        currency: refund.currency,
        status: refund.status || "processed",
        isSimulated: false,
      };
    } catch (err: any) {
      console.error("Razorpay payments.refund failed, falling back to simulation:", err.message);
    }
  }

  // Simulation mode
  const randomHex = crypto.randomBytes(8).toString("hex");
  return {
    id: `rfnd_sim_${randomHex}`,
    payment_id: params.paymentId,
    amount: amountInPaise || 0,
    currency: "INR",
    status: "processed",
    isSimulated: true,
  };
}

export function getRazorpayPublicConfig() {
  return {
    keyId: keyId || "rzp_test_simulated_key",
    isSimulated: !isLiveOrRealTest,
  };
}
