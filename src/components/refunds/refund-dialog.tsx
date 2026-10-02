"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { RotateCcw, Loader2, AlertCircle } from "lucide-react";

interface RefundDialogProps {
  payment: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function RefundDialog({ payment, open, onOpenChange, onSuccess }: RefundDialogProps) {
  const [amount, setAmount] = useState<number | string>(payment?.amount || "");
  const [reason, setReason] = useState("");
  const [isFull, setIsFull] = useState(true);
  const [loading, setLoading] = useState(false);

  if (!payment) return null;

  const totalPreviouslyRefunded =
    payment.refunds?.reduce((acc: number, r: any) => acc + (r.amount || 0), 0) || 0;
  const maxRefundable = Math.max(0, payment.amount - totalPreviouslyRefunded);

  const handleFullToggle = (full: boolean) => {
    setIsFull(full);
    if (full) {
      setAmount(maxRefundable);
    }
  };

  const handleRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    const refundVal = Number(amount);

    if (isNaN(refundVal) || refundVal <= 0) {
      toast.error("Enter a valid refund amount");
      return;
    }

    if (refundVal > maxRefundable) {
      toast.error(`Refund amount cannot exceed remaining balance (${formatCurrency(maxRefundable)})`);
      return;
    }

    if (!reason.trim()) {
      toast.error("Please provide a refund reason");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/v1/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: payment.id,
          amount: refundVal,
          reason: reason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to process refund");
      }

      toast.success(`Refund of ${formatCurrency(refundVal)} processed successfully!`);
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to process refund");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
              <RotateCcw className="h-4 w-4" />
            </div>
            <DialogTitle>Issue Refund</DialogTitle>
          </div>
          <DialogDescription>
            Initiate a refund for Payment <span className="font-mono">{payment.id}</span> ({payment.website?.name}).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleRefund} className="space-y-4 py-2">
          <div className="rounded-lg bg-slate-50 p-3 border border-slate-200 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Original Amount:</span>
              <span className="font-semibold text-slate-900">{formatCurrency(payment.amount)}</span>
            </div>
            {totalPreviouslyRefunded > 0 && (
              <div className="flex justify-between text-purple-600">
                <span>Previously Refunded:</span>
                <span className="font-semibold">-{formatCurrency(totalPreviouslyRefunded)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-200 pt-1 font-bold">
              <span className="text-slate-700">Max Refundable:</span>
              <span className="text-emerald-700">{formatCurrency(maxRefundable)}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Refund Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleFullToggle(true)}
                className={`py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${
                  isFull
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800 font-semibold"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                Full Refund ({formatCurrency(maxRefundable)})
              </button>
              <button
                type="button"
                onClick={() => handleFullToggle(false)}
                className={`py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${
                  !isFull
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800 font-semibold"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                Partial Refund
              </button>
            </div>
          </div>

          {!isFull && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Refund Amount (₹ INR) *
              </label>
              <Input
                type="number"
                step="0.01"
                max={maxRefundable}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Reason for Refund *
            </label>
            <Input
              placeholder="e.g. Customer requested cancellation / sizing return"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || maxRefundable <= 0}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                `Refund ${formatCurrency(Number(amount) || maxRefundable)}`
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
