# Livka Pay — Central Payment Infrastructure Platform

**Livka Pay** is a centralized, multi-tenant payment infrastructure layer that connects **ONE** central Razorpay merchant account to any number of tenant websites and applications (such as [replyflow.co.in](https://livka.in), [livka.in](https://livka.in), and future SaaS products).

Each connected application receives isolated credentials (`Website ID`, `Publishable Key`, `Secret Key`, `Webhook Secret`, and `Allowed CORS Domains`). Tenant applications create orders and accept customer payments through Livka Pay's unified API and checkout layer without maintaining separate Razorpay accounts.

The platform is designed to be hosted at:
> **https://payments.livka.in**  
> *(The main marketing and support website at `https://livka.in` remains completely separate and unaffected).*

---

## Architecture

```
Tenant Website (e.g. Livka)
    │
    │ 1. POST /api/v1/orders (Authorization: Bearer sk_live_...)
    ▼
Livka Pay Central API (payments.livka.in)
    │
    │ 2. Authenticate Website & Create Razorpay Order
    ▼
Razorpay (One Central Merchant Account)
    │
    │ 3. Customer Pays via Checkout / QR / Payment Link
    ▼
Razorpay Webhook (payment.captured)
    │
    │ 4. POST /api/v1/webhooks/razorpay (HMAC SHA-256 Signature Verified)
    ▼
Livka Pay
    │ ├─ Idempotency Check (Prevents duplicate processing)
    │ ├─ Update Database (Order: PAID, Payment: CAPTURED)
    │ ├─ Emit Real-Time SSE to Dashboard
    │ └─ Sign Outgoing Webhook (HMAC SHA-256)
    ▼
Tenant Website Webhook (e.g. https://livka.in/api/payment/webhook)
    └─ Fulfill Customer Order
```

---

## Key Features

- **Multi-Tenant Architecture**: Add unlimited websites/apps; generate distinct Publishable and Secret API keys per tenant.
- **Enterprise-Grade Webhooks**:
  - Inbound Razorpay webhook listener verifying official HMAC SHA-256 signatures.
  - Strict idempotency auditing via the `WebhookEvent` table to prevent duplicate captures or refunds.
  - Outbound webhook dispatcher with HMAC signatures, exponential backoff retries, and delivery logs.
- **Fintech Admin Dashboard**:
  - Overview KPI cards (Total Revenue, Today's Revenue, Successful Payments, Failed Payments, Total Refunds, Active Websites).
  - Responsive Recharts revenue timeline with 7d, 30d, 90d, 1y period filters.
  - Transaction ledger, Orders, and Customers with lifetime spend (LTV) metrics.
  - Real-time live status badge connected via Server-Sent Events (`/api/v1/events`).
- **Dynamic QR Payments Engine** (`/qr`):
  - Dynamic QR codes generated on-the-fly for any website and amount.
  - Live customer view (`/pay/qr/[id]`) that automatically updates to **Payment Successful ✓** the instant payment is confirmed without manual page refresh.
- **Hosted Payment Links** (`/payment-links`):
  - Mobile-first branded payment pages at `https://payments.livka.in/pay/[code]`.
  - Seamless Razorpay Checkout modal integration with server-side confirmation.
- **Full & Partial Refunds**:
  - Initiate refunds with reason validation directly from the dashboard or via API.
  - Automatic status transitions (`PARTIALLY_REFUNDED` / `REFUNDED`) and tenant webhook dispatch.
- **Interactive Developer Payment Simulator**:
  - Built-in test simulator allowing instant end-to-end testing (Order creation → Test capture → DB update → Webhook dispatch → Real-time SSE alert) without real bank cards.
- **Client JavaScript SDK**: Lightweight checkout script embeddable across React, Next.js, and plain HTML.

---

## Tech Stack

- **Framework**: Next.js 15 (App Router, Server Actions, Route Handlers)
- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide React, Framer Motion, Recharts
- **Components**: Accessible Radix UI primitives (`@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-tabs`)
- **Database & ORM**: PostgreSQL with Prisma ORM (`dev.db` SQLite fallback for zero-dependency local development)
- **Payment Gateway**: Official `razorpay` SDK + HMAC cryptographic signature verification
- **Authentication**: Secure HTTP-only JWT sessions with `jose` and `bcryptjs`

---

## Local Development Setup

### 1. Prerequisites
- Node.js 18+ (tested on Node.js v24)
- npm or pnpm

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Copy the example environment file:
```bash
cp .env.example .env
```

Review `.env`:
```env
DATABASE_URL="file:./dev.db"
RAZORPAY_KEY_ID="rzp_test_your_key_id"
RAZORPAY_KEY_SECRET="your_razorpay_key_secret"
RAZORPAY_WEBHOOK_SECRET="your_razorpay_webhook_secret"
APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
AUTH_SECRET="replyflow_pay_super_secret_jwt_key_at_least_32_characters_long"
ADMIN_DEFAULT_EMAIL="admin@livka.in"
ADMIN_DEFAULT_PASSWORD="admin_livka_2026"
```

### 4. Database Setup & Seeding
```bash
# Push schema to SQLite database and generate Prisma Client
npm run prisma:generate
npm run prisma:push

# Seed admin user and tenant websites (ReplyFlow, Livka, Demo Store)
npm run prisma:seed
```

### 5. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

**Default Administrator Credentials**:
- Email: `admin@livka.in`
- Password: `admin_livka_2026`

---

## API Documentation & Code Examples

### 1. Create Order
**Endpoint**: `POST /api/v1/orders`  
**Header**: `Authorization: Bearer <sk_live_...>`

```bash
curl -X POST https://payments.livka.in/api/v1/orders \
  -H "Authorization: Bearer sk_live_livka_44a193fd662c1109a" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 799,
    "currency": "INR",
    "receipt": "LV-10291",
    "customer": {
      "name": "Rahul Sharma",
      "email": "rahul@example.com",
      "phone": "+919876543210"
    },
    "notes": {
      "items": "Oversized Cotton Tee (L)"
    }
  }'
```

**Response**:
```json
{
  "success": true,
  "order": {
    "id": "ord_819201_a1b2",
    "website_id": "livka_001",
    "amount": 799,
    "currency": "INR",
    "receipt": "LV-10291",
    "status": "CREATED"
  },
  "razorpay_order_id": "order_NX12345678",
  "razorpay_key_id": "rzp_live_xxxxx",
  "checkout_url": "https://payments.livka.in/pay/order/ord_819201_a1b2"
}
```

---

### 2. Verifying Webhooks on Tenant Website (Node.js / Express / Next.js)

When a payment is captured, Livka Pay sends an HTTP POST request to your configured webhook endpoint with header `x-replyflow-signature`.

```typescript
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-replyflow-signature") || "";
  const webhookSecret = process.env.REPLYFLOW_WEBHOOK_SECRET; // e.g. whsec_livka_...

  // Compute expected HMAC SHA-256
  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret!)
    .update(rawBody)
    .digest("hex");

  // Timing-safe verification
  const isValid = crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(signature)
  );

  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(rawBody);

  if (event.event === "payment.captured") {
    const orderId = event.order_id;
    const amount = event.amount;
    console.log(`Payment confirmed for Order ${orderId}: ₹${amount}`);
    // Update order state in Livka database and trigger fulfillment
  }

  return NextResponse.json({ received: true });
}
```

---

## Vercel Deployment & Custom Domain Configuration

### 1. Create Vercel Project
1. Import this repository into Vercel.
2. Select **Next.js** framework preset.
3. Configure the following Production Environment Variables in Vercel:
   - `DATABASE_URL`: Your PostgreSQL connection string (Neon, Supabase, Vercel Postgres, or AWS RDS).
   - `RAZORPAY_KEY_ID`: Your central Razorpay Key ID (`rzp_live_...`).
   - `RAZORPAY_KEY_SECRET`: Your central Razorpay Key Secret.
   - `RAZORPAY_WEBHOOK_SECRET`: The secret configured in your Razorpay Dashboard Webhooks.
   - `APP_URL`: `https://payments.livka.in`
   - `NEXT_PUBLIC_APP_URL`: `https://payments.livka.in`
   - `AUTH_SECRET`: A 32+ character random secret for signing admin JWT sessions.
   - `ADMIN_DEFAULT_EMAIL`: `admin@livka.in`
   - `ADMIN_DEFAULT_PASSWORD`: A secure administrative password.

### 2. Custom Domain DNS Configuration
To route `payments.livka.in` to Livka Pay while keeping `replyflow.co.in` completely separate:

1. In your Vercel Project, navigate to **Settings** → **Domains**.
2. Add `payments.livka.in`.
3. In your DNS Provider (Cloudflare, GoDaddy, Route 53, or Namecheap) for domain `replyflow.co.in`, add the following DNS record:
   - **Type**: `CNAME`
   - **Name / Subdomain**: `payments`
   - **Target / Value**: `cname.vercel-dns.com`
   - **TTL**: `Auto` or `3600`
   - **Proxy**: If using Cloudflare, set to **DNS Only** (Grey Cloud) during initial SSL certificate issuance.

> [!IMPORTANT]
> The apex record `@` (`replyflow.co.in`) and `www` (`www.replyflow.co.in`) remain pointed to your main website and will not be altered.

### 3. Razorpay Webhook URL Configuration
In your Razorpay Merchant Dashboard:
1. Go to **Settings** → **Webhooks**.
2. Click **Add New Webhook**.
3. Set Webhook URL:
   ```
   https://payments.livka.in/api/v1/webhooks/razorpay
   ```
4. Set Secret: Enter the same secret as in `RAZORPAY_WEBHOOK_SECRET`.
5. Select Active Events:
   - `payment.authorized`
   - `payment.captured`
   - `payment.failed`
   - `order.paid`
   - `refund.created`
   - `refund.processed`
   - `refund.failed`
6. Click **Save Webhook**.

---

## Security Specifications

1. **Secret Key Hashing**: Secret API keys (`sk_live_...`) are hashed with cryptographic SHA-256 before saving to the database. Plaintext secrets are displayed only once upon generation.
2. **Timing-Safe Verification**: All inbound Razorpay signatures and outgoing webhook signatures are compared using `crypto.timingSafeEqual` to eliminate timing side-channel vulnerabilities.
3. **Webhook Idempotency**: Inbound Razorpay webhook events are tracked in the `WebhookEvent` table. Any duplicate events from Razorpay retries are identified and acknowledged safely without creating duplicate database entities.
4. **Allowed Origins (CORS)**: Client-side requests using publishable keys validate the `Origin` header against the website's configured allowed domains.
5. **Session Security**: Admin dashboard sessions use HTTP-Only, SameSite cookies with signed JWT tokens.

---

## License
Proprietary & Confidential — Livka Pay © 2026. All rights reserved.
