export type Municipality = 'Cúcuta' | 'Los Patios' | 'Villa del Rosario';

export type AppTabId = 'mapa' | 'planear' | 'nfc' | 'billetera' | 'rutas' | 'conductor' | 'admin';

export type UserRole = 'pasajero' | 'conductor' | 'administrador';

export type PaymentMethodType = 'NFC' | 'QR' | 'Saldo Billetera';

export type DeviceFormFactor = 'mobile' | 'tablet' | 'desktop';

export type MapPickMode = 'origin' | 'destination' | null;

export type MapBaseLayer = 'streets' | 'satellite';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface TripEndpoint {
  name: string;
  coordinates: Coordinates;
  isCustomMapPoint?: boolean;
  isCurrentLocation?: boolean;
  landmarkIndex?: number;
}

export interface Landmark {
  name: string;
  municipality: Municipality;
  lat: number;
  lng: number;
}

export interface BusStop {
  id: string;
  name: string;
  landmark: string;
  municipality: Municipality;
  coordinates: Coordinates;
  routes: string[];
}

export interface RouteInfo {
  id: string;
  code: string;
  name: string;
  company: string;
  color: string;
  fare: number;
  description: string;
  directionA: string;
  directionB: string;
  schedule: string;
  frequencyMinutes: number;
  stops: BusStop[];
  waypoints: Coordinates[];
}

export interface BusVehicle {
  id: string;
  code: string;
  plate: string;
  company: string;
  routeId: string;
  driverName: string;
  coordinates: Coordinates;
  heading: number;
  speedKmh: number;
  capacity: number;
  passengerCount: number;
  occupancyPercentage: number;
  status: 'en_ruta' | 'en_parada' | 'despacho' | 'congestión';
  nextStopName: string;
  currentWaypointIndex: number;
  direction: 'ida' | 'vuelta';
  lastUpdated: string;
}

export interface TripLeg {
  instruction: string;
  detail?: string;
  type: 'walk' | 'bus' | 'transfer';
  routeId?: string;
  routeCode?: string;
  routeName?: string;
  company?: string;
  fromName: string;
  toName: string;
  distanceMeters: number;
  durationMinutes: number;
  color?: string;
}

export interface TripPlanResult {
  id: string;
  title: string;
  tag: 'Más Rápido' | 'Menos Caminata' | 'Con Transbordo';
  totalDurationMinutes: number;
  totalDistanceKm: number;
  totalFareCop: number;
  transfersCount: number;
  nextBusInMinutes: number;
  recommendedBusCode?: string;
  boardingStop: BusStop;
  alightingStop: BusStop;
  transferStop?: BusStop;
  walkToBoardingMeters: number;
  walkToBoardingMinutes: number;
  walkFromAlightingMeters: number;
  walkFromAlightingMinutes: number;
  legs: TripLeg[];
}

export interface TransitTicket {
  id: string;
  ticketCode: string;
  issueDate: string;
  validUntil: string;
  busCode: string;
  busPlate: string;
  company: string;
  routeCode: string;
  routeName: string;
  fareCop: number;
  municipality: string;
  paymentMethod: PaymentMethodType;
  status: 'válido' | 'usado' | 'vencido';
  qrData: string;
}

export interface WalletTransaction {
  id: string;
  type: 'pago_pasaje' | 'recarga';
  amountCop: number;
  date: string;
  description: string;
  referenceCode: string;
  paymentMethod?: string;
}

export interface TrafficAlert {
  id: string;
  location: string;
  municipality: Municipality;
  severity: 'moderado' | 'alto' | 'desvío';
  description: string;
  timestamp: string;
}

export interface DeviceCapabilities {
  formFactor: DeviceFormFactor;
  hasNativeNfc: boolean;
  hasEffectiveNfc: boolean;
  isSimulatedNfcMode: boolean;
  hasGeolocation: boolean;
  hasHaptics: boolean;
  hasTouchScreen: boolean;
  hasWebShare: boolean;
  hasAudioSynthesizer: boolean;
  platformLabel: string;
  nfcRestrictionReason: string | null;
}
