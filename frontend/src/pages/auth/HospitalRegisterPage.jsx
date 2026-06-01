import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { FiMail, FiLock, FiHome, FiPhone } from 'react-icons/fi';

import AuthShell from '../../components/auth/AuthShell';
import StepIndicator from '../../components/auth/StepIndicator';
import FormInput from '../../components/auth/FormInput';
import LocationPicker from '../../components/common/LocationPicker';
import API from '../../api/axios';

const STEPS = ['Account', 'Hospital', 'Location'];

const initial = {
  email: '', password: '', confirm: '',
  hospital_name: '', registration_no: '', address: '', city: '', state: 'Kerala',
  contact_phone: '', contact_email: '',
  latitude: '', longitude: '',
};

const HospitalRegisterPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const validateStep = () => {
    const e = {};
    if (step === 1) {
      if (!form.email) e.email = 'Email is required';
      if (!form.password) e.password = 'Password is required';
      else if (form.password.length < 6) e.password = 'Minimum 6 characters';
      if (form.password !== form.confirm) e.confirm = 'Passwords do not match';
    } else if (step === 2) {
      if (!form.hospital_name) e.hospital_name = 'Required';
      if (!form.registration_no) e.registration_no = 'Required';
      if (!form.address) e.address = 'Required';
      if (!form.city) e.city = 'Required';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => validateStep() && setStep((s) => Math.min(s + 1, STEPS.length));
  const back = () => setStep((s) => Math.max(s - 1, 1));

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        email: form.email,
        password: form.password,
        hospital_name: form.hospital_name,
        registration_no: form.registration_no,
        address: form.address,
        city: form.city,
        state: form.state || 'Kerala',
        contact_phone: form.contact_phone,
        contact_email: form.contact_email,
      };
      // lat/lng captured for completeness; serializer ignores unknown fields
      if (form.latitude) payload.latitude = form.latitude;
      if (form.longitude) payload.longitude = form.longitude;

      await API.post('/api/auth/register/hospital/', payload);
      toast.success('Registration submitted! Awaiting Super Admin approval.');
      navigate('/login');
    } catch (err) {
      const data = err?.response?.data;
      if (data?.errors) setErrors(data.errors);
      toast.error(data?.message || 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="Hospital Registration" subtitle="Register your hospital with FederCare">
      <StepIndicator steps={STEPS} current={step} />

      <form onSubmit={submit} className="space-y-4">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <FormInput label="Admin Email" type="email" icon={FiMail} value={form.email} onChange={set('email')} error={errors.email} required />
              <FormInput label="Password" type="password" icon={FiLock} value={form.password} onChange={set('password')} error={errors.password} required />
              <FormInput label="Confirm Password" type="password" icon={FiLock} value={form.confirm} onChange={set('confirm')} error={errors.confirm} required />
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <FormInput label="Hospital Name" icon={FiHome} value={form.hospital_name} onChange={set('hospital_name')} error={errors.hospital_name} required />
              <FormInput label="Registration Number" value={form.registration_no} onChange={set('registration_no')} error={errors.registration_no} required />
              <FormInput label="Address" as="textarea" value={form.address} onChange={set('address')} error={errors.address} required />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormInput label="City" value={form.city} onChange={set('city')} error={errors.city} required />
                <FormInput label="State" value={form.state} onChange={set('state')} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormInput label="Contact Phone" icon={FiPhone} value={form.contact_phone} onChange={set('contact_phone')} />
                <FormInput label="Contact Email" type="email" icon={FiMail} value={form.contact_email} onChange={set('contact_email')} />
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <div>
                <h3 className="font-bold text-lg mb-1">📍 Hospital Location</h3>
                <p className="text-gray-500 text-sm mb-4">Required for emergency ambulance routing</p>
                <LocationPicker
                  latitude={form.latitude}
                  longitude={form.longitude}
                  onChange={(la, lo) => setForm((p) => ({ ...p, latitude: la, longitude: lo }))}
                />
              </div>
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl px-4 py-3 text-sm">
                Your account will be reviewed by Super Admin before activation.
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between gap-3 pt-4">
          {step > 1 ? <button type="button" onClick={back} className="btn-secondary">Back</button> : <span />}
          {step < STEPS.length ? (
            <button type="button" onClick={next} className="btn-primary">Continue</button>
          ) : (
            <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-60">
              {submitting ? 'Submitting…' : 'Submit Registration'}
            </button>
          )}
        </div>
      </form>
    </AuthShell>
  );
};

export default HospitalRegisterPage;
