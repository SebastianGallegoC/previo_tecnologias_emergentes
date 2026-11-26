import {
  ITripPlanningStrategy,
  NearestStopMatch,
  TripPlanningContext,
} from '../core/contracts/strategies';
import {
  FastestDirectRouteStrategy,
  LeastWalkingRouteStrategy,
  MultiLegTransferStrategy,
} from '../core/strategies/tripPlanningStrategies';
import { GeoMath } from '../infrastructure/geo/GeoMath';
import { InMemoryTransitRepository } from '../infrastructure/repositories/InMemoryTransitRepository';
import { BusVehicle, Coordinates, TripPlanResult } from '../types/transit';

/**
 * Fleet Simulation & Intelligent Route Planning Service.
 * Moves vehicles strictly along OSRM road-network vertices so buses never cut across blocks.
 */
export class TransitSimulationService {
  private static instance: TransitSimulationService;
  private readonly transitRepo = InMemoryTransitRepository.getInstance();
  private readonly planningStrategies: ITripPlanningStrategy[];
  private readonly segmentProgressMap = new Map<string, number>();

  private constructor() {
    this.planningStrategies = [
      new FastestDirectRouteStrategy(),
      new LeastWalkingRouteStrategy(),
      new MultiLegTransferStrategy(),
    ];
  }

  public static getInstance(): TransitSimulationService {
    if (!TransitSimulationService.instance) {
      TransitSimulationService.instance = new TransitSimulationService();
    }
    return TransitSimulationService.instance;
  }

  public stepFleet(buses: BusVehicle[], dtSeconds = 0.25): BusVehicle[] {
    return buses.map((bus) => {
      const route = this.transitRepo.getRouteById(bus.routeId);
      if (!route || route.waypoints.length < 2) return bus;

      const totalVertices = route.waypoints.length;
      let idx = bus.currentWaypointIndex % totalVertices;
      let progress = this.segmentProgressMap.get(bus.id) ?? 0;

      // Realistic Cúcuta urban buseta speed in meters per second (~16-22 km/h => ~4.4-6.1 m/s)
      const speedKmh = Math.max(16, Math.min(22, bus.speedKmh || 19));
      let remainingMeters = ((speedKmh * 1000) / 3600) * dtSeconds;

      let guard = 0;
      while (remainingMeters > 0 && guard < 20) {
        guard++;
        const a = route.waypoints[idx];
        const b = route.waypoints[(idx + 1) % totalVertices];
        const segMeters = Math.max(1, GeoMath.calculateDistanceKm(a, b) * 1000);
        const metersLeftInSeg = (1 - progress) * segMeters;

        if (remainingMeters < metersLeftInSeg) {
          progress += remainingMeters / segMeters;
          remainingMeters = 0;
        } else {
          remainingMeters -= metersLeftInSeg;
          idx = (idx + 1) % totalVertices;
          progress = 0;
        }
      }

      this.segmentProgressMap.set(bus.id, progress);

      const segStart = route.waypoints[idx];
      const segEnd = route.waypoints[(idx + 1) % totalVertices];
      const nextCoord = GeoMath.interpolate(segStart, segEnd, progress);
      const heading = GeoMath.calculateHeading(segStart, segEnd);
      const nextDirection: 'ida' | 'vuelta' =
        idx < totalVertices / 2 ? 'ida' : 'vuelta';

      // Subtle, realistic passenger & speed updates (not every 250ms frame)
      const shouldUpdateTelemetry = Math.random() > 0.92;
      const passengerDelta = shouldUpdateTelemetry
        ? Math.random() > 0.5
          ? 1
          : -1
        : 0;
      const updatedPassengers = Math.max(
        3,
        Math.min(bus.capacity, bus.passengerCount + passengerDelta)
      );
      const occupancy = Math.round((updatedPassengers / bus.capacity) * 100);
      const nextSpeed = shouldUpdateTelemetry
        ? Math.round(19 + (Math.random() * 5 - 2.5))
        : speedKmh;

      // Find nearest upcoming stop on this route
      let nearestStop = route.stops[0];
      let minStopDist = Number.MAX_SAFE_INTEGER;
      for (const stop of route.stops) {
        const d = GeoMath.calculateDistanceKm(nextCoord, stop.coordinates);
        if (d < minStopDist) {
          minStopDist = d;
          nearestStop = stop;
        }
      }

      return {
        ...bus,
        coordinates: nextCoord,
        heading,
        currentWaypointIndex: idx,
        direction: nextDirection,
        passengerCount: updatedPassengers,
        occupancyPercentage: occupancy,
        speedKmh: nextSpeed,
        nextStopName: nearestStop ? nearestStop.name : bus.nextStopName,
        status: occupancy > 85 ? 'congestión' : 'en_ruta',
        lastUpdated: 'En vivo',
      };
    });
  }

  public calculateNextArrival(
    stopId: string,
    buses: BusVehicle[]
  ): { nextMin: number; bus: BusVehicle | null } {
    const stop = this.transitRepo.getStopById(stopId);
    if (!stop) return { nextMin: 5, bus: null };

    const passingBuses = buses.filter((b) => stop.routes.includes(b.routeId));
    if (passingBuses.length === 0) return { nextMin: 8, bus: null };

    let minEta = 999;
    let nearestBus: BusVehicle | null = null;

    passingBuses.forEach((bus) => {
      const distKm = GeoMath.calculateDistanceKm(bus.coordinates, stop.coordinates);
      const speed = Math.max(20, bus.speedKmh);
      const etaMin = Math.round((distKm / speed) * 60) + 1;
      if (etaMin < minEta) {
        minEta = etaMin;
        nearestBus = bus;
      }
    });

    return {
      nextMin: minEta === 999 ? 6 : Math.max(1, minEta),
      bus: nearestBus,
    };
  }

  private findNearestStop(coord: Coordinates): NearestStopMatch {
    const stops = this.transitRepo.getStops();
    let nearest = stops[0];
    let minDist = Number.MAX_SAFE_INTEGER;

    stops.forEach((stop) => {
      const d = GeoMath.calculateDistanceKm(coord, stop.coordinates);
      if (d < minDist) {
        minDist = d;
        nearest = stop;
      }
    });

    return { stop: nearest, distanceKm: minDist };
  }

  public computeTripPlans(
    originCoord: Coordinates,
    originName: string,
    destCoord: Coordinates,
    destName: string,
    buses: BusVehicle[]
  ): TripPlanResult[] {
    const originStopMatch = this.findNearestStop(originCoord);
    const destStopMatch = this.findNearestStop(destCoord);

    const sharedRouteIds = originStopMatch.stop.routes.filter((r) =>
      destStopMatch.stop.routes.includes(r)
    );

    const context: TripPlanningContext = {
      originCoord,
      originName,
      destCoord,
      destName,
      originStopMatch,
      destStopMatch,
      sharedRouteIds,
      buses,
      transitRepo: this.transitRepo,
      estimateArrivalMinutes: (stopId, currentBuses) =>
        this.calculateNextArrival(stopId, currentBuses),
    };

    const results: TripPlanResult[] = [];
    for (const strategy of this.planningStrategies) {
      const plan = strategy.computePlan(context);
      if (plan) {
        results.push(plan);
      }
    }

    // If a direct route requires > 700 m of walking and a 1-transfer option cuts walking significantly, promote the transfer option first
    const transferPlan = results.find((r) => r.transfersCount > 0);
    const directPlans = results.filter((r) => r.transfersCount === 0);
    if (transferPlan && directPlans.length > 0) {
      const bestDirectWalk = Math.min(
        ...directPlans.map((d) => d.walkToBoardingMeters + d.walkFromAlightingMeters)
      );
      const transferWalk =
        transferPlan.walkToBoardingMeters + transferPlan.walkFromAlightingMeters;
      if (bestDirectWalk > 700 && bestDirectWalk - transferWalk > 400) {
        return [transferPlan, ...directPlans];
      }
    }

    return results;
  }
}

export const calculateDistanceKm = GeoMath.calculateDistanceKm;
export const calculateHeading = GeoMath.calculateHeading;

export function stepBusSimulation(buses: BusVehicle[], dtSeconds = 0.25): BusVehicle[] {
  return TransitSimulationService.getInstance().stepFleet(buses, dtSeconds);
}

export function calculateNextArrivalMinutes(
  stopId: string,
  buses: BusVehicle[]
): { nextMin: number; bus: BusVehicle | null } {
  return TransitSimulationService.getInstance().calculateNextArrival(stopId, buses);
}

export function planTrip(
  originCoord: Coordinates,
  originName: string,
  destCoord: Coordinates,
  destName: string,
  buses: BusVehicle[]
): TripPlanResult[] {
  return TransitSimulationService.getInstance().computeTripPlans(
    originCoord,
    originName,
    destCoord,
    destName,
    buses
  );
}
