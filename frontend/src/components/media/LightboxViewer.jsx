import React from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export default function LightboxViewer({ photos = [], activeIndex = 0, open, onClose, onNext, onPrev }) {
  if (!open || photos.length === 0) {
    return null;
  }

  const photo = photos[activeIndex];

  return (
    <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute top-4 right-4 text-white/90 hover:text-white"
        onClick={onClose}
      >
        <X size={28} />
      </button>

      <button
        type="button"
        className="absolute left-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        onClick={onPrev}
      >
        <ChevronLeft size={24} />
      </button>

      <div className="max-h-[88vh] max-w-[92vw]">
        <img
          src={photo.imageUrlOptimized || photo.imageUrl}
          alt={photo.caption || 'Gallery image'}
          className="max-h-[80vh] max-w-[92vw] rounded-xl object-contain"
          loading="lazy"
        />
        {photo.caption && <p className="mt-3 text-center text-sm text-white/80">{photo.caption}</p>}
      </div>

      <button
        type="button"
        className="absolute right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        onClick={onNext}
      >
        <ChevronRight size={24} />
      </button>
    </div>
  );
}
