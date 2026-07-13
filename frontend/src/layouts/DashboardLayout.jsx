import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  BookOpenCheck,
  ClipboardCheck,
  ChevronDown,
  Home,
  Layers,
  LogOut,
  LayoutGrid,
  Menu,
  Monitor,
  Moon,
  School,
  Search,
  Settings,
  Shapes,
  Sun,
  Image,
  UserRound,
  Users,
  UsersRound,
  X,
  MessageSquare,
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


const themeOptions = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white/80 p-1 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
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
                ? 'bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-950'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
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
          
  const roleMenuConfig = {
    PLATFORM_OWNER: [
      {
        group: 'System',
        icon: Settings,
        items: [
          { label: 'My Profile', icon: UserRound, href: '/dashboard/platform/profile' },
          { label: 'Dashboard', icon: Home, href: '/dashboard/platform' },
          { label: 'School Management', icon: School, href: '/dashboard/platform/schools' },
          { label: 'School Settings', icon: Settings, href: '/dashboard/platform/school-settings' },
        ],
      },
      {
        group: 'Experience',
        icon: Image,
        items: [
          { label: 'Gallery', icon: Image, href: '/dashboard/gallery' },
          { label: 'Widget Hub', icon: LayoutGrid, href: '/dashboard/widgets' },
        ],
      },
      { group:'Support & Quality', icon:MessageSquare, items:[{label:'Issue Reports',icon:MessageSquare,href:'/platform/issues'},{label:'My Reports',icon:MessageSquare,href:'/support/my-reports'}] },
    ],
    SCHOOL_OWNER: [
      {
        group: 'Academic Setup',
        icon: BookOpen,
        items: [
          { label: 'Dashboard', icon: Home, href: '/dashboard/school' },
          { label: 'Classes', icon: Layers, href: '/dashboard/admin/classes' },
          { label: 'Sections', icon: Shapes, href: '/dashboard/admin/sections' },
          { label: 'Subjects', icon: BookOpen, href: '/dashboard/admin/subjects' },
          { label: 'Subject Assignment', icon: BookOpenCheck, href: '/dashboard/admin/subject-assignment' },
          { label: 'Teacher Assignment', icon: UsersRound, href: '/dashboard/admin/teacher-assignment' },
          { label: 'Class Teachers', icon: ClipboardCheck, href: '/dashboard/admin/class-teachers' },
          { label: 'Weekly Slots', icon: BookOpenCheck, href: '/dashboard/admin/weekly-slots' },
          { label: 'Timetable Builder', icon: School, href: '/dashboard/admin/timetable-builder' },
          { label: 'Timetable Audit', icon: BookOpenCheck, href: '/dashboard/admin/timetable-reconciliation' },
        ],
      },
      {
        group: 'School Management',
        icon: Users,
        items: [
          { label: 'Students', icon: Users, href: '/dashboard/school' },
          { label: 'Add Student', icon: Users, href: '/dashboard/admin/students/add' },
          { label: 'Teachers', icon: UsersRound, href: '/dashboard/admin/teachers' },
          { label: 'Parents', icon: UserRound, href: '/dashboard/school' },
          { label: 'Teacher Summary', icon: BookOpenCheck, href: '/dashboard/admin/teacher-assignment-summary' },
          { label: 'Student Attendance', icon: ClipboardCheck, href: '/dashboard/admin/attendance/students' },
          { label: 'Teacher Attendance', icon: ClipboardCheck, href: '/dashboard/admin/attendance/teachers' },
          { label: 'Academic Calendar', icon: ClipboardCheck, href: '/dashboard/admin/attendance/calendar' },
        ],
      },
      {
        group: 'System',
        icon: Settings,
        items: [
          { label: 'My Profile', icon: UserRound, href: '/dashboard/school/profile' },
          { label: 'Gallery Studio', icon: Image, href: '/dashboard/admin/gallery' },
          { label: 'Gallery', icon: Image, href: '/dashboard/gallery' },
          { label: 'Widget Hub', icon: LayoutGrid, href: '/dashboard/widgets' },
          { label: 'School Profile', icon: Settings, href: '/dashboard/school/profile' },
        ],
      },
    ],
    ADMIN: [
      {
        group: 'Academic Setup',
        icon: BookOpen,
        items: [
          { label: 'Dashboard', icon: Home, href: '/dashboard/admin' },
          { label: 'Classes', icon: Layers, href: '/dashboard/admin/classes' },
          { label: 'Sections', icon: Shapes, href: '/dashboard/admin/sections' },
          { label: 'Subjects', icon: BookOpen, href: '/dashboard/admin/subjects' },
          { label: 'Subject Assignment', icon: BookOpenCheck, href: '/dashboard/admin/subject-assignment' },
          { label: 'Teacher Assignment', icon: UsersRound, href: '/dashboard/admin/teacher-assignment' },
          { label: 'Class Teachers', icon: ClipboardCheck, href: '/dashboard/admin/class-teachers' },
          { label: 'Weekly Slots', icon: BookOpenCheck, href: '/dashboard/admin/weekly-slots' },
          { label: 'Timetable Builder', icon: School, href: '/dashboard/admin/timetable-builder' },
          { label: 'Timetable Audit', icon: BookOpenCheck, href: '/dashboard/admin/timetable-reconciliation' },
        ],
      },
      {
        group: 'School Management',
        icon: Users,
        items: [
          { label: 'Students', icon: Users, href: '/dashboard/admin' },
          { label: 'Add Student', icon: Users, href: '/dashboard/admin/students/add' },
          { label: 'Teachers', icon: UsersRound, href: '/dashboard/admin/teachers' },
          { label: 'Parents', icon: UserRound, href: '/dashboard/admin' },
          { label: 'Teacher Summary', icon: BookOpenCheck, href: '/dashboard/admin/teacher-assignment-summary' },
          { label: 'Student Attendance', icon: ClipboardCheck, href: '/dashboard/admin/attendance/students' },
          { label: 'Teacher Attendance', icon: ClipboardCheck, href: '/dashboard/admin/attendance/teachers' },
          { label: 'Academic Calendar', icon: ClipboardCheck, href: '/dashboard/admin/attendance/calendar' },
        ],
      },
      {
        group: 'System',
        icon: Settings,
        items: [
          { label: 'My Profile', icon: UserRound, href: '/dashboard/admin/profile' },
          { label: 'Gallery Studio', icon: Image, href: '/dashboard/admin/gallery' },
          { label: 'Gallery', icon: Image, href: '/dashboard/gallery' },
          { label: 'Widget Hub', icon: LayoutGrid, href: '/dashboard/widgets' },
          { label: 'Settings', icon: Settings, href: '/dashboard/admin' },
        ],
      },
    ],
    TEACHER: [
      {
        group: 'Overview', icon: Home,
        items: [
          { label: 'Dashboard', icon: Home, href: '/teacher/dashboard' },
        ],
      },
      { group: 'Teaching', icon: BookOpen, items: [
          { label: 'My Classes & Subjects', icon: School, href: '/teacher/assignments' },
          { label: 'Poll Management', icon: MessageSquare, href: '/teacher/polls' },
          { label: 'Student Performance', icon: Users, href: '/teacher/performance' },
        ],
      },
      { group: 'Class Management', icon: Users, items: [
          { label: 'My Class', icon: UsersRound, href: '/teacher/my-class' },
          { label: 'Class Attendance', icon: ClipboardCheck, href: '/teacher/attendance' },
          { label: 'My Attendance', icon: ClipboardCheck, href: '/dashboard/teacher/my-attendance' },
        ],
      },
      { group: 'Account', icon: Settings, items: [
          { label: 'My Profile', icon: UserRound, href: '/dashboard/teacher/profile' },
          { label: 'Gallery', icon: Image, href: '/dashboard/gallery' },
          { label: 'Widget Hub', icon: LayoutGrid, href: '/dashboard/widgets' },
        ],
      },
    ],
    PARENT: [
      {
        group: 'System',
        icon: Settings,
        items: [
          { label: 'My Profile', icon: UserRound, href: '/dashboard/parent/profile' },
          { label: 'Dashboard', icon: Home, href: '/dashboard/parent' },
          { label: 'Attendance', icon: ClipboardCheck, href: '/dashboard/parent/attendance' },
          { label: 'Gallery', icon: Image, href: '/dashboard/gallery' },
          { label: 'Widget Hub', icon: LayoutGrid, href: '/dashboard/widgets' },
        ],
      },
    ],
    STUDENT: [
      {
        group: 'Overview',
        icon: Home,
        items: [
          { label: 'Dashboard', icon: Home, href: '/student/dashboard' },
        ],
      },
      {
        group: 'Academics', icon: BookOpen, items: [
          { label: 'My Subjects', icon: BookOpen, href: '/student/subjects' },
          { label: 'My Performance', icon: BookOpenCheck, href: '/student/performance' },
        ],
      },
      { group: 'Attendance', icon: ClipboardCheck, items: [
          { label: 'Attendance Summary', icon: ClipboardCheck, href: '/student/attendance' },
        ],
      },
      { group: 'Polls & Feedback', icon: MessageSquare, items: [
          { label: 'Pending Polls', icon: MessageSquare, href: '/student/polls/pending' },
          { label: 'Submitted Polls', icon: BookOpenCheck, href: '/student/polls/submitted' },
        ],
      },
      { group: 'Account', icon: Settings, items: [
          { label: 'My Profile', icon: UserRound, href: '/dashboard/student/profile' },
          { label: 'Gallery', icon: Image, href: '/dashboard/gallery' },
          { label: 'Widget Hub', icon: LayoutGrid, href: '/dashboard/widgets' },
        ],
      },
    ],
    STAFF: [
      {
        group: 'System',
        icon: Settings,
        items: [
          { label: 'My Profile', icon: UserRound, href: '/dashboard/staff/profile' },
          { label: 'Dashboard', icon: Home, href: '/dashboard/staff' },
          { label: 'Gallery', icon: Image, href: '/dashboard/gallery' },
          { label: 'Widget Hub', icon: LayoutGrid, href: '/dashboard/widgets' },
        ],
      },
    ],
  };

  const groupedItems = roleMenuConfig[role] || [];
  if (role !== 'PLATFORM_OWNER' && groupedItems.length && !groupedItems.some(g => g.group === 'Support')) groupedItems.push({ group:'Support', icon:MessageSquare, items:[{label:'My Reports',icon:MessageSquare,href:'/support/my-reports'}] });
  const profileRouteByRole = {
    PLATFORM_OWNER: '/dashboard/platform/profile',
    SCHOOL_OWNER: '/dashboard/school/profile',
    ADMIN: '/dashboard/admin/profile',
    TEACHER: '/dashboard/teacher/profile',
    PARENT: '/dashboard/parent/profile',
    STUDENT: '/dashboard/student/profile',
    STAFF: '/dashboard/staff/profile',
  };

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
      TEACHER: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200',
      PARENT: 'bg-pink-50 text-pink-700 dark:bg-pink-950/50 dark:text-pink-200',
      STUDENT: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-200',
      STAFF: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-200',
    };
    return colors[role] || 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200';
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-950 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100">
      <DateTimeTopBar />

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm transition-opacity"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          />
              <div className="absolute left-0 top-0 h-full w-72 shadow-xl transition-transform duration-300">
                <Sidebar
                  groupedItems={groupedItems}
                  desktopCollapsed={desktopCollapsed}
                  setDesktopCollapsed={setDesktopCollapsedState}
                  user={user}
                  branding={branding}
                  handleLogout={handleLogout}
                  mobile
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
        <header className="h-16 border-b border-slate-200/70 bg-white/75 px-4 backdrop-blur supports-[backdrop-filter]:bg-white/65 sm:px-6 flex items-center justify-between transition-colors duration-300 dark:border-slate-800 dark:bg-slate-950/75 dark:supports-[backdrop-filter]:bg-slate-950/65">



          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="inline-flex lg:hidden h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-700 transition hover:bg-slate-100 active:scale-[0.97] dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900"
              aria-label="Open sidebar"
            >
              <Menu size={18} />
            </button>

            <div className="hidden md:flex items-center gap-2 text-sm text-slate-500 truncate dark:text-slate-400">
              {breadcrumb.map((item, index) => (
                <React.Fragment key={item + index}>
                  <span className={index === breadcrumb.length - 1 ? 'text-slate-900 font-semibold dark:text-slate-100' : ''}>{item}</span>
                  {index < breadcrumb.length - 1 && <span>/</span>}
                </React.Fragment>
              ))}
            </div>

            <div className="relative hidden sm:block w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                placeholder="Search classes, sections, subjects..."
                className="h-10 w-full rounded-2xl border border-slate-200 bg-white/80 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm backdrop-blur transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>

          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />

            <NotificationCenter enabled={role !== 'PLATFORM_OWNER'} />

            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((prev) => !prev)}
                className="h-10 px-2 rounded-2xl border border-slate-200 flex items-center gap-2 bg-white/80 shadow-sm hover:bg-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 dark:border-slate-800 dark:bg-slate-900/80 dark:hover:bg-slate-900"
              >

                  <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 text-white text-xs font-bold flex items-center justify-center shadow-sm">

                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold text-slate-900 leading-none dark:text-slate-100">{user?.name || 'User'}</p>
                  <p className={`text-[10px] mt-1 px-1.5 py-0.5 rounded ${getRoleColor(role)}`}>
                    {(role || 'UNKNOWN').replace(/_/g, ' ')}
                  </p>
                </div>
                <ChevronDown size={14} className="text-slate-500 dark:text-slate-400" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur shadow-xl p-2 z-20 animate-slideIn dark:border-slate-800 dark:bg-slate-900/95">

                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      navigate(profileRouteByRole[role] || '/dashboard');
                    }}
                    className="w-full text-left rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:text-slate-200 dark:hover:bg-slate-800"

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

        <main className="flex-1 overflow-auto p-4 sm:p-6">
          <div className="mx-auto w-full max-w-7xl">

            <div className="mb-4 sm:hidden">
              <p className="text-xs text-slate-500 dark:text-slate-400">{breadcrumb.join(' / ')}</p>
              <div className="mt-2 relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  placeholder="Search classes, sections, subjects..."
                  className="h-10 w-full rounded-2xl border border-slate-200 bg-white/80 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm backdrop-blur transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="space-y-4">
              {children}
            </div>
          </div>

        </main>

        <footer className="border-t border-slate-200/70 bg-white/60 px-4 py-2 text-center text-[11px] text-slate-500 backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/40 dark:text-slate-400">
          © {new Date().getFullYear()} SchoolOS
        </footer>
        <ReportIssueButton />
      </div>
    </div>

  );
};

export default DashboardLayout;
