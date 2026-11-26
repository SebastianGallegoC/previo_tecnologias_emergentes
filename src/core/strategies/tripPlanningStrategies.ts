import { BusStop, Coordinates, RouteInfo, TripPlanResult } from '../../types/transit';
import { GeoMath } from '../../infrastructure/geo/GeoMath';
import { ITripPlanningStrategy, TripPlanningContext } from '../contracts/strategies';
import { formatWalkDistance } from '../../lib/utils';

interface RouteCandidateEvaluation {
  route: RouteInfo;
  boardingStop: BusStop;
  alightingStop: BusStop;
  walkToBoardingKm: number;
  walkToBoardingMeters: number;
  walkToBoardingMinutes: number;
  walkFromAlightingKm: number;
  walkFromAlightingMeters: number;
  walkFromAlightingMinutes: number;
  busTransitKm: number;
  busTransitMinutes: number;
  nextBusInMinutes: number;
  recommendedBusCode: string;
  totalDurationMinutes: number;
  totalWalkMeters: number;
}

function findClosestStopOnRoute(
  coord: Coordinates,
  route: RouteInfo,
  role: 'boarding' | 'alighting',
  placeHint: string
): { stop: BusStop; distKm: number; fixedStopId: string } {
  let closest = route.stops[0];
  let minStopDist = Number.MAX_SAFE_INTEGER;

  for (const stop of route.stops) {
    const d = GeoMath.calculateDistanceKm(coord, stop.coordinates);
    if (d < minStopDist) {
      minStopDist = d;
      closest = stop;
    }
  }

  // Check if the buseta's real street trajectory passes closer than any fixed stop
  // (e.g., user chose a point right on the avenue between two fixed stops)
  let bestStreetCoord = closest.coordinates;
  let minStreetDist = minStopDist;
  for (let i = 0; i < route.waypoints.length; i++) {
    const d = GeoMath.calculateDistanceKm(coord, route.waypoints[i]);
    if (d < minStreetDist) {
      minStreetDist = d;
      bestStreetCoord = route.waypoints[i];
    }
  }

  if (minStreetDist + 0.08 < minStopDist) {
    return {
      stop: {
        id: `corridor-${route.id}-${role}`,
        name:
          role === 'boarding'
            ? `Parada en ruta (${route.code})`
            : `Descenso en ruta (${route.code})`,
        landmark: `Sobre la vía cerca de ${placeHint}`,
        municipality: closest.municipality,
        coordinates: bestStreetCoord,
        routes: [route.id],
      },
      distKm: minStreetDist,
      fixedStopId: closest.id,
    };
  }

  return { stop: closest, distKm: minStopDist, fixedStopId: closest.id };
}

function evaluateAllDirectRoutes(ctx: TripPlanningContext): RouteCandidateEvaluation[] {
  const routes = ctx.transitRepo.getRoutes();
  const evaluations: RouteCandidateEvaluation[] = [];

  for (const route of routes) {
    if (route.stops.length < 2) continue;

    const boardingMatch = findClosestStopOnRoute(
      ctx.originCoord,
      route,
      'boarding',
      ctx.originName
    );
    const alightingMatch = findClosestStopOnRoute(
      ctx.destCoord,
      route,
      'alighting',
      ctx.destName
    );

    // Ensure boarding and alighting stops are distinct if possible
    let alightingStop = alightingMatch.stop;
    let alightingDistKm = alightingMatch.distKm;

    if (
      GeoMath.calculateDistanceKm(
        boardingMatch.stop.coordinates,
        alightingStop.coordinates
      ) < 0.08 &&
      route.stops.length > 1
    ) {
      const alternatives = route.stops.filter(
        (s) => s.id !== boardingMatch.fixedStopId
      );
      let bestAlt = alternatives[0] || route.stops[0];
      let minAltDist = Number.MAX_SAFE_INTEGER;
      for (const alt of alternatives) {
        const d = GeoMath.calculateDistanceKm(ctx.destCoord, alt.coordinates);
        if (d < minAltDist) {
          minAltDist = d;
          bestAlt = alt;
        }
      }
      alightingStop = bestAlt;
      alightingDistKm = minAltDist;
    }

    const walk1Meters = Math.max(20, Math.round(boardingMatch.distKm * 1000));
    const walk1Minutes = Math.max(1, Math.round(walk1Meters / 75)); // ~4.5 km/h walking speed

    const walk2Meters = Math.max(20, Math.round(alightingDistKm * 1000));
    const walk2Minutes = Math.max(1, Math.round(walk2Meters / 75));

    const busTransitKm = Math.max(
      0.6,
      GeoMath.calculateDistanceKm(boardingMatch.stop.coordinates, alightingStop.coordinates) * 1.2
    );
    const busTransitMinutes = Math.max(6, Math.round((busTransitKm / 25) * 60));

    // Find closest active bus on this specific route
    const routeBuses = ctx.buses.filter((b) => b.routeId === route.id);
    const arrival = ctx.estimateArrivalMinutes(boardingMatch.fixedStopId, routeBuses);
    const recommendedBusCode = arrival.bus?.code || routeBuses[0]?.code || 'TR-101';

    evaluations.push({
      route,
      boardingStop: boardingMatch.stop,
      alightingStop,
      walkToBoardingKm: boardingMatch.distKm,
      walkToBoardingMeters: walk1Meters,
      walkToBoardingMinutes: walk1Minutes,
      walkFromAlightingKm: alightingDistKm,
      walkFromAlightingMeters: walk2Meters,
      walkFromAlightingMinutes: walk2Minutes,
      busTransitKm,
      busTransitMinutes,
      nextBusInMinutes: arrival.nextMin,
      recommendedBusCode,
      totalDurationMinutes:
        walk1Minutes + arrival.nextMin + busTransitMinutes + walk2Minutes,
      totalWalkMeters: walk1Meters + walk2Meters,
    });
  }

  return evaluations;
}

function buildPlanFromEvaluation(
  ev: RouteCandidateEvaluation,
  id: string,
  tag: 'Más Rápido' | 'Menos Caminata',
  originName: string,
  destName: string
): TripPlanResult {
  const totalDistKm = Number(
    (ev.walkToBoardingKm + ev.busTransitKm + ev.walkFromAlightingKm).toFixed(1)
  );

  return {
    id,
    title: `${ev.route.code} • ${ev.route.name}`,
    tag,
    totalDurationMinutes: ev.totalDurationMinutes,
    totalDistanceKm: totalDistKm,
    totalFareCop: ev.route.fare,
    transfersCount: 0,
    nextBusInMinutes: ev.nextBusInMinutes,
    recommendedBusCode: ev.recommendedBusCode,
    boardingStop: ev.boardingStop,
    alightingStop: ev.alightingStop,
    walkToBoardingMeters: ev.walkToBoardingMeters,
    walkToBoardingMinutes: ev.walkToBoardingMinutes,
    walkFromAlightingMeters: ev.walkFromAlightingMeters,
    walkFromAlightingMinutes: ev.walkFromAlightingMinutes,
    legs: [
      {
        instruction: `Camina hasta la parada "${ev.boardingStop.name}"`,
        detail: `Referencia: ${ev.boardingStop.landmark} (${ev.boardingStop.municipality}). Es el punto más cercano para tomar la ruta ${ev.route.code}.`,
        type: 'walk',
        fromName: originName,
        toName: ev.boardingStop.name,
        distanceMeters: ev.walkToBoardingMeters,
        durationMinutes: ev.walkToBoardingMinutes,
      },
      {
        instruction: `Sube a la buseta de ${ev.route.company} (Ruta ${ev.route.code})`,
        detail: `Pasa en aprox. ${ev.nextBusInMinutes} min (vehículo ${ev.recommendedBusCode}) en sentido ${ev.route.directionA}.`,
        type: 'bus',
        routeId: ev.route.id,
        routeCode: ev.route.code,
        routeName: ev.route.name,
        company: ev.route.company,
        color: ev.route.color,
        fromName: ev.boardingStop.name,
        toName: ev.alightingStop.name,
        distanceMeters: Math.round(ev.busTransitKm * 1000),
        durationMinutes: ev.busTransitMinutes,
      },
      {
        instruction: `Bájate en "${ev.alightingStop.name}" y camina a tu destino`,
        detail: `Bájate en ${ev.alightingStop.landmark}. Desde este punto son ${formatWalkDistance(ev.walkFromAlightingMeters)} caminando hasta ${destName}.`,
        type: 'walk',
        fromName: ev.alightingStop.name,
        toName: destName,
        distanceMeters: ev.walkFromAlightingMeters,
        durationMinutes: ev.walkFromAlightingMinutes,
      },
    ],
  };
}

/**
 * Strategy 1: Fastest Total Time Route (Walk + Wait + Bus + Final Walk)
 */
export class FastestDirectRouteStrategy implements ITripPlanningStrategy {
  public readonly strategyId = 'fastest-direct';

  public computePlan(ctx: TripPlanningContext): TripPlanResult | null {
    const evaluations = evaluateAllDirectRoutes(ctx);
    if (evaluations.length === 0) return null;

    const sortedByTime = [...evaluations].sort(
      (a, b) => a.totalDurationMinutes - b.totalDurationMinutes
    );
    const best = sortedByTime[0];

    return buildPlanFromEvaluation(
      best,
      'plan-fastest',
      'Más Rápido',
      ctx.originName,
      ctx.destName
    );
  }
}

/**
 * Strategy 2: Minimum Walking Distance Route (Best drop-off stop closest to Destination)
 */
export class LeastWalkingRouteStrategy implements ITripPlanningStrategy {
  public readonly strategyId = 'least-walking';

  public computePlan(ctx: TripPlanningContext): TripPlanResult | null {
    const evaluations = evaluateAllDirectRoutes(ctx);
    if (evaluations.length < 2) return null;

    const fastest = [...evaluations].sort(
      (a, b) => a.totalDurationMinutes - b.totalDurationMinutes
    )[0];

    const sortedByWalk = [...evaluations]
      .filter((e) => e.route.id !== fastest.route.id)
      .sort((a, b) => a.totalWalkMeters - b.totalWalkMeters);

    const bestWalk = sortedByWalk[0];
    if (!bestWalk) return null;

    return buildPlanFromEvaluation(
      bestWalk,
      'plan-least-walk',
      'Menos Caminata',
      ctx.originName,
      ctx.destName
    );
  }
}

/**
 * Strategy 3: Real Graph-Based 1-Transfer Route
 * Finds an actual shared transfer stop connecting the closest stop to Origin
 * with the closest stop to Destination, eliminating absurdly long walks.
 */
export class MultiLegTransferStrategy implements ITripPlanningStrategy {
  public readonly strategyId = 'multi-leg-transfer';

  public computePlan(ctx: TripPlanningContext): TripPlanResult | null {
    const allRoutes = ctx.transitRepo.getRoutes();
    const originStop = ctx.originStopMatch.stop;
    const destStop = ctx.destStopMatch.stop;

    // If the closest origin stop and closest destination stop already share a direct route, no transfer needed
    if (originStop.routes.some((r) => destStop.routes.includes(r))) {
      return null;
    }

    let bestLeg1: RouteInfo | null = null;
    let bestLeg2: RouteInfo | null = null;
    let bestTransferStop: BusStop | null = null;
    let minTotalKm = Number.MAX_SAFE_INTEGER;

    for (const r1Id of originStop.routes) {
      const r1 = allRoutes.find((r) => r.id === r1Id);
      if (!r1) continue;

      for (const r2Id of destStop.routes) {
        if (r1Id === r2Id) continue;
        const r2 = allRoutes.find((r) => r.id === r2Id);
        if (!r2) continue;

        // Find all stops where both r1 and r2 pass
        const sharedStops = r1.stops.filter((s1) =>
          r2.stops.some((s2) => s2.id === s1.id)
        );

        for (const tStop of sharedStops) {
          const d1 = GeoMath.calculateDistanceKm(originStop.coordinates, tStop.coordinates);
          const d2 = GeoMath.calculateDistanceKm(tStop.coordinates, destStop.coordinates);
          if (d1 + d2 < minTotalKm) {
            minTotalKm = d1 + d2;
            bestLeg1 = r1;
            bestLeg2 = r2;
            bestTransferStop = tStop;
          }
        }
      }
    }

    if (!bestLeg1 || !bestLeg2 || !bestTransferStop) {
      return null;
    }

    const walk1Meters = Math.max(20, Math.round(ctx.originStopMatch.distanceKm * 1000));
    const walk1Minutes = Math.max(1, Math.round(walk1Meters / 75));
    const walk2Meters = Math.max(20, Math.round(ctx.destStopMatch.distanceKm * 1000));
    const walk2Minutes = Math.max(1, Math.round(walk2Meters / 75));

    const leg1DistMeters = Math.max(
      500,
      Math.round(GeoMath.calculateDistanceKm(originStop.coordinates, bestTransferStop.coordinates) * 1200)
    );
    const leg2DistMeters = Math.max(
      500,
      Math.round(GeoMath.calculateDistanceKm(bestTransferStop.coordinates, destStop.coordinates) * 1200)
    );
    const leg1BusMin = Math.max(4, Math.round((leg1DistMeters / 1000 / 25) * 60));
    const leg2BusMin = Math.max(4, Math.round((leg2DistMeters / 1000 / 25) * 60));

    const leg1Buses = ctx.buses.filter((b) => b.routeId === bestLeg1!.id);
    const arrival = ctx.estimateArrivalMinutes(originStop.id, leg1Buses);
    const recommendedBusCode = arrival.bus?.code || leg1Buses[0]?.code || 'TR-101';

    return {
      id: 'plan-transfer',
      title: `Transbordo: ${bestLeg1.code} ➔ ${bestLeg2.code}`,
      tag: 'Con Transbordo',
      totalDurationMinutes:
        walk1Minutes + arrival.nextMin + leg1BusMin + 3 + leg2BusMin + walk2Minutes,
      totalDistanceKm: Number(
        (
          ctx.originStopMatch.distanceKm +
          (leg1DistMeters + leg2DistMeters) / 1000 +
          ctx.destStopMatch.distanceKm
        ).toFixed(1)
      ),
      totalFareCop: bestLeg1.fare + bestLeg2.fare,
      transfersCount: 1,
      nextBusInMinutes: arrival.nextMin,
      recommendedBusCode,
      boardingStop: originStop,
      alightingStop: destStop,
      transferStop: bestTransferStop,
      walkToBoardingMeters: walk1Meters,
      walkToBoardingMinutes: walk1Minutes,
      walkFromAlightingMeters: walk2Meters,
      walkFromAlightingMinutes: walk2Minutes,
      legs: [
        {
          instruction: `Camina hasta "${originStop.name}"`,
          detail: `Referencia: ${originStop.landmark}.`,
          type: 'walk',
          fromName: ctx.originName,
          toName: originStop.name,
          distanceMeters: walk1Meters,
          durationMinutes: walk1Minutes,
        },
        {
          instruction: `Sube a la buseta de ${bestLeg1.company} (${bestLeg1.code}) hasta ${bestTransferStop.name}`,
          detail: `Pasa en aprox. ${arrival.nextMin} min.`,
          type: 'bus',
          routeId: bestLeg1.id,
          routeCode: bestLeg1.code,
          routeName: bestLeg1.name,
          company: bestLeg1.company,
          color: bestLeg1.color,
          fromName: originStop.name,
          toName: bestTransferStop.name,
          distanceMeters: leg1DistMeters,
          durationMinutes: leg1BusMin,
        },
        {
          instruction: `Transborda en "${bestTransferStop.name}" a la buseta de ${bestLeg2.company} (${bestLeg2.code})`,
          detail: `Continúa hasta "${destStop.name}".`,
          type: 'transfer',
          routeId: bestLeg2.id,
          routeCode: bestLeg2.code,
          routeName: bestLeg2.name,
          company: bestLeg2.company,
          color: bestLeg2.color,
          fromName: bestTransferStop.name,
          toName: destStop.name,
          distanceMeters: leg2DistMeters,
          durationMinutes: leg2BusMin,
        },
        {
          instruction: `Bájate en "${destStop.name}" y camina a tu destino`,
          detail: `Referencia: ${destStop.landmark}. Camina ${formatWalkDistance(walk2Meters)} hasta ${ctx.destName}.`,
          type: 'walk',
          fromName: destStop.name,
          toName: ctx.destName,
          distanceMeters: walk2Meters,
          durationMinutes: walk2Minutes,
        },
      ],
    };
  }
}
