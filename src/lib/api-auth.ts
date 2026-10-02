import { NextRequest } from "next/server";
import { db } from "./db";
import { hashSecretKey } from "./crypto";

export interface AuthenticatedTenant {
  website: {
    id: string;
    name: string;
    slug: string;
    domain: string;
    allowedDomains: string;
    status: string;
  };
  apiKey: {
    id: string;
    publishableKey: string;
    secretKeyPrefix: string;
    webhookSecret: string;
  };
}

export async function authenticateApiRequest(
  req: NextRequest,
  options: { requireSecretKey?: boolean } = { requireSecretKey: true }
): Promise<
  | { success: true; data: AuthenticatedTenant }
  | { success: false; error: string; status: number }
> {
  const authHeader = req.headers.get("authorization") || "";
  const apiKeyHeader = req.headers.get("x-api-key") || "";

  let keyToTest = "";
  if (authHeader.startsWith("Bearer ")) {
    keyToTest = authHeader.substring(7).trim();
  } else if (apiKeyHeader) {
    keyToTest = apiKeyHeader.trim();
  }

  if (!keyToTest) {
    return {
      success: false,
      error: "Missing API Key. Provide key via Authorization: Bearer <key> or x-api-key header.",
      status: 401,
    };
  }

  // Check if it is a secret key (sk_live_...) or publishable key (pk_live_...)
  const isSecretKey = keyToTest.startsWith("sk_");
  const isPublishableKey = keyToTest.startsWith("pk_");

  if (options.requireSecretKey && !isSecretKey) {
    return {
      success: false,
      error: "This endpoint requires a secret API key (sk_live_...). Publishable keys are not authorized for server-side mutations.",
      status: 403,
    };
  }

  let matchedKey: any = null;

  if (isSecretKey) {
    const keyHash = hashSecretKey(keyToTest);
    matchedKey = await db.apiKey.findFirst({
      where: {
        secretKeyHash: keyHash,
        status: "ACTIVE",
      },
      include: {
        website: true,
      },
    });
  } else if (isPublishableKey) {
    matchedKey = await db.apiKey.findFirst({
      where: {
        publishableKey: keyToTest,
        status: "ACTIVE",
      },
      include: {
        website: true,
      },
    });

    // For publishable key, validate origin/domain if provided
    if (matchedKey && matchedKey.website) {
      const origin = req.headers.get("origin") || req.headers.get("referer");
      if (origin) {
        try {
          const originHost = new URL(origin).hostname;
          let allowed: string[] = [];
          try {
            allowed = JSON.parse(matchedKey.website.allowedDomains);
          } catch {
            allowed = [];
          }

          if (allowed.length > 0 && !allowed.includes(originHost) && !allowed.includes("localhost")) {
            return {
              success: false,
              error: `Origin domain '${originHost}' is not allowed for website '${matchedKey.website.name}'. Add domain in Livka Pay dashboard.`,
              status: 403,
            };
          }
        } catch {
          // ignore malformed origin URL
        }
      }
    }
  }

  if (!matchedKey || !matchedKey.website) {
    return {
      success: false,
      error: "Invalid or revoked API key.",
      status: 401,
    };
  }

  if (matchedKey.website.status !== "ACTIVE") {
    return {
      success: false,
      error: `Website '${matchedKey.website.name}' (${matchedKey.website.id}) is currently disabled. Contact platform administrator.`,
      status: 403,
    };
  }

  // Update lastUsedAt asynchronously
  db.apiKey.update({
    where: { id: matchedKey.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {});

  return {
    success: true,
    data: {
      website: matchedKey.website,
      apiKey: {
        id: matchedKey.id,
        publishableKey: matchedKey.publishableKey,
        secretKeyPrefix: matchedKey.secretKeyPrefix,
        webhookSecret: matchedKey.webhookSecret,
      },
    },
  };
}
