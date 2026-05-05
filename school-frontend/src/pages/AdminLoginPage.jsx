import React from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import apiClient from '../utils/apiClient.js';
import useAuthStore from '../context/authStore.js';

export const AdminLoginPage = () => {
  const navigate = useNavigate();
  const setTokens = useAuthStore((state) => state.setTokens);

  const [form, setForm] = React.useState({ email: 'admin@schoolplatform.com', password: 'Admin@123' });
  const [loading, setLoading] = React.useState(false);

  const login = async (event) => {
    event.preventDefault();
    try {
      setLoading(true);
      const response = await apiClient.post('/auth/admin/login', form);
      const data = response.data.data;
      setTokens(data.accessToken, data.refreshToken, data.user);
      toast.success('Login successful');
      navigate('/admin/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-[#f3f4f8] px-4">
      <form onSubmit={login} className="w-full max-w-md bg-white border rounded-xl p-7 space-y-3">
        <h1 className="text-2xl">Admin Login</h1>
        <label className="text-sm block">
          <span className="block mb-1">Email</span>
          <input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className="w-full border rounded-lg px-3 py-2" />
        </label>
        <label className="text-sm block">
          <span className="block mb-1">Password</span>
          <input type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} className="w-full border rounded-lg px-3 py-2" />
        </label>
        <button className="w-full bg-[var(--color-primary)] text-white rounded-lg py-2.5" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
};

export default AdminLoginPage;
