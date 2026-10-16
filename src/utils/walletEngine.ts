export type SupportedAsset = 'USDT' | 'USDC' | 'BTC' | 'ETH' | 'USD' | 'EUR';

export interface WalletAssetBalance {
  asset: SupportedAsset;
  name: string;
  symbol: string;
  available: number;
  lockedInEscrow: number;
  iconBg: string;
  usdRate: number;
  decimals: number;
  chainNetwork?: string;
  depositAddress: string;
}

export interface WalletLedgerItem {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'ESCROW_LOCK' | 'ESCROW_RELEASE' | 'ESCROW_REFUND' | 'FEE';
  asset: SupportedAsset;
  amount: number;
  timestamp: number;
  status: 'CONFIRMED' | 'PROCESSING' | 'CANCELLED';
  txHash: string;
  details: string;
  referenceTradeId?: string;
}

export function lockFundsForEscrow(
  wallet: WalletAssetBalance[],
  asset: SupportedAsset,
  amount: number
): { success: boolean; updatedWallet?: WalletAssetBalance[]; error?: string } {
  const targetIndex = wallet.findIndex((w) => w.asset === asset);
  if (targetIndex === -1) {
    return { success: false, error: `Asset ${asset} not found in user wallet.` };
  }

  const current = wallet[targetIndex];
  if (current.available < amount) {
    return {
      success: false,
      error: `Insufficient available funds. Required: ${amount} ${asset}, Available: ${current.available.toFixed(4)} ${asset}.`,
    };
  }

  const updatedWallet = [...wallet];
  updatedWallet[targetIndex] = {
    ...current,
    available: Math.round((current.available - amount) * 1000000) / 1000000,
    lockedInEscrow: Math.round((current.lockedInEscrow + amount) * 1000000) / 1000000,
  };

  return { success: true, updatedWallet };
}

export function releaseEscrowToBalance(
  wallet: WalletAssetBalance[],
  asset: SupportedAsset,
  amount: number,
  isRecipientBuyer: boolean
): { success: boolean; updatedWallet?: WalletAssetBalance[]; error?: string } {
  const targetIndex = wallet.findIndex((w) => w.asset === asset);
  if (targetIndex === -1) {
    return { success: false, error: `Asset ${asset} not found in user wallet.` };
  }

  const current = wallet[targetIndex];
  const updatedWallet = [...wallet];

  if (isRecipientBuyer) {
    // If the local user is buyer receiving funds
    updatedWallet[targetIndex] = {
      ...current,
      available: Math.round((current.available + amount) * 1000000) / 1000000,
    };
  } else {
    // If local user was seller releasing funds that were locked
    if (current.lockedInEscrow < amount) {
      return { success: false, error: 'Escrow lock balance is less than release amount.' };
    }
    updatedWallet[targetIndex] = {
      ...current,
      lockedInEscrow: Math.max(0, Math.round((current.lockedInEscrow - amount) * 1000000) / 1000000),
    };
  }

  return { success: true, updatedWallet };
}

export function refundEscrowToAvailable(
  wallet: WalletAssetBalance[],
  asset: SupportedAsset,
  amount: number
): { success: boolean; updatedWallet?: WalletAssetBalance[]; error?: string } {
  const targetIndex = wallet.findIndex((w) => w.asset === asset);
  if (targetIndex === -1) {
    return { success: false, error: `Asset ${asset} not found in wallet.` };
  }

  const current = wallet[targetIndex];
  const deductLock = Math.min(current.lockedInEscrow, amount);

  const updatedWallet = [...wallet];
  updatedWallet[targetIndex] = {
    ...current,
    lockedInEscrow: Math.max(0, Math.round((current.lockedInEscrow - deductLock) * 1000000) / 1000000),
    available: Math.round((current.available + deductLock) * 1000000) / 1000000,
  };

  return { success: true, updatedWallet };
}

export function calculateTotalPortfolioUSD(wallet: WalletAssetBalance[]): {
  totalUsd: number;
  availableUsd: number;
  lockedUsd: number;
} {
  let totalUsd = 0;
  let availableUsd = 0;
  let lockedUsd = 0;

  for (const item of wallet) {
    const itemAvailUsd = item.available * item.usdRate;
    const itemLockedUsd = item.lockedInEscrow * item.usdRate;
    availableUsd += itemAvailUsd;
    lockedUsd += itemLockedUsd;
    totalUsd += itemAvailUsd + itemLockedUsd;
  }

  return {
    totalUsd: Math.round(totalUsd * 100) / 100,
    availableUsd: Math.round(availableUsd * 100) / 100,
    lockedUsd: Math.round(lockedUsd * 100) / 100,
  };
}
