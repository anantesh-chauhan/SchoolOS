import { BookOpen, BookOpenCheck, ClipboardCheck, CalendarDays, Home, Layers, LayoutGrid, School, Settings, Shapes, Image, UserRound, Users, UsersRound, MessageSquare, KeyRound, BadgeIndianRupee, Plus, BellRing, Briefcase, WalletCards, Activity, Compass, GraduationCap, ShieldCheck } from 'lucide-react';
import { filterNavigation } from '../../security/permissions';

const navigationSubgroup = (group, label) => {
  const rules = {
    'People & Access': [
      [['Students', 'Student Allocation'], 'Students & parents'],
      [['Teachers', 'Teacher Summary'], 'Teachers'],
      [['User Accounts', 'Login Credentials'], 'Accounts & access'],
    ],
    'Classes & Timetable': [
      [['Classes', 'Sections', 'Subjects'], 'Academic structure'],
      [['Subject Assignment', 'Teacher Assignment', 'Class Teachers'], 'Teaching assignments'],
      [['Weekly Slots', 'Timetable Builder', 'Timetable Audit'], 'Schedule'],
    ],
    'Attendance & Calendar': [
      [['Attendance Dashboard', 'Student Attendance', 'Teacher Attendance', 'Class Attendance', 'My Attendance'], 'Attendance'],
      [['Academic Calendar', 'Attendance Rules', 'Request Correction'], 'Calendar & requests'],
    ],
    'Learning & Resources': [
      [['Homework & Resources', 'My Classes & Subjects'], 'Learning'],
      [['Academic Progress', 'Academic Analytics', 'School Analytics', 'Analytics Settings'], 'Progress & insights'],
    ],
    'Teaching & Resources': [
      [['My Classes & Subjects', 'Homework & Resources'], 'My teaching'],
      [['Student Performance', 'Academic Analytics'], 'Student insights'],
    ],
    'Polls & Feedback': [
      [['Feedback Dashboard', 'Poll Management', 'Assigned Polls', 'Pending & Drafts', 'Pending Polls'], 'Active workflow'],
      [['Submitted Feedback', 'Submitted Polls', 'Student Insights', 'School Feedback Analytics'], 'History & insights'],
    ],
    'Fees & Finance': [
      [['Fee Dashboard', 'Children Fees', 'Family Fee Summary'], 'Overview'],
      [['Fee Masters & Records', 'Create Fee Structure'], 'Setup'],
      [['Collect Fee', 'Reports & Operations'], 'Collection & reports'],
    ],
    System: [
      [['My Profile'], 'Personal'],
      [['Gallery Studio', 'Gallery', 'Widget Hub'], 'School tools'],
    ],
    Account: [
      [['My Profile', 'My HR & Payslips'], 'Personal'],
      [['Gallery', 'Widget Hub'], 'School tools'],
    ],
    Academics: [
      [['My Subjects', 'Homework & Resources'], 'Learning'],
      [['My Performance', 'Academic Analytics'], 'Progress'],
    ],
  };

  return rules[group]?.find(([labels]) => labels.includes(label))?.[1] || '';
};

const organizeNavigation = (groups) => groups.map((group) => ({
  ...group,
  items: group.items.map((item) => ({ ...item, subgroup: item.subgroup || navigationSubgroup(group.group, item.label) })),
}));

export const buildDashboardNavigation = (role, user) => {
  const roleMenuConfig = {
      PRINCIPAL: [
        { group: 'Examinations', icon: GraduationCap, items: [
          { label: 'Approval Dashboard', icon: ShieldCheck, href: '/examinations?view=approvals' },
          { label: 'Published Results', icon: ClipboardCheck, href: '/examinations?view=results' },
          { label: 'Examination Analytics', icon: Activity, href: '/examinations?view=analytics' },
        ] },
      ],
      EXAM_COORDINATOR: [
        { group: 'Examinations', icon: GraduationCap, items: [
          { label: 'Exam Control Centre', icon: GraduationCap, href: '/examinations' },
          { label: 'Approval Queue', icon: ClipboardCheck, href: '/examinations?view=approvals' },
          { label: 'Grade & Rule Setup', icon: Settings, href: '/examinations?view=configuration' },
          { label: 'Result Registers', icon: BookOpenCheck, href: '/examinations?view=results' },
          { label: 'Examination Audit', icon: ShieldCheck, href: '/examinations?view=audit' },
        ] },
        { group: 'Academic setup', icon: BookOpen, items: [
          { label: 'Subject Assignment', icon: BookOpenCheck, href: '/dashboard/admin/subject-assignment' },
          { label: 'Teacher Summary', icon: UsersRound, href: '/dashboard/admin/teacher-assignment-summary' },
        ] },
      ],
      PLATFORM_OWNER: [
        {
          group: 'Overview',
          icon: Home,
          items: [
            { label: 'Dashboard', icon: Home, href: '/dashboard/platform' },
            { label: 'Examination Oversight', icon: GraduationCap, href: '/examinations' },
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
        { group: 'Overview', icon: Home, items: [
          { label: 'Dashboard', icon: Home, href: '/dashboard/school' },
          { label: 'Browse School', icon: Compass, href: '/dashboard/admin/directory' },
        ] },
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
          { label: 'Examinations & Results', icon: GraduationCap, href: '/examinations' },
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
            { label: 'Browse School', icon: Compass, href: '/dashboard/admin/directory' },
          ],
        },
        { group: 'Examinations', icon: GraduationCap, items: [{ label: 'Examinations & Results', icon: GraduationCap, href: '/examinations' }] },
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
        { group: 'Examinations', icon: GraduationCap, items: [{ label: 'Examinations & Results', icon: GraduationCap, href: '/examinations' }] },
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
             { label: 'Create Fee Structure', icon: Plus, href: '/dashboard/fees/structures/new' },
             { label: 'Fee Masters & Transport', icon: Layers, href: '/dashboard/fees/administration' },
             { label: 'Collect Fee', icon: BadgeIndianRupee, href: '/dashboard/fees/collect' },
              { label: 'Closing & Reports', icon: ClipboardCheck, href: '/dashboard/fees/operations' },
               { label: 'My Profile', icon: UserRound, href: '/dashboard/fee-manager/profile' }] },
      ],
      TEACHER: [
        { group: 'Examinations', icon: GraduationCap, items: [{ label: 'Examinations & Results', icon: GraduationCap, href: '/examinations' }] },
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
            { label: 'Class Fee Status', icon: BadgeIndianRupee, href: '/teacher/fees' },
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
        { group: 'Examinations', icon: GraduationCap, items: [{ label: 'Results & Report Cards', icon: GraduationCap, href: '/examinations' }] },
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
        { group: 'Examinations', icon: GraduationCap, items: [{ label: 'Results & Report Cards', icon: GraduationCap, href: '/examinations' }] },
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
  
    roleMenuConfig.EXAM_CONTROLLER = roleMenuConfig.EXAM_COORDINATOR;
    roleMenuConfig.HR_MANAGER = roleMenuConfig.HR;
    roleMenuConfig.CLASS_TEACHER = [
      { group: 'Overview', icon: Home, items: [{ label: 'Dashboard', icon: Home, href: '/dashboard/class-teacher' }] },
      { group: 'My Section', icon: UsersRound, items: [
        { label: 'Students', icon: Users, href: '/teacher/my-class' },
        { label: 'Class Attendance', icon: ClipboardCheck, href: '/teacher/attendance' },
        { label: 'Result Verification', icon: GraduationCap, href: '/examinations' },
      ] },
      { group: 'Account', icon: Settings, items: [
        { label: 'My HR & Payslips', icon: WalletCards, href: '/my/hr' },
        { label: 'Academic Calendar', icon: CalendarDays, href: '/dashboard/calendar' },
      ] },
    ];
    const accessMenu = roleMenuConfig.ADMIN?.find((group) => group.group === 'People & Access');
    if (accessMenu && !accessMenu.items.some((item) => item.href === '/dashboard/admin/roles')) {
      accessMenu.items.push({ label: 'Assigned Responsibilities', icon: ShieldCheck, href: '/dashboard/admin/roles', permission: 'staffing.manage' });
    }
  
    let groupedItems = organizeNavigation((roleMenuConfig[role] || []).map((group) => ({ ...group, items: [...group.items] })));
    if (role !== 'PLATFORM_OWNER' && groupedItems.length && !groupedItems.some(g => g.group === 'Communication')) groupedItems.splice(1, 0, { group:'Communication', icon:MessageSquare, items: role === 'HR' ? [{label:'Notifications',icon:BellRing,href:'/notifications'}] : [{label:'Notifications',icon:BellRing,href:'/notifications'},{label:'Communication Hub',icon:MessageSquare,href:'/communication'}] });
    if (role !== 'PLATFORM_OWNER' && groupedItems.length && !groupedItems.some(g => g.group === 'Support')) groupedItems.push({ group:'Support', icon:MessageSquare, items:[{label:'My Reports',icon:MessageSquare,href:'/support/my-reports'}] });
    groupedItems = filterNavigation(groupedItems, user);
  return groupedItems;
};

export const profileRouteByRole = {
    PLATFORM_OWNER: '/dashboard/platform/profile',
    SCHOOL_OWNER: '/dashboard/school/profile',
    PRINCIPAL: '/examinations',
    EXAM_COORDINATOR: '/examinations',
    EXAM_CONTROLLER: '/examinations',
    ADMIN: '/dashboard/admin/profile',
    TEACHER: '/dashboard/teacher/profile',
    CLASS_TEACHER: '/dashboard/class-teacher',
    HR_MANAGER: '/dashboard/hr',
    PARENT: '/dashboard/parent/profile',
    STUDENT: '/dashboard/student/profile',
    STAFF: '/dashboard/staff/profile',
    CURRICULUM_MANAGER: '/dashboard/curriculum/profile',
    FEE_MANAGER: '/dashboard/fee-manager/profile',
    HR: '/dashboard/hr',
  };
