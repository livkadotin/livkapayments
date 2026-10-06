"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Lock, CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface OrderCheckoutData {
  order: {
    id: string;
    amount: number;
    currency: string;
    receipt: string | null;
    status: string;
    razorpayOrderId: string | null;
    createdAt: string;
    notes: Record<string, any>;
  };
  website: {
    id: string;
    name: string;
    domain: string;
    logoUrl: string | null;
  };
  customer: {
    name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  razorpayKeyId: string;
  isSimulated: boolean;
  latestPayment: {
    id: string;
    razorpayPaymentId: string | null;
    status: string;
    method: string | null;
  } | null;
}

export function OrderCheckoutClient({ data }: { data: OrderCheckoutData }) {
  const [paying, setPaying] = useState(false);
  const [sdkReady, setSdkReady] = useState(data.isSimulated);
  const [sdkError, setSdkError] = useState(false);
  const [isPaid, setIsPaid] = useState(data.order.status === "PAID");
  const [paidDetails, setPaidDetails] = useState<{
    paymentId: string;
    method: string;
  } | null>(
    data.latestPayment
      ? {
          paymentId: data.latestPayment.razorpayPaymentId || "",
          method: data.latestPayment.method || "Online",
        }
      : null
  );

  const redirectUrl =
    data.order.notes?.redirect_url ||
    data.order.notes?.callback_url ||
    data.order.notes?.return_url ||
    null;

  useEffect(() => {
    if (data.isSimulated) return;

    // Load Razorpay Checkout Script
    if (window.Razorpay) {
      setSdkReady(true);
      return;
    }

    if (!document.getElementById("razorpay-checkout-js")) {
      const script = document.createElement("script");
      script.id = "razorpay-checkout-js";
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => setSdkReady(true);
      script.onerror = () => setSdkError(true);
      document.body.appendChild(script);
    } else {
      const script = document.getElementById("razorpay-checkout-js") as HTMLScriptElement;
      script.addEventListener("load", () => setSdkReady(true), { once: true });
      script.addEventListener("error", () => setSdkError(true), { once: true });
    }
  }, [data.isSimulated]);

  const handlePay = async () => {
    setPaying(true);

    if (data.isSimulated) {
      try {
        const response = await fetch("/api/v1/simulate/pay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_id: data.order.id, method: "upi" }),
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || "Payment could not be completed. Please try again.");
        }

        setIsPaid(true);
        setPaidDetails({ paymentId: result.payment?.razorpay_payment_id || "", method: result.payment?.method || "upi" });
        toast.success("Payment confirmed successfully!");
        if (redirectUrl) setTimeout(() => { window.location.href = redirectUrl; }, 1800);
      } catch (error: any) {
        toast.error(error.message || "Payment could not be completed. Please try again.");
      } finally {
        setPaying(false);
      }
      return;
    }

    if (!window.Razorpay) {
      toast.error(sdkError ? "Secure checkout could not load. Check your connection and reload." : "Secure checkout is still loading. Please wait a moment.");
      setPaying(false);
      return;
    }

    const options = {
      key: data.razorpayKeyId,
      amount: Math.round(data.order.amount * 100),
      currency: data.order.currency || "INR",
      name: data.website.name || "Livka Pay",
      image: data.website.logoUrl || undefined,
      description: `Payment for #${data.order.receipt || data.order.id}`,
      order_id: data.order.razorpayOrderId,
      prefill: {
        name: data.customer?.name || "",
        email: data.customer?.email || "",
        contact: data.customer?.phone || "",
      },
      theme: {
        color: "#059669",
      },
      handler: async function (response: any) {
        try {
          const verifyRes = await fetch("/api/v1/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              order_id: data.order.id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });

          const verifyJson = await verifyRes.json();
          if (verifyJson.success) {
            setIsPaid(true);
            setPaidDetails({
              paymentId: response.razorpay_payment_id,
              method: "Online",
            });
            toast.success("Payment verified & confirmed!");

            if (redirectUrl) {
              setTimeout(() => {
                window.location.href = redirectUrl;
              }, 2500);
            }
          } else {
            toast.error("Signature verification failed server-side.");
          }
        } catch (e: any) {
          toast.error("Error verifying payment: " + e.message);
        } finally {
          setPaying(false);
        }
      },
      modal: {
        ondismiss: function () {
          setPaying(false);
        },
      },
    };

    try {
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err: any) {
      console.error("Razorpay open error:", err);
      toast.error(err.message || "Failed to open checkout window");
      setPaying(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gradient-to-b from-slate-50 via-slate-100/50 to-slate-100 p-4 py-8 sm:py-12">
      <div className="w-full max-w-md space-y-4">
        {/* Branding Header */}
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-xs">
              L
            </div>
            <span className="font-bold text-slate-900 text-sm tracking-tight">Livka Pay</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">Secure Gateway</span>
        </div>

        {/* Main Card */}
        <Card className="shadow-xl border-slate-200/90 overflow-hidden">
          {!isPaid ? (
            <>
              {/* Card Header with Merchant Info */}
              <div className="bg-slate-900 text-white p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400 block font-medium">Merchant</span>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      {data.website.logoUrl && (
                        <img
                          src={data.website.logoUrl}
                          alt={data.website.name}
                          className="w-5 h-5 rounded object-contain bg-white/10"
                        />
                      )}
                      {data.website.name}
                    </h2>
                    <span className="text-[11px] text-slate-400 font-mono block">
                      {data.website.domain}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block font-medium">Total Due</span>
                    <span className="text-2xl font-bold font-mono text-emerald-400">
                      {formatCurrency(data.order.amount, data.order.currency)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Body */}
              <CardContent className="p-6 space-y-5">
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3.5 text-xs text-slate-700 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Order ID:</span>
                    <span className="font-mono font-medium">{data.order.id}</span>
                  </div>
                  {data.order.receipt && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Receipt Ref:</span>
                      <span className="font-mono font-medium">{data.order.receipt}</span>
                    </div>
                  )}
                </div>

                {data.customer && (
                  <div className="space-y-1 text-xs text-slate-500 border-t border-slate-100 pt-3">
                    <div className="flex justify-between">
                      <span>Billed to:</span>
                      <span className="font-semibold text-slate-800">
                        {data.customer.name || data.customer.email || data.customer.phone}
                      </span>
                    </div>
                  </div>
                )}

                <div className="space-y-2 pt-2">
                  <Button
                    onClick={handlePay}
                    disabled={paying || (!data.isSimulated && !sdkReady)}
                    className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-sm font-semibold shadow-md shadow-emerald-600/20"
                  >
                    {paying ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {data.isSimulated ? "Processing Payment..." : "Opening Secure Checkout..."}
                      </>
                    ) : (
                      <>
                        <Lock className="mr-2 h-4 w-4" />
                        {!data.isSimulated && !sdkReady ? "Loading Secure Checkout..." : `Pay ${formatCurrency(data.order.amount, data.order.currency)} Securely`}
                      </>
                    )}
                </Button>
                {sdkError && !data.isSimulated && (
                  <p role="alert" className="text-center text-xs text-rose-600">
                    Secure checkout did not load. Please reload this page or try another network.
                  </p>
                )}

                  <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 pt-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    <span>256-bit SSL Encrypted • Razorpay Certified</span>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <div className="p-8 text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-10 w-10" />
              </div>

              <div>
                <h3 className="text-xl font-bold text-slate-900">Payment Successful ✓</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Your transaction has been verified server-side.
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs font-mono text-left space-y-1.5 text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Merchant:</span>
                  <span className="font-semibold text-slate-900 font-sans">
                    {data.website.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Amount:</span>
                  <span className="font-bold text-emerald-700">
                    {formatCurrency(data.order.amount, data.order.currency)}
                  </span>
                </div>
                {paidDetails?.paymentId && (
                  <div className="flex justify-between border-t border-slate-200 pt-1">
                    <span className="text-slate-500 font-sans">Transaction ID:</span>
                    <span className="truncate max-w-[170px]">{paidDetails.paymentId}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Status:</span>
                  <span className="text-emerald-700 font-bold font-sans">CONFIRMED (PAID)</span>
                </div>
              </div>

              {redirectUrl ? (
                <div className="pt-2">
                  <Button
                    onClick={() => (window.location.href = redirectUrl)}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs"
                  >
                    Return to {data.website.name} <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                  <p className="text-[10px] text-slate-400 mt-2">
                    Redirecting automatically in a moment...
                  </p>
                </div>
              ) : (
                <p className="text-[11px] text-slate-400">
                  A confirmation has been transmitted to {data.website.name}. You may safely close this window.
                </p>
              )}
            </div>
          )}
        </Card>

        <div className="text-center text-[11px] text-slate-400">
          Powered by <strong>Livka Pay</strong> Central Payment Platform
        </div>
      </div>
    </div>
  );
}
