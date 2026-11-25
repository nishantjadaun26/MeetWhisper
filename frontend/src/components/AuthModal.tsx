import React, { useState } from 'react';
import { X, Mail, Lock, User as UserIcon, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { loginUser, registerUser } from '../services/api';
import { User } from '../types/auth';
import { Logo } from './Logo';

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
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    setMode(initialMode);
    setError(null);
  }, [initialMode, isOpen]);

  if (!isOpen) return null;

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
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-[var(--border)] bg-[var(--subtle-fill)] p-1 font-mono text-xs">
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

        <form onSubmit={handleSubmit} className="space-y-4">
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
