import { Coordinates } from '../../types/transit';

const EARTH_RADIUS_KM = 6371;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/**
 * Pure Geospatial Mathematics Utility (Single Responsibility Principle - SRP).
 */
export class GeoMath {
  /**
   * Computes great-circle Haversine distance in kilometers between two coordinates.
   */
  public static calculateDistanceKm(coord1: Coordinates, coord2: Coordinates): number {
    const dLat = (coord2.lat - coord1.lat) * DEG_TO_RAD;
    const dLng = (coord2.lng - coord1.lng) * DEG_TO_RAD;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(coord1.lat * DEG_TO_RAD) *
        Math.cos(coord2.lat * DEG_TO_RAD) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_KM * c;
  }

  /**
   * Computes forward compass bearing in degrees (0 to 360) from origin to destination.
   */
  public static calculateHeading(from: Coordinates, to: Coordinates): number {
    const lat1 = from.lat * DEG_TO_RAD;
    const lat2 = to.lat * DEG_TO_RAD;
    const dLng = (to.lng - from.lng) * DEG_TO_RAD;

    const y = Math.sin(dLng) * Math.cos(lat2);
    const x =
      Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

    const brng = Math.atan2(y, x) * RAD_TO_DEG;
    return (brng + 360) % 360;
  }

  /**
   * Linearly interpolates between two coordinates by a given ratio [0..1].
   */
  public static interpolate(from: Coordinates, to: Coordinates, ratio: number): Coordinates {
    return {
      lat: from.lat + (to.lat - from.lat) * ratio,
      lng: from.lng + (to.lng - from.lng) * ratio,
    };
  }
}
