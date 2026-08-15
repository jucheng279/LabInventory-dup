import { useState } from 'react';
import { Refrigerator, Mail, Lock, Eye, EyeOff, Loader as Loader2, CircleAlert as AlertCircle } from 'lucide-react';
import { signUp } from '../../services/authService';

const DOMAIN_TYPOS: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmil.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.om': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gamil.co': 'gmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'hotamil.com': 'hotmail.com',
  'outloo.com': 'outlook.com',
  'outlok.com': 'outlook.com',
  'outlool.com': 'outlook.com',
  'outlook.co': 'outlook.com',
  'outlook.con': 'outlook.com',
  'outllook.com': 'outlook.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yahoo.co': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  'yhoo.com': 'yahoo.com',
  'yhaoo.com': 'yahoo.com',
  'iclod.com': 'icloud.com',
  'icloud.co': 'icloud.com',
  'icloud.con': 'icloud.com',
  'icoud.com': 'icloud.com',
  'protonmal.com': 'protonmail.com',
  'protonmail.co': 'protonmail.com',
  'protonmail.con': 'protonmail.com',
};

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return 'Email is required';
  if (trimmed.length > 254) return 'Email address is too long';
  if (!trimmed.includes('@')) return 'Email must contain an @ symbol';
  const [local, domain] = trimmed.split('@');
  if (!local || local.length === 0) return 'Email is missing the username before @';
  if (local.length > 64) return 'The part before @ is too long';
  if (!domain || domain.length === 0) return 'Email is missing the domain after @';
  if (!domain.includes('.')) return 'Email domain must include a dot (e.g. gmail.com)';
  const tld = domain.split('.').pop() || '';
  if (tld.length < 2) return 'Email domain has an invalid extension';
  if (/\.\./.test(trimmed)) return 'Email cannot contain consecutive dots';
  if (local.startsWith('.') || local.endsWith('.')) return 'Email username cannot start or end with a dot';
  if (!EMAIL_REGEX.test(trimmed)) return 'Please enter a valid email address';
  return null;
}

function getSuggestedDomain(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed.includes('@')) return null;
  const domain = trimmed.split('@')[1];
  return DOMAIN_TYPOS[domain] || null;
}

interface RegisterPageProps {
  onSwitchToLogin: () => void;
}

export default function RegisterPage({ onSwitchToLogin }: RegisterPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);

  const handleEmailChange = (value: string) => {
    setEmail(value);
    const suggested = getSuggestedDomain(value);
    if (suggested) {
      const local = value.trim().split('@')[0];
      setEmailSuggestion(`${local}@${suggested}`);
    } else {
      setEmailSuggestion(null);
    }
  };

  const acceptSuggestion = () => {
    if (emailSuggestion) {
      setEmail(emailSuggestion);
      setEmailSuggestion(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!/[A-Z]/.test(password)) {
      setError('Password must contain at least one uppercase letter');
      return;
    }

    if (!/[a-z]/.test(password)) {
      setError('Password must contain at least one lowercase letter');
      return;
    }

    if (!/[0-9]/.test(password)) {
      setError('Password must contain at least one number');
      return;
    }

    setIsLoading(true);

    try {
      await signUp({ email: email.trim(), password });
    } catch (err) {
      console.error('Sign up failed', err);
      setError('We could not create your account. Please check your details and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 mb-4 shadow-lg shadow-blue-500/20">
            <Refrigerator className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
          <p className="text-gray-500 mt-1">Join Lab Manager</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  required
                  className="block w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                  placeholder="you@example.com"
                />
              </div>
              {emailSuggestion && (
                <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                  <span className="text-gray-600">
                    Did you mean{' '}
                    <button
                      type="button"
                      onClick={acceptSuggestion}
                      className="text-blue-600 hover:text-blue-700 font-medium underline underline-offset-2"
                    >
                      {emailSuggestion}
                    </button>
                    ?
                  </span>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="block w-full pl-10 pr-12 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                  placeholder="Create a password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">At least 8 characters with uppercase, lowercase, and a number</p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
                Confirm password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="block w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                  placeholder="Confirm your password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create account'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Already have an account?{' '}
              <button
                onClick={onSwitchToLogin}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Sign in
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
