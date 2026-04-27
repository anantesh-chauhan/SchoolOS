import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CalendarDays, Image as ImageIcon } from 'lucide-react';
import DashboardLayout from '../layouts/DashboardLayout';
import { authService } from '../services/authService';
import { galleryService } from '../services/galleryService';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import ImageSkeletonGrid from '../components/media/ImageSkeletonGrid';
import LightboxViewer from '../components/media/LightboxViewer';

export default function GalleryPage() {
  const user = authService.getCurrentUser();
  const role = user?.role || 'STUDENT';
  const schoolId = user?.schoolId;

  const [selectedGroup, setSelectedGroup] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const groupsQuery = useQuery({
    queryKey: ['public-gallery-groups', schoolId],
    queryFn: () => galleryService.listPublicGroups(schoolId),
    enabled: Boolean(schoolId),
  });

  const photosQuery = useQuery({
    queryKey: ['public-gallery-photos', selectedGroup?.id, schoolId],
    queryFn: () => galleryService.listPublicPhotos(selectedGroup.id, schoolId),
    enabled: Boolean(selectedGroup?.id && schoolId),
  });

  const groups = useMemo(() => groupsQuery.data?.data || [], [groupsQuery.data]);
  const photos = useMemo(() => photosQuery.data?.data || [], [photosQuery.data]);

  return (
    <DashboardLayout role={role}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>School Gallery</CardTitle>
            <p className="text-sm text-slate-600">Event-based memories published by school administration.</p>
          </CardHeader>
          <CardContent>
            {groupsQuery.isLoading && <ImageSkeletonGrid items={6} />}

            {!groupsQuery.isLoading && groups.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <p className="text-sm font-medium text-slate-700">No gallery events available</p>
                <p className="mt-1 text-xs text-slate-500">Published events will appear here automatically.</p>
              </div>
            )}

            {!groupsQuery.isLoading && groups.length > 0 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {groups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => setSelectedGroup(group)}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm transition hover:shadow-md"
                  >
                    <div className="aspect-[4/3] bg-slate-100">
                      {group.coverImageUrl ? (
                        <img
                          src={group.coverImageUrlOptimized || group.coverImageUrl}
                          alt={group.title}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-slate-500">
                          <ImageIcon size={22} />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <p className="font-semibold text-slate-900 line-clamp-1">{group.title}</p>
                      <p className="mt-1 text-xs text-slate-500 line-clamp-2">{group.description || 'Event photo gallery'}</p>
                      <p className="mt-3 inline-flex items-center gap-1 text-xs text-slate-500">
                        <CalendarDays size={12} />
                        {group._count?.photos || 0} photos
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {selectedGroup && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>{selectedGroup.title}</CardTitle>
                  <p className="text-sm text-slate-600">{selectedGroup.description || 'Photo grid view'}</p>
                </div>
                <button
                  type="button"
                  className="text-sm text-blue-700"
                  onClick={() => setSelectedGroup(null)}
                >
                  Close
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {photosQuery.isLoading && <ImageSkeletonGrid items={10} />}

              {!photosQuery.isLoading && photos.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
                  No visible photos in this event.
                </div>
              )}

              {!photosQuery.isLoading && photos.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {photos.map((photo, index) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => {
                        setActiveIndex(index);
                        setLightboxOpen(true);
                      }}
                      className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
                    >
                      <img
                        src={photo.imageUrlOptimized || photo.imageUrl}
                        alt={photo.caption || 'Gallery photo'}
                        className="aspect-[4/3] h-full w-full object-cover"
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </motion.div>

      <LightboxViewer
        photos={photos}
        activeIndex={activeIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onNext={() => setActiveIndex((prev) => (prev + 1) % photos.length)}
        onPrev={() => setActiveIndex((prev) => (prev - 1 + photos.length) % photos.length)}
      />
    </DashboardLayout>
  );
}
