import React, { useState, useEffect, useRef } from 'react';
import { X, Mail, Lock, User as UserIcon, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import {
  loginUser,
  registerUser,
  fetchAuthProviders,
  loginWithGoogle,
} from '../services/api';
import { User } from '../types/auth';
import { Logo } from './Logo';

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          prompt: () => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, unknown>
          ) => void;
        };
      };
    };
  }
}

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register';
  isDark?: boolean;
  promptReason?: string | null;
  onClose: () => void;
  onAuthSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'login',
  isDark = true,
  promptReason = null,
  onClose,
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleClientId, setGoogleClientId] = useState<string | null>(
    import.meta.env.VITE_GOOGLE_CLIENT_ID || null
  );
  const [error, setError] = useState<string | null>(null);
  const googleHiddenBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMode(initialMode);
    setError(null);
  }, [initialMode, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    fetchAuthProviders()
      .then((cfg) => {
        if (cfg.google_enabled && cfg.google_client_id) {
          setGoogleClientId(cfg.google_client_id);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !googleClientId) return;

    const initGoogle = () => {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response: { credential?: string }) => {
          if (!response.credential) {
            setError('Google Sign-In did not return a credential.');
            setIsGoogleLoading(false);
            return;
          }
          setIsGoogleLoading(true);
          setError(null);
          try {
            const res = await loginWithGoogle(response.credential);
            onAuthSuccess(res.user);
            onClose();
          } catch (err: any) {
            setError(err.message || 'Google Sign-In failed.');
          } finally {
            setIsGoogleLoading(false);
          }
        },
      });
      if (googleHiddenBtnRef.current) {
        googleHiddenBtnRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(googleHiddenBtnRef.current, {
          theme: isDark ? 'filled_black' : 'outline',
          size: 'large',
          width: 360,
        });
      }
    };

    if (window.google?.accounts?.id) {
      initGoogle();
      return;
    }

    const scriptId = 'google-gsi-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initGoogle;
      document.body.appendChild(script);
    }
  }, [isOpen, googleClientId, isDark, onAuthSuccess, onClose]);

  if (!isOpen) return null;

  const handleGoogleClick = () => {
    setError(null);
    if (!googleClientId) {
      setError(
        'Google Sign-In requires GOOGLE_CLIENT_ID in your backend .env file (from Google Cloud Console).'
      );
      return;
    }
    if (window.google?.accounts?.id) {
      setIsGoogleLoading(true);
      window.google.accounts.id.prompt();
      // Fallback click on rendered button if One Tap is suppressed
      const innerBtn = googleHiddenBtnRef.current?.querySelector('div[role="button"]') as HTMLElement | null;
      if (innerBtn) innerBtn.click();
      setTimeout(() => setIsGoogleLoading(false), 1500);
    } else {
      setError('Google Sign-In script is still loading. Please try again in a moment.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    if (mode === 'register' && fullName.trim().length < 2) {
      setError('Full name must be at least 2 characters.');
      return;
    }

    if (mode === 'register' && password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res =
        mode === 'login'
          ? await loginUser({ email: email.trim(), password })
          : await registerUser({
              email: email.trim(),
              full_name: fullName.trim(),
              password,
            });
      onAuthSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade">
      <div className="relative w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--panel-bg)] p-6 sm:p-7 shadow-2xl animate-slide-up text-[var(--text-primary)]">
        <button
          onClick={onClose}
          aria-label="Close authentication modal"
          className="absolute right-4 top-4 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Brand Header */}
        <div className="mb-5 flex flex-col items-start">
          <Logo isDark={isDark} size="md" className="mb-3" />
          <h2 className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            {promptReason ||
              (mode === 'login'
                ? 'Sign in to access your recordings, notes, and flowcharts.'
                : 'Start verifying your meetings, lectures, and videos.')}
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-[var(--border)] bg-[var(--subtle-fill)] p-1 font-mono text-xs">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`rounded-lg py-2 font-medium transition ${
              mode === 'login'
                ? 'bg-[var(--card-hover-bg)] text-[var(--text-primary)] border border-[var(--accent-violet)]/40 shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`rounded-lg py-2 font-medium transition ${
              mode === 'register'
                ? 'bg-[var(--card-hover-bg)] text-[var(--text-primary)] border border-[var(--accent-cyan)]/40 shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Continue with Google Button */}
        <button
          type="button"
          onClick={handleGoogleClick}
          disabled={isGoogleLoading}
          className="flex h-10 w-full items-center justify-center space-x-2.5 rounded-lg border border-[var(--border)] bg-[var(--subtle-fill)] px-4 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-violet)] hover:bg-[var(--card-hover-bg)] transition cursor-pointer disabled:opacity-50"
        >
          {isGoogleLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
          )}
          <span>Continue with Google</span>
        </button>

        {/* Hidden native GIS container */}
        <div ref={googleHiddenBtnRef} className="hidden" />

        {/* Divider */}
        <div className="my-4 flex items-center space-x-3">
          <div className="h-px flex-1 bg-[var(--border)]" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
            or continue with email
          </span>
          <div className="h-px flex-1 bg-[var(--border)]" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-mono font-medium text-[var(--text-secondary)] mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-2.5 h-4 w-4 text-[var(--text-secondary)]/60" />
                <input
                  type="text"
                  required
                  placeholder="Alex Mercer"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] pl-9 pr-3 text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)]/40 focus:border-[var(--accent-violet)] focus:outline-none transition"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-mono font-medium text-[var(--text-secondary)] mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-[var(--text-secondary)]/60" />
              <input
                type="email"
                required
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] pl-9 pr-3 text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)]/40 focus:border-[var(--accent-violet)] focus:outline-none transition font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-medium text-[var(--text-secondary)] mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-[var(--text-secondary)]/60" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder={mode === 'register' ? 'At least 6 characters' : 'Enter your password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] pl-9 pr-9 text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)]/40 focus:border-[var(--accent-violet)] focus:outline-none transition font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 top-2.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center space-x-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-gradient w-full !h-10 !text-xs flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{mode === 'login' ? 'Signing in...' : 'Creating account...'}</span>
              </>
            ) : (
              <span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
