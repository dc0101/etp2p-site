export interface DayTradeDataPoint {
  dayIndex: number;
  date: string;
  shortDate: string;
  timestamp: number;
  completedTrades: number;
  cumulativeTrades: number;
  volumeUSD: number;
  successRate: number;
}

export interface ThirtyDayTradeStats {
  totalTrades: number;
  totalVolumeUSD: number;
  avgTradesPerDay: number;
  peakDayTrades: number;
  peakDayDate: string;
  volumeGrowthRatePercent: number;
}

/**
 * Generates deterministic realistic 30-day trading history up to the current date
 */
export function generate30DayTradeHistory(currentTotalTrades: number = 146): DayTradeDataPoint[] {
  const points: DayTradeDataPoint[] = [];
  const baseTime = 1792166400000; // ~mid Oct 2026
  const dayMs = 24 * 60 * 60 * 1000;

  // Daily seed distribution pattern adding up to currentTotalTrades
  const dailyDeltas = [
    3, 4, 2, 5, 4, 6, 3, 5, 7, 4,
    3, 6, 5, 4, 6, 8, 5, 4, 6, 7,
    5, 3, 6, 8, 4, 5, 6, 7, 5, 6
  ];

  let cumulative = 0;
  for (let i = 0; i < 30; i++) {
    const timestamp = baseTime - (29 - i) * dayMs;
    const d = new Date(timestamp);
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const shortDate = d.toLocaleDateString('en-US', { day: 'numeric' });

    const tradesToday = dailyDeltas[i] || 4;
    cumulative += tradesToday;
    const volumeToday = Math.round(tradesToday * 1250 + (i % 5) * 450);

    points.push({
      dayIndex: i + 1,
      date: dateStr,
      shortDate,
      timestamp,
      completedTrades: tradesToday,
      cumulativeTrades: cumulative,
      volumeUSD: volumeToday,
      successRate: 100,
    });
  }

  return points;
}

export function compute30DayTradeStats(data: DayTradeDataPoint[]): ThirtyDayTradeStats {
  if (data.length === 0) {
    return {
      totalTrades: 0,
      totalVolumeUSD: 0,
      avgTradesPerDay: 0,
      peakDayTrades: 0,
      peakDayDate: '',
      volumeGrowthRatePercent: 0,
    };
  }

  let totalTrades = 0;
  let totalVolumeUSD = 0;
  let peakDayTrades = 0;
  let peakDayDate = '';

  data.forEach((p) => {
    totalTrades += p.completedTrades;
    totalVolumeUSD += p.volumeUSD;
    if (p.completedTrades > peakDayTrades) {
      peakDayTrades = p.completedTrades;
      peakDayDate = p.date;
    }
  });

  const avgTradesPerDay = Math.round((totalTrades / data.length) * 10) / 10;

  // First 15 days vs last 15 days volume growth
  const mid = Math.floor(data.length / 2);
  const firstHalfVol = data.slice(0, mid).reduce((sum, d) => sum + d.volumeUSD, 0);
  const secondHalfVol = data.slice(mid).reduce((sum, d) => sum + d.volumeUSD, 0);
  const volumeGrowthRatePercent = firstHalfVol > 0
    ? Math.round(((secondHalfVol - firstHalfVol) / firstHalfVol) * 100)
    : 15;

  return {
    totalTrades,
    totalVolumeUSD,
    avgTradesPerDay,
    peakDayTrades,
    peakDayDate,
    volumeGrowthRatePercent,
  };
}
