import React, { useRef } from 'react';
import { UploadCloud } from 'lucide-react';

export default function DropzoneUploader({
  accept = 'image/*',
  multiple = false,
  onFiles,
  helperText = 'Drag and drop files, or click to browse',
}) {
  const inputRef = useRef(null);

  const pickFiles = () => inputRef.current?.click();

  const emitFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length > 0) {
      onFiles(files);
    }
  };

  return (
    <div
      onClick={pickFiles}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        emitFiles(event.dataTransfer.files);
      }}
      className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center cursor-pointer hover:border-slate-400 hover:bg-slate-100 transition"
    >
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        className="hidden"
        onChange={(event) => emitFiles(event.target.files)}
      />
      <UploadCloud className="mx-auto text-slate-500" size={26} />
      <p className="mt-2 text-sm font-medium text-slate-700">Upload images</p>
      <p className="text-xs text-slate-500 mt-1">{helperText}</p>
    </div>
  );
}
