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
  const status = searchParams.get("status");
  const method = searchParams.get("method");
  const search = searchParams.get("search");
  const limit = Math.min(Number(searchParams.get("limit") || 50), 100);

  const where: any = {};
  if (websiteId && websiteId !== "ALL") where.websiteId = websiteId;
  if (status && status !== "ALL") where.status = status;
  if (method && method !== "ALL") where.method = method;

  if (search) {
    where.OR = [
      { id: { contains: search } },
      { razorpayPaymentId: { contains: search } },
      { order: { receipt: { contains: search } } },
      { customer: { name: { contains: search } } },
      { customer: { email: { contains: search } } },
    ];
  }

  const [payments, total] = await Promise.all([
    db.payment.findMany({
      where,
      include: {
        website: { select: { id: true, name: true, domain: true } },
        order: { select: { id: true, receipt: true, status: true } },
        customer: { select: { id: true, name: true, email: true, phone: true } },
        refunds: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    db.payment.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    total,
    payments,
  });
}
