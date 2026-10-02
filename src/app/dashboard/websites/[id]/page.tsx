"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { CopyButton } from "@/components/shared/copy-button";
import { KeyRotationModal } from "@/components/websites/key-rotation-modal";
import { PaymentDetailModal } from "@/components/payments/payment-detail-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate, maskSecret } from "@/lib/utils";
import {
  Globe,
  KeyRound,
  ArrowLeft,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  Plus,
  Trash2,
  IndianRupee,
  CreditCard,
  RotateCcw,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";

export default function WebsiteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rotationOpen, setRotationOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);

  // Allowed domains editor
  const [newDomain, setNewDomain] = useState("");
  const [savingDomain, setSavingDomain] = useState(false);

  // Secret visibility toggle
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  const fetchDetail = async () => {
    try {
      const res = await fetch(`/api/admin/websites/${id}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        toast.error(json.error || "Website not found");
      }
    } catch (err) {
      console.error("Failed to load website detail:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const handleToggleStatus = async () => {
    if (!data?.website) return;
    const newStatus = data.website.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      const res = await fetch(`/api/admin/websites/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Website marked as ${newStatus}`);
        fetchDetail();
      }
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) return;

    const clean = newDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
    const currentList: string[] = data?.website?.allowedDomains || [];

    if (currentList.includes(clean)) {
      toast.error("Domain already allowed");
      return;
    }

    const updated = [...currentList, clean];
    setSavingDomain(true);
    try {
      const res = await fetch(`/api/admin/websites/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowedDomains: updated }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Domain ${clean} added to allowed origins`);
        setNewDomain("");
        fetchDetail();
      }
    } catch {
      toast.error("Failed to add domain");
    } finally {
      setSavingDomain(false);
    }
  };

  const handleRemoveDomain = async (domainToRemove: string) => {
    const currentList: string[] = data?.website?.allowedDomains || [];
    const updated = currentList.filter((d) => d !== domainToRemove);

    try {
      const res = await fetch(`/api/admin/websites/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowedDomains: updated }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Domain ${domainToRemove} removed`);
        fetchDetail();
      }
    } catch {
      toast.error("Failed to remove domain");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 rounded bg-slate-200 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-28 rounded-xl bg-slate-200 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const website = data?.website;
  const stats = data?.stats || {};
  const payments = data?.payments || [];
  const activeKey = website?.apiKeys?.[0];

  return (
    <div className="space-y-6">
      {/* Back button & Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/dashboard/websites"
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to all websites
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{website?.name}</h1>
            <StatusBadge status={website?.status} />
          </div>
          <p className="text-xs text-slate-400 font-mono">ID: {website?.id}</p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleStatus}
            className={website?.status === "ACTIVE" ? "text-amber-700 hover:bg-amber-50" : "text-emerald-700 hover:bg-emerald-50"}
          >
            {website?.status === "ACTIVE" ? "Disable Website" : "Activate Website"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setRotationOpen(true)}
            className="gap-1.5 text-xs text-rose-700 border-rose-200 hover:bg-rose-50"
          >
            <KeyRound className="h-3.5 w-3.5" />
            Rotate API Keys
          </Button>
        </div>
      </div>

      {/* Website KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Website Revenue"
          value={formatCurrency(stats.totalRevenue || 0)}
          subtitle="Captured transactions"
          icon={<IndianRupee className="h-4 w-4 text-emerald-600" />}
        />
        <StatCard
          title="Successful Payments"
          value={(stats.successfulPayments || 0).toLocaleString("en-IN")}
          subtitle="Total successful"
          icon={<CreditCard className="h-4 w-4 text-blue-600" />}
        />
        <StatCard
          title="Refunds"
          value={formatCurrency(stats.totalRefunds || 0)}
          subtitle={`${stats.refundsCount || 0} processed`}
          icon={<RotateCcw className="h-4 w-4 text-purple-600" />}
        />
        <StatCard
          title="Failed Payments"
          value={(stats.failedPayments || 0).toLocaleString("en-IN")}
          subtitle="Failed attempts"
          icon={<AlertCircle className="h-4 w-4 text-rose-500" />}
        />
      </div>

      {/* Credentials & Configuration Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* API Credentials Card */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-slate-900">
                API Credentials
              </CardTitle>
              <button
                onClick={() => setRotationOpen(true)}
                className="text-xs text-emerald-700 hover:underline font-medium"
              >
                Rotate Keys
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Credentials for authenticating server and client payment requests
            </p>
          </CardHeader>

          <CardContent className="space-y-3 font-mono text-xs">
            {/* Publishable Key */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-1">
              <span className="font-sans text-[11px] uppercase font-semibold text-slate-400 block">
                Publishable Key (Client Safe)
              </span>
              <div className="flex items-center justify-between">
                <span className="text-slate-900 font-semibold truncate max-w-[260px]">
                  {activeKey?.publishableKey || "—"}
                </span>
                {activeKey && <CopyButton value={activeKey.publishableKey} />}
              </div>
            </div>

            {/* Secret Key Masked */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-1">
              <span className="font-sans text-[11px] uppercase font-semibold text-slate-400 block">
                Secret Key (Hashed on server)
              </span>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium truncate max-w-[260px]">
                  {activeKey?.secretKeyPrefix ? `${activeKey.secretKeyPrefix}••••••••` : "••••••••••••••••"}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRotationOpen(true)}
                  className="font-sans text-xs h-8"
                >
                  Generate New
                </Button>
              </div>
            </div>

            {/* Webhook Secret */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-1">
              <div className="flex items-center justify-between font-sans text-[11px] uppercase font-semibold text-slate-400">
                <span>Webhook Secret</span>
                <button
                  onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                  className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800"
                >
                  {showWebhookSecret ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  <span>{showWebhookSecret ? "Hide" : "Show"}</span>
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-900 font-semibold truncate max-w-[260px]">
                  {showWebhookSecret ? activeKey?.webhookSecret : maskSecret(activeKey?.webhookSecret || "")}
                </span>
                {activeKey && <CopyButton value={activeKey.webhookSecret} />}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Allowed CORS Domains Card */}
        <Card className="shadow-sm flex flex-col justify-between">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-900">
              Allowed CORS Domains
            </CardTitle>
            <p className="text-xs text-slate-500">
              Origin hostnames authorized to make client-side checkout requests using this website&apos;s publishable key.
            </p>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Domain List */}
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {(!website?.allowedDomains || website.allowedDomains.length === 0) ? (
                <p className="text-xs text-slate-400 italic">No allowed domains configured yet.</p>
              ) : (
                website.allowedDomains.map((dom: string) => (
                  <div
                    key={dom}
                    className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs"
                  >
                    <span className="font-mono text-slate-800">{dom}</span>
                    <button
                      onClick={() => handleRemoveDomain(dom)}
                      className="text-slate-400 hover:text-rose-600 transition-colors"
                      title="Remove domain"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Add Domain Form */}
            <form onSubmit={handleAddDomain} className="flex gap-2">
              <Input
                placeholder="e.g. store.livka.in or localhost:3000"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                className="text-xs font-mono"
              />
              <Button
                type="submit"
                size="sm"
                disabled={savingDomain}
                className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Website Transactions Table */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">
              {website?.name} Payments
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Filtered history of transactions belonging to this website ID
            </p>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-y border-slate-100">
                <tr>
                  <th className="py-3 px-6">Payment ID</th>
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
                      No payments found for this website yet
                    </td>
                  </tr>
                ) : (
                  payments.map((p: any) => (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedPayment({ ...p, website })}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-6 font-mono text-xs font-semibold text-slate-800">
                        {p.id}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                        {p.order?.receipt || p.orderId}
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <span className="text-slate-800 block">{p.customer?.name || "Customer"}</span>
                        <span className="text-slate-400 text-[11px]">{p.customer?.email || "—"}</span>
                      </td>
                      <td className="py-3.5 px-4 uppercase text-[11px] font-semibold text-slate-500">
                        {p.method || "card"}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(p.amount, p.currency)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="py-3.5 px-6 text-right text-xs text-slate-400">
                        {formatDate(p.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      {rotationOpen && (
        <KeyRotationModal
          websiteId={website.id}
          websiteName={website.name}
          open={rotationOpen}
          onOpenChange={setRotationOpen}
          onSuccess={fetchDetail}
        />
      )}

      {selectedPayment && (
        <PaymentDetailModal
          payment={selectedPayment}
          open={!!selectedPayment}
          onOpenChange={(open) => !open && setSelectedPayment(null)}
          onRefresh={fetchDetail}
        />
      )}
    </div>
  );
}
