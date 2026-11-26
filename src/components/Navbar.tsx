import React from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen,
  Bus,
  Car,
  Compass,
  Laptop,
  Lock,
  LogOut,
  Navigation,
  Route,
  ShieldCheck,
  Smartphone,
  Wallet,
  Wifi,
} from 'lucide-react';
import { AppTabId, DeviceCapabilities, UserRole } from '../types/transit';
import { formatCop } from '../lib/utils';

interface NavbarProps {
  userRole: UserRole;
  currentTab: AppTabId;
  onTabChange: (tab: AppTabId) => void;
  walletBalance: number;
  onOpenWallet: () => void;
  capabilities: DeviceCapabilities;
  onOpenHardwareInspector: () => void;
  username?: string;
  onLogout?: () => void;
}

const ROLE_TABS: Record<
  UserRole,
  { id: AppTabId; label: string; icon: React.ElementType }[]
> = {
  pasajero: [
    { id: 'planear', label: 'Viajar', icon: Navigation },
    { id: 'mapa', label: 'Mapa en vivo', icon: Compass },
    { id: 'rutas', label: 'Rutas', icon: Route },
    { id: 'billetera', label: 'Billetera', icon: Wallet },
  ],
  conductor: [
    { id: 'conductor', label: 'Mi Unidad', icon: Car },
    { id: 'mapa', label: 'Mapa de Ruta', icon: Compass },
  ],
  administrador: [
    { id: 'admin', label: 'Panel General', icon: ShieldCheck },
    { id: 'mapa', label: 'Mapa de Flota', icon: Compass },
    { id: 'rutas', label: 'Rutas', icon: Route },
  ],
};

export const Navbar: React.FC<NavbarProps> = ({
  userRole,
  currentTab,
  onTabChange,
  walletBalance,
  onOpenWallet,
  capabilities,
  onOpenHardwareInspector,
  username,
  onLogout,
}) => {
  const navItems = ROLE_TABS[userRole];
  const manualHref =
    userRole === 'conductor'
      ? '/manual_conductor.html'
      : userRole === 'administrador'
      ? '/manual_admin.html'
      : '/manual_cliente.html';

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-neutral-200 text-neutral-900 sticky top-0 z-30 shrink-0">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Brand & Role-Filtered Desktop Links */}
        <div className="flex items-center gap-4 lg:gap-6 min-w-0">
          <button
            type="button"
            onClick={() => onTabChange(navItems[0].id)}
            aria-label="Inicio UberBuses"
            className="flex items-center gap-2 cursor-pointer select-none rounded-lg py-1 pr-1 hover:opacity-85 transition-opacity shrink-0"
          >
            <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center shrink-0">
              <Bus className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
            </div>
            <span className="font-black text-base sm:text-lg tracking-tight text-neutral-900">
              Uber<span className="font-medium text-neutral-500">Buses</span>
            </span>
          </button>

          {/* Desktop Navigation Pills (Scoped to Active URL Role) */}
          <nav
            aria-label="Navegación principal"
            className="hidden md:flex items-center gap-1"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative px-3 py-1.5 lg:px-3.5 lg:py-2 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 z-10 whitespace-nowrap ${
                    isActive
                      ? 'text-neutral-900'
                      : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="desktop-light-nav-pill"
                      className="absolute inset-0 bg-neutral-100 rounded-full -z-10"
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    />
                  )}
                  <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right: Desktop Manual + Hardware Inspector + Wallet (Cliente) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {userRole !== 'pasajero' && (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-neutral-100 border border-neutral-200 text-neutral-800">
              {userRole === 'conductor' ? 'Modo Conductor' : 'Administrador'}
            </span>
          )}

          {/* Desktop-only Manual Quick Access (Role-Isolated) */}
          <a
            href={manualHref}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir Manual de Usuario interactivo"
            aria-label="Abrir manual de usuario"
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-neutral-300 bg-neutral-900 text-white hover:bg-neutral-800 transition-all shadow-xs"
          >
            <BookOpen className="w-3.5 h-3.5 text-white" aria-hidden="true" />
            <span>Manual</span>
          </a>

          <button
            type="button"
            onClick={onOpenHardwareInspector}
            aria-label={
              capabilities.hasEffectiveNfc
                ? 'Estado del dispositivo: NFC Activo'
                : 'Estado del dispositivo: Sin NFC físico'
            }
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-medium bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-colors"
          >
            {capabilities.hasEffectiveNfc ? (
              <>
                <Smartphone className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                <span className="hidden xl:inline">NFC Activo</span>
                <Wifi className="w-3 h-3 text-emerald-600 rotate-90" aria-hidden="true" />
              </>
            ) : (
              <>
                <Laptop className="w-3.5 h-3.5 text-neutral-500" aria-hidden="true" />
                <span className="hidden xl:inline">PC (Sin NFC)</span>
                <Lock className="w-3 h-3 text-neutral-500" aria-hidden="true" />
              </>
            )}
          </button>

          {userRole === 'pasajero' && (
            <button
              type="button"
              onClick={onOpenWallet}
              aria-label={`Abrir billetera. Saldo ${formatCop(walletBalance)}`}
              className="flex items-center gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-white font-semibold px-3 sm:px-3.5 py-1.5 rounded-full text-xs sm:text-sm transition-colors shadow-xs"
            >
              <Wallet className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              <span>{formatCop(walletBalance)}</span>
            </button>
          )}

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              title={username ? `Cerrar sesión (${username})` : 'Cerrar sesión'}
              aria-label="Cerrar sesión"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden lg:inline">Salir</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
