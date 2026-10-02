"use client";

import { useState, useEffect, useCallback } from "react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { IndianRupee, CreditCard, Percent, AlertCircle, RotateCcw, TrendingUp } from "lucide-react";

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899"];

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [websites, setWebsites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30");
  const [selectedWebsite, setSelectedWebsite] = useState("ALL");

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics?period=${period}&websiteId=${selectedWebsite}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      setLoading(false);
    }
  }, [period, selectedWebsite]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    fetch("/api/admin/websites")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setWebsites(d.websites);
      })
      .catch(() => {});
  }, []);

  const metrics = data?.metrics || {};
  const paymentMethods = data?.paymentMethods || [];
  const websiteDistribution = data?.websiteDistribution || [];

  return (
    <div className="space-y-6">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Payment Analytics
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Gateway performance, payment methods, and tenant revenue distribution
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Website Filter */}
          <select
            value={selectedWebsite}
            onChange={(e) => setSelectedWebsite(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">All Websites</option>
            {websites.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>

          {/* Period Filter */}
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {[
              { label: "7D", val: "7" },
              { label: "30D", val: "30" },
              { label: "90D", val: "90" },
              { label: "1Y", val: "365" },
            ].map((p) => (
              <button
                key={p.val}
                type="button"
                onClick={() => setPeriod(p.val)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                  period === p.val
                    ? "bg-white text-slate-900 font-semibold shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Analytics KPI Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        <StatCard
          title="Captured Revenue"
          value={loading ? "—" : formatCurrency(metrics.totalRevenue || 0)}
          icon={<IndianRupee className="h-4 w-4 text-emerald-600" />}
        />
        <StatCard
          title="Payment Count"
          value={loading ? "—" : (metrics.paymentCount || 0).toLocaleString("en-IN")}
          icon={<CreditCard className="h-4 w-4 text-blue-600" />}
        />
        <StatCard
          title="Average Order Value"
          value={loading ? "—" : formatCurrency(metrics.averageOrderValue || 0)}
          subtitle="AOV per checkout"
          icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
        />
        <StatCard
          title="Success Rate"
          value={loading ? "—" : `${metrics.successRate || 0}%`}
          subtitle="Authorization pass rate"
          icon={<Percent className="h-4 w-4 text-teal-600" />}
        />
        <StatCard
          title="Failed Payments"
          value={loading ? "—" : (metrics.failedPayments || 0).toLocaleString("en-IN")}
          icon={<AlertCircle className="h-4 w-4 text-rose-500" />}
        />
        <StatCard
          title="Total Refunds"
          value={loading ? "—" : formatCurrency(metrics.totalRefunds || 0)}
          icon={<RotateCcw className="h-4 w-4 text-purple-600" />}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Tenant Revenue Breakdown Bar Chart */}
        <Card className="col-span-full lg:col-span-7 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-900">
              Revenue by Connected Website
            </CardTitle>
            <p className="text-xs text-slate-500">Distribution of gross payments by tenant</p>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={websiteDistribution} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => `₹${val >= 1000 ? `${Math.round(val / 1000)}k` : val}`}
                  />
                  <Tooltip
                    formatter={(val: any) => [formatCurrency(Number(val)), "Revenue"]}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                  />
                  <Bar dataKey="revenue" fill="#059669" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Payment Methods Breakdown Pie/Donut Chart */}
        <Card className="col-span-full lg:col-span-5 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-900">
              Payment Methods Breakdown
            </CardTitle>
            <p className="text-xs text-slate-500">UPI, Cards, Netbanking and Wallets</p>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentMethods.filter((m: any) => m.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {paymentMethods.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [`${val} transactions`, "Volume"]}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
