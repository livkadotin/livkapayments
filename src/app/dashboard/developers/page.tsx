"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/shared/copy-button";
import { StatusBadge } from "@/components/shared/status-badge";
import { KeyRotationModal } from "@/components/websites/key-rotation-modal";
import { formatDate } from "@/lib/utils";
import {
  Code2,
  Key,
  Webhook,
  BookOpen,
  Terminal,
  RotateCcw,
  Check,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

export default function DevelopersPage() {
  const [websites, setWebsites] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loadingWebhooks, setLoadingWebhooks] = useState(false);
  const [rotationTarget, setRotationTarget] = useState<any>(null);

  const fetchWebsites = async () => {
    try {
      const res = await fetch("/api/admin/websites");
      const data = await res.json();
      if (data.success) {
        setWebsites(data.websites);
      }
    } catch {}
  };

  const fetchDeliveries = async () => {
    setLoadingWebhooks(true);
    try {
      const res = await fetch("/api/admin/webhooks/deliveries");
      const data = await res.json();
      if (data.success) {
        setDeliveries(data.deliveries);
      }
    } catch {} finally {
      setLoadingWebhooks(false);
    }
  };

  useEffect(() => {
    fetchWebsites();
    fetchDeliveries();
  }, []);

  const handleRetryWebhook = async (deliveryId: string) => {
    try {
      const res = await fetch("/api/admin/webhooks/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchDeliveries();
      } else {
        toast.error(data.error || "Retry failed");
      }
    } catch {
      toast.error("Retry failed");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
          Developers & Integration Hub
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          API credentials, webhook configuration, delivery logs, and interactive documentation
        </p>
      </div>

      <Tabs defaultValue="docs" className="space-y-4">
        <TabsList className="bg-slate-100 p-1">
          <TabsTrigger value="docs" className="gap-1.5 text-xs sm:text-sm">
            <BookOpen className="h-4 w-4" />
            API Documentation
          </TabsTrigger>
          <TabsTrigger value="keys" className="gap-1.5 text-xs sm:text-sm">
            <Key className="h-4 w-4" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-1.5 text-xs sm:text-sm">
            <Webhook className="h-4 w-4" />
            Webhooks & Logs
          </TabsTrigger>
          <TabsTrigger value="sdk" className="gap-1.5 text-xs sm:text-sm">
            <Terminal className="h-4 w-4" />
            JavaScript SDK
          </TabsTrigger>
        </TabsList>

        {/* 1. API DOCUMENTATION TAB */}
        <TabsContent value="docs" className="space-y-6">
          {/* Architecture Card */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Architecture & Authentication</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs leading-relaxed text-slate-600">
              <p>
                Livka Pay acts as the centralized payment gateway for all your applications.
                Authenticate your backend requests by supplying your website&apos;s <strong>Secret Key</strong> in the{" "}
                <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-900">Authorization: Bearer sk_live_...</code>{" "}
                header or <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-900">x-api-key</code> header.
              </p>

              <div className="rounded-lg bg-slate-900 text-slate-100 p-4 font-mono text-xs overflow-x-auto relative">
                <CopyButton
                  value={`curl https://payments.livka.in/api/v1/orders \\
  -H "Authorization: Bearer sk_live_livka_44a193fd662c1109a" \\
  -H "Content-Type: application/json" \\
  -d '{"amount": 799, "currency": "INR", "receipt": "LV-10291"}'`}
                  className="absolute right-3 top-3 text-slate-300 border-slate-700 bg-slate-800"
                />
                <pre>{`# Example cURL Request
curl https://payments.livka.in/api/v1/orders \\
  -H "Authorization: Bearer sk_live_livka_44a193fd662c1109a" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 799,
    "currency": "INR",
    "receipt": "LV-10291",
    "customer": {
      "name": "Rahul Sharma",
      "email": "rahul@example.com",
      "phone": "+919876543210"
    }
  }'`}</pre>
              </div>
            </CardContent>
          </Card>

          {/* Create Order API */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded font-mono text-xs">
                  POST
                </span>
                <span className="font-mono text-sm font-semibold text-slate-900">/api/v1/orders</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-slate-600">
              <p>Creates an internal order linked to your website and creates the corresponding order on Razorpay.</p>

              <div className="space-y-2">
                <span className="font-semibold text-slate-800 block">Response (201 Created):</span>
                <div className="rounded-lg bg-slate-900 text-slate-100 p-4 font-mono text-xs overflow-x-auto">
                  <pre>{`{
  "success": true,
  "order": {
    "id": "ord_10291_a1b2",
    "website_id": "livka_001",
    "amount": 799,
    "currency": "INR",
    "receipt": "LV-10291",
    "status": "CREATED"
  },
  "razorpay_order_id": "order_NX812903abc",
  "razorpay_key_id": "rzp_live_central_account",
  "checkout_url": "https://payments.livka.in/pay/order/ord_10291_a1b2"
}`}</pre>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Webhook Verification */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Verifying Outgoing Website Webhooks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-slate-600">
              <p>
                When a payment is captured on Razorpay, Livka Pay verifies the Razorpay signature, updates the order to PAID, and immediately POSTs a signed webhook to your website&apos;s configured endpoint.
              </p>

              <div className="rounded-lg bg-slate-900 text-slate-100 p-4 font-mono text-xs overflow-x-auto relative">
                <CopyButton
                  value={`// Node.js Webhook Verification
import crypto from "crypto";

export async function handleWebhook(req) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-replyflow-signature");
  const webhookSecret = process.env.REPLYFLOW_WEBHOOK_SECRET;

  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    const payload = JSON.parse(rawBody);
    console.log("Payment confirmed server-side:", payload.order_id);
  }
}`}
                  className="absolute right-3 top-3 text-slate-300 border-slate-700 bg-slate-800"
                />
                <pre>{`// Node.js / Next.js Webhook Signature Verification Handler
import crypto from "crypto";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-replyflow-signature");
  const webhookSecret = process.env.REPLYFLOW_WEBHOOK_SECRET;

  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature || ""))) {
    return new Response("Invalid signature", { status: 400 });
  }

  const event = JSON.parse(rawBody);
  if (event.event === "payment.captured") {
    // Fulfill customer order in your database!
    console.log("Order paid:", event.order_id, "Amount:", event.amount);
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}`}</pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2. API KEYS TAB */}
        <TabsContent value="keys" className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Active Website Credentials</CardTitle>
              <p className="text-xs text-slate-500">
                Each connected website has its own isolated API key and webhook secret.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {websites.map((w) => {
                const activeKey = w.apiKeys?.[0];
                return (
                  <div
                    key={w.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{w.name}</span>
                        <span className="font-mono text-slate-400">({w.id})</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRotationTarget(w)}
                        className="text-rose-700 border-rose-200 hover:bg-rose-50 text-xs h-7"
                      >
                        Rotate Keys
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <span className="font-sans text-[10px] text-slate-400 uppercase font-semibold block">
                          Publishable Key
                        </span>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-slate-800 truncate max-w-[200px]">
                            {activeKey?.publishableKey}
                          </span>
                          <CopyButton value={activeKey?.publishableKey} size="icon" />
                        </div>
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <span className="font-sans text-[10px] text-slate-400 uppercase font-semibold block">
                          Secret Key Prefix
                        </span>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-slate-500">{activeKey?.secretKeyPrefix}••••••••</span>
                          <span className="text-[10px] text-slate-400 font-sans">Hashed in DB</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. WEBHOOKS TAB */}
        <TabsContent value="webhooks" className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-semibold">Outgoing Webhook Delivery Logs</CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Real-time audit log of signed webhooks dispatched to tenant endpoints
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchDeliveries}
                className="text-xs text-slate-600 gap-1.5"
              >
                <RefreshCw className={`h-3 w-3 ${loadingWebhooks ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-y border-slate-100">
                    <tr>
                      <th className="py-3 px-6">Event</th>
                      <th className="py-3 px-4">Website</th>
                      <th className="py-3 px-4">Endpoint URL</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-center">Latency</th>
                      <th className="py-3 px-4 text-center">Attempts</th>
                      <th className="py-3 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {deliveries.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400 font-sans">
                          No webhook deliveries recorded yet.
                        </td>
                      </tr>
                    ) : (
                      deliveries.map((d) => (
                        <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-6 font-bold text-slate-800 font-sans">
                            {d.event}
                          </td>
                          <td className="py-3 px-4 font-sans font-medium text-slate-900">
                            {d.website?.name}
                          </td>
                          <td className="py-3 px-4 text-slate-500 max-w-[220px] truncate">
                            {d.url}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                                d.success
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {d.responseStatus || "ERR"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center text-slate-500">
                            {d.durationMs ? `${d.durationMs}ms` : "—"}
                          </td>
                          <td className="py-3 px-4 text-center text-slate-700">
                            {d.attempts}
                          </td>
                          <td className="py-3 px-6 text-right font-sans">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRetryWebhook(d.id)}
                              className="h-7 text-[11px] gap-1"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Retry
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. JAVASCRIPT SDK TAB */}
        <TabsContent value="sdk" className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Livka Pay JavaScript SDK</CardTitle>
              <p className="text-xs text-slate-500">
                Embeddable client checkout helper to launch Razorpay checkout seamlessly on any website.
              </p>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-slate-600">
              <div className="space-y-2">
                <span className="font-semibold text-slate-800 block">1. Include the SDK script in HTML / React:</span>
                <div className="rounded-lg bg-slate-900 text-slate-100 p-3 font-mono">
                  <pre>{`<script src="https://payments.livka.in/sdk/livka-pay.js"></script>`}</pre>
                </div>
              </div>

              <div className="space-y-2">
                <span className="font-semibold text-slate-800 block">2. Trigger Checkout from button click:</span>
                <div className="rounded-lg bg-slate-900 text-slate-100 p-4 font-mono overflow-x-auto relative">
                  <CopyButton
                    value={`LivkaPay.pay({
  publishableKey: "pk_live_livka_55b8921e",
  amount: 799,
  receipt: "LV-10291",
  customer: {
    name: "Rahul Sharma",
    email: "rahul@example.com"
  },
  onSuccess: (payment) => {
    console.log("Payment verified server-side!", payment);
    window.location.href = "/order-confirmed";
  },
  onDismiss: () => {
    console.log("Checkout closed by user");
  }
});`}
                    className="absolute right-3 top-3 text-slate-300 border-slate-700 bg-slate-800"
                  />
                  <pre>{`// Simple 1-function checkout invocation
LivkaPay.pay({
  publishableKey: "pk_live_livka_55b8921e",
  amount: 799,
  receipt: "LV-10291",
  customer: {
    name: "Rahul Sharma",
    email: "rahul@example.com",
    phone: "+919876543210"
  },
  onSuccess: (payment) => {
    console.log("Payment confirmed!", payment);
    window.location.href = "/order/success?order_id=" + payment.order_id;
  },
  onError: (err) => {
    alert("Payment error: " + err.message);
  }
});`}</pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Rotation Modal */}
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
