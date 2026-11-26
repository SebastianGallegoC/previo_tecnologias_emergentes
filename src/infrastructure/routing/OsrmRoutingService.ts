import { Coordinates } from '../../types/transit';
import { GeoMath } from '../geo/GeoMath';

/**
 * Open Source Routing Machine (OSRM) Service
 * Provides real road-network & pedestrian pathfinding over OpenStreetMap data,
 * plus geometry slicing along street-snapped transit corridors.
 */
export class OsrmRoutingService {
  private static instance: OsrmRoutingService;
  private readonly cache = new Map<string, Coordinates[]>();

  private constructor() {}

  public static getInstance(): OsrmRoutingService {
    if (!OsrmRoutingService.instance) {
      OsrmRoutingService.instance = new OsrmRoutingService();
    }
    return OsrmRoutingService.instance;
  }

  private buildCacheKey(a: Coordinates, b: Coordinates): string {
    return `${a.lat.toFixed(4)},${a.lng.toFixed(4)}->${b.lat.toFixed(4)},${b.lng.toFixed(4)}`;
  }

  /**
   * Queries OSRM for a street-snapped pedestrian path between two coordinates.
   * Uses in-memory caching and falls back gracefully if offline.
   */
  public async getStreetWalkingPath(
    from: Coordinates,
    to: Coordinates
  ): Promise<Coordinates[]> {
    const distKm = GeoMath.calculateDistanceKm(from, to);
    if (distKm < 0.015) {
      return [from, to];
    }

    const key = this.buildCacheKey(from, to);
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }

    const endpoints = [
      `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`,
      `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`,
    ];

    for (const url of endpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) continue;
        const data = await response.json();
        const rawCoords: [number, number][] | undefined =
          data?.routes?.[0]?.geometry?.coordinates;

        if (Array.isArray(rawCoords) && rawCoords.length >= 2) {
          const path: Coordinates[] = [
            from,
            ...rawCoords.map(([lng, lat]) => ({
              lat: Number(lat.toFixed(5)),
              lng: Number(lng.toFixed(5)),
            })),
            to,
          ];
          this.cache.set(key, path);
          return path;
        }
      } catch {
        // Try next OSRM mirror
      }
    }

    const fallback = [from, to];
    return fallback;
  }

  /**
   * Finds the index of the closest street vertex on a route's OSRM polyline.
   */
  public findClosestVertexIndex(
    waypoints: Coordinates[],
    target: Coordinates
  ): number {
    let bestIdx = 0;
    let minDist = Number.MAX_SAFE_INTEGER;

    for (let i = 0; i < waypoints.length; i++) {
      const d = GeoMath.calculateDistanceKm(waypoints[i], target);
      if (d < minDist) {
        minDist = d;
        bestIdx = i;
      }
    }

    return bestIdx;
  }

  private selectBestRouteIndices(
    waypoints: Coordinates[],
    boardingCoord: Coordinates,
    alightingCoord: Coordinates
  ): { sIdx: number; eIdx: number; forwardLen: number } {
    const n = waypoints.length;
    const findCandidateIndices = (target: Coordinates): number[] => {
      const candidates: { idx: number; dist: number }[] = [];
      for (let i = 0; i < n; i++) {
        const d = GeoMath.calculateDistanceKm(waypoints[i], target);
        if (d < 0.45) {
          candidates.push({ idx: i, dist: d });
        }
      }
      if (candidates.length === 0) {
        return [this.findClosestVertexIndex(waypoints, target)];
      }
      candidates.sort((a, b) => a.dist - b.dist);
      const picked: number[] = [candidates[0].idx];
      for (const c of candidates) {
        const farFromAll = picked.every(
          (pIdx) => Math.abs(c.idx - pIdx) > Math.max(10, Math.floor(n * 0.08))
        );
        if (farFromAll) {
          picked.push(c.idx);
          if (picked.length >= 4) break;
        }
      }
      return picked;
    };

    const startCandidates = findCandidateIndices(boardingCoord);
    const endCandidates = findCandidateIndices(alightingCoord);

    let bestS = startCandidates[0];
    let bestE = endCandidates[0];
    let minLen = Number.MAX_SAFE_INTEGER;

    for (const sIdx of startCandidates) {
      for (const eIdx of endCandidates) {
        const forwardLen = eIdx >= sIdx ? eIdx - sIdx : n - sIdx + eIdx;
        if (forwardLen > 0 && forwardLen < minLen) {
          minLen = forwardLen;
          bestS = sIdx;
          bestE = eIdx;
        }
      }
    }

    return { sIdx: bestS, eIdx: bestE, forwardLen: minLen };
  }

  /**
   * Returns the exact waypoint index on the route loop where the ride segment begins.
   */
  public findBoardingVertexIndex(
    waypoints: Coordinates[],
    boardingCoord: Coordinates,
    alightingCoord: Coordinates
  ): number {
    if (waypoints.length === 0) return 0;
    return this.selectBestRouteIndices(waypoints, boardingCoord, alightingCoord).sIdx;
  }

  private projectOntoSegment(
    p: Coordinates,
    a: Coordinates,
    b: Coordinates
  ): Coordinates {
    const dx = b.lng - a.lng;
    const dy = b.lat - a.lat;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return a;
    const t = Math.max(
      0,
      Math.min(1, ((p.lng - a.lng) * dx + (p.lat - a.lat) * dy) / lenSq)
    );
    return {
      lat: Number((a.lat + t * dy).toFixed(5)),
      lng: Number((a.lng + t * dx).toFixed(5)),
    };
  }

  private snapToNearestSegmentPoint(
    waypoints: Coordinates[],
    idx: number,
    target: Coordinates
  ): Coordinates {
    const n = waypoints.length;
    if (n < 2) return target;
    const prev = waypoints[(idx - 1 + n) % n];
    const curr = waypoints[idx];
    const next = waypoints[(idx + 1) % n];
    const p1 = this.projectOntoSegment(target, prev, curr);
    const p2 = this.projectOntoSegment(target, curr, next);
    const d1 = GeoMath.calculateDistanceKm(target, p1);
    const d2 = GeoMath.calculateDistanceKm(target, p2);
    return d1 <= d2 ? p1 : p2;
  }

  /**
   * Extracts the shortest road-snapped sub-segment along a cyclic bus route loop
   * anchored strictly on the street nearest to boardingCoord and alightingCoord.
   */
  public extractRouteSubSegment(
    waypoints: Coordinates[],
    boardingCoord: Coordinates,
    alightingCoord: Coordinates
  ): Coordinates[] {
    const n = waypoints.length;
    if (n < 2) return [boardingCoord, alightingCoord];

    const { sIdx, eIdx, forwardLen } = this.selectBestRouteIndices(
      waypoints,
      boardingCoord,
      alightingCoord
    );

    const snappedStart = this.snapToNearestSegmentPoint(waypoints, sIdx, boardingCoord);
    const snappedEnd = this.snapToNearestSegmentPoint(waypoints, eIdx, alightingCoord);

    let bestSlice: Coordinates[] = [];
    if (forwardLen < Number.MAX_SAFE_INTEGER) {
      if (eIdx >= sIdx) {
        bestSlice = waypoints.slice(sIdx, eIdx + 1);
      } else {
        bestSlice = [...waypoints.slice(sIdx), ...waypoints.slice(0, eIdx + 1)];
      }
    }

    // Safety check: if even the best forward arc wraps > 60% of the loop, take the direct backward slice
    if (forwardLen > n * 0.6 && forwardLen < Number.MAX_SAFE_INTEGER) {
      const low = Math.min(sIdx, eIdx);
      const high = Math.max(sIdx, eIdx);
      if (high - low < forwardLen) {
        const direct = waypoints.slice(low, high + 1);
        bestSlice = sIdx <= eIdx ? direct : [...direct].reverse();
      }
    }

    if (bestSlice.length === 0) {
      return [snappedStart, snappedEnd];
    }

    return [snappedStart, ...bestSlice, snappedEnd];
  }
}
