"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { Shield, ShieldCheck, User, Clock, Globe, RefreshCw, Key, Lock } from "lucide-react";

export default function SettingsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/audit-logs");
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
          Settings & Security Audit
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Platform credentials, team permissions, and immutable audit logs
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Administrator Profile Card */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Admin Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white font-bold text-sm">
                A
              </div>
              <div>
                <p className="font-semibold text-slate-900">Livka Administrator</p>
                <p className="text-slate-500 font-mono">admin@livka.in</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Assigned Role:</span>
                <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  OWNER
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Session Type:</span>
                <span className="font-mono text-slate-700">HTTP-Only JWT Cookie</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Permissions:</span>
                <span className="font-semibold text-slate-800">Full Administrative Access</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Platform Domain & Architecture Card */}
        <Card className="shadow-sm lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Infrastructure Architecture</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-slate-600">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="font-semibold text-slate-800 block">Platform Endpoint</span>
                <span className="font-mono text-emerald-700 font-bold block mt-1">
                  https://payments.livka.in
                </span>
                <p className="text-[11px] text-slate-400 mt-1">
                  Dedicated central payment sub-domain
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="font-semibold text-slate-800 block">Main Livka Website</span>
                <span className="font-mono text-slate-700 font-bold block mt-1">
                  https://livka.in
                </span>
                <p className="text-[11px] text-slate-400 mt-1">
                  Separate & completely unaffected
                </p>
              </div>
            </div>

            <div className="rounded-lg bg-emerald-50/70 border border-emerald-200/80 p-3 text-[11px] text-emerald-900 flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
              <span>
                <strong>Multi-Tenant Isolation Active:</strong> All secret API keys are hashed with SHA-256 before storage. Inbound and outbound webhooks are verified via cryptographic HMAC SHA-256 signatures with idempotency tracking.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Audit Logs Feed */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">
              Audit Logs & Security Trail
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Tracks actions such as website creation, key rotation, refunds, and administrator logins
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchLogs} className="text-xs gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-y border-slate-100">
                <tr>
                  <th className="py-3 px-6">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Resource</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Metadata</th>
                  <th className="py-3 px-6 text-right">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400 font-sans">
                      Loading audit logs...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400 font-sans">
                      No audit events logged yet.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-6 text-slate-400">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 font-sans">
                        <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-mono text-[10px]">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-sans">
                        {log.resource}
                      </td>
                      <td className="py-3 px-4 text-slate-800 font-sans">
                        {log.user?.name || "System"}
                      </td>
                      <td className="py-3 px-4 text-slate-500 max-w-[260px] truncate">
                        {log.details ? JSON.stringify(log.details) : "—"}
                      </td>
                      <td className="py-3 px-6 text-right text-slate-400">
                        {log.ipAddress || "127.0.0.1"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
