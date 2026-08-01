import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import DashboardLayout from '../../layouts/DashboardLayout';
import { authService } from '../../services/authService';
import { feeService } from '../../services/feeService';
import FeeStructureWizard from './FeeStructureWizard';

export default function FeeStructureWizardPage() {
  const navigate = useNavigate();
  const { structureId } = useParams();
  const role = authService.getCurrentUser()?.role;
  const [initialStructure, setInitialStructure] = useState();
  useEffect(() => {
    if (!structureId) return;
    feeService.structure(structureId).then(setInitialStructure).catch((error) => toast.error(error.response?.data?.message || 'Unable to load fee structure'));
  }, [structureId]);
  if (structureId && !initialStructure) return <DashboardLayout role={role}><div className="animate-pulse rounded-2xl border p-10 text-center text-slate-500">Loading fee structure…</div></DashboardLayout>;
  return <DashboardLayout role={role}><FeeStructureWizard initialStructure={initialStructure} onClose={() => navigate('/dashboard/fees')} onPublished={() => navigate('/dashboard/fees')} /></DashboardLayout>;
}
