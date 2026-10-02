import crypto from "crypto";

/**
 * Hash secret API keys using SHA-256 for secure DB persistence.
 */
export function hashSecretKey(secretKey: string): string {
  return crypto.createHash("sha256").update(secretKey).digest("hex");
}

/**
 * Compare secret key with stored hash using timing-safe comparison.
 */
export function verifySecretKey(providedKey: string, storedHash: string): boolean {
  const computedHash = hashSecretKey(providedKey);
  if (computedHash.length !== storedHash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(storedHash));
}

/**
 * Generate HMAC SHA-256 signature for outgoing webhook payload.
 */
export function signWebhookPayload(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Verify inbound Razorpay webhook signature.
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  try {
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    if (expectedSignature.length !== signature.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "utf-8"),
      Buffer.from(signature, "utf-8")
    );
  } catch {
    return false;
  }
}

/**
 * Verify Razorpay payment signature from client checkout (orderId|paymentId).
 */
export function verifyRazorpayPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string
): boolean {
  try {
    const body = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "utf-8"),
      Buffer.from(signature, "utf-8")
    );
  } catch {
    return false;
  }
}

/**
 * Generate secure key pairs for a website.
 */
export function generateWebsiteCredentials(websiteSlug: string) {
  const cleanSlug = websiteSlug.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
  const randomHex = crypto.randomBytes(12).toString("hex");
  const randomSec = crypto.randomBytes(24).toString("hex");
  const randomWh = crypto.randomBytes(20).toString("hex");

  const publishableKey = `pk_live_${cleanSlug}_${randomHex}`;
  const secretKey = `sk_live_${cleanSlug}_${randomSec}`;
  const webhookSecret = `whsec_${cleanSlug}_${randomWh}`;

  return {
    publishableKey,
    secretKey,
    secretKeyHash: hashSecretKey(secretKey),
    secretKeyPrefix: secretKey.slice(0, 16) + "...",
    webhookSecret,
  };
}
