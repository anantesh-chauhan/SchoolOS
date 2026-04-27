import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Pencil, Trash2, UploadCloud, Layers3 } from 'lucide-react';
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

const emptyGroupForm = {
  title: '',
  description: '',
  isVisible: true,
};

export default function GalleryStudioPage() {
  const user = authService.getCurrentUser();
  const role = user?.role || 'ADMIN';
  const schoolId = user?.schoolId;
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('groups');
  const [selectedGroupId, setSelectedGroupId] = useState('');

  const [showGroupForm, setShowGroupForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [groupForm, setGroupForm] = useState(emptyGroupForm);

  const [coverCropFile, setCoverCropFile] = useState(null);
  const [coverUploadTargetGroup, setCoverUploadTargetGroup] = useState(null);

  const [queuedFiles, setQueuedFiles] = useState([]);
  const [cropQueue, setCropQueue] = useState([]);
  const [activeCropFile, setActiveCropFile] = useState(null);

  const [editPhoto, setEditPhoto] = useState(null);
  const [editCaption, setEditCaption] = useState('');

  const groupsQuery = useQuery({
    queryKey: ['gallery-groups', schoolId],
    queryFn: () => galleryService.listGroups(),
    enabled: Boolean(schoolId),
  });

  const photosQuery = useQuery({
    queryKey: ['gallery-photos', selectedGroupId],
    queryFn: () => galleryService.listPhotos(selectedGroupId),
    enabled: Boolean(selectedGroupId),
  });

  const createGroupMutation = useMutation({
    mutationFn: galleryService.createGroup,
    onSuccess: () => {
      toast.success('Gallery group created');
      setShowGroupForm(false);
      setEditingGroup(null);
      setGroupForm(emptyGroupForm);
      queryClient.invalidateQueries({ queryKey: ['gallery-groups'] });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to create group'),
  });

  const updateGroupMutation = useMutation({
    mutationFn: ({ id, payload }) => galleryService.updateGroup(id, payload),
    onSuccess: () => {
      toast.success('Gallery group updated');
      setShowGroupForm(false);
      setEditingGroup(null);
      setGroupForm(emptyGroupForm);
      queryClient.invalidateQueries({ queryKey: ['gallery-groups'] });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to update group'),
  });

  const deleteGroupMutation = useMutation({
    mutationFn: galleryService.deleteGroup,
    onSuccess: () => {
      toast.success('Gallery group deleted');
      queryClient.invalidateQueries({ queryKey: ['gallery-groups'] });
      if (selectedGroupId) {
        setSelectedGroupId('');
      }
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to delete group'),
  });

  const reorderGroupsMutation = useMutation({
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

  const uploadPhotosMutation = useMutation({
    mutationFn: async (files) => {
      const signResponse = await cloudinaryUploadService.getGallerySignature({ schoolId, groupId: selectedGroupId });
      const uploaded = [];

      for (const file of files) {
        const upload = await cloudinaryUploadService.uploadToCloudinary(file, signResponse.data);
        uploaded.push({ imageUrl: upload.secure_url, caption: '' });
      }

      return galleryService.createPhotos(selectedGroupId, uploaded);
    },
    onSuccess: () => {
      toast.success('Photos uploaded');
      setQueuedFiles([]);
      queryClient.invalidateQueries({ queryKey: ['gallery-photos', selectedGroupId] });
      queryClient.invalidateQueries({ queryKey: ['gallery-groups'] });
    },
    onError: (error) => toast.error(error.message || error.response?.data?.message || 'Photo upload failed'),
  });

  const updatePhotoMutation = useMutation({
    mutationFn: ({ id, payload }) => galleryService.updatePhoto(id, payload),
    onSuccess: () => {
      toast.success('Photo updated');
      setEditPhoto(null);
      queryClient.invalidateQueries({ queryKey: ['gallery-photos', selectedGroupId] });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to update photo'),
  });

  const deletePhotoMutation = useMutation({
    mutationFn: galleryService.deletePhoto,
    onSuccess: () => {
      toast.success('Photo deleted');
      queryClient.invalidateQueries({ queryKey: ['gallery-photos', selectedGroupId] });
      queryClient.invalidateQueries({ queryKey: ['gallery-groups'] });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to delete photo'),
  });

  const reorderPhotosMutation = useMutation({
    mutationFn: (order) => galleryService.reorderPhotos(selectedGroupId, order),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gallery-photos', selectedGroupId] }),
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to reorder photos'),
  });

  const groups = useMemo(() => groupsQuery.data?.data || [], [groupsQuery.data]);
  const photos = useMemo(() => photosQuery.data?.data || [], [photosQuery.data]);

  const moveGroup = (currentIndex, direction) => {
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= groups.length) {
      return;
    }

    const reordered = [...groups];
    [reordered[currentIndex], reordered[nextIndex]] = [reordered[nextIndex], reordered[currentIndex]];
    reorderGroupsMutation.mutate(reordered.map((group, index) => ({ id: group.id, displayOrder: index + 1 })));
  };

  const movePhoto = (currentIndex, direction) => {
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= photos.length) {
      return;
    }

    const reordered = [...photos];
    [reordered[currentIndex], reordered[nextIndex]] = [reordered[nextIndex], reordered[currentIndex]];
    reorderPhotosMutation.mutate(reordered.map((photo, index) => ({ id: photo.id, displayOrder: index + 1 })));
  };

  const openCreateGroup = () => {
    setEditingGroup(null);
    setGroupForm(emptyGroupForm);
    setShowGroupForm(true);
  };

  const openEditGroup = (group) => {
    setEditingGroup(group);
    setGroupForm({
      title: group.title,
      description: group.description || '',
      isVisible: group.isVisible,
    });
    setShowGroupForm(true);
  };

  const submitGroup = (event) => {
    event.preventDefault();
    if (!groupForm.title.trim()) {
      toast.error('Title is required');
      return;
    }

    if (editingGroup) {
      updateGroupMutation.mutate({ id: editingGroup.id, payload: groupForm });
      return;
    }

    createGroupMutation.mutate(groupForm);
  };

  const enqueueForCrop = (files) => {
    const validFiles = files.filter((file) => file.type.startsWith('image/'));
    if (validFiles.length === 0) {
      toast.error('Please select image files');
      return;
    }

    setCropQueue((prev) => [...prev, ...validFiles]);
    if (!activeCropFile) {
      setActiveCropFile(validFiles[0]);
      setCropQueue(validFiles.slice(1));
    }
  };

  const applyNextCrop = (croppedFile) => {
    setQueuedFiles((prev) => [...prev, croppedFile]);
    setActiveCropFile((_) => {
      if (cropQueue.length === 0) {
        return null;
      }
      const [next, ...rest] = cropQueue;
      setCropQueue(rest);
      return next;
    });
  };

  const skipCrop = () => {
    setActiveCropFile((_) => {
      if (cropQueue.length === 0) {
        return null;
      }
      const [next, ...rest] = cropQueue;
      setCropQueue(rest);
      return next;
    });
  };

  return (
    <DashboardLayout role={role}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Layers3 size={18} /> Gallery Studio
              </CardTitle>
              <p className="text-sm text-slate-600">Manage event albums and photos from one premium workspace.</p>
            </div>
            <div className="inline-flex rounded-lg border border-slate-200 p-1">
              <button
                type="button"
                onClick={() => setActiveTab('groups')}
                className={`rounded-md px-4 py-1.5 text-sm ${activeTab === 'groups' ? 'bg-slate-900 text-white' : 'text-slate-700'}`}
              >
                Gallery Groups
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('photos')}
                className={`rounded-md px-4 py-1.5 text-sm ${activeTab === 'photos' ? 'bg-slate-900 text-white' : 'text-slate-700'}`}
              >
                Manage Photos
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {activeTab === 'groups' && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button onClick={openCreateGroup}>Create Gallery Group</Button>
                </div>

                {groupsQuery.isLoading && <ImageSkeletonGrid items={6} />}

                {!groupsQuery.isLoading && groups.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                    <p className="text-sm font-medium text-slate-700">No gallery groups yet</p>
                  </div>
                )}

                {!groupsQuery.isLoading && groups.length > 0 && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {groups.map((group, index) => (
                      <div key={group.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                        <div className="aspect-[4/3] overflow-hidden rounded-lg bg-slate-100">
                          {group.coverImageUrl ? (
                            <img src={group.coverImageUrlOptimized || group.coverImageUrl} alt={group.title} className="h-full w-full object-cover" loading="lazy" />
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
                          <Button variant="secondary" className="h-8 px-2" onClick={() => openEditGroup(group)}><Pencil size={14} className="mr-1" /> Edit</Button>
                          <Button variant="secondary" className="h-8 px-2" onClick={() => setCoverUploadTargetGroup(group)}><ImagePlus size={14} className="mr-1" /> Cover</Button>
                          <Button variant="outline" className="h-8 px-2" onClick={() => updateGroupMutation.mutate({ id: group.id, payload: { isVisible: !group.isVisible } })}>
                            {group.isVisible ? <EyeOff size={14} className="mr-1" /> : <Eye size={14} className="mr-1" />}
                            {group.isVisible ? 'Hide' : 'Unhide'}
                          </Button>
                          <Button variant="danger" className="h-8 px-2" onClick={() => window.confirm(`Delete group \"${group.title}\" and all photos?`) && deleteGroupMutation.mutate(group.id)}>
                            <Trash2 size={14} className="mr-1" /> Delete
                          </Button>
                        </div>
                        <div className="mt-2 flex gap-2">
                          <Button variant="secondary" className="h-8 px-2" disabled={index === 0 || reorderGroupsMutation.isPending} onClick={() => moveGroup(index, -1)}><ArrowUp size={14} className="mr-1" /> Up</Button>
                          <Button variant="secondary" className="h-8 px-2" disabled={index === groups.length - 1 || reorderGroupsMutation.isPending} onClick={() => moveGroup(index, 1)}><ArrowDown size={14} className="mr-1" /> Down</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'photos' && (
              <div className="space-y-6">
                <div className="max-w-sm">
                  <label className="text-sm text-slate-700">Select Gallery Group</label>
                  <select className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" value={selectedGroupId} onChange={(event) => setSelectedGroupId(event.target.value)}>
                    <option value="">Select gallery group</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>{group.title}</option>
                    ))}
                  </select>
                </div>

                {!selectedGroupId && <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-600">Choose a gallery group to manage photos.</div>}

                {selectedGroupId && (
                  <>
                    <DropzoneUploader multiple onFiles={enqueueForCrop} helperText="Crop is mandatory before upload. Aspect ratio: 4:3" />

                    {queuedFiles.length > 0 && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm text-slate-700">{queuedFiles.length} photos ready to upload</p>
                          <Button onClick={() => uploadPhotosMutation.mutate(queuedFiles)} disabled={uploadPhotosMutation.isPending}><UploadCloud size={16} className="mr-1" /> {uploadPhotosMutation.isPending ? 'Uploading...' : 'Upload Now'}</Button>
                        </div>
                      </div>
                    )}

                    {photosQuery.isLoading && <ImageSkeletonGrid items={8} />}

                    {!photosQuery.isLoading && photos.length > 0 && (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {photos.map((photo, index) => (
                          <div key={photo.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                            <img src={photo.imageUrlOptimized || photo.imageUrl} alt={photo.caption || 'Gallery photo'} className="aspect-[4/3] w-full rounded-lg object-cover" loading="lazy" />
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <p className="line-clamp-1 text-sm text-slate-700">{photo.caption || 'No caption'}</p>
                              <Badge variant={photo.isVisible ? 'success' : 'muted'}>{photo.isVisible ? 'Visible' : 'Hidden'}</Badge>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <Button variant="secondary" className="h-8 px-2" onClick={() => { setEditPhoto(photo); setEditCaption(photo.caption || ''); }}><Pencil size={14} className="mr-1" /> Edit</Button>
                              <Button variant="outline" className="h-8 px-2" onClick={() => updatePhotoMutation.mutate({ id: photo.id, payload: { isVisible: !photo.isVisible } })}>
                                {photo.isVisible ? <EyeOff size={14} className="mr-1" /> : <Eye size={14} className="mr-1" />}
                                {photo.isVisible ? 'Hide' : 'Unhide'}
                              </Button>
                              <Button variant="secondary" className="h-8 px-2" disabled={index === 0} onClick={() => movePhoto(index, -1)}><ArrowUp size={14} className="mr-1" /> Up</Button>
                              <Button variant="secondary" className="h-8 px-2" disabled={index === photos.length - 1} onClick={() => movePhoto(index, 1)}><ArrowDown size={14} className="mr-1" /> Down</Button>
                              <Button variant="danger" className="col-span-2 h-8 px-2" onClick={() => window.confirm('Delete this photo?') && deletePhotoMutation.mutate(photo.id)}><Trash2 size={14} className="mr-1" /> Delete</Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Modal open={showGroupForm} onClose={() => setShowGroupForm(false)} title={editingGroup ? 'Edit Gallery Group' : 'Create Gallery Group'}>
          <form onSubmit={submitGroup} className="space-y-4">
            <div>
              <label className="text-sm text-slate-700">Title</label>
              <Input required value={groupForm.title} onChange={(event) => setGroupForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Annual Function 2026" />
            </div>
            <div>
              <label className="text-sm text-slate-700">Description</label>
              <textarea value={groupForm.description} onChange={(event) => setGroupForm((prev) => ({ ...prev, description: event.target.value }))} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200" rows={3} />
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={groupForm.isVisible} onChange={(event) => setGroupForm((prev) => ({ ...prev, isVisible: event.target.checked }))} />
              Visible on public gallery
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowGroupForm(false)}>Cancel</Button>
              <Button type="submit" disabled={createGroupMutation.isPending || updateGroupMutation.isPending}>{createGroupMutation.isPending || updateGroupMutation.isPending ? 'Saving...' : 'Save Group'}</Button>
            </div>
          </form>
        </Modal>

        <Modal open={Boolean(coverUploadTargetGroup)} onClose={() => { setCoverUploadTargetGroup(null); setCoverCropFile(null); }} title="Upload Cover Image">
          <div className="space-y-4">
            {!coverCropFile && <DropzoneUploader multiple={false} onFiles={(files) => setCoverCropFile(files[0])} helperText="Crop is mandatory before upload. Aspect ratio: 4:3" />}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setCoverCropFile(null)}>Reset</Button>
              <Button variant="secondary" onClick={() => setCoverUploadTargetGroup(null)}>Close</Button>
            </div>
          </div>
        </Modal>

        <ImageCropperModal
          open={Boolean(coverCropFile && coverUploadTargetGroup)}
          imageFile={coverCropFile}
          aspect={4 / 3}
          title="Crop Cover Image"
          onClose={() => setCoverCropFile(null)}
          onCropped={(croppedFile) => {
            uploadCoverMutation.mutate({ file: croppedFile, group: coverUploadTargetGroup });
            setCoverCropFile(null);
            setCoverUploadTargetGroup(null);
          }}
        />

        <ImageCropperModal
          open={Boolean(activeCropFile)}
          imageFile={activeCropFile}
          aspect={4 / 3}
          title="Crop Photo Before Upload"
          onClose={skipCrop}
          onCropped={applyNextCrop}
        />

        <Modal open={Boolean(editPhoto)} onClose={() => setEditPhoto(null)} title="Edit Photo">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!editPhoto) {
                return;
              }
              updatePhotoMutation.mutate({ id: editPhoto.id, payload: { caption: editCaption } });
            }}
          >
            <div>
              <label className="text-sm text-slate-700">Caption</label>
              <Input value={editCaption} onChange={(event) => setEditCaption(event.target.value)} placeholder="Write a caption" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditPhoto(null)}>Cancel</Button>
              <Button type="submit" disabled={updatePhotoMutation.isPending}>{updatePhotoMutation.isPending ? 'Saving...' : 'Save'}</Button>
            </div>
          </form>
        </Modal>
      </motion.div>
    </DashboardLayout>
  );
}
