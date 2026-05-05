import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import apiClient from '../services/api';
import { classService } from '../services/managementService';
import CredentialsModal from './CredentialsModal';

const sessionOptions = ['2026-27', '2025-26', '2024-25'];
const genderOptions = ['Male', 'Female', 'Other'];

const getTodayIsoDate = () => new Date().toISOString().slice(0, 10);

const createInitialState = () => ({
  firstName: '',
  lastName: '',
  dob: '',
  gender: '',
  currentClass: '',
  admissionDate: getTodayIsoDate(),
  fatherName: '',
  motherName: '',
  parentMobile: '',
  alternateMobile: '',
  address: '',
  session: sessionOptions[0],
});

const normalizeDigits = (value) => String(value ?? '').replace(/\D/g, '');

const validate = (values) => {
  const errors = {};

  if (!values.firstName.trim()) errors.firstName = 'First name is required';
  if (!values.dob) errors.dob = 'Date of birth is required';
  if (!values.gender) errors.gender = 'Gender is required';
  if (!values.currentClass) errors.currentClass = 'Class is required';
  if (!values.fatherName.trim()) errors.fatherName = 'Father name is required';
  if (!values.parentMobile.trim()) {
    errors.parentMobile = 'Parent mobile is required';
  } else if (!/^\d{10}$/.test(normalizeDigits(values.parentMobile))) {
    errors.parentMobile = 'Parent mobile must be exactly 10 digits';
  }
  if (!values.session.trim()) errors.session = 'Session is required';

  if (values.alternateMobile.trim() && !/^\d{10}$/.test(normalizeDigits(values.alternateMobile))) {
    errors.alternateMobile = 'Alternate mobile must be exactly 10 digits';
  }

  return errors;
};

const Field = ({ label, children, error, hint }) => (
  <div className="space-y-1.5">
    <label className="block text-sm font-medium text-slate-700">{label}</label>
    {children}
    {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
    {error && <p className="text-xs text-red-600">{error}</p>}
  </div>
);

Field.propTypes = {
  label: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  error: PropTypes.string,
  hint: PropTypes.string,
};

Field.defaultProps = {
  error: null,
  hint: null,
};

const StudentForm = ({ onSave }) => {
  const [values, setValues] = useState(createInitialState);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [savedStudentId, setSavedStudentId] = useState(null);
  const [generatingCredentials, setGeneratingCredentials] = useState(false);
  const [credentials, setCredentials] = useState(null);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);

  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: classService.list,
  });

  const classOptions = useMemo(() => classesQuery.data?.data || [], [classesQuery.data]);

  useEffect(() => {
    if (!classesQuery.isError) {
      return;
    }

    toast.error(classesQuery.error?.response?.data?.message || 'Failed to load classes');
  }, [classesQuery.error, classesQuery.isError]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    if (savedStudentId) {
      setSavedStudentId(null);
      setCredentials(null);
      setShowCredentialsModal(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validationErrors = validate(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        studentFirstName: values.firstName.trim(),
        studentLastName: values.lastName.trim(),
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        dob: values.dob,
        gender: values.gender,
        currentClass: values.currentClass,
        className: values.currentClass,
        studentClass: values.currentClass,
        admissionDate: values.admissionDate || undefined,
        fatherName: values.fatherName.trim(),
        motherName: values.motherName.trim(),
        parentMobile: normalizeDigits(values.parentMobile),
        alternateMobile: normalizeDigits(values.alternateMobile),
        address: values.address.trim(),
        session: values.session,
      };

      const response = await apiClient.post('/students', payload);

      if (response.data.success) {
        toast.success(response.data.message || 'Student saved successfully');
        const createdStudent = response.data.data.student || {};
        setSavedStudentId(response.data.data.id || createdStudent.id || null);
        setCredentials(response.data.data.credentials || null);
        setShowCredentialsModal(Boolean(response.data.data.credentials));
        setValues(createInitialState());
        setErrors({});
        if (typeof onSave === 'function') {
          onSave(response.data.data);
        }
      }
    } catch (error) {
      console.error('Error saving student:', error);
      const errorMessage = error.response?.data?.message || 'Failed to save student';
      const errorErrors = error.response?.data?.errors || {};
      toast.error(errorMessage);
      if (Object.keys(errorErrors).length > 0) {
        setErrors(errorErrors);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateCredentials = async () => {
    if (!savedStudentId) {
      toast.error('Please save the student first');
      return;
    }

    setGeneratingCredentials(true);
    try {
      const response = await apiClient.post('/students/generate-all', {
        studentId: savedStudentId,
      });

      if (response.data.success) {
        toast.success('Credentials generated successfully');
        setCredentials(response.data.data);
        setShowCredentialsModal(true);
      }
    } catch (error) {
      console.error('Error generating credentials:', error);
      toast.error(error.response?.data?.message || 'Failed to generate credentials');
    } finally {
      setGeneratingCredentials(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-5xl">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 px-6 py-5 text-white sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-300">Admissions</p>
          <h2 className="mt-2 text-2xl font-semibold">Add Student</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Create a student record, assign a class, and generate one-click credentials after the admission is saved.
          </p>
        </div>

        <div className="space-y-8 px-6 py-6 sm:px-8">
          <section>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Student Information</h3>
                <p className="text-sm text-slate-500">Core identity and admission details.</p>
              </div>
              {savedStudentId && (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Saved, ready for credential generation
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Student First Name" error={errors.firstName}>
                <input
                  name="firstName"
                  value={values.firstName}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="First name"
                />
              </Field>

              <Field label="Student Last Name">
                <input
                  name="lastName"
                  value={values.lastName}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Last name"
                />
              </Field>

              <Field label="Date of Birth" error={errors.dob}>
                <input
                  type="date"
                  name="dob"
                  value={values.dob}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </Field>

              <Field label="Gender" error={errors.gender}>
                <select
                  name="gender"
                  value={values.gender}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">Select gender</option>
                  {genderOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="Class"
                error={errors.currentClass}
                hint={classesQuery.isLoading ? 'Loading classes from the server...' : 'Select the class where this student will be admitted.'}
              >
                <select
                  name="currentClass"
                  value={values.currentClass}
                  onChange={handleChange}
                  disabled={classesQuery.isLoading}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition disabled:cursor-not-allowed disabled:bg-slate-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">
                    {classesQuery.isLoading ? 'Loading classes...' : 'Select class'}
                  </option>
                  {classOptions.map((row) => (
                    <option key={row.id} value={row.className}>
                      {row.className}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Admission Date">
                <input
                  type="date"
                  name="admissionDate"
                  value={values.admissionDate}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </Field>
            </div>
          </section>

          <section>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Parent Information</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Father Name" error={errors.fatherName}>
                <input
                  name="fatherName"
                  value={values.fatherName}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Father's name"
                />
              </Field>

              <Field label="Mother Name">
                <input
                  name="motherName"
                  value={values.motherName}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Mother's name"
                />
              </Field>

              <Field label="Parent Mobile" error={errors.parentMobile}>
                <input
                  name="parentMobile"
                  value={values.parentMobile}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="10-digit mobile number"
                />
              </Field>

              <Field label="Alternate Mobile" error={errors.alternateMobile}>
                <input
                  name="alternateMobile"
                  value={values.alternateMobile}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Optional alternate number"
                />
              </Field>

              <div className="md:col-span-2">
                <Field label="Address">
                  <textarea
                    name="address"
                    value={values.address}
                    onChange={handleChange}
                    rows={3}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Home address"
                  />
                </Field>
              </div>
            </div>
          </section>

          <section>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Academic Info</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Session" error={errors.session}>
                <select
                  name="session"
                  value={values.session}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  {sessionOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </section>

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center">
            <button
              type="submit"
              disabled={submitting || classesQuery.isLoading}
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
            >
              {submitting ? (
                <>
                  <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Saving...
                </>
              ) : (
                'Save Student'
              )}
            </button>

            <button
              type="button"
              disabled={!savedStudentId || generatingCredentials}
              onClick={handleGenerateCredentials}
              className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
            >
              {generatingCredentials ? (
                <>
                  <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Generating...
                </>
              ) : (
                'Generate Credentials'
              )}
            </button>
          </div>
        </div>
      </div>

      <CredentialsModal
        isOpen={showCredentialsModal}
        credentials={credentials}
        onClose={() => setShowCredentialsModal(false)}
      />
    </form>
  );
};

StudentForm.propTypes = {
  onSave: PropTypes.func,
};

StudentForm.defaultProps = {
  onSave: null,
};

export default StudentForm;
