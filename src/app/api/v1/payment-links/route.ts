import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import { getSessionFromRequest } from "@/lib/auth";
import { CreatePaymentLinkSchema } from "@/lib/validations";
import { db } from "@/lib/db";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  let websiteId: string | null = null;

  if (!session) {
    const auth = await authenticateApiRequest(req, { requireSecretKey: true });
    if (!auth.success) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }
    websiteId = auth.data.website.id;
  }

  try {
    const body = await req.json();
    const parsed = CreatePaymentLinkSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const targetWebsiteId = websiteId || parsed.data.websiteId;

    const website = await db.website.findUnique({
      where: { id: targetWebsiteId },
    });

    if (!website) {
      return NextResponse.json({ success: false, error: "Website not found" }, { status: 404 });
    }

    // Customer
    let customerId: string | undefined;
    if (parsed.data.customer?.email) {
      const email = parsed.data.customer.email.toLowerCase().trim();
      let cust = await db.customer.findFirst({ where: { email } });
      if (cust) {
        if (parsed.data.customer.name || parsed.data.customer.phone) {
          cust = await db.customer.update({
            where: { id: cust.id },
            data: {
              name: parsed.data.customer.name || cust.name,
              phone: parsed.data.customer.phone || cust.phone,
            },
          });
        }
      } else {
        cust = await db.customer.create({
          data: {
            name: parsed.data.customer.name || undefined,
            email,
            phone: parsed.data.customer.phone || undefined,
          },
        });
      }
      customerId = cust.id;
    }

    // Generate unique short code
    const randomCode = `pl_${website.slug.slice(0, 4)}_${crypto.randomBytes(4).toString("hex")}`;
    const expiresAt = parsed.data.expiresInDays
      ? new Date(Date.now() + parsed.data.expiresInDays * 86400 * 1000)
      : null;

    const paymentLink = await db.paymentLink.create({
      data: {
        websiteId: targetWebsiteId,
        customerId,
        code: randomCode,
        amount: parsed.data.amount,
        currency: parsed.data.currency || "INR",
        description: parsed.data.description || null,
        referenceId: parsed.data.referenceId || null,
        status: "ACTIVE",
        expiresAt,
      },
    });

    const appUrl = process.env.APP_URL || "https://payments.livka.in";
    const paymentUrl = `${appUrl}/pay/${paymentLink.code}`;

    return NextResponse.json(
      {
        success: true,
        payment_link: {
          id: paymentLink.id,
          code: paymentLink.code,
          url: paymentUrl,
          amount: paymentLink.amount,
          currency: paymentLink.currency,
          description: paymentLink.description,
          status: paymentLink.status,
          expires_at: paymentLink.expiresAt,
          created_at: paymentLink.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("Payment link creation error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to create payment link" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  let websiteId: string | null = null;

  if (!session) {
    const auth = await authenticateApiRequest(req, { requireSecretKey: true });
    if (!auth.success) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }
    websiteId = auth.data.website.id;
  }

  const { searchParams } = new URL(req.url);
  const targetWebsiteId = websiteId || searchParams.get("websiteId");
  const limit = Math.min(Number(searchParams.get("limit") || 50), 100);

  const where: any = {};
  if (targetWebsiteId) where.websiteId = targetWebsiteId;

  const links = await db.paymentLink.findMany({
    where,
    include: {
      website: { select: { id: true, name: true, domain: true } },
      customer: true,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const appUrl = process.env.APP_URL || "https://payments.livka.in";

  return NextResponse.json({
    success: true,
    payment_links: links.map((pl) => ({
      id: pl.id,
      code: pl.code,
      url: `${appUrl}/pay/${pl.code}`,
      amount: pl.amount,
      currency: pl.currency,
      description: pl.description,
      status: pl.status,
      expires_at: pl.expiresAt,
      created_at: pl.createdAt,
      website: pl.website,
      customer: pl.customer,
    })),
  });
}
