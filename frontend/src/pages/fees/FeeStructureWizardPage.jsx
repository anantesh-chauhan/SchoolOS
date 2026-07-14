import React from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../layouts/DashboardLayout';
import { authService } from '../../services/authService';
import FeeStructureWizard from './FeeStructureWizard';

export default function FeeStructureWizardPage() {
  const navigate = useNavigate();
  const role = authService.getCurrentUser()?.role;
  return <DashboardLayout role={role}><FeeStructureWizard onClose={() => navigate('/dashboard/fees')} onPublished={() => navigate('/dashboard/fees')} /></DashboardLayout>;
}
