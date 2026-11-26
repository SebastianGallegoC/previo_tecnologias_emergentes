import React, { useState, useEffect, useRef } from 'react';
import {
  BusVehicle,
  DeviceCapabilities,
  MapPickMode,
  PaymentMethodType,
  TripEndpoint,
  TripPlanResult,
} from '../types/transit';
import { POPULAR_LANDMARKS } from '../data/cucutaTransitData';
import { planTrip } from '../services/simulationEngine';
import { formatCop, formatWalkDistance } from '../lib/utils';
import { PlaceSearchPicker } from './PlaceSearchPicker';
import {
  ArrowRight,
  ArrowUpDown,
  Bus,
  ChevronDown,
  Clock,
  Footprints,
  Lock,
  MapPin,
  Navigation,
  QrCode,
  Wifi,
} from 'lucide-react';
import { Button } from './ui/button';

export type MobileSheetState = 'peek' | 'half' | 'full';

interface TripPlannerProps {
  buses: BusVehicle[];
  onSelectRouteOnMap: (routeId: string) => void;
  onPayNfcForRoute: (routeId: string, preferredMethod?: PaymentMethodType) => void;
  capabilities?: DeviceCapabilities;
  onPreviewRouteOnMap?: (routeId: string | null) => void;
  onActivePlanChange?: (plan: TripPlanResult | null) => void;
  onPlansChange?: (plans: TripPlanResult[]) => void;
  originEndpoint: TripEndpoint;
  destEndpoint: TripEndpoint | null;
  onChangeOrigin: (endpoint: TripEndpoint) => void;
  onChangeDest: (endpoint: TripEndpoint) => void;
  onSwapEndpoints: () => void;
  onUseCurrentLocation: () => void;
  mapPickMode: MapPickMode;
  onStartMapPick: (mode: 'origin' | 'destination') => void;
  onFrameTripOnMap?: () => void;
  isGuideActive?: boolean;
  onToggleGuide?: (active: boolean) => void;
  mobileSheetState?: MobileSheetState;
  onChangeMobileSheetState?: (state: MobileSheetState) => void;
}

export const TripPlanner: React.FC<TripPlannerProps> = ({
  buses,
  onSelectRouteOnMap,
  onPayNfcForRoute,
  capabilities,
  onPreviewRouteOnMap,
  onActivePlanChange,
  onPlansChange,
  originEndpoint,
  destEndpoint,
  onChangeOrigin,
  onChangeDest,
  onSwapEndpoints,
  onUseCurrentLocation,
  mapPickMode,
  onStartMapPick,
  onFrameTripOnMap,
  isGuideActive = false,
  onToggleGuide,
  mobileSheetState = 'half',
  onChangeMobileSheetState,
}) => {
  const [plans, setPlans] = useState<TripPlanResult[] | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const lastEndpointsKeyRef = useRef<string>('');

  const hasNfc = capabilities?.hasEffectiveNfc ?? false;
  const isMobilePeek =
    capabilities?.formFactor !== 'desktop' && mobileSheetState === 'peek';

  useEffect(() => {
    if (!destEndpoint) {
      setPlans(null);
      setSelectedPlanId(null);
      onActivePlanChange?.(null);
      onPlansChange?.([]);
      onPreviewRouteOnMap?.(null);
      lastEndpointsKeyRef.current = '';
      return;
    }

    const endpointsKey = `${originEndpoint.coordinates.lat},${originEndpoint.coordinates.lng}->${destEndpoint.coordinates.lat},${destEndpoint.coordinates.lng}`;
    const endpointsChanged = endpointsKey !== lastEndpointsKeyRef.current;
    lastEndpointsKeyRef.current = endpointsKey;

    const computed = planTrip(
      originEndpoint.coordinates,
      originEndpoint.name,
      destEndpoint.coordinates,
      destEndpoint.name,
      buses
    );
    setPlans(computed);
    onPlansChange?.(computed);
    if (computed.length > 0) {
      const targetId =
        endpointsChanged || !selectedPlanId || !computed.some((p) => p.id === selectedPlanId)
          ? computed[0].id
          : selectedPlanId;
      if (endpointsChanged) {
        setSelectedPlanId(targetId);
      }
      const activePlanObj = computed.find((p) => p.id === targetId) || computed[0];
      onActivePlanChange?.(activePlanObj);
      const firstRouteLeg = activePlanObj.legs.find((l) => l.routeId);
      if (firstRouteLeg?.routeId && endpointsChanged) {
        onPreviewRouteOnMap?.(firstRouteLeg.routeId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    originEndpoint.coordinates.lat,
    originEndpoint.coordinates.lng,
    originEndpoint.name,
    destEndpoint?.coordinates.lat,
    destEndpoint?.coordinates.lng,
    destEndpoint?.name,
    buses,
  ]);

  const selectedPlan = plans?.find((p) => p.id === selectedPlanId) || plans?.[0] || null;

  const handleSelectPlan = (plan: TripPlanResult) => {
    setSelectedPlanId(plan.id);
    if (onActivePlanChange) {
      onActivePlanChange(plan);
    }
    const routeLeg = plan.legs.find((l) => l.routeId);
    if (routeLeg?.routeId && onPreviewRouteOnMap) {
      onPreviewRouteOnMap(routeLeg.routeId);
    }
  };

  // Compact mobile "Peek" view: maximizes map visibility while keeping key trip instruction & CTA accessible
  if (isMobilePeek && selectedPlan) {
    const peekBusLeg = selectedPlan.legs.find((l) => l.routeId);
    const peekCompany = peekBusLeg?.company || 'Buseta';
    const peekRouteCode = peekBusLeg?.routeCode || '';

    return (
      <div className="px-4 pb-3 pt-1 flex items-center justify-between gap-3 bg-white text-neutral-900">
        <button
          type="button"
          onClick={() => onChangeMobileSheetState?.('half')}
          className="min-w-0 flex-1 text-left py-1"
        >
          <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-900 truncate">
            {isGuideActive && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9px] uppercase">
                Guía
              </span>
            )}
            <span>{peekCompany} ({peekRouteCode})</span>
            <span className="text-neutral-400">•</span>
            <span>{selectedPlan.totalDurationMinutes} min</span>
            <span className="text-neutral-400">•</span>
            <span>{formatCop(selectedPlan.totalFareCop)}</span>
          </div>
          <p className="text-[11px] text-neutral-600 truncate mt-0.5">
            Camina {formatWalkDistance(selectedPlan.walkToBoardingMeters)} a {selectedPlan.boardingStop.name} · Bájate en {selectedPlan.alightingStop.name}
          </p>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onChangeMobileSheetState?.('half')}
          >
            Opciones
          </Button>
          <Button
            size="sm"
            variant="default"
            onClick={() => {
              const routeLeg = selectedPlan.legs.find((l) => l.routeId);
              if (routeLeg?.routeId) {
                onPayNfcForRoute(routeLeg.routeId, hasNfc ? 'NFC' : 'QR');
              }
            }}
          >
            Validar al subir
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white text-neutral-900 overflow-hidden">
      {/* Scrollable Planner Content */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-5 pt-3 sm:pt-5 pb-4 space-y-4">
        {/* Clean Compact Heading */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2
              id="view-heading"
              tabIndex={-1}
              className="text-lg sm:text-xl font-bold tracking-tight text-neutral-900 outline-none"
            >
              ¿A dónde vas?
            </h2>
            <p className="text-xs text-neutral-500">
              Elige tu origen y destino para ver dónde subir y bajarte.
            </p>
          </div>
        </div>

        {/* Active Boarding Guide Banner */}
        {isGuideActive && selectedPlan && (
          <div className="p-3.5 rounded-2xl bg-neutral-900 text-white space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                Guía de abordaje en vivo
              </span>
              <button
                type="button"
                onClick={() => onToggleGuide?.(false)}
                className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-white/15 hover:bg-white/25 transition-colors"
              >
                Finalizar guía
              </button>
            </div>
            <p className="text-xs text-neutral-200 leading-snug">
              Camina hacia <strong>{selectedPlan.boardingStop.name}</strong> ({formatWalkDistance(selectedPlan.walkToBoardingMeters)}). La buseta sigue su ruta fija y no se desvía a recoger; al subir, valida tu pasaje.
            </p>
          </div>
        )}

        {/* Origin & Destination Card */}
        <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-3 sm:p-3.5 space-y-2.5">
          <div className="flex items-center gap-2.5">
            {/* Vertical Uber Line */}
            <div className="flex flex-col items-center py-2 pl-0.5 shrink-0" aria-hidden="true">
              <div className="w-2.5 h-2.5 rounded-full border-2 border-neutral-900 bg-white" />
              <div className="w-px h-14 bg-neutral-300 my-1" />
              <div className="w-2.5 h-2.5 bg-neutral-900" />
            </div>

            {/* Inputs */}
            <div className="flex-1 space-y-2.5 min-w-0">
              {/* Origin (A) */}
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <label
                    htmlFor="origin-select"
                    className="text-[11px] font-semibold text-neutral-500"
                  >
                    Partida (A)
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={onUseCurrentLocation}
                      className={`text-[11px] font-semibold flex items-center gap-1 px-2 py-0.5 rounded-md border transition-colors ${
                        originEndpoint.isCurrentLocation
                          ? 'bg-neutral-900 text-white border-neutral-900'
                          : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                      }`}
                    >
                      <Navigation className="w-3 h-3" aria-hidden="true" />
                      <span>Mi ubicación</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onStartMapPick('origin')}
                      className={`text-[11px] font-semibold flex items-center gap-1 px-2 py-0.5 rounded-md border transition-colors ${
                        mapPickMode === 'origin'
                          ? 'bg-neutral-900 text-white border-neutral-900'
                          : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                      }`}
                    >
                      <MapPin className="w-3 h-3" aria-hidden="true" />
                      <span>{mapPickMode === 'origin' ? 'Tocando...' : 'Mapa'}</span>
                    </button>
                  </div>
                </div>

                <PlaceSearchPicker
                  id="origin-select"
                  ariaLabel="Punto de partida"
                  endpoint={originEndpoint}
                  placeholder="Buscar barrio o lugar de partida..."
                  onSelectLandmark={(idx) => {
                    const lm = POPULAR_LANDMARKS[idx];
                    if (lm) {
                      onChangeOrigin({
                        name: lm.name,
                        coordinates: { lat: lm.lat, lng: lm.lng },
                        landmarkIndex: idx,
                        isCustomMapPoint: false,
                        isCurrentLocation: false,
                      });
                    }
                  }}
                />
              </div>

              {/* Destination (B) */}
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <label
                    htmlFor="dest-select"
                    className="text-[11px] font-semibold text-neutral-500"
                  >
                    Destino (B)
                  </label>
                  <button
                    type="button"
                    onClick={() => onStartMapPick('destination')}
                    className={`text-[11px] font-semibold flex items-center gap-1 px-2 py-0.5 rounded-md border transition-colors ${
                      mapPickMode === 'destination'
                        ? 'bg-neutral-900 text-white border-neutral-900'
                        : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                    }`}
                  >
                    <MapPin className="w-3 h-3" aria-hidden="true" />
                    <span>{mapPickMode === 'destination' ? 'Tocando...' : 'Mapa'}</span>
                  </button>
                </div>

                <PlaceSearchPicker
                  id="dest-select"
                  ariaLabel="Punto de destino"
                  endpoint={destEndpoint}
                  emptyLabel="Elige tu destino..."
                  placeholder="Buscar barrio o lugar de destino..."
                  onSelectLandmark={(idx) => {
                    const lm = POPULAR_LANDMARKS[idx];
                    if (lm) {
                      onChangeDest({
                        name: lm.name,
                        coordinates: { lat: lm.lat, lng: lm.lng },
                        landmarkIndex: idx,
                        isCustomMapPoint: false,
                      });
                    }
                  }}
                />
              </div>
            </div>

            {/* Swap A <-> B */}
            <button
              type="button"
              onClick={onSwapEndpoints}
              aria-label="Invertir origen y destino"
              className="w-9 h-9 rounded-full bg-white hover:bg-neutral-100 text-neutral-600 hover:text-neutral-900 flex items-center justify-center border border-neutral-200 shrink-0 transition-colors active:scale-95"
            >
              <ArrowUpDown className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Clean Initial State Before Picking a Destination */}
        {!destEndpoint && (
          <div className="p-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/70 text-center space-y-1.5">
            <p className="text-xs font-semibold text-neutral-800">
              ¿Hacia dónde te diriges hoy?
            </p>
            <p className="text-[11px] text-neutral-500 leading-relaxed">
              Elige un destino arriba o toca cualquier punto del mapa para ver en vivo las busetas de esa ruta y dónde debes subir.
            </p>
          </div>
        )}

        {/* Scannable Route Options Comparison (Progressive Disclosure) */}
        {plans && plans.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[11px] uppercase tracking-wider text-neutral-500">
                Elige tu mejor ruta ({plans.length})
              </h3>
              <span className="text-[11px] text-neutral-500">
                Toca para previsualizar en mapa
              </span>
            </div>

            <div className="space-y-2">
              {plans.map((p) => {
                const isSelected = p.id === selectedPlan?.id;
                const primaryBusLeg = p.legs.find((l) => l.routeId);
                const routeCode = primaryBusLeg?.routeCode || primaryBusLeg?.routeId?.replace('R0', 'R-0') || 'BUS';
                const busCompany = primaryBusLeg?.company || 'Buseta';

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPlan(p)}
                    aria-pressed={isSelected}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all active:scale-[0.99] ${
                      isSelected
                        ? 'bg-neutral-50 border-neutral-900 ring-1 ring-neutral-900 shadow-xs'
                        : 'bg-white border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    {/* Top Row: Route + Key Metrics */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 border transition-colors ${
                            isSelected
                              ? 'bg-neutral-900 text-white border-neutral-900'
                              : 'bg-neutral-100 text-neutral-800 border-neutral-200'
                          }`}
                        >
                          <Bus className="w-4 h-4" aria-hidden="true" />
                          <span className="text-[9px] font-bold leading-none mt-0.5">
                            {routeCode}
                          </span>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-sm text-neutral-900 truncate">
                              {p.title}
                            </span>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                                isSelected
                                  ? 'bg-neutral-900 text-white border-neutral-900'
                                  : 'bg-neutral-100 text-neutral-700 border-neutral-200'
                              }`}
                            >
                              {p.tag}
                            </span>
                          </div>

                          {/* Chunked Journey Timeline Strip */}
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-600 mt-1">
                            <span className="inline-flex items-center gap-0.5 font-medium text-neutral-800">
                              <Footprints className="w-3 h-3 text-neutral-500" aria-hidden="true" />
                              {p.walkToBoardingMinutes}m
                            </span>
                            <ArrowRight className="w-3 h-3 text-neutral-400" aria-hidden="true" />
                            <span className="inline-flex items-center gap-1 font-semibold text-neutral-900">
                              <Clock className="w-3 h-3 text-neutral-500" aria-hidden="true" />
                              {busCompany} en {p.nextBusInMinutes} min
                            </span>
                            <ArrowRight className="w-3 h-3 text-neutral-400" aria-hidden="true" />
                            <span className="inline-flex items-center gap-0.5 font-medium text-neutral-800">
                              <Footprints className="w-3 h-3 text-neutral-500" aria-hidden="true" />
                              {p.walkFromAlightingMinutes}m
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-extrabold text-sm text-neutral-900 block">
                          {formatCop(p.totalFareCop)}
                        </span>
                        <span className="text-[10px] font-semibold text-neutral-500 block">
                          {p.transfersCount > 0 ? '2 pasajes' : 'Tarifa única'}
                        </span>
                        <span className="text-[11px] font-medium text-neutral-500">
                          {p.totalDurationMinutes} min total
                        </span>
                      </div>
                    </div>

                    {/* Walk-Time vs Bus-Arrival Timing Comparison Pill */}
                    {isSelected && (
                      <div className="mt-2.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                            p.nextBusInMinutes >= p.walkToBoardingMinutes
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-neutral-100 text-neutral-800 border-neutral-200'
                          }`}
                        >
                          <Clock className="w-3 h-3" aria-hidden="true" />
                          {p.nextBusInMinutes >= p.walkToBoardingMinutes
                            ? `Alcanzas la próxima (caminas ${p.walkToBoardingMinutes} min · pasa en ${p.nextBusInMinutes} min)`
                            : `Llegas para la siguiente (caminas ${p.walkToBoardingMinutes} min · próxima pasa en ${p.nextBusInMinutes} min)`}
                        </span>
                      </div>
                    )}

                    {/* Plain-Language Boarding & Alighting Guide (Only shown on Selected Option -> reduces visual noise!) */}
                    {isSelected && (
                      <div className="mt-3 pt-3 border-t border-neutral-200/80 space-y-1.5 text-xs text-neutral-700">
                        <div className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-neutral-900 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                            1
                          </span>
                          <p className="leading-snug">
                            Camina <strong>{formatWalkDistance(p.walkToBoardingMeters)}</strong> hasta{' '}
                            <strong>{p.boardingStop.name}</strong> y sube a la buseta de{' '}
                            <strong>{busCompany} ({routeCode})</strong>.
                          </p>
                        </div>
                        {p.transferStop && (
                          <div className="flex items-start gap-2">
                            <span className="w-4 h-4 rounded-full bg-neutral-200 text-neutral-900 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                              2
                            </span>
                            <p className="leading-snug">
                              Transborda en <strong>{p.transferStop.name}</strong> hacia{' '}
                              <strong>
                                {p.legs.find((l) => l.type === 'transfer')?.company} (
                                {p.legs.find((l) => l.type === 'transfer')?.routeCode})
                              </strong>.
                            </p>
                          </div>
                        )}
                        <div className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-neutral-200 text-neutral-900 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {p.transferStop ? '3' : '2'}
                          </span>
                          <p className="leading-snug">
                            Bájate en <strong>{p.alightingStop.name}</strong> y camina{' '}
                            <strong>{formatWalkDistance(p.walkFromAlightingMeters)}</strong> hasta tu destino.
                          </p>
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Secondary Detailed Legs tucked neatly inside Progressive Disclosure (<details>) */}
        {selectedPlan && (
          <details className="group bg-neutral-50 border border-neutral-200 rounded-2xl overflow-hidden">
            <summary className="px-4 py-3 cursor-pointer flex items-center justify-between text-xs font-semibold text-neutral-800 select-none list-none hover:bg-neutral-100/70 transition-colors">
              <span>Ver desglose detallado de paradas y distancias</span>
              <ChevronDown
                className="w-4 h-4 text-neutral-500 transition-transform duration-200 group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <div className="px-4 pb-4 pt-2 border-t border-neutral-200/70 space-y-2.5 bg-white">
              {selectedPlan.legs.map((leg, index) => (
                <div key={index} className="flex gap-3 items-start">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border ${
                      leg.type === 'walk'
                        ? 'bg-neutral-50 text-neutral-700 border-neutral-200'
                        : 'bg-neutral-900 text-white border-neutral-900'
                    }`}
                  >
                    {leg.type === 'walk' ? (
                      <Footprints className="w-3.5 h-3.5" aria-hidden="true" />
                    ) : (
                      <Bus className="w-3.5 h-3.5" aria-hidden="true" />
                    )}
                  </div>
                  <div className="flex-1 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold text-neutral-900">
                        {leg.instruction}
                      </span>
                      <span className="text-neutral-500 shrink-0 font-medium">
                        {leg.durationMinutes} min
                      </span>
                    </div>
                    <span className="text-neutral-500 text-[11px]">
                      {formatWalkDistance(leg.distanceMeters)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* Sticky Thumb-Zone Action Bar: 1. Start Boarding Guide | 2. Validate Ticket on Board */}
      {selectedPlan && (
        <div className="shrink-0 bg-white border-t border-neutral-200 px-4 sm:px-5 py-3 pb-safe space-y-1.5">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={isGuideActive ? 'secondary' : 'default'}
              onClick={() => {
                const nextActive = !isGuideActive;
                onToggleGuide?.(nextActive);
                const routeLeg = selectedPlan.legs.find((l) => l.routeId);
                if (routeLeg?.routeId) {
                  onSelectRouteOnMap(routeLeg.routeId);
                }
                onFrameTripOnMap?.();
                if (nextActive && capabilities?.formFactor !== 'desktop') {
                  onChangeMobileSheetState?.('peek');
                }
              }}
              className="flex-1"
            >
              <Navigation className="w-4 h-4" aria-hidden="true" />
              <span>{isGuideActive ? 'Guía activa' : 'Iniciar guía de viaje'}</span>
            </Button>

            {hasNfc ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const routeLeg = selectedPlan.legs.find((l) => l.routeId);
                    if (routeLeg?.routeId) {
                      onPayNfcForRoute(routeLeg.routeId, 'NFC');
                    }
                  }}
                >
                  <Wifi className="w-4 h-4 rotate-90" aria-hidden="true" />
                  <span>Validar al subir</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Validar con Código QR al subir"
                  onClick={() => {
                    const routeLeg = selectedPlan.legs.find((l) => l.routeId);
                    if (routeLeg?.routeId) {
                      onPayNfcForRoute(routeLeg.routeId, 'QR');
                    }
                  }}
                >
                  <QrCode className="w-4 h-4" aria-hidden="true" />
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const routeLeg = selectedPlan.legs.find((l) => l.routeId);
                  if (routeLeg?.routeId) {
                    onPayNfcForRoute(routeLeg.routeId, 'QR');
                  }
                }}
              >
                <QrCode className="w-4 h-4" aria-hidden="true" />
                <span>Validar al subir · {formatCop(selectedPlan.totalFareCop)}</span>
              </Button>
            )}
          </div>

          {!hasNfc && (
            <p className="text-[11px] text-neutral-500 text-center flex items-center justify-center gap-1">
              <Lock className="w-3 h-3 text-neutral-400" aria-hidden="true" />
              <span>Valida tu pasaje solo al abordar la buseta (NFC deshabilitado en PC)</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
};
