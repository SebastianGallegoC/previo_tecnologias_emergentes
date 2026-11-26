import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines Tailwind CSS classes safely using clsx and tailwind-merge (shadcn/ui standard).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Formats a numeric value into Colombian Pesos (COP).
 */
export function formatCop(amount: number): string {
  return `$${amount.toLocaleString('es-CO')}`;
}

/**
 * Formats walking distance cleanly: meters below 1000 m, kilometers at 1000 m+.
 */
export function formatWalkDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${meters} m`;
}

/**
 * Executes a state update inside the native View Transitions API when supported,
 * falling back gracefully and routing keyboard/assistive focus to the target heading
 * as required by modern accessibility guidelines.
 */
export function startSafeViewTransition(
  updateCallback: () => void,
  focusTargetSelector?: string
): void {
  const routeFocus = () => {
    if (!focusTargetSelector || typeof document === 'undefined') return;
    requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(focusTargetSelector);
      if (target) {
        if (!target.hasAttribute('tabindex')) {
          target.setAttribute('tabindex', '-1');
        }
        target.focus({ preventScroll: true });
      }
    });
  };

  if (typeof document === 'undefined' || !('startViewTransition' in document)) {
    updateCallback();
    routeFocus();
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transition = (document as any).startViewTransition(() => {
      updateCallback();
    });
    if (transition?.finished) {
      transition.finished.finally(() => {
        routeFocus();
      });
    }
  } catch {
    updateCallback();
    routeFocus();
  }
}
