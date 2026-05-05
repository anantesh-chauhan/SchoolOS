import React, { useMemo, useState } from "react";
import Cropper from "react-easy-crop";
import { Modal } from "../ui/dialog";
import { Button } from "../ui/button";
import { getCroppedFile } from "./imageCrop.util";
import { motion } from "framer-motion";

export default function ImageCropperModal({
  open,
  imageFile,
  aspect = 4 / 3,
  title = "Crop Image",
  onClose,
  onCropped,
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] =
    useState(null);
  const [loading, setLoading] = useState(false);

  const imageUrl = useMemo(() => {
    if (!imageFile) return null;
    return URL.createObjectURL(imageFile);
  }, [imageFile]);

  const onCropComplete = (_, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  };

  const handleConfirm = async () => {
    if (!imageUrl || !croppedAreaPixels) return;

    setLoading(true);

    try {
      const croppedFile =
        await getCroppedFile(
          imageUrl,
          croppedAreaPixels,
          imageFile.name || "cropped.jpg"
        );

      onCropped(croppedFile);
      onClose();

    } finally {

      setLoading(false);

    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
    >

      <div className="space-y-6">

        {/* Crop Container */}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="
            relative
            h-[340px]
            w-full
            overflow-hidden
            rounded-2xl
            border
            border-slate-200
            bg-slate-900
            shadow-inner
          "
        >

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

        </motion.div>

        {/* Zoom Controls */}

        <div className="space-y-2">

          <div className="flex items-center justify-between">

            <label
              className="
                text-sm
                font-medium
                text-slate-700
              "
            >
              Zoom Level
            </label>

            <span
              className="
                text-xs
                text-slate-500
                font-medium
              "
            >
              {zoom.toFixed(2)}x
            </span>

          </div>

          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(event) =>
              setZoom(
                Number(event.target.value)
              )
            }
            className="
              w-full
              cursor-pointer
              accent-blue-600
            "
          />

        </div>

        {/* Footer */}

        <div
          className="
            flex
            items-center
            justify-between
            pt-4
            border-t
            border-slate-200
          "
        >

          <p
            className="
              text-xs
              text-slate-500
            "
          >
            Adjust the crop area before applying changes
          </p>

          <div className="flex gap-2">

            <Button
              variant="secondary"
              onClick={onClose}
            >
              Cancel
            </Button>

            <Button
              onClick={handleConfirm}
              disabled={
                loading || !imageFile
              }
              className="
                min-w-[120px]
              "
            >

              {loading
                ? "Cropping..."
                : "Apply Crop"}

            </Button>

          </div>

        </div>

      </div>

    </Modal>
  );
}