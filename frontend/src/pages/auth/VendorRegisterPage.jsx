import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { FiMail, FiLock, FiBriefcase, FiUser, FiPhone, FiHash } from 'react-icons/fi';

import AuthShell from '../../components/auth/AuthShell';
import StepIndicator from '../../components/auth/StepIndicator';
import FormInput from '../../components/auth/FormInput';
import API from '../../api/axios';

const STEPS = ['Account', 'Company'];

const initial = {
  email: '', password: '', confirm: '',
  company_name: '', tax_id: '', contact_name: '', phone: '',
};

const VendorRegisterPage = () => {
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
      if (!form.company_name) e.company_name = 'Required';
      if (!form.tax_id) e.tax_id = 'Required';
      if (!form.contact_name) e.contact_name = 'Required';
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
      await API.post('/api/auth/register/vendor/', {
        email: form.email,
        password: form.password,
        company_name: form.company_name,
        tax_id: form.tax_id,
        contact_name: form.contact_name,
        phone: form.phone,
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
    <AuthShell title="Vendor Registration" subtitle="Register your medical equipment company">
      <StepIndicator steps={STEPS} current={step} />

      <form onSubmit={submit} className="space-y-4">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <FormInput label="Business Email" type="email" icon={FiMail} value={form.email} onChange={set('email')} error={errors.email} required />
              <FormInput label="Password" type="password" icon={FiLock} value={form.password} onChange={set('password')} error={errors.password} required />
              <FormInput label="Confirm Password" type="password" icon={FiLock} value={form.confirm} onChange={set('confirm')} error={errors.confirm} required />
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <FormInput label="Company Name" icon={FiBriefcase} value={form.company_name} onChange={set('company_name')} error={errors.company_name} required />
              <FormInput label="Tax ID (GST Number)" icon={FiHash} value={form.tax_id} onChange={set('tax_id')} error={errors.tax_id} required />
              <FormInput label="Contact Name" icon={FiUser} value={form.contact_name} onChange={set('contact_name')} error={errors.contact_name} required />
              <FormInput label="Phone Number" icon={FiPhone} value={form.phone} onChange={set('phone')} />
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

export default VendorRegisterPage;
