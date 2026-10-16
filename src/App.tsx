import React, { useState } from 'react';
import { Navbar } from './components/Navbar.tsx';
import { MarketplaceView } from './components/MarketplaceView.tsx';
import { EscrowTracker } from './components/EscrowTracker.tsx';
import { WalletView } from './components/WalletView.tsx';
import { ReputationView } from './components/ReputationView.tsx';
import { DisputeDesk } from './components/DisputeDesk.tsx';
import { ReviewModal } from './components/ReviewModal.tsx';

import { 
  INITIAL_USER, 
  INITIAL_WALLET, 
  INITIAL_LEDGER, 
  INITIAL_OFFERS, 
  INITIAL_ACTIVE_TRADE, 
  COUNTERPART_ELENA, 
  COUNTERPART_MARCUS, 
  COUNTERPART_SOFIA,
  UserProfileWithIdentity
} from './data/mockData.ts';
import { Offer, Trade, UserRole, SupportedAsset } from './types/p2p.ts';
import { 
  lockFundsForEscrow, 
  releaseEscrowToBalance, 
  refundEscrowToAvailable, 
  calculateTotalPortfolioUSD 
} from './utils/walletEngine.ts';
import { generateEscrowAuditHash, calculateEscrowFee } from './utils/escrowStateMachine.ts';
import { applyNewReview, ReviewSubmission } from './utils/reputationCalculator.ts';
import { PriceAlert, AlertCondition, checkPriceAlerts, createPriceAlert } from './utils/priceAlertEngine.ts';

export default function App() {
  const [activeTab, setActiveTab] = useState<'MARKETPLACE' | 'ESCROW_TRACKER' | 'WALLET' | 'REPUTATION' | 'DISPUTES'>('ESCROW_TRACKER');
  const [activeRole, setActiveRole] = useState<UserRole>('BUYER');
  const [wallet, setWallet] = useState(INITIAL_WALLET);
  const [ledger, setLedger] = useState(INITIAL_LEDGER);
  const [offers, setOffers] = useState<Offer[]>(INITIAL_OFFERS);
  const [activeTrade, setActiveTrade] = useState<Trade | null>(INITIAL_ACTIVE_TRADE);
  const [userProfile, setUserProfile] = useState<UserProfileWithIdentity>(INITIAL_USER);
  const [counterpartElena, setCounterpartElena] = useState<UserProfileWithIdentity>(COUNTERPART_ELENA);
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);
  const [alerts, setAlerts] = useState<PriceAlert[]>([
    {
      id: 'alt_seed_01',
      cryptoAsset: 'USDT',
      fiatCurrency: 'USD',
      targetPrice: 1.000,
      condition: 'LESS_THAN_OR_EQUAL',
      createdAt: Date.now() - 1000 * 60 * 60,
      triggered: false,
      active: true,
    },
    {
      id: 'alt_seed_02',
      cryptoAsset: 'BTC',
      fiatCurrency: 'USD',
      targetPrice: 66000,
      condition: 'LESS_THAN_OR_EQUAL',
      createdAt: Date.now() - 1000 * 60 * 120,
      triggered: false,
      active: true,
    },
  ]);

  const handleAddAlert = (asset: SupportedAsset, targetPrice: number, condition: AlertCondition) => {
    const newAlert = createPriceAlert(asset, 'USD', targetPrice, condition);
    const updated = [newAlert, ...alerts];
    const { updatedAlerts } = checkPriceAlerts(updated, offers);
    setAlerts(updatedAlerts);
  };

  const handleToggleAlert = (alertId: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, active: !a.active } : a))
    );
  };

  const handleDeleteAlert = (alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  };

  const handleSimulatePriceDip = (asset: SupportedAsset, dipPrice: number) => {
    const updatedOffers = offers.map((off) => {
      if (off.cryptoAsset === asset && off.type === 'SELL') {
        return { ...off, price: dipPrice };
      }
      return off;
    });
    setOffers(updatedOffers);
    const { updatedAlerts } = checkPriceAlerts(alerts, updatedOffers);
    setAlerts(updatedAlerts);
  };

  // Portfolio calculations
  const portfolioSummary = calculateTotalPortfolioUSD(wallet);

  // Handle deposit into vault
  const handleDeposit = (asset: SupportedAsset, amount: number) => {
    const updated = wallet.map((w) => {
      if (w.asset === asset) {
        return { ...w, available: Math.round((w.available + amount) * 1000) / 1000 };
      }
      return w;
    });
    setWallet(updated);

    const newLedgerItem = {
      id: `tx_${Date.now()}`,
      type: 'DEPOSIT' as const,
      asset,
      amount,
      timestamp: Date.now(),
      status: 'CONFIRMED' as const,
      txHash: `0xdep_${Math.random().toString(16).slice(2, 12)}`,
      details: `Direct deposit to vault address (${asset})`,
    };
    setLedger([newLedgerItem, ...ledger]);
  };

  // Handle withdraw from vault
  const handleWithdraw = (asset: SupportedAsset, amount: number, address: string): boolean => {
    const target = wallet.find((w) => w.asset === asset);
    if (!target || target.available < amount) return false;

    const updated = wallet.map((w) => {
      if (w.asset === asset) {
        return { ...w, available: Math.round((w.available - amount) * 1000) / 1000 };
      }
      return w;
    });
    setWallet(updated);

    const newLedgerItem = {
      id: `tx_${Date.now()}`,
      type: 'WITHDRAWAL' as const,
      asset,
      amount,
      timestamp: Date.now(),
      status: 'CONFIRMED' as const,
      txHash: `0xwd_${Math.random().toString(16).slice(2, 12)}`,
      details: `External withdrawal to ${address.slice(0, 10)}... (2FA authorized)`,
    };
    setLedger([newLedgerItem, ...ledger]);
    return true;
  };

  // Handle initiate trade from marketplace
  const handleInitiateTrade = (offer: Offer, fiatAmount: number) => {
    const cryptoAmount = Math.round((fiatAmount / offer.price) * 1000) / 1000;
    const feeInfo = calculateEscrowFee(fiatAmount, userProfile.tier);

    // If active user is SELLING, check that they have enough available balance to lock in escrow
    if (offer.type === 'BUY') {
      const lockRes = lockFundsForEscrow(wallet, offer.cryptoAsset, cryptoAmount);
      if (!lockRes.success) {
        alert(lockRes.error);
        return;
      }
      if (lockRes.updatedWallet) {
        setWallet(lockRes.updatedWallet);
      }
    }

    const tradeId = `TRD-${Math.floor(10000 + Math.random() * 90000)}`;
    const txHash = generateEscrowAuditHash(tradeId, 'ESCROW_LOCK', Date.now());

    const newTrade: Trade = {
      id: tradeId,
      offerId: offer.id,
      type: offer.type === 'SELL' ? 'BUY' : 'SELL',
      cryptoAsset: offer.cryptoAsset,
      cryptoAmount,
      fiatCurrency: offer.fiatCurrency,
      fiatAmount,
      unitPrice: offer.price,
      paymentMethod: {
        id: 'pm_01',
        name: offer.paymentMethods[0] || 'Bank Transfer',
        type: 'BANK_TRANSFER',
        accountName: offer.creator.name,
        accountNumberOrEmail: offer.creator.email,
        instructions: `Transfer $${fiatAmount} via ${offer.paymentMethods[0]}. Include memo ${tradeId}.`,
      },
      seller: offer.type === 'SELL' ? { ...offer.creator } : { ...userProfile },
      buyer: offer.type === 'SELL' ? { ...userProfile } : { ...offer.creator },
      status: 'ESCROW_LOCKED',
      createdAt: Date.now(),
      escrowLockedAt: Date.now(),
      expiresAt: Date.now() + 1000 * 60 * 30, // 30 mins window
      escrowFee: feeInfo.fee,
      escrowFeeRate: feeInfo.ratePercent,
      chatMessages: [
        {
          id: `msg_${Date.now()}_1`,
          senderId: 'SYSTEM',
          senderName: 'TrustPeer Escrow Protocol',
          senderRole: 'SYSTEM',
          text: `🔒 Trade ${tradeId} initiated. ${cryptoAmount} ${offer.cryptoAsset} is securely locked in smart escrow contract (${txHash}). Seller cannot retrieve funds until payment is settled or arbitrated.`,
          timestamp: Date.now(),
          isSystem: true,
        },
        {
          id: `msg_${Date.now()}_2`,
          senderId: offer.creator.id,
          senderName: offer.creator.name,
          senderRole: 'SELLER',
          text: offer.autoReplyMessage || 'Hello! Escrow is locked. Please send payment and provide reference.',
          timestamp: Date.now() + 500,
        },
      ],
      timeline: [
        {
          id: `tl_${Date.now()}_1`,
          title: 'Trade Created',
          description: `Order opened for ${cryptoAmount} ${offer.cryptoAsset} at $${offer.price}`,
          timestamp: Date.now(),
          txHash: `0xinit_${Math.random().toString(16).slice(2, 8)}`,
          actor: 'System',
          status: 'SUCCESS',
        },
        {
          id: `tl_${Date.now()}_2`,
          title: 'Escrow Locked in Vault',
          description: `${cryptoAmount} ${offer.cryptoAsset} held in TrustPeer Smart Contract Escrow.`,
          timestamp: Date.now(),
          txHash,
          actor: 'Escrow Protocol',
          status: 'SUCCESS',
        },
      ],
    };

    setActiveTrade(newTrade);
    setActiveTab('ESCROW_TRACKER');
  };

  // Buyer marks paid
  const handleMarkPaid = (tradeId: string, reference: string, receiptUrl?: string) => {
    if (!activeTrade || activeTrade.id !== tradeId) return;

    const txHash = generateEscrowAuditHash(tradeId, 'PAYMENT_MARKED', Date.now());

    const updatedTrade: Trade = {
      ...activeTrade,
      status: 'BUYER_MARKED_PAID',
      buyerPaidAt: Date.now(),
      paymentReference: reference,
      paymentReceiptImage: receiptUrl,
      chatMessages: [
        ...activeTrade.chatMessages,
        {
          id: `msg_${Date.now()}_pay`,
          senderId: activeTrade.buyer.id,
          senderName: activeTrade.buyer.name,
          senderRole: 'BUYER',
          text: `I have transferred $${activeTrade.fiatAmount.toFixed(2)} via ${activeTrade.paymentMethod.name}. Reference: ${reference}`,
          timestamp: Date.now(),
          receiptImage: receiptUrl,
        },
        {
          id: `msg_${Date.now()}_sys_pay`,
          senderId: 'SYSTEM',
          senderName: 'TrustPeer Escrow Protocol',
          senderRole: 'SYSTEM',
          text: `⚡ Buyer marked payment as sent (Ref: ${reference}). Auto-cancel disabled. Seller is requested to confirm receipt.`,
          timestamp: Date.now(),
          isSystem: true,
        },
      ],
      timeline: [
        ...activeTrade.timeline,
        {
          id: `tl_${Date.now()}_pay`,
          title: 'Payment Sent by Buyer',
          description: `Transferred $${activeTrade.fiatAmount} via ${activeTrade.paymentMethod.name}. Ref: ${reference}`,
          timestamp: Date.now(),
          txHash,
          actor: `${activeTrade.buyer.name} (Buyer)`,
          status: 'SUCCESS',
        },
      ],
    };

    setActiveTrade(updatedTrade);
  };

  // Seller releases escrow
  const handleReleaseEscrow = (tradeId: string) => {
    if (!activeTrade || activeTrade.id !== tradeId) return;

    const txHash = generateEscrowAuditHash(tradeId, 'ESCROW_RELEASED', Date.now());

    // Update wallet: credit buyer balance
    const updatedWallet = releaseEscrowToBalance(
      wallet,
      activeTrade.cryptoAsset,
      activeTrade.cryptoAmount,
      true // credit available balance
    );
    if (updatedWallet.success && updatedWallet.updatedWallet) {
      setWallet(updatedWallet.updatedWallet);
    }

    // Add ledger item
    const newLedgerItem = {
      id: `tx_${Date.now()}`,
      type: 'ESCROW_RELEASE' as const,
      asset: activeTrade.cryptoAsset,
      amount: activeTrade.cryptoAmount,
      timestamp: Date.now(),
      status: 'CONFIRMED' as const,
      txHash,
      details: `Escrow release completed for Trade #${tradeId}`,
      referenceTradeId: tradeId,
    };
    setLedger([newLedgerItem, ...ledger]);

    const updatedTrade: Trade = {
      ...activeTrade,
      status: 'COMPLETED',
      completedAt: Date.now(),
      chatMessages: [
        ...activeTrade.chatMessages,
        {
          id: `msg_${Date.now()}_rel`,
          senderId: activeTrade.seller.id,
          senderName: activeTrade.seller.name,
          senderRole: 'SELLER',
          text: `Payment confirmed! I have authorized the release of ${activeTrade.cryptoAmount} ${activeTrade.cryptoAsset}. Thank you for trading!`,
          timestamp: Date.now(),
        },
        {
          id: `msg_${Date.now()}_sys_done`,
          senderId: 'SYSTEM',
          senderName: 'TrustPeer Escrow Protocol',
          senderRole: 'SYSTEM',
          text: `🎉 Trade COMPLETED! Escrow vault released ${activeTrade.cryptoAmount} ${activeTrade.cryptoAsset} to buyer's available wallet. Both parties' reputation trust scores updated.`,
          timestamp: Date.now(),
          isSystem: true,
        },
      ],
      timeline: [
        ...activeTrade.timeline,
        {
          id: `tl_${Date.now()}_rel`,
          title: 'Escrow Released to Buyer',
          description: `${activeTrade.cryptoAmount} ${activeTrade.cryptoAsset} transferred to buyer's liquid balance.`,
          timestamp: Date.now(),
          txHash,
          actor: 'TrustPeer Smart Contract',
          status: 'SUCCESS',
        },
      ],
    };

    setActiveTrade(updatedTrade);
    // Show review modal automatically so user can rate the partner
    setShowReviewModal(true);
  };

  // Raise dispute
  const handleRaiseDispute = (tradeId: string, reason: string) => {
    if (!activeTrade || activeTrade.id !== tradeId) return;

    const txHash = generateEscrowAuditHash(tradeId, 'DISPUTE_FILED', Date.now());

    const updatedTrade: Trade = {
      ...activeTrade,
      status: 'DISPUTED',
      dispute: {
        filedBy: activeRole,
        filedAt: Date.now(),
        reason,
        evidenceNotes: 'Bank receipt and chat transcript submitted for review.',
        status: 'IN_REVIEW',
      },
      chatMessages: [
        ...activeTrade.chatMessages,
        {
          id: `msg_${Date.now()}_disp`,
          senderId: 'SYSTEM',
          senderName: 'TrustPeer Escrow Protocol',
          senderRole: 'SYSTEM',
          text: `⚠️ Formal dispute filed by ${activeRole}. Escrow vault has been FROZEN. An authorized arbitrator has entered the case to review evidence.`,
          timestamp: Date.now(),
          isSystem: true,
        },
      ],
      timeline: [
        ...activeTrade.timeline,
        {
          id: `tl_${Date.now()}_disp`,
          title: 'Dispute Raised - Vault Frozen',
          description: `Dispute reason: "${reason}". Handed over to neutral arbitrator.`,
          timestamp: Date.now(),
          txHash,
          actor: `${activeRole} Party`,
          status: 'ALERT',
        },
      ],
    };

    setActiveTrade(updatedTrade);
    setActiveTab('DISPUTES');
  };

  // Resolve dispute
  const handleResolveDispute = (tradeId: string, resolution: 'BUYER' | 'SELLER', notes: string) => {
    if (!activeTrade || activeTrade.id !== tradeId) return;

    const txHash = generateEscrowAuditHash(tradeId, `ARBITRATION_${resolution}`, Date.now());

    if (resolution === 'BUYER') {
      const releaseRes = releaseEscrowToBalance(wallet, activeTrade.cryptoAsset, activeTrade.cryptoAmount, true);
      if (releaseRes.success && releaseRes.updatedWallet) {
        setWallet(releaseRes.updatedWallet);
      }
    } else {
      const refundRes = refundEscrowToAvailable(wallet, activeTrade.cryptoAsset, activeTrade.cryptoAmount);
      if (refundRes.success && refundRes.updatedWallet) {
        setWallet(refundRes.updatedWallet);
      }
    }

    const updatedTrade: Trade = {
      ...activeTrade,
      status: resolution === 'BUYER' ? 'RESOLVED_BUYER' : 'RESOLVED_SELLER',
      completedAt: Date.now(),
      dispute: {
        ...activeTrade.dispute!,
        status: resolution === 'BUYER' ? 'RESOLVED_BUYER' : 'RESOLVED_SELLER',
        arbitratorNotes: notes,
      },
      chatMessages: [
        ...activeTrade.chatMessages,
        {
          id: `msg_${Date.now()}_arb`,
          senderId: 'ARBITRATOR',
          senderName: 'Escrow Chief Arbitrator',
          senderRole: 'ARBITRATOR',
          text: `⚖️ Official Ruling: Case resolved in favor of ${resolution}. Justification: "${notes}". Escrow assets have been disbursed accordingly.`,
          timestamp: Date.now(),
        },
      ],
      timeline: [
        ...activeTrade.timeline,
        {
          id: `tl_${Date.now()}_arb`,
          title: `Arbitration Ruling: ${resolution} Awarded`,
          description: `Arbitrator verdict executed on-chain. ${notes}`,
          timestamp: Date.now(),
          txHash,
          actor: 'TrustPeer Arbitrator',
          status: 'SUCCESS',
        },
      ],
    };

    setActiveTrade(updatedTrade);
    setActiveTab('ESCROW_TRACKER');
  };

  // Cancel trade
  const handleCancelTrade = (tradeId: string) => {
    if (!activeTrade || activeTrade.id !== tradeId) return;

    // Refund escrow if user was seller
    if (activeTrade.type === 'SELL') {
      const refund = refundEscrowToAvailable(wallet, activeTrade.cryptoAsset, activeTrade.cryptoAmount);
      if (refund.success && refund.updatedWallet) {
        setWallet(refund.updatedWallet);
      }
    }

    setActiveTrade({
      ...activeTrade,
      status: 'CANCELLED',
      chatMessages: [
        ...activeTrade.chatMessages,
        {
          id: `msg_${Date.now()}_cancel`,
          senderId: 'SYSTEM',
          senderName: 'TrustPeer Escrow Protocol',
          senderRole: 'SYSTEM',
          text: 'Trade cancelled. Any escrow collateral has been safely unlocked and returned to seller balance.',
          timestamp: Date.now(),
          isSystem: true,
        },
      ],
    });
  };

  // Send message
  const handleSendMessage = (tradeId: string, text: string, receiptImage?: string) => {
    if (!activeTrade || activeTrade.id !== tradeId) return;

    const senderName = activeRole === 'BUYER' ? activeTrade.buyer.name : activeTrade.seller.name;
    const senderId = activeRole === 'BUYER' ? activeTrade.buyer.id : activeTrade.seller.id;

    setActiveTrade({
      ...activeTrade,
      chatMessages: [
        ...activeTrade.chatMessages,
        {
          id: `msg_${Date.now()}`,
          senderId,
          senderName,
          senderRole: activeRole,
          text,
          timestamp: Date.now(),
          receiptImage,
        },
      ],
    });
  };

  // Simulation actions for testing
  const handleSimulateAction = (tradeId: string, action: string) => {
    if (!activeTrade) return;

    if (action === 'SIMULATE_BUYER_PAID') {
      handleMarkPaid(tradeId, 'SIM-ZEL-782194', 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&auto=format&fit=crop&q=80');
    } else if (action === 'SIMULATE_SELLER_RELEASE') {
      handleReleaseEscrow(tradeId);
    } else if (action === 'SIMULATE_DISPUTE') {
      handleRaiseDispute(tradeId, 'Payment sent but counterparty has not released funds.');
    } else if (action === 'ARBITRATOR_RESOLVE_BUYER') {
      handleResolveDispute(tradeId, 'BUYER', 'Verified valid payment receipt with matching bank reference.');
    } else if (action === 'ARBITRATOR_RESOLVE_SELLER') {
      handleResolveDispute(tradeId, 'SELLER', 'No verifiable banking credit found within the 6-hour investigation window.');
    }
  };

  // Review submission
  const handleReviewSubmit = (review: ReviewSubmission) => {
    const updatedCounterpart = applyNewReview(counterpartElena, review);
    setCounterpartElena({
      ...counterpartElena,
      ...updatedCounterpart,
    });

    // Also give a slight boost to user's completed trade count
    setUserProfile((prev) => ({
      ...prev,
      totalTrades: prev.totalTrades + 1,
      completionRate: Math.min(100, prev.completionRate + 0.1),
    }));

    setShowReviewModal(false);
  };

  // Create custom offer
  const handleCreateOffer = (newOff: Partial<Offer>) => {
    const created: Offer = {
      id: `off_${Date.now()}`,
      type: newOff.type || 'SELL',
      cryptoAsset: newOff.cryptoAsset || 'USDT',
      fiatCurrency: newOff.fiatCurrency || 'USD',
      price: newOff.price || 1.002,
      marginPercent: newOff.marginPercent || 0.2,
      minLimitFiat: newOff.minLimitFiat || 100,
      maxLimitFiat: newOff.maxLimitFiat || 5000,
      paymentMethods: newOff.paymentMethods || ['Zelle', 'Bank Transfer'],
      creator: { ...userProfile },
      terms: newOff.terms || 'Fast trade protected by smart escrow.',
    };
    setOffers([created, ...offers]);
    setActiveTab('MARKETPLACE');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-emerald-500 selection:text-slate-950">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeRole={activeRole}
        setActiveRole={setActiveRole}
        hasActiveTrade={!!activeTrade && activeTrade.status !== 'COMPLETED' && activeTrade.status !== 'CANCELLED'}
        totalPortfolioUsd={portfolioSummary.totalUsd}
        lockedInEscrowUsd={portfolioSummary.lockedUsd}
        userTrustScore={userProfile.score}
        userTier={userProfile.trustLevelLabel}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'MARKETPLACE' && (
          <MarketplaceView
            offers={offers}
            userReputationTier={userProfile.tier}
            userAvailableCrypto={{
              USDT: wallet.find((w) => w.asset === 'USDT')?.available || 0,
              BTC: wallet.find((w) => w.asset === 'BTC')?.available || 0,
              ETH: wallet.find((w) => w.asset === 'ETH')?.available || 0,
              USDC: wallet.find((w) => w.asset === 'USDC')?.available || 0,
            }}
            onInitiateTrade={handleInitiateTrade}
            onCreateOffer={handleCreateOffer}
            alerts={alerts}
            onAddAlert={handleAddAlert}
            onToggleAlert={handleToggleAlert}
            onDeleteAlert={handleDeleteAlert}
            onSimulatePriceDip={handleSimulatePriceDip}
          />
        )}

        {activeTab === 'ESCROW_TRACKER' && (
          <EscrowTracker
            trade={activeTrade}
            activeRole={activeRole}
            onMarkPaid={handleMarkPaid}
            onReleaseEscrow={handleReleaseEscrow}
            onRaiseDispute={handleRaiseDispute}
            onCancelTrade={handleCancelTrade}
            onSendMessage={handleSendMessage}
            onSimulateAction={handleSimulateAction}
            onStartNewTrade={() => setActiveTab('MARKETPLACE')}
          />
        )}

        {activeTab === 'WALLET' && (
          <WalletView
            wallet={wallet}
            ledger={ledger}
            onDeposit={handleDeposit}
            onWithdraw={handleWithdraw}
          />
        )}

        {activeTab === 'REPUTATION' && (
          <ReputationView
            userProfile={userProfile}
            topTraders={[counterpartElena, COUNTERPART_MARCUS, COUNTERPART_SOFIA]}
          />
        )}

        {activeTab === 'DISPUTES' && (
          <DisputeDesk
            trade={activeTrade}
            activeRole={activeRole}
            onResolveDispute={handleResolveDispute}
            onNavigateToEscrow={() => setActiveTab('ESCROW_TRACKER')}
          />
        )}
      </main>

      {/* Review Modal Triggered After Escrow Release */}
      {showReviewModal && activeTrade && (
        <ReviewModal
          traderName={activeTrade.seller.name}
          traderAvatar={activeTrade.seller.avatar}
          onSubmitReview={handleReviewSubmit}
          onClose={() => setShowReviewModal(false)}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">TrustPeer Protocol</span>
            <span>•</span>
            <span>2-of-3 Multi-Signature Escrow &amp; Reputation Engine</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Audit Hash Verifier: Active</span>
            <span>•</span>
            <span>Zero-Knowledge Proofs</span>
            <span>•</span>
            <span>Cold Vault Proof-of-Reserves</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
