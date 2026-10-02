import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const websiteId = searchParams.get("websiteId");

  const where: any = {};
  if (websiteId && websiteId !== "ALL") {
    where.endpoint = { websiteId };
  }

  const deliveries = await db.webhookDelivery.findMany({
    where,
    take: 50,
    orderBy: { createdAt: "desc" },
    include: {
      endpoint: {
        include: {
          website: { select: { id: true, name: true } },
        },
      },
    },
  });

  return NextResponse.json({
    success: true,
    deliveries: deliveries.map((d) => ({
      id: d.id,
      endpointId: d.endpointId,
      url: d.endpoint.url,
      website: d.endpoint.website,
      event: d.event,
      payload: d.payload ? JSON.parse(d.payload) : null,
      responseStatus: d.responseStatus,
      responseBody: d.responseBody,
      durationMs: d.durationMs,
      success: d.success,
      attempts: d.attempts,
      createdAt: d.createdAt,
    })),
  });
}
