import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Trash2, UploadCloud } from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { authService } from '../../services/authService';
import { galleryService } from '../../services/galleryService';
import { cloudinaryUploadService } from '../../services/cloudinaryUploadService';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/dialog';
import { Badge } from '../../components/ui/badge';
import DropzoneUploader from '../../components/media/DropzoneUploader';
import ImageCropperModal from '../../components/media/ImageCropperModal';
import ImageSkeletonGrid from '../../components/media/ImageSkeletonGrid';

export default function GalleryManagePhotosPage() {
  const user = authService.getCurrentUser();
  const role = user?.role || 'ADMIN';
  const schoolId = user?.schoolId;
  const queryClient = useQueryClient();

  const [selectedGroupId, setSelectedGroupId] = useState('');
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

  const uploadMutation = useMutation({
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

  const reorderMutation = useMutation({
    mutationFn: (order) => galleryService.reorderPhotos(selectedGroupId, order),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gallery-photos', selectedGroupId] }),
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to reorder photos'),
  });

  const groups = useMemo(() => groupsQuery.data?.data || [], [groupsQuery.data]);
  const photos = useMemo(() => photosQuery.data?.data || [], [photosQuery.data]);

  const enqueueForCrop = (files) => {
    const valid = files.filter((file) => file.type.startsWith('image/'));
    if (valid.length === 0) {
      toast.error('Please select image files');
      return;
    }

    setCropQueue((prev) => [...prev, ...valid]);
    if (!activeCropFile) {
      setActiveCropFile(valid[0]);
      setCropQueue(valid.slice(1));
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

  const movePhoto = (index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= photos.length) {
      return;
    }

    const reordered = [...photos];
    [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
    reorderMutation.mutate(reordered.map((photo, idx) => ({ id: photo.id, displayOrder: idx + 1 })));
  };

  return (
    <DashboardLayout role={role}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Manage Gallery Photos</CardTitle>
                <p className="text-sm text-slate-600">Upload multiple photos, set captions, visibility, and order within each event group.</p>
              </div>

              <select
                className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                value={selectedGroupId}
                onChange={(event) => setSelectedGroupId(event.target.value)}
              >
                <option value="">Select gallery group</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>{group.title}</option>
                ))}
              </select>
            </div>
          </CardHeader>

          <CardContent>
            {!selectedGroupId && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-600">
                Choose a gallery group to manage photos.
              </div>
            )}

            {selectedGroupId && (
              <div className="space-y-6">
                <DropzoneUploader
                  multiple
                  onFiles={enqueueForCrop}
                  helperText="Crop is mandatory before upload. Aspect ratio: 4:3"
                />

                {queuedFiles.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-slate-700">{queuedFiles.length} photos ready to upload</p>
                      <Button onClick={() => uploadMutation.mutate(queuedFiles)} disabled={uploadMutation.isPending}>
                        <UploadCloud size={16} className="mr-1" />
                        {uploadMutation.isPending ? 'Uploading...' : 'Upload Now'}
                      </Button>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                      {queuedFiles.map((file, index) => (
                        <div key={index} className="rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-600 truncate">
                          {file.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {photosQuery.isLoading && <ImageSkeletonGrid items={8} />}

                {!photosQuery.isLoading && photos.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                    <p className="text-sm font-medium text-slate-700">No photos in this group</p>
                    <p className="text-xs text-slate-500 mt-1">Upload images to start building this event gallery.</p>
                  </div>
                )}

                {!photosQuery.isLoading && photos.length > 0 && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {photos.map((photo, index) => (
                      <div key={photo.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                        <img
                          src={photo.imageUrlOptimized || photo.imageUrl}
                          alt={photo.caption || 'Gallery photo'}
                          className="aspect-[4/3] w-full rounded-lg object-cover"
                          loading="lazy"
                        />
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <p className="line-clamp-1 text-sm text-slate-700">{photo.caption || 'No caption'}</p>
                          <Badge variant={photo.isVisible ? 'success' : 'muted'}>{photo.isVisible ? 'Visible' : 'Hidden'}</Badge>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <Button
                            variant="secondary"
                            className="h-8 px-2"
                            onClick={() => {
                              setEditPhoto(photo);
                              setEditCaption(photo.caption || '');
                            }}
                          >
                            <Pencil size={14} className="mr-1" /> Edit
                          </Button>

                          <Button
                            variant="outline"
                            className="h-8 px-2"
                            onClick={() => updatePhotoMutation.mutate({ id: photo.id, payload: { isVisible: !photo.isVisible } })}
                          >
                            {photo.isVisible ? <EyeOff size={14} className="mr-1" /> : <Eye size={14} className="mr-1" />}
                            {photo.isVisible ? 'Hide' : 'Unhide'}
                          </Button>

                          <Button
                            variant="secondary"
                            className="h-8 px-2"
                            disabled={index === 0}
                            onClick={() => movePhoto(index, -1)}
                          >
                            <ArrowUp size={14} className="mr-1" /> Up
                          </Button>
                          <Button
                            variant="secondary"
                            className="h-8 px-2"
                            disabled={index === photos.length - 1}
                            onClick={() => movePhoto(index, 1)}
                          >
                            <ArrowDown size={14} className="mr-1" /> Down
                          </Button>

                          <Button
                            variant="danger"
                            className="col-span-2 h-8 px-2"
                            onClick={() => {
                              if (window.confirm('Delete this photo?')) {
                                deletePhotoMutation.mutate(photo.id);
                              }
                            }}
                          >
                            <Trash2 size={14} className="mr-1" /> Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

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
              <Button type="submit" disabled={updatePhotoMutation.isPending}>
                {updatePhotoMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </form>
        </Modal>

        <ImageCropperModal
          open={Boolean(activeCropFile)}
          imageFile={activeCropFile}
          aspect={4 / 3}
          title="Crop Photo Before Upload"
          onClose={skipCrop}
          onCropped={applyNextCrop}
        />
      </div>
    </DashboardLayout>
  );
}
