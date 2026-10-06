import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { signWebhookPayload } from "@/lib/crypto";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(session.role, "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { deliveryId } = await req.json();
    if (!deliveryId) {
      return NextResponse.json({ error: "Missing deliveryId" }, { status: 400 });
    }

    const delivery = await db.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: {
        endpoint: {
          include: {
            website: {
              include: {
                apiKeys: { where: { status: "ACTIVE" }, take: 1 },
              },
            },
          },
        },
      },
    });

    if (!delivery) {
      return NextResponse.json({ error: "Delivery log not found" }, { status: 404 });
    }

    const secret =
      delivery.endpoint.secret ||
      delivery.endpoint.website.apiKeys[0]?.webhookSecret ||
      "whsec_default";

    const signature = signWebhookPayload(delivery.payload, secret);
    const stableDeliveryId = `del_${crypto.createHash("sha256").update(`${delivery.endpointId}:${delivery.payload}`).digest("hex").slice(0, 32)}`;

    const startTime = Date.now();
    let responseStatus = 500;
    let responseBody = "";
    let success = false;

    try {
      const res = await fetch(delivery.endpoint.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-livka-signature": signature,
          "x-livka-event": delivery.event,
          "x-livka-delivery": stableDeliveryId,
          "x-replyflow-signature": signature,
          "x-replyflow-event": delivery.event,
          "x-replyflow-delivery": stableDeliveryId,
          "User-Agent": "LivkaPay-Webhooks/1.0",
        },
        body: delivery.payload,
      });
      responseStatus = res.status;
      responseBody = (await res.text()).slice(0, 1000);
      success = res.ok;
    } catch (err: any) {
      responseBody = err.message;
    }

    const durationMs = Date.now() - startTime;

    // Log the new retry attempt
    const newDelivery = await db.webhookDelivery.create({
      data: {
        endpointId: delivery.endpointId,
        event: delivery.event,
        payload: delivery.payload,
        responseStatus,
        responseBody,
        durationMs,
        success,
        attempts: delivery.attempts + 1,
      },
    });

    return NextResponse.json({
      success: true,
      message: success ? "Webhook delivered successfully" : "Webhook delivery failed again",
      delivery: newDelivery,
    });
  } catch (err: any) {
    console.error("Webhook retry error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
