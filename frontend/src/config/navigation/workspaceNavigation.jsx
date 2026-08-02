import {
  BarChart3, BookOpen, Building2, GraduationCap, Home, Megaphone,
  Settings, UserRoundCog, UsersRound, WalletCards,
} from 'lucide-react';

export const WORKSPACE_META = {
  home: { id: 'home', label: 'Home', description: 'Your work, shortcuts, and recent activity', icon: Home, accent: 'from-slate-700 to-slate-950' },
  teaching: { id: 'teaching', label: 'Teaching', description: 'Classes, attendance, homework, resources, and timetable', icon: BookOpen, accent: 'from-blue-600 to-indigo-700' },
  students: { id: 'students', label: 'Students', description: 'Admissions, records, attendance, parents, and progress', icon: GraduationCap, accent: 'from-cyan-600 to-blue-700' },
  finance: { id: 'finance', label: 'Finance', description: 'Collection, dues, receipts, structures, and reports', icon: WalletCards, accent: 'from-emerald-600 to-teal-700' },
  examinations: { id: 'examinations', label: 'Examination', description: 'Schedules, marks, verification, publication, and results', icon: UserRoundCog, accent: 'from-violet-600 to-purple-800' },
  communication: { id: 'communication', label: 'Communication', description: 'Announcements, messages, notices, feedback, and gallery', icon: Megaphone, accent: 'from-rose-500 to-orange-600' },
  analytics: { id: 'analytics', label: 'Analytics', description: 'Academic, operational, finance, and school insights', icon: BarChart3, accent: 'from-amber-500 to-orange-700' },
  administration: { id: 'administration', label: 'Administration', description: 'Users, roles, settings, security, and school structure', icon: Settings, accent: 'from-slate-600 to-slate-800' },
  staff: { id: 'staff', label: 'Staff', description: 'Teachers, assignments, HR, attendance, and payroll', icon: UsersRound, accent: 'from-fuchsia-600 to-purple-800' },
  platform: { id: 'platform', label: 'Schools', description: 'Tenants, platform settings, support, and oversight', icon: Building2, accent: 'from-fuchsia-700 to-indigo-800' },
};

const ORDER = ['teaching', 'students', 'finance', 'examinations', 'communication', 'analytics', 'staff', 'administration', 'platform'];

const ROLE_WORKSPACES = {
  PLATFORM_OWNER: ['platform', 'analytics', 'finance', 'administration'],
  SCHOOL_OWNER: ['teaching', 'students', 'finance', 'examinations', 'communication', 'analytics', 'staff', 'administration'],
  ADMIN: ['teaching', 'students', 'finance', 'examinations', 'communication', 'analytics', 'staff', 'administration'],
  CURRICULUM_MANAGER: ['teaching'],
  FEE_MANAGER: ['finance'],
  EXAM_COORDINATOR: ['examinations'], EXAM_CONTROLLER: ['examinations'], PRINCIPAL: ['examinations', 'analytics'],
  TEACHER: ['teaching', 'students', 'communication'],
  CLASS_TEACHER: ['students', 'finance', 'examinations', 'communication'],
  HR: ['staff'], HR_MANAGER: ['staff'], STAFF: ['staff', 'communication'],
  STUDENT: ['teaching', 'students', 'examinations', 'finance', 'communication'],
  PARENT: ['students', 'teaching', 'examinations', 'finance', 'communication'],
};

const ROLE_LABELS = {
  TEACHER: { teaching: 'My Teaching', students: 'My Students' },
  CLASS_TEACHER: { students: 'My Class', finance: 'Class Fees', examinations: 'Class Results' },
  CURRICULUM_MANAGER: { teaching: 'Curriculum' },
  STUDENT: { teaching: 'My Learning', students: 'My Attendance', examinations: 'My Results', finance: 'My Fees' },
  PARENT: { students: 'My Child', teaching: 'Homework', examinations: 'Results', finance: 'Fees' },
  SCHOOL_OWNER: { teaching: 'Academic' }, ADMIN: { teaching: 'Academic' },
};

const destinationsFor = (group, item, role) => {
  const text = `${group.group} ${item.label} ${item.subgroup || ''} ${item.href}`.toLowerCase();
  const destinations = new Set();

  if (/platform|tenant|school management|issue reports/.test(text) && role === 'PLATFORM_OWNER') destinations.add('platform');
  if (/fee|finance|receipt|dues|collection|refund|transport/.test(text)) destinations.add('finance');
  if (/examination|exam|marks|result|grade/.test(text)) destinations.add('examinations');
  if (/communication|notification|message|poll|feedback|gallery|notice/.test(text)) destinations.add('communication');
  if (/analytics|insight|performance/.test(text)) destinations.add('analytics');
  if (/teacher|staff|employee|hr|payslip|class teachers|assignment summary/.test(text) && !/student performance|teacher\/assignments/.test(text)) destinations.add('staff');
  if (/student|admission|allocation|parent|my class/.test(text) && !/student performance/.test(text)) destinations.add('students');
  if (['TEACHER', 'CLASS_TEACHER'].includes(role) && /student performance/.test(text)) destinations.add('students');
  if (/teaching|homework|resource|curriculum|my subject|my classes|timetable|weekly slot|academic calendar|class attendance|teacher\/attendance|chapter|books/.test(text)) destinations.add('teaching');
  if (role === 'CLASS_TEACHER' && /academic calendar/.test(text)) destinations.add('students');
  if (/academic analytics|student performance|school analytics|class intelligence/.test(text)) destinations.add('analytics');
  if (['STUDENT', 'PARENT'].includes(role) && /my performance|academic analytics|academic progress/.test(text)) destinations.add('examinations');
  if (/attendance dashboard|student attendance|attendance summary/.test(text)) destinations.add('students');
  if (/user|role|permission|credential|setting|security|branding|classes|sections|subjects|academic structure|widget|support|directory/.test(text)) destinations.add('administration');

  if (!destinations.size) destinations.add(role === 'PLATFORM_OWNER' ? 'platform' : 'administration');
  return [...destinations];
};

const uniqueItems = (items) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.href}|${item.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const buildWorkspaceNavigation = (groups, role) => {
  const allowed = new Set(ROLE_WORKSPACES[role] || []);
  const buckets = new Map(ORDER.map((id) => [id, []]));
  groups.forEach((group) => group.items.forEach((item) => {
    destinationsFor(group, item, role).forEach((id) => buckets.get(id)?.push({ ...item, sourceGroup: group.group }));
  }));

  const workspaces = ORDER.filter((id) => allowed.has(id)).map((id) => {
    const items = uniqueItems(buckets.get(id));
    return items.length ? { ...WORKSPACE_META[id], label: ROLE_LABELS[role]?.[id] || WORKSPACE_META[id].label, items, href: `/workspace/${id}` } : null;
  }).filter(Boolean);

  return [{ ...WORKSPACE_META.home, href: '/workspace/home', items: [] }, ...workspaces];
};

export const findWorkspaceForPath = (workspaces, pathname, preferredId) => {
  if (pathname === '/workspace/home') return workspaces[0];
  const workspaceRoute = pathname.match(/^\/workspace\/([^/]+)\/?$/);
  if (workspaceRoute) return workspaces.find((workspace) => workspace.id === workspaceRoute[1]) || workspaces[0];
  const candidates = workspaces.filter((workspace) => workspace.items.some((item) => {
    const path = item.href.split(/[?#]/)[0];
    return pathname === path || (path !== '/' && pathname.startsWith(`${path}/`));
  }));
  return candidates.find((workspace) => workspace.id === preferredId) || candidates[0] || workspaces[0];
};

export const mergeRoleWorkspaces = (entries, activeRole) => {
  const merged = new Map();
  entries.forEach(({ assignment, workspaces }) => workspaces.filter((item) => item.id !== 'home').forEach((workspace) => {
    const source = { role: assignment.role, assignmentId: assignment.assignmentId, href: workspace.href };
    const existing = merged.get(workspace.id);
    if (!existing) merged.set(workspace.id, { ...workspace, sources: [source], pendingCount: Number(assignment.pendingTasks || 0) });
    else {
      existing.sources.push(source);
      existing.pendingCount += Number(assignment.pendingTasks || 0);
      if (assignment.role === activeRole) Object.assign(existing, { label: workspace.label, description: workspace.description, href: workspace.href });
    }
  }));
  return [{ ...WORKSPACE_META.home, href: '/workspace/home', items: [], sources: [] }, ...merged.values()];
};
