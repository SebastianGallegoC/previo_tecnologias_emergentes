import React from 'react';
import {
  Laptop,
  Lock,
  MapPin,
  Smartphone,
  Tablet,
  Unlock,
  Volume2,
  Wifi,
  X,
} from 'lucide-react';
import { DeviceCapabilities } from '../types/transit';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ModalDialog } from './ui/dialog';

interface HardwareInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  capabilities: DeviceCapabilities;
  onToggleSimulateNfc: (enabled: boolean) => void;
}

export const HardwareInspectorModal: React.FC<HardwareInspectorModalProps> = ({
  isOpen,
  onClose,
  capabilities,
  onToggleSimulateNfc,
}) => {
  const DeviceIcon =
    capabilities.formFactor === 'mobile'
      ? Smartphone
      : capabilities.formFactor === 'tablet'
      ? Tablet
      : Laptop;

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Estado del dispositivo"
      className="max-w-md"
    >
      <button
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-neutral-800 rounded-xl hover:bg-neutral-100 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="mb-4 pr-8">
        <h2 className="font-bold text-lg text-neutral-900">
          Capacidades del Dispositivo
        </h2>
        <p className="text-xs text-neutral-500">
          Las funciones de hardware se adaptan según tu equipo actual.
        </p>
      </div>

      {/* Detected Device */}
      <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200 mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white border border-neutral-200 flex items-center justify-center text-neutral-800">
            <DeviceIcon className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-semibold uppercase text-neutral-400 block">
              Equipo actual
            </span>
            <span className="font-bold text-xs text-neutral-900">
              {capabilities.platformLabel}
            </span>
          </div>
        </div>
        <Badge variant={capabilities.hasEffectiveNfc ? 'emerald' : 'locked'}>
          {capabilities.hasEffectiveNfc ? 'NFC Activo' : 'Sin NFC'}
        </Badge>
      </div>

      {/* Simple Capability List */}
      <div className="space-y-2 mb-4 text-xs">
        <div className="p-3 rounded-xl bg-white border border-neutral-200 flex items-center justify-between">
          <span className="flex items-center gap-2 font-medium text-neutral-700">
            <Wifi className="w-4 h-4 rotate-90 text-neutral-500" />
            <span>Antena Web NFC</span>
          </span>
          <span className="font-semibold text-neutral-900">
            {capabilities.hasNativeNfc ? 'Disponible' : 'No disponible en PC'}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-white border border-neutral-200 flex items-center justify-between">
          <span className="flex items-center gap-2 font-medium text-neutral-700">
            <MapPin className="w-4 h-4 text-neutral-500" />
            <span>Geolocalización GPS</span>
          </span>
          <span className="font-semibold text-neutral-900">
            {capabilities.hasGeolocation ? 'Activa' : 'No disponible'}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-white border border-neutral-200 flex items-center justify-between">
          <span className="flex items-center gap-2 font-medium text-neutral-700">
            <Volume2 className="w-4 h-4 text-neutral-500" />
            <span>Audio de Validación</span>
          </span>
          <span className="font-semibold text-neutral-900">
            {capabilities.hasAudioSynthesizer ? 'Activo' : 'Inactivo'}
          </span>
        </div>
      </div>

      {/* Demo Toggle for PC evaluation */}
      {!capabilities.hasNativeNfc && (
        <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200 flex items-center justify-between gap-3 mb-4">
          <div className="text-xs">
            <span className="font-bold text-neutral-900 block">
              Simulador NFC (Pruebas en PC)
            </span>
            <span className="text-[11px] text-neutral-500">
              Permite probar el pago NFC desde el computador
            </span>
          </div>
          <Button
            size="sm"
            variant={capabilities.isSimulatedNfcMode ? 'emerald' : 'outline'}
            onClick={() => onToggleSimulateNfc(!capabilities.isSimulatedNfcMode)}
          >
            {capabilities.isSimulatedNfcMode ? (
              <>
                <Unlock className="w-3.5 h-3.5" />
                <span>Activo</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span>Bloqueado</span>
              </>
            )}
          </Button>
        </div>
      )}

      <Button variant="default" className="w-full" onClick={onClose}>
        Cerrar
      </Button>
    </ModalDialog>
  );
};
