import {
  BusVehicle,
  PaymentMethodType,
  RouteInfo,
  TransitTicket,
  WalletTransaction,
} from '../../types/transit';

/**
 * Factory Method Pattern & Single Responsibility Principle (SRP):
 * Centralizes construction of TransitTicket and WalletTransaction domain objects.
 */
export class TicketFactory {
  private static resolveJurisdiction(routeId: string): string {
    if (routeId === 'R01' || routeId === 'R04') {
      return 'Área Metropolitana (Los Patios)';
    }
    if (routeId === 'R02') {
      return 'Área Metropolitana (Villa del Rosario)';
    }
    return 'Cúcuta Urbano';
  }

  public static createTransitTicket(
    bus: BusVehicle,
    route: RouteInfo | undefined,
    paymentMethod: PaymentMethodType
  ): TransitTicket {
    const now = new Date();
    const validUntilDate = new Date(now.getTime() + 60 * 60 * 1000); // 60 minutes validity
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    const ticketCode = `TK-CUC-${now.getFullYear()}-${randomSuffix}`;
    const fare = route ? route.fare : 3000;

    return {
      id: `ticket-${Date.now()}-${randomSuffix}`,
      ticketCode,
      issueDate: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      validUntil: validUntilDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      busCode: bus.code,
      busPlate: bus.plate,
      company: bus.company,
      routeCode: route ? route.code : 'R-METRO',
      routeName: route ? route.name : 'Ruta Metropolitana',
      fareCop: fare,
      municipality: this.resolveJurisdiction(bus.routeId),
      paymentMethod,
      status: 'válido',
      qrData: JSON.stringify({
        code: ticketCode,
        bus: bus.code,
        plate: bus.plate,
        method: paymentMethod,
        fare,
        ts: now.toISOString(),
      }),
    };
  }

  public static createFareTransaction(
    bus: BusVehicle,
    ticket: TransitTicket
  ): WalletTransaction {
    const now = new Date();
    return {
      id: `tx-${Date.now()}`,
      type: 'pago_pasaje',
      amountCop: ticket.fareCop,
      date: `${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} Hoy`,
      description: `Pasaje ${ticket.paymentMethod} • Buseta ${bus.code} (${bus.company})`,
      referenceCode: ticket.ticketCode,
      paymentMethod: ticket.paymentMethod,
    };
  }

  public static createRechargeTransaction(
    amountCop: number,
    method: string
  ): WalletTransaction {
    const now = new Date();
    const refNumber = Math.floor(100000 + Math.random() * 900000);
    return {
      id: `tx-${Date.now()}`,
      type: 'recarga',
      amountCop,
      date: `${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} Hoy`,
      description: `Recarga CúcutaPass vía ${method}`,
      referenceCode: `REC-${refNumber}`,
      paymentMethod: method,
    };
  }
}
