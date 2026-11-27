import React from 'react';
import {
  Car,
  Compass,
  Map,
  Navigation,
  QrCode,
  Route,
  ShieldCheck,
  Wallet,
  Wifi,
} from 'lucide-react';
import { AppTabId, DeviceCapabilities, UserRole } from '../types/transit';

interface BottomNavProps {
  userRole: UserRole;
  currentTab: AppTabId;
  onTabChange: (tab: AppTabId) => void;
  capabilities?: DeviceCapabilities;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  userRole,
  currentTab,
  onTabChange,
  capabilities,
}) => {
  const hasNfc = capabilities?.hasEffectiveNfc ?? false;

  const navItemsByRole: Record<
    UserRole,
    { id: AppTabId; label: string; icon: React.ElementType }[]
  > = {
    pasajero: [
      { id: 'planear', label: 'Viajar', icon: Navigation },
      { id: 'mapa', label: 'Mapa', icon: Map },
      {
        id: 'nfc',
        label: hasNfc ? 'NFC' : 'Pagar QR',
        icon: hasNfc ? Wifi : QrCode,
      },
      { id: 'rutas', label: 'Rutas', icon: Route },
      { id: 'billetera', label: 'Billetera', icon: Wallet },
    ],
    administrador: [
      { id: 'admin', label: 'Panel', icon: ShieldCheck },
      { id: 'mapa', label: 'Mapa Flota', icon: Compass },
      { id: 'rutas', label: 'Rutas', icon: Route },
    ],
  };

  const navItems = navItemsByRole[userRole];

  return (
    <nav
      aria-label="Navegación móvil inferior"
      className="md:hidden bg-white/95 backdrop-blur-md border-t border-neutral-200 text-neutral-500 fixed bottom-0 left-0 right-0 z-30 select-none pb-safe"
    >
      <div className="max-w-lg mx-auto flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          const isPayAction = item.id === 'nfc';

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-xl transition-all active:scale-95 ${
                isActive ? 'text-neutral-900 font-bold' : 'hover:text-neutral-800'
              }`}
            >
              <div
                className={`px-3 py-1 rounded-full transition-colors ${
                  isPayAction
                    ? 'bg-neutral-900 text-white shadow-xs'
                    : isActive
                    ? 'bg-neutral-100 text-neutral-900'
                    : ''
                }`}
              >
                <Icon
                  aria-hidden="true"
                  className={`w-4 h-4 ${
                    isPayAction && hasNfc ? 'rotate-90' : ''
                  } ${isActive ? 'stroke-[2.4]' : 'stroke-[1.9]'}`}
                />
              </div>
              <span className="text-[11px] mt-0.5 leading-none">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
