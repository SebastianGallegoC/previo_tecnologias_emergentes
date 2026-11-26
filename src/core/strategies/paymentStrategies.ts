import {
  BusVehicle,
  DeviceCapabilities,
  PaymentMethodType,
  RouteInfo,
} from '../../types/transit';
import { IWalletRepository } from '../contracts/repositories';
import {
  IPaymentStrategy,
  PaymentAvailability,
  PaymentExecutionResult,
} from '../contracts/strategies';
import { TicketFactory } from '../factories/TicketFactory';

/**
 * Abstract Template Method + Base Strategy (DRY + LSP) for shared fare deduction logic.
 */
abstract class BaseTransitPaymentStrategy implements IPaymentStrategy {
  public abstract readonly methodId: PaymentMethodType;
  public abstract readonly label: string;
  public abstract readonly shortLabel: string;
  public abstract readonly description: string;
  public abstract readonly requiresHardware: 'nfc' | 'camera_or_screen' | 'none';

  public abstract checkAvailability(capabilities: DeviceCapabilities): PaymentAvailability;

  public executePayment(
    bus: BusVehicle,
    route: RouteInfo | undefined,
    walletRepo: IWalletRepository,
    capabilities: DeviceCapabilities
  ): PaymentExecutionResult {
    // 1. Hardware & Platform Guard
    const availability = this.checkAvailability(capabilities);
    if (!availability.available) {
      return {
        success: false,
        error:
          availability.reason ||
          `El método de pago ${this.label} no está disponible en este dispositivo.`,
      };
    }

    // 2. Balance Validation
    const currentBalance = walletRepo.getBalance();
    const fare = route ? route.fare : 3000;

    if (currentBalance < fare) {
      return {
        success: false,
        error: `Saldo insuficiente ($${currentBalance.toLocaleString('es-CO')} COP). El pasaje cuesta $${fare.toLocaleString('es-CO')} COP.`,
      };
    }

    // 3. Atomic Persistence via Repository & Factory
    const updatedBalance = currentBalance - fare;
    walletRepo.saveBalance(updatedBalance);

    const ticket = TicketFactory.createTransitTicket(bus, route, this.methodId);
    const transaction = TicketFactory.createFareTransaction(bus, ticket);

    walletRepo.saveTicket(ticket);
    walletRepo.saveTransaction(transaction);

    return {
      success: true,
      ticket,
    };
  }
}

/**
 * Concrete Strategy 1: Contactless NFC Tap-to-Pay
 * Strictly gated by physical or simulated NFC hardware availability.
 */
export class NfcTapPaymentStrategy extends BaseTransitPaymentStrategy {
  public readonly methodId: PaymentMethodType = 'NFC';
  public readonly label = 'NFC Tap-to-Pay';
  public readonly shortLabel = 'Pagar NFC';
  public readonly description =
    'Acerca tu teléfono con antena NFC al lector sin contacto de la buseta.';
  public readonly requiresHardware = 'nfc' as const;

  public checkAvailability(capabilities: DeviceCapabilities): PaymentAvailability {
    if (!capabilities.hasEffectiveNfc) {
      return {
        available: false,
        reason:
          capabilities.nfcRestrictionReason ||
          'El pago por proximidad NFC no está disponible en computadores o dispositivos sin chip físico NFC.',
        badgeText: 'Bloqueado (Sin NFC)',
      };
    }

    return {
      available: true,
      badgeText: capabilities.isSimulatedNfcMode
        ? 'Simulador NFC Activo'
        : 'Chip NFC Listo',
    };
  }
}

/**
 * Concrete Strategy 2: Dynamic QR Boarding Pass
 * Universal compatibility across Desktop PCs, Tablets, and Smartphones.
 */
export class QrCodePaymentStrategy extends BaseTransitPaymentStrategy {
  public readonly methodId: PaymentMethodType = 'QR';
  public readonly label = 'Código QR de Abordaje';
  public readonly shortLabel = 'Pagar con QR';
  public readonly description =
    'Genera un código QR criptográfico temporal para validar en el lector óptico de la buseta.';
  public readonly requiresHardware = 'camera_or_screen' as const;

  public checkAvailability(_capabilities: DeviceCapabilities): PaymentAvailability {
    return {
      available: true,
      badgeText: 'Universal (PC / Móvil)',
    };
  }
}

/**
 * Concrete Strategy 3: Digital Wallet Pass Express Validation
 */
export class WalletBalancePaymentStrategy extends BaseTransitPaymentStrategy {
  public readonly methodId: PaymentMethodType = 'Saldo Billetera';
  public readonly label = 'Billetera Digital CúcutaPass';
  public readonly shortLabel = 'CúcutaPass';
  public readonly description =
    'Descuenta directamente de tu saldo CúcutaPass y emite comprobante digital.';
  public readonly requiresHardware = 'none' as const;

  public checkAvailability(_capabilities: DeviceCapabilities): PaymentAvailability {
    return {
      available: true,
      badgeText: 'Instantáneo',
    };
  }
}

/**
 * Strategy Registry (Open/Closed Principle):
 * Manages available payment strategies and resolves the best default strategy for the current device.
 */
export class PaymentStrategyRegistry {
  private readonly strategies: Map<PaymentMethodType, IPaymentStrategy> = new Map();

  constructor(initialStrategies?: IPaymentStrategy[]) {
    const list = initialStrategies ?? [
      new NfcTapPaymentStrategy(),
      new QrCodePaymentStrategy(),
      new WalletBalancePaymentStrategy(),
    ];
    list.forEach((s) => this.strategies.set(s.methodId, s));
  }

  public getStrategy(methodId: PaymentMethodType): IPaymentStrategy {
    const strategy = this.strategies.get(methodId);
    if (!strategy) {
      throw new Error(`Payment strategy not registered: ${methodId}`);
    }
    return strategy;
  }

  public getAllStrategies(): IPaymentStrategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * Resolves the recommended primary payment strategy based on device capabilities.
   * On NFC-capable mobile devices -> 'NFC'.
   * On Desktop PCs or non-NFC devices -> 'QR'.
   */
  public getPreferredStrategy(capabilities: DeviceCapabilities): IPaymentStrategy {
    const nfcStrategy = this.getStrategy('NFC');
    if (nfcStrategy.checkAvailability(capabilities).available) {
      return nfcStrategy;
    }
    return this.getStrategy('QR');
  }
}
