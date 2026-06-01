import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const AuthShell = ({ title, subtitle, children, footer }) => (
  <div className="min-h-screen bg-light flex items-center justify-center px-4 py-10">
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="card w-full max-w-2xl"
    >
      <div className="text-center mb-6">
        <Link to="/" className="inline-flex items-center gap-2">
          <span className="text-3xl text-accent">⚕</span>
          <span className="text-xl font-bold text-primary-500">FederCare</span>
        </Link>
        <h1 className="text-2xl font-bold text-primary-500 mt-3">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {children}
      {footer || (
        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-500 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      )}
    </motion.div>
  </div>
);

export default AuthShell;
