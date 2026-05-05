import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import apiClient from '../utils/apiClient.js';
import useAuthStore from '../context/authStore.js';
import { getSchoolConfig } from '../config/schoolConfig.js';

const school = getSchoolConfig();

export const UserLoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const setTokens = useAuthStore((state) => state.setTokens);
  const setUser = useAuthStore((state) => state.setUser);

  const [form, setForm] = React.useState({
    email: 'parent@ddpublicschool.com',
    password: 'Parent@123',
  });
  const [loading, setLoading] = React.useState(false);

  const destination = location.state?.from?.pathname || '/';

  const login = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);
      const response = await apiClient.post('/auth/login', {
        ...form,
        schoolId: school.schoolId,
      });
      const data = response.data.data;
      setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
      toast.success('Welcome back');
      navigate(destination, { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-[#f3f4f8] px-4">
      <form onSubmit={login} className="w-full max-w-md bg-white border rounded-xl p-7 space-y-4 shadow-sm">
        <h1 className="text-2xl">User Sign In</h1>
        <p className="text-sm text-[var(--color-muted)]">Use your registered account to access protected school modules.</p>

        <label className="text-sm block">
          <span className="block mb-1">Email</span>
          <input
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2"
          />
        </label>

        <label className="text-sm block">
          <span className="block mb-1">Password</span>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2"
          />
        </label>

        <button className="w-full bg-[var(--color-primary)] text-white rounded-lg py-2.5" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <div className="text-xs text-[var(--color-muted)]">
          New user? <Link className="text-[var(--color-primary)] font-semibold" to="/signup">Create account</Link>
          {' | '}
          Admin user? <Link className="text-[var(--color-primary)] font-semibold" to="/admin/login">Go to admin login</Link>
        </div>
      </form>
    </div>
  );
};

export default UserLoginPage;
