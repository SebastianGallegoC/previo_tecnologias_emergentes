import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BusStop,
  BusVehicle,
  Coordinates,
  DeviceCapabilities,
  MapBaseLayer,
  MapPickMode,
  PaymentMethodType,
  RouteInfo,
  TripEndpoint,
  TripPlanResult,
} from '../types/transit';
import {
  CUCUTA_BUS_STOPS,
  CUCUTA_ROUTES,
} from '../data/cucutaTransitData';
import { calculateNextArrivalMinutes } from '../services/simulationEngine';
import { OsrmRoutingService } from '../infrastructure/routing/OsrmRoutingService';
import { GeoMath } from '../infrastructure/geo/GeoMath';
import { formatWalkDistance } from '../lib/utils';
import {
  Bus,
  ChevronRight,
  Crosshair,
  Globe,
  Lock,
  Map as MapIcon,
  MapPin,
  Navigation,
  QrCode,
  Search,
  Wifi,
  X,
} from 'lucide-react';
import { Button } from './ui/button';

interface LiveMapProps {
  buses: BusVehicle[];
  selectedBusId: string | null;
  onSelectBus: (busId: string | null) => void;
  onPayBusNfc: (bus: BusVehicle, preferredMethod?: PaymentMethodType) => void;
  userCoords: Coordinates | null;
  onLocateUser: () => void;
  filterRouteId: string | null;
  onFilterRouteChange: (routeId: string | null) => void;
  capabilities?: DeviceCapabilities;
  onOpenPlanner?: () => void;
  flyTarget?: { lat: number; lng: number; zoom?: number; ts: number } | null;
  fitTripBoundsTrigger?: number;
  isBottomSheetBlocking?: boolean;
  originEndpoint?: TripEndpoint;
  destEndpoint?: TripEndpoint | null;
  activePlan?: TripPlanResult | null;
  alternativePlans?: TripPlanResult[];
  focusTripOnly?: boolean;
  driverOnlyBusId?: string | null;
  mapPickMode?: MapPickMode;
  onStartMapPick?: (mode: 'origin' | 'destination') => void;
  onCancelMapPick?: () => void;
  onMapPointPicked?: (mode: 'origin' | 'destination', coords: Coordinates) => void;
}

export const LiveMap: React.FC<LiveMapProps> = ({
  buses,
  selectedBusId,
  onSelectBus,
  onPayBusNfc,
  userCoords,
  onLocateUser,
  filterRouteId,
  onFilterRouteChange,
  capabilities,
  onOpenPlanner,
  flyTarget,
  fitTripBoundsTrigger = 0,
  isBottomSheetBlocking = false,
  originEndpoint,
  destEndpoint,
  activePlan,
  alternativePlans = [],
  focusTripOnly = false,
  driverOnlyBusId = null,
  mapPickMode = null,
  onStartMapPick,
  onCancelMapPick,
  onMapPointPicked,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const streetLayerRef = useRef<L.TileLayer | null>(null);
  const satelliteLayerRef = useRef<L.TileLayer | null>(null);
  const satelliteLabelsLayerRef = useRef<L.TileLayer | null>(null);

  const busMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const stopMarkersRef = useRef<L.Marker[]>([]);
  const polylinesRef = useRef<Map<string, L.Polyline>>(new Map());
  const walkLayersRef = useRef<L.Layer[]>([]);
  const approachLineRef = useRef<L.Polyline | null>(null);
  const busAnimRef = useRef<
    Map<
      string,
      {
        fromLat: number;
        fromLng: number;
        toLat: number;
        toLng: number;
        curLat: number;
        curLng: number;
        fromHeading: number;
        toHeading: number;
        curHeading: number;
        startMs: number;
        durationMs: number;
      }
    >
  >(new Map());
  const userMarkerRef = useRef<L.Marker | null>(null);
  const originMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);

  const [baseLayer, setBaseLayer] = useState<MapBaseLayer>('streets');
  const [clickedMapCoords, setClickedMapCoords] = useState<Coordinates | null>(null);
  const [activeStop, setActiveStop] = useState<{
    stop: BusStop;
    nextMin: number;
    nextBus: BusVehicle | null;
  } | null>(null);

  const hasNfc = capabilities?.hasEffectiveNfc ?? false;
  const selectedBus = buses.find((b) => b.id === selectedBusId) || null;

  // Stable key for activePlan so 250ms bus-tick re-renders do NOT tear down polylines/stops during zoom
  const activePlanKey = activePlan
    ? `${activePlan.id}:${activePlan.boardingStop.id}:${activePlan.alightingStop.id}:${activePlan.walkToBoardingMeters}:${activePlan.walkFromAlightingMeters}:${activePlan.legs.map((l) => l.routeId || '').join(',')}`
    : '';
  const activePlanPrimaryRouteId = activePlan?.legs.find((l) => l.routeId)?.routeId || null;
  const activePlanRoute = activePlanPrimaryRouteId
    ? CUCUTA_ROUTES.find((r) => r.id === activePlanPrimaryRouteId) || null
    : null;
  const originLat = originEndpoint?.coordinates.lat ?? null;
  const originLng = originEndpoint?.coordinates.lng ?? null;
  const destLat = destEndpoint?.coordinates.lat ?? null;
  const destLng = destEndpoint?.coordinates.lng ?? null;

  const busesRef = useRef<BusVehicle[]>(buses);
  busesRef.current = buses;
  const activePlanRef = useRef<TripPlanResult | null>(activePlan ?? null);
  activePlanRef.current = activePlan ?? null;
  const altPlansKey = alternativePlans
    .map((p) => `${p.id}:${p.boardingStop.id}:${p.alightingStop.id}`)
    .join('|');
  const altPlansRef = useRef<TripPlanResult[]>(alternativePlans);
  altPlansRef.current = alternativePlans;

  // Keep latest mapPickMode & callback in refs for Leaflet click handler
  const pickModeRef = useRef<MapPickMode>(mapPickMode);
  const onPickedRef = useRef(onMapPointPicked);
  useEffect(() => {
    pickModeRef.current = mapPickMode;
    onPickedRef.current = onMapPointPicked;
    if (mapPickMode) {
      setClickedMapCoords(null);
    }
    if (originMarkerRef.current?.dragging) {
      if (mapPickMode === 'origin') {
        originMarkerRef.current.dragging.enable();
      } else {
        originMarkerRef.current.dragging.disable();
      }
    }
    if (destMarkerRef.current?.dragging) {
      if (mapPickMode === 'destination') {
        destMarkerRef.current.dragging.enable();
      } else {
        destMarkerRef.current.dragging.disable();
      }
    }
  }, [mapPickMode, onMapPointPicked]);

  // Initialize Map with Esri Street & Satellite Base Layers (No API key required)
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || mapInstanceRef.current) return;

    const map = L.map(container, {
      center: [7.882, -72.498],
      zoom: 13,
      zoomControl: false,
    });

    // 1. Esri World Street Map
    const streetLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, HERE, Garmin, USGS, OpenStreetMap',
        maxZoom: 19,
      }
    );

    // 2. Esri World Imagery (Satellite) + Reference Labels
    const satelliteLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
        maxZoom: 19,
      }
    );

    const satelliteLabelsLayer = L.tileLayer(
      'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        pane: 'overlayPane',
      }
    );

    streetLayer.addTo(map);
    streetLayerRef.current = streetLayer;
    satelliteLayerRef.current = satelliteLayer;
    satelliteLabelsLayerRef.current = satelliteLabelsLayer;

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (pickModeRef.current && onPickedRef.current) {
        const coords: Coordinates = {
          lat: Number(e.latlng.lat.toFixed(5)),
          lng: Number(e.latlng.lng.toFixed(5)),
        };
        onPickedRef.current(pickModeRef.current, coords);
        setClickedMapCoords(null);
      } else {
        // Normal map taps only dismiss popups and never alter Origin/Destination
        setClickedMapCoords(null);
        setActiveStop(null);
      }
    });

    mapInstanceRef.current = map;

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      busMarkersRef.current.clear();
      stopMarkersRef.current = [];
      polylinesRef.current.clear();
      walkLayersRef.current = [];
      originMarkerRef.current = null;
      destMarkerRef.current = null;
      userMarkerRef.current = null;
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Switch between Streets and Satellite layers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const street = streetLayerRef.current;
    const sat = satelliteLayerRef.current;
    const satLabels = satelliteLabelsLayerRef.current;
    if (!map || !street || !sat || !satLabels) return;

    if (baseLayer === 'satellite') {
      if (map.hasLayer(street)) map.removeLayer(street);
      if (!map.hasLayer(sat)) sat.addTo(map);
      if (!map.hasLayer(satLabels)) satLabels.addTo(map);
    } else {
      if (map.hasLayer(sat)) map.removeLayer(sat);
      if (map.hasLayer(satLabels)) map.removeLayer(satLabels);
      if (!map.hasLayer(street)) street.addTo(map);
    }
  }, [baseLayer]);

  // Fly to external target when requested (accounting for mobile bottom sheet)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!flyTarget || !map) return;
    const targetZoom = flyTarget.zoom ?? 15;
    if (isBottomSheetBlocking) {
      const point = map.project([flyTarget.lat, flyTarget.lng], targetZoom);
      const offsetPoint = point.add([0, Math.round(map.getSize().y * 0.22)]);
      const adjustedLatLng = map.unproject(offsetPoint, targetZoom);
      map.flyTo(adjustedLatLng, targetZoom, { duration: 0.8 });
    } else {
      map.flyTo([flyTarget.lat, flyTarget.lng], targetZoom, { duration: 0.8 });
    }
  }, [flyTarget, isBottomSheetBlocking]);

  // Fit bounds around active journey (Origin A, Boarding, Alighting, Dest B)
  const fitTripBounds = React.useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map || !originEndpoint || !destEndpoint) return;

    const points: [number, number][] = [
      [originEndpoint.coordinates.lat, originEndpoint.coordinates.lng],
      [destEndpoint.coordinates.lat, destEndpoint.coordinates.lng],
    ];
    if (activePlan) {
      points.push([
        activePlan.boardingStop.coordinates.lat,
        activePlan.boardingStop.coordinates.lng,
      ]);
      points.push([
        activePlan.alightingStop.coordinates.lat,
        activePlan.alightingStop.coordinates.lng,
      ]);
    }
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, {
      paddingTopLeft: [36, 90],
      paddingBottomRight: [36, 150],
      maxZoom: 15,
      animate: true,
    });
  }, [originEndpoint, destEndpoint, activePlan]);

  useEffect(() => {
    if (fitTripBoundsTrigger > 0) {
      fitTripBounds();
    }
  }, [fitTripBoundsTrigger, fitTripBounds]);

  // Render & Update Draggable Origin (A) and Destination (B) Pins on Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (originEndpoint) {
      const originLabel = originEndpoint.isCurrentLocation ? 'Mi ubicación' : 'Partida (A)';
      const originIcon = L.divIcon({
        className: 'uber-origin-pin',
        html: `
          <div class="flex flex-col items-center">
            <div class="px-2 py-0.5 rounded-md bg-neutral-900 text-white text-[10px] font-bold shadow-md whitespace-nowrap mb-0.5 border border-white/20">
              ${originLabel}
            </div>
            <div class="w-6 h-6 rounded-full bg-neutral-900 border-2 border-white text-white text-[11px] font-black flex items-center justify-center shadow-lg">
              A
            </div>
          </div>
        `,
        iconSize: [84, 42],
        iconAnchor: [42, 36],
      });

      if (originMarkerRef.current) {
        originMarkerRef.current.setLatLng([
          originEndpoint.coordinates.lat,
          originEndpoint.coordinates.lng,
        ]);
        originMarkerRef.current.setIcon(originIcon);
      } else {
        const m = L.marker(
          [originEndpoint.coordinates.lat, originEndpoint.coordinates.lng],
          { icon: originIcon, draggable: true, zIndexOffset: 900 }
        ).addTo(map);
        if (pickModeRef.current !== 'origin') {
          m.dragging?.disable();
        }
        m.on('dragend', () => {
          const pos = m.getLatLng();
          if (onPickedRef.current) {
            onPickedRef.current('origin', {
              lat: Number(pos.lat.toFixed(5)),
              lng: Number(pos.lng.toFixed(5)),
            });
          }
        });
        originMarkerRef.current = m;
      }
    }

    if (destEndpoint) {
      const destIcon = L.divIcon({
        className: 'uber-dest-pin',
        html: `
          <div class="flex flex-col items-center">
            <div class="px-2 py-0.5 rounded-md bg-neutral-900 text-white text-[10px] font-bold shadow-md whitespace-nowrap mb-0.5 border border-white/20">
              Destino (B)
            </div>
            <div class="w-6 h-6 rounded-md bg-neutral-900 border-2 border-white text-white text-[11px] font-black flex items-center justify-center shadow-lg">
              B
            </div>
          </div>
        `,
        iconSize: [84, 42],
        iconAnchor: [42, 36],
      });

      if (destMarkerRef.current) {
        destMarkerRef.current.setLatLng([
          destEndpoint.coordinates.lat,
          destEndpoint.coordinates.lng,
        ]);
        destMarkerRef.current.setIcon(destIcon);
      } else {
        const m = L.marker(
          [destEndpoint.coordinates.lat, destEndpoint.coordinates.lng],
          { icon: destIcon, draggable: true, zIndexOffset: 900 }
        ).addTo(map);
        if (pickModeRef.current !== 'destination') {
          m.dragging?.disable();
        }
        m.on('dragend', () => {
          const pos = m.getLatLng();
          if (onPickedRef.current) {
            onPickedRef.current('destination', {
              lat: Number(pos.lat.toFixed(5)),
              lng: Number(pos.lng.toFixed(5)),
            });
          }
        });
        destMarkerRef.current = m;
      }
    } else if (destMarkerRef.current) {
      destMarkerRef.current.remove();
      destMarkerRef.current = null;
    }
  }, [originEndpoint, destEndpoint]);

  // Draw Street-Snapped Walking Connectors (via OSRM) & Active Bus Segment for Active Plan
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    let isCancelled = false;

    walkLayersRef.current.forEach((layer) => layer.remove());
    walkLayersRef.current = [];

    const plan = activePlanRef.current;
    if (!plan || originLat === null || originLng === null || destLat === null || destLng === null) {
      return;
    }

    const osrm = OsrmRoutingService.getInstance();

    // 1. Draw 2nd & 3rd alternative recommended routes softly underneath, then ALL bus legs of activePlan
    altPlansRef.current.forEach((altPlan) => {
      const altBusLegs = altPlan.legs.filter((l) => l.routeId);
      altBusLegs.forEach((leg) => {
        const altRoute = leg.routeId
          ? CUCUTA_ROUTES.find((r) => r.id === leg.routeId)
          : null;
        if (!altRoute) return;
        const subSeg = osrm.extractRouteSubSegment(
          altRoute.waypoints,
          altPlan.boardingStop.coordinates,
          altPlan.alightingStop.coordinates
        );
        if (subSeg.length >= 2) {
          const altLine = L.polyline(
            subSeg.map((pt) => [pt.lat, pt.lng] as [number, number]),
            {
              color: altRoute.color,
              weight: 3.5,
              opacity: 0.36,
              lineCap: 'round',
              lineJoin: 'round',
              interactive: false,
            }
          ).addTo(map);
          walkLayersRef.current.push(altLine);
        }
      });
    });

    const activeBusLegs = plan.legs.filter((l) => l.routeId);
    activeBusLegs.forEach((leg) => {
      const legRoute = leg.routeId
        ? CUCUTA_ROUTES.find((r) => r.id === leg.routeId)
        : null;
      if (!legRoute) return;
      const subSegment = osrm.extractRouteSubSegment(
        legRoute.waypoints,
        plan.boardingStop.coordinates,
        plan.alightingStop.coordinates
      );
      if (subSegment.length >= 2) {
        const activeBusSegment = L.polyline(
          subSegment.map((pt) => [pt.lat, pt.lng] as [number, number]),
          {
            color: legRoute.color,
            weight: 5.5,
            opacity: 0.95,
            lineCap: 'round',
            lineJoin: 'round',
            interactive: false,
          }
        ).addTo(map);
        activeBusSegment.bringToFront();
        walkLayersRef.current.push(activeBusSegment);
      }
    });

    // 2. Always show Boarding & Alighting Stop Pins (compact dot when < 80m, full badge when >= 80m)
    const boardStopIcon = L.divIcon({
      className: 'boarding-stop-callout',
      html:
        plan.walkToBoardingMeters >= 80
          ? `
          <div class="flex flex-col items-center pointer-events-none">
            <div class="w-3.5 h-3.5 rounded-full bg-neutral-900 border-2 border-white shadow"></div>
            <div class="px-2 py-0.5 rounded-md bg-white text-neutral-900 border border-neutral-900 text-[10px] font-bold shadow-md whitespace-nowrap mt-1">
              Subir · ${formatWalkDistance(plan.walkToBoardingMeters)}
            </div>
          </div>
        `
          : `
          <div class="flex flex-col items-center pointer-events-none">
            <div class="w-4 h-4 rounded-full bg-neutral-900 border-2 border-white shadow-md"></div>
            <div class="px-1.5 py-0.5 rounded bg-white text-neutral-900 border border-neutral-900 text-[9px] font-bold shadow whitespace-nowrap mt-0.5">
              Subir
            </div>
          </div>
        `,
      iconSize: [120, 34],
      iconAnchor: [60, 8],
    });
    const boardMarker = L.marker(
      [plan.boardingStop.coordinates.lat, plan.boardingStop.coordinates.lng],
      { icon: boardStopIcon, interactive: false, zIndexOffset: 900 }
    ).addTo(map);
    walkLayersRef.current.push(boardMarker);

    const alightStopIcon = L.divIcon({
      className: 'alighting-stop-callout',
      html:
        plan.walkFromAlightingMeters >= 80
          ? `
          <div class="flex flex-col items-center pointer-events-none">
            <div class="w-3.5 h-3.5 rounded-full bg-neutral-900 border-2 border-white shadow"></div>
            <div class="px-2 py-0.5 rounded-md bg-neutral-900 text-white border border-white/25 text-[10px] font-bold shadow-md whitespace-nowrap mt-1">
              Bajar · ${formatWalkDistance(plan.walkFromAlightingMeters)} a pie
            </div>
          </div>
        `
          : `
          <div class="flex flex-col items-center pointer-events-none">
            <div class="w-4 h-4 rounded-full bg-neutral-900 border-2 border-white shadow-md"></div>
            <div class="px-1.5 py-0.5 rounded bg-neutral-900 text-white border border-white/25 text-[9px] font-bold shadow whitespace-nowrap mt-0.5">
              Bajar
            </div>
          </div>
        `,
      iconSize: [140, 34],
      iconAnchor: [70, 8],
    });
    const alightMarker = L.marker(
      [plan.alightingStop.coordinates.lat, plan.alightingStop.coordinates.lng],
      { icon: alightStopIcon, interactive: false, zIndexOffset: 900 }
    ).addTo(map);
    walkLayersRef.current.push(alightMarker);

    // 3. Street-snapped Dashed Walking Paths via OSRM (Origin -> Boarding & Alighting -> Destination)
    Promise.all([
      osrm.getStreetWalkingPath(
        { lat: originLat, lng: originLng },
        plan.boardingStop.coordinates
      ),
      osrm.getStreetWalkingPath(
        plan.alightingStop.coordinates,
        { lat: destLat, lng: destLng }
      ),
    ]).then(([walkToBoardCoords, walkToDestCoords]) => {
      if (isCancelled || !mapInstanceRef.current) return;

      const walkToBoardLine = L.polyline(
        walkToBoardCoords.map((c) => [c.lat, c.lng] as [number, number]),
        {
          color: '#171717',
          weight: 4,
          dashArray: '6, 8',
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false,
        }
      ).addTo(mapInstanceRef.current);

      const walkToDestLine = L.polyline(
        walkToDestCoords.map((c) => [c.lat, c.lng] as [number, number]),
        {
          color: '#171717',
          weight: 4,
          dashArray: '6, 8',
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false,
        }
      ).addTo(mapInstanceRef.current);

      walkLayersRef.current.push(walkToBoardLine, walkToDestLine);
    });

    return () => {
      isCancelled = true;
    };
  }, [activePlanKey, altPlansKey, originLat, originLng, destLat, destLng]);

  // Draw or update Route Polylines (hidden when focusTripOnly is active so only the trip segment renders)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    polylinesRef.current.forEach((poly) => poly.remove());
    polylinesRef.current.clear();

    if (focusTripOnly) {
      return;
    }

    CUCUTA_ROUTES.forEach((route: RouteInfo) => {
      const isVisible = !filterRouteId || filterRouteId === route.id;
      const isPrimary = filterRouteId === route.id;

      if (isVisible) {
        const latLngs = route.waypoints.map((wp) => [wp.lat, wp.lng] as [number, number]);

        const polyline = L.polyline(latLngs, {
          color: route.color,
          weight: isPrimary ? 5 : 3.5,
          opacity: isPrimary ? 0.9 : 0.55,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false,
        }).addTo(map);

        polylinesRef.current.set(route.id, polyline);
      }
    });
  }, [filterRouteId, focusTripOnly]);

  // Draw Bus Stops (only boarding & alighting stops when focusTripOnly is active)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    stopMarkersRef.current.forEach((m) => m.remove());
    stopMarkersRef.current = [];

    if (focusTripOnly && !activePlan) {
      return;
    }

    CUCUTA_BUS_STOPS.forEach((stop) => {
      const isVisible =
        focusTripOnly && activePlan
          ? stop.id === activePlan.boardingStop.id ||
            stop.id === activePlan.alightingStop.id
          : !filterRouteId || stop.routes.includes(filterRouteId);
      if (!isVisible) return;

      const stopIcon = L.divIcon({
        className: 'custom-stop-marker',
        html: `
          <div class="group relative cursor-pointer">
            <div class="w-3.5 h-3.5 rounded-full bg-white border-2 border-neutral-800 flex items-center justify-center shadow-sm hover:scale-125 transition-transform">
              <div class="w-1 h-1 rounded-full bg-neutral-800"></div>
            </div>
          </div>
        `,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      const marker = L.marker([stop.coordinates.lat, stop.coordinates.lng], {
        icon: stopIcon,
      }).addTo(map);

      marker.on('click', (e) => {
        if (pickModeRef.current && onPickedRef.current) {
          L.DomEvent.stopPropagation(e);
          onPickedRef.current(pickModeRef.current, stop.coordinates);
          return;
        }
        const arrival = calculateNextArrivalMinutes(stop.id, busesRef.current);
        setActiveStop({
          stop,
          nextMin: arrival.nextMin,
          nextBus: arrival.bus,
        });
      });

      stopMarkersRef.current.push(marker);
    });
  }, [filterRouteId, focusTripOnly, activePlanKey]);

  // Update Live Bus Markers (only active route's buses when trip searched; 0 buses before searching; 1 unit for Driver)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const activePlanRouteIds = activePlan
      ? activePlan.legs.filter((l) => l.routeId).map((l) => l.routeId!)
      : [];

    buses.forEach((bus) => {
      let isVisible = true;
      if (driverOnlyBusId) {
        isVisible = bus.id === driverOnlyBusId;
      } else if (focusTripOnly) {
        isVisible = Boolean(activePlan) && activePlanRouteIds.includes(bus.routeId);
      } else if (filterRouteId) {
        isVisible = bus.routeId === filterRouteId;
      }

      const isSelected = bus.id === selectedBusId;
      const route = CUCUTA_ROUTES.find((r) => r.id === bus.routeId);
      const color = route ? route.color : '#171717';

      if (!isVisible) {
        if (busMarkersRef.current.has(bus.id)) {
          busMarkersRef.current.get(bus.id)?.remove();
          busMarkersRef.current.delete(bus.id);
        }
        busAnimRef.current.delete(bus.id);
        return;
      }

      // Dynamic along-route ETA to boarding stop when planning a trip (no company name on capsule)
      let capsuleLabel = bus.code;
      if (activePlan && focusTripOnly && route && route.waypoints.length >= 2) {
        const osrm = OsrmRoutingService.getInstance();
        const boardingWpIdx = osrm.findBoardingVertexIndex(
          route.waypoints,
          activePlan.boardingStop.coordinates,
          activePlan.alightingStop.coordinates
        );
        const totalWp = route.waypoints.length;
        const curWpIdx = bus.currentWaypointIndex % totalWp;
        const forwardSteps = (boardingWpIdx - curWpIdx + totalWp) % totalWp;
        let alongRouteKm = 0;
        if (forwardSteps > 0) {
          let prev = bus.coordinates;
          for (let s = 1; s <= forwardSteps; s++) {
            const nextPt = route.waypoints[(curWpIdx + s) % totalWp];
            alongRouteKm += GeoMath.calculateDistanceKm(prev, nextPt);
            prev = nextPt;
          }
          alongRouteKm += GeoMath.calculateDistanceKm(prev, activePlan.boardingStop.coordinates);
        } else {
          alongRouteKm = GeoMath.calculateDistanceKm(
            bus.coordinates,
            activePlan.boardingStop.coordinates
          );
        }
        const etaMin = Math.max(
          1,
          Math.round((alongRouteKm / Math.max(16, bus.speedKmh)) * 60)
        );
        capsuleLabel = `${route.code} · ${etaMin} min`;
      }

      const occColor =
        bus.occupancyPercentage >= 85
          ? '#e11d48'
          : bus.occupancyPercentage >= 60
          ? '#f59e0b'
          : '#10b981';

      const busHtml = `
        <div class="relative flex flex-col items-center cursor-pointer ${
          isSelected ? 'z-40' : 'z-20'
        }">
          <div class="bus-pill flex items-center gap-1 ${
            isSelected
              ? 'bg-neutral-900 text-white border-neutral-900'
              : 'bg-white text-neutral-900 border-neutral-200'
          } rounded-full px-2 py-0.5 shadow-md border mb-0.5">
            <span class="bus-occ w-1.5 h-1.5 rounded-full shrink-0" style="background-color: ${occColor}"></span>
            <span class="bus-label text-[9px] font-bold tracking-tight whitespace-nowrap">${capsuleLabel}</span>
          </div>
          <div class="bus-heading-wrap w-8 h-9 flex items-center justify-center drop-shadow-md" style="transform: rotate(${bus.heading}deg); transform-origin: center center;">
            <svg width="26" height="34" viewBox="0 0 26 34" fill="none" aria-hidden="true">
              <!-- Buseta elongated body -->
              <rect x="4" y="1.5" width="18" height="31" rx="4.5" fill="#ffffff" stroke="${color}" stroke-width="2"/>
              <!-- Front headlights -->
              <rect x="6" y="1.2" width="3.5" height="1.6" rx="0.8" fill="#facc15"/>
              <rect x="16.5" y="1.2" width="3.5" height="1.6" rx="0.8" fill="#facc15"/>
              <!-- Wide panoramic bus windshield -->
              <path d="M6 5.2C6 4.1 6.9 3.4 8 3.4H18C19.1 3.4 20 4.1 20 5.2V8.8C20 9.4 19.5 9.8 18.9 9.8H7.1C6.5 9.8 6 9.4 6 8.8V5.2Z" fill="#171717"/>
              <!-- Side window strips -->
              <rect x="4.8" y="11" width="1.6" height="16" rx="0.8" fill="#404040"/>
              <rect x="19.6" y="11" width="1.6" height="16" rx="0.8" fill="#404040"/>
              <!-- Roof color stripe & A/C unit + skylight -->
              <rect x="7.5" y="11.5" width="11" height="15" rx="2" fill="${color}" fill-opacity="0.18"/>
              <rect x="9.2" y="13.2" width="7.6" height="5" rx="1.2" fill="${color}" fill-opacity="0.55" stroke="${color}" stroke-width="0.9"/>
              <rect x="9.5" y="20.2" width="7" height="4.2" rx="1" fill="#e5e5e5" stroke="#a3a3a3" stroke-width="0.8"/>
              <!-- Rear window & red taillights -->
              <rect x="7" y="28.2" width="12" height="2.4" rx="1" fill="#262626"/>
              <rect x="5.8" y="31.2" width="3.5" height="1.5" rx="0.7" fill="#ef4444"/>
              <rect x="16.7" y="31.2" width="3.5" height="1.5" rx="0.7" fill="#ef4444"/>
            </svg>
          </div>
        </div>
      `;

      const nowMs = performance.now();
      const existingAnim = busAnimRef.current.get(bus.id);

      if (busMarkersRef.current.has(bus.id)) {
        const marker = busMarkersRef.current.get(bus.id)!;
        if (existingAnim) {
          // Smoothly continue from current interpolated position (InDrive-style, zero snap-back)
          busAnimRef.current.set(bus.id, {
            fromLat: existingAnim.curLat,
            fromLng: existingAnim.curLng,
            toLat: bus.coordinates.lat,
            toLng: bus.coordinates.lng,
            curLat: existingAnim.curLat,
            curLng: existingAnim.curLng,
            fromHeading: existingAnim.curHeading,
            toHeading: bus.heading,
            curHeading: existingAnim.curHeading,
            startMs: nowMs,
            durationMs: 1000,
          });
        } else {
          marker.setLatLng([bus.coordinates.lat, bus.coordinates.lng]);
          busAnimRef.current.set(bus.id, {
            fromLat: bus.coordinates.lat,
            fromLng: bus.coordinates.lng,
            toLat: bus.coordinates.lat,
            toLng: bus.coordinates.lng,
            curLat: bus.coordinates.lat,
            curLng: bus.coordinates.lng,
            fromHeading: bus.heading,
            toHeading: bus.heading,
            curHeading: bus.heading,
            startMs: nowMs,
            durationMs: 1000,
          });
        }

        const el = marker.getElement();
        if (el) {
          const labelEl = el.querySelector<HTMLElement>('.bus-label');
          const occEl = el.querySelector<HTMLElement>('.bus-occ');
          const pillEl = el.querySelector<HTMLElement>('.bus-pill');
          if (labelEl && labelEl.textContent !== capsuleLabel) {
            labelEl.textContent = capsuleLabel;
          }
          if (occEl) occEl.style.backgroundColor = occColor;
          if (pillEl) {
            pillEl.className = `bus-pill flex items-center gap-1 ${
              isSelected
                ? 'bg-neutral-900 text-white border-neutral-900'
                : 'bg-white text-neutral-900 border-neutral-200'
            } rounded-full px-2 py-0.5 shadow-md border mb-0.5`;
          }
        }
      } else {
        const busIcon = L.divIcon({
          className: 'bus-marker-container',
          html: busHtml,
          iconSize: [88, 56],
          iconAnchor: [44, 38],
        });
        const marker = L.marker([bus.coordinates.lat, bus.coordinates.lng], {
          icon: busIcon,
        }).addTo(map);
        marker.on('click', () => {
          if (pickModeRef.current) return;
          onSelectBus(bus.id);
        });
        busMarkersRef.current.set(bus.id, marker);
        busAnimRef.current.set(bus.id, {
          fromLat: bus.coordinates.lat,
          fromLng: bus.coordinates.lng,
          toLat: bus.coordinates.lat,
          toLng: bus.coordinates.lng,
          curLat: bus.coordinates.lat,
          curLng: bus.coordinates.lng,
          fromHeading: bus.heading,
          toHeading: bus.heading,
          curHeading: bus.heading,
          startMs: nowMs,
          durationMs: 1000,
        });
      }
    });
  }, [buses, selectedBusId, filterRouteId, onSelectBus, focusTripOnly, activePlanKey, driverOnlyBusId]);

  // 60fps InDrive-style interpolation loop for busetas + live dynamic approach line to boardingStop
  useEffect(() => {
    let rafId = 0;

    const tick = (nowMs: number) => {
      busAnimRef.current.forEach((anim, busId) => {
        const marker = busMarkersRef.current.get(busId);
        if (!marker) return;

        const t = Math.min(1, Math.max(0, (nowMs - anim.startMs) / anim.durationMs));
        const lat = anim.fromLat + (anim.toLat - anim.fromLat) * t;
        const lng = anim.fromLng + (anim.toLng - anim.fromLng) * t;

        // Shortest angular interpolation so 355° -> 5° turns +10° instead of -350°
        const angleDelta = ((anim.toHeading - anim.fromHeading + 540) % 360) - 180;
        const heading = (anim.fromHeading + angleDelta * t + 360) % 360;

        anim.curLat = lat;
        anim.curLng = lng;
        anim.curHeading = heading;

        marker.setLatLng([lat, lng]);
        const el = marker.getElement();
        const headingEl = el?.querySelector<HTMLElement>('.bus-heading-wrap');
        if (headingEl) {
          headingEl.style.transform = `rotate(${heading.toFixed(1)}deg)`;
        }
      });

      // Update live approach polyline from the nearest approaching buseta to boardingStop
      const map = mapInstanceRef.current;
      const plan = activePlanRef.current;
      const primaryLeg = plan?.legs.find((l) => l.routeId);
      const route = primaryLeg?.routeId
        ? CUCUTA_ROUTES.find((r) => r.id === primaryLeg.routeId)
        : null;

      if (map && plan && route && route.waypoints.length >= 2) {
        const wps = route.waypoints;
        const totalWp = wps.length;
        const boardingWpIdx = OsrmRoutingService.getInstance().findBoardingVertexIndex(
          wps,
          plan.boardingStop.coordinates,
          plan.alightingStop.coordinates
        );

        // Find nearest bus on this route with remaining along-route distance > 45m
        const routeBuses = busesRef.current.filter((b) => b.routeId === route.id);
        let bestBus: BusVehicle | null = null;
        let bestForwardSteps = Number.MAX_SAFE_INTEGER;
        let bestRemainingKm = Number.MAX_SAFE_INTEGER;

        for (const b of routeBuses) {
          const anim = busAnimRef.current.get(b.id);
          const curCoord = anim
            ? { lat: anim.curLat, lng: anim.curLng }
            : b.coordinates;
          const curWpIdx = b.currentWaypointIndex % totalWp;
          const forwardSteps = (boardingWpIdx - curWpIdx + totalWp) % totalWp;
          if (forwardSteps <= 0) {
            // Bus is at or just passed boardingWpIdx — immediately switch to the next buseta
            continue;
          }

          let remainingKm = 0;
          let prev = curCoord;
          for (let s = 1; s <= forwardSteps; s++) {
            const pt = wps[(curWpIdx + s) % totalWp];
            remainingKm += GeoMath.calculateDistanceKm(prev, pt);
            prev = pt;
          }
          remainingKm += GeoMath.calculateDistanceKm(prev, plan.boardingStop.coordinates);

          // Also skip if bus is right at the boarding stop (<= 45m) so it transitions promptly
          if (remainingKm <= 0.045) {
            continue;
          }

          if (remainingKm < bestRemainingKm) {
            bestRemainingKm = remainingKm;
            bestForwardSteps = forwardSteps;
            bestBus = b;
          }
        }

        if (bestBus) {
          const anim = busAnimRef.current.get(bestBus.id);
          const startCoord: [number, number] = anim
            ? [anim.curLat, anim.curLng]
            : [bestBus.coordinates.lat, bestBus.coordinates.lng];
          const pathCoords: [number, number][] = [startCoord];
          const startIdx = (bestBus.currentWaypointIndex + 1) % totalWp;
          const maxSteps = Math.min(bestForwardSteps, totalWp - 1);
          for (let s = 0; s < maxSteps; s++) {
            const pt = wps[(startIdx + s) % totalWp];
            pathCoords.push([pt.lat, pt.lng]);
          }
          pathCoords.push([
            plan.boardingStop.coordinates.lat,
            plan.boardingStop.coordinates.lng,
          ]);

          if (approachLineRef.current) {
            approachLineRef.current.setLatLngs(pathCoords);
          } else {
            approachLineRef.current = L.polyline(pathCoords, {
              color: '#db2777',
              weight: 4,
              opacity: 0.85,
              dashArray: '5, 7',
              lineCap: 'round',
              lineJoin: 'round',
              interactive: false,
            }).addTo(map);
          }
        } else if (approachLineRef.current) {
          approachLineRef.current.remove();
          approachLineRef.current = null;
        }
      } else if (approachLineRef.current) {
        approachLineRef.current.remove();
        approachLineRef.current = null;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      if (approachLineRef.current) {
        approachLineRef.current.remove();
        approachLineRef.current = null;
      }
    };
  }, []);

  // Update User GPS Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !userCoords) return;

    const userHtml = `
      <div class="relative">
        <div class="w-5 h-5 rounded-full bg-blue-600 border-2 border-white shadow-md flex items-center justify-center">
          <div class="w-1.5 h-1.5 rounded-full bg-white"></div>
        </div>
      </div>
    `;

    const userIcon = L.divIcon({
      className: 'user-location-marker',
      html: userHtml,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([userCoords.lat, userCoords.lng]);
    } else {
      userMarkerRef.current = L.marker([userCoords.lat, userCoords.lng], {
        icon: userIcon,
      }).addTo(map);
    }
  }, [userCoords]);

  return (
    <div
      className={`relative w-full h-full flex flex-col overflow-hidden select-none ${
        mapPickMode ? 'cursor-crosshair' : ''
      }`}
    >
      {/* Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full z-0 bg-neutral-100" />

      {/* Top Banner when Picking Point on Map */}
      <AnimatePresence>
        {mapPickMode && (
          <motion.div
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-[92%] max-w-md bg-neutral-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2.5">
              <MapPin className="w-5 h-5 text-white shrink-0" />
              <div className="text-xs">
                <span className="font-bold block">
                  {mapPickMode === 'origin'
                    ? 'Toca el mapa para fijar tu Punto de Partida (A)'
                    : 'Toca el mapa para fijar tu Destino (B)'}
                </span>
                <span className="text-neutral-300 text-[11px]">
                  Te diremos hasta qué parada caminar y dónde bajarte
                </span>
              </div>
            </div>
            {onCancelMapPick && (
              <button
                onClick={onCancelMapPick}
                className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-semibold transition-colors shrink-0"
              >
                Cancelar
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Overlay: Route Filter Chips + Base Map Switcher (Calles / Satélite) */}
      {!mapPickMode && (
        <div className="absolute top-3 left-3 right-3 z-10 flex flex-col gap-2 pointer-events-none">
          {/* Mobile Search Trigger (only shown in pure Map tab) */}
          {onOpenPlanner && (
            <button
              type="button"
              onClick={onOpenPlanner}
              className="lg:hidden pointer-events-auto w-full bg-white border border-neutral-200 rounded-2xl px-3.5 py-2.5 shadow-md flex items-center gap-3 text-left active:scale-[0.99] transition-transform"
            >
              <Search className="w-4 h-4 text-neutral-500 shrink-0" aria-hidden="true" />
              <span className="font-semibold text-sm text-neutral-700 truncate">
                ¿A dónde vas?
              </span>
            </button>
          )}

          <div className="flex items-center justify-end lg:justify-between gap-2">
            {/* Compact Horizontally Scrollable Route Filter Pills (Desktop only) */}
            <div
              role="region"
              aria-label="Filtrar rutas"
              tabIndex={0}
              className="hidden lg:flex snap-scroller gap-1 bg-white/95 backdrop-blur-md p-1 rounded-full border border-neutral-200 shadow-sm pointer-events-auto min-w-0 max-w-full"
            >
              <button
                type="button"
                onClick={() => onFilterRouteChange(null)}
                aria-pressed={filterRouteId === null}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  filterRouteId === null
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Todas
              </button>
              {CUCUTA_ROUTES.map((route) => {
                const isSelected = filterRouteId === route.id;
                return (
                  <button
                    key={route.id}
                    type="button"
                    onClick={() => onFilterRouteChange(isSelected ? null : route.id)}
                    aria-pressed={isSelected}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-neutral-900 text-white'
                        : 'text-neutral-600 hover:bg-neutral-100'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: route.color }}
                      aria-hidden="true"
                    />
                    <span>{route.code}</span>
                  </button>
                );
              })}
            </div>

            {/* Base Map Toggle: Mapa vs Satélite */}
            <div className="flex items-center bg-white/95 backdrop-blur-md p-1 rounded-full border border-neutral-200 shadow-sm pointer-events-auto shrink-0">
              <button
                type="button"
                onClick={() => setBaseLayer('streets')}
                aria-pressed={baseLayer === 'streets'}
                aria-label="Vista de calles"
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  baseLayer === 'streets'
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Mapa</span>
              </button>
              <button
                type="button"
                onClick={() => setBaseLayer('satellite')}
                aria-pressed={baseLayer === 'satellite'}
                aria-label="Vista satelital"
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  baseLayer === 'satellite'
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <Globe className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Satélite</span>
              </button>
            </div>
          </div>

          {/* Corner Map Legend when an active trip plan is displayed */}
          {activePlan && activePlanRoute && (
            <div className="flex justify-end">
              <div
                aria-label="Leyenda del mapa"
                className="pointer-events-auto bg-white/95 backdrop-blur-md border border-neutral-200 rounded-2xl px-3 py-2 shadow-md max-w-[245px] text-[11px] text-neutral-700 space-y-1.5"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-6 border-t-[3px] border-dashed border-neutral-900 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="leading-tight font-medium text-neutral-800">
                    Caminar a parada o destino
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="w-6 h-1 rounded-full shrink-0"
                    style={{ backgroundColor: activePlanRoute.color }}
                    aria-hidden="true"
                  />
                  <span className="leading-tight font-medium text-neutral-800">
                    Ruta en buseta a tu destino
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="w-6 border-t-[3px] border-dashed shrink-0"
                    style={{ borderColor: '#db2777' }}
                    aria-hidden="true"
                  />
                  <span className="leading-tight font-medium text-neutral-800">
                    Recorrido {activePlanRoute.code} hacia tu subida
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Map Controls Toolbar (Hidden on mobile when bottom sheet is expanded so nothing collides) */}
      {!mapPickMode && !selectedBus && !activeStop && !isBottomSheetBlocking && (
        <div className="absolute bottom-20 lg:bottom-6 left-3 z-10 flex flex-wrap items-center gap-1.5 pointer-events-auto max-w-[calc(100%-4.5rem)]">
          <button
            type="button"
            onClick={onLocateUser}
            className="bg-white hover:bg-neutral-50 text-neutral-900 border border-neutral-200 shadow-md rounded-xl px-3 py-2 text-xs font-semibold flex items-center gap-1.5 transition-colors active:scale-95"
          >
            <Navigation className="w-3.5 h-3.5 text-neutral-800" aria-hidden="true" />
            <span>Mi ubicación</span>
          </button>
          {activePlan && (
            <button
              type="button"
              onClick={fitTripBounds}
              className="bg-white hover:bg-neutral-50 text-neutral-900 border border-neutral-200 shadow-md rounded-xl px-3 py-2 text-xs font-semibold flex items-center gap-1.5 transition-colors active:scale-95"
            >
              <Crosshair className="w-3.5 h-3.5 text-neutral-800" aria-hidden="true" />
              <span>Centrar viaje</span>
            </button>
          )}
          {onStartMapPick && (
            <>
              <button
                type="button"
                onClick={() => onStartMapPick('origin')}
                className="hidden sm:flex bg-white hover:bg-neutral-50 text-neutral-900 border border-neutral-200 shadow-md rounded-xl px-3 py-2 text-xs font-semibold items-center gap-1.5 transition-colors active:scale-95"
              >
                <MapPin className="w-3.5 h-3.5 text-neutral-800" aria-hidden="true" />
                <span>Partida (A)</span>
              </button>
              <button
                type="button"
                onClick={() => onStartMapPick('destination')}
                className="hidden sm:flex bg-white hover:bg-neutral-50 text-neutral-900 border border-neutral-200 shadow-md rounded-xl px-3 py-2 text-xs font-semibold items-center gap-1.5 transition-colors active:scale-95"
              >
                <MapPin className="w-3.5 h-3.5 text-neutral-800" aria-hidden="true" />
                <span>Destino (B)</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Direct Map Click Action Card (when user clicks anywhere on map without activating mode first) */}
      <AnimatePresence>
        {clickedMapCoords && !mapPickMode && onMapPointPicked && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="absolute bottom-20 lg:bottom-20 left-3 right-3 sm:left-3 sm:right-auto sm:w-80 z-30 bg-white border border-neutral-200 p-3.5 rounded-2xl shadow-xl text-neutral-900"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                <span>Punto seleccionado en el mapa</span>
              </span>
              <button
                type="button"
                aria-label="Cerrar selector de punto"
                onClick={() => setClickedMapCoords(null)}
                className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                variant="default"
                onClick={() => {
                  onMapPointPicked('origin', clickedMapCoords);
                  setClickedMapCoords(null);
                }}
              >
                <span>Partida (A)</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onMapPointPicked('destination', clickedMapCoords);
                  setClickedMapCoords(null);
                }}
              >
                <span>Destino (B)</span>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bus Stop Popup Card */}
      <AnimatePresence>
        {activeStop && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-20 lg:bottom-6 left-3 right-3 sm:left-auto sm:right-16 sm:w-80 z-20 bg-white border border-neutral-200 p-4 rounded-2xl shadow-xl text-neutral-900"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                  Parada • {activeStop.stop.municipality}
                </span>
                <h4 className="font-bold text-sm text-neutral-900 mt-0.5">
                  {activeStop.stop.name}
                </h4>
                <p className="text-xs text-neutral-500">{activeStop.stop.landmark}</p>
              </div>
              <button
                type="button"
                aria-label="Cerrar detalle de parada"
                onClick={() => setActiveStop(null)}
                className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-neutral-500 block">Próxima buseta:</span>
                <span className="text-lg font-extrabold text-neutral-900">
                  {activeStop.nextMin} min
                </span>
              </div>
              {activeStop.nextBus && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => {
                    onSelectBus(activeStop.nextBus!.id);
                    setActiveStop(null);
                  }}
                >
                  <span>Ver {activeStop.nextBus.code}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected Bus Aesthetic Uber Card (Clean Vehicle Icon + Pill Badge) */}
      <AnimatePresence>
        {selectedBus && (
          <motion.div
            key={selectedBus.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="absolute bottom-20 lg:bottom-6 left-3 right-3 sm:left-auto sm:right-16 sm:w-96 z-20 bg-white border border-neutral-200 rounded-2xl shadow-xl p-4 text-neutral-900"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-900 shrink-0">
                  <Bus className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-neutral-900 text-white text-[11px] font-bold tracking-tight">
                      {selectedBus.code}
                    </span>
                    <h3 className="font-bold text-sm text-neutral-900">
                      {selectedBus.company}
                    </h3>
                    <span className="text-[10px] font-mono bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded border border-neutral-200">
                      {selectedBus.plate}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Próxima parada: <strong className="text-neutral-800">{selectedBus.nextStopName}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Cerrar detalle de buseta"
                onClick={() => onSelectBus(null)}
                className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs text-neutral-600 mt-3 pt-3 border-t border-neutral-100">
              <div className="bg-neutral-50 rounded-lg py-1.5 px-2 border border-neutral-100">
                <span className="text-[10px] text-neutral-400 block">Velocidad</span>
                <strong className="text-neutral-900">{selectedBus.speedKmh} km/h</strong>
              </div>
              <div className="bg-neutral-50 rounded-lg py-1.5 px-2 border border-neutral-100">
                <span className="text-[10px] text-neutral-400 block">Ocupación</span>
                <strong className="text-neutral-900">{selectedBus.occupancyPercentage}%</strong>
              </div>
              <div className="bg-neutral-50 rounded-lg py-1.5 px-2 border border-neutral-100">
                <span className="text-[10px] text-neutral-400 block">Pasajeros</span>
                <strong className="text-neutral-900">
                  {selectedBus.passengerCount}/{selectedBus.capacity}
                </strong>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-neutral-100">
              {hasNfc ? (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onPayBusNfc(selectedBus, 'NFC')}
                  >
                    <Wifi className="w-3.5 h-3.5 rotate-90" />
                    <span>Pagar NFC</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPayBusNfc(selectedBus, 'QR')}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Código QR</span>
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onPayBusNfc(selectedBus, 'QR')}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Pagar con QR</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    title="NFC no disponible en computador"
                  >
                    <Lock className="w-3.5 h-3.5 text-neutral-400" />
                    <span>NFC (Solo Móvil)</span>
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
