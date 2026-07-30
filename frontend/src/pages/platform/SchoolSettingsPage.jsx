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
import { Check, Palette } from 'lucide-react';
import { authService } from '../../services/authService';
import {
  DEFAULT_SCHOOL_PALETTE_ID,
  findSchoolPalette,
  SCHOOL_PALETTES,
} from '../../theme/schoolPalettes';

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
  themePalette: DEFAULT_SCHOOL_PALETTE_ID,
};

const sections = {
  basic: ['schoolName'],
  contact: ['email', 'phone', 'website', 'supportEmail'],
  address: ['addressLine1', 'addressLine2', 'city', 'state', 'country', 'postalCode'],
  branding: ['logoUrl', 'primaryColor', 'secondaryColor'],
};

export default function SchoolSettingsPage() {
  const user = authService.getCurrentUser();
  const isPlatformOwner = user?.role === 'PLATFORM_OWNER';
  const queryClient = useQueryClient();
  const [selectedSchoolId, setSelectedSchoolId] = useState(isPlatformOwner ? '' : user?.schoolId || '');
  const [form, setForm] = useState(emptyForm);
  const [logoCropFile, setLogoCropFile] = useState(null);

  const schoolsQuery = useQuery({
    queryKey: ['platform-schools-settings'],
    queryFn: () => schoolService.list({ page: 1, limit: 100, search: '' }),
    enabled: isPlatformOwner,
  });

  const settingsQuery = useQuery({
    queryKey: ['school-settings', selectedSchoolId],
    queryFn: () => (
      isPlatformOwner
        ? schoolSettingsService.getBySchoolId(selectedSchoolId)
        : schoolSettingsService.getMine()
    ),
    enabled: Boolean(selectedSchoolId),
  });

  useEffect(() => {
    if (settingsQuery.data?.data) {
      const settings = settingsQuery.data.data;
      const matchedPalette = findSchoolPalette(settings.primaryColor, settings.secondaryColor);
      setForm({
        ...emptyForm,
        ...settings,
        themePalette: matchedPalette.id,
      });
    }
  }, [settingsQuery.data]);

  const updateMutation = useMutation({
    mutationFn: ({ schoolId, payload }) => (
      isPlatformOwner
        ? schoolSettingsService.updateBySchoolId(schoolId, payload)
        : schoolSettingsService.updateMine(payload)
    ),
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
      return isPlatformOwner
        ? schoolSettingsService.updateBySchoolId(selectedSchoolId, { logoUrl: upload.secure_url })
        : schoolSettingsService.updateMine({ logoUrl: upload.secure_url });
    },
    onSuccess: () => {
      toast.success('Logo updated');
      queryClient.invalidateQueries({ queryKey: ['school-settings', selectedSchoolId] });
      queryClient.invalidateQueries({ queryKey: ['current-branding'] });
    },
    onError: (error) => toast.error(error.message || error.response?.data?.message || 'Logo upload failed'),
  });

  const schools = useMemo(() => schoolsQuery.data?.data || [], [schoolsQuery.data]);
  const selectedPalette = useMemo(
    () => SCHOOL_PALETTES.find((palette) => palette.id === form.themePalette) || SCHOOL_PALETTES[0],
    [form.themePalette],
  );

  const patchSection = (sectionKey) => {
    const keys = sections[sectionKey] || [];
    const payload = keys.reduce((acc, key) => {
      acc[key] = form[key];
      return acc;
    }, {});

    updateMutation.mutate({ schoolId: selectedSchoolId, payload });
  };

  return (
    <DashboardLayout role={user?.role}>
      <div className="space-y-6">
        {isPlatformOwner ? <Card>
          <CardHeader>
            <CardTitle>School Settings Management</CardTitle>
            <p className="text-sm text-[var(--text-muted)]">Platform owner can configure school identity, contact details, address, and branding.</p>
          </CardHeader>
          <CardContent>
            <div className="max-w-md">
              <label className="text-sm text-[var(--text-primary)]">Select School</label>
              <select
                className="mt-1 h-10 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] px-3 text-sm text-[var(--text-primary)]"
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
        </Card> : (
          <Card className="overflow-hidden">
            <CardContent className="flex flex-col gap-4 bg-primaryGradient text-white sm:flex-row sm:items-center">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10">
                <Palette />
              </span>
              <div>
                <h1 className="text-xl font-black">My school appearance</h1>
                <p className="mt-1 text-sm text-white/80">
                  Choose the visual identity used by everyone in your school.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

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
                <div>
                  <CardTitle>4. Branding and application theme</CardTitle>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    One palette controls navigation, actions, links, focus states, highlights, and gradients throughout SchoolOS.
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <p className="text-sm font-medium text-slate-700">School Logo (square crop required)</p>
                  <div className="mt-2 grid gap-4 sm:grid-cols-[160px_1fr]">
                    <div className="flex h-40 w-40 items-center justify-center overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)]">
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

                <fieldset>
                  <legend className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Application color palette
                  </legend>
                  <p className="mt-1 text-xs text-slate-500">
                    Each palette includes a coordinated low-glare light and dark theme. Saving publishes it only to users of this school.
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {SCHOOL_PALETTES.map((palette) => {
                      const selected = form.themePalette === palette.id;
                      return (
                        <button
                          key={palette.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setForm((previous) => ({
                            ...previous,
                            themePalette: palette.id,
                            primaryColor: palette.primary,
                            secondaryColor: palette.secondary,
                          }))}
                          className={`relative overflow-hidden rounded-2xl border-2 bg-[var(--surface-elevated)] p-3 text-left transition hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-offset-2 ${
                            selected
                              ? 'shadow-md'
                              : 'border-slate-200 hover:border-slate-400 dark:border-slate-700'
                          }`}
                          style={{ borderColor: selected ? palette.primary : undefined }}
                        >
                          <span className="grid grid-cols-2 gap-1.5" aria-hidden="true">
                            <span className="block h-20 rounded-xl p-2" style={{ backgroundColor: palette.light.canvas }}>
                              <i className="block h-3 w-10 rounded-full" style={{ backgroundColor: palette.primarySoft }} />
                              <i className="mt-2 block h-9 rounded-lg border" style={{ backgroundColor: palette.light.card, borderColor: palette.light.border }} />
                            </span>
                            <span className="block h-20 rounded-xl p-2" style={{ backgroundColor: palette.dark.canvas }}>
                              <i className="block h-3 w-10 rounded-full" style={{ backgroundColor: palette.darkPrimary }} />
                              <i className="mt-2 block h-9 rounded-lg border" style={{ backgroundColor: palette.dark.card, borderColor: palette.dark.border }} />
                            </span>
                          </span>
                          <span className="mt-3 flex items-center justify-between gap-2">
                            <strong className="text-sm">{palette.name}</strong>
                            {selected && (
                              <span className="grid h-6 w-6 place-items-center rounded-full text-white" style={{ backgroundColor: palette.primary }}>
                                <Check size={14} />
                              </span>
                            )}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-slate-500">
                            {palette.description}
                          </span>
                          <span className="mt-3 flex gap-1.5" aria-hidden="true">
                            {[palette.primary, palette.secondary, palette.darkPrimary, palette.primarySoft].map((color) => (
                              <i key={color} className="h-4 flex-1 rounded-full" style={{ backgroundColor: color }} />
                            ))}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {form.themePalette === 'custom' && (
                    <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                      This school uses legacy custom colors. Select one of the supported palettes to enable the complete centralized theme.
                    </p>
                  )}
                </fieldset>

                <section className="overflow-hidden rounded-2xl border border-[var(--border-soft)]">
                  <div className="border-b border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-3">
                    <h3 className="font-semibold text-[var(--text-primary)]">Comfort preview</h3>
                    <p className="text-xs text-[var(--text-muted)]">Both modes avoid pure white and pure black surfaces.</p>
                  </div>
                  <div className="grid md:grid-cols-2">
                    {[
                      ['Light workspace', selectedPalette.light, selectedPalette.primary, '#f7fbfa'],
                      ['Dark workspace', selectedPalette.dark, selectedPalette.darkPrimary, '#182426'],
                    ].map(([label, surfaces, primary, onPrimary]) => (
                      <div key={label} className="p-4" style={{ backgroundColor: surfaces.canvas, color: surfaces.text }}>
                        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: surfaces.muted }}>{label}</p>
                        <div className="mt-3 rounded-xl border p-4 shadow-sm" style={{ backgroundColor: surfaces.card, borderColor: surfaces.border }}>
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold">Today’s learning</p>
                              <p className="mt-1 text-xs" style={{ color: surfaces.muted }}>Comfortable contrast for longer sessions</p>
                            </div>
                            <span className="rounded-lg px-3 py-2 text-xs font-bold" style={{ backgroundColor: primary, color: onPrimary }}>Open</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

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
