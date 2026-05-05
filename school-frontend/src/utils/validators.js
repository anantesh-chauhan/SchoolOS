/**
 * Validation utilities
 */

export const isValidEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

export const isValidPhone = (phone) => {
  const regex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
  return regex.test(phone);
};

export const isValidURL = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const validateAdmissionForm = (data) => {
  const errors = {};
  
  if (!data.studentName) errors.studentName = 'Student name is required';
  if (!data.parentName) errors.parentName = 'Parent name is required';
  if (!data.email || !isValidEmail(data.email)) errors.email = 'Valid email is required';
  if (!data.phone || !isValidPhone(data.phone)) errors.phone = 'Valid phone is required';
  if (!data.classApplying) errors.classApplying = 'Class is required';
  
  return errors;
};

export const validateContactForm = (data) => {
  const errors = {};
  
  if (!data.name) errors.name = 'Name is required';
  if (!data.email || !isValidEmail(data.email)) errors.email = 'Valid email is required';
  if (!data.message || data.message.length < 10) errors.message = 'Message must be at least 10 characters';
  
  return errors;
};
