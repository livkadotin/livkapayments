"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  QrCode,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  CreditCard,
  Loader2,
  ExternalLink,
  Smartphone,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";

export interface QrPaymentViewProps {
  orderId: string;
  amount: number;
  currency?: string;
  websiteName?: string;
  websiteLogoUrl?: string | null;
  receipt?: string | null;
  onSuccess: (paymentDetails: { paymentId?: string; method?: string }) => void;
  onSwitchToOnline?: () => void;
  allowSwitchToOnline?: boolean;
}

export type QrPaymentStatus =
  | "INITIALIZING"
  | "PENDING"
  | "PAID"
  | "EXPIRED"
  | "FAILED"
  | "CANCELLED";

export function QrPaymentView({
  orderId,
  amount,
  currency = "INR",
  websiteName = "Livka Pay",
  websiteLogoUrl,
  receipt,
  onSuccess,
  onSwitchToOnline,
  allowSwitchToOnline = true,
}: QrPaymentViewProps) {
  const [qrData, setQrData] = useState<any>(null);
  const [status, setStatus] = useState<QrPaymentStatus>("INITIALIZING");
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [networkErrorCount, setNetworkErrorCount] = useState<number>(0);

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isResolvedRef = useRef<boolean>(false);

  // Stop polling and timer cleanly
  const stopTimers = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  // Format seconds to MM:SS
  const formatTimer = (totalSeconds: number): string => {
    if (totalSeconds <= 0) return "00:00";
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  // Poll payment status from Livka Pay backend
  const pollStatus = useCallback(
    async (targetQrId: string) => {
      if (isResolvedRef.current) return;

      try {
        const res = await fetch(`/api/v1/qr/${encodeURIComponent(targetQrId)}/status`, {
          cache: "no-store",
        });

        if (!res.ok && res.status !== 404) {
          setNetworkErrorCount((prev) => prev + 1);
          return;
        }

        const data = await res.json();
        setNetworkErrorCount(0); // Reset network error count on successful communication

        if (!data.success) {
          return;
        }

        // 1. Payment Confirmed PAID
        if (data.is_paid || data.status === "PAID") {
          isResolvedRef.current = true;
          stopTimers();
          setStatus("PAID");
          const ref = data.payment_reference || data.qr_payment?.order?.payments?.[0]?.razorpayPaymentId || null;
          setPaymentReference(ref);
          toast.success("Payment Successful! Confirmation verified.");
          onSuccess({ paymentId: ref || undefined, method: data.payment_method || "UPI QR" });
          return;
        }

        // 2. Payment Failed
        if (data.status === "FAILED") {
          isResolvedRef.current = true;
          stopTimers();
          setStatus("FAILED");
          setErrorMsg("Payment transaction failed. Please retry.");
          return;
        }

        // 3. Payment Cancelled
        if (data.status === "CANCELLED") {
          isResolvedRef.current = true;
          stopTimers();
          setStatus("CANCELLED");
          setErrorMsg("Payment was cancelled.");
          return;
        }

        // 4. QR Expired
        if (data.is_expired || data.status === "EXPIRED") {
          isResolvedRef.current = true;
          stopTimers();
          setStatus("EXPIRED");
          return;
        }
      } catch {
        // Network failure: do NOT mark payment failed, simply count temporary issue
        setNetworkErrorCount((prev) => prev + 1);
      }
    },
    [stopTimers, onSuccess]
  );

  // Create or retrieve existing dynamic QR for this order
  const initQr = useCallback(
    async (forceRefresh = false) => {
      setLoading(true);
      setErrorMsg(null);
      isResolvedRef.current = false;
      stopTimers();

      try {
        const res = await fetch("/api/v1/qr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId,
            expiresInMinutes: 15,
            forceRefresh,
          }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to generate dynamic QR");
        }

        // If order was already paid
        if (data.alreadyPaid || data.status === "PAID") {
          isResolvedRef.current = true;
          setStatus("PAID");
          setPaymentReference(data.payment_reference || null);
          onSuccess({ paymentId: data.payment_reference, method: "UPI QR" });
          setLoading(false);
          return;
        }

        const qrInfo = data.qr_payment;
        setQrData(qrInfo);
        setStatus("PENDING");

        // Set countdown seconds from server response
        const remaining = qrInfo.expires_in_seconds || 15 * 60;
        setSecondsRemaining(remaining);

        // Start countdown timer
        countdownTimerRef.current = setInterval(() => {
          setSecondsRemaining((prev) => {
            if (prev <= 1) {
              stopTimers();
              setStatus("EXPIRED");
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        // Start polling payment status every 3 seconds
        const lookupId = qrInfo.id || orderId;
        pollTimerRef.current = setInterval(() => {
          pollStatus(lookupId);
        }, 3000);

        // Perform initial poll immediately
        pollStatus(lookupId);
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to load dynamic QR payment");
        setStatus("FAILED");
      } finally {
        setLoading(false);
      }
    },
    [orderId, stopTimers, pollStatus, onSuccess]
  );

  // Initialize on mount
  useEffect(() => {
    initQr(false);
    return () => {
      stopTimers();
    };
  }, [initQr, stopTimers]);

  return (
    <div className="w-full space-y-4">
      {/* Loading Skeleton */}
      {loading && (
        <div className="flex flex-col items-center justify-center p-8 space-y-4 bg-white rounded-2xl border border-slate-100 shadow-inner">
          <div className="relative flex items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
            <QrCode className="h-5 w-5 text-emerald-700 absolute" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-semibold text-slate-800">
              Generating secure UPI QR...
            </p>
            <p className="text-xs text-slate-400">
              Binding to order #{receipt || orderId}
            </p>
          </div>
        </div>
      )}

      {/* 1. Active Pending QR State */}
      {!loading && status === "PENDING" && qrData && (
        <div className="flex flex-col items-center text-center space-y-4">
          {/* Header Amount */}
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Scan to Pay
            </span>
            <div className="text-3xl font-extrabold font-mono text-slate-900 tracking-tight">
              {formatCurrency(qrData.amount, qrData.currency)}
            </div>
            <p className="text-xs text-slate-500 font-mono">
              Order #{qrData.receipt || qrData.order_id}
            </p>
          </div>

          {/* QR Code Container */}
          <div className="relative p-3.5 bg-white rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrData.qr_image_data_url}
              alt="Scan QR to Pay"
              className="w-56 h-56 object-contain rounded-lg"
            />

            {/* Merchant Logo Overlay in Center if available */}
            {websiteLogoUrl && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="p-1.5 bg-white rounded-xl shadow-md border border-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={websiteLogoUrl}
                    alt={websiteName}
                    className="w-7 h-7 rounded object-contain"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Instruction and Timer */}
          <div className="space-y-2 max-w-xs">
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Open your UPI app and scan this QR code to complete payment.
            </p>

            {/* Countdown Badge */}
            <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1 rounded-full text-xs font-semibold font-mono">
              <Clock className="h-3.5 w-3.5 text-amber-600" />
              <span>Payment expires in {formatTimer(secondsRemaining)}</span>
            </div>

            {/* Live Detection Badge */}
            <div className="flex items-center justify-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 py-1 px-3 rounded-full font-medium">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span>Waiting for payment detection...</span>
            </div>

            {networkErrorCount > 1 && (
              <p className="text-[11px] text-amber-600">
                Reconnecting status verification...
              </p>
            )}
          </div>

          {/* Mobile Direct Pay Action */}
          <div className="w-full pt-1 space-y-2">
            {qrData.upi_intent_url && (
              <a
                href={qrData.upi_intent_url}
                className="inline-flex items-center justify-center w-full h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold shadow-sm transition-colors sm:hidden gap-1.5"
              >
                <Smartphone className="h-4 w-4" />
                Open UPI App on this Phone
              </a>
            )}

            {allowSwitchToOnline && onSwitchToOnline && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onSwitchToOnline}
                className="w-full text-xs text-slate-600 hover:text-slate-900 gap-1.5"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Pay via Cards / Netbanking Instead
              </Button>
            )}
          </div>
        </div>
      )}

      {/* 2. Success State */}
      {!loading && status === "PAID" && (
        <div className="flex flex-col items-center text-center p-6 space-y-4 bg-emerald-50/50 rounded-2xl border border-emerald-200">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-9 w-9 animate-in zoom-in-75 duration-300" />
          </div>

          <div className="space-y-1">
            <h3 className="text-xl font-bold text-slate-900">
              Payment Successful ✓
            </h3>
            <p className="text-xs text-slate-600">
              Payment of {formatCurrency(amount, currency)} has been verified server-side.
            </p>
          </div>

          <div className="w-full rounded-xl bg-white border border-emerald-200/80 p-3.5 text-xs font-mono text-left space-y-1.5 text-slate-700 shadow-xs">
            <div className="flex justify-between">
              <span className="text-slate-500 font-sans">Merchant:</span>
              <span className="font-semibold text-slate-800 font-sans">
                {websiteName}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-sans">Order Ref:</span>
              <span>{receipt || orderId}</span>
            </div>
            {paymentReference && (
              <div className="flex justify-between border-t border-slate-100 pt-1">
                <span className="text-slate-500 font-sans">Transaction ID:</span>
                <span className="truncate max-w-[170px] text-emerald-700 font-semibold">
                  {paymentReference}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500 font-sans">Status:</span>
              <span className="text-emerald-700 font-bold font-sans">CONFIRMED (PAID)</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Expired State */}
      {!loading && status === "EXPIRED" && (
        <div className="flex flex-col items-center text-center p-6 space-y-4 bg-amber-50/60 rounded-2xl border border-amber-200">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <Clock className="h-6 w-6" />
          </div>

          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900">QR Code Expired</h3>
            <p className="text-xs text-slate-600">
              This dynamic payment QR has expired for your security.
            </p>
          </div>

          <div className="w-full space-y-2 pt-2">
            <Button
              onClick={() => initQr(true)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold h-10 gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Generate New QR Code
            </Button>

            {allowSwitchToOnline && onSwitchToOnline && (
              <Button
                variant="outline"
                onClick={onSwitchToOnline}
                className="w-full text-xs text-slate-700 border-slate-300 hover:bg-slate-50 h-10 gap-1.5"
              >
                <CreditCard className="h-3.5 w-3.5" />
                Pay Online Instead
              </Button>
            )}
          </div>
        </div>
      )}

      {/* 4. Failure / Error State */}
      {!loading && (status === "FAILED" || status === "CANCELLED") && (
        <div className="flex flex-col items-center text-center p-6 space-y-4 bg-rose-50/60 rounded-2xl border border-rose-200">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <AlertCircle className="h-6 w-6" />
          </div>

          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900">
              {status === "CANCELLED" ? "Payment Cancelled" : "Payment Failed"}
            </h3>
            <p className="text-xs text-slate-600">
              {errorMsg || "We could not complete the QR payment process."}
            </p>
          </div>

          <div className="w-full space-y-2 pt-2">
            <Button
              onClick={() => initQr(true)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold h-10 gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Retry QR Payment
            </Button>

            {allowSwitchToOnline && onSwitchToOnline && (
              <Button
                variant="outline"
                onClick={onSwitchToOnline}
                className="w-full text-xs text-slate-700 border-slate-300 hover:bg-slate-50 h-10 gap-1.5"
              >
                <CreditCard className="h-3.5 w-3.5" />
                Switch to Pay Online
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
