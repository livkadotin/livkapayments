import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();

function hashSecretKey(secretKey) {
  return crypto.createHash("sha256").update(secretKey).digest("hex");
}

async function main() {
  console.log("🌱 Starting ReplyFlow Pay database seed...");

  // 1. Create Default Admin User
  const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || "admin_replyflow_2026";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@replyflow.co.in" },
    update: {
      passwordHash,
      name: "ReplyFlow Administrator",
      role: "OWNER",
    },
    create: {
      email: "admin@replyflow.co.in",
      passwordHash,
      name: "ReplyFlow Administrator",
      role: "OWNER",
    },
  });
  console.log("✅ Admin user seeded:", admin.email);

  // 2. Create Customers
  const rahul = await prisma.customer.upsert({
    where: { id: "cust_rahul_01" },
    update: {},
    create: {
      id: "cust_rahul_01",
      name: "Rahul Sharma",
      email: "rahul.sharma@example.com",
      phone: "+919876543210",
    },
  });

  const priya = await prisma.customer.upsert({
    where: { id: "cust_priya_02" },
    update: {},
    create: {
      id: "cust_priya_02",
      name: "Priya Patel",
      email: "priya.patel@example.com",
      phone: "+919812345678",
    },
  });

  const amit = await prisma.customer.upsert({
    where: { id: "cust_amit_03" },
    update: {},
    create: {
      id: "cust_amit_03",
      name: "Amit Verma",
      email: "amit.verma@example.com",
      phone: "+919899112233",
    },
  });

  // 3. Create Websites
  const websitesData = [
    {
      id: "replyflow_001",
      name: "ReplyFlow",
      slug: "replyflow",
      domain: "replyflow.co.in",
      allowedDomains: JSON.stringify(["replyflow.co.in", "www.replyflow.co.in", "localhost:3000", "localhost:3001"]),
      description: "AI communication & automated support platform",
      logoUrl: "https://replyflow.co.in/logo.png",
      status: "ACTIVE",
      pubKey: "pk_live_rf_7a9182bc",
      secKey: "sk_live_rf_98f12a837c4b01e298",
      whSec: "whsec_rf_31829abc",
      webhookUrl: "https://replyflow.co.in/api/webhooks/payments",
    },
    {
      id: "livka_001",
      name: "Livka",
      slug: "livka",
      domain: "livka.in",
      allowedDomains: JSON.stringify(["livka.in", "www.livka.in", "localhost:3000", "localhost:3002"]),
      description: "Apparel, lifestyle & modern commerce storefront",
      logoUrl: "https://livka.in/favicon.ico",
      status: "ACTIVE",
      pubKey: "pk_live_livka_55b8921e",
      secKey: "sk_live_livka_44a193fd662c1109a",
      whSec: "whsec_livka_8829103c",
      webhookUrl: "https://livka.in/api/payment/webhook",
    },
    {
      id: "demo_store_001",
      name: "Demo Store",
      slug: "demo-store",
      domain: "demostore.com",
      allowedDomains: JSON.stringify(["demostore.com", "localhost:3000"]),
      description: "Developer sandbox & payment testing site",
      logoUrl: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=100&h=100&fit=crop",
      status: "ACTIVE",
      pubKey: "pk_live_demo_11c784fa",
      secKey: "sk_live_demo_99a8421c77319e0",
      whSec: "whsec_demo_291048bc",
      webhookUrl: "https://demostore.com/api/webhooks",
    },
  ];

  for (const w of websitesData) {
    const site = await prisma.website.upsert({
      where: { id: w.id },
      update: {
        name: w.name,
        slug: w.slug,
        domain: w.domain,
        allowedDomains: w.allowedDomains,
        description: w.description,
        logoUrl: w.logoUrl,
        status: w.status,
      },
      create: {
        id: w.id,
        name: w.name,
        slug: w.slug,
        domain: w.domain,
        allowedDomains: w.allowedDomains,
        description: w.description,
        logoUrl: w.logoUrl,
        status: w.status,
      },
    });

    // Seed API Key
    const existingKey = await prisma.apiKey.findFirst({
      where: { websiteId: site.id },
    });

    if (!existingKey) {
      await prisma.apiKey.create({
        data: {
          websiteId: site.id,
          name: "Default Production Key",
          publishableKey: w.pubKey,
          secretKeyHash: hashSecretKey(w.secKey),
          secretKeyPrefix: w.secKey.slice(0, 16) + "...",
          webhookSecret: w.whSec,
          status: "ACTIVE",
        },
      });
    }

    // Seed Webhook Endpoint
    const existingEndpoint = await prisma.webhookEndpoint.findFirst({
      where: { websiteId: site.id },
    });

    if (!existingEndpoint) {
      await prisma.webhookEndpoint.create({
        data: {
          websiteId: site.id,
          url: w.webhookUrl,
          events: JSON.stringify(["payment.captured", "order.paid", "refund.processed", "payment.failed"]),
          secret: w.whSec,
          status: "ACTIVE",
        },
      });
    }
  }
  console.log("✅ Seeded 3 websites with credentials & webhooks");

  // 4. Seed Orders & Payments
  const orderLivka = await prisma.order.upsert({
    where: { id: "ord_lv_10291" },
    update: {},
    create: {
      id: "ord_lv_10291",
      websiteId: "livka_001",
      customerId: rahul.id,
      amount: 799.0,
      currency: "INR",
      receipt: "LV-10291",
      status: "PAID",
      razorpayOrderId: "order_lv_mock_10291",
      notes: JSON.stringify({ website_order_id: "LV-10291", items: "Oversized Cotton Tee (L)" }),
      createdAt: new Date(Date.now() - 3600 * 1000 * 4), // 4 hours ago
    },
  });

  await prisma.payment.upsert({
    where: { id: "pay_lv_10291" },
    update: {},
    create: {
      id: "pay_lv_10291",
      orderId: orderLivka.id,
      websiteId: "livka_001",
      customerId: rahul.id,
      amount: 799.0,
      currency: "INR",
      status: "CAPTURED",
      method: "upi",
      razorpayPaymentId: "pay_rzp_mock_lv_01",
      razorpayOrderId: "order_lv_mock_10291",
      capturedAt: new Date(Date.now() - 3600 * 1000 * 4),
      createdAt: new Date(Date.now() - 3600 * 1000 * 4),
    },
  });

  const orderReplyFlow = await prisma.order.upsert({
    where: { id: "ord_rf_9941" },
    update: {},
    create: {
      id: "ord_rf_9941",
      websiteId: "replyflow_001",
      customerId: priya.id,
      amount: 4999.0,
      currency: "INR",
      receipt: "RF-9941",
      status: "PAID",
      razorpayOrderId: "order_rf_mock_9941",
      notes: JSON.stringify({ plan: "Growth Annual Plan", seatCount: 5 }),
      createdAt: new Date(Date.now() - 3600 * 1000 * 12), // 12 hours ago
    },
  });

  await prisma.payment.upsert({
    where: { id: "pay_rf_9941" },
    update: {},
    create: {
      id: "pay_rf_9941",
      orderId: orderReplyFlow.id,
      websiteId: "replyflow_001",
      customerId: priya.id,
      amount: 4999.0,
      currency: "INR",
      status: "CAPTURED",
      method: "card",
      razorpayPaymentId: "pay_rzp_mock_rf_01",
      razorpayOrderId: "order_rf_mock_9941",
      capturedAt: new Date(Date.now() - 3600 * 1000 * 12),
      createdAt: new Date(Date.now() - 3600 * 1000 * 12),
    },
  });

  const orderLivka2 = await prisma.order.upsert({
    where: { id: "ord_lv_10292" },
    update: {},
    create: {
      id: "ord_lv_10292",
      websiteId: "livka_001",
      customerId: amit.id,
      amount: 1499.0,
      currency: "INR",
      receipt: "LV-10292",
      status: "PAID",
      razorpayOrderId: "order_lv_mock_10292",
      notes: JSON.stringify({ website_order_id: "LV-10292", items: "Heavyweight Linen Shirt" }),
      createdAt: new Date(Date.now() - 3600 * 1000 * 26),
    },
  });

  await prisma.payment.upsert({
    where: { id: "pay_lv_10292" },
    update: {},
    create: {
      id: "pay_lv_10292",
      orderId: orderLivka2.id,
      websiteId: "livka_001",
      customerId: amit.id,
      amount: 1499.0,
      currency: "INR",
      status: "CAPTURED",
      method: "netbanking",
      razorpayPaymentId: "pay_rzp_mock_lv_02",
      razorpayOrderId: "order_lv_mock_10292",
      capturedAt: new Date(Date.now() - 3600 * 1000 * 26),
      createdAt: new Date(Date.now() - 3600 * 1000 * 26),
    },
  });

  // Refunded Order
  const orderRefunded = await prisma.order.upsert({
    where: { id: "ord_lv_10293" },
    update: {},
    create: {
      id: "ord_lv_10293",
      websiteId: "livka_001",
      customerId: rahul.id,
      amount: 2199.0,
      currency: "INR",
      receipt: "LV-10293",
      status: "REFUNDED",
      razorpayOrderId: "order_lv_mock_10293",
      notes: JSON.stringify({ website_order_id: "LV-10293", items: "Denim Jacket" }),
      createdAt: new Date(Date.now() - 3600 * 1000 * 48),
    },
  });

  const paymentRefunded = await prisma.payment.upsert({
    where: { id: "pay_lv_10293" },
    update: {},
    create: {
      id: "pay_lv_10293",
      orderId: orderRefunded.id,
      websiteId: "livka_001",
      customerId: rahul.id,
      amount: 2199.0,
      currency: "INR",
      status: "REFUNDED",
      method: "upi",
      razorpayPaymentId: "pay_rzp_mock_lv_03",
      razorpayOrderId: "order_lv_mock_10293",
      capturedAt: new Date(Date.now() - 3600 * 1000 * 48),
      createdAt: new Date(Date.now() - 3600 * 1000 * 48),
    },
  });

  await prisma.refund.upsert({
    where: { id: "rfnd_lv_001" },
    update: {},
    create: {
      id: "rfnd_lv_001",
      paymentId: paymentRefunded.id,
      websiteId: "livka_001",
      amount: 2199.0,
      currency: "INR",
      reason: "Customer returned item due to sizing preference",
      status: "PROCESSED",
      razorpayRefundId: "rfnd_rzp_mock_01",
      processedAt: new Date(Date.now() - 3600 * 1000 * 30),
      createdAt: new Date(Date.now() - 3600 * 1000 * 30),
    },
  });

  // Failed Order
  const orderFailed = await prisma.order.upsert({
    where: { id: "ord_demo_502" },
    update: {},
    create: {
      id: "ord_demo_502",
      websiteId: "demo_store_001",
      customerId: amit.id,
      amount: 599.0,
      currency: "INR",
      receipt: "DM-502",
      status: "FAILED",
      razorpayOrderId: "order_dm_mock_502",
      notes: JSON.stringify({ website_order_id: "DM-502" }),
      createdAt: new Date(Date.now() - 3600 * 1000 * 6),
    },
  });

  await prisma.payment.upsert({
    where: { id: "pay_demo_502" },
    update: {},
    create: {
      id: "pay_demo_502",
      orderId: orderFailed.id,
      websiteId: "demo_store_001",
      customerId: amit.id,
      amount: 599.0,
      currency: "INR",
      status: "FAILED",
      method: "card",
      razorpayPaymentId: "pay_rzp_mock_dm_fail",
      razorpayOrderId: "order_dm_mock_502",
      errorReason: "Payment timed out at bank authentication gateway",
      createdAt: new Date(Date.now() - 3600 * 1000 * 6),
    },
  });

  // 5. Seed Payment Link
  await prisma.paymentLink.upsert({
    where: { code: "pl_livka_fest799" },
    update: {},
    create: {
      id: "plnk_livka_01",
      websiteId: "livka_001",
      code: "pl_livka_fest799",
      amount: 799.0,
      currency: "INR",
      description: "Festive Limited Edition T-Shirt Drop",
      referenceId: "LV-FEST-01",
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 86400 * 1000 * 7),
    },
  });

  // 6. Seed QR Payment
  await prisma.qrPayment.upsert({
    where: { orderId: orderLivka.id },
    update: {},
    create: {
      id: "qr_lv_10291",
      websiteId: "livka_001",
      orderId: orderLivka.id,
      amount: 799.0,
      currency: "INR",
      customerName: "Rahul Sharma",
      customerEmail: "rahul.sharma@example.com",
      qrData: `https://payments.replyflow.co.in/pay/qr/qr_lv_10291`,
      status: "PAID",
    },
  });

  // 7. Seed Audit Logs
  await prisma.auditLog.createMany({
    data: [
      {
        userId: admin.id,
        action: "WEBSITE_CREATED",
        resource: "Website",
        resourceId: "livka_001",
        details: JSON.stringify({ name: "Livka", domain: "livka.in" }),
      },
      {
        userId: admin.id,
        action: "API_KEY_GENERATED",
        resource: "ApiKey",
        resourceId: "pk_live_livka_55b8921e",
        details: JSON.stringify({ website: "Livka" }),
      },
      {
        userId: admin.id,
        action: "PAYMENT_REFUNDED",
        resource: "Refund",
        resourceId: "rfnd_lv_001",
        details: JSON.stringify({ amount: 2199, order: "LV-10293", reason: "Customer return" }),
      },
    ],
  });

  console.log("✅ Seeded Orders, Payments, Refunds, Payment Links, QR, and Audit Logs successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
