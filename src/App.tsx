import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion, PanInfo } from 'framer-motion';
import {
  AppTabId,
  BusVehicle,
  Coordinates,
  MapPickMode,
  PaymentMethodType,
  TransitTicket,
  TripEndpoint,
  TripPlanResult,
  UserRole,
} from './types/transit';
import {
  CUCUTA_CENTER,
  CUCUTA_ROUTES,
  INITIAL_BUSES,
  POPULAR_LANDMARKS,
} from './data/cucutaTransitData';
import { calculateDistanceKm, stepBusSimulation } from './services/simulationEngine';
import { WalletApplicationService } from './services/walletService';
import { useDeviceCapabilities } from './hooks/useDeviceCapabilities';
import { startSafeViewTransition } from './lib/utils';

import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { LiveMap } from './components/LiveMap';
import { MobileSheetState, TripPlanner } from './components/TripPlanner';
import { WalletView } from './components/WalletView';
import { RoutesCatalog } from './components/RoutesCatalog';
import { DriverConsole } from './components/DriverConsole';
import { AdminDashboard } from './components/AdminDashboard';
import { NfcPaymentModal } from './components/NfcPaymentModal';
import { TicketModal } from './components/TicketModal';
import { HardwareInspectorModal } from './components/HardwareInspectorModal';
import { AuthScreen } from './components/AuthScreen';
import { authService, AuthUser } from './services/authService';
import { Button } from './components/ui/button';
import {
  Bus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Navigation,
  QrCode,
  Wifi,
} from 'lucide-react';

function resolveNearestPlaceName(coords: Coordinates): string {
  let nearest = POPULAR_LANDMARKS[0];
  let minDist = Number.MAX_SAFE_INTEGER;

  for (const lm of POPULAR_LANDMARKS) {
    const d = calculateDistanceKm(coords, { lat: lm.lat, lng: lm.lng });
    if (d < minDist) {
      minDist = d;
      nearest = lm;
    }
  }

  if (minDist < 0.8) {
    return `Cerca de ${nearest.name.split('/')[0].trim()}`;
  }
  return `Punto en mapa (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`;
}

function resolveRoleFromPath(pathname: string): {
  role: UserRole;
  defaultTab: AppTabId;
} {
  const normalized = pathname.toLowerCase();
  if (normalized.startsWith('/admin')) {
    return { role: 'administrador', defaultTab: 'admin' };
  }
  if (normalized.startsWith('/conductor')) {
    return { role: 'conductor', defaultTab: 'conductor' };
  }
  return { role: 'pasajero', defaultTab: 'planear' };
}

export const App: React.FC = () => {
  const { capabilities, setSimulatedNfcMode } = useDeviceCapabilities();
  const walletService = WalletApplicationService.getInstance();

  const initialRoute = resolveRoleFromPath(window.location.pathname);
  const [authUser, setAuthUser] = useState<AuthUser | null>(() =>
    authService.getSession()
  );
  const [userRole, setUserRole] = useState<UserRole>(
    () => authService.getSession()?.role ?? initialRoute.role
  );
  const [currentTab, setCurrentTab] = useState<AppTabId>(() => {
    const activeRole = authService.getSession()?.role ?? initialRoute.role;
    if (activeRole === 'administrador') return 'admin';
    if (activeRole === 'conductor') return 'conductor';
    return 'planear';
  });

  const handleAuthenticated = (user: AuthUser) => {
    setAuthUser(user);
    setUserRole(user.role);
    setCurrentTab(
      user.role === 'administrador'
        ? 'admin'
        : user.role === 'conductor'
        ? 'conductor'
        : 'planear'
    );
  };

  const handleLogout = () => {
    authService.logout();
    setAuthUser(null);
  };
  const [buses, setBuses] = useState<BusVehicle[]>(INITIAL_BUSES);
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const [filterRouteId, setFilterRouteId] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number>(() =>
    walletService.getBalance()
  );
  const [userCoords, setUserCoords] = useState<Coordinates | null>(null);
  const [flyTarget, setFlyTarget] = useState<{
    lat: number;
    lng: number;
    zoom?: number;
    ts: number;
  } | null>(null);
  const [fitTripBoundsTrigger, setFitTripBoundsTrigger] = useState<number>(0);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);
  const [mobileSheetState, setMobileSheetState] = useState<MobileSheetState>('half');

  // Origin & Destination state
  const [originEndpoint, setOriginEndpoint] = useState<TripEndpoint>({
    name: 'Mi ubicación actual (Centro Cúcuta)',
    coordinates: CUCUTA_CENTER,
    isCustomMapPoint: true,
    isCurrentLocation: true,
  });

  const [destEndpoint, setDestEndpoint] = useState<TripEndpoint | null>(null);

  const [activePlan, setActivePlan] = useState<TripPlanResult | null>(null);
  const [allPlans, setAllPlans] = useState<TripPlanResult[]>([]);
  const [isGuideActive, setIsGuideActive] = useState<boolean>(false);
  const [mapPickMode, setMapPickMode] = useState<MapPickMode>(null);

  // Modals state
  const [isNfcModalOpen, setIsNfcModalOpen] = useState(false);
  const [preferredPaymentMethod, setPreferredPaymentMethod] =
    useState<PaymentMethodType | undefined>(undefined);
  const [targetBusForNfc, setTargetBusForNfc] = useState<BusVehicle | null>(null);
  const [activeTicket, setActiveTicket] = useState<TransitTicket | null>(null);
  const [isHardwareInspectorOpen, setIsHardwareInspectorOpen] = useState(false);

  useEffect(() => {
    if (window.location.pathname === '/') {
      window.history.replaceState(null, '', '/cliente');
    }
    const handlePopState = () => {
      const next = resolveRoleFromPath(window.location.pathname);
      setUserRole(next.role);
      setCurrentTab(next.defaultTab);
      setMapPickMode(null);
      if (next.role === 'administrador') {
        setFilterRouteId(null);
        setSelectedBusId(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    setWalletBalance(walletService.getBalance());
    return walletService.subscribe(() => {
      setWalletBalance(walletService.getBalance());
    });
  }, [walletService]);

  useEffect(() => {
    const timer = setInterval(() => {
      setBuses((prevBuses) => stepBusSimulation(prevBuses, 1.0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleTabChange = useCallback((nextTab: AppTabId) => {
    startSafeViewTransition(() => {
      setCurrentTab(nextTab);
      setIsDesktopSidebarCollapsed(false);
      if (nextTab === 'planear') {
        setMobileSheetState('half');
      }
    }, '#view-heading');
  }, []);

  const applyCurrentLocationAsOrigin = useCallback((coords: Coordinates) => {
    const distFromCucuta = calculateDistanceKm(coords, CUCUTA_CENTER);
    const effectiveCoords = distFromCucuta <= 25 ? coords : CUCUTA_CENTER;
    const placeHint = resolveNearestPlaceName(effectiveCoords);

    setUserCoords(effectiveCoords);
    setOriginEndpoint({
      name: `Mi ubicación actual (${placeHint})`,
      coordinates: effectiveCoords,
      isCustomMapPoint: true,
      isCurrentLocation: true,
    });
    setFlyTarget({
      lat: effectiveCoords.lat,
      lng: effectiveCoords.lng,
      zoom: 15,
      ts: Date.now(),
    });
  }, []);

  const handleUseCurrentLocation = useCallback(() => {
    if (capabilities.hasGeolocation && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          applyCurrentLocationAsOrigin({
            lat: Number(pos.coords.latitude.toFixed(5)),
            lng: Number(pos.coords.longitude.toFixed(5)),
          });
        },
        () => {
          applyCurrentLocationAsOrigin(CUCUTA_CENTER);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      applyCurrentLocationAsOrigin(CUCUTA_CENTER);
    }
  }, [capabilities.hasGeolocation, applyCurrentLocationAsOrigin]);

  const handleStartMapPick = (mode: 'origin' | 'destination') => {
    setMapPickMode(mode);
  };

  const handleMapPointPicked = (mode: 'origin' | 'destination', coords: Coordinates) => {
    const label = resolveNearestPlaceName(coords);
    const updatedEndpoint: TripEndpoint = {
      name: label,
      coordinates: coords,
      isCustomMapPoint: true,
      isCurrentLocation: false,
    };

    if (mode === 'origin') {
      setOriginEndpoint(updatedEndpoint);
    } else {
      setDestEndpoint(updatedEndpoint);
    }

    setFlyTarget({
      lat: coords.lat,
      lng: coords.lng,
      zoom: 14,
      ts: Date.now(),
    });

    setMapPickMode(null);
    if (capabilities.formFactor !== 'desktop') {
      setCurrentTab('planear');
      setMobileSheetState('half');
    }
  };

  const handleSwapEndpoints = () => {
    if (!destEndpoint) return;
    setOriginEndpoint(destEndpoint);
    setDestEndpoint(originEndpoint);
  };

  const handlePayBus = (bus: BusVehicle, method?: PaymentMethodType) => {
    setTargetBusForNfc(bus);
    setPreferredPaymentMethod(
      method ?? (capabilities.hasEffectiveNfc ? 'NFC' : 'QR')
    );
    setIsNfcModalOpen(true);
  };

  const handlePayForRoute = (routeId: string, method?: PaymentMethodType) => {
    const busOnRoute = buses.find((b) => b.routeId === routeId) || buses[0];
    handlePayBus(busOnRoute, method);
  };

  const handlePaymentSuccess = (ticket: TransitTicket) => {
    setIsNfcModalOpen(false);
    setActiveTicket(ticket);
    setWalletBalance(walletService.getBalance());
  };

  const handleUpdateBusPassengers = (busId: string, delta: number) => {
    setBuses((prev) =>
      prev.map((b) => {
        if (b.id !== busId) return b;
        const newCount = Math.max(0, Math.min(b.capacity, b.passengerCount + delta));
        return {
          ...b,
          passengerCount: newCount,
          occupancyPercentage: Math.round((newCount / b.capacity) * 100),
        };
      })
    );
  };

  const handleSheetDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const vy = info.velocity.y;
    const dy = info.offset.y;

    if (vy < -250 || dy < -50) {
      setMobileSheetState((prev) => (prev === 'peek' ? 'half' : 'full'));
    } else if (vy > 250 || dy > 50) {
      setMobileSheetState((prev) => (prev === 'full' ? 'half' : 'peek'));
    }
  };

  const cycleSheetState = () => {
    setMobileSheetState((prev) =>
      prev === 'peek' ? 'half' : prev === 'half' ? 'full' : 'peek'
    );
  };

  const renderTripPlanner = (isMobileSheet = false) => (
    <TripPlanner
      buses={buses}
      capabilities={capabilities}
      originEndpoint={originEndpoint}
      destEndpoint={destEndpoint}
      onChangeOrigin={(ep) => {
        setOriginEndpoint(ep);
        setFlyTarget({ ...ep.coordinates, zoom: 14, ts: Date.now() });
      }}
      onChangeDest={(ep) => {
        setDestEndpoint(ep);
        setFlyTarget({ ...ep.coordinates, zoom: 14, ts: Date.now() });
      }}
      onSwapEndpoints={handleSwapEndpoints}
      onUseCurrentLocation={handleUseCurrentLocation}
      mapPickMode={mapPickMode}
      onStartMapPick={handleStartMapPick}
      onActivePlanChange={(plan) => setActivePlan(plan)}
      onPlansChange={(plans) => setAllPlans(plans)}
      onFrameTripOnMap={() => setFitTripBoundsTrigger((n) => n + 1)}
      isGuideActive={isGuideActive}
      onToggleGuide={(active) => setIsGuideActive(active)}
      mobileSheetState={isMobileSheet ? mobileSheetState : 'full'}
      onChangeMobileSheetState={setMobileSheetState}
      onSelectRouteOnMap={(rid) => {
        setFilterRouteId(rid);
        setFitTripBoundsTrigger((n) => n + 1);
        if (capabilities.formFactor !== 'desktop') {
          setMobileSheetState('peek');
        }
      }}
      onPreviewRouteOnMap={(rid) => {
        setFilterRouteId(rid);
      }}
      onPayNfcForRoute={handlePayForRoute}
    />
  );

  const renderDesktopOrFullViewContent = () => {
    switch (currentTab) {
      case 'planear':
        return renderTripPlanner(false);

      case 'billetera':
        return (
          <WalletView
            balance={walletBalance}
            capabilities={capabilities}
            onBalanceUpdated={() => setWalletBalance(walletService.getBalance())}
            onViewTicket={(t) => setActiveTicket(t)}
            onOpenNfcPay={(method) => {
              handlePayBus(buses[0], method);
            }}
          />
        );

      case 'rutas':
        return (
          <RoutesCatalog
            buses={buses}
            onSelectRouteOnMap={(rid) => {
              setFilterRouteId(rid);
              if (capabilities.formFactor !== 'desktop') {
                handleTabChange('mapa');
              }
            }}
          />
        );

      case 'admin':
        return (
          <AdminDashboard
            buses={buses}
            onSelectBusOnMap={(busId) => {
              setSelectedBusId(busId);
              const found = buses.find((b) => b.id === busId);
              if (found) {
                setFlyTarget({
                  lat: found.coordinates.lat,
                  lng: found.coordinates.lng,
                  zoom: 15,
                  ts: Date.now(),
                });
                if (capabilities.formFactor !== 'desktop') {
                  handleTabChange('mapa');
                }
              }
            }}
            onUpdateBusStatus={(busId, status) => {
              setBuses((prev) =>
                prev.map((b) => (b.id === busId ? { ...b, status } : b))
              );
            }}
          />
        );

      case 'conductor':
        return (
          <DriverConsole
            buses={buses}
            onUpdateBusPassengers={handleUpdateBusPassengers}
            onSelectBusOnMap={(busId) => {
              setSelectedBusId(busId);
              const found = buses.find((b) => b.id === busId);
              if (found) {
                setFlyTarget({
                  lat: found.coordinates.lat,
                  lng: found.coordinates.lng,
                  zoom: 15,
                  ts: Date.now(),
                });
              }
            }}
          />
        );

      case 'nfc':
        return (
          <div className="h-full overflow-y-auto bg-neutral-50 flex items-center justify-center p-4 pb-24 lg:pb-6">
            <NfcPaymentModal
              isOpen={true}
              inlineMode={true}
              onClose={() => handleTabChange('planear')}
              targetBus={targetBusForNfc}
              availableBuses={buses}
              capabilities={capabilities}
              onPaymentSuccess={handlePaymentSuccess}
            />
          </div>
        );

      case 'mapa':
      default:
        return (
          <div className="h-full overflow-y-auto bg-white p-4 sm:p-5 pb-24 lg:pb-8 text-neutral-900 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2
                  id="view-heading"
                  tabIndex={-1}
                  className="text-xl font-bold tracking-tight text-neutral-900 outline-none"
                >
                  Unidades en Servicio ({buses.length})
                </h2>
                <p className="text-xs text-neutral-500">
                  Toca una buseta para seguir su ubicación en vivo.
                </p>
              </div>
              <Button
                size="sm"
                variant="default"
                onClick={() => handleTabChange('planear')}
              >
                <Navigation className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Viajar</span>
              </Button>
            </div>

            <div className="space-y-2">
              {buses
                .filter((b) => !filterRouteId || b.routeId === filterRouteId)
                .map((bus) => {
                  const route = CUCUTA_ROUTES.find((r) => r.id === bus.routeId);
                  const isSelected = bus.id === selectedBusId;
                  return (
                    <div
                      key={bus.id}
                      onClick={() => {
                        setSelectedBusId(bus.id);
                        setFlyTarget({
                          lat: bus.coordinates.lat,
                          lng: bus.coordinates.lng,
                          zoom: 15,
                          ts: Date.now(),
                        });
                      }}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-neutral-50 border-neutral-900 ring-1 ring-neutral-900'
                          : 'bg-white border-neutral-200 hover:border-neutral-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
                            isSelected
                              ? 'bg-neutral-900 text-white border-neutral-900'
                              : 'bg-neutral-100 text-neutral-800 border-neutral-200'
                          }`}
                        >
                          <Bus className="w-5 h-5" aria-hidden="true" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md bg-neutral-900 text-white text-[11px] font-bold tracking-tight">
                              {bus.code}
                            </span>
                            <span className="font-bold text-xs sm:text-sm text-neutral-900 truncate">
                              {route?.name || bus.company}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-neutral-500 mt-1 truncate">
                            <span className="font-mono text-neutral-600">{bus.plate}</span>
                            <span>•</span>
                            <span className="truncate">Próxima: {bus.nextStopName}</span>
                          </div>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePayBus(bus);
                        }}
                      >
                        {capabilities.hasEffectiveNfc ? (
                          <>
                            <Wifi className="w-3.5 h-3.5 rotate-90" aria-hidden="true" />
                            <span>NFC</span>
                          </>
                        ) : (
                          <>
                            <QrCode className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>QR</span>
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
            </div>
          </div>
        );
    }
  };

  const isMapPrimaryOnMobile = currentTab === 'planear' || currentTab === 'mapa';
  const showMobilePlannerSheet =
    userRole === 'pasajero' && currentTab === 'planear' && !mapPickMode;

  const mobileSheetHeightClass =
    mobileSheetState === 'peek'
      ? 'h-auto'
      : mobileSheetState === 'half'
      ? 'h-[56dvh]'
      : 'h-[82dvh]';

  if (!authUser) {
    return (
      <AuthScreen
        defaultPortal={
          window.location.pathname.toLowerCase().startsWith('/admin')
            ? 'administrador'
            : 'usuario'
        }
        onAuthenticated={handleAuthenticated}
      />
    );
  }

  return (
    <div className="h-[100dvh] w-[100dvw] flex flex-col bg-white text-neutral-900 overflow-hidden font-sans">
      <Navbar
        userRole={userRole}
        currentTab={currentTab}
        onTabChange={handleTabChange}
        walletBalance={walletBalance}
        onOpenWallet={() => handleTabChange('billetera')}
        capabilities={capabilities}
        onOpenHardwareInspector={() => setIsHardwareInspectorOpen(true)}
        username={authUser.username}
        onLogout={handleLogout}
      />

      <main className="flex-1 relative flex overflow-hidden">
        {/* Desktop Split-View Master Panel (lg+) */}
        {!isDesktopSidebarCollapsed && (
          <aside className="hidden lg:flex w-[420px] xl:w-[460px] relative z-20 h-full bg-white border-r border-neutral-200 flex-col shrink-0 overflow-hidden">
            <div className="uber-panel-container w-full h-full overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentTab}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16 }}
                  className="h-full w-full overflow-hidden"
                >
                  {renderDesktopOrFullViewContent()}
                </motion.div>
              </AnimatePresence>
            </div>
          </aside>
        )}

        {/* Desktop Sidebar Collapse Handle — cleanly anchored right outside sidebar divider */}
        <div className="hidden lg:flex items-center relative z-30 w-0">
          <button
            type="button"
            onClick={() => setIsDesktopSidebarCollapsed((prev) => !prev)}
            aria-label={isDesktopSidebarCollapsed ? 'Mostrar panel lateral' : 'Ocultar panel lateral'}
            className="w-6 h-12 bg-white hover:bg-neutral-50 border border-l-0 border-neutral-200 rounded-r-lg flex items-center justify-center text-neutral-500 hover:text-neutral-900 shadow-sm transition-colors"
          >
            {isDesktopSidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            ) : (
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        </div>

        {/* Mobile Non-Map Full Views (rutas, billetera, conductor, nfc) */}
        {!isMapPrimaryOnMobile && (
          <section
            aria-label="Contenido principal"
            className="lg:hidden flex-1 h-full w-full overflow-hidden bg-white"
          >
            {renderDesktopOrFullViewContent()}
          </section>
        )}

        {/* Interactive Map Canvas — Always visible on Desktop AND on Mobile 'Viajar'/'Mapa' */}
        <section
          aria-label="Mapa interactivo"
          className={`flex-1 relative h-full overflow-hidden ${
            isMapPrimaryOnMobile ? 'block' : 'hidden lg:block'
          }`}
        >
          <LiveMap
            buses={buses}
            selectedBusId={selectedBusId}
            onSelectBus={(id) => setSelectedBusId(id)}
            onPayBusNfc={handlePayBus}
            userCoords={userCoords}
            onLocateUser={handleUseCurrentLocation}
            filterRouteId={filterRouteId}
            onFilterRouteChange={(rid) => setFilterRouteId(rid)}
            capabilities={capabilities}
            onOpenPlanner={
              userRole === 'pasajero' && currentTab === 'mapa'
                ? () => handleTabChange('planear')
                : undefined
            }
            flyTarget={flyTarget}
            fitTripBoundsTrigger={fitTripBoundsTrigger}
            isBottomSheetBlocking={
              showMobilePlannerSheet && mobileSheetState !== 'peek'
            }
            originEndpoint={originEndpoint}
            destEndpoint={destEndpoint}
            activePlan={activePlan}
            alternativePlans={allPlans.filter((p) => p.id !== activePlan?.id)}
            focusTripOnly={userRole === 'pasajero' && currentTab === 'planear'}
            driverOnlyBusId={
              userRole === 'conductor' ? selectedBusId || buses[0]?.id || null : null
            }
            mapPickMode={mapPickMode}
            onStartMapPick={handleStartMapPick}
            onCancelMapPick={() => setMapPickMode(null)}
            onMapPointPicked={handleMapPointPicked}
          />
        </section>

        {/* Mobile Uber-Style Interactive Bottom Sheet over Live Map (only in 'Viajar') */}
        <AnimatePresence>
          {showMobilePlannerSheet && (
            <motion.section
              key="mobile-bottom-sheet"
              aria-label="Panel de viaje"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 360, damping: 34 }}
              className={`lg:hidden fixed left-0 right-0 bottom-16 z-20 bg-white rounded-t-3xl border-t border-neutral-200 shadow-[0_-10px_30px_rgba(0,0,0,0.12)] flex flex-col overflow-hidden transition-[height] duration-200 ease-out ${mobileSheetHeightClass}`}
            >
              {/* Drag & Tap Handle Header */}
              <motion.div
                onPanEnd={handleSheetDragEnd}
                className="shrink-0 pt-2 pb-1 px-4 flex items-center justify-between touch-none cursor-grab active:cursor-grabbing bg-white"
              >
                <div className="w-12" />
                <button
                  type="button"
                  onClick={cycleSheetState}
                  aria-label={
                    mobileSheetState === 'peek'
                      ? 'Expandir planificador'
                      : 'Minimizar planificador para ver mapa'
                  }
                  className="py-1 px-4 flex flex-col items-center gap-1 rounded-full"
                >
                  <span className="w-10 h-1.5 rounded-full bg-neutral-300 block" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setMobileSheetState(mobileSheetState === 'peek' ? 'half' : 'peek')
                  }
                  aria-label={
                    mobileSheetState === 'peek' ? 'Mostrar opciones' : 'Ocultar panel'
                  }
                  className="p-1.5 rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                >
                  {mobileSheetState === 'peek' ? (
                    <ChevronUp className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </motion.div>

              <div className="flex-1 min-h-0 overflow-hidden">
                {renderTripPlanner(true)}
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <BottomNav
        userRole={userRole}
        currentTab={currentTab}
        capabilities={capabilities}
        onTabChange={(tab) => {
          if (tab === 'nfc') {
            handlePayBus(buses[0]);
          } else {
            handleTabChange(tab);
          }
        }}
      />

      {isNfcModalOpen && currentTab !== 'nfc' && (
        <NfcPaymentModal
          isOpen={isNfcModalOpen}
          onClose={() => setIsNfcModalOpen(false)}
          targetBus={targetBusForNfc}
          availableBuses={buses}
          capabilities={capabilities}
          initialMethod={preferredPaymentMethod}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}

      {activeTicket && (
        <TicketModal ticket={activeTicket} onClose={() => setActiveTicket(null)} />
      )}

      <HardwareInspectorModal
        isOpen={isHardwareInspectorOpen}
        onClose={() => setIsHardwareInspectorOpen(false)}
        capabilities={capabilities}
        onToggleSimulateNfc={(enabled) => setSimulatedNfcMode(enabled)}
      />
    </div>
  );
};

export default App;
