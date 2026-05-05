import React, { useEffect } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function LightboxViewer({
  photos = [],
  activeIndex = 0,
  open,
  onClose,
  onNext,
  onPrev,
}) {
  if (!open || photos.length === 0) {
    return null;
  }

  const photo = photos[activeIndex];

  // Keyboard Navigation

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }

      if (e.key === "ArrowRight") {
        onNext?.();
      }

      if (e.key === "ArrowLeft") {
        onPrev?.();
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () =>
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
  }, [onClose, onNext, onPrev]);

  return (
    <AnimatePresence>

      {open && (

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="
            fixed
            inset-0
            z-[60]
            bg-black/90
            backdrop-blur-sm
            flex
            items-center
            justify-center
            p-4
          "
        >

          {/* Close Button */}

          <button
            type="button"
            className="
              absolute
              top-4
              right-4
              rounded-full
              bg-white/10
              p-2
              text-white
              hover:bg-white/20
              transition
            "
            onClick={onClose}
          >
            <X size={26} />
          </button>

          {/* Previous */}

          <button
            type="button"
            className="
              absolute
              left-4
              rounded-full
              bg-white/10
              p-3
              text-white
              hover:bg-white/20
              transition
            "
            onClick={onPrev}
          >
            <ChevronLeft size={26} />
          </button>

          {/* Image Area */}

          <motion.div
            key={activeIndex}
            initial={{
              opacity: 0,
              scale: 0.96,
            }}
            animate={{
              opacity: 1,
              scale: 1,
            }}
            transition={{
              duration: 0.2,
            }}
            className="
              max-h-[88vh]
              max-w-[92vw]
              text-center
            "
          >

            <img
              src={
                photo.imageUrlOptimized ||
                photo.imageUrl
              }
              alt={
                photo.caption ||
                "Gallery image"
              }
              className="
                max-h-[80vh]
                max-w-[92vw]
                rounded-2xl
                object-contain
                shadow-2xl
              "
              loading="lazy"
            />

            {/* Caption */}

            {photo.caption && (

              <div
                className="
                  mt-4
                  inline-block
                  rounded-xl
                  bg-white/10
                  px-4
                  py-2
                  backdrop-blur
                "
              >

                <p
                  className="
                    text-sm
                    text-white/90
                  "
                >
                  {photo.caption}
                </p>

              </div>

            )}

            {/* Image Counter */}

            <div
              className="
                mt-3
                text-xs
                text-white/60
              "
            >

              {activeIndex + 1} / {photos.length}

            </div>

          </motion.div>

          {/* Next */}

          <button
            type="button"
            className="
              absolute
              right-4
              rounded-full
              bg-white/10
              p-3
              text-white
              hover:bg-white/20
              transition
            "
            onClick={onNext}
          >
            <ChevronRight size={26} />
          </button>

        </motion.div>

      )}

    </AnimatePresence>
  );
}