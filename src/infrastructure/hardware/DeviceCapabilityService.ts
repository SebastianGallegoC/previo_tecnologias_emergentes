import { DeviceCapabilities, DeviceFormFactor } from '../../types/transit';

/**
 * Singleton + Observer Service for Hardware & Platform Capability Detection.
 * Strictly evaluates whether the client device possesses physical NFC, GPS, Haptics, and Touch,
 * gating NFC-exclusive functionality on Desktop PCs as required by domain rules.
 */
export class DeviceCapabilityService {
  private static instance: DeviceCapabilityService;
  private simulatedNfcMode = false;
  private readonly listeners: Set<(caps: DeviceCapabilities) => void> = new Set();

  private constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => this.notify());
    }
  }

  public static getInstance(): DeviceCapabilityService {
    if (!DeviceCapabilityService.instance) {
      DeviceCapabilityService.instance = new DeviceCapabilityService();
    }
    return DeviceCapabilityService.instance;
  }

  private detectFormFactor(): DeviceFormFactor {
    if (typeof window === 'undefined') return 'desktop';
    const ua = navigator.userAgent.toLowerCase();
    const isMobileUa = /android|iphone|ipod|iemobile|opera mini/i.test(ua);
    const isTabletUa = /ipad|tablet|playbook|silk/i.test(ua) || (ua.includes('android') && !ua.includes('mobile'));
    const width = window.innerWidth;

    if (isTabletUa || (width >= 768 && width < 1024 && this.hasTouch())) {
      return 'tablet';
    }
    if (isMobileUa || width < 768) {
      return 'mobile';
    }
    return 'desktop';
  }

  private hasTouch(): boolean {
    if (typeof window === 'undefined') return false;
    return (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia('(pointer: coarse)').matches
    );
  }

  public getCapabilities(): DeviceCapabilities {
    if (typeof window === 'undefined') {
      return {
        formFactor: 'desktop',
        hasNativeNfc: false,
        hasEffectiveNfc: false,
        isSimulatedNfcMode: false,
        hasGeolocation: false,
        hasHaptics: false,
        hasTouchScreen: false,
        hasWebShare: false,
        hasAudioSynthesizer: false,
        platformLabel: 'Servidor / SSR',
        nfcRestrictionReason: 'Entorno sin soporte de hardware NFC.',
      };
    }

    const formFactor = this.detectFormFactor();
    const hasNativeNfc = 'NDEFReader' in window;
    const hasEffectiveNfc = hasNativeNfc || this.simulatedNfcMode;
    const hasGeolocation = 'geolocation' in navigator;
    const hasHaptics = 'vibrate' in navigator;
    const hasTouchScreen = this.hasTouch();
    const hasWebShare = 'share' in navigator;
    const hasAudioSynthesizer =
      'AudioContext' in window || 'webkitAudioContext' in (window as unknown as Record<string, unknown>);

    let platformLabel = 'Computador de Escritorio';
    if (formFactor === 'mobile') platformLabel = 'Smartphone Móvil';
    if (formFactor === 'tablet') platformLabel = 'Tablet';

    let nfcRestrictionReason: string | null = null;
    if (!hasEffectiveNfc) {
      if (formFactor === 'desktop') {
        nfcRestrictionReason =
          'Estás en un Computador (PC/Escritorio) sin antena física NFC. El pago sin contacto NFC está restringido a dispositivos móviles compatibles; utiliza Código QR de Abordaje.';
      } else {
        nfcRestrictionReason =
          'Este dispositivo o navegador no expone un chip Web NFC activo (requiere Chrome para Android con NFC encendido). Usa Código QR para abordar.';
      }
    }

    return {
      formFactor,
      hasNativeNfc,
      hasEffectiveNfc,
      isSimulatedNfcMode: this.simulatedNfcMode,
      hasGeolocation,
      hasHaptics,
      hasTouchScreen,
      hasWebShare,
      hasAudioSynthesizer,
      platformLabel,
      nfcRestrictionReason,
    };
  }

  /**
   * Allows toggling simulated NFC hardware mode strictly for academic/developer demonstration.
   * Defaults to false (strict real hardware enforcement).
   */
  public setSimulatedNfcMode(enabled: boolean): void {
    this.simulatedNfcMode = enabled;
    this.notify();
  }

  public subscribe(listener: (caps: DeviceCapabilities) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const current = this.getCapabilities();
    this.listeners.forEach((l) => l(current));
  }
}
