import { z } from "zod";

const trimmedText = (max) => z.string().trim().min(1).max(max);

export const registerSchema = z.object({
  fullName: trimmedText(120),
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  phone: z.string().trim().max(30).optional().default(""),
  password: z.string().min(12).max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(1).max(128),
});

export const proposalSchema = z.object({
  serviceType: trimmedText(80),
  description: trimmedText(5000),
  budgetRange: trimmedText(80),
  timeline: trimmedText(80),
});

export const proposalUpdateSchema = z.object({
  status: z.enum(["In review", "Quoted", "Accepted", "In progress", "Completed", "Declined"]),
  privateNote: z.string().trim().max(3000).optional().default(""),
});

export function readUuid(value) {
  return z.string().uuid().safeParse(value);
}
