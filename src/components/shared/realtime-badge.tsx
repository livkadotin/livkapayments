"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Radio } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface RealtimeBadgeProps {
  onEvent?: (event: any) => void;
}

export function RealtimeBadge({ onEvent }: RealtimeBadgeProps) {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource("/api/v1/events");

      eventSource.onopen = () => {
        setIsConnected(true);
      };

      eventSource.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.type === "payment.captured") {
            const data = payload.data;
            toast.success(`Payment Received: ${formatCurrency(data.amount)}`, {
              description: `Website: ${data.websiteName} • Order #${data.orderId}`,
              duration: 5000,
            });
            if (onEvent) onEvent(payload);
          } else if (payload.type === "refund.processed") {
            const data = payload.data;
            toast.info(`Refund Processed: ${formatCurrency(data.amount)}`, {
              description: `Website: ${data.websiteName}`,
              duration: 5000,
            });
            if (onEvent) onEvent(payload);
          }
        } catch {
          // Ignore parse errors (e.g. heartbeat)
        }
      };

      eventSource.onerror = () => {
        setIsConnected(false);
      };
    } catch {
      setIsConnected(false);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [onEvent]);

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm backdrop-blur-sm"
      title={isConnected ? "Connected to real-time events" : "Reconnecting to real-time feed..."}
    >
      <span className="relative flex h-2 w-2">
        {isConnected && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${
            isConnected ? "bg-emerald-500" : "bg-amber-500"
          }`}
        />
      </span>
      <span className="hidden sm:inline">
        {isConnected ? "Live Network Active" : "Connecting..."}
      </span>
    </div>
  );
}
