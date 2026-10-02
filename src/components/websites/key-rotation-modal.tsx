"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/shared/copy-button";
import { toast } from "sonner";
import { KeyRound, AlertTriangle, Loader2 } from "lucide-react";

interface KeyRotationModalProps {
  websiteId: string;
  websiteName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function KeyRotationModal({
  websiteId,
  websiteName,
  open,
  onOpenChange,
  onSuccess,
}: KeyRotationModalProps) {
  const [loading, setLoading] = useState(false);
  const [newCredentials, setNewCredentials] = useState<{
    publishable_key: string;
    secret_key: string;
    webhook_secret: string;
  } | null>(null);

  const handleRotate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/websites/${websiteId}/rotate-keys`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to rotate keys");
      }
      setNewCredentials(data.credentials);
      toast.success("API keys rotated successfully!");
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to rotate keys");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setNewCredentials(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <KeyRound className="h-4 w-4" />
            </div>
            <DialogTitle>Rotate API Keys — {websiteName}</DialogTitle>
          </div>
          <DialogDescription>
            {newCredentials
              ? "New credentials have been generated. Immediately update your server environment variables."
              : "Rotating API keys will immediately revoke existing keys. Any server using the previous secret key will receive 401 Unauthorized errors until updated."}
          </DialogDescription>
        </DialogHeader>

        {!newCredentials ? (
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 flex items-start gap-2.5 text-xs text-rose-800">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <span>
                <strong>Warning:</strong> Existing live integrations for <strong>{websiteName}</strong> will temporarily fail until you update the application with the new secret key.
              </span>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleRotate}
                disabled={loading}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Rotating...
                  </>
                ) : (
                  "Yes, Rotate Keys"
                )}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3 py-2 font-mono text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
              <span className="font-sans text-[11px] uppercase font-semibold text-slate-400 block">
                New Publishable Key
              </span>
              <div className="flex items-center justify-between">
                <span className="text-slate-900 font-semibold truncate max-w-[260px]">
                  {newCredentials.publishable_key}
                </span>
                <CopyButton value={newCredentials.publishable_key} />
              </div>
            </div>

            <div className="p-3 bg-emerald-50/50 rounded-lg border border-emerald-200 space-y-1">
              <span className="font-sans text-[11px] uppercase font-semibold text-emerald-800 block">
                New Secret Key (Copy Now)
              </span>
              <div className="flex items-center justify-between">
                <span className="text-emerald-950 font-bold truncate max-w-[260px]">
                  {newCredentials.secret_key}
                </span>
                <CopyButton value={newCredentials.secret_key} />
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
              <span className="font-sans text-[11px] uppercase font-semibold text-slate-400 block">
                New Webhook Secret
              </span>
              <div className="flex items-center justify-between">
                <span className="text-slate-900 font-semibold truncate max-w-[260px]">
                  {newCredentials.webhook_secret}
                </span>
                <CopyButton value={newCredentials.webhook_secret} />
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button onClick={handleClose} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                Done & Saved
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
