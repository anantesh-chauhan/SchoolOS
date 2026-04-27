import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Pencil, Trash2 } from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { galleryService } from '../../services/galleryService';
import { authService } from '../../services/authService';
import { cloudinaryUploadService } from '../../services/cloudinaryUploadService';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/dialog';
import { Badge } from '../../components/ui/badge';
import DropzoneUploader from '../../components/media/DropzoneUploader';
import ImageCropperModal from '../../components/media/ImageCropperModal';
import ImageSkeletonGrid from '../../components/media/ImageSkeletonGrid';

const emptyForm = {
  title: '',
  description: '',
  isVisible: true,
};

export default function GalleryGroupsPage() {
  const user = authService.getCurrentUser();
  const role = user?.role || 'ADMIN';
  const schoolId = user?.schoolId;
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [cropFile, setCropFile] = useState(null);
  const [uploadTargetGroup, setUploadTargetGroup] = useState(null);

  const groupsQuery = useQuery({
    queryKey: ['gallery-groups', schoolId],
    queryFn: () => galleryService.listGroups(),
    enabled: Boolean(schoolId),
  });

  const createMutation = useMutation({
    mutationFn: galleryService.createGroup,
    onSuccess: () => {
      toast.success('Gallery group created');
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ['gallery-groups'] });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to create group'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => galleryService.updateGroup(id, payload),
    onSuccess: () => {
      toast.success('Gallery group updated');
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ['gallery-groups'] });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to update group'),
  });

  const deleteMutation = useMutation({
    mutationFn: galleryService.deleteGroup,
    onSuccess: () => {
      toast.success('Gallery group deleted');
      queryClient.invalidateQueries({ queryKey: ['gallery-groups'] });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to delete group'),
  });

  const reorderMutation = useMutation({
    mutationFn: galleryService.reorderGroups,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gallery-groups'] }),
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to reorder groups'),
  });

  const uploadCoverMutation = useMutation({
    mutationFn: async ({ file, group }) => {
      const signResponse = await cloudinaryUploadService.getGallerySignature({ schoolId, groupId: group.id });
      const uploadResult = await cloudinaryUploadService.uploadToCloudinary(file, signResponse.data);
      return galleryService.updateGroup(group.id, { coverImageUrl: uploadResult.secure_url });
    },
    onSuccess: () => {
      toast.success('Cover image updated');
      queryClient.invalidateQueries({ queryKey: ['gallery-groups'] });
    },
    onError: (error) => toast.error(error.message || error.response?.data?.message || 'Cover upload failed'),
  });

  const rows = useMemo(() => groupsQuery.data?.data || [], [groupsQuery.data]);

  const moveGroup = (currentIndex, direction) => {
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= rows.length) {
      return;
    }

    const reordered = [...rows];
    [reordered[currentIndex], reordered[nextIndex]] = [reordered[nextIndex], reordered[currentIndex]];
    reorderMutation.mutate(reordered.map((group, index) => ({ id: group.id, displayOrder: index + 1 })));
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (group) => {
    setEditing(group);
    setForm({
      title: group.title,
      description: group.description || '',
      isVisible: group.isVisible,
    });
    setShowForm(true);
  };

  const submit = (event) => {
    event.preventDefault();
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }

    if (editing) {
      updateMutation.mutate({ id: editing.id, payload: form });
      return;
    }

    createMutation.mutate(form);
  };

  const toggleVisibility = (group) => {
    updateMutation.mutate({
      id: group.id,
      payload: { isVisible: !group.isVisible },
    });
  };

  return (
    <DashboardLayout role={role}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Gallery Groups</CardTitle>
                <p className="text-sm text-slate-600">Create event-based albums, control visibility, and set display order.</p>
              </div>
              <Button onClick={openCreate}>Create Gallery Group</Button>
            </div>
          </CardHeader>
          <CardContent>
            {groupsQuery.isLoading && <ImageSkeletonGrid items={6} />}

            {!groupsQuery.isLoading && rows.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <p className="text-sm font-medium text-slate-700">No gallery groups yet</p>
                <p className="mt-1 text-xs text-slate-500">Create your first event album to start publishing photos.</p>
              </div>
            )}

            {!groupsQuery.isLoading && rows.length > 0 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {rows.map((group, index) => (
                  <div key={group.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="aspect-[4/3] overflow-hidden rounded-lg bg-slate-100">
                      {group.coverImageUrl ? (
                        <img
                          src={group.coverImageUrlOptimized || group.coverImageUrl}
                          alt={group.title}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-slate-500">No cover image</div>
                      )}
                    </div>

                    <div className="mt-3 flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900 line-clamp-1">{group.title}</p>
                        <p className="text-xs text-slate-500 line-clamp-2 mt-1">{group.description || 'No description'}</p>
                      </div>
                      <Badge variant={group.isVisible ? 'success' : 'muted'}>{group.isVisible ? 'Visible' : 'Hidden'}</Badge>
                    </div>

                    <div className="mt-3 text-xs text-slate-500">{group._count?.photos || 0} photos</div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button variant="secondary" className="h-8 px-2" onClick={() => openEdit(group)}>
                        <Pencil size={14} className="mr-1" /> Edit
                      </Button>
                      <Button
                        variant="secondary"
                        className="h-8 px-2"
                        onClick={() => {
                          setUploadTargetGroup(group);
                        }}
                      >
                        <ImagePlus size={14} className="mr-1" /> Cover
                      </Button>
                      <Button variant="outline" className="h-8 px-2" onClick={() => toggleVisibility(group)}>
                        {group.isVisible ? <EyeOff size={14} className="mr-1" /> : <Eye size={14} className="mr-1" />}
                        {group.isVisible ? 'Hide' : 'Unhide'}
                      </Button>
                      <Button
                        variant="danger"
                        className="h-8 px-2"
                        onClick={() => {
                          if (window.confirm(`Delete group "${group.title}" and all photos?`)) {
                            deleteMutation.mutate(group.id);
                          }
                        }}
                      >
                        <Trash2 size={14} className="mr-1" /> Delete
                      </Button>
                    </div>

                    <div className="mt-2 flex gap-2">
                      <Button
                        variant="secondary"
                        className="h-8 px-2"
                        disabled={index === 0 || reorderMutation.isPending}
                        onClick={() => moveGroup(index, -1)}
                      >
                        <ArrowUp size={14} className="mr-1" /> Up
                      </Button>
                      <Button
                        variant="secondary"
                        className="h-8 px-2"
                        disabled={index === rows.length - 1 || reorderMutation.isPending}
                        onClick={() => moveGroup(index, 1)}
                      >
                        <ArrowDown size={14} className="mr-1" /> Down
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Gallery Group' : 'Create Gallery Group'}>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-sm text-slate-700">Title</label>
              <Input
                required
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Annual Function 2026"
              />
            </div>

            <div>
              <label className="text-sm text-slate-700">Description</label>
              <textarea
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Short event description"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                rows={3}
              />
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.isVisible}
                onChange={(event) => setForm((prev) => ({ ...prev, isVisible: event.target.checked }))}
              />
              Visible on public gallery
            </label>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Group'}
              </Button>
            </div>
          </form>
        </Modal>

        <Modal
          open={Boolean(uploadTargetGroup)}
          onClose={() => {
            setUploadTargetGroup(null);
            setCropFile(null);
          }}
          title="Upload Cover Image"
        >
          <div className="space-y-4">
            {!cropFile && (
              <DropzoneUploader
                multiple={false}
                onFiles={(files) => setCropFile(files[0])}
                helperText="Crop is mandatory before upload. Aspect ratio: 4:3"
              />
            )}
            {cropFile && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                Ready to crop: {cropFile.name}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setCropFile(null)}>Reset</Button>
              <Button variant="secondary" onClick={() => setUploadTargetGroup(null)}>Close</Button>
            </div>
          </div>
        </Modal>

        <ImageCropperModal
          open={Boolean(cropFile && uploadTargetGroup)}
          imageFile={cropFile}
          aspect={4 / 3}
          title="Crop Cover Image"
          onClose={() => setCropFile(null)}
          onCropped={(croppedFile) => {
            uploadCoverMutation.mutate({ file: croppedFile, group: uploadTargetGroup });
            setCropFile(null);
            setUploadTargetGroup(null);
          }}
        />
      </motion.div>
    </DashboardLayout>
  );
}
