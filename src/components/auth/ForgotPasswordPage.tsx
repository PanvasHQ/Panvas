// ============================================
// Panvas — Forgot Password Page
// ============================================

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'wouter';
import { Mail, ArrowLeft, AlertCircle, Loader2, CheckCircle2, KeyRound } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { useAuthStore } from '@/stores/authStore';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@/lib/validation/auth';

export function ForgotPasswordPage() {
  const { forgotPassword } = useAuthStore();
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    const result = await forgotPassword(data.email);
    if (result.error) {
      setError('root', { message: result.error });
      return;
    }
    setSubmittedEmail(data.email);
    setIsSuccess(true);
  };

  return (
    <AuthLayout 
      title={isSuccess ? "Check your email" : "Reset your password"} 
      subtitle={isSuccess ? "We've sent a password reset link to your email." : "Enter your email address and we'll send you a link to reset your password."}
    >
      <AnimatePresence mode="wait">
        {isSuccess ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            <div className="flex justify-center py-2">
              <div className="w-16 h-16 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center">
                <CheckCircle2 size={28} className="text-[#10b981]" />
              </div>
            </div>

            <div className="text-center p-4 rounded-lg bg-[#121212] border border-white/6">
              <p className="text-sm text-[#737373]">Reset link sent to:</p>
              <p className="font-medium text-[#E8E8E8] mt-1 break-all">{submittedEmail}</p>
            </div>

            <p className="text-xs text-center text-[#737373] leading-relaxed">
              If you don't see the email, check other places it might be, like your junk, spam, social, or other folders.
            </p>

            <Link href="/auth/login">
              <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#E8E8E8] text-[#0D0D0D] text-sm font-semibold hover:bg-white transition-all duration-200">
                <ArrowLeft size={15} />
                Return to sign in
              </button>
            </Link>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onSubmit={handleSubmit(onSubmit)} 
            className="space-y-4"
            noValidate
          >
            {/* Root error */}
            {errors.root && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2.5 rounded-lg bg-[#f43f5e]/8 border border-[#f43f5e]/15 p-3"
              >
                <AlertCircle size={15} className="text-[#f43f5e] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-[#f43f5e]">{errors.root.message}</p>
              </motion.div>
            )}

            {/* Email */}
            <div>
              <label htmlFor="forgot-email" className="block text-xs font-medium text-[#A3A3A3] mb-1.5">
                Email address
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#525252]" />
                <input
                  {...register('email')}
                  type="email"
                  id="forgot-email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="input-field pl-10"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'forgot-email-error' : undefined}
                />
              </div>
              {errors.email && (
                <p id="forgot-email-error" className="mt-1 text-xs text-[#f43f5e]">{errors.email.message}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#E8E8E8] text-[#0D0D0D] text-sm font-semibold hover:bg-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#E8E8E8]/40"
            >
              {isSubmitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <KeyRound size={15} />
                  Send reset link
                </>
              )}
            </button>

            {/* Back link */}
            <div className="text-center pt-2">
              <Link href="/auth/login">
                <span className="inline-flex items-center gap-1.5 text-xs text-[#525252] hover:text-[#A3A3A3] font-medium transition-colors cursor-pointer">
                  <ArrowLeft size={12} />
                  Return to sign in
                </span>
              </Link>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </AuthLayout>
  );
}
