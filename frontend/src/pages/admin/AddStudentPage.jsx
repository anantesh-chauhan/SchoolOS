import React from 'react';
import StudentForm from '../../components/StudentForm';
import DashboardLayout from '../../layouts/DashboardLayout';
import { authService } from '../../services/authService';

const AddStudentPage = () => {
  const user = authService.getCurrentUser();
  const role = user?.role || 'ADMIN';

  return (
    <DashboardLayout role={role}>
      <div className="space-y-6">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-6 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 px-6 py-8 text-white lg:grid-cols-[1.15fr,0.85fr] lg:px-8">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-300">Admissions Workspace</p>
              <h1 className="text-3xl font-semibold sm:text-4xl">Create a student record without losing the credential trail.</h1>
              <p className="max-w-2xl text-sm text-slate-300 sm:text-base">
                This admission flow saves the student, generates credentials, and keeps the profile and navigation paths aligned with the active role.
              </p>
            </div>

            <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-100 backdrop-blur-sm">
              <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-3">1. Fill the student and parent details</div>
              <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-3">2. Save the admission to reserve the ID</div>
              <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-3">3. Generate and download credentials immediately</div>
            </div>
          </div>
        </section>

        <StudentForm />
      </div>
    </DashboardLayout>
  );
};

export default AddStudentPage;
