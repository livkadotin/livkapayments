"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { CopyButton } from "@/components/shared/copy-button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { QrCode, Plus, Download, ExternalLink, Share2, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function QrPaymentsPage() {
  const [qrList, setQrList] = useState<any[]>([]);
  const [websites, setWebsites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [inspectQr, setInspectQr] = useState<any>(null);

  // Form state
  const [websiteId, setWebsiteId] = useState("");
  const [amount, setAmount] = useState<number | string>(799);
  const [orderId, setOrderId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [generatedQr, setGeneratedQr] = useState<any>(null);

  const fetchQrList = async () => {
    try {
      const res = await fetch("/api/v1/qr");
      const data = await res.json();
      if (data.success) {
        setQrList(data.qr_payments);
      }
    } catch (err) {
      console.error("Failed to load QR list:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQrList();
    fetch("/api/admin/websites")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.websites.length > 0) {
          setWebsites(d.websites);
          setWebsiteId(d.websites[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const handleCreateQr = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/v1/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteId,
          amount: Number(amount),
          orderId: orderId.trim() || undefined,
          customerName: customerName.trim() || undefined,
          customerEmail: customerEmail.trim() || undefined,
          expiresInMinutes: 120,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to generate QR");
      }

      setGeneratedQr(data.qr_payment);
      toast.success("Dynamic QR Payment Generated!");
      fetchQrList();
    } catch (err: any) {
      toast.error(err.message || "Failed to generate QR");
    } finally {
      setCreating(false);
    }
  };

  const handleDownloadQr = (qrImageSrc: string, fileName: string) => {
    const a = document.createElement("a");
    a.href = qrImageSrc;
    a.download = `livka-qr-${fileName}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("QR Code downloaded!");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            QR Payments Engine
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Generate dynamic, payment-specific QR codes with instant live capture status
          </p>
        </div>

        <Button
          onClick={() => {
            setGeneratedQr(null);
            setCreateModalOpen(true);
          }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Generate New QR
        </Button>
      </div>

      {/* QR List Grid */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Active & Paid QR Payments</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-y border-slate-100">
                <tr>
                  <th className="py-3 px-6">QR ID</th>
                  <th className="py-3 px-4">Website</th>
                  <th className="py-3 px-4">Order Ref</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Live Page</th>
                  <th className="py-3 px-6 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-xs text-slate-400">
                      Loading QR codes...
                    </td>
                  </tr>
                ) : qrList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-xs text-slate-400">
                      No QR payments created yet. Click &quot;Generate New QR&quot; above.
                    </td>
                  </tr>
                ) : (
                  qrList.map((qr) => (
                    <tr key={qr.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-6 font-mono text-xs font-semibold text-slate-800">
                        {qr.id}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-900">
                        {qr.website?.name}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                        {qr.receipt || "—"}
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <span className="text-slate-800 block">{qr.customer_name || "Guest"}</span>
                        <span className="text-slate-400 text-[11px]">{qr.customer_email || "—"}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(qr.amount, qr.currency)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <StatusBadge status={qr.status} />
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Link
                          href={`/pay/qr/${qr.id}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline font-medium"
                        >
                          <span>Open QR</span>
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </td>
                      <td className="py-3.5 px-6 text-right text-xs text-slate-400">
                        {formatDate(qr.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Generate QR Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <QrCode className="h-4 w-4" />
              </div>
              <DialogTitle>
                {generatedQr ? "QR Payment Ready" : "Generate Dynamic QR Payment"}
              </DialogTitle>
            </div>
            <DialogDescription>
              {generatedQr
                ? "Customers can scan this QR with their mobile camera or UPI app to pay."
                : "Creates an order and dynamic QR code linked to the selected tenant website."}
            </DialogDescription>
          </DialogHeader>

          {!generatedQr ? (
            <form onSubmit={handleCreateQr} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Target Website *
                </label>
                <select
                  value={websiteId}
                  onChange={(e) => setWebsiteId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                >
                  {websites.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.domain})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Amount (₹ INR) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="799"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Order Reference (Optional)
                </label>
                <Input
                  placeholder="e.g. LV-10291"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Customer Name
                  </label>
                  <Input
                    placeholder="Rahul Sharma"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Customer Email
                  </label>
                  <Input
                    type="email"
                    placeholder="customer@example.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={creating}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {creating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Generate QR Code"
                  )}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="space-y-4 py-2 text-center">
              <div className="mx-auto flex flex-col items-center justify-center p-4 bg-white border border-slate-200 rounded-2xl shadow-sm w-fit">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={generatedQr.qr_image_data_url}
                  alt="Payment QR"
                  className="h-56 w-56 object-contain"
                />
                <div className="mt-2 text-center">
                  <span className="text-xs text-slate-400 block">{generatedQr.website?.name}</span>
                  <span className="text-xl font-bold font-mono text-slate-900">
                    {formatCurrency(generatedQr.amount, generatedQr.currency)}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono block">
                    Order #{generatedQr.receipt || generatedQr.order_id}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handleDownloadQr(generatedQr.qr_image_data_url, generatedQr.id)
                  }
                  className="gap-1.5 text-xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>

                <CopyButton value={generatedQr.payment_url} label="Copy Payment Link" />

                <Link href={`/pay/qr/${generatedQr.id}`} target="_blank">
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5">
                    Open Live View <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>

              <DialogFooter className="mt-4">
                <Button
                  onClick={() => setCreateModalOpen(false)}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white"
                >
                  Done
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
