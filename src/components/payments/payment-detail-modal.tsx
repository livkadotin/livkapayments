"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { CopyButton } from "@/components/shared/copy-button";
import { RefundDialog } from "@/components/refunds/refund-dialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CreditCard, RotateCcw, ShieldCheck, User, Globe, Calendar, Clock } from "lucide-react";

interface PaymentDetailModalProps {
  payment: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh?: () => void;
}

export function PaymentDetailModal({
  payment,
  open,
  onOpenChange,
  onRefresh,
}: PaymentDetailModalProps) {
  const [refundOpen, setRefundOpen] = useState(false);

  if (!payment) return null;

  const isRefundable =
    payment.status === "CAPTURED" &&
    (!payment.refunds ||
      payment.refunds.reduce((acc: number, r: any) => acc + r.amount, 0) < payment.amount);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                  <CreditCard className="h-4 w-4" />
                </div>
                <div>
                  <DialogTitle className="text-base font-semibold">Payment Details</DialogTitle>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{payment.id}</p>
                </div>
              </div>
              <StatusBadge status={payment.status} />
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Amount Banner */}
            <div className="rounded-xl bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
                  Total Amount
                </span>
                <span className="text-2xl font-bold font-mono">
                  {formatCurrency(payment.amount, payment.currency)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
                  Method
                </span>
                <span className="text-xs uppercase font-semibold text-emerald-400">
                  {payment.method || "card"}
                </span>
              </div>
            </div>

            {/* Website & Order Association */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                  <Globe className="h-3.5 w-3.5" />
                  <span>Website</span>
                </div>
                <span className="font-semibold text-slate-900">
                  {payment.website?.name || payment.websiteId}
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-slate-200/60 pt-2">
                <span className="text-slate-500">Order Reference:</span>
                <div className="flex items-center gap-1">
                  <span className="font-mono font-semibold text-slate-900">
                    {payment.order?.receipt || payment.orderId}
                  </span>
                  <CopyButton value={payment.order?.receipt || payment.orderId} size="icon" />
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-200/60 pt-2">
                <span className="text-slate-500">Razorpay Payment ID:</span>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-slate-700 truncate max-w-[180px]">
                    {payment.razorpayPaymentId || "—"}
                  </span>
                  {payment.razorpayPaymentId && (
                    <CopyButton value={payment.razorpayPaymentId} size="icon" />
                  )}
                </div>
              </div>

              {payment.razorpayOrderId && (
                <div className="flex items-center justify-between border-t border-slate-200/60 pt-2">
                  <span className="text-slate-500">Razorpay Order ID:</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-slate-700 truncate max-w-[180px]">
                      {payment.razorpayOrderId}
                    </span>
                    <CopyButton value={payment.razorpayOrderId} size="icon" />
                  </div>
                </div>
              )}
            </div>

            {/* Customer Details */}
            {payment.customer && (
              <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-1.5">
                <div className="flex items-center gap-1.5 text-slate-500 font-medium mb-1">
                  <User className="h-3.5 w-3.5" />
                  <span>Customer Information</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Name:</span>
                  <span className="font-medium text-slate-800">{payment.customer.name || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Email:</span>
                  <span className="font-mono text-slate-700">{payment.customer.email || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Phone:</span>
                  <span className="font-mono text-slate-700">{payment.customer.phone || "—"}</span>
                </div>
              </div>
            )}

            {/* Timestamps */}
            <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-slate-500 font-medium mb-1">
                <Clock className="h-3.5 w-3.5" />
                <span>Timeline</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Created:</span>
                <span className="text-slate-700">{formatDate(payment.createdAt)}</span>
              </div>
              {payment.capturedAt && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Captured:</span>
                  <span className="text-emerald-700 font-medium">{formatDate(payment.capturedAt)}</span>
                </div>
              )}
            </div>

            {/* Refunds Section */}
            {payment.refunds && payment.refunds.length > 0 && (
              <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-3 space-y-2">
                <div className="flex items-center justify-between text-purple-900 font-semibold">
                  <span>Refunds History</span>
                  <span>{payment.refunds.length} processed</span>
                </div>
                {payment.refunds.map((r: any) => (
                  <div
                    key={r.id}
                    className="flex justify-between border-t border-purple-100 pt-1 text-[11px]"
                  >
                    <div>
                      <span className="font-bold text-purple-800">
                        {formatCurrency(r.amount, r.currency)}
                      </span>
                      <span className="text-purple-600 block">{r.reason || "Refund"}</span>
                    </div>
                    <span className="text-purple-400">{formatDate(r.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="pt-2 flex justify-end gap-2">
              {isRefundable && (
                <Button
                  variant="outline"
                  onClick={() => setRefundOpen(true)}
                  className="text-purple-700 border-purple-200 hover:bg-purple-50 gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Initiate Refund
                </Button>
              )}
              <Button variant="default" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Nested Refund Dialog */}
      <RefundDialog
        payment={payment}
        open={refundOpen}
        onOpenChange={setRefundOpen}
        onSuccess={() => {
          if (onRefresh) onRefresh();
          onOpenChange(false);
        }}
      />
    </>
  );
}
