"use client";

import { useState, useEffect, use } from "react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Lock, CheckCircle2, AlertCircle, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function PublicPaymentPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [paidDetails, setPaidDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 1. Fetch payment link details
    fetch(`/api/v1/payment-links/${code}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setData(res.payment_link);
          if (res.alreadyPaid || res.payment_link.status === "PAID") {
            setIsPaid(true);
          }
        } else {
          setError(res.error || "Payment link is invalid or expired");
        }
      })
      .catch(() => setError("Failed to load payment link"))
      .finally(() => setLoading(false));

    // 2. Load Razorpay Checkout Script dynamically
    if (!document.getElementById("razorpay-checkout-js")) {
      const script = document.createElement("script");
      script.id = "razorpay-checkout-js";
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, [code]);

  const handlePay = async () => {
    if (!data) return;
    setPaying(true);

    const isSimulated = data.is_simulated || !window.Razorpay;

    if (isSimulated) {
      // In simulated development mode without live Razorpay credentials, trigger server-side capture
      try {
        const simRes = await fetch("/api/v1/simulate/pay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order_id: data.order.id,
            method: "upi",
          }),
        });
        const simJson = await simRes.json();
        if (simJson.success) {
          setIsPaid(true);
          setPaidDetails({
            paymentId: simJson.payment.razorpay_payment_id,
            method: "UPI (Simulated)",
          });
          toast.success("Payment confirmed successfully!");
        } else {
          toast.error(simJson.error || "Payment failed");
        }
      } catch (err: any) {
        toast.error(err.message || "Payment simulation failed");
      } finally {
        setPaying(false);
      }
      return;
    }

    // Live Razorpay Checkout
    const options = {
      key: data.razorpay_key_id,
      amount: Math.round(data.amount * 100),
      currency: data.currency || "INR",
      name: data.website?.name || "Livka Pay",
      description: data.description || `Payment for ${data.code}`,
      image: data.website?.logoUrl || undefined,
      order_id: data.order.razorpay_order_id,
      prefill: {
        name: data.customer?.name || "",
        email: data.customer?.email || "",
        contact: data.customer?.phone || "",
      },
      theme: {
        color: "#059669",
      },
      handler: async function (response: any) {
        // Server-Side Verification
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
    } catch (err) {
      console.error("Razorpay open error:", err);
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <span className="text-xs text-slate-500 font-medium">Loading secure checkout...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full p-8 text-center shadow-lg border-slate-200">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 mb-3">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Payment Link Unavailable</h2>
          <p className="text-xs text-slate-500 mt-1">{error}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gradient-to-b from-slate-50 via-slate-100/50 to-slate-100 p-4 py-8 sm:py-12">
      <div className="w-full max-w-md space-y-4">
        {/* ReplyFlow Branding Header */}
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
                    <h2 className="text-lg font-bold text-white">{data?.website?.name}</h2>
                    <span className="text-[11px] text-slate-400 font-mono block">
                      {data?.website?.domain}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block font-medium">Total Due</span>
                    <span className="text-2xl font-bold font-mono text-emerald-400">
                      {formatCurrency(data?.amount, data?.currency)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Body */}
              <CardContent className="p-6 space-y-5">
                {data?.description && (
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-3.5 text-xs text-slate-700">
                    <span className="font-semibold text-slate-800 block mb-0.5">Description:</span>
                    <span>{data.description}</span>
                  </div>
                )}

                {data?.customer && (
                  <div className="space-y-1 text-xs text-slate-500 border-t border-slate-100 pt-3">
                    <div className="flex justify-between">
                      <span>Billed to:</span>
                      <span className="font-semibold text-slate-800">
                        {data.customer.name || data.customer.email}
                      </span>
                    </div>
                  </div>
                )}

                <div className="space-y-2 pt-2">
                  <Button
                    onClick={handlePay}
                    disabled={paying}
                    className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-sm font-semibold shadow-md shadow-emerald-600/20"
                  >
                    {paying ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Lock className="mr-2 h-4 w-4" />
                        Pay {formatCurrency(data?.amount, data?.currency)} Securely
                      </>
                    )}
                  </Button>

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
                    {data?.website?.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Amount:</span>
                  <span className="font-bold text-emerald-700">
                    {formatCurrency(data?.amount, data?.currency)}
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

              <p className="text-[11px] text-slate-400">
                A confirmation has been transmitted to {data?.website?.name}. You may safely close this window.
              </p>
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
