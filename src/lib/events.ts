import { EventEmitter } from "events";

// Global event bus for real-time notifications across Server-Sent Events (SSE) connections
class PaymentEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
  }

  notifyPaymentCaptured(data: {
    paymentId: string;
    orderId: string;
    websiteId: string;
    websiteName: string;
    amount: number;
    currency: string;
    method?: string;
  }) {
    this.emit("event", {
      type: "payment.captured",
      timestamp: new Date().toISOString(),
      data,
    });
  }

  notifyRefundProcessed(data: {
    refundId: string;
    paymentId: string;
    websiteId: string;
    websiteName: string;
    amount: number;
    currency: string;
  }) {
    this.emit("event", {
      type: "refund.processed",
      timestamp: new Date().toISOString(),
      data,
    });
  }

  notifyOrderCreated(data: {
    orderId: string;
    websiteId: string;
    websiteName: string;
    amount: number;
  }) {
    this.emit("event", {
      type: "order.created",
      timestamp: new Date().toISOString(),
      data,
    });
  }
}

const globalForEvents = globalThis as unknown as {
  paymentEventBus: PaymentEventBus | undefined;
};

export const eventBus = globalForEvents.paymentEventBus ?? new PaymentEventBus();

if (process.env.NODE_ENV !== "production") {
  globalForEvents.paymentEventBus = eventBus;
}
