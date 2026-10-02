"use client";

import { useState, useEffect, use } from "react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, QrCode, ShieldCheck, Loader2, Sparkles, Lock } from "lucide-react";
import { toast } from "sonner";

export default function PublicQrPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [qrData, setQrData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isPaid, setIsPaid] = useState(false);
  const [paying, setPaying] = useState(false);

  // Poll status every 3 seconds until paid
  useEffect(() => {
    let interval: any = null;

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/v1/qr/${id}/status`);
        const json = await res.json();
        if (json.success && json.qr_payment) {
          setQrData(json.qr_payment);
          if (json.qr_payment.status === "PAID") {
            setIsPaid(true);
            if (interval) clearInterval(interval);
          }
        }
      } catch (e) {
        console.error("Status poll error:", e);
      } finally {
        setLoading(false);
      }
    };

    checkStatus();
    interval = setInterval(checkStatus, 3000);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [id]);

  // Load Razorpay Script
  useEffect(() => {
    if (!document.getElementById("razorpay-checkout-js")) {
      const script = document.createElement("script");
      script.id = "razorpay-checkout-js";
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const handleMobileDirectPay = async () => {
    if (!qrData) return;
    setPaying(true);

    const isSimulated = qrData.is_simulated || !window.Razorpay;

    if (isSimulated) {
      try {
        const simRes = await fetch("/api/v1/simulate/pay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order_id: qrData.order.id,
            method: "upi",
          }),
        });
        const simJson = await simRes.json();
        if (simJson.success) {
          setIsPaid(true);
          toast.success("Payment completed successfully!");
        }
      } catch (err: any) {
        toast.error(err.message || "Payment simulation failed");
      } finally {
        setPaying(false);
      }
      return;
    }

    const options = {
      key: qrData.razorpay_key_id,
      amount: Math.round(qrData.amount * 100),
      currency: qrData.currency || "INR",
      name: qrData.website?.name || "Livka Pay",
      description: `QR Payment for ${qrData.order.receipt || qrData.order.id}`,
      image: qrData.website?.logoUrl || undefined,
      order_id: qrData.order.razorpayOrderId,
      prefill: {
        name: qrData.customer_name || "",
        email: qrData.customer_email || "",
      },
      theme: { color: "#059669" },
      handler: async function (response: any) {
        try {
          await fetch("/api/v1/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              order_id: qrData.order.id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          setIsPaid(true);
        } catch {
          toast.error("Verification failed");
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
    } catch {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gradient-to-b from-slate-50 to-slate-100 p-4 py-8">
      <div className="w-full max-w-sm space-y-4">
        {/* Top Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-lg shadow-sm">
            L
          </div>
          <h1 className="font-bold text-slate-900 text-base">Livka Pay</h1>
          <p className="text-xs text-slate-400">Dynamic Payment QR</p>
        </div>

        {/* Card */}
        <Card className="shadow-xl border-slate-200 overflow-hidden text-center">
          {!isPaid ? (
            <CardContent className="p-6 space-y-5">
              <div>
                <span className="text-xs text-slate-400 block uppercase tracking-wider font-semibold">
                  {qrData?.website?.name}
                </span>
                <div className="text-3xl font-extrabold font-mono text-slate-900 mt-1">
                  {formatCurrency(qrData?.amount, qrData?.currency)}
                </div>
                <span className="text-xs text-slate-500 font-mono mt-0.5 block">
                  Order #{qrData?.order?.receipt || qrData?.order?.id}
                </span>
              </div>

              {/* QR Image */}
              <div className="mx-auto p-3 bg-white border border-slate-200 rounded-2xl shadow-inner w-fit">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrData?.qr_image_data_url}
                  alt="Scan to pay"
                  className="h-56 w-56 object-contain"
                />
              </div>

              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  <span>Awaiting payment detection...</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Scan using Google Pay, PhonePe, Paytm or banking app
                </p>
              </div>

              {/* Mobile Pay Directly Button */}
              <div className="pt-2 border-t border-slate-100">
                <Button
                  onClick={handleMobileDirectPay}
                  disabled={paying}
                  variant="outline"
                  className="w-full text-xs font-semibold text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                >
                  {paying ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Opening Checkout...
                    </>
                  ) : (
                    <>
                      <Lock className="mr-1.5 h-3.5 w-3.5" />
                      Paying on this device? Pay Directly
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          ) : (
            <CardContent className="p-8 space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 animate-bounce">
                <CheckCircle2 className="h-10 w-10" />
              </div>

              <div>
                <h2 className="text-2xl font-bold text-slate-900">Payment Successful ✓</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Payment of {formatCurrency(qrData?.amount, qrData?.currency)} verified!
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs text-left font-mono space-y-1 text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Website:</span>
                  <span className="font-semibold text-slate-800 font-sans">
                    {qrData?.website?.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Order Ref:</span>
                  <span>{qrData?.order?.receipt || qrData?.order?.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Status:</span>
                  <span className="text-emerald-700 font-bold font-sans">CAPTURED & CONFIRMED</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400">
                The transaction has been confirmed and reported to the merchant.
              </p>
            </CardContent>
          )}
        </Card>

        <div className="text-center text-[11px] text-slate-400 flex items-center justify-center gap-1">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          <span>Livka Pay Central Payment Infrastructure</span>
        </div>
      </div>
    </div>
  );
}
