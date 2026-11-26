import { DeviceCapabilityService } from '../infrastructure/hardware/DeviceCapabilityService';

/**
 * Singleton Audio & Haptic Feedback Synthesizer (SRP + Singleton Pattern).
 */
export class SoundFeedbackService {
  private static instance: SoundFeedbackService;
  private audioCtx: AudioContext | null = null;

  public static getInstance(): SoundFeedbackService {
    if (!SoundFeedbackService.instance) {
      SoundFeedbackService.instance = new SoundFeedbackService();
    }
    return SoundFeedbackService.instance;
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  private triggerHaptic(pattern: number | number[]): void {
    const caps = DeviceCapabilityService.getInstance().getCapabilities();
    if (caps.hasHaptics && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignore haptic restrictions on desktop browsers
      }
    }
  }

  public playValidationBeep(): void {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1900, now);
      osc.frequency.setValueAtTime(2400, now + 0.08);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.22);

      this.triggerHaptic([60, 40, 60]);
    } catch {
      // Fallback silent
    }
  }

  public playRechargeChime(): void {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.1);
      osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.2);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.45);

      this.triggerHaptic(80);
    } catch {
      // Fallback silent
    }
  }

  public playErrorBuzz(): void {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.setValueAtTime(130, now + 0.15);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);

      this.triggerHaptic([150, 80, 150]);
    } catch {
      // Fallback silent
    }
  }
}

export function playBusValidationBeep(): void {
  SoundFeedbackService.getInstance().playValidationBeep();
}

export function playRechargeChime(): void {
  SoundFeedbackService.getInstance().playRechargeChime();
}

export function playErrorBuzz(): void {
  SoundFeedbackService.getInstance().playErrorBuzz();
}
