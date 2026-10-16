export type EscrowStatus =
  | 'AWAITING_ESCROW_DEPOSIT'
  | 'ESCROW_LOCKED'
  | 'BUYER_MARKED_PAID'
  | 'COMPLETED'
  | 'DISPUTED'
  | 'CANCELLED'
  | 'RESOLVED_BUYER'
  | 'RESOLVED_SELLER';

export type UserRole = 'BUYER' | 'SELLER' | 'ARBITRATOR';

export interface TransitionResult {
  allowed: boolean;
  nextStatus?: EscrowStatus;
  reason?: string;
}

export function canTransition(
  currentStatus: EscrowStatus,
  action: string,
  role: UserRole
): TransitionResult {
  switch (action) {
    case 'LOCK_ESCROW':
      if (currentStatus === 'AWAITING_ESCROW_DEPOSIT' && (role === 'SELLER' || role === 'BUYER')) {
        return { allowed: true, nextStatus: 'ESCROW_LOCKED' };
      }
      return { allowed: false, reason: 'Escrow can only be locked from initial deposit stage.' };

    case 'MARK_PAID':
      if (currentStatus === 'ESCROW_LOCKED' && role === 'BUYER') {
        return { allowed: true, nextStatus: 'BUYER_MARKED_PAID' };
      }
      return { allowed: false, reason: 'Only buyer can mark trade as paid once escrow is locked.' };

    case 'RELEASE_ESCROW':
      if ((currentStatus === 'BUYER_MARKED_PAID' || currentStatus === 'ESCROW_LOCKED') && role === 'SELLER') {
        return { allowed: true, nextStatus: 'COMPLETED' };
      }
      return { allowed: false, reason: 'Only seller can confirm receipt and release funds.' };

    case 'RAISE_DISPUTE':
      if (
        (currentStatus === 'BUYER_MARKED_PAID' || currentStatus === 'ESCROW_LOCKED') &&
        (role === 'BUYER' || role === 'SELLER')
      ) {
        return { allowed: true, nextStatus: 'DISPUTED' };
      }
      return { allowed: false, reason: 'Disputes can only be raised for active funded trades.' };

    case 'CANCEL_TRADE':
      if (currentStatus === 'AWAITING_ESCROW_DEPOSIT' || currentStatus === 'ESCROW_LOCKED') {
        return { allowed: true, nextStatus: 'CANCELLED' };
      }
      return { allowed: false, reason: 'Cannot cancel after buyer has marked payment sent without opening a dispute.' };

    case 'RESOLVE_DISPUTE_BUYER':
      if (currentStatus === 'DISPUTED' && role === 'ARBITRATOR') {
        return { allowed: true, nextStatus: 'RESOLVED_BUYER' };
      }
      return { allowed: false, reason: 'Only arbitrator can resolve dispute.' };

    case 'RESOLVE_DISPUTE_SELLER':
      if (currentStatus === 'DISPUTED' && role === 'ARBITRATOR') {
        return { allowed: true, nextStatus: 'RESOLVED_SELLER' };
      }
      return { allowed: false, reason: 'Only arbitrator can resolve dispute.' };

    default:
      return { allowed: false, reason: `Unknown escrow action: ${action}` };
  }
}

/**
 * Calculates escrow fee discount based on reputation tier
 */
export function calculateEscrowFee(amount: number, reputationTier: string): { fee: number; ratePercent: number } {
  let ratePercent = 0.5; // default 0.5%
  if (reputationTier === 'ELITE_MERCHANT') ratePercent = 0.1;
  else if (reputationTier === 'PRO_TRADER') ratePercent = 0.25;
  else if (reputationTier === 'VERIFIED') ratePercent = 0.4;
  else if (reputationTier === 'NEWCOMER') ratePercent = 0.6;

  const rawFee = (amount * ratePercent) / 100;
  const fee = Math.round(rawFee * 100) / 100;
  return { fee: Math.max(0.05, fee), ratePercent };
}

/**
 * Audit signature simulation for escrow tamper-proofing
 */
export function generateEscrowAuditHash(tradeId: string, step: string, timestamp: number): string {
  const seed = `${tradeId}-${step}-${timestamp}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `0xescrow_${hex}${timestamp.toString(16).slice(-4)}`;
}
