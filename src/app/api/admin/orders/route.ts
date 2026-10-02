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
  const search = searchParams.get("search");
  const limit = Math.min(Number(searchParams.get("limit") || 50), 100);

  const where: any = {};
  if (websiteId && websiteId !== "ALL") where.websiteId = websiteId;
  if (status && status !== "ALL") where.status = status;

  if (search) {
    where.OR = [
      { id: { contains: search } },
      { receipt: { contains: search } },
      { razorpayOrderId: { contains: search } },
      { customer: { name: { contains: search } } },
      { customer: { email: { contains: search } } },
    ];
  }

  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      include: {
        website: { select: { id: true, name: true, domain: true } },
        customer: true,
        payments: {
          include: { refunds: true },
        },
        qrPayment: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    db.order.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    total,
    orders,
  });
}
