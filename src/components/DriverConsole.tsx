import React, { useState } from 'react';
import { BusVehicle } from '../types/transit';
import { CUCUTA_ROUTES } from '../data/cucutaTransitData';
import { playBusValidationBeep } from '../services/soundEffects';
import { formatCop } from '../lib/utils';
import {
  Bus,
  CheckCircle,
  Gauge,
  MapPin,
  Minus,
  Plus,
  Radio,
  Users,
} from 'lucide-react';
import { Button } from './ui/button';

interface DriverConsoleProps {
  buses: BusVehicle[];
  onUpdateBusPassengers: (busId: string, delta: number) => void;
  onSelectBusOnMap?: (busId: string) => void;
}

export const DriverConsole: React.FC<DriverConsoleProps> = ({
  buses,
  onUpdateBusPassengers,
  onSelectBusOnMap,
}) => {
  const [selectedBusId, setSelectedBusId] = useState<string>(buses[0]?.id || '');
  const [liveFareCount, setLiveFareCount] = useState<number>(38);
  const [reportedIncident, setReportedIncident] = useState<string | null>(null);

  const currentBus = buses.find((b) => b.id === selectedBusId) || buses[0];
  const route = currentBus
    ? CUCUTA_ROUTES.find((r) => r.id === currentBus.routeId)
    : null;
  const fare = route ? route.fare : 3000;

  const handleSimulatePassengerBoarding = () => {
    if (!currentBus) return;
    onUpdateBusPassengers(currentBus.id, 1);
    setLiveFareCount((prev) => prev + 1);
    playBusValidationBeep();
  };

  const handlePassengerAlight = () => {
    if (!currentBus) return;
    onUpdateBusPassengers(currentBus.id, -1);
  };

  const handleReportIncident = (desc: string) => {
    setReportedIncident(desc);
    setTimeout(() => setReportedIncident(null), 4000);
  };

  if (!currentBus) return null;

  const totalCollectedToday = liveFareCount * fare;

  return (
    <div className="h-full overflow-y-auto bg-white p-4 sm:p-6 pb-24 lg:pb-8 text-neutral-900">
      <div className="max-w-xl mx-auto space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2
              id="view-heading"
              tabIndex={-1}
              className="text-2xl font-bold tracking-tight text-neutral-900 outline-none"
            >
              Modo Conductor
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Telemetría de unidad y control de pasajeros.
            </p>
          </div>

          <select
            value={selectedBusId}
            onChange={(e) => {
              setSelectedBusId(e.target.value);
              if (onSelectBusOnMap) onSelectBusOnMap(e.target.value);
            }}
            aria-label="Seleccionar unidad"
            className="bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-semibold text-neutral-900 focus:outline-none focus:border-neutral-900"
          >
            {buses.map((b) => (
              <option key={b.id} value={b.id}>
                Unidad {b.code} • {b.plate}
              </option>
            ))}
          </select>
        </div>

        {/* Driver Vehicle Aesthetic Card */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-900 shrink-0">
                <Bus className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md bg-neutral-900 text-white text-[11px] font-bold tracking-tight">
                    {currentBus.code}
                  </span>
                  <h3 className="font-bold text-sm text-neutral-900">
                    {currentBus.company}
                  </h3>
                  <span className="text-[10px] font-mono bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded border border-neutral-200">
                    {currentBus.plate}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Conductor: <strong className="text-neutral-800">{currentBus.driverName}</strong> • {route?.code}
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-100 border border-neutral-200 text-neutral-800 text-[11px] font-semibold">
              <Radio className="w-3 h-3 text-neutral-900" />
              <span>En línea</span>
            </span>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/70">
              <div className="flex items-center justify-center gap-1 text-neutral-500 text-[11px]">
                <Gauge className="w-3.5 h-3.5" />
                <span>Velocidad</span>
              </div>
              <div className="text-xl font-extrabold text-neutral-900 mt-0.5">
                {currentBus.speedKmh} <span className="text-xs font-normal">km/h</span>
              </div>
            </div>

            <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/70">
              <div className="flex items-center justify-center gap-1 text-neutral-500 text-[11px]">
                <Users className="w-3.5 h-3.5" />
                <span>Pasajeros</span>
              </div>
              <div className="text-xl font-extrabold text-neutral-900 mt-0.5">
                {currentBus.passengerCount}/{currentBus.capacity}
              </div>
            </div>

            <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/70">
              <span className="text-[11px] text-neutral-500 block">Recaudo turno</span>
              <div className="text-lg font-extrabold text-neutral-900 mt-0.5">
                {formatCop(totalCollectedToday)}
              </div>
            </div>
          </div>

          {/* Next Stop + Passive Corridor Demand (No Route Deviation) */}
          <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/70 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-semibold uppercase text-neutral-500 block">
                  Próxima parada en circuito fijo
                </span>
                <span className="text-sm font-bold text-neutral-900">
                  {currentBus.nextStopName}
                </span>
              </div>
              <MapPin className="w-4 h-4 text-neutral-700" aria-hidden="true" />
            </div>
            <div className="pt-2 border-t border-neutral-200/60 flex items-center justify-between text-[11px] text-neutral-600">
              <span>Pasajeros esperando en este paradero:</span>
              <span className="font-bold text-neutral-900 bg-white px-2 py-0.5 rounded-md border border-neutral-200">
                {(currentBus.currentWaypointIndex % 4) + 2} en espera (Sin desvío)
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="grid grid-cols-2 gap-2.5">
            <Button
              variant="outline"
              onClick={handlePassengerAlight}
              disabled={currentBus.passengerCount <= 0}
            >
              <Minus className="w-4 h-4" />
              <span>Bajar pasajero</span>
            </Button>

            <Button
              variant="default"
              onClick={handleSimulatePassengerBoarding}
              disabled={currentBus.passengerCount >= currentBus.capacity}
            >
              <Plus className="w-4 h-4" />
              <span>Subir pasajero</span>
            </Button>
          </div>

          {/* Simple Traffic Reports */}
          <div className="pt-3 border-t border-neutral-100 space-y-2">
            <span className="text-[11px] font-semibold text-neutral-500 block">
              Reportar novedad en la vía
            </span>

            {reportedIncident && (
              <div className="p-2.5 bg-neutral-100 border border-neutral-200 rounded-xl text-xs text-neutral-900 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-neutral-900 shrink-0" />
                <span>Reporte enviado: {reportedIncident}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={() => handleReportIncident('Tráfico Puente San Rafael')}
                className="p-2 bg-neutral-50 hover:bg-neutral-100 rounded-xl border border-neutral-200 text-xs font-medium text-neutral-700 text-left transition-colors"
              >
                Tráfico San Rafael
              </button>
              <button
                onClick={() => handleReportIncident('Congestión Autopista Rosario')}
                className="p-2 bg-neutral-50 hover:bg-neutral-100 rounded-xl border border-neutral-200 text-xs font-medium text-neutral-700 text-left transition-colors"
              >
                Congestión Rosario
              </button>
              <button
                onClick={() => handleReportIncident('Obras en Los Patios')}
                className="p-2 bg-neutral-50 hover:bg-neutral-100 rounded-xl border border-neutral-200 text-xs font-medium text-neutral-700 text-left transition-colors"
              >
                Obras Los Patios
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
