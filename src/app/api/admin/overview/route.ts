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
  const period = searchParams.get("period") || "30"; // 7, 30, 90, 365
  const days = parseInt(period, 10) || 30;

  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // 1. Total Captured Revenue
  const totalRevenueAgg = await db.payment.aggregate({
    where: { status: "CAPTURED" },
    _sum: { amount: true },
  });
  const totalRevenue = totalRevenueAgg._sum.amount || 0;

  // 2. Today's Revenue
  const todayRevenueAgg = await db.payment.aggregate({
    where: {
      status: "CAPTURED",
      capturedAt: { gte: todayStart },
    },
    _sum: { amount: true },
  });
  const todayRevenue = todayRevenueAgg._sum.amount || 0;

  // 3. Successful Payments Count
  const successfulPaymentsCount = await db.payment.count({
    where: { status: "CAPTURED" },
  });

  // 4. Failed Payments Count
  const failedPaymentsCount = await db.payment.count({
    where: { status: "FAILED" },
  });

  // 5. Total Refunds Amount & Count
  const totalRefundsAgg = await db.refund.aggregate({
    where: { status: "PROCESSED" },
    _sum: { amount: true },
    _count: true,
  });
  const totalRefunds = totalRefundsAgg._sum.amount || 0;
  const refundsCount = totalRefundsAgg._count || 0;

  // 6. Active Websites Count
  const activeWebsitesCount = await db.website.count({
    where: { status: "ACTIVE" },
  });
  const totalWebsitesCount = await db.website.count();

  // 7. Recent Transactions (last 10)
  const recentPayments = await db.payment.findMany({
    take: 10,
    orderBy: { createdAt: "desc" },
    include: {
      website: { select: { id: true, name: true, domain: true } },
      order: { select: { id: true, receipt: true } },
      customer: { select: { name: true, email: true } },
    },
  });

  // 8. Revenue Chart Over Selected Period (group by date)
  const periodPayments = await db.payment.findMany({
    where: {
      status: "CAPTURED",
      capturedAt: { gte: startDate },
    },
    select: {
      amount: true,
      capturedAt: true,
    },
    orderBy: { capturedAt: "asc" },
  });

  // Aggregate into daily buckets
  const dailyMap: Record<string, { date: string; revenue: number; count: number }> = {};
  for (let i = 0; i <= Math.min(days, 90); i++) {
    const d = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    if (d > now) break;
    const key = d.toISOString().slice(0, 10);
    dailyMap[key] = {
      date: new Intl.DateTimeFormat("en-IN", { month: "short", day: "numeric" }).format(d),
      revenue: 0,
      count: 0,
    };
  }

  for (const p of periodPayments) {
    if (p.capturedAt) {
      const key = p.capturedAt.toISOString().slice(0, 10);
      if (dailyMap[key]) {
        dailyMap[key].revenue += p.amount;
        dailyMap[key].count += 1;
      }
    }
  }

  const chartData = Object.values(dailyMap);

  return NextResponse.json({
    success: true,
    stats: {
      totalRevenue,
      todayRevenue,
      successfulPayments: successfulPaymentsCount,
      failedPayments: failedPaymentsCount,
      totalRefunds,
      refundsCount,
      activeWebsites: activeWebsitesCount,
      totalWebsites: totalWebsitesCount,
    },
    chartData,
    recentPayments: recentPayments.map((p) => ({
      id: p.id,
      website: p.website,
      order: p.order,
      customer: p.customer,
      amount: p.amount,
      currency: p.currency,
      method: p.method || "card",
      status: p.status,
      created_at: p.createdAt,
      captured_at: p.capturedAt,
    })),
  });
}
