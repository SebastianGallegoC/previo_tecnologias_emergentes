import React, { useState } from 'react';
import { Bus, Eye, EyeOff, Lock, Mail, ShieldCheck, User } from 'lucide-react';
import { authService, AuthUser } from '../services/authService';

interface AuthScreenProps {
  defaultPortal?: 'usuario' | 'administrador';
  onAuthenticated: (user: AuthUser) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  defaultPortal = 'usuario',
  onAuthenticated,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [portal, setPortal] = useState<'usuario' | 'administrador'>(defaultPortal);

  // Login fields
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Register fields (strictly: correo, usuario, contraseña)
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = authService.login(identifier, password, portal);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onAuthenticated(res.user);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = authService.register(regEmail, regUsername, regPassword);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onAuthenticated(res.user);
  };

  const fillDemo = (demoPortal: 'usuario' | 'administrador') => {
    setMode('login');
    setPortal(demoPortal);
    setError(null);
    if (demoPortal === 'administrador') {
      setIdentifier('admin@uberbuses.co');
      setPassword('admin123');
    } else {
      setIdentifier('pasajero@uberbuses.co');
      setPassword('123456');
    }
  };

  return (
    <div className="min-h-dvh w-full bg-stone-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-neutral-200 rounded-3xl shadow-xl p-6 sm:p-8 flex flex-col gap-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-neutral-900 text-white flex items-center justify-center shadow-sm">
            <Bus className="w-6 h-6 stroke-[2.2]" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-neutral-900">
            Uber<span className="font-medium text-neutral-500">Buses</span>
          </h1>
          <p className="text-xs text-neutral-500">
            Movilidad inteligente · Área Metropolitana de Cúcuta
          </p>
        </div>

        {/* Mode Switcher: Login / Register */}
        <div
          role="tablist"
          aria-label="Opciones de acceso"
          className="grid grid-cols-2 gap-1 p-1 bg-neutral-100 rounded-2xl"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`py-2 rounded-xl text-xs font-bold transition-all ${
              mode === 'login'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`py-2 rounded-xl text-xs font-bold transition-all ${
              mode === 'register'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            Registrarse
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5"
          >
            {error}
          </div>
        )}

        {mode === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4" noValidate>
            {/* Portal Selector: Usuario vs Administrador */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setPortal('usuario');
                  setError(null);
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                  portal === 'usuario'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                <User className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Usuario</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPortal('administrador');
                  setError(null);
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                  portal === 'administrador'
                    ? 'border-neutral-900 bg-neutral-900 text-white'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Administrador</span>
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="login-identifier"
                className="text-xs font-semibold text-neutral-700"
              >
                Correo o usuario
              </label>
              <div className="relative">
                <Mail
                  className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="login-identifier"
                  type="text"
                  autoComplete="username"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={
                    portal === 'administrador'
                      ? 'admin@uberbuses.co'
                      : 'correo@ejemplo.com o usuario'
                  }
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-neutral-900 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="login-password"
                className="text-xs font-semibold text-neutral-700"
              >
                Contraseña
              </label>
              <div className="relative">
                <Lock
                  className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 text-sm bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-neutral-900 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-700 rounded-lg"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-bold transition-colors mt-1"
            >
              {portal === 'administrador'
                ? 'Ingresar como Administrador'
                : 'Iniciar Sesión'}
            </button>

            {/* Quick Demo Fill */}
            <div className="pt-2 border-t border-neutral-100 flex flex-col gap-2">
              <span className="text-[11px] font-semibold text-neutral-400 text-center uppercase tracking-wider">
                Accesos rápidos de demostración
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => fillDemo('usuario')}
                  className="py-1.5 px-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-semibold transition-colors"
                >
                  Demo Usuario
                </button>
                <button
                  type="button"
                  onClick={() => fillDemo('administrador')}
                  className="py-1.5 px-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-[11px] font-semibold transition-colors"
                >
                  Demo Admin
                </button>
              </div>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="reg-email"
                className="text-xs font-semibold text-neutral-700"
              >
                Correo
              </label>
              <div className="relative">
                <Mail
                  className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="reg-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-neutral-900 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="reg-username"
                className="text-xs font-semibold text-neutral-700"
              >
                Usuario
              </label>
              <div className="relative">
                <User
                  className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="reg-username"
                  type="text"
                  autoComplete="username"
                  required
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="Tu nombre de usuario"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-neutral-900 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="reg-password"
                className="text-xs font-semibold text-neutral-700"
              >
                Contraseña
              </label>
              <div className="relative">
                <Lock
                  className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full pl-10 pr-10 py-2.5 text-sm bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-neutral-900 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-700 rounded-lg"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors mt-1"
            >
              Crear Cuenta
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
