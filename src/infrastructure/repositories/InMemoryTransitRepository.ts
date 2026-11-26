import { ITransitRepository } from '../../core/contracts/repositories';
import {
  CUCUTA_BUS_STOPS,
  CUCUTA_ROUTES,
  INITIAL_BUSES,
  LIVE_TRAFFIC_ALERTS,
  POPULAR_LANDMARKS,
} from '../../data/cucutaTransitData';
import {
  BusStop,
  BusVehicle,
  Landmark,
  RouteInfo,
  TrafficAlert,
} from '../../types/transit';

/**
 * Concrete Repository implementing ITransitRepository (Dependency Inversion Principle - DIP).
 */
export class InMemoryTransitRepository implements ITransitRepository {
  private static instance: InMemoryTransitRepository;

  public static getInstance(): InMemoryTransitRepository {
    if (!InMemoryTransitRepository.instance) {
      InMemoryTransitRepository.instance = new InMemoryTransitRepository();
    }
    return InMemoryTransitRepository.instance;
  }

  public getRoutes(): RouteInfo[] {
    return CUCUTA_ROUTES;
  }

  public getRouteById(routeId: string): RouteInfo | undefined {
    return CUCUTA_ROUTES.find((r) => r.id === routeId);
  }

  public getStops(): BusStop[] {
    return CUCUTA_BUS_STOPS;
  }

  public getStopById(stopId: string): BusStop | undefined {
    return CUCUTA_BUS_STOPS.find((s) => s.id === stopId);
  }

  public getLandmarks(): Landmark[] {
    return POPULAR_LANDMARKS as Landmark[];
  }

  public getTrafficAlerts(): TrafficAlert[] {
    return LIVE_TRAFFIC_ALERTS;
  }

  public getInitialFleet(): BusVehicle[] {
    return INITIAL_BUSES;
  }
}
