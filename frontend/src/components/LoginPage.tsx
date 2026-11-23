import React, { useState } from 'react';
import axios from 'axios';
import {
  Mail,
  Eye,
  EyeOff,
  User,
  Building2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Sun,
  Moon,
} from 'lucide-react';

export interface LoggedInUser {
  guid: string;
  name: string;
  email: string;
  role: string;
  companyGuid: string;
}

interface LoginPageProps {
  onLoginSuccess: (token: string, user: LoggedInUser) => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  darkMode,
  onToggleDarkMode,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState<string>('28044909404');
  const [password, setPassword] = useState<string>('123456');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [companyGuid, setCompanyGuid] = useState<string>('COMPANY-GAJAH-01');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await axios.post('/v1/users/login', {
          email: email.trim(),
          password,
        });
        const data = res.data?.data;
        if (data?.accessToken && data?.user) {
          onLoginSuccess(data.accessToken, data.user);
        } else {
          setError('Respons server tidak valid.');
        }
      } else {
        await axios.post('/v1/users/register', {
          name: name.trim(),
          email: email.trim(),
          password,
          companyGuid: companyGuid.trim() || 'COMPANY-GAJAH-01',
        });
        setSuccessMsg('Registrasi berhasil! Silakan masuk dengan akun Anda.');
        setMode('login');
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        'Gagal terhubung ke server backend (Pastikan backend berjalan di port 3000).';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  const fillPreset = (presetEmail: string, presetPass: string) => {
    setMode('login');
    setEmail(presetEmail);
    setPassword(presetPass);
    setError(null);
  };

  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center p-6 select-none relative">
      {/* Top-Right Neumorphic Dark/Light Mode Switch */}
      <div className="absolute top-6 right-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleDarkMode}
          className="neu-card rounded-2xl px-4 py-2.5 flex items-center gap-2.5 text-xs font-medium text-slate-600 dark:text-slate-200 hover:scale-105 transition-all cursor-pointer"
        >
          {darkMode ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span>Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-blue-600" />
              <span>Dark Mode</span>
            </>
          )}
        </button>
      </div>

      {/* Main Neumorphic Login Card (Persis Referensi UI Kit Kiri Atas) */}
      <div className="relative w-full max-w-[380px] neu-glow-card rounded-[42px] px-10 pt-11 pb-16 transition-all">
        {/* Title */}
        <div className="flex items-center justify-between mb-9">
          <h1 className="text-[28px] font-normal text-slate-700 dark:text-slate-100 tracking-wide">
            {mode === 'login' ? 'Login' : 'Sign Up'}
          </h1>
          <div className="w-11 h-11 rounded-2xl blue-grad blue-grad-shadow flex items-center justify-center text-xl text-white">
            🐘
          </div>
        </div>

        {/* Error / Success Alerts */}
        {error && (
          <div className="mb-6 p-3 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-3 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300 text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-7">
          {mode === 'register' && (
            <div className="relative border-b border-slate-300 dark:border-slate-700 focus-within:border-blue-500 transition-colors pb-2">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full Name"
                className="w-full bg-transparent pr-8 text-[15px] text-slate-700 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none font-light"
              />
              <User className="w-5 h-5 text-slate-400 dark:text-slate-500 absolute right-0 top-0.5 stroke-[1.5]" />
            </div>
          )}

          {/* Email / ID Input with Envelope Icon on Right */}
          <div className="relative border-b border-slate-300 dark:border-slate-700 focus-within:border-blue-500 transition-colors pb-2">
            <input
              type={mode === 'login' ? 'text' : 'email'}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="username@mail.com"
              className="w-full bg-transparent pr-8 text-[15px] text-slate-700 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none font-light"
            />
            <Mail className="w-5 h-5 text-slate-400 dark:text-slate-500 absolute right-0 top-0.5 stroke-[1.5]" />
          </div>

          {/* Password Input with Eye Icon on Right */}
          <div className="relative border-b border-slate-300 dark:border-slate-700 focus-within:border-blue-500 transition-colors pb-2">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="**********"
              className="w-full bg-transparent pr-8 text-[15px] text-slate-700 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none font-light tracking-wider"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-0 top-0.5 text-slate-400 dark:text-slate-500 hover:text-blue-500 transition-colors cursor-pointer"
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5 stroke-[1.5]" />
              ) : (
                <Eye className="w-5 h-5 stroke-[1.5]" />
              )}
            </button>
          </div>

          {mode === 'register' && (
            <div className="relative border-b border-slate-300 dark:border-slate-700 focus-within:border-blue-500 transition-colors pb-2">
              <input
                type="text"
                required
                value={companyGuid}
                onChange={(e) => setCompanyGuid(e.target.value)}
                placeholder="COMPANY-GAJAH-01"
                className="w-full bg-transparent pr-8 text-[15px] text-slate-700 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none font-light"
              />
              <Building2 className="w-5 h-5 text-slate-400 dark:text-slate-500 absolute right-0 top-0.5 stroke-[1.5]" />
            </div>
          )}

          {/* Forget Password / Switch Mode Link */}
          <div className="pt-1 flex items-center justify-between text-[13px]">
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError(null);
                setSuccessMsg(null);
              }}
              className="text-slate-400 dark:text-slate-400 hover:text-blue-500 underline underline-offset-4 font-light transition-colors cursor-pointer"
            >
              {mode === 'login' ? 'Create New Account?' : 'Already have an account?'}
            </button>
          </div>

          {/* Floating Pill Gradient Button Overlapping Bottom Edge */}
          <div className="absolute -bottom-7 left-1/2 -translate-x-1/2">
            <button
              type="submit"
              disabled={loading}
              className="min-w-[210px] py-3.5 px-10 rounded-full blue-grad blue-grad-shadow text-white text-[16px] font-normal tracking-wide hover:scale-[1.03] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
            >
              {loading ? 'Loading...' : mode === 'login' ? 'Login' : 'Sign Up'}
            </button>
          </div>
        </form>
      </div>

      {/* Quick Preset Pills Underneath */}
      <div className="mt-14 w-full max-w-[380px] space-y-3">
        <div className="text-[11px] text-slate-400 dark:text-slate-500 text-center font-medium tracking-wide uppercase">
          Quick Demo Login (1-Click Fill)
        </div>
        <div className="grid grid-cols-2 gap-3.5">
          <button
            type="button"
            onClick={() => fillPreset('28044909404', '123456')}
            className="neu-card rounded-2xl p-2.5 flex items-center gap-3 hover:scale-[1.02] transition-transform cursor-pointer text-left"
          >
            <div className="w-9 h-9 rounded-xl blue-grad blue-grad-shadow flex items-center justify-center text-white font-bold text-sm shrink-0">
              ID
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                Alat GT02A
              </div>
              <div className="text-[10px] text-slate-400 font-mono truncate">28044909404</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => fillPreset('admin@trackinggajah.com', 'password123')}
            className="neu-card rounded-2xl p-2.5 flex items-center gap-3 hover:scale-[1.02] transition-transform cursor-pointer text-left"
          >
            <div className="w-9 h-9 rounded-xl blue-grad blue-grad-shadow flex items-center justify-center text-white shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                Admin
              </div>
              <div className="text-[10px] text-slate-400 font-mono truncate">admin@track...</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
