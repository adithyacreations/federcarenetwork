import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { FiMail, FiLock, FiPackage, FiUser } from 'react-icons/fi';

import AuthShell from '../../components/auth/AuthShell';
import StepIndicator from '../../components/auth/StepIndicator';
import FormInput from '../../components/auth/FormInput';
import API from '../../api/axios';

const STEPS = ['Account', 'Pharmacy'];

const initial = {
  email: '', password: '', confirm: '',
  pharmacy_name: '', license_no: '', full_name: '', address: '',
};

const PharmacistRegisterPage = () => {
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
    } else {
      if (!form.pharmacy_name) e.pharmacy_name = 'Required';
      if (!form.license_no) e.license_no = 'Required';
      if (!form.full_name) e.full_name = 'Required';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => validateStep() && setStep(2);
  const back = () => setStep(1);

  const submit = async (e) => {
    e.preventDefault();
    if (submitting || !validateStep()) return;
    setSubmitting(true);
    try {
      await API.post('/api/auth/register/pharmacist/', {
        email: form.email,
        password: form.password,
        pharmacy_name: form.pharmacy_name,
        license_no: form.license_no,
        full_name: form.full_name,
        address: form.address,
      });
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
    <AuthShell title="Pharmacist Registration" subtitle="Register your pharmacy with FederCare">
      <StepIndicator steps={STEPS} current={step} />

      <form onSubmit={submit} className="space-y-4">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <FormInput label="Email" type="email" icon={FiMail} value={form.email} onChange={set('email')} error={errors.email} required />
              <FormInput label="Password" type="password" icon={FiLock} value={form.password} onChange={set('password')} error={errors.password} required />
              <FormInput label="Confirm Password" type="password" icon={FiLock} value={form.confirm} onChange={set('confirm')} error={errors.confirm} required />
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <FormInput label="Pharmacy Name" icon={FiPackage} value={form.pharmacy_name} onChange={set('pharmacy_name')} error={errors.pharmacy_name} required />
              <FormInput label="License Number" value={form.license_no} onChange={set('license_no')} error={errors.license_no} required />
              <FormInput label="Full Name (Pharmacist in charge)" icon={FiUser} value={form.full_name} onChange={set('full_name')} error={errors.full_name} required />
              <FormInput label="Address" as="textarea" value={form.address} onChange={set('address')} />
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

export default PharmacistRegisterPage;
