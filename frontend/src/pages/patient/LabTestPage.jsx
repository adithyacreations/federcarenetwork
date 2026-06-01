import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { FiCheck, FiTrash2 } from 'react-icons/fi';

import DashboardLayout from '../../components/common/DashboardLayout';
import AnimatedTabs from '../../components/patient/AnimatedTabs';
import { pageVariants, cardVariants, cardHover } from '../../components/dashboard/variants';
import useApi from '../../hooks/useApi';
import API from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { openRazorpay } from '../../utils/payment';
import { formatTime12hr } from '../../utils/timeUtils';

const todayStr = new Date().toISOString().slice(0, 10);

const LabTestPage = () => {
  const { user } = useAuth();
  const hospitals = useApi('/api/patient/hospitals/');
  const catalog = useApi('/api/patient/lab/catalog/');

  const [hospitalId, setHospitalId] = useState('');
  const [selected, setSelected] = useState([]);
  const [apptDate, setApptDate] = useState('');
  const [booking, setBooking] = useState(false);
  const [activeCat, setActiveCat] = useState('all');
  const [prescriptionImage, setPrescriptionImage] = useState(null);

  // Smart slot picker state.
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotRestriction, setSlotRestriction] = useState(null);
  const [fastingRequired, setFastingRequired] = useState(false);

  const selectedCount = selected.length;
  useEffect(() => {
    if (!hospitalId || !apptDate) {
      setAvailableSlots([]);
      setSelectedSlot(null);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoadingSlots(true);
        setSelectedSlot(null);
        const testIds = selected.map((t) => t.test_id).filter(Boolean);
        const res = await API.get('/api/lab/slots/', {
          params: { hospital_id: hospitalId, date: apptDate, test_ids: testIds.join(',') },
        });
        if (cancelled) return;
        if (res.data?.success) {
          setAvailableSlots(res.data.data || []);
          setSlotRestriction(res.data.restriction_note || null);
          setFastingRequired(Boolean(res.data.fasting_required));
        }
      } catch {
        if (!cancelled) setAvailableSlots([]);
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hospitalId, apptDate, selectedCount]);

  const hospitalList = hospitals.data?.hospitals || [];
  const allTests = catalog.data?.tests || [];
  const totalFee = selected.reduce((s, t) => s + Number(t.fee || 0), 0);

  const grouped = useMemo(() => {
    const g = {};
    allTests.forEach((t) => {
      const key = t.category || 'Other';
      (g[key] = g[key] || []).push(t);
    });
    return g;
  }, [allTests]);

  const catTabs = useMemo(() => {
    const keys = Object.keys(grouped);
    return [
      { key: 'all', label: `All (${allTests.length})` },
      ...keys.map((k) => ({ key: k, label: k })),
    ];
  }, [grouped, allTests.length]);

  const visibleTests = activeCat === 'all' ? allTests : (grouped[activeCat] || []);
  const cartHasRx = selected.some((t) => t.requires_prescription);

  const isPicked = (t) => selected.some((x) => x.name === t.name);
  const toggleTest = (t) => {
    setSelected((cur) =>
      cur.find((x) => x.name === t.name) ? cur.filter((x) => x.name !== t.name) : [...cur, t]);
  };

  const book = async () => {
    if (!hospitalId) return toast.error('Select a hospital');
    if (selected.length === 0) return toast.error('Select at least one test');
    if (!apptDate) return toast.error('Pick an appointment date');
    if (!selectedSlot) return toast.error('Please select a time slot!');
    setBooking(true);
    try {
      // Use multipart when a prescription image is attached; otherwise plain JSON.
      const fd = new FormData();
      fd.append('hospital_id', hospitalId);
      fd.append('tests', JSON.stringify(selected));
      fd.append('date', apptDate);
      fd.append('slot_id', selectedSlot.slot_id);
      if (prescriptionImage) fd.append('prescription_image', prescriptionImage);

      const { data } = await API.post('/api/patient/lab/book/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const res = data?.data || {};
      const finish = () => {
        const msg = res.prescription_status === 'pending'
          ? 'Booking submitted! The lab will verify your prescription.'
          : res.prescription_status === 'doctor_referred'
            ? 'Booked — doctor referral verified automatically.'
            : 'Lab test booked — confirmation email sent';
        toast.success(msg);
        setSelected([]); setHospitalId(''); setApptDate(''); setSelectedSlot(null);
        setPrescriptionImage(null);
      };
      if (res.razorpay_order_id) {
        openRazorpay({
          orderId: res.razorpay_order_id,
          amount: res.amount,
          keyId: res.key_id,
          paymentType: 'lab_test',
          objectId: res.order_id,
          user,
          description: 'Lab test booking',
          onSuccess: finish,
        });
      } else {
        finish();
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Booking failed');
    } finally {
      setBooking(false);
    }
  };

  return (
    <DashboardLayout>
      <motion.div variants={pageVariants} initial="hidden" animate="visible">
        {/* Header */}
        <motion.div variants={cardVariants} className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <div>
            <h1 className="font-bricolage text-3xl font-extrabold text-ink">Lab Tests</h1>
            <p className="text-muted mt-1">Book diagnostic tests near you</p>
          </div>
          <span className="text-sm bg-orange-50 text-orange-600 px-4 py-2 rounded-full font-semibold">
            {allTests.length}+ tests available
          </span>
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Catalog */}
          <section className="flex-1 w-full min-w-0">
            <AnimatedTabs tabs={catTabs} active={activeCat} onChange={setActiveCat} layoutId="lab-tab" />
            {catalog.loading ? (
              <div className="dashboard-card text-sm text-muted">Loading test catalog…</div>
            ) : visibleTests.length === 0 ? (
              <div className="dashboard-card text-sm text-muted text-center py-8">No tests in this category.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {visibleTests.map((t) => {
                  const picked = isPicked(t);
                  return (
                    <motion.div
                      key={t.name}
                      variants={cardVariants}
                      whileHover={cardHover}
                      className={`relative rounded-2xl border p-4 bg-white transition-colors ${
                        picked ? 'border-orange-500 ring-1 ring-orange-200' : 'border-hairline'
                      }`}
                    >
                      {picked && (
                        <span className="absolute top-3 right-3 w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center">
                          <FiCheck className="w-3.5 h-3.5" />
                        </span>
                      )}
                      <div className="font-semibold text-ink pr-7">{t.name}</div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        {t.requires_prescription ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">
                            📋 Rx Required
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-600 font-medium">
                            ✓ Direct Book
                          </span>
                        )}
                        {t.category && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                            {t.category}
                          </span>
                        )}
                      </div>
                      {t.description && <p className="text-xs text-muted mt-1 line-clamp-2">{t.description}</p>}
                      {t.preparation && (
                        <div className="bg-blue-50 rounded-lg px-2 py-1 mt-1">
                          <p className="text-xs text-blue-600">💡 {t.preparation}</p>
                        </div>
                      )}
                      <p className="text-xs text-muted mt-1">⏱️ {t.duration || 'Results in 24 hrs'}</p>
                      <div className="flex items-center justify-between mt-3">
                        <span className="font-bricolage font-extrabold text-orange-500">₹{t.fee}</span>
                        <button
                          onClick={() => toggleTest(t)}
                          className={`text-xs px-4 py-1.5 rounded-full font-semibold transition ${
                            picked
                              ? 'bg-orange-50 text-orange-600 border border-orange-200'
                              : 'bg-ink text-white hover:bg-black/80'
                          }`}
                        >
                          {picked ? '✓ Added' : '+ Book'}
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Sticky booking summary — aligned to the top of the test cards */}
          <aside className="w-full lg:w-[340px] lg:flex-shrink-0 lg:sticky lg:top-20 self-start">
            <motion.div
              variants={cardVariants}
              className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm"
            >
              <h3 className="font-bold text-lg text-black mb-4">🛒 Your Booking</h3>

              {selected.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-3xl mb-2">🔬</p>
                  <p className="text-gray-400 text-sm">No tests selected yet.</p>
                  <p className="text-xs text-gray-400 mt-1">Select tests from the list</p>
                </div>
              ) : (
                <div className="space-y-2 mb-3">
                  {selected.map((t) => (
                    <div key={t.name} className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-ink truncate">{t.name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-muted">₹{t.fee}</span>
                        <button onClick={() => toggleTest(t)} className="text-gray-300 hover:text-red-500">
                          <FiTrash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between border-t border-hairline pt-2 font-semibold">
                    <span className="text-ink">Subtotal</span>
                    <span className="font-bricolage text-orange-500">₹{totalFee}</span>
                  </div>
                </div>
              )}

              <label className="text-xs text-muted block mb-1">Hospital</label>
              <select
                value={hospitalId}
                onChange={(e) => setHospitalId(e.target.value)}
                className="w-full bg-white border border-hairline rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none focus:border-orange-400"
              >
                <option value="">Select hospital…</option>
                {hospitalList.map((h) => (
                  <option key={h.hospital_id} value={h.hospital_id}>{h.hospital_name} · {h.city}</option>
                ))}
              </select>

              <label className="text-xs text-muted block mb-1">Date</label>
              <input
                type="date"
                min={todayStr}
                value={apptDate}
                onChange={(e) => setApptDate(e.target.value)}
                className="w-full bg-white border border-hairline rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none focus:border-orange-400"
              />

              <label className="text-xs text-muted block mb-1">Time slot</label>

              {/* Per-test time restriction */}
              {slotRestriction && (
                <div className="bg-blue-50 rounded-xl p-3 mb-3 border border-blue-100">
                  <p className="text-xs text-blue-600 font-medium">⏰ Time Restriction</p>
                  <p className="text-xs text-blue-500 mt-1">{slotRestriction}</p>
                </div>
              )}

              {/* Fasting warning */}
              {fastingRequired && (
                <div className="rounded-xl p-3 mb-3 border" style={{ backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }}>
                  <p className="text-xs font-medium" style={{ color: '#F97316' }}>🍽️ Fasting Required</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Please do not eat or drink (except water) before this test.
                  </p>
                </div>
              )}

              {!apptDate ? (
                <p className="text-xs text-gray-400 mb-4">Pick a date to see available slots.</p>
              ) : loadingSlots ? (
                <div className="text-center py-4">
                  <div className="w-6 h-6 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs text-gray-400">Loading available slots...</p>
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="text-center py-4 mb-2">
                  <p className="text-2xl mb-2">😔</p>
                  <p className="text-sm text-gray-500">No slots available for this date</p>
                  <p className="text-xs text-gray-400 mt-1">Try selecting a different date</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {availableSlots.map((slot) => {
                    const isSel = selectedSlot?.slot_id === slot.slot_id;
                    return (
                      <button
                        key={slot.slot_id}
                        type="button"
                        onClick={() => { if (slot.is_available) setSelectedSlot(slot); }}
                        disabled={!slot.is_available}
                        className="relative py-3 px-2 rounded-xl text-center text-xs font-medium transition-all border"
                        style={{
                          backgroundColor: !slot.is_available ? '#F9FAFB'
                            : isSel ? '#F97316'
                              : slot.status === 'filling_fast' ? '#FFF7ED' : '#FFFFFF',
                          borderColor: !slot.is_available ? '#E5E5E5'
                            : isSel ? '#F97316'
                              : slot.status === 'filling_fast' ? '#FED7AA' : '#E5E5E5',
                          color: !slot.is_available ? '#9CA3AF' : isSel ? 'white' : '#000000',
                          cursor: slot.is_available ? 'pointer' : 'not-allowed',
                          textDecoration: !slot.is_available ? 'line-through' : 'none',
                        }}
                      >
                        {formatTime12hr(slot.start_time)}
                        {slot.status === 'filling_fast' && slot.is_available && (
                          <span style={{ position: 'absolute', top: '-4px', right: '-4px', backgroundColor: '#F97316', color: 'white', fontSize: '8px', padding: '1px 4px', borderRadius: '999px', fontWeight: 700 }}>
                            Hot!
                          </span>
                        )}
                        {!slot.is_available && !slot.is_blocked && (
                          <span style={{ display: 'block', fontSize: '9px', color: '#9CA3AF', marginTop: '2px' }}>Full</span>
                        )}
                        {slot.is_blocked && (
                          <span style={{ display: 'block', fontSize: '9px', color: '#9CA3AF', marginTop: '2px' }}>Closed</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Selected slot summary */}
              {selectedSlot && (
                <div className="bg-green-50 rounded-xl p-3 mb-3 border border-green-100">
                  <p className="text-xs font-medium text-green-700">✅ Slot Selected</p>
                  <p className="text-sm font-bold text-black mt-1">
                    🕐 {formatTime12hr(selectedSlot.start_time)} - {formatTime12hr(selectedSlot.end_time)}
                  </p>
                  <p className="text-xs text-green-600 mt-1">{selectedSlot.remaining} slot(s) remaining</p>
                </div>
              )}

              {cartHasRx && (
                <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: '#FFF7ED', border: '1px solid #FED7AA' }}>
                  <p className="text-sm font-medium mb-1" style={{ color: '#F97316' }}>
                    📋 Prescription Required
                  </p>
                  <p className="text-xs text-gray-500 mb-2">
                    Some selected tests need a doctor&apos;s prescription. If your doctor already
                    referred these tests, it&apos;s detected automatically — otherwise upload a
                    prescription for the lab to verify.
                  </p>
                  <label
                    className="border-2 border-dashed rounded-xl p-3 text-center cursor-pointer block hover:border-orange-400"
                    style={{ borderColor: '#FDBA74' }}
                  >
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => setPrescriptionImage(e.target.files?.[0] || null)}
                    />
                    {prescriptionImage ? (
                      <span className="text-green-600 font-medium text-sm">✅ {prescriptionImage.name}</span>
                    ) : (
                      <span className="text-sm text-gray-600">📄 Upload Prescription (JPG, PNG, PDF)</span>
                    )}
                  </label>
                </div>
              )}

              <button
                onClick={book}
                disabled={booking || selected.length === 0}
                className="btn-orange w-full disabled:opacity-50"
              >
                {booking ? 'Booking…' : `Book & Pay ₹${totalFee}`}
              </button>
            </motion.div>
          </aside>
        </div>
      </motion.div>
    </DashboardLayout>
  );
};

export default LabTestPage;
