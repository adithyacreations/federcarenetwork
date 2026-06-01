import { useState, useMemo } from 'react';
import { FiUpload, FiClipboard } from 'react-icons/fi';
import toast from 'react-hot-toast';

import DashboardLayout from '../../components/common/DashboardLayout';
import useApi from '../../hooks/useApi';
import API from '../../api/axios';
import { formatTime12hr } from '../../utils/timeUtils';

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'processing', label: 'Processing' },
  { key: 'completed', label: 'Completed' },
];

const SOURCE_TABS = [
  { key: 'all', label: 'All Orders' },
  { key: 'doctor_referred', label: '👨‍⚕️ Doctor Referred' },
  { key: 'patient_booking', label: '👤 Self-Booked' },
];

const PriorityBadge = ({ priority }) => {
  const p = String(priority || 'normal').toLowerCase();
  const map = {
    stat: 'bg-red-100 text-red-700',
    urgent: 'bg-orange-100 text-orange-700',
    normal: 'bg-blue-100 text-blue-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${map[p] || 'bg-gray-100 text-gray-600'}`}>
      {p}
    </span>
  );
};

const StatusBadge = ({ status }) => {
  const map = {
    pending: 'bg-orange-100 text-orange-700',
    confirmed: 'bg-orange-100 text-orange-700',
    processing: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
};

const SourceBadge = ({ orderType }) =>
  orderType === 'patient_booking' ? (
    <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: '#FFF7ED', color: '#F97316' }}>
      👤 Self-Booked
    </span>
  ) : (
    <span className="text-xs px-2 py-1 rounded-full font-medium bg-gray-100 text-gray-600">
      👨‍⚕️ Doctor Referred
    </span>
  );

const testList = (tests) =>
  Array.isArray(tests) ? tests.map((t) => t?.name || t).join(', ') : tests || '—';

const LabOrdersPage = () => {
  const { data, loading, error, refetch } = useApi('/api/lab/orders/');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [startingId, setStartingId] = useState(null);

  // Upload modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadingOrder, setUploadingOrder] = useState(null);
  const [reportFile, setReportFile] = useState(null);
  const [reportFilePreview, setReportFilePreview] = useState(null);
  const [testResults, setTestResults] = useState([]);
  const [uploading, setUploading] = useState(false);

  const allOrders = useMemo(() => data?.orders || [], [data]);

  const orders = useMemo(() => {
    return allOrders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (sourceFilter !== 'all' && o.order_type !== sourceFilter) return false;
      return true;
    });
  }, [allOrders, statusFilter, sourceFilter]);

  const counts = useMemo(() => ({
    all: allOrders.length,
    pending: allOrders.filter((o) => ['pending', 'confirmed'].includes(o.status)).length,
    processing: allOrders.filter((o) => o.status === 'processing').length,
    completed: allOrders.filter((o) => o.status === 'completed').length,
  }), [allOrders]);

  const handleStatusUpdate = async (orderId, newStatus, orderType) => {
    setStartingId(orderId);
    try {
      await API.put(`/api/lab/orders/${orderId}/status/`, { status: newStatus, order_type: orderType });
      toast.success('Status updated!');
      refetch();
    } catch {
      toast.error('Update failed!');
    } finally {
      setStartingId(null);
    }
  };

  // Prescription preview modal. The stored prescription_image is a relative
  // /media path, so resolve it to an absolute backend URL before displaying.
  const [prescriptionModal, setPrescriptionModal] = useState(false);
  const [prescriptionUrl, setPrescriptionUrl] = useState(null);

  const handleViewPrescription = async (order) => {
    if (!order.prescription_image) {
      toast.error('No prescription uploaded!');
      return;
    }
    try {
      const { data } = await API.get(`/api/lab/prescription/${order.order_id}/`);
      if (data?.success && data.data?.url) {
        setPrescriptionUrl(data.data.url);
        setPrescriptionModal(true);
      } else {
        toast.error('Prescription image not found!');
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load prescription!');
    }
  };

  const [verifyingId, setVerifyingId] = useState(null);
  const verifyPrescription = async (orderId, status) => {
    setVerifyingId(orderId);
    try {
      await API.post(`/api/lab/verify-prescription/${orderId}/`, { status });
      toast.success(`Prescription ${status}!`);
      refetch();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Action failed!');
    } finally {
      setVerifyingId(null);
    }
  };

  const openUploadModal = (order) => {
    const tests = Array.isArray(order.tests) ? order.tests : [];
    const initialResults = tests.map((test) => ({
      test_name: typeof test === 'object' ? (test.name || test.test_name || 'Test') : test,
      value: '',
      unit: '',
      notes: '',
    }));
    setUploadingOrder(order);
    setTestResults(initialResults);
    setReportFile(null);
    setReportFilePreview(null);
    setShowUploadModal(true);
  };

  const updateResult = (index, key, value) => {
    setTestResults((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [key]: value };
      return updated;
    });
  };

  const handleSubmitReport = async () => {
    if (!uploadingOrder) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('results', JSON.stringify(testResults));
      formData.append('order_type', uploadingOrder.order_type);
      if (reportFile) formData.append('report_file', reportFile);

      const response = await API.post(
        `/api/lab/orders/${uploadingOrder.order_id}/upload-report/`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );

      if (response.data.success) {
        const abnormalCount = response.data.data?.abnormal_count || 0;
        toast.success(
          abnormalCount > 0
            ? `Report uploaded! ⚠️ ${abnormalCount} abnormal value(s) detected!`
            : 'Report uploaded! All values normal ✅',
        );
        setShowUploadModal(false);
        refetch();
      }
    } catch (error) {
      const d = error?.response?.data;
      toast.error(d?.message || 'Upload failed!');
    } finally {
      setUploading(false);
    }
  };

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold text-primary mb-4">Test Orders</h1>

      {/* Source filter tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {SOURCE_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSourceFilter(tab.key)}
            className="px-4 py-2 rounded-full text-sm font-medium transition-all"
            style={{
              backgroundColor: sourceFilter === tab.key ? '#F97316' : '#FFFFFF',
              color: sourceFilter === tab.key ? '#FFFFFF' : '#000000',
              border: sourceFilter === tab.key ? 'none' : '1px solid #E5E5E5',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2 mb-5 border-b border-gray-200 pb-1">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${
              statusFilter === f.key ? 'bg-orange-500 text-white' : 'text-gray-500 hover:text-primary-500'
            }`}
          >
            {f.label}
            <span className="ml-1.5 text-xs opacity-70">({counts[f.key]})</span>
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <p className="text-sm text-gray-500 py-6 text-center">Loading orders…</p>
        ) : error ? (
          <p className="text-sm text-danger py-6 text-center">Could not load orders.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-100">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ backgroundColor: '#FAF7F2', borderBottom: '2px solid #E5E5E5' }}>
                  {['Patient', 'Source', 'Doctor', 'Tests', 'Priority', 'Status', 'Actions'].map((h) => (
                    <th
                      key={h}
                      className="text-left py-3.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-400">
                      <FiClipboard className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                      No test orders found
                    </td>
                  </tr>
                )}
                {orders.map((order) => (
                  <tr key={order.order_id} className="border-b border-gray-50 hover:bg-orange-50/60 transition-colors align-top">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-gray-800">{order.patient_name}</p>
                        {order.has_critical_values && (
                          <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 font-bold animate-pulse">
                            🚨 CRITICAL
                          </span>
                        )}
                      </div>
                      {order.order_type === 'patient_booking' && order.appointment_date && (
                        <p className="text-xs text-gray-500 mt-1">
                          📅 {order.appointment_date}
                          {order.appointment_time && ` at ${formatTime12hr(order.appointment_time)}`}
                        </p>
                      )}
                    </td>
                    <td className="py-4 px-4"><SourceBadge orderType={order.order_type} /></td>
                    <td className="py-4 px-4 text-gray-600">{order.doctor_name}</td>
                    <td className="py-4 px-4 text-gray-700 max-w-xs">
                      <div className="truncate">{testList(order.tests)}</div>
                      {order.prescription_required && (
                        <div className="mt-1.5">
                          {order.prescription_status === 'pending' ? (
                            <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                              ⏳ Prescription Pending Verification
                            </span>
                          ) : order.prescription_status === 'doctor_referred' ? (
                            <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">
                              ✓ Doctor Referred
                            </span>
                          ) : order.prescription_status === 'verified' ? (
                            <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">
                              ✅ Prescription Verified
                            </span>
                          ) : order.prescription_status === 'rejected' ? (
                            <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 font-medium">
                              ❌ Prescription Rejected
                            </span>
                          ) : null}

                          {order.prescription_image && (
                            <button
                              onClick={() => handleViewPrescription(order)}
                              className="text-xs underline mt-1 block font-medium"
                              style={{ color: '#F97316' }}
                            >
                              View Prescription →
                            </button>
                          )}

                          {order.prescription_status === 'pending' && (
                            <div className="flex gap-2 mt-2">
                              <button
                                disabled={verifyingId === order.order_id}
                                onClick={() => verifyPrescription(order.order_id, 'verified')}
                                className="text-xs px-3 py-1 rounded-full bg-green-500 text-white font-medium disabled:opacity-60"
                              >
                                ✓ Verify
                              </button>
                              <button
                                disabled={verifyingId === order.order_id}
                                onClick={() => verifyPrescription(order.order_id, 'rejected')}
                                className="text-xs px-3 py-1 rounded-full bg-red-500 text-white font-medium disabled:opacity-60"
                              >
                                ✕ Reject
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-4"><PriorityBadge priority={order.priority} /></td>
                    <td className="py-4 px-4"><StatusBadge status={order.status} /></td>
                    <td className="py-4 px-4">
                      <div className="flex gap-2">
                        {['pending', 'confirmed'].includes(order.status) && (
                          <button
                            disabled={startingId === order.order_id}
                            onClick={() => handleStatusUpdate(order.order_id, 'processing', order.order_type)}
                            className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-medium disabled:opacity-60"
                          >
                            {startingId === order.order_id ? '…' : 'Start Processing'}
                          </button>
                        )}
                        {order.status !== 'completed' && order.status !== 'cancelled' && (
                          <button
                            onClick={() => openUploadModal(order)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 text-xs font-medium"
                          >
                            <FiUpload className="w-3 h-3" /> Upload Report
                          </button>
                        )}
                        {order.status === 'completed' && order.report_url && (
                          <a
                            href={order.report_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-orange-600 hover:underline font-medium"
                          >
                            View Report
                          </a>
                        )}
                        {order.status === 'completed' && !order.report_url && (
                          <span className="text-xs text-gray-400">Completed</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload Report Modal */}
      {showUploadModal && uploadingOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-screen overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <div>
                <h3 className="font-bold text-xl text-black">Upload Report</h3>
                <p className="text-gray-500 text-sm">
                  {uploadingOrder.patient_name}
                  {' • '}
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#FFF7ED', color: '#F97316' }}>
                    {uploadingOrder.order_type === 'patient_booking' ? '👤 Self-Booked' : '👨‍⚕️ Doctor Referred'}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6" style={{ backgroundColor: '#FAF7F2' }}>
              {/* Test results */}
              <div>
                <h4 className="font-semibold mb-3 text-black">Test Results</h4>
                {testResults.map((result, index) => (
                  <div key={index} className="bg-white rounded-xl p-4 mb-3 border border-gray-100">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#F97316' }} />
                      <p className="font-semibold text-sm text-black">{result.test_name}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Value</label>
                        <input
                          type="text"
                          value={result.value}
                          onChange={(e) => updateResult(index, 'value', e.target.value)}
                          placeholder="e.g. 5.4"
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Unit</label>
                        <input
                          type="text"
                          value={result.unit}
                          onChange={(e) => updateResult(index, 'unit', e.target.value)}
                          placeholder="e.g. mg/dL"
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                        />
                      </div>
                    </div>
                    <div className="mt-2">
                      <input
                        type="text"
                        value={result.notes}
                        onChange={(e) => updateResult(index, 'notes', e.target.value)}
                        placeholder="Additional notes (optional)"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                      />
                    </div>
                  </div>
                ))}

                {testResults.length === 0 && (
                  <div className="bg-orange-50 rounded-xl p-4 text-center">
                    <p className="text-orange-600 text-sm">No specific tests found. Please add notes below.</p>
                    <button
                      onClick={() => setTestResults([{ test_name: 'General Test', value: '', unit: '', notes: '' }])}
                      className="mt-2 text-xs underline"
                      style={{ color: '#F97316' }}
                    >
                      Add test result manually
                    </button>
                  </div>
                )}
              </div>

              {/* Report file upload */}
              <div>
                <h4 className="font-semibold mb-3 text-black">
                  Report File
                  <span className="text-gray-400 font-normal text-sm ml-2">(Optional)</span>
                </h4>

                {!reportFile ? (
                  <label
                    className="border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer block hover:bg-orange-50 transition-colors"
                    style={{ borderColor: '#FED7AA' }}
                  >
                    <div className="text-4xl mb-2">📄</div>
                    <p className="font-medium text-sm text-black">Upload Report File</p>
                    <p className="text-xs text-gray-400 mt-1">PDF, JPG or PNG accepted</p>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          setReportFile(file);
                          if (file.type.includes('image')) {
                            const reader = new FileReader();
                            reader.onload = (ev) => setReportFilePreview(ev.target.result);
                            reader.readAsDataURL(file);
                          } else {
                            setReportFilePreview(null);
                          }
                        }
                      }}
                    />
                  </label>
                ) : (
                  <div className="border border-gray-200 rounded-2xl p-4 bg-white">
                    {reportFilePreview ? (
                      <img src={reportFilePreview} alt="preview" className="w-full h-32 object-cover rounded-xl mb-3" />
                    ) : (
                      <div className="flex items-center gap-3 bg-orange-50 rounded-xl p-3 mb-3">
                        <span className="text-2xl">📄</span>
                        <div>
                          <p className="font-medium text-sm text-black">{reportFile.name}</p>
                          <p className="text-xs text-gray-400">PDF Report</p>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => { setReportFile(null); setReportFilePreview(null); }}
                      className="text-xs text-red-400 hover:text-red-600 underline"
                    >
                      Remove file
                    </button>
                  </div>
                )}

                <p className="text-xs text-gray-400 mt-2">
                  ℹ️ Abnormal values are auto-detected. Patient will be notified via email when submitted.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 pt-0 flex gap-3" style={{ backgroundColor: '#FAF7F2' }}>
              <button
                onClick={handleSubmitReport}
                disabled={uploading}
                className="flex-1 py-3 rounded-full font-semibold text-white disabled:opacity-50 transition-all"
                style={{ backgroundColor: '#F97316' }}
              >
                {uploading ? 'Uploading...' : '📤 Submit Report'}
              </button>
              <button
                onClick={() => setShowUploadModal(false)}
                className="flex-1 py-3 rounded-full font-semibold bg-black text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prescription Image Modal */}
      {prescriptionModal && prescriptionUrl && (
        <div
          onClick={() => setPrescriptionModal(false)}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-5"
          style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl overflow-hidden w-full"
            style={{ maxWidth: '600px', maxHeight: '90vh' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="font-bold text-base text-black m-0">📋 Prescription Image</h3>
              <div className="flex gap-2">
                <a
                  href={prescriptionUrl}
                  download="prescription"
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-black no-underline"
                >
                  ↓ Download
                </a>
                <button
                  onClick={() => setPrescriptionModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700"
                >
                  ✕ Close
                </button>
              </div>
            </div>

            {/* Image */}
            <div
              className="flex items-center justify-center p-5 overflow-auto"
              style={{ maxHeight: 'calc(90vh - 70px)', backgroundColor: '#F9FAFB' }}
            >
              <img
                src={prescriptionUrl}
                alt="Prescription"
                className="max-w-full h-auto rounded-lg"
                onError={() => {
                  toast.error('Could not load image!');
                  setPrescriptionModal(false);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default LabOrdersPage;
