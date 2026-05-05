import React, { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { motion } from "framer-motion";

export default function DropzoneUploader({
  accept = "image/*",
  multiple = false,
  onFiles,
  helperText = "Drag and drop files, or click to browse",
}) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const pickFiles = () => inputRef.current?.click();

  const emitFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length > 0) {
      onFiles(files);
    }
  };

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={pickFiles}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        emitFiles(event.dataTransfer.files);
      }}
      className={`
        relative
        cursor-pointer
        overflow-hidden
        rounded-2xl
        border-2
        border-dashed
        p-8
        text-center
        transition-all
        duration-200
        ${
          isDragging
            ? "border-blue-500 bg-blue-50 shadow-lg"
            : "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100"
        }
      `}
    >
      {/* Hidden Input */}

      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        className="hidden"
        onChange={(event) =>
          emitFiles(event.target.files)
        }
      />

      {/* Content */}

      <div className="flex flex-col items-center justify-center">

        {/* Icon */}

        <motion.div
          animate={{
            y: isDragging ? -4 : 0,
            scale: isDragging ? 1.08 : 1,
          }}
          transition={{
            type: "spring",
            stiffness: 260,
            damping: 18,
          }}
          className={`
            mb-4
            flex
            items-center
            justify-center
            rounded-full
            p-4
            ${
              isDragging
                ? "bg-blue-100 text-blue-600"
                : "bg-white text-slate-500 shadow-sm"
            }
          `}
        >

          <UploadCloud size={28} />

        </motion.div>

        {/* Title */}

        <p
          className="
            text-sm
            font-semibold
            text-slate-800
          "
        >

          Upload files

        </p>

        {/* Helper Text */}

        <p
          className="
            mt-2
            max-w-xs
            text-xs
            text-slate-500
          "
        >

          {helperText}

        </p>

        {/* Drag Hint */}

        <p
          className="
            mt-3
            text-[11px]
            uppercase
            tracking-wider
            text-slate-400
          "
        >

          {multiple
            ? "Supports multiple files"
            : "Single file upload"}

        </p>

      </div>

      {/* Glow Effect */}

      {isDragging && (
        <motion.div
          layoutId="drag-glow"
          className="
            absolute
            inset-0
            rounded-2xl
            ring-2
            ring-blue-400
            ring-offset-2
            pointer-events-none
          "
        />
      )}

    </motion.div>
  );
}