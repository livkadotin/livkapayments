import { db } from "./db";
import { signWebhookPayload } from "./crypto";

export interface OutgoingWebhookPayload {
  event: string;
  website_id: string;
  order_id: string;
  payment_id?: string;
  refund_id?: string;
  amount: number;
  currency: string;
  timestamp: string;
  data?: Record<string, any>;
}

export async function dispatchWebsiteWebhooks(
  websiteId: string,
  event: string,
  payloadData: Omit<OutgoingWebhookPayload, "event" | "website_id" | "timestamp">
) {
  try {
    const website = await db.website.findUnique({
      where: { id: websiteId },
      include: {
        apiKeys: {
          where: { status: "ACTIVE" },
          take: 1,
        },
        webhookEndpoints: {
          where: { status: "ACTIVE" },
        },
      },
    });

    if (!website || website.webhookEndpoints.length === 0) {
      return;
    }

    const webhookSecret = website.apiKeys[0]?.webhookSecret || "whsec_default_secret";

    const fullPayload: OutgoingWebhookPayload = {
      event,
      website_id: websiteId,
      timestamp: new Date().toISOString(),
      ...payloadData,
    };

    const payloadString = JSON.stringify(fullPayload);

    for (const endpoint of website.webhookEndpoints) {
      // Check if endpoint is subscribed to this event
      let subscribedEvents: string[] = [];
      try {
        subscribedEvents = JSON.parse(endpoint.events);
      } catch {
        subscribedEvents = ["payment.captured", "order.paid", "refund.processed"];
      }

      if (subscribedEvents.length > 0 && !subscribedEvents.includes(event) && !subscribedEvents.includes("*")) {
        continue;
      }

      const secretToUse = endpoint.secret || webhookSecret;
      const signature = signWebhookPayload(payloadString, secretToUse);

      // Execute delivery asynchronously
      deliverWebhook(endpoint.id, endpoint.url, payloadString, signature, event);
    }
  } catch (err) {
    console.error("Error preparing outbound website webhooks:", err);
  }
}

async function deliverWebhook(
  endpointId: string,
  url: string,
  payloadString: string,
  signature: string,
  event: string,
  attempt: number = 1
) {
  const startTime = Date.now();
  let responseStatus: number | null = null;
  let responseBody: string | null = null;
  let success = false;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-livka-signature": signature,
        "x-livka-event": event,
        "x-livka-delivery": `del_${Date.now()}_${attempt}`,
        "x-replyflow-signature": signature,
        "x-replyflow-event": event,
        "x-replyflow-delivery": `del_${Date.now()}_${attempt}`,
        "User-Agent": "LivkaPay-Webhooks/1.0",
      },
      body: payloadString,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    responseStatus = res.status;
    const bodyText = await res.text();
    responseBody = bodyText.slice(0, 1000); // store first 1000 chars
    success = res.ok;
  } catch (err: any) {
    responseStatus = 500;
    responseBody = `Network error: ${err.message}`;
    success = false;
  }

  const durationMs = Date.now() - startTime;

  try {
    await db.webhookDelivery.create({
      data: {
        endpointId,
        event,
        payload: payloadString,
        responseStatus,
        responseBody,
        durationMs,
        success,
        attempts: attempt,
      },
    });
  } catch (dbErr) {
    console.error("Failed to log webhook delivery:", dbErr);
  }

  // If failed and attempt < 3, retry with backoff
  if (!success && attempt < 3) {
    const delay = attempt === 1 ? 5000 : 15000;
    setTimeout(() => {
      deliverWebhook(endpointId, url, payloadString, signature, event, attempt + 1);
    }, delay);
  }
}
