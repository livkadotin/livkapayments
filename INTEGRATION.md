# Livka Pay — Integration Guide for Client Projects & AI Assistants

> **Note for AI Coding Assistants (Cursor, Claude, ChatGPT, GitHub Copilot):**  
> This document is an exact, unambiguous API and implementation specification for integrating **Livka Pay** into any client web application (Next.js, React, Node.js, Python, PHP, Laravel, etc.). Follow the request/response schemas, header requirements, and HMAC verification algorithms exactly as documented below.

---

## 1. Overview & Architecture

**Livka Pay** is a centralized payment routing layer. A single central Razorpay merchant account handles payments for multiple client websites.

```
Client Website (e.g. livka.in)                       Livka Pay Gateway (payments.livka.in)
───────────────────────────────                       ─────────────────────────────────────
1. User clicks "Checkout"
2. Server calls Livka Pay API ────── POST /api/v1/orders ────► 3. Creates Razorpay Order
                               ◄──── { checkout_url, ... } ───
4. Redirects user or opens modal
5. Customer pays on Razorpay ────────────────────────────────► 6. Razorpay captures payment
                                                               7. Livka Pay updates DB
8. Webhook received & verified ◄── POST /api/webhooks/livka ── 9. Dispatches HMAC signed event
   (Order marked as FULFILLED)
```

### Base URL
- **Production Gateway:** `https://payments.livka.in`

---

## 2. Credentials Needed from Livka Pay Dashboard

Before writing code, obtain these 4 credentials from the Livka Pay Dashboard (`https://payments.livka.in/dashboard/websites`):

| Variable Name | Example Value | Where Used | Description |
|---|---|---|---|
| `LIVKA_PAY_WEBSITE_ID` | `web_cm...` | Server / Client | Your unique registered website ID |
| `LIVKA_PAY_PUBLISHABLE_KEY` | `pk_live_1a2b3c4d...` | Client (Frontend) | Public key for frontend SDK initialization |
| `LIVKA_PAY_SECRET_KEY` | `sk_live_9z8y7x6w...` | Server (Backend) | **Keep Secret!** Used to authenticate order creation |
| `LIVKA_PAY_WEBHOOK_SECRET` | `whsec_5t6y7u8i...` | Server (Backend) | Used to verify HMAC SHA-256 signatures on webhooks |

Add these to your client application's `.env.local` or `.env`:
```env
LIVKA_PAY_BASE_URL="https://payments.livka.in"
LIVKA_PAY_WEBSITE_ID="your_website_id"
LIVKA_PAY_PUBLISHABLE_KEY="pk_live_..."
LIVKA_PAY_SECRET_KEY="sk_live_..."
LIVKA_PAY_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_APP_URL="https://yourstore.com"
```

---

## 3. Order Creation API (Server-to-Server)

Create an order from your backend server before presenting the payment UI to the customer.

### Endpoint
```http
POST https://payments.livka.in/api/v1/orders
```

### Request Headers
```http
Content-Type: application/json
x-api-key: sk_live_your_secret_key
```
*(Alternatively: `Authorization: Bearer sk_live_your_secret_key`)*

### Request Body (JSON Schema)
```json
{
  "amount": 799.00,
  "currency": "INR",
  "receipt": "ORD-2026-1001",
  "customer": {
    "name": "Rahul Sharma",
    "email": "rahul@example.com",
    "phone": "9876543210"
  },
  "notes": {
    "cart_id": "cart_8831",
    "redirect_url": "https://yourstore.com/checkout/success?order_id=ORD-2026-1001"
  }
}
```

#### Field Specifications:
- `amount` *(number, required)*: Order amount in standard units (e.g. `799.00` for ₹799). Do **NOT** multiply by 100 — the gateway handles paise conversion automatically.
- `currency` *(string, optional)*: Default is `"INR"`.
- `receipt` *(string, optional)*: Your internal store order/receipt ID (e.g. `"INV-9921"`).
- `customer.name` *(string, optional)*: Customer's full name.
- `customer.email` *(string, optional)*: Customer's email address.
- `customer.phone` *(string, optional)*: Customer's 10-digit mobile number.
- `notes` *(object, optional)*: Key-value metadata. Pass `"redirect_url"` to have the hosted checkout redirect the customer back to your confirmation page after payment.

### Success Response (`201 Created`)
```json
{
  "success": true,
  "order": {
    "id": "ord_819201_a1b2",
    "website_id": "web_cm...",
    "amount": 799,
    "currency": "INR",
    "receipt": "ORD-2026-1001",
    "status": "CREATED",
    "created_at": "2026-10-02T16:00:00.000Z"
  },
  "razorpay_order_id": "order_RZP12345678",
  "razorpay_key_id": "rzp_live_SVuGP7TfB8jKRH",
  "checkout_url": "https://payments.livka.in/pay/order/ord_819201_a1b2"
}
```

---

## 4. Frontend Checkout Options

You have two integration choices for the customer checkout UI:

### Option A: Hosted Checkout Redirect (Recommended — Easiest & Zero Frontend Code)

Simply redirect the customer's browser to the `checkout_url` returned by the Order Creation API:

```ts
// In your frontend checkout button handler:
const res = await fetch("/api/checkout", { method: "POST", body: JSON.stringify(cart) });
const data = await res.json();

if (data.checkoutUrl) {
  // Redirect customer to Livka Pay hosted page
  window.location.href = data.checkoutUrl;
}
```

**What happens:**
1. Customer is redirected to `https://payments.livka.in/pay/order/ord_xxx`.
2. The page automatically renders your website's **Name**, **Logo**, **Receipt Number**, and **Amount**.
3. Customer clicks "Pay Securely" and completes payment using UPI, Cards, NetBanking, or Wallets via Razorpay modal.
4. Once verified, the page automatically redirects customer to your `"redirect_url"` (e.g. `https://yourstore.com/checkout/success`).

---

### Option B: In-Page Checkout Modal (JavaScript SDK)

If you prefer keeping the customer on your website with a modal popup:

1. Add the Livka Pay SDK to your page:
```html
<script src="https://payments.livka.in/sdk/livka-pay.js"></script>
```

2. Call `LivkaPay.pay(...)` after creating the order on your backend:
```javascript
// 1. Call your own backend to create the order
const res = await fetch("/api/checkout", { method: "POST", body: JSON.stringify(cart) });
const { orderId, razorpayOrderId, razorpayKeyId, websiteName, amount } = await res.json();

// 2. Open Livka Pay modal
window.LivkaPay.pay({
  publishableKey: "pk_live_your_key",
  orderId: orderId,
  razorpayOrderId: razorpayOrderId,
  razorpayKeyId: razorpayKeyId,
  websiteName: websiteName || "My Store",
  amount: amount,
  customer: {
    name: "Rahul Sharma",
    email: "rahul@example.com",
    contact: "9876543210"
  },
  onSuccess: function (result) {
    console.log("Payment successful!", result);
    window.location.href = "/checkout/success?order_id=" + orderId;
  },
  onError: function (err) {
    console.error("Payment failed or cancelled:", err);
    alert("Payment could not be completed. Please try again.");
  },
  onDismiss: function () {
    console.log("Customer closed the payment window.");
  }
});
```

---

## 5. Webhook Handling & Order Fulfillment (Critical)

Livka Pay sends server-to-server HTTP POST webhooks to your website whenever an event occurs.

### Registering Your Webhook URL
In Livka Pay Dashboard (`https://payments.livka.in/dashboard/websites`):
- Set your Webhook URL to: `https://yourstore.com/api/webhooks/livka`
- Subscribed events: `["payment.captured", "order.paid", "refund.processed"]`

### Webhook Request Specifications
- **Method:** `POST`
- **Headers:**
  - `Content-Type`: `application/json`
  - `x-livka-signature`: HMAC SHA-256 hex digest of the **raw request body** using your `LIVKA_PAY_WEBHOOK_SECRET`.
  - `x-livka-event`: Name of the event (e.g. `payment.captured`).
  - `x-livka-delivery`: Unique delivery ID (e.g. `del_1727885400000_1`).

### Webhook Payload Schema (`payment.captured` / `order.paid`)
```json
{
  "event": "payment.captured",
  "website_id": "web_cm...",
  "timestamp": "2026-10-02T16:00:05.123Z",
  "order": {
    "id": "ord_819201_a1b2",
    "receipt": "ORD-2026-1001",
    "amount": 799,
    "currency": "INR",
    "status": "PAID"
  },
  "payment": {
    "id": "pay_internal_9918",
    "razorpay_payment_id": "pay_P8Y2aBC1234567",
    "amount": 799,
    "currency": "INR",
    "method": "upi",
    "status": "CAPTURED"
  },
  "customer": {
    "id": "cust_123",
    "name": "Rahul Sharma",
    "email": "rahul@example.com",
    "phone": "9876543210"
  }
}
```

---

## 6. Copy-Paste Code Implementations

### A. Next.js (App Router)

#### 1. Backend Route: `app/api/checkout/route.ts`
```typescript
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { items, customer, receipt } = await req.json();

    // 1. Calculate order total on server (never trust client amounts!)
    const amount = 799.00; // Calculate from your database items

    // 2. Call Livka Pay API
    const livkaRes = await fetch("https://payments.livka.in/api/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.LIVKA_PAY_SECRET_KEY!,
      },
      body: JSON.stringify({
        amount,
        currency: "INR",
        receipt: receipt || `ORD-${Date.now()}`,
        customer: {
          name: customer?.name,
          email: customer?.email,
          phone: customer?.phone,
        },
        notes: {
          redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?receipt=${receipt}`,
        },
      }),
    });

    const data = await livkaRes.json();

    if (!data.success) {
      return NextResponse.json({ error: data.error || "Order creation failed" }, { status: 400 });
    }

    return NextResponse.json({
      checkoutUrl: data.checkout_url,
      orderId: data.order.id,
      razorpayOrderId: data.razorpay_order_id,
      razorpayKeyId: data.razorpay_key_id,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

#### 2. Webhook Listener: `app/api/webhooks/livka/route.ts`
```typescript
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    // 1. Read raw body as text for HMAC verification
    const rawBody = await req.text();
    const signature = req.headers.get("x-livka-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }

    // 2. Verify HMAC SHA-256 signature
    const webhookSecret = process.env.LIVKA_PAY_WEBHOOK_SECRET!;
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expectedSignature, "hex")
    );

    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // 3. Process the event safely
    const payload = JSON.parse(rawBody);
    const { event, order, payment } = payload;

    if (event === "payment.captured" || event === "order.paid") {
      const receipt = order.receipt; // Your store order ID
      const razorpayPaymentId = payment.razorpay_payment_id;

      // Mark your order as PAID in your database:
      // await db.order.update({ where: { receipt }, data: { status: "PAID", paymentId: razorpayPaymentId } });
      console.log(`Order ${receipt} successfully paid with ${razorpayPaymentId}`);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("Webhook processing error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

---

### B. Node.js & Express

```javascript
const express = require("express");
const crypto = require("crypto");
const fetch = require("node-fetch");
const app = express();

const LIVKA_SECRET = process.env.LIVKA_PAY_SECRET_KEY;
const LIVKA_WEBHOOK_SECRET = process.env.LIVKA_PAY_WEBHOOK_SECRET;

// 1. Order Creation Endpoint
app.post("/api/checkout", express.json(), async (req, res) => {
  try {
    const { amount, receipt, customer } = req.body;

    const response = await fetch("https://payments.livka.in/api/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": LIVKA_SECRET,
      },
      body: JSON.stringify({
        amount,
        currency: "INR",
        receipt,
        customer,
        notes: {
          redirect_url: "https://yourstore.com/checkout/success",
        },
      }),
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Webhook Listener (Use express.raw to preserve raw bytes)
app.post(
  "/api/webhooks/livka",
  express.raw({ type: "application/json" }),
  (req, res) => {
    const signature = req.headers["x-livka-signature"];
    const rawBody = req.body.toString("utf8");

    const expected = crypto
      .createHmac("sha256", LIVKA_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");

    if (signature !== expected) {
      return res.status(400).send("Invalid Signature");
    }

    const payload = JSON.parse(rawBody);
    if (payload.event === "payment.captured") {
      console.log("Order paid:", payload.order.receipt);
      // Fulfill order in your database
    }

    res.json({ received: true });
  }
);
```

---

### C. Python (FastAPI)

```python
from fastapi import FastAPI, Request, HTTPException, Header
import hmac
import hashlib
import httpx
import os

app = FastAPI()

LIVKA_SECRET = os.getenv("LIVKA_PAY_SECRET_KEY")
LIVKA_WEBHOOK_SECRET = os.getenv("LIVKA_PAY_WEBHOOK_SECRET")

# 1. Order Creation
@app.post("/api/checkout")
async def create_checkout(amount: float, receipt: str, customer_name: str, customer_email: str):
    async with httpx.AsyncClient() as client:
        res = await client.post(
            "https://payments.livka.in/api/v1/orders",
            headers={"x-api-key": LIVKA_SECRET, "Content-Type": "application/json"},
            json={
                "amount": amount,
                "currency": "INR",
                "receipt": receipt,
                "customer": {"name": customer_name, "email": customer_email},
                "notes": {"redirect_url": "https://yourstore.com/checkout/success"}
            }
        )
        return res.json()

# 2. Webhook Listener
@app.post("/api/webhooks/livka")
async def livka_webhook(request: Request, x_livka_signature: str = Header(None)):
    raw_body = await request.body()

    expected_signature = hmac.new(
        LIVKA_WEBHOOK_SECRET.encode("utf-8"),
        raw_body,
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(x_livka_signature or "", expected_signature):
        raise HTTPException(status_code=400, detail="Invalid signature")

    payload = await request.json()
    if payload.get("event") in ["payment.captured", "order.paid"]:
        order_info = payload.get("order", {})
        print(f"Order #{order_info.get('receipt')} was successfully paid!")
        # Fulfill order in DB

    return {"status": "ok"}
```

---

## 7. Order Status Verification (Polling / Fallback API)

If you need to query an order's status on demand (e.g., if a user refreshes their confirmation page before a webhook arrives):

### Endpoint
```http
GET https://payments.livka.in/api/v1/orders/{order_id}
```

### Request Headers
```http
x-api-key: sk_live_your_secret_key
```

### Response
```json
{
  "success": true,
  "order": {
    "id": "ord_819201_a1b2",
    "amount": 799,
    "currency": "INR",
    "receipt": "ORD-2026-1001",
    "status": "PAID",
    "payments": [
      {
        "id": "pay_9912",
        "razorpayPaymentId": "pay_P8Y2aBC1234567",
        "status": "CAPTURED",
        "method": "upi"
      }
    ]
  }
}
```

Possible `status` values: `CREATED`, `ATTEMPTED`, `PAID`, `FAILED`, `CANCELLED`.

---

## 8. Prompt Template for AI Assistants (Cursor / Claude / Copilot)

When building or adding payments to another project, copy and paste this exact prompt into your AI coding assistant:

```markdown
I want to integrate Livka Pay (centralized Razorpay payment gateway) into this project.

Here are my project credentials (stored in .env):
- LIVKA_PAY_BASE_URL="https://payments.livka.in"
- LIVKA_PAY_SECRET_KEY="sk_live_..."
- LIVKA_PAY_WEBHOOK_SECRET="whsec_..."
- NEXT_PUBLIC_APP_URL="https://myproject.com"

Please implement:
1. A server endpoint `/api/checkout` that receives order details from the cart, calculates the total amount, calls POST https://payments.livka.in/api/v1/orders with header `x-api-key: LIVKA_PAY_SECRET_KEY`, and passes `notes.redirect_url` set to `${NEXT_PUBLIC_APP_URL}/checkout/success`. Return `checkout_url` to the client.
2. Update the checkout button to call `/api/checkout` and redirect `window.location.href = data.checkoutUrl`.
3. A webhook endpoint `/api/webhooks/livka` that:
   - Reads the raw request body.
   - Verifies the `x-livka-signature` header using HMAC SHA-256 with `LIVKA_PAY_WEBHOOK_SECRET` using timing-safe comparison.
   - Listens for `payment.captured` or `order.paid` events and marks the order as paid in our database.
   - Returns 200 `{ received: true }`.
```

---

## 9. Summary Checklist for Launch

- [ ] Created Website in Livka Pay Dashboard (`https://payments.livka.in/dashboard/websites`).
- [ ] Saved `Website ID`, `Publishable Key`, `Secret Key`, and `Webhook Secret` in `.env`.
- [ ] Configured Webhook endpoint in Dashboard (`https://yourstore.com/api/webhooks/livka`).
- [ ] Set `notes.redirect_url` in order creation payload.
- [ ] Verified HMAC SHA-256 verification uses **raw body bytes** before any JSON parsing.
- [ ] Tested live payment flow with small amount (e.g. ₹1) and verified webhook updates store DB.
