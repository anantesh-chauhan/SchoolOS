import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  BookOpen,
  BookOpenCheck,
  ClipboardCheck,
  CalendarDays,
  ChevronDown,
  Home,
  Layers,
  LayoutGrid,
  Menu,
  Monitor,
  Moon,
  School,
  Settings,
  Shapes,
  Sun,
  Image,
  UserRound,
  Users,
  UsersRound,
  MessageSquare,
  KeyRound,
  BadgeIndianRupee,
  Plus,
  BellRing,
  Briefcase,
  WalletCards,
  Activity,
  Compass,
  GraduationCap,
  ShieldCheck,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authService } from '../services/authService';
import { useBranding } from '../contexts/BrandingContext';
import Sidebar from '../components/Sidebar/Sidebar';
import NotificationCenter from '../components/ui/NotificationCenter';
import DateTimeTopBar from '../components/ui/DateTimeTopBar';
import { useTheme } from '../contexts/ThemeContext';
import ReportIssueButton from '../components/issue-report/ReportIssueButton';
import { filterNavigation } from '../security/permissions';
import GlobalNavigator from '../components/navigation/GlobalNavigator';
import RoleSwitcher from '../components/workspace/RoleSwitcher';
import { buildDashboardNavigation, profileRouteByRole } from '../config/navigation/dashboardNavigation';

const themeOptions = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="inline-flex items-center rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] p-1 shadow-sm">
      {themeOptions.map((option) => {
        const Icon = option.icon;
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setTheme(option.value)}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.97] ${
              active
                ? 'bg-[var(--school-primary)] text-[var(--on-primary)] shadow-sm'
                : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
            }`}
            aria-label={`Use ${option.label.toLowerCase()} theme`}
            title={`${option.label} theme`}
          >
            <Icon size={15} />
          </button>
        );
      })}
    </div>
  );
}

const DashboardLayout = ({ children, role }) => {

  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sidebarCollapsed') === 'true';
    } catch (e) {
      return false;
    }
  });

  const setDesktopCollapsedState = (updater) => {
    setDesktopCollapsed((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
         
      try {
        localStorage.setItem('sidebarCollapsed', next ? 'true' : 'false');
      } catch (e) {
        // ignore
      }
      return next;
    });
  };

  const [profileOpen, setProfileOpen] = useState(false);
  const user = authService.getCurrentUser();
  const { branding } = useBranding();
  let groupedItems = buildDashboardNavigation(role, user);
  const breadcrumb = useMemo(() => {
    const tokens = location.pathname.split('/').filter(Boolean);
    if (tokens.length < 2) {
      return ['Dashboard'];
    }

    return tokens.slice(1).map((token) => token.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await authService.logout();
      toast.success('Logged out successfully');
      navigate('/login');
    } catch (error) {
      toast.error('Logout failed');
    }
  };

  const getRoleColor = (role) => {
    const colors = {
      PLATFORM_OWNER: 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/50 dark:text-fuchsia-200',
      SCHOOL_OWNER: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-200',
      ADMIN: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200',
      CURRICULUM_MANAGER: 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-200',
      FEE_MANAGER: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200',
      HR: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-200',
      TEACHER: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200',
      PARENT: 'bg-pink-50 text-pink-700 dark:bg-pink-950/50 dark:text-pink-200',
      STUDENT: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-200',
      STAFF: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-200',
    };
    return colors[role] || 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200';
  };

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] bg-[var(--background)] text-[var(--text-primary)] transition-colors duration-300">
      <DateTimeTopBar />

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm transition-opacity"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          />
              <div className="absolute left-0 top-0 h-full w-[min(18rem,88vw)] shadow-xl transition-transform duration-300">
                <Sidebar
                  groupedItems={groupedItems}
                  desktopCollapsed={desktopCollapsed}
                  setDesktopCollapsed={setDesktopCollapsedState}
                  user={user}
                  branding={branding}
                  handleLogout={handleLogout}
                  mobile
                  onNavigate={() => setSidebarOpen(false)}
                />
              </div>
        </div>
      )}

      <div className="hidden lg:block">
        <Sidebar
          groupedItems={groupedItems}
          desktopCollapsed={desktopCollapsed}
          setDesktopCollapsed={setDesktopCollapsedState}
          user={user}
          branding={branding}
          handleLogout={handleLogout}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0 pt-6">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border-soft)] bg-[color-mix(in_srgb,var(--surface-elevated)_88%,transparent)] px-3 shadow-[0_1px_0_rgb(var(--school-focus-rgb)/0.08)] backdrop-blur sm:h-16 sm:px-6 transition-colors duration-300">



          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border-soft)] text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] active:scale-[0.97] lg:hidden"
              aria-label="Open sidebar"
              aria-expanded={sidebarOpen}
            >
              <Menu size={18} />
            </button>

            <div className="hidden items-center gap-2 truncate text-sm text-[var(--text-muted)] md:flex">
              {breadcrumb.map((item, index) => (
                <React.Fragment key={item + index}>
                  <span className={index === breadcrumb.length - 1 ? 'font-semibold text-[var(--text-primary)]' : ''}>{item}</span>
                  {index < breadcrumb.length - 1 && <span>/</span>}
                </React.Fragment>
              ))}
            </div>

            <div className="hidden sm:block">
              <GlobalNavigator groups={groupedItems} />
            </div>

          </div>

          <div className="flex items-center gap-1.5 sm:gap-3">
            <RoleSwitcher />
            <ThemeToggle />

            <NotificationCenter enabled={role !== 'PLATFORM_OWNER'} />

            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((prev) => !prev)}
                className="flex h-10 items-center gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-2 shadow-sm transition-all duration-200 hover:bg-[var(--surface-hover)] active:scale-[0.97] focus:border-[var(--school-primary)] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--school-focus-rgb)/0.2)]"
                aria-expanded={profileOpen}
                aria-haspopup="menu"
              >

                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primaryGradient text-xs font-bold text-[var(--on-primary)] shadow-sm">

                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold leading-none text-[var(--text-primary)]">{user?.name || 'User'}</p>
                  <p className={`text-[10px] mt-1 px-1.5 py-0.5 rounded ${getRoleColor(role)}`}>
                    {(role || 'UNKNOWN').replace(/_/g, ' ')}
                  </p>
                </div>
                <ChevronDown size={14} className="hidden text-[var(--text-muted)] min-[390px]:block" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 z-20 mt-2 w-56 animate-slideIn rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] p-2 shadow-xl">

                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      navigate(profileRouteByRole[role] || '/dashboard');
                    }}
                    className="w-full rounded-xl px-3 py-2 text-left text-sm text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--school-focus-rgb)/0.2)]"

                  >
                    My Profile
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full text-left rounded-xl px-3 py-2 text-sm text-red-700 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500/20 dark:text-red-300 dark:hover:bg-red-950/40"

                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto p-3 pb-20 sm:p-6 sm:pb-6">
          <div className="mx-auto w-full max-w-7xl">

            <div className="mb-3 sm:hidden">
              <p className="text-xs text-[var(--text-muted)]">{breadcrumb.join(' / ')}</p>
              <div className="mt-2">
                <GlobalNavigator groups={groupedItems} compact />
              </div>
            </div>

            <div className="space-y-4">
              {children}
            </div>
          </div>

        </main>

        <footer className="hidden border-t border-[var(--border-soft)] bg-[var(--surface-sidebar)] px-4 py-2 text-center text-[11px] text-[var(--text-muted)] sm:block">
          © {new Date().getFullYear()} SchoolOS
        </footer>
        <ReportIssueButton />
      </div>
    </div>

  );
};

DashboardLayout.propTypes = {
  children: PropTypes.node.isRequired,
  role: PropTypes.string,
};

export default DashboardLayout;
