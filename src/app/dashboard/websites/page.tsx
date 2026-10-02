"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AddWebsiteModal } from "@/components/websites/add-website-modal";
import { KeyRotationModal } from "@/components/websites/key-rotation-modal";
import { CopyButton } from "@/components/shared/copy-button";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Globe,
  Plus,
  Search,
  KeyRound,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  TrendingUp,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";

export default function WebsitesPage() {
  const [websites, setWebsites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [rotationTarget, setRotationTarget] = useState<any>(null);

  const fetchWebsites = async () => {
    try {
      const res = await fetch("/api/admin/websites");
      const data = await res.json();
      if (data.success) {
        setWebsites(data.websites);
      }
    } catch (err) {
      console.error("Failed to load websites:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWebsites();
  }, []);

  const filtered = websites.filter(
    (w) =>
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      w.id.toLowerCase().includes(search.toLowerCase()) ||
      w.domain.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Connected Websites & Apps
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage multi-tenant applications sharing your central Razorpay account
          </p>
        </div>

        <Button
          onClick={() => setAddModalOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Add Website
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Filter websites by name, ID, or domain..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-white"
        />
      </div>

      {/* Websites Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-64 rounded-xl bg-slate-200/70 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-12 text-center">
          <Globe className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">No websites found</h3>
          <p className="text-xs text-slate-500 mt-1">
            {search ? "No websites match your search query." : "Connect your first website to begin routing payments."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((w) => {
            const activeKey = w.apiKeys?.[0];
            return (
              <Card
                key={w.id}
                className="group relative flex flex-col justify-between overflow-hidden transition-all hover:shadow-md border-slate-200/90"
              >
                <div>
                  {/* Card Header */}
                  <div className="p-5 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-50 to-teal-50 border border-emerald-100 text-emerald-700 font-bold text-base">
                          {w.name.charAt(0)}
                        </div>
                        <div>
                          <Link
                            href={`/dashboard/websites/${w.id}`}
                            className="font-semibold text-slate-900 hover:text-emerald-700 transition-colors flex items-center gap-1 group-hover:underline"
                          >
                            <span>{w.name}</span>
                          </Link>
                          <a
                            href={`https://${w.domain}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-0.5 mt-0.5"
                          >
                            <span>{w.domain}</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        </div>
                      </div>

                      <StatusBadge status={w.status} />
                    </div>

                    {w.description && (
                      <p className="text-xs text-slate-500 mt-3 line-clamp-2 leading-relaxed">
                        {w.description}
                      </p>
                    )}
                  </div>

                  {/* Metrics Row */}
                  <div className="grid grid-cols-2 border-y border-slate-100 bg-slate-50/50 px-5 py-3 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
                        Captured Revenue
                      </span>
                      <span className="font-bold text-slate-900 font-mono text-sm">
                        {formatCurrency(w.totalRevenue || 0)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
                        Payments
                      </span>
                      <span className="font-bold text-slate-900 font-mono text-sm">
                        {w._count?.payments || 0}
                      </span>
                    </div>
                  </div>

                  {/* Credentials Preview */}
                  <div className="p-5 pt-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="font-mono text-[11px] text-slate-400">Website ID:</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono font-semibold text-slate-800">{w.id}</span>
                        <CopyButton value={w.id} size="icon" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-slate-500">
                      <span className="font-mono text-[11px] text-slate-400">Publishable Key:</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-slate-700 truncate max-w-[150px]">
                          {activeKey?.publishableKey || "—"}
                        </span>
                        {activeKey && <CopyButton value={activeKey.publishableKey} size="icon" />}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="flex items-center justify-between border-t border-slate-100 bg-white p-3 px-5">
                  <button
                    onClick={() => setRotationTarget(w)}
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-amber-700 transition-colors"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>Rotate Keys</span>
                  </button>

                  <Link
                    href={`/dashboard/websites/${w.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
                  >
                    <span>Manage Website</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Website Modal */}
      <AddWebsiteModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onSuccess={fetchWebsites}
      />

      {/* Key Rotation Modal */}
      {rotationTarget && (
        <KeyRotationModal
          websiteId={rotationTarget.id}
          websiteName={rotationTarget.name}
          open={!!rotationTarget}
          onOpenChange={(open) => !open && setRotationTarget(null)}
          onSuccess={fetchWebsites}
        />
      )}
    </div>
  );
}
