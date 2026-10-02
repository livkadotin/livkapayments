"use client";

import { useState, useEffect } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/status-badge";
import { CopyButton } from "@/components/shared/copy-button";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { RotateCcw, RefreshCw, IndianRupee } from "lucide-react";
import Link from "next/link";

export default function RefundsPage() {
  const [refunds, setRefunds] = useState<any[]>([]);
  const [websites, setWebsites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWebsite, setSelectedWebsite] = useState("ALL");

  const fetchRefunds = async () => {
    setLoading(true);
    try {
      const url = selectedWebsite !== "ALL" ? `/api/v1/refunds?websiteId=${selectedWebsite}` : "/api/v1/refunds";
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setRefunds(data.refunds);
      }
    } catch (err) {
      console.error("Failed to load refunds:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRefunds();
  }, [selectedWebsite]);

  useEffect(() => {
    fetch("/api/admin/websites")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setWebsites(d.websites);
      })
      .catch(() => {});
  }, []);

  const totalRefundAmount = refunds.reduce((acc, r) => acc + r.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Refunds Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Full and partial refunds synchronized with Razorpay gateway
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/dashboard/payments">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm text-xs">
              View Payments to Refund
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchRefunds}
            className="text-xs text-slate-600"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Summary Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Total Processed Refunds
          </span>
          <div className="text-2xl font-bold tracking-tight text-purple-700 mt-2 font-mono">
            {formatCurrency(totalRefundAmount)}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">
            {refunds.length} successful refund disbursements
          </span>
        </Card>

        <Card className="p-5 flex flex-col justify-center">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Filter By Website
            </span>
            <select
              value={selectedWebsite}
              onChange={(e) => setSelectedWebsite(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 mt-1"
            >
              <option value="ALL">All Websites</option>
              {websites.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.domain})
                </option>
              ))}
            </select>
          </div>
        </Card>
      </div>

      {/* Refunds Table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                <tr>
                  <th className="py-3 px-6">Refund ID</th>
                  <th className="py-3 px-4">Website</th>
                  <th className="py-3 px-4">Order Ref</th>
                  <th className="py-3 px-4">Payment ID</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-6 text-right">Processed At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-xs text-slate-400">
                      Loading refunds...
                    </td>
                  </tr>
                ) : refunds.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-xs text-slate-400">
                      No refunds recorded.
                    </td>
                  </tr>
                ) : (
                  refunds.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-6 font-mono text-xs font-semibold text-slate-800">
                        {r.id}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-900">
                        {r.website?.name}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                        {r.payment?.order?.receipt || "—"}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                        {r.payment?.id}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-700 max-w-[200px] truncate">
                        {r.reason || "Customer return"}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-purple-700">
                        {formatCurrency(r.amount, r.currency)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="py-3.5 px-6 text-right text-xs text-slate-400">
                        {formatDate(r.processed_at || r.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
