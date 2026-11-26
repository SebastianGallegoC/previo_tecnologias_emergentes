import React from 'react';
import { TransitTicket } from '../types/transit';
import { formatCop } from '../lib/utils';
import { CheckCircle2, Share2, X } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ModalDialog } from './ui/dialog';

interface TicketModalProps {
  ticket: TransitTicket | null;
  onClose: () => void;
}

export const TicketModal: React.FC<TicketModalProps> = ({ ticket, onClose }) => {
  if (!ticket) return null;

  return (
    <ModalDialog
      isOpen={Boolean(ticket)}
      onClose={onClose}
      ariaLabel="Tiquete Digital de Abordaje"
      className="max-w-sm"
    >
      <button
        onClick={onClose}
        aria-label="Cerrar tiquete"
        className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-neutral-800 rounded-xl hover:bg-neutral-100 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Header */}
      <div className="flex flex-col items-center text-center pb-4 border-b border-dashed border-neutral-200">
        <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <Badge variant="emerald" className="mb-1">
          <span>Pase Activo • {ticket.paymentMethod}</span>
        </Badge>
        <h3 className="font-bold text-lg text-neutral-900">Tiquete Digital</h3>
        <p className="text-xs text-neutral-500">{ticket.ticketCode}</p>
      </div>

      {/* QR Code */}
      <div className="my-4 flex flex-col items-center">
        <div className="p-3 bg-neutral-900 rounded-2xl">
          <div className="grid grid-cols-4 gap-1.5 w-28 h-28 p-1">
            {Array.from({ length: 16 }).map((_, i) => (
              <div
                key={i}
                className={`rounded-xs ${
                  i % 2 === 0 || i === 0 || i === 3 || i === 12
                    ? 'bg-emerald-400'
                    : 'bg-white'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Ticket Details */}
      <div className="space-y-2 bg-neutral-50 p-3.5 rounded-xl border border-neutral-200 text-xs">
        <div className="flex justify-between gap-2">
          <span className="text-neutral-500">Ruta:</span>
          <span className="font-bold text-neutral-900 text-right">
            {ticket.routeCode} • {ticket.routeName}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">Vehículo:</span>
          <span className="font-semibold text-neutral-900">
            {ticket.busCode} ({ticket.busPlate})
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">Validez:</span>
          <span className="font-mono text-neutral-700">
            {ticket.issueDate} → {ticket.validUntil}
          </span>
        </div>
        <div className="flex justify-between pt-2 border-t border-neutral-200">
          <span className="text-neutral-700 font-bold">Tarifa:</span>
          <span className="font-bold text-emerald-700">
            {formatCop(ticket.fareCop)} COP
          </span>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => {
            if (navigator.share) {
              navigator
                .share({
                  title: 'Tiquete UberBuses',
                  text: `Pasaje digital ${ticket.ticketCode} en buseta ${ticket.busCode}`,
                  url: window.location.href,
                })
                .catch(() => {});
            } else if (navigator.clipboard) {
              navigator.clipboard.writeText(ticket.ticketCode).catch(() => {});
            }
          }}
        >
          <Share2 className="w-4 h-4" />
          <span>Compartir</span>
        </Button>
        <Button variant="default" className="flex-1" onClick={onClose}>
          <span>Listo</span>
        </Button>
      </div>
    </ModalDialog>
  );
};
