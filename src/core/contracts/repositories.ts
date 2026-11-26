import {
  BusStop,
  BusVehicle,
  Landmark,
  RouteInfo,
  TrafficAlert,
  TransitTicket,
  WalletTransaction,
} from '../../types/transit';

/**
 * Interface Segregation Principle (ISP) & Dependency Inversion Principle (DIP):
 * Abstraction for Wallet persistence operations.
 */
export interface IWalletRepository {
  getBalance(): number;
  saveBalance(newBalance: number): void;
  getTransactions(): WalletTransaction[];
  saveTransaction(transaction: WalletTransaction): void;
  getTickets(): TransitTicket[];
  saveTicket(ticket: TransitTicket): void;
  subscribe(listener: () => void): () => void;
}

/**
 * Abstraction for querying Metropolitan Transit static and initial fleet catalog data.
 */
export interface ITransitRepository {
  getRoutes(): RouteInfo[];
  getRouteById(routeId: string): RouteInfo | undefined;
  getStops(): BusStop[];
  getStopById(stopId: string): BusStop | undefined;
  getLandmarks(): Landmark[];
  getTrafficAlerts(): TrafficAlert[];
  getInitialFleet(): BusVehicle[];
}
