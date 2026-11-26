import { TicketFactory } from '../core/factories/TicketFactory';
import { PaymentStrategyRegistry } from '../core/strategies/paymentStrategies';
import { DeviceCapabilityService } from '../infrastructure/hardware/DeviceCapabilityService';
import { InMemoryTransitRepository } from '../infrastructure/repositories/InMemoryTransitRepository';
import { LocalStorageWalletRepository } from '../infrastructure/repositories/LocalStorageWalletRepository';
import {
  BusVehicle,
  PaymentMethodType,
  TransitTicket,
  WalletTransaction,
} from '../types/transit';

/**
 * Application Service / Facade for Wallet & Payment Processing.
 * Delegates persistence to IWalletRepository, ticket creation to TicketFactory,
 * and payment execution/hardware gating to PaymentStrategyRegistry (SOLID: SRP, OCP, DIP).
 */
export class WalletApplicationService {
  private static instance: WalletApplicationService;
  private readonly walletRepo = LocalStorageWalletRepository.getInstance();
  private readonly transitRepo = InMemoryTransitRepository.getInstance();
  private readonly strategyRegistry = new PaymentStrategyRegistry();
  private readonly capabilityService = DeviceCapabilityService.getInstance();

  public static getInstance(): WalletApplicationService {
    if (!WalletApplicationService.instance) {
      WalletApplicationService.instance = new WalletApplicationService();
    }
    return WalletApplicationService.instance;
  }

  public getBalance(): number {
    return this.walletRepo.getBalance();
  }

  public getTransactions(): WalletTransaction[] {
    return this.walletRepo.getTransactions();
  }

  public getIssuedTickets(): TransitTicket[] {
    return this.walletRepo.getTickets();
  }

  public recharge(amount: number, method: string): number {
    const current = this.walletRepo.getBalance();
    const updated = current + amount;
    this.walletRepo.saveBalance(updated);

    const newTx = TicketFactory.createRechargeTransaction(amount, method);
    this.walletRepo.saveTransaction(newTx);
    return updated;
  }

  public purchaseTicket(
    bus: BusVehicle,
    paymentMethod: PaymentMethodType
  ): { success: boolean; ticket?: TransitTicket; error?: string } {
    const strategy = this.strategyRegistry.getStrategy(paymentMethod);
    const route = this.transitRepo.getRouteById(bus.routeId);
    const capabilities = this.capabilityService.getCapabilities();

    return strategy.executePayment(bus, route, this.walletRepo, capabilities);
  }

  public getStrategyRegistry(): PaymentStrategyRegistry {
    return this.strategyRegistry;
  }

  public subscribe(listener: () => void): () => void {
    return this.walletRepo.subscribe(listener);
  }
}

// Clean functional exports delegating to the singleton Application Service
export function getWalletBalance(): number {
  return WalletApplicationService.getInstance().getBalance();
}

export function getWalletTransactions(): WalletTransaction[] {
  return WalletApplicationService.getInstance().getTransactions();
}

export function getIssuedTickets(): TransitTicket[] {
  return WalletApplicationService.getInstance().getIssuedTickets();
}

export function rechargeWallet(amount: number, method: string): number {
  return WalletApplicationService.getInstance().recharge(amount, method);
}

export function purchaseBusTicket(
  bus: BusVehicle,
  paymentMethod: PaymentMethodType
): { success: boolean; ticket?: TransitTicket; error?: string } {
  return WalletApplicationService.getInstance().purchaseTicket(bus, paymentMethod);
}
