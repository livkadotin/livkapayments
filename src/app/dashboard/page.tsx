"use client";

import { useEffect, useState, useCallback } from "react";
import { StatCard } from "@/components/dashboard/stat-card";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { RecentPayments } from "@/components/dashboard/recent-payments";
import { PaymentDetailModal } from "@/components/payments/payment-detail-modal";
import { formatCurrency } from "@/lib/utils";
import {
  IndianRupee,
  CreditCard,
  AlertCircle,
  RotateCcw,
  Globe,
  TrendingUp,
  Activity,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function DashboardOverviewPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30");
  const [selectedPayment, setSelectedPayment] = useState<any>(null);

  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/overview?period=${period}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load overview data:", err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const stats = data?.stats || {};
  const chartData = data?.chartData || [];
  const recentPayments = data?.recentPayments || [];

  return (
    <div className="space-y-6">
      {/* Page Title & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Overview Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Real-time performance across all connected tenant websites
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/dashboard/websites">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm">
              <Plus className="h-4 w-4" />
              Add Website
            </Button>
          </Link>
          <Link href="/dashboard/qr">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs">
              Generate QR
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Stat Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        <StatCard
          title="Total Revenue"
          value={loading ? "—" : formatCurrency(stats.totalRevenue || 0)}
          subtitle="All-time captured"
          icon={<IndianRupee className="h-4 w-4 text-emerald-600" />}
          trend={{ value: "+14.2%", isPositive: true }}
        />

        <StatCard
          title="Today's Revenue"
          value={loading ? "—" : formatCurrency(stats.todayRevenue || 0)}
          subtitle="Since midnight"
          icon={<TrendingUp className="h-4 w-4 text-blue-600" />}
        />

        <StatCard
          title="Successful Payments"
          value={loading ? "—" : (stats.successfulPayments || 0).toLocaleString("en-IN")}
          subtitle="Completed transactions"
          icon={<CreditCard className="h-4 w-4 text-emerald-600" />}
        />

        <StatCard
          title="Failed Payments"
          value={loading ? "—" : (stats.failedPayments || 0).toLocaleString("en-IN")}
          subtitle="Failed attempts"
          icon={<AlertCircle className="h-4 w-4 text-rose-500" />}
        />

        <StatCard
          title="Total Refunds"
          value={loading ? "—" : formatCurrency(stats.totalRefunds || 0)}
          subtitle={`${stats.refundsCount || 0} refunds processed`}
          icon={<RotateCcw className="h-4 w-4 text-purple-600" />}
        />

        <StatCard
          title="Active Websites"
          value={loading ? "—" : `${stats.activeWebsites || 0} / ${stats.totalWebsites || 0}`}
          subtitle="Tenant instances"
          icon={<Globe className="h-4 w-4 text-teal-600" />}
        />
      </div>

      {/* Charts & Secondary Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Main Revenue Chart */}
        <RevenueChart
          data={chartData}
          period={period}
          onPeriodChange={setPeriod}
          loading={loading}
        />

        {/* Quick System Status Card */}
        <div className="col-span-full xl:col-span-4 flex flex-col gap-4">
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Payment Infrastructure
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/50">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Operational
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-500">Razorpay Gateway</span>
                <span className="font-semibold text-slate-800">Connected (Single Merchant)</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-500">Inbound Webhooks</span>
                <span className="font-mono font-medium text-emerald-600">Active (HMAC SHA-256)</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-500">Tenant Outbound Sync</span>
                <span className="font-medium text-slate-800">Automatic Signature Dispatch</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Central Platform Domain</span>
                <span className="font-mono text-slate-700 text-[11px]">payments.livka.in</span>
              </div>
            </div>

            <div className="pt-2">
              <Link href="/dashboard/developers">
                <Button variant="outline" size="sm" className="w-full text-xs gap-1.5">
                  View API Documentation & SDK
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Payments Section */}
      <RecentPayments
        payments={recentPayments}
        onSelectPayment={(p) => setSelectedPayment(p)}
      />

      {/* Payment Detail Modal */}
      {selectedPayment && (
        <PaymentDetailModal
          payment={selectedPayment}
          open={!!selectedPayment}
          onOpenChange={(open) => !open && setSelectedPayment(null)}
          onRefresh={fetchOverview}
        />
      )}
    </div>
  );
}
