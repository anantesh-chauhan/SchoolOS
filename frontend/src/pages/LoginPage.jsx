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
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../services/authService';
import { schoolSettingsService } from '../services/schoolSettingsService';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [rememberMe, setRememberMe] = useState(Boolean(localStorage.getItem('schoolosRemember')));
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [instantLoginEmail, setInstantLoginEmail] = useState('');
  const [errors, setErrors] = useState({});
  const [branding, setBranding] = useState(null);
  const [demoAccounts, setDemoAccounts] = useState(() => {
    try {
      const cached = sessionStorage.getItem('schoolosInstantAccounts');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [demoAccountsLoading, setDemoAccountsLoading] = useState(true);
  const [demoAccountsError, setDemoAccountsError] = useState('');
  const [demoSearch, setDemoSearch] = useState('');
  const [instantFilters, setInstantFilters] = useState({ role: '', school: '', className: '', section: '' });


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

  useEffect(() => {
    const schoolId = searchParams.get('schoolId');
    if (!schoolId) {
      return;
    }

    let mounted = true;
    schoolSettingsService
      .getPublicBranding(schoolId)
      .then((response) => {
        if (mounted) {
          setBranding(response.data || null);
        }
      })
      .catch(() => {
        if (mounted) {
          setBranding(null);
        }
      });

    return () => {
      mounted = false;
    };
  }, [searchParams]);

  useEffect(() => {
    let mounted = true;
    let retryTimer;
    const loadAccounts = async (retry = false) => {
      try {
        const groups = await authService.getDemoAccounts();
        if (!mounted) return;
        if (!Array.isArray(groups)) {
          throw new Error('Instant-login accounts returned an invalid response.');
        }
        setDemoAccounts(groups);
        setDemoAccountsError(groups.some((group) => group.users?.length)
          ? ''
          : 'No active demo accounts were found in the database.');
        sessionStorage.setItem('schoolosInstantAccounts', JSON.stringify(groups));
      } catch (error) {
        if (!mounted) return;
        const status = error?.response?.status;
        const message = error?.response?.data?.message || error?.message;
        setDemoAccountsError(status === 404
          ? 'Instant login is disabled on the server. Enable it for this demo deployment.'
          : message || 'Demo accounts could not be loaded. The server may still be starting.');
        if (status === 404) {
          setDemoAccounts([]);
          sessionStorage.removeItem('schoolosInstantAccounts');
        }
        // Keep the most recent successful list visible while the API reconnects.
        if (retry && status !== 404) retryTimer = window.setTimeout(() => loadAccounts(true), 5000);
      } finally {
        if (mounted) setDemoAccountsLoading(false);
      }
    };
    loadAccounts(true);
    return () => { mounted = false; window.clearTimeout(retryTimer); };
  }, []);

  const featureList = useMemo(
    () => [
      { icon: ShieldCheck, text: 'Role-secure dashboards for all stakeholders' },
      { icon: Building2, text: 'Multi-school architecture for growing institutions' },
      { icon: BookOpen, text: 'Class, section, and subject lifecycle management' },
      { icon: Users, text: 'Indian K-12 workflows with practical scalability' },
    ],
    []
  );

  const filteredDemoAccounts = useMemo(() => {
    const query = demoSearch.trim().toLowerCase();
    return demoAccounts.map((group) => {
      const matches = group.users.filter((user) => {
        if (instantFilters.role && user.role !== instantFilters.role) return false;
        if (instantFilters.school && user.schoolName !== instantFilters.school) return false;
        if (instantFilters.className && user.className !== instantFilters.className) return false;
        if (instantFilters.section && user.sectionName !== instantFilters.section) return false;
        if (!query) return true;
        return [
          user.name,
          user.email,
          user.role,
          user.schoolName,
          user.className,
          user.sectionName,
          user.assignmentPreview,
        ].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
      });
      return {
        ...group,
        totalUsers: group.users.length,
        users: matches,
        matchedUsers: matches.length,
        hiddenUsers: 0,
      };
    });
  }, [demoAccounts, demoSearch, instantFilters]);

  const instantFilterOptions = useMemo(() => {
    const users = demoAccounts.flatMap((group) => group.users);
    const unique = (field) => [...new Set(users.map((user) => user[field]).filter(Boolean))].sort();
    return { roles: unique('role'), schools: unique('schoolName'), classes: unique('className'), sections: unique('sectionName') };
  }, [demoAccounts]);

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

  // Framer Motion Variants for staggered entrance
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
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

  const handleInstantLogin = async (account) => {
    setErrors({});
    setInstantLoginEmail(account.accountKey);

    try {
      const { user } = await authService.instantLogin(account.accountKey);
      toast.success(`Welcome, ${user.name}`);
      redirectByRole(user.role);
    } catch (error) {
      const message = error?.message || 'Instant login failed.';
      setErrors({ submit: message });
      toast.error(message);
    } finally {
      setInstantLoginEmail('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full grid min-h-screen lg:grid-cols-[1.2fr_0.8fr]">
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden p-8 md:p-16 text-white lg:flex lg:flex-col lg:justify-center"
          style={{
            backgroundImage: `linear-gradient(165deg, ${branding?.primaryColor || '#0e7490'} 0%, ${branding?.secondaryColor || '#1e3a8a'} 100%)`,
          }}
        >
          {/* Abstract Background Patterns */}
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
          <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" />

          <div className="relative z-10 max-w-2xl">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 overflow-hidden shadow-2xl shadow-black/20"
            >
              {branding?.logoUrl ? (
                <img src={branding.logoUrl} alt="School logo" className="h-full w-full object-cover" />
              ) : (
                <Sparkles size={26} className="text-cyan-200" />
              )}
            </motion.div>
            
            <motion.h1
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mt-8 text-5xl md:text-6xl font-black tracking-tight"
            >
              {branding?.schoolName || 'SchoolOS'}
            </motion.h1>
            
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-4 text-white/80 text-xl leading-relaxed font-light"
            >
              A modern school operating system for Indian institutions to run academics, people, and outcomes on one platform.
            </motion.p>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="mt-12 grid gap-4"
            >
              {featureList.map((feature) => {
                const Icon = feature.icon;
                return (
                  <motion.div
                    key={feature.text}
                    variants={itemVariants}
                    className="group rounded-2xl bg-white/5 border border-white/10 px-5 py-4 flex items-center gap-4 backdrop-blur-md hover:bg-white/10 hover:border-white/20 transition-all duration-300"
                  >
                    <div className="p-2 rounded-lg bg-white/10 group-hover:bg-white/20 transition-colors">
                      <Icon size={20} className="text-cyan-200" />
                    </div>
                    <p className="text-base md:text-lg font-medium text-white/90">{feature.text}</p>
                  </motion.div>
                );
              })}
            </motion.div>

            {/* Mini Dashboard Mockup */}
            <div className="mt-12 relative">
              <div className="h-48 w-full rounded-2xl border border-white/20 bg-white/5 backdrop-blur-sm p-6 overflow-hidden">
                <div className="flex gap-2 mb-4">
                  <div className="h-3 w-3 rounded-full bg-rose-400/50" />
                  <div className="h-3 w-3 rounded-full bg-amber-400/50" />
                  <div className="h-3 w-3 rounded-full bg-emerald-400/50" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="h-24 rounded-xl bg-white/10 animate-pulse" />
                  <div className="h-24 rounded-xl bg-white/10 animate-pulse delay-75" />
                  <div className="h-24 rounded-xl bg-white/10 animate-pulse delay-150" />
                </div>
              </div>
              <div className="absolute -top-4 -right-4 h-12 w-12 rounded-xl bg-cyan-400/20 blur-xl" />
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="p-6 sm:p-12 lg:p-20 flex items-center"
        >
          <div className="w-full max-w-lg mx-auto relative">
            <div className="relative rounded-3xl bg-white/80 shadow-2xl shadow-slate-200/60 border border-slate-200 backdrop-blur p-8 sm:p-10">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Sign in</h2>
                  <p className="mt-1 text-sm text-slate-500">Use your role account to access the right dashboard.</p>
                </div>
                <div className="hidden sm:flex h-10 w-10 rounded-2xl bg-blue-50 border border-blue-100 items-center justify-center text-blue-700">
                  <ShieldCheck size={18} />
                </div>
              </div>


              {errors.submit && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-6 rounded-xl border border-rose-100 bg-rose-50/50 px-4 py-3 flex items-start gap-3">
                  <AlertCircle size={16} className="text-rose-600 mt-0.5" />
                  <p className="text-sm text-rose-700">{errors.submit}</p>
                </motion.div>
              )}

              <form className="mt-8 space-y-5" onSubmit={handleLogin}>
                <div>
                  <label htmlFor="email" className="text-sm font-medium text-slate-700">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
                    className={`mt-1.5 h-12 w-full rounded-xl border px-4 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                      errors.email ? 'border-rose-300 focus:ring-rose-500' : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/20'
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
                      className={`mt-1.5 h-12 w-full rounded-xl border pl-4 pr-12 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                        errors.password ? 'border-rose-300 focus:ring-rose-500' : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/20'
                      }`}
                      placeholder="Enter password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30 rounded-md"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>

                  </div>
                  {errors.password && <p className="mt-1 text-xs text-rose-600">{errors.password}</p>}
                </div>

                <div className="flex items-center justify-between">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(event) => setRememberMe(event.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="group-hover:text-slate-900 transition-colors">Remember me</span>
                  </label>

                  <button type="button" onClick={() => navigate('/account-recovery')} className="text-sm font-medium text-blue-600 hover:text-blue-700 inline-flex items-center gap-1.5 transition-colors">
                    <KeyRound size={14} />
                    Forgot password
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="h-12 w-full rounded-xl bg-blue-600 text-white text-sm font-bold shadow-lg shadow-blue-500/25 hover:bg-blue-700 hover:shadow-blue-500/40 transform active:scale-[0.98] transition-all disabled:opacity-60 disabled:scale-100 inline-flex items-center justify-center gap-2"
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

              <div className="mt-10">
                <div className="flex flex-col gap-2 mb-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Instant Login</p>
                    <p className="mt-1 text-[11px] text-slate-500">Search by school, class, section, name, or email.</p>
                  </div>
                  <p className="w-fit text-[10px] bg-emerald-50 px-2 py-0.5 rounded-full text-emerald-700 font-medium uppercase">Demo access</p>
                </div>
                <input
                  value={demoSearch}
                  onChange={(event) => setDemoSearch(event.target.value)}
                  placeholder="Search instant accounts..."
                  className="mb-3 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <div className="mb-3 grid grid-cols-2 gap-2">
                  {[['role', 'All roles', instantFilterOptions.roles], ['school', 'All schools', instantFilterOptions.schools], ['className', 'All classes', instantFilterOptions.classes], ['section', 'All sections', instantFilterOptions.sections]].map(([field, placeholder, options]) => (
                    <select key={field} value={instantFilters[field]} onChange={(event) => setInstantFilters((old) => ({ ...old, [field]: event.target.value, ...(field === 'className' ? { section: '' } : {}) }))} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-blue-500">
                      <option value="">{placeholder}</option>{options.map((option) => <option key={option} value={option}>{option.replace(/_/g, ' ')}</option>)}
                    </select>
                  ))}
                </div>
                <div className="mb-3 flex items-center justify-between text-[11px] text-slate-500"><span>{filteredDemoAccounts.reduce((sum, group) => sum + group.matchedUsers, 0)} database users shown</span><button type="button" className="font-semibold text-blue-600" onClick={() => { setDemoSearch(''); setInstantFilters({ role: '', school: '', className: '', section: '' }); }}>Clear filters</button></div>
                <div className="max-h-72 overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50/50 p-2 space-y-3 custom-scrollbar">
                  {demoAccountsLoading && demoAccounts.length === 0 && (
                    <div className="flex items-center justify-center gap-2 rounded-xl bg-white p-5 text-xs font-medium text-slate-500">
                      <Loader size={15} className="animate-spin" />
                      Loading demo users...
                    </div>
                  )}
                  {demoAccountsError && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-800">
                      {demoAccountsError}
                    </div>
                  )}
                  {filteredDemoAccounts.map((group) => (
                    <div key={group.role} className="p-1">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{group.role}</p>
                        <p className="text-[10px] font-bold text-slate-400">
                          {group.matchedUsers}/{group.totalUsers}
                        </p>
                      </div>
                      <div className="space-y-2">
                        {group.users.length === 0 && (
                          <div className="rounded-xl border border-dashed border-slate-200 bg-white/70 p-3 text-[11px] font-medium text-slate-400">
                            No active accounts found in DB.
                          </div>
                        )}
                        {group.users.map((user) => (
                          <div key={user.accountKey || user.email} className="bg-white border border-slate-200/60 rounded-xl p-3 flex items-start justify-between gap-3 shadow-sm hover:border-blue-200 transition-colors">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-800 truncate">{user.name}</p>
                              <p className="text-[11px] text-slate-400 truncate mt-0.5">{user.email}</p>
                              {(user.schoolName || user.assignmentPreview) && (
                                <p className="mt-1 text-[11px] text-slate-500 line-clamp-2">
                                  {user.schoolName}
                                  {user.assignmentPreview ? ` · ${user.assignmentPreview}` : ''}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleInstantLogin(user)}
                              disabled={Boolean(instantLoginEmail)}
                              className="shrink-0 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white text-[11px] font-bold px-3 py-1.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                              aria-label={`Instant login as ${user.name}`}
                            >
                              {instantLoginEmail === user.accountKey ? 'Logging...' : 'Instant Login'}
                            </button>
                          </div>
                        ))}
                        {group.hiddenUsers > 0 && (
                          <div className="rounded-xl border border-dashed border-blue-100 bg-blue-50/60 p-3 text-[11px] font-semibold text-blue-700">
                            {group.hiddenUsers} more accounts hidden. Refine the search to find a specific class, section, student, parent, or teacher.
                          </div>
                        )}
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
