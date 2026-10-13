import { useState } from 'react';
import type { User, UserRole } from '@/types';
import { setSession } from '@/lib/session';
import {
  HardHat,
  X,
  Eye,
  EyeOff,
  UserPlus,
  LogIn,
  Mail,
  Lock,
  Phone,
  User as UserIcon,
  Shield,
  CheckCircle2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface LoginPageProps {
  onLogin: (user: User) => void;
}

type AuthMode = 'login' | 'register';

export function LoginPage({ onLogin }: LoginPageProps) {
  const [mode, setMode] = useState<AuthMode>('login');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register form state
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerRole, setRegisterRole] = useState<UserRole>('worker');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Quick Demo Accounts filler
  function fillDemoAccount(email: string, role: string) {
    setLoginEmail(email);
    setLoginPassword('password123');
    setError(null);
    toast.success(`Loaded demo ${role} credentials (${email})`);
  }

  // Handle Login submission
  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanEmail = loginEmail.trim().toLowerCase();
    const cleanPassword = loginPassword.trim();

    if (!cleanEmail || !cleanPassword) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);

    try {
      let loggedInUser: User | null = null;

      // 1. Try Supabase Auth first
      try {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });

        if (!authError && authData?.user) {
          loggedInUser = {
            id: authData.user.id,
            name: authData.user.user_metadata?.full_name || cleanEmail.split('@')[0],
            email: authData.user.email || cleanEmail,
            phone: authData.user.phone || null,
            role: (authData.user.user_metadata?.role as UserRole) || 'worker',
            active: true,
            created_at: authData.user.created_at,
          };
        }
      } catch (err) {
        console.warn('Supabase auth sign in attempt failed, trying local fallback:', err);
      }

      // 2. If Supabase auth was not successful or unavailable, try local backend
      if (!loggedInUser) {
        const response = await fetch('/api/users/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, password: cleanPassword }),
        });

        if (response.ok) {
          const localUser = await response.json();
          loggedInUser = {
            id: localUser.id,
            name: localUser.name,
            email: localUser.email,
            phone: localUser.phone || null,
            role: localUser.role || 'worker',
            active: Boolean(localUser.active),
            created_at: localUser.created_at || new Date().toISOString(),
          };
        } else {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || 'Invalid email or password.');
        }
      }

      if (loggedInUser) {
        setSession(loggedInUser);
        toast.success(`Welcome back, ${loggedInUser.name}!`);
        onLogin(loggedInUser);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  // Handle Register submission
  async function handleRegisterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanName = registerName.trim();
    const cleanEmail = registerEmail.trim().toLowerCase();
    const cleanPhone = registerPhone.trim();
    const cleanPassword = registerPassword.trim();

    if (!cleanName) {
      setError('Please enter your full name.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!cleanPassword || cleanPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (cleanPassword !== registerConfirmPassword.trim()) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      let registeredUser: User | null = null;

      // 1. Try creating account in Supabase Auth
      try {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPassword,
          options: {
            data: {
              full_name: cleanName,
              role: registerRole,
              phone: cleanPhone || null,
            },
          },
        });

        if (!signUpError && signUpData?.user) {
          registeredUser = {
            id: signUpData.user.id,
            name: cleanName,
            email: cleanEmail,
            phone: cleanPhone || null,
            role: registerRole,
            active: true,
            created_at: signUpData.user.created_at || new Date().toISOString(),
          };

          // Also insert into Supabase users table
          try {
            await supabase.from('users').upsert({
              id: registeredUser.id,
              name: registeredUser.name,
              email: registeredUser.email,
              phone: registeredUser.phone,
              role: registeredUser.role,
              active: true,
            });
          } catch {
            // Ignore if RLS or offline
          }
        }
      } catch (err) {
        console.warn('Supabase auth sign up attempt failed, trying local fallback:', err);
      }

      // 2. Also register in local SQLite backend for unified state
      try {
        const res = await fetch('/api/users/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: cleanName,
            email: cleanEmail,
            phone: cleanPhone || null,
            role: registerRole,
            password: cleanPassword,
          }),
        });

        if (res.ok) {
          const localUser = await res.json();
          if (!registeredUser) {
            registeredUser = {
              id: localUser.id,
              name: localUser.name,
              email: localUser.email,
              phone: localUser.phone || null,
              role: localUser.role || 'worker',
              active: Boolean(localUser.active),
              created_at: localUser.created_at || new Date().toISOString(),
            };
          }
        } else if (!registeredUser) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to create user account.');
        }
      } catch (err: unknown) {
        if (!registeredUser) {
          throw err;
        }
      }

      if (registeredUser) {
        toast.success(`Account created successfully! Welcome, ${registeredUser.name}!`);
        setSession(registeredUser);
        onLogin(registeredUser);
      } else {
        throw new Error('Could not complete registration. Please try again.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-charcoal-950 p-4">
      <div className="w-full max-w-md">
        {/* Logo and Brand */}
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 shadow-xl shadow-amber-500/25 ring-1 ring-amber-400/40">
            <HardHat className="h-7 w-7 text-charcoal-950" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-steel-100">SteelWorks</h1>
            <p className="text-xs uppercase tracking-wider text-amber-400 font-semibold">Workshop Management System</p>
          </div>
        </div>

        {/* Auth Card */}
        <div className="rounded-2xl border border-charcoal-700/70 bg-charcoal-800/80 p-6 shadow-2xl shadow-black/40 backdrop-blur-md">
          {/* Tabs */}
          <div className="mb-6 grid grid-cols-2 gap-1.5 rounded-xl border border-charcoal-700/80 bg-charcoal-900/80 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition-all ${
                mode === 'login'
                  ? 'bg-amber-500 text-charcoal-950 shadow-md ring-1 ring-amber-400'
                  : 'text-steel-400 hover:text-steel-200'
              }`}
            >
              <LogIn className="h-4 w-4" />
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition-all ${
                mode === 'register'
                  ? 'bg-amber-500 text-charcoal-950 shadow-md ring-1 ring-amber-400'
                  : 'text-steel-400 hover:text-steel-200'
              }`}
            >
              <UserPlus className="h-4 w-4" />
              Register
            </button>
          </div>

          {/* Card Header Text */}
          <div className="mb-5">
            <h2 className="text-lg font-bold text-steel-100">
              {mode === 'login' ? 'Welcome Back' : 'Create New User Account'}
            </h2>
            <p className="text-xs text-steel-400 mt-0.5">
              {mode === 'login'
                ? 'Sign in to manage orders, inventory, billing and invoices'
                : 'Register staff member or administrator for the workshop'}
            </p>
          </div>

          {/* Error & Success Alerts */}
          {error && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              <X className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* SIGN IN FORM */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-steel-300">Email Address</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-500" />
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full rounded-xl border border-charcoal-700 bg-charcoal-900 py-2.5 pl-9 pr-3 text-sm text-steel-100 placeholder-steel-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                    placeholder="frank@steelworks.com"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-steel-300">Password</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-500" />
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full rounded-xl border border-charcoal-700 bg-charcoal-900 py-2.5 pl-9 pr-10 text-sm text-steel-100 placeholder-steel-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-steel-500 hover:text-steel-300"
                  >
                    {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-charcoal-950 shadow-md shadow-amber-500/20 transition-all hover:bg-amber-400 active:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </button>

              {/* Demo Accounts Quick Selection */}
              <div className="pt-2">
                <span className="block text-[11px] font-medium uppercase tracking-wider text-steel-500 mb-2">
                  Quick Demo Accounts (Click to test):
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => fillDemoAccount('frank@steelworks.com', 'Admin')}
                    className="flex flex-col items-start rounded-lg border border-charcoal-700/60 bg-charcoal-900/40 p-2 text-left hover:border-amber-500/40 transition-colors"
                  >
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-300">
                      <Shield className="h-3 w-3" /> Admin
                    </div>
                    <span className="text-[10px] text-steel-400 truncate">frank@steelworks.com</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fillDemoAccount('jane@steelworks.com', 'Worker')}
                    className="flex flex-col items-start rounded-lg border border-charcoal-700/60 bg-charcoal-900/40 p-2 text-left hover:border-amber-500/40 transition-colors"
                  >
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-steel-200">
                      <UserIcon className="h-3 w-3" /> Worker
                    </div>
                    <span className="text-[10px] text-steel-400 truncate">jane@steelworks.com</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* REGISTER FORM */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-medium text-steel-300">Full Name *</label>
                <div className="relative">
                  <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-500" />
                  <input
                    type="text"
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    className="w-full rounded-xl border border-charcoal-700 bg-charcoal-900 py-2 pl-9 pr-3 text-sm text-steel-100 placeholder-steel-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                    placeholder="Robert Davis"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-steel-300">Email Address *</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-500" />
                  <input
                    type="email"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    className="w-full rounded-xl border border-charcoal-700 bg-charcoal-900 py-2 pl-9 pr-3 text-sm text-steel-100 placeholder-steel-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                    placeholder="robert@steelworks.com"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-steel-300">Phone / WhatsApp</label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-500" />
                    <input
                      type="text"
                      value={registerPhone}
                      onChange={(e) => setRegisterPhone(e.target.value)}
                      className="w-full rounded-xl border border-charcoal-700 bg-charcoal-900 py-2 pl-9 pr-3 text-sm text-steel-100 placeholder-steel-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-steel-300">Workshop Role *</label>
                  <select
                    value={registerRole}
                    onChange={(e) => setRegisterRole(e.target.value as UserRole)}
                    className="w-full rounded-xl border border-charcoal-700 bg-charcoal-900 py-2 px-3 text-sm text-steel-100 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                  >
                    <option value="worker">Worker (Shop Floor)</option>
                    <option value="manager">Manager (Orders & Inventory)</option>
                    <option value="admin">Admin (Full Workshop Control)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-steel-300">Password (min 6 chars) *</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-500" />
                  <input
                    type={showRegisterPassword ? 'text' : 'password'}
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    className="w-full rounded-xl border border-charcoal-700 bg-charcoal-900 py-2 pl-9 pr-10 text-sm text-steel-100 placeholder-steel-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-steel-500 hover:text-steel-300"
                  >
                    {showRegisterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-steel-300">Confirm Password *</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-500" />
                  <input
                    type={showRegisterPassword ? 'text' : 'password'}
                    value={registerConfirmPassword}
                    onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                    className="w-full rounded-xl border border-charcoal-700 bg-charcoal-900 py-2 pl-9 pr-3 text-sm text-steel-100 placeholder-steel-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-charcoal-950 shadow-md shadow-amber-500/20 transition-all hover:bg-amber-400 active:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50 mt-1"
              >
                {loading ? 'Creating Account…' : 'Register & Enter Workshop'}
              </button>
            </form>
          )}

          {/* Toggle between Sign In and Register */}
          <div className="mt-5 border-t border-charcoal-700/60 pt-4 text-center">
            {mode === 'login' ? (
              <p className="text-xs text-steel-400">
                Need a new user account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                  }}
                  className="font-semibold text-amber-400 hover:underline hover:text-amber-300 ml-1"
                >
                  Register here
                </button>
              </p>
            ) : (
              <p className="text-xs text-steel-400">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                  className="font-semibold text-amber-400 hover:underline hover:text-amber-300 ml-1"
                >
                  Sign In instead
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
