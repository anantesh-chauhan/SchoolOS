import React from 'react';
import toast from 'react-hot-toast';
import apiClient from '../utils/apiClient.js';

export const AdminMediaUploadPage = () => {
  const [file, setFile] = React.useState(null);
  const [folder, setFolder] = React.useState('general');
  const [loading, setLoading] = React.useState(false);

  const upload = async (event) => {
    event.preventDefault();
    if (!file) {
      toast.error('Select a file to upload');
      return;
    }

    try {
      setLoading(true);
      const signatureResponse = await apiClient.get(`/media/signature?folder=${encodeURIComponent(folder)}`);
      const { cloudName, apiKey, timestamp, signature } = signatureResponse.data.data;

      const payload = new FormData();
      payload.append('file', file);
      payload.append('folder', folder);
      payload.append('timestamp', String(timestamp));
      payload.append('api_key', apiKey);
      payload.append('signature', signature);

      const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: payload,
      });

      const uploaded = await uploadResponse.json();
      if (!uploadResponse.ok) {
        throw new Error(uploaded.error?.message || 'Cloudinary upload failed');
      }

      await apiClient.post('/media', {
        fileName: uploaded.original_filename || file.name,
        originalName: file.name,
        fileType: 'image',
        mimeType: file.type,
        fileSize: file.size,
        url: uploaded.secure_url,
        cloudinaryPublicId: uploaded.public_id,
        folder,
        dimensions: {
          width: uploaded.width,
          height: uploaded.height,
        },
      });

      toast.success('Media uploaded and stored successfully');
      setFile(null);
    } catch (error) {
      toast.error(error.message || error.response?.data?.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-white rounded-xl border p-5 mb-6">
      <h2 className="text-xl mb-4">Media Upload</h2>
      <form className="grid md:grid-cols-2 gap-3" onSubmit={upload}>
        <label className="text-sm md:col-span-2">Select Image
          <input type="file" accept="image/*" className="w-full border rounded-lg px-3 py-2" onChange={(event) => setFile(event.target.files?.[0] || null)} required />
        </label>
        <label className="text-sm">Folder
          <input value={folder} onChange={(event) => setFolder(event.target.value)} className="w-full border rounded-lg px-3 py-2" />
        </label>
        <div className="md:col-span-2">
          <button className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white" disabled={loading}>
            {loading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </form>
    </section>
  );
};

export default AdminMediaUploadPage;
