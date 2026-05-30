// ============================================
// Panvas — Reset Password Page
// ============================================

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { Link, useLocation } from 'wouter';
import { Lock, Eye, EyeOff, KeyRound, AlertCircle, Loader2 } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { resetPasswordSchema, type ResetPasswordInput, getPasswordStrength } from '@/lib/validation/auth';

export function ResetPasswordPage() {
  const [, navigate] = useLocation();
  const { resetPassword, session, isLoading } = useAuthStore();
  const { showToast } = useUIStore();
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const passwordValue = watch('password');
  const strength = getPasswordStrength(passwordValue || '');

  // For resetting password, the user must be authenticated (which happens automatically via the reset link)
  useEffect(() => {
    if (!isLoading && !session) {
      showToast('Invalid or expired password reset link. Please request a new one.', 'error');
      navigate('/auth/forgot-password');
    }
  }, [isLoading, session, navigate, showToast]);

  const onSubmit = async (data: ResetPasswordInput) => {
    const result = await resetPassword(data.password);
    if (result.error) {
      setError('root', { message: result.error });
      return;
    }
    
    showToast('Password successfully reset.', 'success');
    navigate('/app');
  };

  if (isLoading || !session) {
    return (
      <AuthLayout title="Resetting password" subtitle="Verifying your reset link...">
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="text-[#A3A3A3] animate-spin" />
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Set new password" subtitle="Please enter your new password below.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
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

        {/* New Password */}
        <div>
          <label htmlFor="reset-password" className="block text-xs font-medium text-[#A3A3A3] mb-1.5">
            New password
          </label>
          <div className="relative">
            <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#525252]" />
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              id="reset-password"
              placeholder="Min. 8 characters"
              autoComplete="new-password"
              className="input-field pl-10 pr-10"
              aria-invalid={!!errors.password}
              aria-describedby="reset-password-error reset-password-strength"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#525252] hover:text-[#A3A3A3] transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {errors.password && (
            <p id="reset-password-error" className="mt-1 text-xs text-[#f43f5e]">{errors.password.message}</p>
          )}

          {/* Password strength meter */}
          {passwordValue && passwordValue.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-2 space-y-1.5"
              id="reset-password-strength"
              aria-live="polite"
            >
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map((level) => (
                  <motion.div
                    key={level}
                    className="h-1 flex-1 rounded-full"
                    initial={{ scaleX: 0 }}
                    animate={{ 
                      scaleX: 1,
                      backgroundColor: level <= strength.score ? strength.color : 'rgba(255,255,255,0.06)',
                    }}
                    transition={{ duration: 0.2, delay: level * 0.04 }}
                    style={{ transformOrigin: 'left' }}
                  />
                ))}
              </div>
              <p className="text-[11px] font-medium" style={{ color: strength.color }}>
                {strength.label}
              </p>
            </motion.div>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <label htmlFor="reset-confirm-password" className="block text-xs font-medium text-[#A3A3A3] mb-1.5">
            Confirm new password
          </label>
          <div className="relative">
            <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#525252]" />
            <input
              {...register('confirmPassword')}
              type={showConfirmPassword ? 'text' : 'password'}
              id="reset-confirm-password"
              placeholder="Repeat your new password"
              autoComplete="new-password"
              className="input-field pl-10 pr-10"
              aria-invalid={!!errors.confirmPassword}
              aria-describedby={errors.confirmPassword ? 'reset-confirm-error' : undefined}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#525252] hover:text-[#A3A3A3] transition-colors"
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p id="reset-confirm-error" className="mt-1 text-xs text-[#f43f5e]">{errors.confirmPassword.message}</p>
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
              Reset password
            </>
          )}
        </button>
      </form>
    </AuthLayout>
  );
}
