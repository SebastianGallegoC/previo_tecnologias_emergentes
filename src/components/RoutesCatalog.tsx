import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BusVehicle, RouteInfo } from '../types/transit';
import { CUCUTA_ROUTES } from '../data/cucutaTransitData';
import { formatCop } from '../lib/utils';
import {
  Bus,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
} from 'lucide-react';
import { Button } from './ui/button';

interface RoutesCatalogProps {
  buses: BusVehicle[];
  onSelectRouteOnMap: (routeId: string) => void;
}

export const RoutesCatalog: React.FC<RoutesCatalogProps> = ({
  buses,
  onSelectRouteOnMap,
}) => {
  const [expandedRouteId, setExpandedRouteId] = useState<string | null>('R01');

  const toggleExpand = (id: string) => {
    setExpandedRouteId(expandedRouteId === id ? null : id);
  };

  return (
    <div className="h-full overflow-y-auto bg-white p-4 sm:p-6 pb-24 lg:pb-8 text-neutral-900">
      <div className="max-w-xl mx-auto space-y-5">
        <div>
          <h2
            id="view-heading"
            tabIndex={-1}
            className="text-2xl font-bold tracking-tight text-neutral-900 outline-none"
          >
            Rutas Metropolitanas
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            Horarios, tarifas y paradas en Cúcuta, Los Patios y Villa del Rosario.
          </p>
        </div>

        {/* Clean Aesthetic Routes List */}
        <div className="space-y-3">
          {CUCUTA_ROUTES.map((route: RouteInfo) => {
            const isExpanded = expandedRouteId === route.id;
            const activeBuses = buses.filter((b) => b.routeId === route.id);

            return (
              <div
                key={route.id}
                className={`bg-white border rounded-2xl overflow-hidden transition-colors ${
                  isExpanded ? 'border-neutral-900' : 'border-neutral-200'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleExpand(route.id)}
                  aria-expanded={isExpanded}
                  className="w-full text-left p-4 flex items-start justify-between cursor-pointer hover:bg-neutral-50/80 transition-colors select-none"
                >
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
                        isExpanded
                          ? 'bg-neutral-900 text-white border-neutral-900'
                          : 'bg-neutral-100 text-neutral-800 border-neutral-200'
                      }`}
                    >
                      <Bus className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-neutral-900 text-white text-[11px] font-bold tracking-tight">
                          {route.code}
                        </span>
                        <h3 className="font-bold text-sm text-neutral-900">
                          {route.name}
                        </h3>
                      </div>
                      <p className="text-xs text-neutral-500 mt-0.5">{route.company}</p>

                      <div className="flex flex-wrap items-center gap-2.5 mt-2.5 text-xs text-neutral-600">
                        <span className="px-2 py-0.5 rounded-md bg-neutral-100 border border-neutral-200 font-bold text-neutral-900 text-[11px]">
                          {formatCop(route.fare)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-neutral-400" aria-hidden="true" />
                          Cada {route.frequencyMinutes} min
                        </span>
                        <span className="flex items-center gap-1 font-medium text-neutral-700">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: route.color }}
                            aria-hidden="true"
                          />
                          {activeBuses.length} unidades ({activeBuses.map((b) => b.code).join(', ')})
                        </span>
                      </div>
                    </div>
                  </div>

                  <span className="p-1 text-neutral-400" aria-hidden="true">
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-2 border-t border-neutral-100 space-y-3 text-xs">
                        <p className="text-neutral-600">{route.description}</p>

                        <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/70 flex flex-wrap justify-between gap-2">
                          <div>
                            <span className="text-[10px] text-neutral-400 font-semibold uppercase block">
                              Horario
                            </span>
                            <span className="font-semibold text-neutral-900">
                              {route.schedule}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-neutral-400 font-semibold uppercase block">
                              Recorrido
                            </span>
                            <span className="font-semibold text-neutral-900">
                              {route.directionA}
                            </span>
                          </div>
                        </div>

                        <div>
                          <span className="text-[11px] text-neutral-500 font-semibold block mb-1.5">
                            Paradas oficiales ({route.stops.length})
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {route.stops.map((stop, sIdx) => (
                              <div
                                key={stop.id}
                                className="p-2 bg-neutral-50 rounded-lg border border-neutral-200/60 flex items-center gap-2"
                              >
                                <span className="w-4 h-4 rounded-full bg-neutral-200 text-neutral-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                                  {sIdx + 1}
                                </span>
                                <span className="font-medium text-neutral-800 truncate">
                                  {stop.name}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="pt-1 flex justify-end">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => onSelectRouteOnMap(route.id)}
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            <span>Ver ruta en el mapa</span>
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
