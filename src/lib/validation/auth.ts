// ============================================
// Panvas — Auth Validation Schemas (Zod)
// ============================================

import { z } from 'zod';

// ---- Shared field definitions ----

const email = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .email('Enter a valid email address')
  .max(254, 'Email is too long')
  .toLowerCase();

const passwordBase = z
  .string()
  .min(1, 'Password is required');

const newPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long')
  .regex(/[A-Za-z]/, 'Password must include a letter')
  .regex(/\d/, 'Password must include a number');

// ---- Schemas ----

export const loginSchema = z.object({
  email,
  password: passwordBase,
});

export const signupSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, 'Full name is required')
    .max(100, 'Name is too long'),
  email,
  password: newPassword,
  confirmPassword: z.string().min(1, 'Please confirm your password'),
  acceptTerms: z.boolean().refine((val) => val === true, {
    message: 'You must accept the terms to continue',
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const forgotPasswordSchema = z.object({
  email,
});

export const resetPasswordSchema = z.object({
  password: newPassword,
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

// ---- Types ----

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// ---- Password strength meter ----

export interface PasswordStrength {
  score: number;      // 0–4
  label: string;
  color: string;      // tailwind-compatible color
}

export function getPasswordStrength(password: string): PasswordStrength {
  let score = 0;

  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  // Clamp to 0–4
  score = Math.min(4, score);

  const levels: PasswordStrength[] = [
    { score: 0, label: 'Weak',      color: '#ef4444' },
    { score: 1, label: 'Fair',      color: '#f97316' },
    { score: 2, label: 'Good',      color: '#eab308' },
    { score: 3, label: 'Strong',    color: '#22c55e' },
    { score: 4, label: 'Excellent', color: '#10b981' },
  ];

  return levels[score];
}

// ---- Validation message helper ----

export function getValidationMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? 'Invalid input';
  }

  return error instanceof Error ? error.message : 'Something went wrong';
}
