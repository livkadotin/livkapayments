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
  const period = searchParams.get("period") || "30";
  const days = parseInt(period, 10) || 30;

  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const baseWhere: any = {
    createdAt: { gte: startDate },
  };
  if (websiteId && websiteId !== "ALL") {
    baseWhere.websiteId = websiteId;
  }

  // 1. Captured payments
  const capturedPayments = await db.payment.findMany({
    where: { ...baseWhere, status: "CAPTURED" },
    select: { amount: true, method: true, websiteId: true, capturedAt: true },
  });

  const totalRevenue = capturedPayments.reduce((acc, p) => acc + p.amount, 0);
  const paymentCount = capturedPayments.length;
  const averageOrderValue = paymentCount > 0 ? Math.round(totalRevenue / paymentCount) : 0;

  // 2. Failed payments
  const failedCount = await db.payment.count({
    where: { ...baseWhere, status: "FAILED" },
  });

  const totalAttempts = paymentCount + failedCount;
  const successRate = totalAttempts > 0 ? Math.round((paymentCount / totalAttempts) * 100) : 100;

  // 3. Refunds
  const refundWhere: any = { createdAt: { gte: startDate }, status: "PROCESSED" };
  if (websiteId && websiteId !== "ALL") refundWhere.websiteId = websiteId;

  const refundsAgg = await db.refund.aggregate({
    where: refundWhere,
    _sum: { amount: true },
    _count: true,
  });
  const totalRefundAmount = refundsAgg._sum.amount || 0;
  const refundCount = refundsAgg._count || 0;

  // 4. Payment Method Distribution
  const methodCounts: Record<string, number> = {
    upi: 0,
    card: 0,
    netbanking: 0,
    wallet: 0,
  };
  for (const p of capturedPayments) {
    const m = (p.method || "card").toLowerCase();
    methodCounts[m] = (methodCounts[m] || 0) + 1;
  }
  const paymentMethods = Object.entries(methodCounts).map(([method, count]) => ({
    name: method.toUpperCase(),
    value: count,
  }));

  // 5. Website Revenue Distribution
  const websites = await db.website.findMany({ select: { id: true, name: true } });
  const websiteRevenueMap: Record<string, { name: string; revenue: number; orders: number }> = {};

  for (const w of websites) {
    websiteRevenueMap[w.id] = { name: w.name, revenue: 0, orders: 0 };
  }

  for (const p of capturedPayments) {
    if (websiteRevenueMap[p.websiteId]) {
      websiteRevenueMap[p.websiteId].revenue += p.amount;
      websiteRevenueMap[p.websiteId].orders += 1;
    }
  }

  const websiteDistribution = Object.values(websiteRevenueMap);

  return NextResponse.json({
    success: true,
    metrics: {
      totalRevenue,
      paymentCount,
      averageOrderValue,
      successRate,
      failedPayments: failedCount,
      totalRefunds: totalRefundAmount,
      refundCount,
    },
    paymentMethods,
    websiteDistribution,
  });
}
