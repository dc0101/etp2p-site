export type ReputationTier = 'ELITE_MERCHANT' | 'PRO_TRADER' | 'VERIFIED' | 'NEWCOMER';

export interface ReputationProfile {
  score: number; // 0 - 100
  tier: ReputationTier;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
  totalTrades: number;
  completionRate: number; // percentage 0 - 100
  avgReleaseTimeMinutes: number;
  disputeRate: number; // percentage
  badges: string[];
  maxEscrowLimitUSD: number;
  trustLevelLabel: string;
}

export interface ReviewSubmission {
  rating: number; // 1 to 5
  comment: string;
  speedRating: number; // 1 to 5
  communicationRating: number; // 1 to 5
}

export function computeReputationScore(profile: {
  positiveCount: number;
  negativeCount: number;
  totalTrades: number;
  completionRate: number;
  avgReleaseTimeMinutes: number;
  disputeRate: number;
}): { score: number; tier: ReputationTier; badges: string[]; maxLimit: number } {
  if (profile.totalTrades === 0) {
    return {
      score: 75,
      tier: 'NEWCOMER',
      badges: ['New Trader', 'KYC Pending'],
      maxLimit: 1000,
    };
  }

  const feedbackTotal = profile.positiveCount + profile.negativeCount;
  const positiveRatio = feedbackTotal > 0 ? (profile.positiveCount / feedbackTotal) * 100 : 90;

  // Weighted calculation:
  // 40% positive feedback ratio
  // 30% completion rate
  // 15% speed of release (shorter is better, <= 5 min is 100, 30 min is 50, >60 min is 20)
  // 15% trade volume factor
  let speedScore = 100;
  if (profile.avgReleaseTimeMinutes <= 3) speedScore = 100;
  else if (profile.avgReleaseTimeMinutes <= 10) speedScore = 90;
  else if (profile.avgReleaseTimeMinutes <= 25) speedScore = 75;
  else speedScore = 50;

  const volumeScore = Math.min(100, 50 + profile.totalTrades * 0.5);

  let rawScore =
    positiveRatio * 0.4 +
    profile.completionRate * 0.3 +
    speedScore * 0.15 +
    volumeScore * 0.15;

  // Dispute penalty: subtract 5 points for every 1% dispute rate
  rawScore -= profile.disputeRate * 5;

  const finalScore = Math.max(10, Math.min(100, Math.round(rawScore * 10) / 10));

  let tier: ReputationTier = 'NEWCOMER';
  let maxLimit = 2500;
  const badges: string[] = ['ID Verified'];

  if (finalScore >= 95 && profile.totalTrades >= 50 && profile.completionRate >= 98) {
    tier = 'ELITE_MERCHANT';
    maxLimit = 100000;
    badges.push('Elite Merchant', 'Escrow Bond Staked ($25k)', 'Lightning Fast Release (<3m)');
  } else if (finalScore >= 88 && profile.totalTrades >= 20) {
    tier = 'PRO_TRADER';
    maxLimit = 25000;
    badges.push('Pro Trader', 'High Reliability', 'Fast Payer');
  } else if (finalScore >= 75) {
    tier = 'VERIFIED';
    maxLimit = 10000;
    badges.push('Verified Trader', 'Standard Escrow');
  } else {
    tier = 'NEWCOMER';
    maxLimit = 2000;
    badges.push('Restricted Limit', 'Escrow Hold Required');
  }

  return {
    score: finalScore,
    tier,
    badges,
    maxLimit,
  };
}

export function applyNewReview(
  current: ReputationProfile,
  review: ReviewSubmission
): ReputationProfile {
  const isPositive = review.rating >= 4;
  const isNegative = review.rating <= 2;

  const newPos = current.positiveCount + (isPositive ? 1 : 0);
  const newNeg = current.negativeCount + (isNegative ? 1 : 0);
  const newNeut = current.neutralCount + (review.rating === 3 ? 1 : 0);
  const newTrades = current.totalTrades + 1;

  // Slight speed time adjustment based on speedRating (1-5)
  const adjustedRelease = Math.max(
    1.2,
    Math.round((current.avgReleaseTimeMinutes * 0.85 + (6 - review.speedRating) * 0.7) * 10) / 10
  );

  const { score, tier, badges, maxLimit } = computeReputationScore({
    positiveCount: newPos,
    negativeCount: newNeg,
    totalTrades: newTrades,
    completionRate: Math.min(100, Math.max(90, current.completionRate + 0.1)),
    avgReleaseTimeMinutes: adjustedRelease,
    disputeRate: Math.max(0, current.disputeRate * 0.95),
  });

  return {
    ...current,
    score,
    tier,
    positiveCount: newPos,
    negativeCount: newNeg,
    neutralCount: newNeut,
    totalTrades: newTrades,
    avgReleaseTimeMinutes: adjustedRelease,
    badges,
    maxEscrowLimitUSD: maxLimit,
    trustLevelLabel: tier.replace('_', ' '),
  };
}
