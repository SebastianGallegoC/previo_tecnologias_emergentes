import { DeviceCapabilityService } from '../infrastructure/hardware/DeviceCapabilityService';

export interface NfcSupportStatus {
  supported: boolean;
  isNativeHardware: boolean;
  isSimulatedHardware: boolean;
  permissionGranted: boolean;
  message: string;
}

/**
 * Adapter for Web NFC API integrated with DeviceCapabilityService.
 * Enforces hardware-level gating so non-NFC devices (like Desktop PCs)
 * cannot execute NFC transactions unless hardware is present.
 */
export async function checkNfcSupport(): Promise<NfcSupportStatus> {
  const capabilities = DeviceCapabilityService.getInstance().getCapabilities();

  if (capabilities.hasNativeNfc) {
    return {
      supported: true,
      isNativeHardware: true,
      isSimulatedHardware: false,
      permissionGranted: true,
      message: 'Antena Web NFC física detectada y lista para lectura sin contacto.',
    };
  }

  if (capabilities.isSimulatedNfcMode) {
    return {
      supported: true,
      isNativeHardware: false,
      isSimulatedHardware: true,
      permissionGranted: true,
      message: 'Simulador de Hardware NFC activo (Modo Inspector de Desarrollo).',
    };
  }

  return {
    supported: false,
    isNativeHardware: false,
    isSimulatedHardware: false,
    permissionGranted: false,
    message:
      capabilities.nfcRestrictionReason ||
      'Dispositivo sin tecnología NFC física. Función bloqueada en computador.',
  };
}

/**
 * Starts a native Web NFC NDEFReader scan session when supported by the device.
 */
export async function startNativeNfcScan(
  onReading: (serialNumber: string, recordText: string) => void,
  onError: (error: string) => void
): Promise<() => void> {
  if (typeof window === 'undefined' || !('NDEFReader' in window)) {
    onError('Web NFC API no soportada en este dispositivo.');
    return () => {};
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const NDEFReaderClass = (window as any).NDEFReader;
    const reader = new NDEFReaderClass();
    const abortController = new AbortController();

    await reader.scan({ signal: abortController.signal });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reader.addEventListener('reading', (event: any) => {
      let recordText = '';
      if (event.message?.records) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const record of event.message.records) {
          if (record.recordType === 'text') {
            const textDecoder = new TextDecoder(record.encoding);
            recordText += textDecoder.decode(record.data);
          }
        }
      }
      onReading(event.serialNumber || 'NFC-TAG-OK', recordText);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reader.addEventListener('readingerror', (err: any) => {
      onError(`Error leyendo etiqueta NFC: ${err?.message || 'Lectura fallida'}`);
    });

    return () => {
      abortController.abort();
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    onError(`No se pudo iniciar el escaneo NFC: ${errorMsg}`);
    return () => {};
  }
}
