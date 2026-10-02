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
  const search = searchParams.get("search");

  const where: any = {};
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
      { phone: { contains: search } },
    ];
  }

  const customers = await db.customer.findMany({
    where,
    include: {
      payments: {
        where: { status: "CAPTURED" },
        include: { website: { select: { name: true } } },
      },
      orders: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const customersWithMetrics = customers.map((c) => {
    const totalSpent = c.payments.reduce((acc, p) => acc + p.amount, 0);
    const totalPayments = c.payments.length;
    const websitesUsed = Array.from(new Set(c.payments.map((p) => p.website.name)));
    const lastPayment = c.payments.length > 0
      ? c.payments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0].createdAt
      : null;

    return {
      id: c.id,
      name: c.name || "Anonymous Customer",
      email: c.email || "No email",
      phone: c.phone || "—",
      totalSpent,
      totalPayments,
      websitesUsed,
      lastPayment,
      createdAt: c.createdAt,
      recentOrders: c.orders,
    };
  });

  return NextResponse.json({
    success: true,
    customers: customersWithMetrics,
  });
}
