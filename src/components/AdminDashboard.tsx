import React, { useState } from 'react';
import { BusVehicle, TrafficAlert } from '../types/transit';
import { CUCUTA_ROUTES, LIVE_TRAFFIC_ALERTS } from '../data/cucutaTransitData';
import { formatCop } from '../lib/utils';
import {
  AlertTriangle,
  Bus,
  CheckCircle2,
  MapPin,
  Radio,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Button } from './ui/button';

interface AdminDashboardProps {
  buses: BusVehicle[];
  onSelectBusOnMap: (busId: string) => void;
  onUpdateBusStatus: (
    busId: string,
    status: BusVehicle['status']
  ) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  buses,
  onSelectBusOnMap,
  onUpdateBusStatus,
}) => {
  const [companyFilter, setCompanyFilter] = useState<string>('Todas');
  const [alerts, setAlerts] = useState<TrafficAlert[]>(LIVE_TRAFFIC_ALERTS);
  const [resolvedAlertIds, setResolvedAlertIds] = useState<string[]>([]);

  const companies = ['Todas', ...Array.from(new Set(buses.map((b) => b.company)))];

  const filteredBuses =
    companyFilter === 'Todas'
      ? buses
      : buses.filter((b) => b.company === companyFilter);

  const totalPassengers = buses.reduce((acc, b) => acc + b.passengerCount, 0);
  const totalCapacity = buses.reduce((acc, b) => acc + b.capacity, 0);
  const avgOccupancy =
    totalCapacity > 0 ? Math.round((totalPassengers / totalCapacity) * 100) : 0;
  const congestedCount = buses.filter((b) => b.status === 'congestión').length;

  // Estimated daily revenue across active fleet (simulated base + live passengers)
  const estimatedFleetRevenue = buses.reduce((sum, bus) => {
    const route = CUCUTA_ROUTES.find((r) => r.id === bus.routeId);
    const fare = route?.fare ?? 3000;
    return sum + (bus.passengerCount + 34) * fare;
  }, 0);

  const handleResolveAlert = (id: string) => {
    setResolvedAlertIds((prev) => [...prev, id]);
  };

  const handleAddBroadcastAlert = () => {
    const newAlert: TrafficAlert = {
      id: `alt-${Date.now()}`,
      location: 'Av. Cero con Calle 11 (Centro)',
      municipality: 'Cúcuta',
      severity: 'moderado',
      description: 'Despacho adicional activado desde Centro de Control para cubrir demanda.',
      timestamp: 'Ahora',
    };
    setAlerts((prev) => [newAlert, ...prev]);
  };

  return (
    <div className="h-full overflow-y-auto bg-white p-4 sm:p-5 pb-24 lg:pb-8 text-neutral-900">
      <div className="max-w-xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-neutral-100 border border-neutral-200 text-[11px] font-bold text-neutral-700 mb-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-neutral-900" aria-hidden="true" />
              <span>Centro de Control Metropolitano</span>
            </div>
            <h2
              id="view-heading"
              tabIndex={-1}
              className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 outline-none"
            >
              Panel Administrador
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Supervisión de flota, cooperativas, recaudo y alertas viales en vivo.
            </p>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3.5 rounded-2xl bg-neutral-900 text-white space-y-1">
            <div className="flex items-center justify-between text-neutral-300 text-[11px]">
              <span>Recaudo estimado hoy</span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
            </div>
            <div className="text-xl font-extrabold tracking-tight">
              {formatCop(estimatedFleetRevenue)}
            </div>
            <span className="text-[10px] text-neutral-400 block">
              {buses.length} unidades activas en 4 rutas
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-1">
            <div className="flex items-center justify-between text-neutral-500 text-[11px]">
              <span>Ocupación de flota</span>
              <Users className="w-3.5 h-3.5 text-neutral-700" aria-hidden="true" />
            </div>
            <div className="text-xl font-extrabold text-neutral-900">
              {avgOccupancy}%{' '}
              <span className="text-xs font-medium text-neutral-500">
                ({totalPassengers}/{totalCapacity})
              </span>
            </div>
            <span className="text-[10px] text-neutral-500 block">
              {congestedCount > 0
                ? `${congestedCount} unidad(es) con alta demanda`
                : 'Flujo operativo normal'}
            </span>
          </div>
        </div>

        {/* Cooperative Filter Pills */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-500">
              Flota por cooperativa ({filteredBuses.length})
            </h3>
          </div>

          <div
            role="region"
            aria-label="Filtrar por cooperativa"
            tabIndex={0}
            className="snap-scroller gap-1.5 pb-1"
          >
            {companies.map((company) => {
              const isActive = companyFilter === company;
              return (
                <button
                  key={company}
                  type="button"
                  onClick={() => setCompanyFilter(company)}
                  aria-pressed={isActive}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    isActive
                      ? 'bg-neutral-900 text-white border-neutral-900'
                      : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  {company}
                </button>
              );
            })}
          </div>

          {/* Fleet List */}
          <div className="space-y-2">
            {filteredBuses.map((bus) => {
              const route = CUCUTA_ROUTES.find((r) => r.id === bus.routeId);
              return (
                <div
                  key={bus.id}
                  className="p-3.5 rounded-2xl border border-neutral-200 bg-white space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-900 shrink-0">
                        <Bus className="w-4 h-4" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-neutral-900 text-white text-[10px] font-bold">
                            {bus.code}
                          </span>
                          <span className="font-bold text-xs text-neutral-900 truncate">
                            {bus.company}
                          </span>
                          <span className="text-[10px] font-mono text-neutral-500">
                            {bus.plate}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-500 truncate mt-0.5">
                          {route?.code} • Conductor: {bus.driverName}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectBusOnMap(bus.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-900 text-[11px] font-semibold flex items-center gap-1 shrink-0 transition-colors"
                    >
                      <MapPin className="w-3 h-3" aria-hidden="true" />
                      <span>Ubicar</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-neutral-100 text-[11px]">
                    <div className="flex items-center gap-3 text-neutral-600">
                      <span>
                        Vel: <strong className="text-neutral-900">{bus.speedKmh} km/h</strong>
                      </span>
                      <span>
                        Cupo:{' '}
                        <strong className="text-neutral-900">
                          {bus.passengerCount}/{bus.capacity} ({bus.occupancyPercentage}%)
                        </strong>
                      </span>
                    </div>

                    <select
                      aria-label={`Estado de ${bus.code}`}
                      value={bus.status}
                      onChange={(e) =>
                        onUpdateBusStatus(
                          bus.id,
                          e.target.value as BusVehicle['status']
                        )
                      }
                      className="bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1 text-[11px] font-semibold text-neutral-800"
                    >
                      <option value="en_ruta">En ruta</option>
                      <option value="en_parada">En parada</option>
                      <option value="congestión">Congestión</option>
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Traffic Alerts & Dispatch Control */}
        <div className="border border-neutral-200 rounded-2xl p-4 space-y-3 bg-neutral-50/70">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-600 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-neutral-900" aria-hidden="true" />
              <span>Alertas y Despacho Vial ({alerts.length})</span>
            </h3>
            <Button size="sm" variant="outline" onClick={handleAddBroadcastAlert}>
              + Despacho Centro
            </Button>
          </div>

          <div className="space-y-2">
            {alerts.map((alert) => {
              const isResolved = resolvedAlertIds.includes(alert.id);
              return (
                <div
                  key={alert.id}
                  className={`p-3 rounded-xl border text-xs transition-opacity ${
                    isResolved
                      ? 'bg-neutral-50 border-neutral-200 opacity-60'
                      : 'bg-white border-neutral-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      {isResolved ? (
                        <CheckCircle2
                          className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                      ) : (
                        <AlertTriangle
                          className="w-4 h-4 text-amber-600 shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                      )}
                      <div>
                        <span className="font-bold text-neutral-900 block">
                          {alert.location} ({alert.municipality})
                        </span>
                        <p className="text-neutral-600 mt-0.5">{alert.description}</p>
                        <span className="text-[10px] text-neutral-400 mt-1 block">
                          {alert.timestamp} • Severidad: {alert.severity}
                        </span>
                      </div>
                    </div>

                    {!isResolved && (
                      <button
                        type="button"
                        onClick={() => handleResolveAlert(alert.id)}
                        className="px-2.5 py-1 rounded-lg bg-neutral-900 text-white text-[11px] font-semibold shrink-0 hover:bg-neutral-800"
                      >
                        Resolver
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
