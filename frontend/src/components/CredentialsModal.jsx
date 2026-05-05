import React from 'react';
import PropTypes from 'prop-types';
import toast from 'react-hot-toast';

const CredentialsModal = ({ isOpen, credentials, onClose }) => {
  if (!isOpen || !credentials) return null;

  const handleCopyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const handleDownloadPDF = () => {
    if (credentials.pdfUrl) {
      const link = document.createElement('a');
      link.href = credentials.pdfUrl;
      link.download = `student-credentials-${credentials.studentUserId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-96 overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-900">Student Credentials</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          {/* Warning */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm font-semibold">
              ⚠️ Important: Store these credentials securely. Passwords will not be shown again!
            </p>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 text-sm">
              <strong>📝 Login Instructions:</strong>
            </p>
            <ul className="text-blue-700 text-sm mt-2 space-y-1 list-disc list-inside">
              <li>Student: Visit <code className="bg-blue-100 px-1 rounded">/student-login</code> with Student User ID</li>
              <li>Parent: Visit <code className="bg-blue-100 px-1 rounded">/student-login</code> (select Parent tab) with Parent User ID</li>
            </ul>
          </div>

          {/* Serial Number */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Serial Number
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={credentials.serialNo}
                className="flex-1 bg-slate-100 border border-slate-300 rounded px-3 py-2"
              />
              <button
                onClick={() => handleCopyToClipboard(credentials.serialNo, 'Serial Number')}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded font-medium"
              >
                Copy
              </button>
            </div>
          </div>

          {/* Student User ID */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Student User ID (Email)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={credentials.studentUserId}
                className="flex-1 bg-slate-100 border border-slate-300 rounded px-3 py-2 text-sm"
              />
              <button
                onClick={() => handleCopyToClipboard(credentials.studentUserId, 'Student ID')}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded font-medium"
              >
                Copy
              </button>
            </div>
          </div>

          {/* Student Password */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Student Password
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={credentials.studentPassword}
                className="flex-1 bg-slate-100 border border-slate-300 rounded px-3 py-2 font-mono"
              />
              <button
                onClick={() => handleCopyToClipboard(credentials.studentPassword, 'Student Password')}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded font-medium"
              >
                Copy
              </button>
            </div>
          </div>

          {/* Parent User ID */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Parent User ID (Email)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={credentials.parentUserId}
                className="flex-1 bg-slate-100 border border-slate-300 rounded px-3 py-2 text-sm"
              />
              <button
                onClick={() => handleCopyToClipboard(credentials.parentUserId, 'Parent ID')}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded font-medium"
              >
                Copy
              </button>
            </div>
          </div>

          {/* Parent Password */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Parent Password
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={credentials.parentPassword}
                className="flex-1 bg-slate-100 border border-slate-300 rounded px-3 py-2 font-mono"
              />
              <button
                onClick={() => handleCopyToClipboard(credentials.parentPassword, 'Parent Password')}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded font-medium"
              >
                Copy
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6">
          {credentials.pdfUrl && (
            <button
              onClick={handleDownloadPDF}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium"
            >
              Download PDF
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

CredentialsModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  credentials: PropTypes.shape({
    serialNo: PropTypes.number,
    studentUserId: PropTypes.string,
    studentPassword: PropTypes.string,
    parentUserId: PropTypes.string,
    parentPassword: PropTypes.string,
    pdfUrl: PropTypes.string,
  }),
  onClose: PropTypes.func.isRequired,
};

CredentialsModal.defaultProps = {
  credentials: null,
};

export default CredentialsModal;
