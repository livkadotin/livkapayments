import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, hasPermission } from "@/lib/auth";
import { UpdateWebsiteSchema } from "@/lib/validations";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const website = await db.website.findUnique({
    where: { id },
    include: {
      apiKeys: {
        where: { status: "ACTIVE" },
        select: {
          id: true,
          publishableKey: true,
          secretKeyPrefix: true,
          webhookSecret: true,
          status: true,
          lastUsedAt: true,
          createdAt: true,
        },
      },
      webhookEndpoints: true,
      payments: {
        take: 50,
        orderBy: { createdAt: "desc" },
        include: {
          order: { select: { id: true, receipt: true } },
          customer: { select: { name: true, email: true } },
        },
      },
      orders: {
        take: 20,
        orderBy: { createdAt: "desc" },
      },
      refunds: {
        take: 20,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!website) {
    return NextResponse.json({ success: false, error: "Website not found" }, { status: 404 });
  }

  // Calculate stats for this specific website
  const revenueAgg = await db.payment.aggregate({
    where: { websiteId: id, status: "CAPTURED" },
    _sum: { amount: true },
    _count: true,
  });

  const failedCount = await db.payment.count({
    where: { websiteId: id, status: "FAILED" },
  });

  const refundAgg = await db.refund.aggregate({
    where: { websiteId: id, status: "PROCESSED" },
    _sum: { amount: true },
    _count: true,
  });

  let parsedAllowedDomains: string[] = [];
  try {
    parsedAllowedDomains = JSON.parse(website.allowedDomains);
  } catch {
    parsedAllowedDomains = [];
  }

  return NextResponse.json({
    success: true,
    website: {
      id: website.id,
      name: website.name,
      slug: website.slug,
      domain: website.domain,
      allowedDomains: parsedAllowedDomains,
      description: website.description,
      logoUrl: website.logoUrl,
      status: website.status,
      createdAt: website.createdAt,
      updatedAt: website.updatedAt,
      apiKeys: website.apiKeys,
      webhookEndpoints: website.webhookEndpoints,
    },
    stats: {
      totalRevenue: revenueAgg._sum.amount || 0,
      successfulPayments: revenueAgg._count || 0,
      failedPayments: failedCount,
      totalRefunds: refundAgg._sum.amount || 0,
      refundsCount: refundAgg._count || 0,
    },
    payments: website.payments,
    orders: website.orders,
    refunds: website.refunds,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(session.role, "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = UpdateWebsiteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const dataToUpdate: any = {};
    if (parsed.data.name !== undefined) dataToUpdate.name = parsed.data.name;
    if (parsed.data.domain !== undefined) dataToUpdate.domain = parsed.data.domain;
    if (parsed.data.description !== undefined) dataToUpdate.description = parsed.data.description;
    if (parsed.data.logoUrl !== undefined) dataToUpdate.logoUrl = parsed.data.logoUrl;
    if (parsed.data.status !== undefined) dataToUpdate.status = parsed.data.status;
    if (parsed.data.allowedDomains !== undefined) {
      dataToUpdate.allowedDomains = JSON.stringify(parsed.data.allowedDomains);
    }

    const updated = await db.website.update({
      where: { id },
      data: dataToUpdate,
    });

    await createAuditLog({
      userId: session.userId,
      action: "WEBSITE_UPDATED",
      resource: "Website",
      resourceId: id,
      details: dataToUpdate,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({
      success: true,
      website: {
        ...updated,
        allowedDomains: JSON.parse(updated.allowedDomains || "[]"),
      },
    });
  } catch (err: any) {
    console.error("Website update error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update website" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(session.role, "OWNER")) {
    return NextResponse.json({ error: "Only OWNER can delete websites" }, { status: 403 });
  }

  try {
    const website = await db.website.findUnique({ where: { id } });
    if (!website) {
      return NextResponse.json({ success: false, error: "Website not found" }, { status: 404 });
    }

    await db.website.delete({ where: { id } });

    await createAuditLog({
      userId: session.userId,
      action: "WEBSITE_DELETED",
      resource: "Website",
      resourceId: id,
      details: { name: website.name },
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ success: true, message: "Website deleted successfully" });
  } catch (err: any) {
    console.error("Website delete error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
