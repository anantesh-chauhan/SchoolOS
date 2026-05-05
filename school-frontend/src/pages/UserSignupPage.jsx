import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiUserPlus } from 'react-icons/fi';
import apiClient from '../utils/apiClient.js';
import { getSchoolConfig } from '../config/schoolConfig.js';

const school = getSchoolConfig();

export const UserSignupPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(false);
  const [form, setForm] = React.useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    acceptedPolicies: false,
  });

  const submit = async (event) => {
    event.preventDefault();
    if (!form.acceptedPolicies) {
      toast.error('Please accept Terms and Privacy Policy to continue.');
      return;
    }
    try {
      setLoading(true);
      await apiClient.post('/auth/register', {
        ...form,
        schoolId: school.schoolId,
        role: 'content_editor',
      });
      toast.success('Account created. Please sign in.');
      navigate('/login');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-[#f3f4f8] px-4">
      <form onSubmit={submit} className="w-full max-w-lg bg-white border rounded-xl p-7 space-y-4 shadow-sm">
        <h1 className="text-2xl flex items-center gap-2"><FiUserPlus /> User Sign Up</h1>
        <p className="text-sm text-[var(--color-muted)]">Create your account to access parent and student protected modules.</p>

        <div className="grid md:grid-cols-2 gap-3">
          <input
            placeholder="First Name"
            value={form.firstName}
            onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2"
            required
          />
          <input
            placeholder="Last Name"
            value={form.lastName}
            onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2"
            required
          />
        </div>

        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
          className="w-full border rounded-lg px-3 py-2"
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
          className="w-full border rounded-lg px-3 py-2"
          minLength={8}
          required
        />

        <label className="flex items-start gap-2 text-sm text-[var(--color-muted)]">
          <input type="checkbox" checked={Boolean(form.acceptedPolicies)} onChange={(e) => setForm((p) => ({ ...p, acceptedPolicies: e.target.checked }))} className="mt-1" />
          <span>I agree to the <Link className="text-[var(--color-primary)] font-semibold" to="/terms">Terms</Link> and <Link className="text-[var(--color-primary)] font-semibold" to="/privacy">Privacy Policy</Link>.</span>
        </label>

        <button className="w-full bg-[var(--color-primary)] text-white rounded-lg py-2.5" disabled={loading}>
          {loading ? 'Creating account...' : 'Create Account'}
        </button>

        <div className="text-sm text-[var(--color-muted)]">
          Already registered? <Link className="text-[var(--color-primary)] font-semibold" to="/login">User Sign In</Link>
        </div>
      </form>
    </div>
  );
};

export default UserSignupPage;
