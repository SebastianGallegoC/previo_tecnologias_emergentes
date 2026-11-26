import { IWalletRepository } from '../../core/contracts/repositories';
import { TransitTicket, WalletTransaction } from '../../types/transit';

const BALANCE_KEY = 'transcucuta_wallet_balance';
const TICKETS_KEY = 'transcucuta_tickets';
const TRANSACTIONS_KEY = 'transcucuta_transactions';
const DEFAULT_INITIAL_BALANCE = 35000;

/**
 * Concrete Repository implementing IWalletRepository (Dependency Inversion Principle - DIP).
 * Also implements the Observer Pattern so UI consumers stay synchronized without polling.
 */
export class LocalStorageWalletRepository implements IWalletRepository {
  private static instance: LocalStorageWalletRepository;
  private readonly listeners: Set<() => void> = new Set();

  public static getInstance(): LocalStorageWalletRepository {
    if (!LocalStorageWalletRepository.instance) {
      LocalStorageWalletRepository.instance = new LocalStorageWalletRepository();
    }
    return LocalStorageWalletRepository.instance;
  }

  public getBalance(): number {
    if (typeof window === 'undefined') return DEFAULT_INITIAL_BALANCE;
    const stored = localStorage.getItem(BALANCE_KEY);
    if (stored === null) {
      localStorage.setItem(BALANCE_KEY, DEFAULT_INITIAL_BALANCE.toString());
      return DEFAULT_INITIAL_BALANCE;
    }
    const parsed = Number(stored);
    return Number.isNaN(parsed) ? DEFAULT_INITIAL_BALANCE : parsed;
  }

  public saveBalance(newBalance: number): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(BALANCE_KEY, Math.max(0, newBalance).toString());
    this.notifyListeners();
  }

  public getTransactions(): WalletTransaction[] {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(TRANSACTIONS_KEY);
    if (!stored) {
      const initialTxs: WalletTransaction[] = [
        {
          id: 'tx-init-1',
          type: 'recarga',
          amountCop: DEFAULT_INITIAL_BALANCE,
          date:
            new Date(Date.now() - 3600000 * 4).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }) + ' Hoy',
          description: 'Recarga inicial de bienvenida CúcutaPass',
          referenceCode: 'REC-NEQUI-9281',
          paymentMethod: 'Nequi',
        },
      ];
      localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(initialTxs));
      return initialTxs;
    }
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }

  public saveTransaction(transaction: WalletTransaction): void {
    if (typeof window === 'undefined') return;
    const current = this.getTransactions();
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify([transaction, ...current]));
    this.notifyListeners();
  }

  public getTickets(): TransitTicket[] {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(TICKETS_KEY);
    if (!stored) return [];
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }

  public saveTicket(ticket: TransitTicket): void {
    if (typeof window === 'undefined') return;
    const current = this.getTickets();
    localStorage.setItem(TICKETS_KEY, JSON.stringify([ticket, ...current]));
    this.notifyListeners();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('transcucuta_wallet_update'));
    }
  }
}
