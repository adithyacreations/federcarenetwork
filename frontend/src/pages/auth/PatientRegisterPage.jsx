import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { FiMail, FiLock, FiUser, FiPhone, FiHome, FiAlertCircle } from 'react-icons/fi';

import AuthShell from '../../components/auth/AuthShell';
import StepIndicator from '../../components/auth/StepIndicator';
import FormInput from '../../components/auth/FormInput';
import API, { setAuthToken } from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

const STEPS = ['Account', 'Personal', 'Health Info'];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

const initial = {
  email: '', password: '', confirm: '',
  full_name: '', dob: '', gender: '', blood_group: '', phone: '',
  height_cm: '', weight_kg: '', address: '', emergency_contact: '',
};

const PatientRegisterPage = () => {
  const navigate = useNavigate();
  const { updateProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const bmi = useMemo(() => {
    const h = parseFloat(form.height_cm);
    const w = parseFloat(form.weight_kg);
    if (!h || !w || h <= 0) return null;
    return (w / Math.pow(h / 100, 2)).toFixed(2);
  }, [form.height_cm, form.weight_kg]);

  const validateStep = () => {
    const e = {};
    if (step === 1) {
      if (!form.email) e.email = 'Email is required';
      if (!form.password) e.password = 'Password is required';
      else if (form.password.length < 6) e.password = 'Minimum 6 characters';
      if (form.password !== form.confirm) e.confirm = 'Passwords do not match';
    } else if (step === 2) {
      if (!form.full_name) e.full_name = 'Required';
      if (!form.dob) e.dob = 'Required';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => validateStep() && setStep((s) => Math.min(s + 1, STEPS.length));
  const back = () => setStep((s) => Math.max(s - 1, 1));

  const submit = async (e) => {
    e.preventDefault();
    if (submitting || !validateStep()) return;
    setSubmitting(true);
    try {
      const payload = {
        email: form.email,
        password: form.password,
        full_name: form.full_name,
        dob: form.dob,
        gender: form.gender,
        blood_group: form.blood_group,
        phone: form.phone,
        height_cm: form.height_cm || null,
        weight_kg: form.weight_kg || null,
        address: form.address,
        emergency_contact: form.emergency_contact,
      };
      const { data } = await API.post('/api/auth/register/patient/', payload);
      const d = data?.data || {};
      if (d.access_token) {
        setAuthToken(d.access_token);
        localStorage.setItem('role', d.role || 'patient');
        updateProfile?.({ full_name: form.full_name, email: form.email });
        toast.success('Welcome to FederCare!');
        // hard redirect so AuthContext re-bootstraps with the new token
        window.location.href = '/patient';
      } else {
        toast.success('Registration successful — please log in.');
        navigate('/login');
      }
    } catch (err) {
      const data = err?.response?.data;
      if (data?.errors) setErrors(data.errors);
      toast.error(data?.message || 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="Patient Registration" subtitle="Create your FederCare patient account">
      <StepIndicator steps={STEPS} current={step} />

      <form onSubmit={submit} className="space-y-4">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <FormInput label="Email" type="email" icon={FiMail} placeholder="you@example.com"
                value={form.email} onChange={set('email')} error={errors.email} required />
              <FormInput label="Password" type="password" icon={FiLock} placeholder="At least 6 characters"
                value={form.password} onChange={set('password')} error={errors.password} required />
              <FormInput label="Confirm Password" type="password" icon={FiLock}
                value={form.confirm} onChange={set('confirm')} error={errors.confirm} required />
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <FormInput label="Full Name" icon={FiUser} placeholder="Your full name"
                value={form.full_name} onChange={set('full_name')} error={errors.full_name} required />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormInput label="Date of Birth" type="date"
                  value={form.dob} onChange={set('dob')} error={errors.dob} required />
                <FormInput label="Gender" as="select" value={form.gender} onChange={set('gender')}
                  options={[
                    { value: '', label: 'Select…' },
                    { value: 'male', label: 'Male' },
                    { value: 'female', label: 'Female' },
                    { value: 'other', label: 'Other' },
                  ]}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormInput label="Blood Group" as="select" value={form.blood_group} onChange={set('blood_group')}
                  options={[{ value: '', label: 'Select…' }, ...BLOOD_GROUPS.map((g) => ({ value: g, label: g }))]}
                />
                <FormInput label="Phone" icon={FiPhone} placeholder="+91 ..." value={form.phone} onChange={set('phone')} />
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormInput label="Height (cm)" type="number" step="0.1" value={form.height_cm} onChange={set('height_cm')} />
                <FormInput label="Weight (kg)" type="number" step="0.1" value={form.weight_kg} onChange={set('weight_kg')} />
              </div>
              {bmi && (
                <div className="bg-primary-50 border border-primary-100 rounded-xl px-4 py-3 text-sm text-primary-600">
                  <span className="font-medium">Auto-calculated BMI:</span> {bmi}
                </div>
              )}
              <FormInput label="Address" as="textarea" icon={FiHome} value={form.address} onChange={set('address')} />
              <FormInput label="Emergency Contact" icon={FiAlertCircle} placeholder="Phone number"
                value={form.emergency_contact} onChange={set('emergency_contact')} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between gap-3 pt-4">
          {step > 1 ? (
            <button type="button" onClick={back} className="btn-secondary">Back</button>
          ) : <span />}
          {step < STEPS.length ? (
            <button type="button" onClick={next} className="btn-primary">Continue</button>
          ) : (
            <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-60">
              {submitting ? 'Registering…' : 'Register'}
            </button>
          )}
        </div>
      </form>
    </AuthShell>
  );
};

export default PatientRegisterPage;
