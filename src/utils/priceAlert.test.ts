import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPriceAlerts, createPriceAlert } from './priceAlertEngine.ts';
import type { PriceAlert } from './priceAlertEngine.ts';
import type { Offer } from '../types/p2p.ts';

test('Price Alert Engine: triggers when market price drops to or below target', () => {
  const alert = createPriceAlert('USDT', 'USD', 1.000, 'LESS_THAN_OR_EQUAL');

  const offers: Offer[] = [
    {
      id: 'off_high',
      type: 'SELL',
      cryptoAsset: 'USDT',
      fiatCurrency: 'USD',
      price: 1.005,
      marginPercent: 0.5,
      minLimitFiat: 100,
      maxLimitFiat: 1000,
      paymentMethods: ['Zelle'],
      creator: {} as any,
      terms: '',
    },
  ];

  // Price is 1.005, target is 1.000 -> not triggered
  const check1 = checkPriceAlerts([alert], offers);
  assert.equal(check1.newlyTriggered.length, 0);
  assert.equal(check1.updatedAlerts[0].triggered, false);

  // New offer arrives at 0.999 -> triggers!
  const offersWithDip: Offer[] = [
    ...offers,
    {
      id: 'off_cheap',
      type: 'SELL',
      cryptoAsset: 'USDT',
      fiatCurrency: 'USD',
      price: 0.999,
      marginPercent: -0.1,
      minLimitFiat: 50,
      maxLimitFiat: 2000,
      paymentMethods: ['Bank Transfer'],
      creator: {} as any,
      terms: '',
    },
  ];

  const check2 = checkPriceAlerts([alert], offersWithDip);
  assert.equal(check2.newlyTriggered.length, 1);
  assert.equal(check2.updatedAlerts[0].triggered, true);
  assert.equal(check2.updatedAlerts[0].triggeredOfferId, 'off_cheap');
  assert.equal(check2.updatedAlerts[0].triggeredPrice, 0.999);
});

test('Price Alert Engine: does not trigger inactive alerts', () => {
  const inactiveAlert: PriceAlert = {
    id: 'alt_off',
    cryptoAsset: 'BTC',
    fiatCurrency: 'USD',
    targetPrice: 70000,
    condition: 'LESS_THAN_OR_EQUAL',
    createdAt: Date.now(),
    triggered: false,
    active: false, // deactivated by user
  };

  const offers: Offer[] = [
    {
      id: 'off_btc',
      type: 'SELL',
      cryptoAsset: 'BTC',
      fiatCurrency: 'USD',
      price: 65000,
      marginPercent: -1,
      minLimitFiat: 100,
      maxLimitFiat: 1000,
      paymentMethods: ['Zelle'],
      creator: {} as any,
      terms: '',
    },
  ];

  const check = checkPriceAlerts([inactiveAlert], offers);
  assert.equal(check.newlyTriggered.length, 0);
  assert.equal(check.updatedAlerts[0].triggered, false);
});
