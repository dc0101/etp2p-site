import test from 'node:test';
import assert from 'node:assert/strict';
import { generate30DayTradeHistory, compute30DayTradeStats } from './tradeHistoryChartData.ts';

test('Trade History Data: generates exactly 30 days of trading data', () => {
  const data = generate30DayTradeHistory(146);
  assert.equal(data.length, 30);
  assert.equal(data[0].dayIndex, 1);
  assert.equal(data[29].dayIndex, 30);
  assert.equal(typeof data[0].date, 'string');
  assert.equal(data[29].cumulativeTrades > data[0].cumulativeTrades, true);
});

test('Trade History Stats: computes 30-day volume and averages accurately', () => {
  const data = generate30DayTradeHistory(146);
  const stats = compute30DayTradeStats(data);

  assert.equal(stats.totalTrades > 0, true);
  assert.equal(stats.totalVolumeUSD > 50000, true);
  assert.equal(stats.avgTradesPerDay > 0, true);
  assert.equal(stats.peakDayTrades >= stats.avgTradesPerDay, true);
  assert.equal(typeof stats.peakDayDate, 'string');
});
