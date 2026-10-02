"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CopyButton } from "@/components/shared/copy-button";
import { toast } from "sonner";
import { Globe, Key, AlertTriangle, CheckCircle2, ShieldCheck, Loader2 } from "lucide-react";

interface AddWebsiteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddWebsiteModal({ open, onOpenChange, onSuccess }: AddWebsiteModalProps) {
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [domain, setDomain] = useState("");
  const [allowedDomains, setAllowedDomains] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [loading, setLoading] = useState(false);

  // Credentials revealed after creation
  const [credentials, setCredentials] = useState<{
    website_id: string;
    publishable_key: string;
    secret_key: string;
    webhook_secret: string;
  } | null>(null);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!id || id === name.toLowerCase().replace(/[^a-z0-9]/g, "_") + "_001") {
      const generatedId = val.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 12) + "_001";
      setId(generatedId);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !id || !domain) {
      toast.error("Please fill in website name, ID, and domain.");
      return;
    }

    setLoading(true);
    try {
      const parsedAllowed = allowedDomains
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean);

      const res = await fetch("/api/admin/websites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: id.trim().toLowerCase(),
          name: name.trim(),
          domain: domain.trim(),
          allowedDomains: parsedAllowed,
          description: description.trim() || undefined,
          logoUrl: logoUrl.trim() || undefined,
          status: "ACTIVE",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create website");
      }

      setCredentials(data.credentials);
      toast.success("Website created & credentials generated!");
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to create website");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName("");
    setId("");
    setDomain("");
    setAllowedDomains("");
    setDescription("");
    setLogoUrl("");
    setCredentials(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <Globe className="h-4 w-4" />
            </div>
            <DialogTitle>
              {credentials ? "Website Credentials Generated" : "Connect New Website / App"}
            </DialogTitle>
          </div>
          <DialogDescription>
            {credentials
              ? "Copy and save your secret credentials now. The secret key will never be displayed in plain text again."
              : "Register a website or SaaS platform to route payments through your central Razorpay account."}
          </DialogDescription>
        </DialogHeader>

        {!credentials ? (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Website Name *
                </label>
                <Input
                  placeholder="e.g. Livka"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Website ID *
                </label>
                <Input
                  placeholder="e.g. livka_001"
                  value={id}
                  onChange={(e) => setId(e.target.value.toLowerCase())}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Primary Domain *
              </label>
              <Input
                placeholder="e.g. livka.in"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Allowed CORS Domains (Comma separated)
              </label>
              <Input
                placeholder="e.g. livka.in, www.livka.in, staging.livka.in"
                value={allowedDomains}
                onChange={(e) => setAllowedDomains(e.target.value)}
              />
              <p className="text-[11px] text-slate-400">
                Client-side API requests with publishable keys will be validated against these origins.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Description (Optional)
              </label>
              <Input
                placeholder="e.g. Apparel & Lifestyle e-commerce store"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Logo URL (Optional)
              </label>
              <Input
                placeholder="https://livka.in/logo.png"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
              />
            </div>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Create & Generate Keys"
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex items-start gap-2.5 text-xs text-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Store your Secret Key safely!</strong> We never store secret keys in plaintext. This is the only time it will be shown.
              </span>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <span className="font-sans text-[11px] uppercase font-semibold text-slate-400 block">
                  Website ID
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-slate-900 font-semibold">{credentials.website_id}</span>
                  <CopyButton value={credentials.website_id} />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <span className="font-sans text-[11px] uppercase font-semibold text-slate-400 block">
                  Publishable Key (Frontend Safe)
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-slate-900 font-semibold truncate max-w-[280px]">
                    {credentials.publishable_key}
                  </span>
                  <CopyButton value={credentials.publishable_key} />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-emerald-200 bg-emerald-50/40 space-y-1">
                <span className="font-sans text-[11px] uppercase font-semibold text-emerald-800 block">
                  Secret Key (Backend Only — Keep Private)
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-emerald-950 font-bold truncate max-w-[280px]">
                    {credentials.secret_key}
                  </span>
                  <CopyButton value={credentials.secret_key} />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <span className="font-sans text-[11px] uppercase font-semibold text-slate-400 block">
                  Webhook Secret (For Outgoing Webhook Verification)
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-slate-900 font-semibold truncate max-w-[280px]">
                    {credentials.webhook_secret}
                  </span>
                  <CopyButton value={credentials.webhook_secret} />
                </div>
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button onClick={handleClose} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                I have securely saved these credentials
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
