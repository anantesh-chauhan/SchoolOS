import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Building2,
  Eye,
  EyeOff,
  KeyRound,
  Loader,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';

const demoAccountsByRole = [
  {
    role: 'Platform Owner',
    users: [{ name: 'Platform Owner', email: 'platform@schoolos.com' }],
  },
  {
    role: 'School Owner',
    users: [
      { name: 'Green Valley Owner', email: 'owner@greenvalley.edu.in' },
      { name: 'DPS Owner', email: 'owner@dps.edu.in' },
    ],
  },
  {
    role: 'Admin',
    users: [
      { name: 'Green Valley Admin', email: 'admin@greenvalley.edu.in' },
      { name: 'DPS Admin', email: 'admin.dps@schoolos.com' },
    ],
  },
  {
    role: 'Teacher',
    users: [
      { name: 'GVS Teacher 1', email: 'teacher1.gvs001@schoolos.com' },
      { name: 'DPS Teacher 1', email: 'teacher1.dps002@schoolos.com' },
    ],
  },
  {
    role: 'Student',
    users: [
      { name: 'GVS Student', email: 'student1.1A.gvs001@schoolos.com' },
      { name: 'DPS Student', email: 'student1.1A.dps002@schoolos.com' },
    ],
  },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [rememberMe, setRememberMe] = useState(Boolean(localStorage.getItem('schoolosRemember')));
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [instantLoginEmail, setInstantLoginEmail] = useState('');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const user = await authService.validateSession();
        if (mounted && user?.role) {
          navigate(authService.getDashboardRouteByRole(user.role), { replace: true });
          return;
        }
      } catch (error) {
        authService.clearLocalSession();
      }

      const rememberedEmail = localStorage.getItem('schoolosRememberEmail');
      if (mounted && rememberedEmail) {
        setFormData((prev) => ({ ...prev, email: rememberedEmail }));
      }
    };

    bootstrap();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  const featureList = useMemo(
    () => [
      { icon: ShieldCheck, text: 'Role-secure dashboards for all stakeholders' },
      { icon: Building2, text: 'Multi-school architecture for growing institutions' },
      { icon: BookOpen, text: 'Class, section, and subject lifecycle management' },
      { icon: Users, text: 'Indian K-12 workflows with practical scalability' },
    ],
    []
  );

  const validateForm = () => {
    const newErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const redirectByRole = (role) => {
    const target = authService.getDashboardRouteByRole(role);
    if (target === '/login') {
      toast.error('Role is not configured for dashboard access');
      return;
    }
    navigate(target);
  };

  const loginWithCredentials = async (email, password) => {
    const { user } = await authService.login(email, password);

    if (rememberMe) {
      localStorage.setItem('schoolosRemember', '1');
      localStorage.setItem('schoolosRememberEmail', email);
    } else {
      localStorage.removeItem('schoolosRemember');
      localStorage.removeItem('schoolosRememberEmail');
    }

    toast.success(`Welcome back, ${user.name}`);
    redirectByRole(user.role);
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setErrors({});

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await loginWithCredentials(formData.email.trim(), formData.password);
    } catch (error) {
      const message = error?.message || 'Login failed. Check your credentials and try again.';
      setErrors({ submit: message });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleInstantLogin = async (email) => {
    setErrors({});
    setInstantLoginEmail(email);

    try {
      await loginWithCredentials(email, 'admin123');
    } catch (error) {
      const message = error?.message || 'Instant login failed.';
      setErrors({ submit: message });
      toast.error(message);
    } finally {
      setInstantLoginEmail('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="grid min-h-screen lg:grid-cols-[1.15fr_0.85fr]">
        <motion.section
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden bg-gradient-to-br from-cyan-700 via-blue-700 to-indigo-800 p-8 md:p-12 text-white"
        >
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, #ffffff 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
              <Sparkles size={22} />
            </div>
            <h1 className="mt-6 text-4xl md:text-5xl font-black tracking-tight">SchoolOS</h1>
            <p className="mt-3 text-white/90 text-lg leading-relaxed">
              A modern school operating system for Indian institutions to run academics, people, and outcomes on one platform.
            </p>

            <div className="mt-8 grid gap-3">
              {featureList.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div key={feature.text} className="rounded-xl bg-white/10 border border-white/20 px-4 py-3 flex items-center gap-3 backdrop-blur-sm">
                    <Icon size={18} className="text-cyan-100" />
                    <p className="text-sm md:text-base">{feature.text}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-10 rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-sm">
              <p className="text-sm uppercase tracking-wide text-cyan-100">Illustration Placeholder</p>
              <div className="mt-3 h-40 rounded-xl border border-white/20 bg-white/5 flex items-center justify-center text-sm text-white/80">
                Campus operations flow visualization
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="p-6 sm:p-10 lg:p-12 flex items-center"
        >
          <div className="w-full max-w-xl mx-auto">
            <div className="rounded-2xl bg-white shadow-xl border border-slate-200 p-6 sm:p-8">
              <h2 className="text-2xl font-bold text-slate-900">Sign in to SchoolOS</h2>
              <p className="mt-1 text-sm text-slate-500">Use your role account to access the right dashboard.</p>

              {errors.submit && (
                <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 flex items-start gap-2">
                  <AlertCircle size={16} className="text-rose-600 mt-0.5" />
                  <p className="text-sm text-rose-700">{errors.submit}</p>
                </div>
              )}

              <form className="mt-5 space-y-4" onSubmit={handleLogin}>
                <div>
                  <label htmlFor="email" className="text-sm font-medium text-slate-700">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
                    className={`mt-1 h-11 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 ${
                      errors.email ? 'border-rose-300 focus:ring-rose-500' : 'border-slate-300 focus:ring-blue-500'
                    }`}
                    placeholder="you@school.com"
                  />
                  {errors.email && <p className="mt-1 text-xs text-rose-600">{errors.email}</p>}
                </div>

                <div>
                  <label htmlFor="password" className="text-sm font-medium text-slate-700">Password</label>
                  <div className="mt-1 relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(event) => setFormData((prev) => ({ ...prev, password: event.target.value }))}
                      className={`h-11 w-full rounded-lg border pl-3 pr-10 text-sm focus:outline-none focus:ring-2 ${
                        errors.password ? 'border-rose-300 focus:ring-rose-500' : 'border-slate-300 focus:ring-blue-500'
                      }`}
                      placeholder="Enter password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                  {errors.password && <p className="mt-1 text-xs text-rose-600">{errors.password}</p>}
                </div>

                <div className="flex items-center justify-between">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(event) => setRememberMe(event.target.checked)}
                      className="rounded border-slate-300"
                    />
                    Remember me
                  </label>

                  <button type="button" className="text-sm text-blue-700 hover:text-blue-800 inline-flex items-center gap-1">
                    <KeyRound size={14} />
                    Forgot password
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="h-11 w-full rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 inline-flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader size={16} className="animate-spin" />
                      Logging in...
                    </>
                  ) : (
                    <>
                      Login
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Demo Users</p>
                  <p className="text-xs text-slate-500">Password: admin123</p>
                </div>
                <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                  {demoAccountsByRole.map((group) => (
                    <div key={group.role} className="p-3 bg-slate-50/70">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{group.role}</p>
                      <div className="space-y-2">
                        {group.users.map((user) => (
                          <div key={user.email} className="bg-white border border-slate-200 rounded-lg p-2.5 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-800 truncate">{user.name}</p>
                              <p className="text-xs text-slate-500 truncate">{user.email}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleInstantLogin(user.email)}
                              disabled={Boolean(instantLoginEmail)}
                              className="shrink-0 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-2.5 py-1.5 disabled:opacity-60"
                            >
                              {instantLoginEmail === user.email ? 'Logging...' : 'Instant Login'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
