import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  ArrowUpRight, 
  ArrowDownLeft, 
  CheckCircle2, 
  Copy, 
  ExternalLink, 
  RefreshCw, 
  KeyRound, 
  History, 
  Layers
} from 'lucide-react';
import { SupportedAsset, WalletAssetBalance, WalletLedgerItem } from '../types/p2p.ts';

interface WalletViewProps {
  wallet: WalletAssetBalance[];
  ledger: WalletLedgerItem[];
  onDeposit: (asset: SupportedAsset, amount: number) => void;
  onWithdraw: (asset: SupportedAsset, amount: number, address: string) => boolean;
}

export const WalletView: React.FC<WalletViewProps> = ({
  wallet,
  ledger,
  onDeposit,
  onWithdraw,
}) => {
  const [selectedAsset, setSelectedAsset] = useState<SupportedAsset>('USDT');
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [depositAmount, setDepositAmount] = useState<number>(500);
  const [ledgerFilter, setLedgerFilter] = useState<'ALL' | 'ESCROW' | 'DEPOSIT' | 'WITHDRAWAL'>('ALL');

  // Withdraw state
  const [withdrawAmount, setWithdrawAmount] = useState<string>('100');
  const [withdrawAddress, setWithdrawAddress] = useState<string>('');
  const [twoFactorPin, setTwoFactorPin] = useState<string>('');
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState<boolean>(false);

  // Totals
  const totalUsd = wallet.reduce((sum, item) => sum + (item.available + item.lockedInEscrow) * item.usdRate, 0);
  const availableUsd = wallet.reduce((sum, item) => sum + item.available * item.usdRate, 0);
  const lockedUsd = wallet.reduce((sum, item) => sum + item.lockedInEscrow * item.usdRate, 0);

  const activeAssetData = wallet.find((w) => w.asset === selectedAsset) || wallet[0];

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const handleExecuteDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    if (depositAmount <= 0) return;
    onDeposit(selectedAsset, depositAmount);
    setShowDepositModal(false);
  };

  const handleExecuteWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError(null);
    const amt = parseFloat(withdrawAmount);

    if (isNaN(amt) || amt <= 0) {
      setWithdrawError('Please enter a valid withdrawal amount.');
      return;
    }
    if (amt > activeAssetData.available) {
      setWithdrawError(`Insufficient available balance. You have ${activeAssetData.available} ${selectedAsset} available.`);
      return;
    }
    if (!withdrawAddress.trim() || withdrawAddress.length < 10) {
      setWithdrawError('Please provide a valid destination address or account identifier.');
      return;
    }
    if (twoFactorPin.length < 4) {
      setWithdrawError('Please enter a valid 2FA security PIN (e.g. 123456).');
      return;
    }

    const success = onWithdraw(selectedAsset, amt, withdrawAddress);
    if (success) {
      setWithdrawSuccess(true);
      setTimeout(() => {
        setWithdrawSuccess(false);
        setShowWithdrawModal(false);
        setWithdrawAmount('100');
        setWithdrawAddress('');
        setTwoFactorPin('');
      }, 1500);
    }
  };

  const filteredLedger = ledger.filter((item) => {
    if (ledgerFilter === 'ALL') return true;
    if (ledgerFilter === 'ESCROW') return item.type.startsWith('ESCROW_');
    if (ledgerFilter === 'DEPOSIT') return item.type === 'DEPOSIT';
    if (ledgerFilter === 'WITHDRAWAL') return item.type === 'WITHDRAWAL';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Escrow Vault Overview Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 rounded-2xl border border-slate-800 p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                TrustPeer Smart Escrow Vault
              </span>
              <span className="text-xs text-slate-400">Institutional Multi-Sig Custody</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              ${totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-sm font-normal text-slate-400 ml-2">Total Estimated Value</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Your custodial funds are cryptographically partitioned between tradeable liquid funds and collateral held in ongoing smart contract escrows.
            </p>
          </div>

          {/* Quick Vault Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowDepositModal(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <ArrowDownLeft className="w-4 h-4" />
              Deposit Funds
            </button>
            <button
              onClick={() => setShowWithdrawModal(true)}
              className="bg-slate-800 hover:bg-slate-700 text-white font-medium px-4 py-2.5 rounded-xl text-sm border border-slate-700 flex items-center gap-2 transition-all cursor-pointer"
            >
              <ArrowUpRight className="w-4 h-4 text-slate-300" />
              Withdraw
            </button>
          </div>
        </div>

        {/* Partition Breakdown: Liquid vs Escrow Locked */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 flex items-center gap-1.5 font-medium">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
                Available Liquid Balance
              </span>
              <span className="text-xs font-bold text-emerald-400">
                {totalUsd > 0 ? Math.round((availableUsd / totalUsd) * 100) : 100}% of portfolio
              </span>
            </div>
            <div className="text-2xl font-bold text-white mt-1">
              ${availableUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Ready for immediate withdrawal, maker offers, or locking into new escrow trades.
            </div>
          </div>

          <div className="bg-slate-950/60 rounded-xl p-4 border border-amber-900/30">
            <div className="flex items-center justify-between">
              <span className="text-xs text-amber-300 flex items-center gap-1.5 font-medium">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                Locked in Escrow Vault
              </span>
              <span className="text-xs font-bold text-amber-400">
                {totalUsd > 0 ? Math.round((lockedUsd / totalUsd) * 100) : 0}% locked
              </span>
            </div>
            <div className="text-2xl font-bold text-amber-400 mt-1">
              ${lockedUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Locked securely in smart contracts for active P2P trades. Released upon mutual confirmation.
            </div>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="mt-4">
          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden flex">
            <div
              className="bg-emerald-500 h-full transition-all duration-500"
              style={{ width: `${totalUsd > 0 ? (availableUsd / totalUsd) * 100 : 100}%` }}
              title="Available"
            ></div>
            <div
              className="bg-amber-500 h-full transition-all duration-500"
              style={{ width: `${totalUsd > 0 ? (lockedUsd / totalUsd) * 100 : 0}%` }}
              title="Locked in Escrow"
            ></div>
          </div>
        </div>
      </div>

      {/* Escrow Vault Architecture & Guarantees */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Lock className="w-4 h-4" />
            2-of-3 Multi-Sig
          </div>
          <p className="text-xs text-slate-300">
            Escrow funds require signatures from Buyer &amp; Seller, or an appointed Arbitrator only if a formal dispute is opened.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4" />
            Zero Counterparty Risk
          </div>
          <p className="text-xs text-slate-300">
            Sellers cannot cancel or divert crypto once locked into the escrow vault until payment receipt is verified.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
            <History className="w-4 h-4" />
            Time-Lock Safety
          </div>
          <p className="text-xs text-slate-300">
            Configurable payment countdown windows prevent stalled funds with automated dispute arbitration pathways.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Layers className="w-4 h-4" />
            Tiered Escrow Fees
          </div>
          <p className="text-xs text-slate-300">
            Reputation system dynamically slashes escrow custody fees from 0.60% down to 0.10% for verified traders.
          </p>
        </div>
      </div>

      {/* Assets Balance Table */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Vault Asset Balances</h2>
            <p className="text-xs text-slate-400">Select an asset to view addresses, deposit, or withdraw.</p>
          </div>
          <span className="text-xs font-medium text-slate-400 bg-slate-800 px-3 py-1 rounded-lg">
            {wallet.length} Supported Currencies
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/70 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-5">Asset</th>
                <th className="py-3 px-4">Available Balance</th>
                <th className="py-3 px-4">Locked in Escrow</th>
                <th className="py-3 px-4">Total Amount</th>
                <th className="py-3 px-4">Estimated Value (USD)</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {wallet.map((item) => {
                const totalAssetAmount = item.available + item.lockedInEscrow;
                const valueUsd = totalAssetAmount * item.usdRate;
                const isSelected = selectedAsset === item.asset;

                return (
                  <tr
                    key={item.asset}
                    onClick={() => setSelectedAsset(item.asset)}
                    className={`hover:bg-slate-800/40 transition-colors cursor-pointer ${
                      isSelected ? 'bg-slate-800/30' : ''
                    }`}
                  >
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs text-white shadow"
                          style={{ backgroundColor: item.iconBg }}
                        >
                          {item.symbol.slice(0, 3)}
                        </div>
                        <div>
                          <div className="font-bold text-white flex items-center gap-1.5">
                            {item.name}
                            <span className="text-xs text-slate-400 font-normal">({item.symbol})</span>
                          </div>
                          {item.chainNetwork && (
                            <div className="text-[11px] text-slate-500">{item.chainNetwork}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4 font-mono font-semibold text-emerald-400">
                      {item.available.toLocaleString(undefined, { maximumFractionDigits: item.decimals })}
                    </td>

                    <td className="py-4 px-4 font-mono">
                      {item.lockedInEscrow > 0 ? (
                        <span className="inline-flex items-center gap-1 text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded text-xs">
                          <Lock className="w-3 h-3" />
                          {item.lockedInEscrow.toLocaleString(undefined, { maximumFractionDigits: item.decimals })}
                        </span>
                      ) : (
                        <span className="text-slate-500">0.00</span>
                      )}
                    </td>

                    <td className="py-4 px-4 font-mono text-slate-200">
                      {totalAssetAmount.toLocaleString(undefined, { maximumFractionDigits: item.decimals })}
                    </td>

                    <td className="py-4 px-4 font-bold text-white">
                      ${valueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    <td className="py-4 px-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAsset(item.asset);
                            setShowDepositModal(true);
                          }}
                          className="text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-medium px-2.5 py-1 rounded-lg border border-emerald-500/20 transition-colors"
                        >
                          Deposit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAsset(item.asset);
                            setShowWithdrawModal(true);
                          }}
                          className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium px-2.5 py-1 rounded-lg border border-slate-700 transition-colors"
                        >
                          Withdraw
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Escrow Ledger & Audit Trail */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-bold text-white">Escrow &amp; Wallet Audit Ledger</h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Cryptographically verified record of all deposits, withdrawals, and smart escrow vault locks.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setLedgerFilter('ALL')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                ledgerFilter === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Events
            </button>
            <button
              onClick={() => setLedgerFilter('ESCROW')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                ledgerFilter === 'ESCROW' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Escrow Operations
            </button>
            <button
              onClick={() => setLedgerFilter('DEPOSIT')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                ledgerFilter === 'DEPOSIT' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Deposits
            </button>
            <button
              onClick={() => setLedgerFilter('WITHDRAWAL')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                ledgerFilter === 'WITHDRAWAL' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Withdrawals
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-800/70 mt-3">
          {filteredLedger.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-sm">
              No transactions found matching filter.
            </div>
          ) : (
            filteredLedger.map((item) => (
              <div key={item.id} className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      item.type === 'ESCROW_LOCK'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        : item.type === 'ESCROW_RELEASE'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : item.type === 'DEPOSIT'
                        ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {item.type === 'ESCROW_LOCK' ? (
                      <Lock className="w-4 h-4" />
                    ) : item.type === 'ESCROW_RELEASE' ? (
                      <ShieldCheck className="w-4 h-4" />
                    ) : item.type === 'DEPOSIT' ? (
                      <ArrowDownLeft className="w-4 h-4" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">
                        {item.type.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                        {new Date(item.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">{item.details}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                        Hash: {item.txHash}
                      </span>
                      <button
                        onClick={() => handleCopy(item.txHash)}
                        className="text-slate-400 hover:text-emerald-400 transition-colors"
                        title="Copy Transaction Hash"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="text-right pl-12 md:pl-0">
                  <div
                    className={`font-mono font-bold text-sm ${
                      item.type === 'DEPOSIT' || item.type === 'ESCROW_RELEASE'
                        ? 'text-emerald-400'
                        : item.type === 'ESCROW_LOCK'
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {item.type === 'DEPOSIT' || item.type === 'ESCROW_RELEASE' ? '+' : '-'}
                    {item.amount.toLocaleString()} {item.asset}
                  </div>
                  <span className="inline-block mt-0.5 px-2 py-0.5 text-[10px] font-semibold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {item.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Deposit Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs text-white"
                  style={{ backgroundColor: activeAssetData.iconBg }}
                >
                  {activeAssetData.symbol.slice(0, 3)}
                </div>
                <h3 className="text-lg font-bold text-white">Deposit {activeAssetData.name}</h3>
              </div>
              <button
                onClick={() => setShowDepositModal(false)}
                className="text-slate-400 hover:text-white text-xl leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleExecuteDeposit} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Select Currency Asset
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {wallet.map((w) => (
                    <button
                      type="button"
                      key={w.asset}
                      onClick={() => setSelectedAsset(w.asset)}
                      className={`py-2 px-2.5 rounded-lg text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                        selectedAsset === w.asset
                          ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                          : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      {w.symbol}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custodial Escrow Vault Address */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>Vault Deposit Address</span>
                  <span className="text-[10px] text-emerald-400 font-medium">Multi-Sig Guarded</span>
                </div>
                <div className="font-mono text-xs text-slate-200 break-all bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between gap-2">
                  <span>{activeAssetData.depositAddress}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(activeAssetData.depositAddress)}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400"
                    title="Copy Address"
                  >
                    {copiedAddress ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  Deposited funds are credited automatically after blockchain confirmation and stored safely inside your protected escrow vault.
                </p>
              </div>

              {/* Quick Simulator Input for testing */}
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Instant Test Deposit Amount ({activeAssetData.symbol})
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                    required
                  />
                  <div className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">
                    {activeAssetData.symbol}
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  {[100, 500, 1000, 2500].map((preset) => (
                    <button
                      type="button"
                      key={preset}
                      onClick={() => setDepositAmount(preset)}
                      className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded"
                    >
                      +{preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowDepositModal(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-sm font-bold shadow-lg shadow-emerald-600/20 transition-colors cursor-pointer"
                >
                  Confirm Deposit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5 text-rose-400" />
                <h3 className="text-lg font-bold text-white">Withdraw {activeAssetData.name}</h3>
              </div>
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="text-slate-400 hover:text-white text-xl leading-none"
              >
                &times;
              </button>
            </div>

            {withdrawSuccess ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-white">Withdrawal Dispatched</h4>
                <p className="text-xs text-slate-400">
                  {withdrawAmount} {selectedAsset} has been processed from your available balance.
                </p>
              </div>
            ) : (
              <form onSubmit={handleExecuteWithdraw} className="mt-4 space-y-4">
                {withdrawError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                    {withdrawError}
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>Amount to Withdraw</span>
                    <span>
                      Available: <strong className="text-emerald-400">{activeAssetData.available} {selectedAsset}</strong>
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      max={activeAssetData.available}
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-rose-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setWithdrawAmount(activeAssetData.available.toString())}
                      className="absolute right-3 top-2.5 text-[11px] font-bold text-emerald-400 hover:text-emerald-300"
                    >
                      MAX
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Destination Address / Account Details
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 0x82... or Bank IBAN / Zelle email"
                    value={withdrawAddress}
                    onChange={(e) => setWithdrawAddress(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-mono text-xs focus:outline-none focus:border-rose-500"
                    required
                  />
                </div>

                {/* Simulated 2FA PIN */}
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-amber-400 mb-1">
                    <KeyRound className="w-3.5 h-3.5" />
                    Escrow Security 2FA Authenticator
                  </div>
                  <input
                    type="password"
                    maxLength={6}
                    placeholder="Enter 6-digit PIN (e.g. 123456)"
                    value={twoFactorPin}
                    onChange={(e) => setTwoFactorPin(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs tracking-widest focus:outline-none focus:border-amber-400"
                    required
                  />
                  <div className="text-[10px] text-slate-500 mt-1">
                    Protects against unauthorized drain of your escrow collateral and balance.
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowWithdrawModal(false)}
                    className="w-1/2 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold shadow-lg shadow-rose-600/20 transition-colors"
                  >
                    Authorize Withdrawal
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
