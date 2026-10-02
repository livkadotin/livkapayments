import { z } from "zod";

export const CreateOrderSchema = z.object({
  amount: z.number().positive("Amount must be greater than 0"),
  currency: z.string().default("INR"),
  receipt: z.string().optional(),
  notes: z.record(z.any()).optional(),
  customer: z
    .object({
      name: z.string().optional(),
      email: z.string().email("Invalid email").optional(),
      phone: z.string().optional(),
    })
    .optional(),
});

export const CreateWebsiteSchema = z.object({
  id: z
    .string()
    .min(3, "ID must be at least 3 characters")
    .regex(/^[a-z0-9_-]+$/, "ID can only contain lowercase letters, numbers, underscores and dashes"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  domain: z.string().min(3, "Domain is required"),
  allowedDomains: z.array(z.string()).default([]),
  description: z.string().optional(),
  logoUrl: z.string().url("Invalid logo URL").optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export const UpdateWebsiteSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  domain: z.string().min(3, "Domain is required").optional(),
  allowedDomains: z.array(z.string()).optional(),
  description: z.string().optional().nullable(),
  logoUrl: z.string().url("Invalid logo URL").optional().or(z.literal("")).nullable(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const CreatePaymentLinkSchema = z.object({
  websiteId: z.string().min(1, "Website ID is required"),
  amount: z.number().positive("Amount must be greater than 0"),
  currency: z.string().default("INR"),
  description: z.string().optional(),
  referenceId: z.string().optional(),
  customer: z
    .object({
      name: z.string().optional(),
      email: z.string().email("Invalid email").optional(),
      phone: z.string().optional(),
    })
    .optional(),
  expiresInDays: z.number().int().positive().optional().default(7),
});

export const CreateQrPaymentSchema = z.object({
  websiteId: z.string().min(1, "Website ID is required"),
  amount: z.number().positive("Amount must be greater than 0"),
  currency: z.string().default("INR"),
  orderId: z.string().optional(),
  customerName: z.string().optional(),
  customerEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  customerPhone: z.string().optional(),
  expiresInMinutes: z.number().int().positive().optional().default(60),
});

export const CreateRefundSchema = z.object({
  paymentId: z.string().min(1, "Payment ID is required"),
  amount: z.number().positive("Refund amount must be greater than 0").optional(),
  reason: z.string().min(3, "Reason is required"),
});

export const ConfigureWebhookSchema = z.object({
  websiteId: z.string().min(1, "Website ID is required"),
  url: z.string().url("Valid webhook URL is required"),
  events: z.array(z.string()).min(1, "Select at least one event"),
});

export const LoginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
