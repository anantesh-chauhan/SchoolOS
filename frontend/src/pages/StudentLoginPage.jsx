import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authService } from '../services/authService';

const StudentLoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    studentUserId: '',
    password: '',
    userType: 'student', // 'student' or 'parent'
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (location.pathname.includes('parent')) {
      setFormData((prev) => ({ ...prev, userType: 'parent' }));
    } else if (location.pathname.includes('student')) {
      setFormData((prev) => ({ ...prev, userType: 'student' }));
    }
  }, [location.pathname]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.studentUserId.trim()) {
      newErrors.studentUserId = 'Email is required';
    } else if (!formData.studentUserId.includes('@')) {
      newErrors.studentUserId = 'Please enter a valid email';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 1) {
      newErrors.password = 'Password must not be empty';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      let result;
      if (formData.userType === 'student') {
        result = await authService.loginStudent(formData.studentUserId, formData.password);
      } else {
        result = await authService.loginParent(formData.studentUserId, formData.password);
      }

      toast.success(`Welcome, ${result.user.name}!`);
      const dashboardRoute = authService.getDashboardRouteByRole(result.user.role);
      navigate(dashboardRoute);
    } catch (error) {
      const message = error?.message || 'Login failed. Please check your credentials.';
      setErrors({ submit: message });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">SchoolOS</h1>
            <p className="text-slate-600">Student & Parent Portal</p>
          </div>

          {/* User Type Selector */}
          <div className="grid grid-cols-2 gap-2 mb-6">
            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, userType: 'student' }))}
              className={`py-2 px-4 rounded-lg font-medium transition ${
                formData.userType === 'student'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Student
            </button>
            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, userType: 'parent' }))}
              className={`py-2 px-4 rounded-lg font-medium transition ${
                formData.userType === 'parent'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Parent
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error Message */}
            {errors.submit && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                {errors.submit}
              </div>
            )}

            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {formData.userType === 'student' ? 'Student Email' : 'Parent Email'}
              </label>
              <input
                type="email"
                name="studentUserId"
                value={formData.studentUserId}
                onChange={handleInputChange}
                placeholder="example@school.schoolos.edu"
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                  errors.studentUserId ? 'border-red-500' : 'border-slate-300'
                }`}
              />
              {errors.studentUserId && (
                <p className="text-xs text-red-600 mt-1">{errors.studentUserId}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Password
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Enter your password"
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                  errors.password ? 'border-red-500' : 'border-slate-300'
                }`}
              />
              {errors.password && (
                <p className="text-xs text-red-600 mt-1">{errors.password}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Logging in...
                </>
              ) : (
                'Login'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="text-center mt-6 text-sm text-slate-600">
            <p>
              For admin login, use the{' '}
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-blue-600 hover:underline font-medium"
              >
                admin portal
              </button>
            </p>
            <div className="mt-2 flex items-center justify-center gap-3 text-xs text-slate-500">
              <button type="button" onClick={() => navigate('/student-login')} className="font-medium text-blue-600 hover:underline">
                Student portal
              </button>
              <span>•</span>
              <button type="button" onClick={() => navigate('/parent-login')} className="font-medium text-blue-600 hover:underline">
                Parent portal
              </button>
            </div>
          </div>

          {/* Info Box */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Demo:</strong> Use the credentials shown when you generate student/parent accounts from the admin panel.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentLoginPage;
