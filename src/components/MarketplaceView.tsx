import React, { useState, useEffect } from 'react';
import { 
  ArrowLeftRight, 
  Search, 
  Filter, 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  Plus, 
  ArrowUpRight, 
  Layers,
  Award,
  Sparkles,
  Bell,
  BellRing,
  Trash2,
  TrendingDown,
  Check,
  X
} from 'lucide-react';
import { Offer, SupportedAsset, UserRole } from '../types/p2p.ts';
import { calculateEscrowFee } from '../utils/escrowStateMachine.ts';
import { PriceAlert, AlertCondition } from '../utils/priceAlertEngine.ts';

interface MarketplaceViewProps {
  offers: Offer[];
  userReputationTier: string;
  userAvailableCrypto: Record<string, number>;
  onInitiateTrade: (offer: Offer, fiatAmount: number) => void;
  onCreateOffer: (offerData: Partial<Offer>) => void;
  alerts: PriceAlert[];
  onAddAlert: (asset: SupportedAsset, targetPrice: number, condition: AlertCondition) => void;
  onToggleAlert: (alertId: string) => void;
  onDeleteAlert: (alertId: string) => void;
  onSimulatePriceDip?: (asset: SupportedAsset, dipPrice: number) => void;
}

export const MarketplaceView: React.FC<MarketplaceViewProps> = ({
  offers,
  userReputationTier,
  userAvailableCrypto,
  onInitiateTrade,
  onCreateOffer,
  alerts,
  onAddAlert,
  onToggleAlert,
  onDeleteAlert,
  onSimulatePriceDip,
}) => {
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');
  const [selectedAsset, setSelectedAsset] = useState<SupportedAsset>('USDT');
  const [selectedPayment, setSelectedPayment] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOfferForTrade, setSelectedOfferForTrade] = useState<Offer | null>(null);
  const [fiatTradeInput, setFiatTradeInput] = useState<number>(500);
  const [showCreateOfferModal, setShowCreateOfferModal] = useState(false);
  const [showAlertsDrawer, setShowAlertsDrawer] = useState(false);
  const [showNewAlertModal, setShowNewAlertModal] = useState(false);

  // New alert form state
  const [alertAsset, setAlertAsset] = useState<SupportedAsset>('USDT');
  const [alertTargetPrice, setAlertTargetPrice] = useState<number>(1.000);
  const [alertCondition, setAlertCondition] = useState<AlertCondition>('LESS_THAN_OR_EQUAL');

  // Find lowest sell price currently on the book for buying
  const currentLowestPrices: Record<SupportedAsset, number> = {
    USDT: 1.002,
    BTC: 67400,
    ETH: 3480,
    USDC: 1.000,
    USD: 1.000,
    EUR: 1.080,
  };

  offers.forEach((o) => {
    if (o.type === 'SELL') {
      if (!currentLowestPrices[o.cryptoAsset] || o.price < currentLowestPrices[o.cryptoAsset]) {
        currentLowestPrices[o.cryptoAsset] = o.price;
      }
    }
  });

  const activeAlertsCount = alerts.filter((a) => a.active).length;
  const triggeredAlerts = alerts.filter((a) => a.active && a.triggered);

  // Create alert helper
  const handleCreateAlertSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (alertTargetPrice <= 0) return;
    onAddAlert(alertAsset, alertTargetPrice, alertCondition);
    setShowNewAlertModal(false);
    setShowAlertsDrawer(true);
  };

  // Create offer state
  const [newOfferType, setNewOfferType] = useState<'BUY' | 'SELL'>('SELL');
  const [newOfferAsset, setNewOfferAsset] = useState<SupportedAsset>('USDT');
  const [newOfferPrice, setNewOfferPrice] = useState<number>(1.004);
  const [newOfferMin, setNewOfferMin] = useState<number>(100);
  const [newOfferMax, setNewOfferMax] = useState<number>(5000);
  const [newOfferPayment, setNewOfferPayment] = useState<string>('Zelle, Bank Transfer');
  const [newOfferTerms, setNewOfferTerms] = useState<string>('Instant release upon receipt verification. Escrow protected.');

  // Filter offers
  const filteredOffers = offers.filter((off) => {
    // If user wants to BUY crypto, they look for offers where creator is SELLING crypto
    const matchesType = tradeType === 'BUY' ? off.type === 'SELL' : off.type === 'BUY';
    const matchesAsset = off.cryptoAsset === selectedAsset;
    const matchesPayment =
      selectedPayment === 'ALL' ||
      off.paymentMethods.some((pm) => pm.toLowerCase().includes(selectedPayment.toLowerCase()));
    const matchesSearch =
      off.creator.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      off.paymentMethods.join(' ').toLowerCase().includes(searchQuery.toLowerCase());

    return matchesType && matchesAsset && matchesPayment && matchesSearch;
  });

  const handleOpenTradeModal = (offer: Offer) => {
    setSelectedOfferForTrade(offer);
    setFiatTradeInput(Math.min(offer.maxLimitFiat, Math.max(offer.minLimitFiat, 500)));
  };

  const handleConfirmStartTrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOfferForTrade) return;
    onInitiateTrade(selectedOfferForTrade, fiatTradeInput);
    setSelectedOfferForTrade(null);
  };

  const handleConfirmCreateOffer = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateOffer({
      type: newOfferType,
      cryptoAsset: newOfferAsset,
      price: newOfferPrice,
      fiatCurrency: 'USD',
      minLimitFiat: newOfferMin,
      maxLimitFiat: newOfferMax,
      paymentMethods: newOfferPayment.split(',').map((p) => p.trim()),
      terms: newOfferTerms,
      marginPercent: 0.3,
    });
    setShowCreateOfferModal(false);
  };

  const calculatedCrypto = selectedOfferForTrade
    ? Math.round((fiatTradeInput / selectedOfferForTrade.price) * 1000) / 1000
    : 0;

  const feeData = selectedOfferForTrade
    ? calculateEscrowFee(fiatTradeInput, userReputationTier)
    : { fee: 0, ratePercent: 0.25 };

  return (
    <div className="space-y-6">
      {/* Triggered Alert Notification Banner */}
      {triggeredAlerts.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-slate-900 border border-amber-500/40 rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <BellRing className="w-5 h-5 text-amber-400 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">Price Target Reached!</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500 text-slate-950">
                  {triggeredAlerts.length} Alert{triggeredAlerts.length > 1 ? 's' : ''} Triggered
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {triggeredAlerts[0].cryptoAsset} is currently available at{' '}
                <strong className="text-emerald-400 font-mono">
                  ${triggeredAlerts[0].triggeredPrice || currentLowestPrices[triggeredAlerts[0].cryptoAsset]}
                </strong>{' '}
                (matches your target of &le; ${triggeredAlerts[0].targetPrice}).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {triggeredAlerts[0].triggeredOfferId && (
              <button
                onClick={() => {
                  const matchingOffer = offers.find((o) => o.id === triggeredAlerts[0].triggeredOfferId);
                  if (matchingOffer) {
                    handleOpenTradeModal(matchingOffer);
                  } else {
                    setShowAlertsDrawer(true);
                  }
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <span>Buy Now with Escrow</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => setShowAlertsDrawer(true)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2 rounded-xl text-xs font-semibold"
            >
              Manage Alerts
            </button>
          </div>
        </div>
      )}

      {/* Top Controls & Filter Strip */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">P2P Escrow Marketplace</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Trade directly with verified peers. Escrow lock ensures zero loss from defaults or non-payment.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Price Alerts Button */}
            <button
              onClick={() => setShowAlertsDrawer(true)}
              className={`relative px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-2 ${
                triggeredAlerts.length > 0
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/20'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
              title="Price Alert Notifications"
            >
              {triggeredAlerts.length > 0 ? (
                <BellRing className="w-4 h-4 text-amber-400 animate-bounce" />
              ) : (
                <Bell className="w-4 h-4 text-slate-300" />
              )}
              <span>Price Alerts</span>
              {activeAlertsCount > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    triggeredAlerts.length > 0
                      ? 'bg-amber-400 text-slate-950 font-black'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {activeAlertsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setShowCreateOfferModal(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Post Custom Offer
            </button>
          </div>
        </div>

        {/* Trade Type (Buy / Sell) & Asset Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-800">
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setTradeType('BUY')}
              className={`px-5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                tradeType === 'BUY'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Buy Crypto
            </button>
            <button
              onClick={() => setTradeType('SELL')}
              className={`px-5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                tradeType === 'SELL'
                  ? 'bg-rose-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sell Crypto
            </button>
          </div>

          {/* Crypto Asset Pills */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            {(['USDT', 'BTC', 'ETH', 'USDC'] as SupportedAsset[]).map((asset) => (
              <button
                key={asset}
                onClick={() => setSelectedAsset(asset)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  selectedAsset === asset
                    ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {asset}
              </button>
            ))}
          </div>

          {/* Payment Method Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={selectedPayment}
              onChange={(e) => setSelectedPayment(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Payment Methods</option>
              <option value="Zelle">Zelle</option>
              <option value="Bank">Bank Transfer (ACH / Wire)</option>
              <option value="Revolut">Revolut</option>
              <option value="Wise">Wise</option>
              <option value="SEPA">SEPA Instant</option>
              <option value="PayPal">PayPal</option>
            </select>
          </div>
        </div>
      </div>

      {/* Offers List */}
      <div className="space-y-3">
        {filteredOffers.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
            <Search className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-white font-bold text-sm">No active offers match your filter.</p>
            <p className="text-slate-500 text-xs mt-1">Try switching payment methods or post your own custom offer.</p>
          </div>
        ) : (
          filteredOffers.map((offer) => (
            <div
              key={offer.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg transition-all"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Trader Profile Column with Reputation Score */}
                <div className="flex items-start gap-3.5 min-w-[260px]">
                  <img
                    src={offer.creator.avatar}
                    alt={offer.creator.name}
                    className="w-11 h-11 rounded-xl object-cover border border-slate-700"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{offer.creator.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {offer.creator.trustLevelLabel}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                      <span className="flex items-center gap-1 font-semibold text-emerald-400">
                        <Award className="w-3.5 h-3.5" />
                        {offer.creator.score}% Trust
                      </span>
                      <span>•</span>
                      <span>{offer.creator.totalTrades} orders</span>
                      <span>•</span>
                      <span className="text-slate-300">{offer.creator.completionRate}% completion</span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        Avg. Release: <strong className="text-slate-300">{offer.creator.avgReleaseTimeMinutes}m</strong>
                      </span>
                      {offer.requiresMinReputation && (
                        <span className="text-amber-400/90 text-[10px]">
                          Min {offer.requiresMinReputation}% Trust Required
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Price & Limits Column */}
                <div className="lg:text-center">
                  <div className="text-[11px] text-slate-400 font-medium">Unit Price</div>
                  <div className="text-xl font-black text-white font-mono mt-0.5">
                    ${offer.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 })}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Limits: <span className="text-slate-200 font-semibold">${offer.minLimitFiat} - ${offer.maxLimitFiat.toLocaleString()} {offer.fiatCurrency}</span>
                  </div>
                </div>

                {/* Payment Methods Badges */}
                <div className="space-y-1">
                  <div className="text-[11px] text-slate-400">Payment Accepted</div>
                  <div className="flex flex-wrap gap-1.5">
                    {offer.paymentMethods.map((pm) => (
                      <span
                        key={pm}
                        className="px-2.5 py-1 rounded-lg bg-slate-950 text-slate-200 border border-slate-800 text-xs font-medium"
                      >
                        {pm}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Trade Action Button */}
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={() => handleOpenTradeModal(offer)}
                    className={`font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5 ${
                      tradeType === 'BUY'
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-slate-950 shadow-emerald-600/20'
                        : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20'
                    }`}
                  >
                    <span>{tradeType === 'BUY' ? `Buy ${offer.cryptoAsset}` : `Sell ${offer.cryptoAsset}`}</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Offer Terms */}
              {offer.terms && (
                <div className="mt-3 pt-3 border-t border-slate-850 text-xs text-slate-400 flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-300">Terms:</span>
                  <span className="truncate">{offer.terms}</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Start Trade Modal with Escrow Calculation */}
      {selectedOfferForTrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {tradeType === 'BUY' ? 'Initiate Escrow Purchase' : 'Initiate Escrow Sale'}
                </h3>
                <p className="text-xs text-slate-400">
                  Trading with <strong className="text-emerald-400">{selectedOfferForTrade.creator.name}</strong> ({selectedOfferForTrade.creator.score}% Trust Score)
                </p>
              </div>
              <button
                onClick={() => setSelectedOfferForTrade(null)}
                className="text-slate-400 hover:text-white text-xl leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleConfirmStartTrade} className="mt-4 space-y-4">
              {/* Fiat Amount Input */}
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>How much do you want to pay?</span>
                  <span>
                    Limits: ${selectedOfferForTrade.minLimitFiat} - ${selectedOfferForTrade.maxLimitFiat}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min={selectedOfferForTrade.minLimitFiat}
                    max={selectedOfferForTrade.maxLimitFiat}
                    value={fiatTradeInput}
                    onChange={(e) => setFiatTradeInput(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                    required
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">
                    {selectedOfferForTrade.fiatCurrency}
                  </span>
                </div>
              </div>

              {/* Calculated Crypto Output */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-slate-400">You will receive:</span>
                  <span className="text-xl font-black font-mono text-emerald-400">
                    {calculatedCrypto} {selectedOfferForTrade.cryptoAsset}
                  </span>
                </div>

                <div className="flex justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-2">
                  <span>Unit Price:</span>
                  <span className="font-mono text-slate-200">${selectedOfferForTrade.price}</span>
                </div>

                <div className="flex justify-between text-xs text-slate-400">
                  <span>Escrow Custody Fee ({userReputationTier.replace('_', ' ')}):</span>
                  <span className="font-mono text-emerald-400">${feeData.fee.toFixed(2)} ({feeData.ratePercent}%)</span>
                </div>

                <div className="flex justify-between text-xs text-slate-400">
                  <span>Smart Contract Multi-Sig:</span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Vault Protected
                  </span>
                </div>
              </div>

              {/* Escrow Guarantee Disclaimer */}
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300">
                ⚡ Upon clicking Initiate, the seller's {calculatedCrypto} {selectedOfferForTrade.cryptoAsset} is immediately locked into the TrustPeer smart escrow contract. The seller cannot withdraw until your trade completes or an arbitrator rules.
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedOfferForTrade(null)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-sm font-bold shadow-lg shadow-emerald-600/20"
                >
                  Lock Escrow &amp; Start Trade
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Post Custom Offer Modal */}
      {showCreateOfferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">Create New P2P Escrow Offer</h3>
              <button
                onClick={() => setShowCreateOfferModal(false)}
                className="text-slate-400 hover:text-white text-xl leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleConfirmCreateOffer} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Offer Type</label>
                  <select
                    value={newOfferType}
                    onChange={(e) => setNewOfferType(e.target.value as 'BUY' | 'SELL')}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="SELL">I want to Sell Crypto</option>
                    <option value="BUY">I want to Buy Crypto</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Asset</label>
                  <select
                    value={newOfferAsset}
                    onChange={(e) => setNewOfferAsset(e.target.value as SupportedAsset)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="USDT">USDT (Tether)</option>
                    <option value="BTC">BTC (Bitcoin)</option>
                    <option value="ETH">ETH (Ethereum)</option>
                    <option value="USDC">USDC (USD Coin)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Fixed Price per Unit (USD)
                </label>
                <input
                  type="number"
                  step="any"
                  value={newOfferPrice}
                  onChange={(e) => setNewOfferPrice(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white font-mono text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Min Limit ($)</label>
                  <input
                    type="number"
                    value={newOfferMin}
                    onChange={(e) => setNewOfferMin(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white font-mono text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Max Limit ($)</label>
                  <input
                    type="number"
                    value={newOfferMax}
                    onChange={(e) => setNewOfferMax(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white font-mono text-xs"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Accepted Payment Methods (comma-separated)
                </label>
                <input
                  type="text"
                  value={newOfferPayment}
                  onChange={(e) => setNewOfferPayment(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-xs"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Trading Terms</label>
                <textarea
                  rows={2}
                  value={newOfferTerms}
                  onChange={(e) => setNewOfferTerms(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs"
                />
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateOfferModal(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-sm font-bold shadow-lg shadow-emerald-600/20"
                >
                  Publish Offer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Price Alerts Management Modal / Drawer */}
      {showAlertsDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <BellRing className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Purchase Price Alerts</h3>
                  <p className="text-xs text-slate-400">
                    Get instantly notified when verified sellers list crypto at your target price.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAlertsDrawer(false)}
                className="text-slate-400 hover:text-white text-xl leading-none"
              >
                &times;
              </button>
            </div>

            {/* Alerts List */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Active Alerts ({alerts.length})
                </span>
                <button
                  onClick={() => setShowNewAlertModal(true)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Set New Alert</span>
                </button>
              </div>

              {alerts.length === 0 ? (
                <div className="p-8 text-center bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                  <Bell className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">
                    You don't have any price alerts set. Create an alert to catch market dips automatically!
                  </p>
                  <button
                    onClick={() => setShowNewAlertModal(true)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs"
                  >
                    Set Your First Target Price
                  </button>
                </div>
              ) : (
                alerts.map((al) => {
                  const currentPrice = currentLowestPrices[al.cryptoAsset] || 1;
                  const diffPercent = ((currentPrice - al.targetPrice) / al.targetPrice) * 100;

                  return (
                    <div
                      key={al.id}
                      className={`p-4 rounded-xl border transition-all ${
                        al.triggered
                          ? 'bg-amber-950/20 border-amber-500/40'
                          : al.active
                          ? 'bg-slate-950 border-slate-800'
                          : 'bg-slate-950/40 border-slate-850 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-white text-sm">{al.cryptoAsset}</span>
                            <span className="text-xs text-slate-400">in {al.fiatCurrency}</span>

                            {al.triggered ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500 text-slate-950 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                TARGET HIT!
                              </span>
                            ) : al.active ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                                Watching Book
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-500">
                                Paused
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-slate-300">
                            Target: <strong className="text-white font-mono">&le; ${al.targetPrice.toLocaleString()}</strong>
                          </div>

                          <div className="text-[11px] text-slate-400 flex items-center gap-2">
                            <span>Current Best: <strong className="text-emerald-400 font-mono">${currentPrice.toLocaleString()}</strong></span>
                            <span>•</span>
                            <span className={diffPercent <= 0 ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                              {diffPercent <= 0
                                ? 'Price matched!'
                                : `+${diffPercent.toFixed(2)}% above target`}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          {al.triggered && al.triggeredOfferId && (
                            <button
                              onClick={() => {
                                const matchingOffer = offers.find((o) => o.id === al.triggeredOfferId);
                                if (matchingOffer) {
                                  setShowAlertsDrawer(false);
                                  handleOpenTradeModal(matchingOffer);
                                }
                              }}
                              className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 shadow-md shadow-emerald-600/20"
                            >
                              <span>Buy Now</span>
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => onToggleAlert(al.id)}
                            className={`p-1.5 rounded-lg border text-xs font-semibold ${
                              al.active
                                ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                                : 'bg-slate-800/40 border-slate-800 text-slate-500'
                            }`}
                            title={al.active ? 'Pause alert' : 'Resume alert'}
                          >
                            {al.active ? 'Pause' : 'Resume'}
                          </button>

                          <button
                            onClick={() => onDeleteAlert(al.id)}
                            className="p-1.5 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                            title="Delete alert"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Simulation Sandbox Helper */}
              {onSimulatePriceDip && (
                <div className="mt-4 pt-4 border-t border-slate-800 bg-slate-950/60 p-3.5 rounded-xl">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-400 mb-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Interactive Testing Simulator:
                  </div>
                  <p className="text-[11px] text-slate-400 mb-2">
                    Click below to simulate a market price drop to test instant alert notifications:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => onSimulatePriceDip('USDT', 0.998)}
                      className="text-[11px] bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 px-2.5 py-1 rounded-lg"
                    >
                      Drop USDT to $0.998
                    </button>
                    <button
                      onClick={() => onSimulatePriceDip('BTC', 65000)}
                      className="text-[11px] bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 px-2.5 py-1 rounded-lg"
                    >
                      Drop BTC to $65,000
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end shrink-0">
              <button
                onClick={() => setShowAlertsDrawer(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Price Alert Modal */}
      {showNewAlertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-bold text-white">Create Purchase Price Alert</h3>
              </div>
              <button
                onClick={() => setShowNewAlertModal(false)}
                className="text-slate-400 hover:text-white text-xl leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateAlertSubmit} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Crypto Asset to Track
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['USDT', 'BTC', 'ETH', 'USDC'] as SupportedAsset[]).map((ast) => (
                    <button
                      type="button"
                      key={ast}
                      onClick={() => {
                        setAlertAsset(ast);
                        const cur = currentLowestPrices[ast] || 1;
                        setAlertTargetPrice(Math.round(cur * 0.995 * 1000) / 1000);
                      }}
                      className={`py-2 rounded-lg text-xs font-bold border transition-colors ${
                        alertAsset === ast
                          ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                          : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      {ast}
                    </button>
                  ))}
                </div>
              </div>

              {/* Current Best Price Reference */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">Current Best Marketplace Price:</span>
                <span className="font-mono font-bold text-emerald-400">
                  ${(currentLowestPrices[alertAsset] || 1).toLocaleString()} USD
                </span>
              </div>

              {/* Target Price Input */}
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Alert Me When Purchase Price Drops To Or Below:
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    value={alertTargetPrice}
                    onChange={(e) => setAlertTargetPrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                    required
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">
                    USD
                  </span>
                </div>

                {/* Quick Presets */}
                <div className="flex gap-1.5 mt-2">
                  {[
                    { label: '-0.5%', factor: 0.995 },
                    { label: '-1.0%', factor: 0.990 },
                    { label: '-2.0%', factor: 0.980 },
                    { label: '-5.0%', factor: 0.950 },
                  ].map((preset) => {
                    const cur = currentLowestPrices[alertAsset] || 1;
                    const calculated = Math.round(cur * preset.factor * 1000) / 1000;
                    return (
                      <button
                        type="button"
                        key={preset.label}
                        onClick={() => setAlertTargetPrice(calculated)}
                        className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded"
                      >
                        {preset.label} (${calculated})
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300">
                💡 When an offer is published matching your target, a notification banner appears and the offer is immediately highlighted with smart escrow protection.
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewAlertModal(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-sm font-bold shadow-lg shadow-emerald-600/20"
                >
                  Save Price Alert
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
