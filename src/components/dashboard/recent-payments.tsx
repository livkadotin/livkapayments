"use client";

import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Globe, ArrowUpRight, CreditCard } from "lucide-react";

interface RecentPaymentsProps {
  payments: Array<any>;
  onSelectPayment?: (payment: any) => void;
}

export function RecentPayments({ payments, onSelectPayment }: RecentPaymentsProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base font-semibold text-slate-900">
            Recent Payments
          </CardTitle>
          <p className="text-xs text-slate-500 mt-0.5">Live transactions across all connected websites</p>
        </div>
        <Link
          href="/dashboard/payments"
          className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800 transition-colors"
        >
          View all <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>

      <CardContent className="p-0">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-y border-slate-100">
              <tr>
                <th className="py-3 px-6">Website</th>
                <th className="py-3 px-4">Order Ref</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-6 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-slate-400">
                    No transactions recorded yet
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => onSelectPayment && onSelectPayment(p)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-6 font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100">
                          {p.website?.name?.charAt(0) || "W"}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900 block leading-tight">
                            {p.website?.name || "Unknown"}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {p.website?.domain || ""}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-xs text-slate-700">
                      {p.order?.receipt || p.order?.id || "—"}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="text-xs">
                        <span className="text-slate-800 font-medium block">
                          {p.customer?.name || "Customer"}
                        </span>
                        <span className="text-slate-400 text-[11px] truncate max-w-[140px] block">
                          {p.customer?.email || "—"}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 uppercase text-[11px] font-semibold text-slate-500">
                      {p.method || "card"}
                    </td>

                    <td className="py-3.5 px-4 text-right font-semibold text-slate-900 font-mono text-sm">
                      {formatCurrency(p.amount, p.currency)}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <StatusBadge status={p.status} />
                    </td>

                    <td className="py-3.5 px-6 text-right text-xs text-slate-400">
                      {formatDate(p.created_at || p.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Responsive Cards View */}
        <div className="md:hidden divide-y divide-slate-100">
          {payments.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No transactions recorded yet
            </div>
          ) : (
            payments.map((p) => (
              <div
                key={p.id}
                onClick={() => onSelectPayment && onSelectPayment(p)}
                className="p-4 active:bg-slate-50 transition-colors cursor-pointer space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 text-sm">
                      {p.website?.name || "Website"}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      #{p.order?.receipt || p.order?.id}
                    </span>
                  </div>
                  <span className="font-bold text-slate-900 font-mono">
                    {formatCurrency(p.amount, p.currency)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{p.customer?.name || p.customer?.email || "Customer"}</span>
                  <StatusBadge status={p.status} />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span className="uppercase font-semibold">{p.method || "card"}</span>
                  <span>{formatDate(p.created_at || p.createdAt)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
