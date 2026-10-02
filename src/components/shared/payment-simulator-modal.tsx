"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Zap, CheckCircle2, Loader2, ArrowRight } from "lucide-react";

interface PaymentSimulatorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  defaultOrderId?: string;
  defaultAmount?: number;
}

export function PaymentSimulatorModal({
  open,
  onOpenChange,
  onSuccess,
  defaultOrderId = "",
  defaultAmount = 799,
}: PaymentSimulatorModalProps) {
  const [orderId, setOrderId] = useState(defaultOrderId);
  const [amount, setAmount] = useState(defaultAmount);
  const [websiteId, setWebsiteId] = useState("livka_001");
  const [method, setMethod] = useState("upi");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "success">("form");
  const [result, setResult] = useState<any>(null);

  const handleSimulate = async () => {
    setLoading(true);
    try {
      let targetOrderId = orderId.trim();

      // If no order ID given, create a fast order first
      if (!targetOrderId) {
        const orderRes = await fetch("/api/v1/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer sk_live_livka_44a193fd662c1109a",
          },
          body: JSON.stringify({
            amount: Number(amount) || 799,
            currency: "INR",
            receipt: `LV-SIM-${Date.now().toString().slice(-4)}`,
            customer: {
              name: "Demo Customer",
              email: "customer@livka.in",
              phone: "+919876543210",
            },
          }),
        });
        const orderJson = await orderRes.json();
        if (!orderJson.success) {
          throw new Error(orderJson.error || "Failed to create demo order");
        }
        targetOrderId = orderJson.order.id;
      }

      // Now trigger simulated payment capture
      const simRes = await fetch("/api/v1/simulate/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: targetOrderId,
          method,
        }),
      });

      const simJson = await simRes.json();
      if (!simJson.success) {
        throw new Error(simJson.error || "Simulation failed");
      }

      setResult(simJson);
      setStep("success");
      toast.success("Payment simulation processed successfully!");
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to simulate payment");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep("form");
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <Zap className="h-4 w-4" />
            </div>
            <DialogTitle>Razorpay Payment Simulator</DialogTitle>
          </div>
          <DialogDescription>
            Test the complete end-to-end lifecycle: order creation, Razorpay capture, signature verification, DB updates, and tenant webhooks.
          </DialogDescription>
        </DialogHeader>

        {step === "form" ? (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Target Website
              </label>
              <select
                value={websiteId}
                onChange={(e) => setWebsiteId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="livka_001">Livka (livka.in)</option>
                <option value="replyflow_001">ReplyFlow (replyflow.co.in)</option>
                <option value="demo_store_001">Demo Store (demostore.com)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Order ID (Leave blank to generate automatically)
              </label>
              <Input
                placeholder="e.g. ord_10291 (or leave blank)"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Amount (₹ INR)
              </label>
              <Input
                type="number"
                placeholder="799"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Payment Method
              </label>
              <div className="grid grid-cols-3 gap-2">
                {["upi", "card", "netbanking"].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium uppercase transition-colors ${
                      method === m
                        ? "border-emerald-600 bg-emerald-50 text-emerald-700 font-semibold"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSimulate}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Simulating...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    Simulate Payment Capture
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div>
              <h4 className="text-base font-semibold text-slate-900">Payment Capture Simulated!</h4>
              <p className="text-xs text-slate-500 mt-1">
                The internal order was updated to PAID, payment status captured, and outbound tenant webhook was dispatched.
              </p>
            </div>

            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-left font-mono text-xs text-slate-700 space-y-1">
              <div><strong>Order ID:</strong> {result?.order?.id}</div>
              <div><strong>Payment ID:</strong> {result?.payment?.razorpay_payment_id}</div>
              <div><strong>Amount:</strong> ₹{result?.order?.amount}</div>
              <div><strong>Status:</strong> <span className="text-emerald-600 font-semibold">PAID ✓</span></div>
            </div>

            <Button onClick={handleReset} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
