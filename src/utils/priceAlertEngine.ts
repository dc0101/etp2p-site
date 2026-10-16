import type { SupportedAsset, Offer } from '../types/p2p.ts';

export type AlertCondition = 'LESS_THAN_OR_EQUAL' | 'GREATER_THAN_OR_EQUAL';

export interface PriceAlert {
  id: string;
  cryptoAsset: SupportedAsset;
  fiatCurrency: string;
  targetPrice: number;
  condition: AlertCondition;
  createdAt: number;
  triggered: boolean;
  triggeredAt?: number;
  triggeredOfferId?: string;
  triggeredPrice?: number;
  active: boolean;
}

/**
 * Checks all active price alerts against current marketplace offers.
 * Returns updated alerts list and a list of newly triggered alerts.
 */
export function checkPriceAlerts(
  alerts: PriceAlert[],
  offers: Offer[]
): { updatedAlerts: PriceAlert[]; newlyTriggered: PriceAlert[] } {
  const newlyTriggered: PriceAlert[] = [];

  const updatedAlerts = alerts.map((alert) => {
    if (!alert.active) return alert;

    // Find offers matching asset and fiat
    // For buying, user wants offers where maker is SELLING crypto
    const matchingOffers = offers.filter(
      (off) =>
        off.cryptoAsset === alert.cryptoAsset &&
        off.fiatCurrency === alert.fiatCurrency &&
        off.type === 'SELL'
    );

    if (matchingOffers.length === 0) return alert;

    // Find best (lowest) purchase price available
    const lowestOffer = matchingOffers.reduce((best, curr) =>
      curr.price < best.price ? curr : best
    );

    let isTriggered = false;
    if (alert.condition === 'LESS_THAN_OR_EQUAL') {
      isTriggered = lowestOffer.price <= alert.targetPrice;
    } else {
      isTriggered = lowestOffer.price >= alert.targetPrice;
    }

    if (isTriggered && !alert.triggered) {
      const triggeredAlert: PriceAlert = {
        ...alert,
        triggered: true,
        triggeredAt: Date.now(),
        triggeredOfferId: lowestOffer.id,
        triggeredPrice: lowestOffer.price,
      };
      newlyTriggered.push(triggeredAlert);
      return triggeredAlert;
    }

    return alert;
  });

  return { updatedAlerts, newlyTriggered };
}

/**
 * Creates a new price alert object
 */
export function createPriceAlert(
  cryptoAsset: SupportedAsset,
  fiatCurrency: string,
  targetPrice: number,
  condition: AlertCondition = 'LESS_THAN_OR_EQUAL'
): PriceAlert {
  return {
    id: `alt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    cryptoAsset,
    fiatCurrency,
    targetPrice,
    condition,
    createdAt: Date.now(),
    triggered: false,
    active: true,
  };
}
