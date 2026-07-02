import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[0-9]/, "Password must include a number");

export const registerSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().trim().min(2).max(120),
  password: passwordSchema,
  organizationName: z.string().trim().min(2).max(120)
});

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128)
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(32)
});

export const logoutSchema = refreshSchema;

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
