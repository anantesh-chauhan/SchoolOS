import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import DashboardLayout from '../../layouts/DashboardLayout';
import { userService } from '../../services/managementService';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';

const emptyTeacherForm = {
  firstName: '',
  lastName: '',
  employeeId: '',
  joiningYear: new Date().getFullYear(),
  email: '',
  phone: '',
};

const emptyStaffForm = {
  firstName: '',
  employeeId: '',
  email: '',
  phone: '',
};

const CredentialBlock = ({ title, data }) => {
  if (!data) return null;

  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
      <p className="font-semibold">{title}</p>
      <div className="mt-2 space-y-1">
        <p><span className="font-medium">Login ID:</span> {data.loginId}</p>
        <p><span className="font-medium">Password:</span> {data.password}</p>
        <p><span className="font-medium">Must change password:</span> {String(data.mustChangePassword)}</p>
      </div>
    </div>
  );
};

export default function UserManagementPage() {
  const [teacherForm, setTeacherForm] = useState(emptyTeacherForm);
  const [staffForm, setStaffForm] = useState(emptyStaffForm);
  const [curriculumForm, setCurriculumForm] = useState({ ...emptyStaffForm, lastName: '' });
  const [teacherResult, setTeacherResult] = useState(null);
  const [staffResult, setStaffResult] = useState(null);
  const [curriculumResult, setCurriculumResult] = useState(null);
  const [examRoleForm, setExamRoleForm] = useState({ ...emptyStaffForm, lastName: '', role: 'EXAM_COORDINATOR' });
  const [examRoleResult, setExamRoleResult] = useState(null);

  const teacherMutation = useMutation({
    mutationFn: userService.createTeacher,
    onSuccess: (response) => {
      toast.success('Teacher account created');
      setTeacherResult(response.data);
      setTeacherForm(emptyTeacherForm);
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to create teacher account'),
  });

  const staffMutation = useMutation({
    mutationFn: userService.createStaff,
    onSuccess: (response) => {
      toast.success('Staff account created');
      setStaffResult(response.data);
      setStaffForm(emptyStaffForm);
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to create staff account'),
  });

  const curriculumMutation = useMutation({
    mutationFn: userService.createCurriculumManager,
    onSuccess: (response) => {
      toast.success('Curriculum Manager account created');
      setCurriculumResult(response.data);
      setCurriculumForm({ ...emptyStaffForm, lastName: '' });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to create Curriculum Manager'),
  });

  const examRoleMutation = useMutation({
    mutationFn: userService.createExaminationRole,
    onSuccess: (response) => {
      toast.success(`${examRoleForm.role.replaceAll('_', ' ')} account created`);
      setExamRoleResult(response.data);
      setExamRoleForm({ ...emptyStaffForm, lastName: '', role: 'EXAM_COORDINATOR' });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to create examination role account'),
  });

  const submitTeacher = (event) => {
    event.preventDefault();
    teacherMutation.mutate(teacherForm);
  };

  const submitStaff = (event) => {
    event.preventDefault();
    staffMutation.mutate(staffForm);
  };

  return (
    <DashboardLayout role="ADMIN">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>User Accounts</CardTitle>
            <p className="text-sm text-slate-600">Create teacher and staff login accounts from the standardized identity system.</p>
          </CardHeader>
          <CardContent className="space-y-8">
            <section className="space-y-4 rounded-2xl border border-slate-200 p-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Create Teacher Account</h2>
                <p className="text-sm text-slate-500">Creates both the user login and teacher profile with a generated employee ID-based login.</p>
              </div>
              <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={submitTeacher}>
                <Input required placeholder="First Name" value={teacherForm.firstName} onChange={(event) => setTeacherForm((prev) => ({ ...prev, firstName: event.target.value }))} />
                <Input required placeholder="Last Name" value={teacherForm.lastName} onChange={(event) => setTeacherForm((prev) => ({ ...prev, lastName: event.target.value }))} />
                <Input required placeholder="Employee ID" value={teacherForm.employeeId} onChange={(event) => setTeacherForm((prev) => ({ ...prev, employeeId: event.target.value }))} />
                <Input required type="number" placeholder="Joining Year" value={teacherForm.joiningYear} onChange={(event) => setTeacherForm((prev) => ({ ...prev, joiningYear: event.target.value }))} />
                <Input required type="email" placeholder="Contact Email" value={teacherForm.email} onChange={(event) => setTeacherForm((prev) => ({ ...prev, email: event.target.value }))} />
                <Input required placeholder="Phone" value={teacherForm.phone} onChange={(event) => setTeacherForm((prev) => ({ ...prev, phone: event.target.value }))} />
                <div className="sm:col-span-2 flex justify-end">
                  <Button type="submit" disabled={teacherMutation.isPending}>{teacherMutation.isPending ? 'Creating...' : 'Create Teacher'}</Button>
                </div>
              </form>
              <CredentialBlock title="Teacher Credentials" data={teacherResult} />
            </section>

            <section className="space-y-4 rounded-2xl border border-slate-200 p-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Create Staff Account</h2>
                <p className="text-sm text-slate-500">Creates a staff login with school-scoped identity and first-login password reset flag.</p>
              </div>
              <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={submitStaff}>
                <Input required placeholder="First Name" value={staffForm.firstName} onChange={(event) => setStaffForm((prev) => ({ ...prev, firstName: event.target.value }))} />
                <Input required placeholder="Employee ID" value={staffForm.employeeId} onChange={(event) => setStaffForm((prev) => ({ ...prev, employeeId: event.target.value }))} />
                <Input required type="email" placeholder="Contact Email" value={staffForm.email} onChange={(event) => setStaffForm((prev) => ({ ...prev, email: event.target.value }))} />
                <Input required placeholder="Phone" value={staffForm.phone} onChange={(event) => setStaffForm((prev) => ({ ...prev, phone: event.target.value }))} />
                <div className="sm:col-span-2 flex justify-end">
                  <Button type="submit" disabled={staffMutation.isPending}>{staffMutation.isPending ? 'Creating...' : 'Create Staff'}</Button>
                </div>
              </form>
              <CredentialBlock title="Staff Credentials" data={staffResult} />
            </section>

            <section className="space-y-4 rounded-2xl border border-violet-200 bg-violet-50/40 p-5 dark:border-violet-900 dark:bg-violet-950/20">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Create Curriculum Manager</h2>
                <p className="text-sm text-slate-500">Grants school-scoped curriculum, chapter, resource and weekly-slot permissions without user credentials, fees, payroll or platform access.</p>
              </div>
              <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); curriculumMutation.mutate(curriculumForm); }}>
                <Input required placeholder="First Name" value={curriculumForm.firstName} onChange={(event) => setCurriculumForm((prev) => ({ ...prev, firstName: event.target.value }))} />
                <Input placeholder="Last Name" value={curriculumForm.lastName} onChange={(event) => setCurriculumForm((prev) => ({ ...prev, lastName: event.target.value }))} />
                <Input required placeholder="Employee ID" value={curriculumForm.employeeId} onChange={(event) => setCurriculumForm((prev) => ({ ...prev, employeeId: event.target.value }))} />
                <Input required type="email" placeholder="Contact Email" value={curriculumForm.email} onChange={(event) => setCurriculumForm((prev) => ({ ...prev, email: event.target.value }))} />
                <Input required placeholder="Phone" value={curriculumForm.phone} onChange={(event) => setCurriculumForm((prev) => ({ ...prev, phone: event.target.value }))} />
                <div className="flex justify-end sm:col-span-2"><Button type="submit" disabled={curriculumMutation.isPending}>{curriculumMutation.isPending ? 'Creating...' : 'Create Curriculum Manager'}</Button></div>
              </form>
              <CredentialBlock title="Curriculum Manager Credentials" data={curriculumResult} />
            </section>

            <section className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 dark:border-emerald-900 dark:bg-emerald-950/20">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Create Examination Leadership Account</h2>
                <p className="text-sm text-slate-500">Creates a Principal approval account or an Exam Coordinator operations account with explicit examination permissions.</p>
              </div>
              <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); examRoleMutation.mutate(examRoleForm); }}>
                <select className="h-10 rounded-md border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-950" value={examRoleForm.role} onChange={(event) => setExamRoleForm((prev) => ({ ...prev, role: event.target.value }))}><option value="EXAM_COORDINATOR">Exam Coordinator</option><option value="PRINCIPAL">Principal</option></select>
                <Input required placeholder="Employee ID" value={examRoleForm.employeeId} onChange={(event) => setExamRoleForm((prev) => ({ ...prev, employeeId: event.target.value }))} />
                <Input required placeholder="First Name" value={examRoleForm.firstName} onChange={(event) => setExamRoleForm((prev) => ({ ...prev, firstName: event.target.value }))} />
                <Input placeholder="Last Name" value={examRoleForm.lastName} onChange={(event) => setExamRoleForm((prev) => ({ ...prev, lastName: event.target.value }))} />
                <Input required type="email" placeholder="Contact Email" value={examRoleForm.email} onChange={(event) => setExamRoleForm((prev) => ({ ...prev, email: event.target.value }))} />
                <Input required placeholder="Phone" value={examRoleForm.phone} onChange={(event) => setExamRoleForm((prev) => ({ ...prev, phone: event.target.value }))} />
                <div className="flex justify-end sm:col-span-2"><Button type="submit" disabled={examRoleMutation.isPending}>{examRoleMutation.isPending ? 'Creating...' : `Create ${examRoleForm.role === 'PRINCIPAL' ? 'Principal' : 'Exam Coordinator'}`}</Button></div>
              </form>
              <CredentialBlock title="Examination Role Credentials" data={examRoleResult} />
            </section>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
