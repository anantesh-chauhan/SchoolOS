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
  Search,
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
          
  const roleMenuConfig = {
    PLATFORM_OWNER: [
      {
        group: 'Overview',
        icon: Home,
        items: [
          { label: 'Dashboard', icon: Home, href: '/dashboard/platform' },
        ],
      },
      {
        group: 'Tenant Management', icon: School, items: [
          { label: 'School Management', icon: School, href: '/dashboard/platform/schools' },
          { label: 'Branding & Settings', icon: Settings, href: '/dashboard/platform/school-settings' },
          { label: 'Fee Module Analytics', icon: BadgeIndianRupee, href: '/dashboard/platform/fees' },
        ],
      },
      {
        group: 'Platform', icon: Settings,
        items: [
          { label: 'My Profile', icon: UserRound, href: '/dashboard/platform/profile' },
          { label: 'Gallery', icon: Image, href: '/dashboard/gallery' },
          { label: 'Widget Hub', icon: LayoutGrid, href: '/dashboard/widgets' },
        ],
      },
      { group:'Support & Quality', icon:MessageSquare, items:[{label:'Issue Reports',icon:MessageSquare,href:'/platform/issues'},{label:'My Reports',icon:MessageSquare,href:'/support/my-reports'}] },
    ],
    SCHOOL_OWNER: [
      { group: 'Overview', icon: Home, items: [{ label: 'Dashboard', icon: Home, href: '/dashboard/school' }] },
      { group: 'School Identity', icon: Settings, items: [
        { label: 'Theme & Branding', icon: Settings, href: '/dashboard/school/settings' },
      ] },
      { group: 'People & Access', icon: Users, items: [
        { label: 'Students', icon: Users, href: '/dashboard/admin/students/add' },
        { label: 'Student Allocation', icon: UsersRound, href: '/dashboard/admin/students/allocation' },
        { label: 'Teachers', icon: UsersRound, href: '/dashboard/admin/teachers' },
        { label: 'Teacher Summary', icon: BookOpenCheck, href: '/dashboard/admin/teacher-assignment-summary' },
        { label: 'User Accounts', icon: Users, href: '/dashboard/school/users' },
        { label: 'Login Credentials', icon: KeyRound, href: '/dashboard/admin/credentials' },
      ] },
      { group: 'Classes & Timetable', icon: School, items: [
        { label: 'Classes', icon: Layers, href: '/dashboard/admin/classes' },
        { label: 'Sections', icon: Shapes, href: '/dashboard/admin/sections' },
        { label: 'Subjects', icon: BookOpen, href: '/dashboard/admin/subjects' },
        { label: 'Subject Assignment', icon: BookOpenCheck, href: '/dashboard/admin/subject-assignment' },
        { label: 'Teacher Assignment', icon: UsersRound, href: '/dashboard/admin/teacher-assignment' },
        { label: 'Class Teachers', icon: ClipboardCheck, href: '/dashboard/admin/class-teachers' },
        { label: 'Weekly Slots', icon: BookOpenCheck, href: '/dashboard/admin/weekly-slots' },
        { label: 'Timetable Builder', icon: School, href: '/dashboard/admin/timetable-builder' },
        { label: 'Timetable Audit', icon: BookOpenCheck, href: '/dashboard/admin/timetable-reconciliation' },
      ] },
      { group: 'Attendance & Calendar', icon: ClipboardCheck, items: [
        { label: 'Attendance Dashboard', icon: ClipboardCheck, href: '/attendance' },
        { label: 'Student Attendance', icon: Users, href: '/dashboard/admin/attendance/students' },
        { label: 'Teacher Attendance', icon: UsersRound, href: '/dashboard/admin/attendance/teachers' },
        { label: 'Academic Calendar', icon: CalendarDays, href: '/dashboard/admin/attendance/calendar' },
        { label: 'Attendance Rules', icon: Settings, href: '/attendance/settings' },
      ] },
      { group: 'Learning & Resources', icon: BookOpen, items: [
        { label: 'Homework & Resources', icon: BookOpenCheck, href: '/homework' },
        { label: 'Academic Analytics', icon: Activity, href: '/analytics/students' },
        { label: 'School Analytics', icon: Activity, href: '/analytics/school' },
        { label: 'Analytics Settings', icon: Settings, href: '/analytics/configuration' },
      ] },
      { group: 'Polls & Feedback', icon: MessageSquare, items: [
        { label: 'Feedback Dashboard', icon: MessageSquare, href: '/dashboard/admin#chapter-feedback' },
        { label: 'Poll Management', icon: ClipboardCheck, href: '/dashboard/admin#poll-management' },
        { label: 'Student Insights', icon: Users, href: '/analytics/students' },
        { label: 'School Feedback Analytics', icon: Activity, href: '/analytics/school' },
      ] },
      { group: 'Fees & Finance', icon: BadgeIndianRupee, items: [
        { label: 'Fee Dashboard', icon: BadgeIndianRupee, href: '/dashboard/fees' },
        { label: 'Fee Masters & Records', icon: Layers, href: '/dashboard/fees/administration' },
        { label: 'Create Fee Structure', icon: Plus, href: '/dashboard/fees/structures/new' },
        { label: 'Collect Fee', icon: BadgeIndianRupee, href: '/dashboard/fees/collect' },
        { label: 'Reports & Operations', icon: ClipboardCheck, href: '/dashboard/fees/operations' },
      ] },
      {
        group: 'System',
        icon: Settings,
        items: [
          { label: 'My Profile', icon: UserRound, href: '/dashboard/school/profile' },
          { label: 'Gallery Studio', icon: Image, href: '/dashboard/admin/gallery' },
          { label: 'Gallery', icon: Image, href: '/dashboard/gallery' },
          { label: 'Widget Hub', icon: LayoutGrid, href: '/dashboard/widgets' },
        ],
      },
    ],
    ADMIN: [
      { group: 'Overview', icon: Home, items: [
          { label: 'Dashboard', icon: Home, href: '/dashboard/admin' },
        ],
      },
      { group: 'People & Access', icon: Users, items: [
        { label: 'Students', icon: Users, href: '/dashboard/admin/students/add' },
        { label: 'Student Allocation', icon: UsersRound, href: '/dashboard/admin/students/allocation' },
        { label: 'Teachers', icon: UsersRound, href: '/dashboard/admin/teachers' },
        { label: 'Teacher Summary', icon: BookOpenCheck, href: '/dashboard/admin/teacher-assignment-summary' },
        { label: 'User Accounts', icon: Users, href: '/dashboard/admin/users' },
        { label: 'Login Credentials', icon: KeyRound, href: '/dashboard/admin/credentials' },
      ] },
      { group: 'Classes & Timetable', icon: School, items: [
        { label: 'Classes', icon: Layers, href: '/dashboard/admin/classes' },
        { label: 'Sections', icon: Shapes, href: '/dashboard/admin/sections' },
        { label: 'Subjects', icon: BookOpen, href: '/dashboard/admin/subjects' },
        { label: 'Subject Assignment', icon: BookOpenCheck, href: '/dashboard/admin/subject-assignment' },
        { label: 'Teacher Assignment', icon: UsersRound, href: '/dashboard/admin/teacher-assignment' },
        { label: 'Class Teachers', icon: ClipboardCheck, href: '/dashboard/admin/class-teachers' },
        { label: 'Weekly Slots', icon: BookOpenCheck, href: '/dashboard/admin/weekly-slots' },
        { label: 'Timetable Builder', icon: School, href: '/dashboard/admin/timetable-builder' },
        { label: 'Timetable Audit', icon: BookOpenCheck, href: '/dashboard/admin/timetable-reconciliation' },
      ] },
      { group: 'Attendance & Calendar', icon: ClipboardCheck, items: [
        { label: 'Attendance Dashboard', icon: ClipboardCheck, href: '/attendance' },
        { label: 'Student Attendance', icon: Users, href: '/dashboard/admin/attendance/students' },
        { label: 'Teacher Attendance', icon: UsersRound, href: '/dashboard/admin/attendance/teachers' },
        { label: 'Academic Calendar', icon: CalendarDays, href: '/dashboard/admin/attendance/calendar' },
        { label: 'Attendance Rules', icon: Settings, href: '/attendance/settings' },
      ] },
      { group: 'Learning & Resources', icon: BookOpen, items: [
        { label: 'Homework & Resources', icon: BookOpenCheck, href: '/homework' },
        { label: 'Academic Analytics', icon: Activity, href: '/analytics/students' },
        { label: 'School Analytics', icon: Activity, href: '/analytics/school' },
        { label: 'Analytics Settings', icon: Settings, href: '/analytics/configuration' },
      ] },
      { group: 'Polls & Feedback', icon: MessageSquare, items: [
        { label: 'Feedback Dashboard', icon: MessageSquare, href: '/dashboard/admin#chapter-feedback' },
        { label: 'Poll Management', icon: ClipboardCheck, href: '/dashboard/admin#poll-management' },
        { label: 'Student Insights', icon: Users, href: '/analytics/students' },
        { label: 'School Feedback Analytics', icon: Activity, href: '/analytics/school' },
      ] },
      { group: 'Fees & Finance', icon: BadgeIndianRupee, items: [
        { label: 'Fee Dashboard', icon: BadgeIndianRupee, href: '/dashboard/fees' },
        { label: 'Fee Masters & Records', icon: Layers, href: '/dashboard/fees/administration' },
        { label: 'Create Fee Structure', icon: Plus, href: '/dashboard/fees/structures/new' },
        { label: 'Collect Fee', icon: BadgeIndianRupee, href: '/dashboard/fees/collect' },
        { label: 'Reports & Operations', icon: ClipboardCheck, href: '/dashboard/fees/operations' },
      ] },
      {
        group: 'System',
        icon: Settings,
        items: [
          { label: 'My Profile', icon: UserRound, href: '/dashboard/admin/profile' },
          { label: 'Gallery Studio', icon: Image, href: '/dashboard/admin/gallery' },
          { label: 'Gallery', icon: Image, href: '/dashboard/gallery' },
          { label: 'Widget Hub', icon: LayoutGrid, href: '/dashboard/widgets' },
        ],
      },
    ],
    CURRICULUM_MANAGER: [
      { group: 'Overview', icon: Home, items: [
        { label: 'Curriculum Dashboard', icon: Home, href: '/dashboard/curriculum' },
        { label: 'Academic Calendar', icon: CalendarDays, href: '/dashboard/calendar' },
      ] },
      { group: 'Academic Planning', icon: BookOpen, items: [
        { label: 'Books & Chapters', icon: BookOpenCheck, href: '/dashboard/curriculum/manage' },
        { label: 'Weekly Slots', icon: Layers, href: '/dashboard/admin/weekly-slots' },
        { label: 'Homework & Resources', icon: BookOpenCheck, href: '/homework' },
        { label: 'Academic Analytics', icon: Activity, href: '/analytics/students' },
        { label: 'School Analytics', icon: Activity, href: '/analytics/school' },
      ] },
      { group: 'Account', icon: Settings, items: [
        { label: 'My Profile', icon: UserRound, href: '/dashboard/curriculum/profile' },
      ] },
    ],
    HR: [
      { group: 'People Operations', icon: Briefcase, items: [
        { label: 'HR Dashboard', icon: Home, href: '/dashboard/hr' },
        { label: 'Employees', icon: UsersRound, href: '/dashboard/hr' },
        { label: 'Attendance & Leave', icon: ClipboardCheck, href: '/dashboard/hr' },
        { label: 'Monthly Attendance', icon: ClipboardCheck, href: `/attendance/employees/month/${new Date().toISOString().slice(0, 7)}` },
        { label: 'Corrections', icon: ClipboardCheck, href: '/attendance/corrections' },
        { label: 'Payroll & Reports', icon: BadgeIndianRupee, href: '/dashboard/hr' },
      ] },
      { group: 'My Account', icon: UserRound, items: [{ label: 'My HR Profile', icon: UserRound, href: '/my/hr' }] },
    ],
    FEE_MANAGER: [
      { group: 'Fee Operations', icon: BadgeIndianRupee, 
        items: [{ label: 'Fee Dashboard', icon: Home, href: '/dashboard/fees' },
           { label: 'Collect Fee', icon: BadgeIndianRupee, href: '/dashboard/fees/collect' },
            { label: 'Closing & Reports', icon: ClipboardCheck, href: '/dashboard/fees/operations' },
             { label: 'My Profile', icon: UserRound, href: '/dashboard/fee-manager/profile' }] },
    ],
    TEACHER: [
      {
        group: 'Overview', icon: Home,
        items: [
          { label: 'Dashboard', icon: Home, href: '/teacher/dashboard' },
        ],
      },
      { group: 'Teaching & Resources', icon: BookOpen, items: [
          { label: 'My Classes & Subjects', icon: School, href: '/teacher/assignments' },
          { label: 'Homework & Resources', icon: BookOpenCheck, href: '/homework' },
          { label: 'Student Performance', icon: Users, href: '/teacher/performance' },
          { label: 'Academic Analytics', icon: Activity, href: '/analytics/students' },
        ],
      },
      { group: 'Class Management', icon: Users, items: [
          { label: 'My Class', icon: UsersRound, href: '/teacher/my-class' },
        ],
      },
      { group: 'Polls & Feedback', icon: MessageSquare, items: [
          { label: 'Assigned Polls', icon: MessageSquare, href: '/teacher/polls?view=assigned' },
          { label: 'Pending & Drafts', icon: ClipboardCheck, href: '/teacher/polls?view=pending' },
          { label: 'Submitted Feedback', icon: BookOpenCheck, href: '/teacher/polls?view=submitted' },
        ],
      },
      { group: 'Attendance & Calendar', icon: ClipboardCheck, items: [
          { label: 'Class Attendance', icon: ClipboardCheck, href: '/teacher/attendance' },
          { label: 'My Attendance', icon: ClipboardCheck, href: '/dashboard/teacher/my-attendance' },
          { label: 'Request Correction', icon: ClipboardCheck, href: '/attendance/request-correction' },
          { label: 'Academic Calendar', icon: CalendarDays, href: '/dashboard/calendar' },
        ],
      },
      { group: 'Account', icon: Settings, items: [
          { label: 'My HR & Payslips', icon: WalletCards, href: '/my/hr' },
          { label: 'My Profile', icon: UserRound, href: '/dashboard/teacher/profile' },
          { label: 'Gallery', icon: Image, href: '/dashboard/gallery' },
          { label: 'Widget Hub', icon: LayoutGrid, href: '/dashboard/widgets' },
        ],
      },
    ],
    PARENT: [
      { group: 'Overview', icon: Home, items: [{ label: 'Dashboard', icon: Home, href: '/dashboard/parent' }] },
      { group: 'Learning & Resources', icon: BookOpen, items: [
          { label: 'Homework & Resources', icon: BookOpenCheck, href: '/homework' },
          { label: 'Academic Progress', icon: Activity, href: '/analytics/students' },
        ],
      },
      { group: 'Attendance & Calendar', icon: ClipboardCheck, items: [
          { label: 'Attendance', icon: ClipboardCheck, href: '/dashboard/parent/attendance' },
          { label: 'Request Correction', icon: ClipboardCheck, href: '/attendance/request-correction' },
          { label: 'Academic Calendar', icon: CalendarDays, href: '/dashboard/calendar' },
        ],
      },
      { group: 'Fees & Finance', icon: BadgeIndianRupee, items: [
          { label: 'Children Fees', icon: BadgeIndianRupee, href: '/parent/fees' },
          { label: 'Family Fee Summary', icon: BadgeIndianRupee, href: '/parent/fees/family' },
        ],
      },
      {
        group: 'Account',
        icon: Settings,
        items: [
          { label: 'My Profile', icon: UserRound, href: '/dashboard/parent/profile' },
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
          { label: 'My Fees', icon: BadgeIndianRupee, href: '/student/fees' },
        ],
      },
      {
        group: 'Academics', icon: BookOpen, items: [
          { label: 'My Subjects', icon: BookOpen, href: '/student/subjects' },
          { label: 'My Performance', icon: BookOpenCheck, href: '/student/performance' },
          { label: 'Academic Analytics', icon: Activity, href: '/analytics/students' },
          { label: 'Homework & Resources', icon: BookOpenCheck, href: '/homework' },
        ],
      },
      { group: 'Attendance', icon: ClipboardCheck, items: [
          { label: 'Attendance Summary', icon: ClipboardCheck, href: '/student/attendance' },
          { label: 'Request Correction', icon: ClipboardCheck, href: '/attendance/request-correction' },
          { label: 'Academic Calendar', icon: CalendarDays, href: '/dashboard/calendar' },
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
      { group: 'Overview', icon: Home, items: [{ label: 'Dashboard', icon: Home, href: '/dashboard/staff' }] },
      { group: 'Work & Attendance', icon: ClipboardCheck, items: [
          { label: 'My HR & Payslips', icon: WalletCards, href: '/my/hr' },
          { label: 'Attendance Correction', icon: ClipboardCheck, href: '/attendance/request-correction' },
          { label: 'Academic Calendar', icon: CalendarDays, href: '/dashboard/calendar' },
        ],
      },
      { group: 'Account', icon: Settings, items: [
          { label: 'My Profile', icon: UserRound, href: '/dashboard/staff/profile' },
          { label: 'Gallery', icon: Image, href: '/dashboard/gallery' },
          { label: 'Widget Hub', icon: LayoutGrid, href: '/dashboard/widgets' },
        ],
      },
    ],
  };

  let groupedItems = (roleMenuConfig[role] || []).map((group) => ({ ...group, items: [...group.items] }));
  if (role !== 'PLATFORM_OWNER' && groupedItems.length && !groupedItems.some(g => g.group === 'Communication')) groupedItems.splice(1, 0, { group:'Communication', icon:MessageSquare, items: role === 'HR' ? [{label:'Notifications',icon:BellRing,href:'/notifications'}] : [{label:'Notifications',icon:BellRing,href:'/notifications'},{label:'Communication Hub',icon:MessageSquare,href:'/communication'}] });
  if (role !== 'PLATFORM_OWNER' && groupedItems.length && !groupedItems.some(g => g.group === 'Support')) groupedItems.push({ group:'Support', icon:MessageSquare, items:[{label:'My Reports',icon:MessageSquare,href:'/support/my-reports'}] });
  groupedItems = filterNavigation(groupedItems, user);
  const profileRouteByRole = {
    PLATFORM_OWNER: '/dashboard/platform/profile',
    SCHOOL_OWNER: '/dashboard/school/profile',
    ADMIN: '/dashboard/admin/profile',
    TEACHER: '/dashboard/teacher/profile',
    PARENT: '/dashboard/parent/profile',
    STUDENT: '/dashboard/student/profile',
    STAFF: '/dashboard/staff/profile',
    CURRICULUM_MANAGER: '/dashboard/curriculum/profile',
    FEE_MANAGER: '/dashboard/fee-manager/profile',
    HR: '/dashboard/hr',
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

            <div className="relative hidden sm:block w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                placeholder="Search classes, sections, subjects..."
                className="h-10 w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-base)] pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] shadow-sm transition-colors focus:border-[var(--school-primary)] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--school-focus-rgb)/0.2)]"
              />
            </div>

          </div>

          <div className="flex items-center gap-1.5 sm:gap-3">
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
              <div className="mt-2 relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  placeholder="Search classes, sections, subjects..."
                  className="h-10 w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-base)] pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] shadow-sm transition-colors focus:border-[var(--school-primary)] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--school-focus-rgb)/0.2)]"
                />
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
