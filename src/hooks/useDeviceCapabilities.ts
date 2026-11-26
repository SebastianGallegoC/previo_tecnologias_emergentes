import { useEffect, useState, useCallback } from 'react';
import { DeviceCapabilityService } from '../infrastructure/hardware/DeviceCapabilityService';
import { DeviceCapabilities } from '../types/transit';

/**
 * Custom React Hook subscribing to real-time hardware & device capability state.
 */
export function useDeviceCapabilities() {
  const service = DeviceCapabilityService.getInstance();
  const [capabilities, setCapabilities] = useState<DeviceCapabilities>(() =>
    service.getCapabilities()
  );

  useEffect(() => {
    const unsubscribe = service.subscribe((updated) => {
      setCapabilities(updated);
    });
    return unsubscribe;
  }, [service]);

  const setSimulatedNfcMode = useCallback(
    (enabled: boolean) => {
      service.setSimulatedNfcMode(enabled);
    },
    [service]
  );

  return {
    capabilities,
    setSimulatedNfcMode,
  };
}
