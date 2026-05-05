import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BadgeCheck,
  BookOpen,
  CalendarDays,
  AlertCircle,
  GraduationCap,
  Image as ImageIcon,
  KeyRound,
  Layers3,
  Mail,
  MapPin,
  Phone,
  School,
  Shield,
  User,
} from 'lucide-react';
import toast from 'react-hot-toast';
import DashboardLayout from '../../layouts/DashboardLayout';
import profileService from '../../services/profileService';

const roleMeta = {
  PLATFORM_OWNER: {
    title: 'Platform Owner Profile',
    subtitle: 'Central platform identity, access, and cross-school oversight.',
    accent: 'from-fuchsia-600 via-pink-600 to-rose-600',
  },
  SCHOOL_OWNER: {
    title: 'School Owner Profile',
    subtitle: 'School administration identity and the linked institution record.',
    accent: 'from-sky-600 via-cyan-600 to-teal-600',
  },
  ADMIN: {
    title: 'Admin Profile',
    subtitle: 'Administrative identity and academic assignment overview.',
    accent: 'from-emerald-600 via-lime-600 to-green-600',
  },
  TEACHER: {
    title: 'Teacher Profile',
    subtitle: 'Teaching account details with class and section assignment.',
    accent: 'from-amber-600 via-orange-600 to-rose-600',
  },
  PARENT: {
    title: 'Parent Profile',
    subtitle: 'Parent account identity with linked student academic context.',
    accent: 'from-rose-600 via-pink-600 to-fuchsia-600',
  },
  STUDENT: {
    title: 'Student Profile',
    subtitle: 'Student identity, class placement, and admission details.',
    accent: 'from-indigo-600 via-violet-600 to-blue-600',
  },
  STAFF: {
    title: 'Staff Profile',
    subtitle: 'Staff account information and linked academic assignment.',
    accent: 'from-cyan-600 via-sky-600 to-blue-600',
  },
};

const fieldClassName = 'w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

const prettyDate = (value) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const initialsFromName = (name) => {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
};

const InfoRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
    <div className="mt-0.5 rounded-xl bg-white p-2 text-slate-600 shadow-sm">
      <Icon size={16} />
    </div>
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-slate-900">{value || 'Not available'}</p>
    </div>
  </div>
);

InfoRow.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.node,
};

InfoRow.defaultProps = {
  value: null,
};

const ProfilePage = ({ role }) => {
  const queryClient = useQueryClient();
  const meta = roleMeta[role] || roleMeta.STUDENT;
  const [form, setForm] = useState({ firstName: '', lastName: '', alternateMobile: '', profileImage: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  const profileQuery = useQuery({
    queryKey: ['my-profile'],
    queryFn: profileService.getMyProfile,
  });

  const profile = profileQuery.data?.data;

  useEffect(() => {
    if (!profile) return;
    setForm({
      firstName: profile.firstName || (profile.name || '').split(' ')[0] || '',
      lastName: profile.lastName || (profile.name || '').split(' ').slice(1).join(' ') || '',
      alternateMobile: profile.alternateMobile || '',
      profileImage: profile.profileImage || '',
    });
  }, [profile]);

  const saveMutation = useMutation({
    mutationFn: profileService.updateMyProfile,
    onSuccess: () => {
      toast.success('Profile updated');
      queryClient.invalidateQueries({ queryKey: ['my-profile'] });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to update profile'),
  });

  const passwordMutation = useMutation({
    mutationFn: profileService.changePassword,
    onSuccess: () => {
      toast.success('Password changed');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to change password'),
  });

  const schoolInfo = profile?.school;
  const personalDetails = useMemo(() => {
    if (!profile) return [];

    const rows = [
      { label: 'First Name', value: profile.firstName },
      { label: 'Last Name', value: profile.lastName },
      { label: 'Email', value: profile.email },
      { label: 'Mobile', value: profile.mobile || profile.phone || profile.alternateMobile },
      { label: 'Date of Birth', value: prettyDate(profile.dob) },
      { label: 'Gender', value: profile.gender },
      { label: 'Address', value: profile.address },
      { label: 'City', value: profile.city },
      { label: 'State', value: profile.state },
      { label: 'Pincode', value: profile.pincode },
    ];

    if (profile.role === 'STUDENT' || profile.role === 'PARENT') {
      rows.push(
        { label: 'Admission No', value: profile.admissionNo },
        { label: 'Class', value: profile.className },
        { label: 'Section', value: profile.section },
        { label: 'Roll Number', value: profile.rollNumber },
        { label: 'Session', value: profile.session },
        { label: 'Father Name', value: profile.fatherName },
        { label: 'Mother Name', value: profile.motherName },
        { label: 'Parent Mobile', value: profile.parentMobile },
        { label: 'Alternate Mobile', value: profile.alternateMobile },
        { label: 'Parent Email', value: profile.parentEmail },
        { label: 'Occupation', value: profile.occupation },
        { label: 'Student User ID', value: profile.studentUserId },
        { label: 'Parent User ID', value: profile.parentUserId },
      );
    }

    if (profile.role === 'TEACHER') {
      rows.push(
        { label: 'Employee ID', value: profile.employeeId },
        { label: 'Phone', value: profile.phone },
        { label: 'Qualification', value: profile.qualification },
        { label: 'Specialization', value: profile.specialization },
        { label: 'Subjects Handled', value: Array.isArray(profile.subjectsHandled) ? profile.subjectsHandled.join(', ') : profile.subjectsHandled },
      );
    }

    return rows.filter((row) => row.value);
  }, [profile]);

  const academicInfo = useMemo(() => {
    const items = [];
    if (profile?.class?.className) {
      items.push({ label: 'Class', value: profile.class.className });
    }
    if (profile?.section?.sectionName) {
      items.push({ label: 'Section', value: profile.section.sectionName });
    }
    if (profile?.school?.schoolName) {
      items.push({ label: 'School', value: profile.school.schoolName });
    }
    if (profile?.schoolId) {
      items.push({ label: 'School ID', value: profile.schoolId });
    }
    return items;
  }, [profile]);

  const onSave = (event) => {
    event.preventDefault();
    saveMutation.mutate({
      firstName: form.firstName,
      lastName: form.lastName,
      alternateMobile: form.alternateMobile,
      profileImage: form.profileImage,
    });
  };

  const onPasswordSubmit = (event) => {
    event.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New password and confirmation do not match');
      return;
    }

    passwordMutation.mutate({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    });
  };

  return (
    <DashboardLayout role={role}>
      <div className="space-y-6">
        <section className={`overflow-hidden rounded-3xl bg-gradient-to-r ${meta.accent} text-white shadow-lg`}>
          <div className="grid gap-6 px-6 py-8 lg:grid-cols-[auto,1fr] lg:items-center lg:px-8">
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl border border-white/20 bg-white/15 text-2xl font-bold backdrop-blur-sm">
              {profile?.profileImage ? (
                <img src={profile.profileImage} alt={profile?.name || 'Profile'} className="h-full w-full rounded-3xl object-cover" />
              ) : (
                initialsFromName(profile?.name)
              )}
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-semibold">{meta.title}</h1>
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                  {profile?.role || role}
                </span>
              </div>
              <p className="max-w-3xl text-sm text-white/85">{meta.subtitle}</p>
              <div className="flex flex-wrap gap-2 text-xs text-white/85">
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">Active account: {profile?.isActive ? 'Yes' : 'No'}</span>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">Created {prettyDate(profile?.createdAt)}</span>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">Updated {prettyDate(profile?.updatedAt)}</span>
              </div>
            </div>
          </div>
        </section>

        {profileQuery.isLoading && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
            Loading profile...
          </div>
        )}

        {profileQuery.isError && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">
            Failed to load profile information.
          </div>
        )}

        {profile && (
          <>
            <section className="grid gap-6 xl:grid-cols-3">
              <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                    <User size={18} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Personal Details</h2>
                    <p className="text-sm text-slate-500">Identity and contact details for this account.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {personalDetails.length > 0 ? personalDetails.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                      <p className="mt-1 text-sm font-medium text-slate-900">{item.value}</p>
                    </div>
                  )) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                      No personal details available.
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Account Overview</h2>
                    <p className="text-sm text-slate-500">Shared identity and contact information for this account.</p>
                  </div>
                  <Shield className="text-slate-400" size={18} />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <InfoRow icon={User} label="Full Name" value={profile.name || `${profile.firstName || ''} ${profile.lastName || ''}`.trim()} />
                  <InfoRow icon={Mail} label="Email" value={profile.email} />
                  <InfoRow icon={Phone} label="Alternate Mobile" value={profile.alternateMobile} />
                  <InfoRow icon={BadgeCheck} label="Status" value={profile.isActive ? 'Active' : 'Inactive'} />
                  <InfoRow icon={CalendarDays} label="Joined" value={prettyDate(profile.createdAt)} />
                  <InfoRow icon={KeyRound} label="Role" value={profile.role} />
                </div>
              </div>

              <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                    <School size={18} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Assignment</h2>
                    <p className="text-sm text-slate-500">Linked school and academic context.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {academicInfo.length > 0 ? academicInfo.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                      <p className="mt-1 text-sm font-medium text-slate-900">{item.value}</p>
                    </div>
                  )) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                      No academic assignment linked yet.
                    </div>
                  )}
                </div>
              </div>
            </section>

            {schoolInfo && (
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-blue-50 p-3 text-blue-700">
                    <GraduationCap size={18} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">School Details</h2>
                    <p className="text-sm text-slate-500">Information from the linked school record.</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <InfoRow icon={School} label="School Name" value={schoolInfo.schoolName} />
                  <InfoRow icon={BookOpen} label="School Code" value={schoolInfo.schoolCode} />
                  <InfoRow icon={MapPin} label="Address" value={schoolInfo.address} />
                  <InfoRow icon={Layers3} label="City" value={schoolInfo.city} />
                  <InfoRow icon={Layers3} label="State" value={schoolInfo.state} />
                  <InfoRow icon={Phone} label="Phone" value={schoolInfo.phone} />
                  <InfoRow icon={Mail} label="Email" value={schoolInfo.email} />
                  <InfoRow icon={AlertCircle} label="Status" value={schoolInfo.status} />
                </div>
              </section>
            )}

            {profile.canEdit !== false && (
              <section className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                    <ImageIcon size={18} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Edit Profile</h2>
                    <p className="text-sm text-slate-500">Update the name, alternate mobile, or profile image for this account.</p>
                  </div>
                </div>

                <form onSubmit={onSave} className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-1">
                    <label className="mb-1 block text-sm font-medium text-slate-700">First Name</label>
                    <input
                      className={fieldClassName}
                      value={form.firstName}
                      onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <label className="mb-1 block text-sm font-medium text-slate-700">Last Name</label>
                    <input
                      className={fieldClassName}
                      value={form.lastName}
                      onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-slate-700">Alternate Mobile</label>
                    <input
                      className={fieldClassName}
                      value={form.alternateMobile}
                      onChange={(event) => setForm((current) => ({ ...current, alternateMobile: event.target.value }))}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-slate-700">Profile Image URL</label>
                    <input
                      className={fieldClassName}
                      value={form.profileImage}
                      onChange={(event) => setForm((current) => ({ ...current, profileImage: event.target.value }))}
                    />
                  </div>
                  <div className="sm:col-span-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={saveMutation.isPending}
                      className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
                    >
                      {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                    <KeyRound size={18} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Change Password</h2>
                    <p className="text-sm text-slate-500">Keep the account secure with a fresh password.</p>
                  </div>
                </div>

                <form onSubmit={onPasswordSubmit} className="mt-5 space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Current Password</label>
                    <input
                      type="password"
                      className={fieldClassName}
                      value={passwordForm.currentPassword}
                      onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">New Password</label>
                    <input
                      type="password"
                      className={fieldClassName}
                      value={passwordForm.newPassword}
                      onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Confirm New Password</label>
                    <input
                      type="password"
                      className={fieldClassName}
                      value={passwordForm.confirmPassword}
                      onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={passwordMutation.isPending}
                      className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                    >
                      {passwordMutation.isPending ? 'Updating...' : 'Change Password'}
                    </button>
                  </div>
                </form>
              </div>
              </section>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

ProfilePage.propTypes = {
  role: PropTypes.oneOf(['PLATFORM_OWNER', 'SCHOOL_OWNER', 'ADMIN', 'TEACHER', 'PARENT', 'STUDENT', 'STAFF']).isRequired,
};

export default ProfilePage;
