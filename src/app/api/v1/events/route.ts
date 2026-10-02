import { NextRequest } from "next/server";
import { eventBus } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection packet
      const initMessage = `data: ${JSON.stringify({ type: "connected", timestamp: new Date().toISOString() })}\n\n`;
      controller.enqueue(encoder.encode(initMessage));

      const listener = (eventData: any) => {
        try {
          const message = `data: ${JSON.stringify(eventData)}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch {
          // Client disconnected
        }
      };

      eventBus.on("event", listener);

      // Heartbeat every 25 seconds to keep connection alive through proxies
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 25000);

      cleanup = () => {
        eventBus.off("event", listener);
        clearInterval(heartbeatInterval);
      };
    },
    cancel() {
      if (cleanup) cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
