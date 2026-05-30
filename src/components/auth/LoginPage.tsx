// ============================================
// Panvas — Login Page
// ============================================

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { Link, useLocation } from 'wouter';
import { Mail, Lock, Eye, EyeOff, LogIn, AlertCircle, Loader2 } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { useAuthStore } from '@/stores/authStore';
import { loginSchema, type LoginInput } from '@/lib/validation/auth';

// Simple inline SVG icons for OAuth providers (no external deps)
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" className="flex-shrink-0">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" className="flex-shrink-0">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
    </svg>
  );
}

export function LoginPage() {
  const [, navigate] = useLocation();
  const { signIn, signInWithOAuth } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginInput) => {
    const result = await signIn(data.email, data.password);
    if (result.error) {
      setError('root', { message: result.error });
      return;
    }
    navigate('/app');
  };

  const handleOAuth = async (provider: 'google' | 'github') => {
    setOauthLoading(provider);
    const result = await signInWithOAuth(provider);
    if (result.error) {
      setError('root', { message: result.error });
    }
    setOauthLoading(null);
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your Panvas workspace.">
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

        {/* Email */}
        <div>
          <label htmlFor="login-email" className="block text-xs font-medium text-[#A3A3A3] mb-1.5">
            Email address
          </label>
          <div className="relative">
            <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#525252]" />
            <input
              {...register('email')}
              type="email"
              id="login-email"
              placeholder="you@example.com"
              autoComplete="email"
              className="input-field pl-10"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'login-email-error' : undefined}
            />
          </div>
          {errors.email && (
            <p id="login-email-error" className="mt-1 text-xs text-[#f43f5e]">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="login-password" className="block text-xs font-medium text-[#A3A3A3]">
              Password
            </label>
            <Link href="/auth/forgot-password">
              <span className="text-xs text-[#525252] hover:text-[#A3A3A3] transition-colors cursor-pointer">
                Forgot password?
              </span>
            </Link>
          </div>
          <div className="relative">
            <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#525252]" />
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              id="login-password"
              placeholder="Enter your password"
              autoComplete="current-password"
              className="input-field pl-10 pr-10"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'login-password-error' : undefined}
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
            <p id="login-password-error" className="mt-1 text-xs text-[#f43f5e]">{errors.password.message}</p>
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
              <LogIn size={15} />
              Sign In
            </>
          )}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 h-px bg-white/6" />
          <span className="text-[11px] text-[#525252] font-medium">or continue with</span>
          <div className="flex-1 h-px bg-white/6" />
        </div>

        {/* OAuth */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleOAuth('google')}
            disabled={!!oauthLoading}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-[#121212] border border-white/8 text-sm text-[#A3A3A3] hover:bg-[#1A1A1A] hover:border-white/12 transition-all duration-200 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-white/10"
            aria-label="Sign in with Google"
          >
            {oauthLoading === 'google' ? <Loader2 size={16} className="animate-spin" /> : <GoogleIcon />}
            <span className="font-medium">Google</span>
          </button>
          <button
            type="button"
            onClick={() => handleOAuth('github')}
            disabled={!!oauthLoading}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-[#121212] border border-white/8 text-sm text-[#A3A3A3] hover:bg-[#1A1A1A] hover:border-white/12 transition-all duration-200 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-white/10"
            aria-label="Sign in with GitHub"
          >
            {oauthLoading === 'github' ? <Loader2 size={16} className="animate-spin" /> : <GitHubIcon />}
            <span className="font-medium">GitHub</span>
          </button>
        </div>

        {/* Sign up link */}
        <p className="text-center text-xs text-[#525252] pt-2">
          Don't have an account?{' '}
          <Link href="/auth/signup">
            <span className="text-[#A3A3A3] hover:text-[#E8E8E8] font-medium transition-colors cursor-pointer">
              Create one
            </span>
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
