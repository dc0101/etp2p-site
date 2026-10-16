import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransition, calculateEscrowFee, generateEscrowAuditHash } from './escrowStateMachine.ts';
import { computeReputationScore, applyNewReview } from './reputationCalculator.ts';
import { lockFundsForEscrow, releaseEscrowToBalance, refundEscrowToAvailable, calculateTotalPortfolioUSD } from './walletEngine.ts';
import type { WalletAssetBalance } from './walletEngine.ts';

test('Escrow State Machine: transitions follow strict rules', () => {
  // Only seller/buyer can lock escrow from initial
  const lockRes = canTransition('AWAITING_ESCROW_DEPOSIT', 'LOCK_ESCROW', 'SELLER');
  assert.equal(lockRes.allowed, true);
  assert.equal(lockRes.nextStatus, 'ESCROW_LOCKED');

  // Seller cannot mark trade paid
  const sellerPaid = canTransition('ESCROW_LOCKED', 'MARK_PAID', 'SELLER');
  assert.equal(sellerPaid.allowed, false);

  // Buyer can mark trade paid
  const buyerPaid = canTransition('ESCROW_LOCKED', 'MARK_PAID', 'BUYER');
  assert.equal(buyerPaid.allowed, true);
  assert.equal(buyerPaid.nextStatus, 'BUYER_MARKED_PAID');

  // Seller releases escrow
  const releaseRes = canTransition('BUYER_MARKED_PAID', 'RELEASE_ESCROW', 'SELLER');
  assert.equal(releaseRes.allowed, true);
  assert.equal(releaseRes.nextStatus, 'COMPLETED');

  // Arbitrator dispute resolution
  const arbRes = canTransition('DISPUTED', 'RESOLVE_DISPUTE_BUYER', 'ARBITRATOR');
  assert.equal(arbRes.allowed, true);
  assert.equal(arbRes.nextStatus, 'RESOLVED_BUYER');
});

test('Escrow Fee: tiered reputation discount works', () => {
  const elite = calculateEscrowFee(1000, 'ELITE_MERCHANT');
  const newcomer = calculateEscrowFee(1000, 'NEWCOMER');
  assert.equal(elite.fee < newcomer.fee, true);
  assert.equal(elite.ratePercent, 0.1);
  assert.equal(newcomer.ratePercent, 0.6);
});

test('Escrow Audit Hash: generates tamper-evident hash string', () => {
  const hash1 = generateEscrowAuditHash('trade-101', 'FUNDS_LOCKED', 1700000000000);
  assert.equal(typeof hash1, 'string');
  assert.equal(hash1.startsWith('0xescrow_'), true);
});

test('Reputation Calculator: computes trust score and tiers accurately', () => {
  const result = computeReputationScore({
    positiveCount: 150,
    negativeCount: 1,
    totalTrades: 160,
    completionRate: 99.2,
    avgReleaseTimeMinutes: 2.1,
    disputeRate: 0.2,
  });

  assert.equal(result.tier, 'ELITE_MERCHANT');
  assert.equal(result.score >= 95, true);
  assert.equal(result.maxLimit, 100000);
});

test('Reputation Calculator: review submission updates profile dynamically', () => {
  const initial = {
    score: 85,
    tier: 'PRO_TRADER' as const,
    positiveCount: 30,
    neutralCount: 2,
    negativeCount: 1,
    totalTrades: 33,
    completionRate: 97,
    avgReleaseTimeMinutes: 4.5,
    disputeRate: 1.0,
    badges: ['ID Verified'],
    maxEscrowLimitUSD: 25000,
    trustLevelLabel: 'PRO TRADER',
  };

  const updated = applyNewReview(initial, {
    rating: 5,
    comment: 'Super fast release, genuine trader!',
    speedRating: 5,
    communicationRating: 5,
  });

  assert.equal(updated.totalTrades, 34);
  assert.equal(updated.positiveCount, 31);
  assert.equal(updated.score >= initial.score, true);
});

test('Wallet Engine: lock, release, refund, and portfolio valuation', () => {
  const initialWallet: WalletAssetBalance[] = [
    {
      asset: 'USDT',
      name: 'Tether USD',
      symbol: 'USDT',
      available: 1000,
      lockedInEscrow: 0,
      iconBg: 'emerald',
      usdRate: 1.0,
      decimals: 2,
      depositAddress: '0x71C...49b',
    },
    {
      asset: 'BTC',
      name: 'Bitcoin',
      symbol: 'BTC',
      available: 0.1,
      lockedInEscrow: 0,
      iconBg: 'amber',
      usdRate: 65000,
      decimals: 6,
      depositAddress: 'bc1q9...41a',
    },
  ];

  // Lock 500 USDT
  const lock = lockFundsForEscrow(initialWallet, 'USDT', 500);
  assert.equal(lock.success, true);
  assert.equal(lock.updatedWallet![0].available, 500);
  assert.equal(lock.updatedWallet![0].lockedInEscrow, 500);

  // Insufficient balance test
  const lockFail = lockFundsForEscrow(lock.updatedWallet!, 'USDT', 9999);
  assert.equal(lockFail.success, false);

  // Release 500 USDT (as seller)
  const release = releaseEscrowToBalance(lock.updatedWallet!, 'USDT', 500, false);
  assert.equal(release.success, true);
  assert.equal(release.updatedWallet![0].lockedInEscrow, 0);

  // Portfolio valuation
  const valuation = calculateTotalPortfolioUSD(initialWallet);
  assert.equal(valuation.totalUsd, 1000 + 0.1 * 65000);
});
