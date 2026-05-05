import React, { useMemo, useState } from 'react';
import {
  Bell,
  BookOpen,
  BookOpenCheck,
  ChevronDown,
  Home,
  Layers,
  LogOut,
  LayoutGrid,
  Menu,
  School,
  Search,
  Settings,
  Shapes,
  Image,
  UserRound,
  Users,
  UsersRound,
  X,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authService } from '../services/authService';
import { useBranding } from '../contexts/BrandingContext';
import Sidebar from '../components/Sidebar/Sidebar';

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
          { label: 'User Accounts', icon: UsersRound, href: '/dashboard/admin/users' },
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
          { label: 'User Accounts', icon: UsersRound, href: '/dashboard/school/users' },

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
        group: 'System',
        icon: Settings,
        items: [
          { label: 'My Profile', icon: UserRound, href: '/dashboard/teacher/profile' },
          { label: 'Dashboard', icon: Home, href: '/dashboard/teacher' },
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
          { label: 'Gallery', icon: Image, href: '/dashboard/gallery' },
          { label: 'Widget Hub', icon: LayoutGrid, href: '/dashboard/widgets' },
        ],
      },
    ],
    STUDENT: [
      {
        group: 'System',
        icon: Settings,
        items: [
          { label: 'My Profile', icon: UserRound, href: '/dashboard/student/profile' },
          { label: 'Dashboard', icon: Home, href: '/dashboard/student' },
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
      PLATFORM_OWNER: 'bg-fuchsia-50 text-fuchsia-700',
      SCHOOL_OWNER: 'bg-sky-50 text-sky-700',
      ADMIN: 'bg-emerald-50 text-emerald-700',
      TEACHER: 'bg-amber-50 text-amber-700',
      PARENT: 'bg-pink-50 text-pink-700',
      STUDENT: 'bg-indigo-50 text-indigo-700',
      STAFF: 'bg-cyan-50 text-cyan-700',
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  const sidePanelClasses = desktopCollapsed ? 'w-20' : 'w-[260px]';

  return (
    <div className="flex h-screen bg-slate-50">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            onClick={() => setSidebarOpen(false)}
          />
              <div className="absolute left-0 top-0 h-full w-72 shadow-xl">
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

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-slate-200 bg-white px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="inline-flex lg:hidden h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-700"
            >
              <Menu size={18} />
            </button>

            <div className="hidden md:flex items-center gap-2 text-sm text-slate-500 truncate">
              {breadcrumb.map((item, index) => (
                <React.Fragment key={item + index}>
                  <span className={index === breadcrumb.length - 1 ? 'text-slate-900 font-semibold' : ''}>{item}</span>
                  {index < breadcrumb.length - 1 && <span>/</span>}
                </React.Fragment>
              ))}
            </div>

            <div className="relative hidden sm:block w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                placeholder="Search classes, sections, subjects..."
                className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button type="button" className="relative h-9 w-9 rounded-lg border border-slate-200 text-slate-600">
              <Bell size={16} className="mx-auto" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500" />
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((prev) => !prev)}
                className="h-9 px-2 rounded-lg border border-slate-200 flex items-center gap-2"
              >
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 text-white text-xs font-bold flex items-center justify-center">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold text-slate-900 leading-none">{user?.name || 'User'}</p>
                  <p className={`text-[10px] mt-1 px-1.5 py-0.5 rounded ${getRoleColor(role)}`}>
                    {(role || 'UNKNOWN').replace(/_/g, ' ')}
                  </p>
                </div>
                <ChevronDown size={14} className="text-slate-500" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-52 rounded-lg border border-slate-200 bg-white shadow-lg p-2 z-20">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      navigate(profileRouteByRole[role] || '/dashboard');
                    }}
                    className="w-full text-left rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    My Profile
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full text-left rounded-md px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-6">
          <div className="mb-4 sm:hidden">
            <p className="text-xs text-slate-500">{breadcrumb.join(' / ')}</p>
            <div className="mt-2 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                placeholder="Search classes, sections, subjects..."
                className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
