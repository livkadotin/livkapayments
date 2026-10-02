"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { CopyButton } from "@/components/shared/copy-button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Link as LinkIcon, Plus, ExternalLink, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function PaymentLinksPage() {
  const [links, setLinks] = useState<any[]>([]);
  const [websites, setWebsites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  // Form State
  const [websiteId, setWebsiteId] = useState("");
  const [amount, setAmount] = useState<number | string>(799);
  const [description, setDescription] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdLink, setCreatedLink] = useState<any>(null);

  const fetchLinks = async () => {
    try {
      const res = await fetch("/api/v1/payment-links");
      const data = await res.json();
      if (data.success) {
        setLinks(data.payment_links);
      }
    } catch (err) {
      console.error("Failed to load payment links:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/v1/payment-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteId,
          amount: Number(amount),
          description: description.trim() || undefined,
          referenceId: referenceId.trim() || undefined,
          customer: {
            name: customerName.trim() || undefined,
            email: customerEmail.trim() || undefined,
          },
          expiresInDays: 7,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create payment link");
      }

      setCreatedLink(data.payment_link);
      toast.success("Payment Link created successfully!");
      fetchLinks();
    } catch (err: any) {
      toast.error(err.message || "Failed to create payment link");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Hosted Payment Links
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Share secure payment URLs with customers across messaging, email, or SMS
          </p>
        </div>

        <Button
          onClick={() => {
            setCreatedLink(null);
            setModalOpen(true);
          }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Create Payment Link
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                <tr>
                  <th className="py-3 px-6">Code</th>
                  <th className="py-3 px-4">Website</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Share Link</th>
                  <th className="py-3 px-6 text-right">Expires</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-xs text-slate-400">
                      Loading payment links...
                    </td>
                  </tr>
                ) : links.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-xs text-slate-400">
                      No payment links found. Create one above!
                    </td>
                  </tr>
                ) : (
                  links.map((pl) => (
                    <tr key={pl.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-6 font-mono text-xs font-semibold text-slate-800">
                        {pl.code}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-900">
                        {pl.website?.name}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 max-w-[200px] truncate">
                        {pl.description || "—"}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(pl.amount, pl.currency)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <StatusBadge status={pl.status} />
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <CopyButton value={pl.url} label="Copy" />
                          <Link href={`/pay/${pl.code}`} target="_blank">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                            </Button>
                          </Link>
                        </div>
                      </td>
                      <td className="py-3.5 px-6 text-right text-xs text-slate-400">
                        {pl.expires_at ? formatDate(pl.expires_at) : "No expiry"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create Link Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <LinkIcon className="h-4 w-4" />
              </div>
              <DialogTitle>
                {createdLink ? "Payment Link Created!" : "Create Hosted Payment Link"}
              </DialogTitle>
            </div>
            <DialogDescription>
              {createdLink
                ? "Share this direct checkout URL with your customer."
                : "Generate a branded checkout page that accepts payments through your central Razorpay account."}
            </DialogDescription>
          </DialogHeader>

          {!createdLink ? (
            <form onSubmit={handleCreate} className="space-y-4 py-2">
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
                  Item / Service Description
                </label>
                <Input
                  placeholder="e.g. Annual Growth Subscription or Order #1029"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
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
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
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
                      Creating...
                    </>
                  ) : (
                    "Create Payment Link"
                  )}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="space-y-4 py-2 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>

              <div className="space-y-1">
                <h4 className="font-semibold text-slate-900">Link Ready to Share</h4>
                <p className="text-xs text-slate-500">
                  Amount: <strong>{formatCurrency(createdLink.amount, createdLink.currency)}</strong>
                </p>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between font-mono text-xs text-slate-700">
                <span className="truncate max-w-[260px]">{createdLink.url}</span>
                <CopyButton value={createdLink.url} />
              </div>

              <div className="pt-2 flex justify-center gap-2">
                <Link href={createdLink.url} target="_blank">
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
                    Open Checkout Page <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>

              <DialogFooter className="mt-4">
                <Button
                  onClick={() => setModalOpen(false)}
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
