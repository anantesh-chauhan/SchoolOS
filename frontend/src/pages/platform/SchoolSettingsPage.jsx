import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import DashboardLayout from '../../layouts/DashboardLayout';
import { schoolService } from '../../services/managementService';
import { schoolSettingsService } from '../../services/schoolSettingsService';
import { cloudinaryUploadService } from '../../services/cloudinaryUploadService';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import DropzoneUploader from '../../components/media/DropzoneUploader';
import ImageCropperModal from '../../components/media/ImageCropperModal';

const emptyForm = {
  schoolName: '',
  logoUrl: '',
  email: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  country: '',
  postalCode: '',
  website: '',
  supportEmail: '',
  primaryColor: '#0f766e',
  secondaryColor: '#0f172a',
};

const sections = {
  basic: ['schoolName'],
  contact: ['email', 'phone', 'website', 'supportEmail'],
  address: ['addressLine1', 'addressLine2', 'city', 'state', 'country', 'postalCode'],
  branding: ['logoUrl', 'primaryColor', 'secondaryColor'],
};

export default function SchoolSettingsPage() {
  const queryClient = useQueryClient();
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [logoCropFile, setLogoCropFile] = useState(null);

  const schoolsQuery = useQuery({
    queryKey: ['platform-schools-settings'],
    queryFn: () => schoolService.list({ page: 1, limit: 100, search: '' }),
  });

  const settingsQuery = useQuery({
    queryKey: ['school-settings', selectedSchoolId],
    queryFn: () => schoolSettingsService.getBySchoolId(selectedSchoolId),
    enabled: Boolean(selectedSchoolId),
  });

  useEffect(() => {
    if (settingsQuery.data?.data) {
      setForm({ ...emptyForm, ...settingsQuery.data.data });
    }
  }, [settingsQuery.data]);

  const updateMutation = useMutation({
    mutationFn: ({ schoolId, payload }) => schoolSettingsService.updateBySchoolId(schoolId, payload),
    onSuccess: () => {
      toast.success('Settings updated');
      queryClient.invalidateQueries({ queryKey: ['school-settings', selectedSchoolId] });
      queryClient.invalidateQueries({ queryKey: ['current-branding'] });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to update settings'),
  });

  const logoMutation = useMutation({
    mutationFn: async (file) => {
      const signResponse = await cloudinaryUploadService.getSchoolLogoSignature({ schoolId: selectedSchoolId });
      const upload = await cloudinaryUploadService.uploadToCloudinary(file, signResponse.data);
      return schoolSettingsService.updateBySchoolId(selectedSchoolId, { logoUrl: upload.secure_url });
    },
    onSuccess: () => {
      toast.success('Logo updated');
      queryClient.invalidateQueries({ queryKey: ['school-settings', selectedSchoolId] });
      queryClient.invalidateQueries({ queryKey: ['current-branding'] });
    },
    onError: (error) => toast.error(error.message || error.response?.data?.message || 'Logo upload failed'),
  });

  const schools = useMemo(() => schoolsQuery.data?.data || [], [schoolsQuery.data]);

  const patchSection = (sectionKey) => {
    const keys = sections[sectionKey] || [];
    const payload = keys.reduce((acc, key) => {
      acc[key] = form[key];
      return acc;
    }, {});

    updateMutation.mutate({ schoolId: selectedSchoolId, payload });
  };

  return (
    <DashboardLayout role="PLATFORM_OWNER">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>School Settings Management</CardTitle>
            <p className="text-sm text-slate-600">Platform owner can configure school identity, contact details, address, and branding.</p>
          </CardHeader>
          <CardContent>
            <div className="max-w-md">
              <label className="text-sm text-slate-700">Select School</label>
              <select
                className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                value={selectedSchoolId}
                onChange={(event) => setSelectedSchoolId(event.target.value)}
              >
                <option value="">Choose school</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>{school.schoolName} ({school.schoolCode})</option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {selectedSchoolId && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>1. School Basic Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-slate-700">School Name</label>
                  <Input value={form.schoolName} onChange={(event) => setForm((prev) => ({ ...prev, schoolName: event.target.value }))} />
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => patchSection('basic')} disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? 'Saving...' : 'Save Basic Info'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>2. Contact Details</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm text-slate-700">Email</label>
                  <Input type="email" value={form.email || ''} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} />
                </div>
                <div>
                  <label className="text-sm text-slate-700">Phone</label>
                  <Input value={form.phone || ''} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} />
                </div>
                <div>
                  <label className="text-sm text-slate-700">Website</label>
                  <Input value={form.website || ''} onChange={(event) => setForm((prev) => ({ ...prev, website: event.target.value }))} />
                </div>
                <div>
                  <label className="text-sm text-slate-700">Support Email</label>
                  <Input type="email" value={form.supportEmail || ''} onChange={(event) => setForm((prev) => ({ ...prev, supportEmail: event.target.value }))} />
                </div>
                <div className="sm:col-span-2 flex justify-end">
                  <Button onClick={() => patchSection('contact')} disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? 'Saving...' : 'Save Contact Details'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>3. Address Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="text-sm text-slate-700">Address Line 1</label>
                  <Input value={form.addressLine1 || ''} onChange={(event) => setForm((prev) => ({ ...prev, addressLine1: event.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-sm text-slate-700">Address Line 2</label>
                  <Input value={form.addressLine2 || ''} onChange={(event) => setForm((prev) => ({ ...prev, addressLine2: event.target.value }))} />
                </div>
                <div>
                  <label className="text-sm text-slate-700">City</label>
                  <Input value={form.city || ''} onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))} />
                </div>
                <div>
                  <label className="text-sm text-slate-700">State</label>
                  <Input value={form.state || ''} onChange={(event) => setForm((prev) => ({ ...prev, state: event.target.value }))} />
                </div>
                <div>
                  <label className="text-sm text-slate-700">Country</label>
                  <Input value={form.country || ''} onChange={(event) => setForm((prev) => ({ ...prev, country: event.target.value }))} />
                </div>
                <div>
                  <label className="text-sm text-slate-700">Postal Code</label>
                  <Input value={form.postalCode || ''} onChange={(event) => setForm((prev) => ({ ...prev, postalCode: event.target.value }))} />
                </div>
                <div className="sm:col-span-2 flex justify-end">
                  <Button onClick={() => patchSection('address')} disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? 'Saving...' : 'Save Address'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>4. Branding (Logo + Colors)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <p className="text-sm font-medium text-slate-700">School Logo (square crop required)</p>
                  <div className="mt-2 grid gap-4 sm:grid-cols-[160px_1fr]">
                    <div className="h-40 w-40 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center">
                      {form.logoUrl ? (
                        <img src={form.logoUrl} alt="School logo" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xs text-slate-500">No logo</span>
                      )}
                    </div>
                    <div>
                      <DropzoneUploader
                        multiple={false}
                        onFiles={(files) => setLogoCropFile(files[0])}
                        helperText="Square (1:1) crop is mandatory"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm text-slate-700">Primary Color</label>
                    <Input
                      type="color"
                      value={form.primaryColor || '#0f766e'}
                      onChange={(event) => setForm((prev) => ({ ...prev, primaryColor: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-700">Secondary Color</label>
                    <Input
                      type="color"
                      value={form.secondaryColor || '#0f172a'}
                      onChange={(event) => setForm((prev) => ({ ...prev, secondaryColor: event.target.value }))}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={() => patchSection('branding')} disabled={updateMutation.isPending || logoMutation.isPending}>
                    {updateMutation.isPending ? 'Saving...' : 'Save Branding'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <ImageCropperModal
        open={Boolean(logoCropFile)}
        imageFile={logoCropFile}
        aspect={1}
        title="Crop School Logo"
        onClose={() => setLogoCropFile(null)}
        onCropped={(cropped) => {
          setLogoCropFile(null);
          logoMutation.mutate(cropped);
        }}
      />
    </DashboardLayout>
  );
}
