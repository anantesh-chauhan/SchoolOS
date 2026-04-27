import React, { useMemo, useState } from 'react';
import Cropper from 'react-easy-crop';
import { Modal } from '../ui/dialog';
import { Button } from '../ui/button';
import { getCroppedFile } from './imageCrop.util';

export default function ImageCropperModal({
  open,
  imageFile,
  aspect = 4 / 3,
  title = 'Crop Image',
  onClose,
  onCropped,
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [loading, setLoading] = useState(false);

  const imageUrl = useMemo(() => {
    if (!imageFile) {
      return null;
    }

    return URL.createObjectURL(imageFile);
  }, [imageFile]);

  const onCropComplete = (_, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  };

  const handleConfirm = async () => {
    if (!imageUrl || !croppedAreaPixels) {
      return;
    }

    setLoading(true);
    try {
      const croppedFile = await getCroppedFile(imageUrl, croppedAreaPixels, imageFile.name || 'cropped.jpg');
      onCropped(croppedFile);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div className="relative h-[320px] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
          {imageUrl && (
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              minZoom={1}
              maxZoom={3}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </div>

        <div>
          <label className="text-sm text-slate-600">Zoom</label>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="mt-1 w-full"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={loading || !imageFile}>
            {loading ? 'Cropping...' : 'Apply Crop'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
