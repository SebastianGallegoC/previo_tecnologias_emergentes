import {
  BusStop,
  BusVehicle,
  Coordinates,
  DeviceCapabilities,
  PaymentMethodType,
  RouteInfo,
  TransitTicket,
  TripPlanResult,
} from '../../types/transit';
import { ITransitRepository, IWalletRepository } from './repositories';

export interface PaymentAvailability {
  available: boolean;
  reason?: string;
  badgeText: string;
}

export interface PaymentExecutionResult {
  success: boolean;
  ticket?: TransitTicket;
  error?: string;
}

/**
 * Strategy Pattern + Open/Closed Principle (OCP):
 * Each payment mechanism (NFC Contactless, QR Dynamic Code, Digital Wallet Pass)
 * implements this contract and self-validates hardware availability.
 */
export interface IPaymentStrategy {
  readonly methodId: PaymentMethodType;
  readonly label: string;
  readonly shortLabel: string;
  readonly description: string;
  readonly requiresHardware: 'nfc' | 'camera_or_screen' | 'none';

  checkAvailability(capabilities: DeviceCapabilities): PaymentAvailability;

  executePayment(
    bus: BusVehicle,
    route: RouteInfo | undefined,
    walletRepo: IWalletRepository,
    capabilities: DeviceCapabilities
  ): PaymentExecutionResult;
}

export interface NearestStopMatch {
  stop: BusStop;
  distanceKm: number;
}

export interface TripPlanningContext {
  originCoord: Coordinates;
  originName: string;
  destCoord: Coordinates;
  destName: string;
  originStopMatch: NearestStopMatch;
  destStopMatch: NearestStopMatch;
  sharedRouteIds: string[];
  buses: BusVehicle[];
  transitRepo: ITransitRepository;
  estimateArrivalMinutes: (stopId: string, buses: BusVehicle[]) => { nextMin: number; bus: BusVehicle | null };
}

/**
 * Strategy Pattern + Open/Closed Principle (OCP):
 * Encapsulates an algorithm for generating a recommended transit itinerary.
 */
export interface ITripPlanningStrategy {
  readonly strategyId: string;
  computePlan(context: TripPlanningContext): TripPlanResult | null;
}
