import React, { useState } from 'react';
import {
  DeviceCapabilities,
  PaymentMethodType,
  TransitTicket,
} from '../types/transit';
import {
  getIssuedTickets,
  getWalletTransactions,
  rechargeWallet,
} from '../services/walletService';
import { playRechargeChime } from '../services/soundEffects';
import { formatCop } from '../lib/utils';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  CreditCard,
  Lock,
  Plus,
  QrCode,
  Ticket,
  Wifi,
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

interface WalletViewProps {
  balance: number;
  onBalanceUpdated: () => void;
  onViewTicket: (ticket: TransitTicket) => void;
  onOpenNfcPay: (preferredMethod?: PaymentMethodType) => void;
  capabilities?: DeviceCapabilities;
}

export const WalletView: React.FC<WalletViewProps> = ({
  balance,
  onBalanceUpdated,
  onViewTicket,
  onOpenNfcPay,
  capabilities,
}) => {
  const [rechargeAmount, setRechargeAmount] = useState<number>(10000);
  const [rechargeMethod, setRechargeMethod] = useState<string>('Nequi');
  const [showRechargeSuccess, setShowRechargeSuccess] = useState(false);

  const hasNfc = capabilities?.hasEffectiveNfc ?? false;
  const transactions = getWalletTransactions();
  const tickets = getIssuedTickets();

  const handleRecharge = () => {
    rechargeWallet(rechargeAmount, rechargeMethod);
    playRechargeChime();
    onBalanceUpdated();
    setShowRechargeSuccess(true);
    setTimeout(() => setShowRechargeSuccess(false), 3000);
  };

  return (
    <div className="h-full overflow-y-auto bg-white p-4 sm:p-6 pb-24 lg:pb-8 text-neutral-900">
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <h2
            id="view-heading"
            tabIndex={-1}
            className="text-2xl font-bold tracking-tight text-neutral-900 outline-none"
          >
            Billetera CúcutaPass
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            Administra tu saldo, recarga y consulta tus tiquetes digitales.
          </p>
        </div>

        {/* Clean Minimalist Balance Card */}
        <div className="rounded-2xl p-5 bg-neutral-900 text-white shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-sm">CúcutaPass</span>
            </div>
            <span className="text-[11px] bg-white/10 px-2.5 py-0.5 rounded-full">
              {hasNfc ? 'NFC Activo' : 'Modo PC (QR)'}
            </span>
          </div>

          <div>
            <span className="text-[11px] text-neutral-400 block">Saldo disponible</span>
            <div className="text-3xl font-extrabold tracking-tight mt-0.5">
              {formatCop(balance)} <span className="text-xs font-normal text-neutral-400">COP</span>
            </div>
          </div>

          <div className="pt-2 flex gap-2">
            {hasNfc ? (
              <>
                <Button
                  variant="emerald"
                  size="sm"
                  onClick={() => onOpenNfcPay('NFC')}
                  className="flex-1"
                >
                  <Wifi className="w-3.5 h-3.5 rotate-90" />
                  <span>Pagar NFC</span>
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onOpenNfcPay('QR')}
                  className="flex-1"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Código QR</span>
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="emerald"
                  size="sm"
                  onClick={() => onOpenNfcPay('QR')}
                  className="flex-1"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Pagar con QR</span>
                </Button>
                <button
                  disabled
                  className="flex-1 px-3 py-2 rounded-lg bg-white/10 text-neutral-400 text-xs font-medium flex items-center justify-center gap-1.5 cursor-not-allowed"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>NFC (Solo Móvil)</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Clean Recharge Section */}
        <div className="border border-neutral-200 rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-neutral-900">Recargar saldo</h3>
            {showRechargeSuccess && (
              <Badge variant="emerald">
                <CheckCircle2 className="w-3 h-3" />
                <span>Recarga aplicada</span>
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[5000, 10000, 20000, 50000].map((amt) => (
              <button
                key={amt}
                onClick={() => setRechargeAmount(amt)}
                className={`py-2 rounded-xl text-xs font-bold transition-colors border ${
                  rechargeAmount === amt
                    ? 'bg-neutral-900 text-white border-neutral-900'
                    : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                }`}
              >
                ${amt / 1000}k
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {['Nequi', 'Daviplata', 'PSE', 'Tarjeta'].map((method) => (
              <button
                key={method}
                onClick={() => setRechargeMethod(method)}
                className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                  rechargeMethod === method
                    ? 'bg-emerald-50 border-emerald-600 text-emerald-900'
                    : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                {method}
              </button>
            ))}
          </div>

          <Button variant="default" onClick={handleRecharge} className="w-full">
            <Plus className="w-4 h-4" />
            <span>
              Recargar {formatCop(rechargeAmount)} con {rechargeMethod}
            </span>
          </Button>
        </div>

        {/* Issued Digital Tickets */}
        {tickets.length > 0 && (
          <div className="border border-neutral-200 rounded-2xl p-4 space-y-3">
            <h3 className="font-bold text-sm text-neutral-900 flex items-center gap-1.5">
              <Ticket className="w-4 h-4 text-emerald-600" />
              <span>Mis tiquetes ({tickets.length})</span>
            </h3>
            <div className="space-y-2">
              {tickets.slice(0, 3).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onViewTicket(t)}
                  className="w-full text-left p-3 bg-neutral-50 border border-neutral-200 hover:border-neutral-300 rounded-xl flex items-center justify-between cursor-pointer transition-colors"
                >
                  <div>
                    <span className="font-bold text-xs text-neutral-900 block">
                      {t.routeCode} • {t.routeName}
                    </span>
                    <span className="text-[11px] text-neutral-500">
                      Bus {t.busCode} • {t.issueDate} ({t.paymentMethod})
                    </span>
                  </div>
                  <span className="text-xs font-bold text-emerald-700">
                    Ver QR →
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Transactions History */}
        <div className="border border-neutral-200 rounded-2xl p-4 space-y-3">
          <h3 className="font-bold text-sm text-neutral-900">Movimientos recientes</h3>
          <div className="divide-y divide-neutral-100">
            {transactions.slice(0, 5).map((tx) => (
              <div
                key={tx.id}
                className="py-2.5 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      tx.type === 'recarga'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-neutral-100 text-neutral-700'
                    }`}
                  >
                    {tx.type === 'recarga' ? (
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div>
                    <span className="font-medium text-neutral-900 block">
                      {tx.description}
                    </span>
                    <span className="text-[10px] text-neutral-500">{tx.date}</span>
                  </div>
                </div>
                <span
                  className={`font-bold ${
                    tx.type === 'recarga' ? 'text-emerald-700' : 'text-neutral-900'
                  }`}
                >
                  {tx.type === 'recarga' ? '+' : '-'}
                  {formatCop(tx.amountCop)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
