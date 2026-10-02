import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, hasPermission } from "@/lib/auth";
import { generateWebsiteCredentials } from "@/lib/crypto";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";

export async function POST(
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
    const website = await db.website.findUnique({ where: { id } });
    if (!website) {
      return NextResponse.json({ success: false, error: "Website not found" }, { status: 404 });
    }

    // Revoke previous active keys
    await db.apiKey.updateMany({
      where: { websiteId: id, status: "ACTIVE" },
      data: { status: "REVOKED" },
    });

    // Generate new credentials
    const credentials = generateWebsiteCredentials(website.slug);

    const newKey = await db.apiKey.create({
      data: {
        websiteId: id,
        name: `Key rotated on ${new Date().toLocaleDateString("en-IN")}`,
        publishableKey: credentials.publishableKey,
        secretKeyHash: credentials.secretKeyHash,
        secretKeyPrefix: credentials.secretKeyPrefix,
        webhookSecret: credentials.webhookSecret,
        status: "ACTIVE",
      },
    });

    // Create Audit Log
    await createAuditLog({
      userId: session.userId,
      action: "API_KEY_ROTATED",
      resource: "ApiKey",
      resourceId: newKey.id,
      details: { websiteId: id, websiteName: website.name },
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({
      success: true,
      message: "API keys rotated successfully",
      credentials: {
        website_id: id,
        publishable_key: credentials.publishableKey,
        secret_key: credentials.secretKey, // Return raw secret only now
        webhook_secret: credentials.webhookSecret,
      },
    });
  } catch (err: any) {
    console.error("Rotate keys error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to rotate keys" },
      { status: 500 }
    );
  }
}
