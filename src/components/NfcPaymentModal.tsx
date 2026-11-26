import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  BusVehicle,
  DeviceCapabilities,
  PaymentMethodType,
  TransitTicket,
} from '../types/transit';
import { CUCUTA_ROUTES } from '../data/cucutaTransitData';
import { playBusValidationBeep, playErrorBuzz } from '../services/soundEffects';
import { purchaseBusTicket, getWalletBalance } from '../services/walletService';
import { checkNfcSupport, startNativeNfcScan, NfcSupportStatus } from '../services/nfcService';
import { DeviceCapabilityService } from '../infrastructure/hardware/DeviceCapabilityService';
import { formatCop } from '../lib/utils';
import {
  AlertTriangle,
  CheckCircle2,
  Laptop,
  Lock,
  QrCode,
  Smartphone,
  Unlock,
  Wifi,
  X,
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ModalDialog } from './ui/dialog';

interface NfcPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetBus: BusVehicle | null;
  availableBuses: BusVehicle[];
  onPaymentSuccess: (ticket: TransitTicket) => void;
  capabilities?: DeviceCapabilities;
  initialMethod?: PaymentMethodType;
  inlineMode?: boolean;
}

export const NfcPaymentModal: React.FC<NfcPaymentModalProps> = ({
  isOpen,
  onClose,
  targetBus,
  availableBuses,
  onPaymentSuccess,
  capabilities: propCapabilities,
  initialMethod,
  inlineMode = false,
}) => {
  const capabilityService = DeviceCapabilityService.getInstance();
  const capabilities = propCapabilities ?? capabilityService.getCapabilities();
  const hasNfc = capabilities.hasEffectiveNfc;

  const [selectedBusId, setSelectedBusId] = useState<string>(
    targetBus ? targetBus.id : availableBuses[0]?.id || ''
  );
  const [nfcStatus, setNfcStatus] = useState<NfcSupportStatus | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'nfc_tap' | 'qr_code'>(() => {
    if (initialMethod === 'QR') return 'qr_code';
    if (initialMethod === 'NFC' && hasNfc) return 'nfc_tap';
    return hasNfc ? 'nfc_tap' : 'qr_code';
  });

  useEffect(() => {
    if (targetBus) {
      setSelectedBusId(targetBus.id);
    } else if (availableBuses.length > 0 && !selectedBusId) {
      setSelectedBusId(availableBuses[0].id);
    }
  }, [targetBus, availableBuses, selectedBusId]);

  useEffect(() => {
    if (isOpen) {
      setIsSuccess(false);
      setErrorMessage(null);
      setIsProcessing(false);

      if (initialMethod === 'QR' || !hasNfc) {
        setActiveTab('qr_code');
      } else {
        setActiveTab('nfc_tap');
      }

      let stopScan: (() => void) | undefined;
      checkNfcSupport().then((status) => {
        setNfcStatus(status);
        if (status.isNativeHardware) {
          startNativeNfcScan(
            () => {
              handleExecutePayment('NFC');
            },
            () => {}
          ).then((cleanup) => {
            stopScan = cleanup;
          });
        }
      });

      return () => {
        if (stopScan) stopScan();
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, hasNfc, initialMethod]);

  if (!isOpen) return null;

  const currentBus =
    availableBuses.find((b) => b.id === selectedBusId) || availableBuses[0];
  const route = currentBus
    ? CUCUTA_ROUTES.find((r) => r.id === currentBus.routeId)
    : undefined;
  const fare = route ? route.fare : 3000;
  const balance = getWalletBalance();

  const handleExecutePayment = (method: PaymentMethodType) => {
    if (!currentBus) return;

    if (method === 'NFC' && !hasNfc) {
      playErrorBuzz();
      setErrorMessage(
        'NFC no disponible en este computador. Usa el Código QR.'
      );
      return;
    }

    if (balance < fare) {
      playErrorBuzz();
      setErrorMessage(
        `Saldo insuficiente (${formatCop(balance)}). Recarga tu billetera.`
      );
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    setTimeout(() => {
      const result = purchaseBusTicket(currentBus, method);
      setIsProcessing(false);

      if (result.success && result.ticket) {
        setIsSuccess(true);
        playBusValidationBeep();

        confetti({
          particleCount: 50,
          spread: 55,
          origin: { y: 0.6 },
        });

        setTimeout(() => {
          onPaymentSuccess(result.ticket!);
        }, 900);
      } else {
        playErrorBuzz();
        setErrorMessage(result.error || 'Error procesando el pasaje');
      }
    }, 550);
  };

  const content = (
    <>
      {!inlineMode && (
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-neutral-800 rounded-xl hover:bg-neutral-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      <div className="mb-4 pr-8">
        <h3 className="font-bold text-lg text-neutral-900">Validar Pasaje al Subir</h3>
        <p className="text-xs text-neutral-500">
          Valida tu abordaje al subirte a la buseta (Tarifa única metropolitana {formatCop(fare)}).
        </p>
      </div>

      {/* Mode Switch Tabs */}
      <div className="flex bg-neutral-100 p-1 rounded-xl mb-4">
        <button
          onClick={() => setActiveTab('qr_code')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'qr_code'
              ? 'bg-white text-neutral-900 shadow-xs'
              : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          <QrCode className="w-3.5 h-3.5" />
          <span>Código QR</span>
        </button>

        <button
          onClick={() => setActiveTab('nfc_tap')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'nfc_tap'
              ? 'bg-white text-neutral-900 shadow-xs'
              : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          {hasNfc ? (
            <Smartphone className="w-3.5 h-3.5" />
          ) : (
            <Lock className="w-3.5 h-3.5 text-neutral-400" />
          )}
          <span>Pago NFC</span>
        </button>
      </div>

      {/* Bus Selector */}
      <div className="mb-4">
        <select
          value={selectedBusId}
          onChange={(e) => setSelectedBusId(e.target.value)}
          aria-label="Buseta"
          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-neutral-900 focus:outline-none focus:border-neutral-900"
        >
          {availableBuses.map((b) => {
            const r = CUCUTA_ROUTES.find((rt) => rt.id === b.routeId);
            return (
              <option key={b.id} value={b.id}>
                {b.code} ({b.plate}) - {b.company} [{r?.code || 'Ruta'}]
              </option>
            );
          })}
        </select>
      </div>

      {/* Tab Content */}
      {activeTab === 'nfc_tap' ? (
        !hasNfc ? (
          <div className="p-5 rounded-2xl bg-neutral-50 border border-neutral-200 text-center space-y-3">
            <div className="w-11 h-11 rounded-xl bg-neutral-200/70 text-neutral-700 flex items-center justify-center mx-auto">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <Badge variant="locked" className="mb-1">
                <Lock className="w-3 h-3" />
                <span>Restringido por Hardware</span>
              </Badge>
              <h4 className="font-bold text-sm text-neutral-900">
                NFC no disponible en este dispositivo
              </h4>
              <p className="text-xs text-neutral-500 mt-1">
                Tu computador no tiene antena física NFC. Utiliza el Código QR para pagar tu pasaje.
              </p>
            </div>
            <Button
              variant="default"
              size="sm"
              className="w-full"
              onClick={() => setActiveTab('qr_code')}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Cambiar a Código QR</span>
            </Button>
            <button
              onClick={() => capabilityService.setSimulatedNfcMode(true)}
              className="text-[11px] font-medium text-neutral-500 hover:text-neutral-900 underline inline-flex items-center gap-1"
            >
              <Unlock className="w-3 h-3" />
              <span>Simular NFC para prueba académica</span>
            </button>
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-neutral-50 border border-neutral-200 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              {isSuccess ? (
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              ) : (
                <Wifi className="w-6 h-6 rotate-90" />
              )}
            </div>
            <h4 className="font-bold text-base text-neutral-900">
              {isSuccess
                ? '¡Pasaje Validado!'
                : isProcessing
                ? 'Validando...'
                : 'Acerca tu dispositivo'}
            </h4>
            <p className="text-xs text-neutral-500">{nfcStatus?.message}</p>
            {!isSuccess && (
              <Button
                variant="default"
                disabled={isProcessing}
                onClick={() => handleExecutePayment('NFC')}
                className="w-full"
              >
                <Wifi className="w-4 h-4 rotate-90" />
                <span>Pagar {formatCop(fare)} con NFC</span>
              </Button>
            )}
          </div>
        )
      ) : (
        <div className="p-5 bg-neutral-50 border border-neutral-200 rounded-2xl text-center space-y-3">
          <div className="p-3 bg-white border border-neutral-200 rounded-xl inline-block">
            <div className="grid grid-cols-5 gap-1 w-28 h-28 p-2 bg-neutral-900 rounded-lg">
              {Array.from({ length: 25 }).map((_, i) => (
                <div
                  key={i}
                  className={`rounded-[2px] ${
                    i === 0 || i === 4 || i === 20 || i === 24 || i % 3 === 0
                      ? 'bg-emerald-400'
                      : 'bg-white'
                  }`}
                />
              ))}
            </div>
          </div>
          <p className="text-xs text-neutral-500">
            Código QR listo para validar en la buseta <strong>{currentBus?.code}</strong>
          </p>
          {!isSuccess && (
            <Button
              variant="default"
              disabled={isProcessing}
              onClick={() => handleExecutePayment('QR')}
              className="w-full"
            >
              <QrCode className="w-4 h-4" />
              <span>
                {isProcessing ? 'Validando...' : `Confirmar Pago QR (${formatCop(fare)})`}
              </span>
            </Button>
          )}
        </div>
      )}

      {errorMessage && (
        <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
        <span>Saldo disponible:</span>
        <span className="font-bold text-neutral-900">{formatCop(balance)}</span>
      </div>
    </>
  );

  if (inlineMode) {
    return (
      <div className="w-full max-w-md bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm text-neutral-900 relative">
        {content}
      </div>
    );
  }

  return (
    <ModalDialog isOpen={isOpen} onClose={onClose} ariaLabel="Pagar pasaje">
      {content}
    </ModalDialog>
  );
};
