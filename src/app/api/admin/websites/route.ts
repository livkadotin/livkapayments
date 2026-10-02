import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, hasPermission } from "@/lib/auth";
import { CreateWebsiteSchema } from "@/lib/validations";
import { generateWebsiteCredentials } from "@/lib/crypto";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const websites = await db.website.findMany({
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
      webhookEndpoints: {
        select: { id: true, url: true, events: true, status: true },
      },
      _count: {
        select: {
          orders: true,
          payments: true,
          refunds: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Calculate revenue per website
  const websitesWithRevenue = await Promise.all(
    websites.map(async (w) => {
      const revenueAgg = await db.payment.aggregate({
        where: { websiteId: w.id, status: "CAPTURED" },
        _sum: { amount: true },
      });
      return {
        ...w,
        allowedDomains: JSON.parse(w.allowedDomains || "[]"),
        totalRevenue: revenueAgg._sum.amount || 0,
      };
    })
  );

  return NextResponse.json({ success: true, websites: websitesWithRevenue });
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(session.role, "ADMIN")) {
    return NextResponse.json({ error: "Forbidden: ADMIN permissions required" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = CreateWebsiteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { id, name, domain, allowedDomains, description, logoUrl, status } = parsed.data;

    // Check if ID or domain already exists
    const existing = await db.website.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `Website with ID '${id}' already exists. Choose a unique ID.` },
        { status: 409 }
      );
    }

    // Generate credentials
    const credentials = generateWebsiteCredentials(id);

    // Ensure main domain is in allowedDomains
    const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const domainsSet = new Set(allowedDomains);
    domainsSet.add(cleanDomain);
    domainsSet.add(`www.${cleanDomain}`);

    // Create Website in DB
    const website = await db.website.create({
      data: {
        id,
        name,
        slug: id,
        domain: cleanDomain,
        allowedDomains: JSON.stringify(Array.from(domainsSet)),
        description: description || null,
        logoUrl: logoUrl || null,
        status,
        apiKeys: {
          create: {
            name: "Default Production Key",
            publishableKey: credentials.publishableKey,
            secretKeyHash: credentials.secretKeyHash,
            secretKeyPrefix: credentials.secretKeyPrefix,
            webhookSecret: credentials.webhookSecret,
            status: "ACTIVE",
          },
        },
      },
      include: {
        apiKeys: true,
      },
    });

    // Create Audit Log
    await createAuditLog({
      userId: session.userId,
      action: "WEBSITE_CREATED",
      resource: "Website",
      resourceId: website.id,
      details: { name: website.name, domain: website.domain, id: website.id },
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json(
      {
        success: true,
        website: {
          ...website,
          allowedDomains: Array.from(domainsSet),
        },
        credentials: {
          website_id: website.id,
          publishable_key: credentials.publishableKey,
          secret_key: credentials.secretKey, // Return raw secret ONLY on creation
          webhook_secret: credentials.webhookSecret,
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("Website creation error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to create website" },
      { status: 500 }
    );
  }
}
