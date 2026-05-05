import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import DashboardLayout from '../../layouts/DashboardLayout';
import { schoolService } from '../../services/managementService';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';

const emptyForm = {
  schoolName: '',
  logoUrl: '',
  address: '',
  city: '',
  state: '',
  phone: '',
  email: '',
};

export default function SchoolProfilePage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);

  const mySchoolQuery = useQuery({
    queryKey: ['my-school-profile'],
    queryFn: () => schoolService.getMySchool(),
  });

  useEffect(() => {
    if (mySchoolQuery.data?.data) {
      const school = mySchoolQuery.data.data;
      setForm({
        schoolName: school.schoolName || '',
        logoUrl: school.logoUrl || '',
        address: school.address || '',
        city: school.city || '',
        state: school.state || '',
        phone: school.phone || '',
        email: school.email || '',
      });
    }
  }, [mySchoolQuery.data]);

  const saveMutation = useMutation({
    mutationFn: schoolService.updateMySchoolBasic,
    onSuccess: () => {
      toast.success('School profile updated');
      queryClient.invalidateQueries({ queryKey: ['my-school-profile'] });
      queryClient.invalidateQueries({ queryKey: ['current-branding'] });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to update profile'),
  });

  const onSubmit = (event) => {
    event.preventDefault();
    saveMutation.mutate(form);
  };

  return (
    <DashboardLayout role="SCHOOL_OWNER">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>School Basic Profile</CardTitle>
            <p className="text-sm text-slate-600">Update core school details. Changes are reflected across platform branding and views.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-sm text-slate-700">School Name</label>
                <Input value={form.schoolName} onChange={(event) => setForm((prev) => ({ ...prev, schoolName: event.target.value }))} required />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm text-slate-700">Logo URL</label>
                <Input value={form.logoUrl} onChange={(event) => setForm((prev) => ({ ...prev, logoUrl: event.target.value }))} placeholder="https://..." />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm text-slate-700">Address</label>
                <Input value={form.address} onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))} required />
              </div>
              <div>
                <label className="text-sm text-slate-700">City</label>
                <Input value={form.city} onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))} required />
              </div>
              <div>
                <label className="text-sm text-slate-700">State</label>
                <Input value={form.state} onChange={(event) => setForm((prev) => ({ ...prev, state: event.target.value }))} required />
              </div>
              <div>
                <label className="text-sm text-slate-700">Phone</label>
                <Input value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} required />
              </div>
              <div>
                <label className="text-sm text-slate-700">Email</label>
                <Input type="email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} required />
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Saving...' : 'Save Basic Details'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
