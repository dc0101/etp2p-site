import type { EscrowStatus, UserRole } from '../utils/escrowStateMachine.ts';
import type { ReputationProfile } from '../utils/reputationCalculator.ts';
import type { SupportedAsset, WalletAssetBalance, WalletLedgerItem } from '../utils/walletEngine.ts';

export type { EscrowStatus, UserRole, SupportedAsset, WalletAssetBalance, WalletLedgerItem, ReputationProfile };

export interface PaymentMethodDetail {
  id: string;
  name: string;
  type: 'BANK_TRANSFER' | 'REVOLUT' | 'ZELLE' | 'WISE' | 'PAYPAL' | 'SEPA' | 'CRYPTO';
  accountName: string;
  accountNumberOrEmail: string;
  bankName?: string;
  instructions: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'BUYER' | 'SELLER' | 'SYSTEM' | 'ARBITRATOR';
  text: string;
  timestamp: number;
  isSystem?: boolean;
  receiptImage?: string;
}

export interface TimelineEvent {
  id: string;
  title: string;
  description: string;
  timestamp: number;
  txHash: string;
  actor: string;
  status: 'PENDING' | 'SUCCESS' | 'ALERT';
}

export interface Trade {
  id: string;
  offerId?: string;
  type: 'BUY' | 'SELL'; // from perspective of the active user
  cryptoAsset: SupportedAsset;
  cryptoAmount: number;
  fiatCurrency: string;
  fiatAmount: number;
  unitPrice: number;
  paymentMethod: PaymentMethodDetail;
  seller: ReputationProfile & { id: string; name: string; avatar: string; email: string };
  buyer: ReputationProfile & { id: string; name: string; avatar: string; email: string };
  status: EscrowStatus;
  createdAt: number;
  escrowLockedAt?: number;
  buyerPaidAt?: number;
  completedAt?: number;
  expiresAt: number; // timestamp when payment window closes
  escrowFee: number;
  escrowFeeRate: number;
  paymentReference?: string;
  paymentReceiptImage?: string;
  chatMessages: ChatMessage[];
  timeline: TimelineEvent[];
  dispute?: {
    filedBy: string;
    filedAt: number;
    reason: string;
    evidenceNotes: string;
    status: 'IN_REVIEW' | 'RESOLVED_BUYER' | 'RESOLVED_SELLER';
    arbitratorNotes?: string;
  };
  reviewSubmitted?: boolean;
}

export interface Offer {
  id: string;
  type: 'BUY' | 'SELL';
  cryptoAsset: SupportedAsset;
  fiatCurrency: string;
  price: number;
  marginPercent: number;
  minLimitFiat: number;
  maxLimitFiat: number;
  paymentMethods: string[];
  creator: ReputationProfile & { id: string; name: string; avatar: string; email: string };
  terms: string;
  autoReplyMessage?: string;
  requiresMinReputation?: number;
}
