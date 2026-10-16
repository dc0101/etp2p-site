import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Send, 
  Paperclip, 
  ArrowRight, 
  User, 
  ExternalLink, 
  Check, 
  Copy, 
  FileText,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Info
} from 'lucide-react';
import { Trade, UserRole } from '../types/p2p.ts';

interface EscrowTrackerProps {
  trade: Trade | null;
  activeRole: UserRole;
  onMarkPaid: (tradeId: string, reference: string, receiptUrl?: string) => void;
  onReleaseEscrow: (tradeId: string) => void;
  onRaiseDispute: (tradeId: string, reason: string) => void;
  onCancelTrade: (tradeId: string) => void;
  onSendMessage: (tradeId: string, text: string, receiptImage?: string) => void;
  onSimulateAction: (tradeId: string, action: string) => void;
  onStartNewTrade: () => void;
}

export const EscrowTracker: React.FC<EscrowTrackerProps> = ({
  trade,
  activeRole,
  onMarkPaid,
  onReleaseEscrow,
  onRaiseDispute,
  onCancelTrade,
  onSendMessage,
  onSimulateAction,
  onStartNewTrade,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [chatInput, setChatInput] = useState('');
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
  const [paymentRefInput, setPaymentRefInput] = useState('');
  const [receiptSimulated, setReceiptSimulated] = useState<string | null>(null);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('Payment sent but counterparty has not released funds.');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [showReleaseConfirmModal, setShowReleaseConfirmModal] = useState(false);

  // Dynamic countdown timer
  useEffect(() => {
    if (!trade) return;

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((trade.expiresAt - now) / 1000));
      setSecondsRemaining(diff);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [trade?.expiresAt, trade?.id]);

  if (!trade) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center max-w-2xl mx-auto shadow-xl">
        <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-400">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">No Active Escrow Trade Selected</h2>
        <p className="text-slate-400 text-sm mb-6">
          You currently do not have an open trade in tracking. Browse active P2P marketplace offers to initiate a trade with automated smart escrow protection.
        </p>
        <button
          onClick={onStartNewTrade}
          className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-6 py-3 rounded-xl text-sm transition-all shadow-lg shadow-emerald-600/20"
        >
          Browse Marketplace Offers
        </button>
      </div>
    );
  }

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() && !receiptSimulated) return;
    onSendMessage(trade.id, chatInput.trim() || 'Attached payment receipt proof.', receiptSimulated || undefined);
    setChatInput('');
    setReceiptSimulated(null);
  };

  const submitMarkPaid = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentRefInput.trim()) return;
    onMarkPaid(trade.id, paymentRefInput.trim(), receiptSimulated || undefined);
    setShowMarkPaidModal(false);
  };

  // Steps definition for visual progression
  const steps = [
    {
      id: 'AWAITING_ESCROW_DEPOSIT',
      title: 'Trade Created',
      desc: 'Offer accepted',
      done: true,
      timestamp: trade.createdAt,
    },
    {
      id: 'ESCROW_LOCKED',
      title: 'Escrow Vault Locked',
      desc: `${trade.cryptoAmount} ${trade.cryptoAsset} locked`,
      done: trade.status !== 'AWAITING_ESCROW_DEPOSIT',
      current: trade.status === 'ESCROW_LOCKED',
      timestamp: trade.escrowLockedAt,
    },
    {
      id: 'BUYER_MARKED_PAID',
      title: 'Payment Sent',
      desc: `$${trade.fiatAmount} via ${trade.paymentMethod.name}`,
      done: trade.status === 'BUYER_MARKED_PAID' || trade.status === 'COMPLETED' || trade.status === 'RESOLVED_BUYER' || trade.status === 'RESOLVED_SELLER',
      current: trade.status === 'BUYER_MARKED_PAID',
      timestamp: trade.buyerPaidAt,
    },
    {
      id: 'COMPLETED',
      title: 'Escrow Released',
      desc: 'Funds transferred & rated',
      done: trade.status === 'COMPLETED' || trade.status === 'RESOLVED_BUYER' || trade.status === 'RESOLVED_SELLER',
      current: trade.status === 'COMPLETED',
      timestamp: trade.completedAt,
    },
  ];

  const isBuyer = activeRole === 'BUYER';
  const isSeller = activeRole === 'SELLER';
  const isArbitrator = activeRole === 'ARBITRATOR';
  const isDisputed = trade.status === 'DISPUTED';
  const isCompleted = trade.status === 'COMPLETED' || trade.status === 'RESOLVED_BUYER' || trade.status === 'RESOLVED_SELLER';

  return (
    <div className="space-y-6">
      {/* Simulation Bar for Testing Both Perspectives */}
      <div className="bg-slate-900 border border-indigo-500/30 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span className="font-semibold text-white">Interactive Sandbox Simulation:</span>
          <span className="text-slate-400">
            Active view: <strong className="text-indigo-400">{activeRole}</strong>. Test live reactions by triggering counterparty actions:
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {trade.status === 'ESCROW_LOCKED' && (
            <button
              onClick={() => onSimulateAction(trade.id, 'SIMULATE_BUYER_PAID')}
              className="bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
            >
              Simulate Buyer Paying
            </button>
          )}
          {trade.status === 'BUYER_MARKED_PAID' && (
            <button
              onClick={() => onSimulateAction(trade.id, 'SIMULATE_SELLER_RELEASE')}
              className="bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
            >
              Simulate Seller Releasing
            </button>
          )}
          {!isCompleted && !isDisputed && (
            <button
              onClick={() => onSimulateAction(trade.id, 'SIMULATE_DISPUTE')}
              className="bg-rose-600/30 hover:bg-rose-600/50 text-rose-200 border border-rose-500/40 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
            >
              Simulate Dispute Raised
            </button>
          )}
        </div>
      </div>

      {/* Main Trade Header with Live Status & Countdown */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-mono text-slate-400">ID: {trade.id}</span>
              <span className="text-slate-600">•</span>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  isCompleted
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : isDisputed
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30 animate-pulse'
                    : trade.status === 'BUYER_MARKED_PAID'
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-current animate-ping"></span>
                {trade.status.replace(/_/g, ' ')}
              </span>

              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {trade.type === 'BUY' ? 'Buying Crypto' : 'Selling Crypto'}
              </span>
            </div>

            <div className="flex items-baseline gap-3 mt-3">
              <h1 className="text-3xl font-extrabold text-white tracking-tight">
                {trade.cryptoAmount} {trade.cryptoAsset}
              </h1>
              <span className="text-slate-400 text-lg font-medium">for</span>
              <h2 className="text-2xl font-bold text-emerald-400">
                ${trade.fiatAmount.toFixed(2)} {trade.fiatCurrency}
              </h2>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Rate: <span className="text-white font-mono">${trade.unitPrice.toFixed(3)}</span> per {trade.cryptoAsset} • Escrow Custody Fee: <span className="text-emerald-400 font-mono">${trade.escrowFee.toFixed(2)} ({trade.escrowFeeRate}%)</span>
            </div>
          </div>

          {/* Real-time Countdown Timer Block */}
          {!isCompleted && !isDisputed && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex items-center gap-4 shrink-0">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
                <Clock className="w-6 h-6 animate-spin text-amber-400" style={{ animationDuration: '6s' }} />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                  {trade.status === 'ESCROW_LOCKED' ? 'Payment Window' : 'Release Window'}
                </div>
                <div className="text-2xl font-mono font-black text-amber-400">
                  {formatTimer(secondsRemaining)}
                </div>
                <div className="text-[10px] text-slate-500">
                  {trade.status === 'ESCROW_LOCKED' ? 'Buyer must transfer before time expires' : 'Seller verifying bank receipt'}
                </div>
              </div>
            </div>
          )}

          {isDisputed && (
            <div className="bg-rose-950/40 border border-rose-500/30 rounded-xl p-4 flex items-center gap-3 shrink-0">
              <AlertTriangle className="w-8 h-8 text-rose-400 shrink-0" />
              <div>
                <div className="text-xs font-bold text-rose-300 uppercase">Arbitration Active</div>
                <p className="text-xs text-rose-200/80">Escrow vault is locked under arbitrator inspection.</p>
              </div>
            </div>
          )}

          {isCompleted && (
            <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3 shrink-0">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />
              <div>
                <div className="text-xs font-bold text-emerald-300 uppercase">Trade Successful</div>
                <p className="text-xs text-emerald-200/80">Funds released to buyer &amp; reputation updated.</p>
              </div>
            </div>
          )}
        </div>

        {/* Step-by-Step Interactive Progression Stepper */}
        <div className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {steps.map((st, idx) => (
              <div
                key={st.id}
                className={`relative p-3.5 rounded-xl border transition-all ${
                  st.done
                    ? 'bg-emerald-950/20 border-emerald-500/30'
                    : st.current
                    ? 'bg-amber-950/20 border-amber-500/40 shadow-sm shadow-amber-500/10'
                    : 'bg-slate-950/40 border-slate-800 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Step {idx + 1}
                  </span>
                  {st.done ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : st.current ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-slate-700"></span>
                  )}
                </div>
                <div className="font-bold text-white text-xs">{st.title}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{st.desc}</div>
                {st.timestamp && (
                  <div className="text-[10px] text-slate-500 font-mono mt-1.5">
                    {new Date(st.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 2-Column Layout: Left (Instructions, Audit Trail, Actions) / Right (Chat, Reputation Card) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Payment Method Details & Instructions */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-white text-sm">Escrow Payment Information</h3>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {trade.paymentMethod.name}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Recipient Account / Email:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-white">
                      {trade.paymentMethod.accountNumberOrEmail}
                    </span>
                    <button
                      onClick={() => handleCopy(trade.paymentMethod.accountNumberOrEmail, 'account')}
                      className="text-slate-400 hover:text-emerald-400"
                      title="Copy"
                    >
                      {copiedText === 'account' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Account Name:</span>
                  <span className="font-semibold text-slate-200">{trade.paymentMethod.accountName}</span>
                </div>

                {trade.paymentMethod.bankName && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Bank:</span>
                    <span className="text-slate-300">{trade.paymentMethod.bankName}</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs border-t border-slate-800 pt-2">
                  <span className="text-slate-400">Exact Transfer Amount:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-extrabold text-emerald-400 text-sm">
                      ${trade.fiatAmount.toFixed(2)} {trade.fiatCurrency}
                    </span>
                    <button
                      onClick={() => handleCopy(trade.fiatAmount.toFixed(2), 'amount')}
                      className="text-slate-400 hover:text-emerald-400"
                    >
                      {copiedText === 'amount' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Payment Memo / Reference:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-amber-400 font-bold">{trade.id}</span>
                    <button
                      onClick={() => handleCopy(trade.id, 'memo')}
                      className="text-slate-400 hover:text-emerald-400"
                    >
                      {copiedText === 'memo' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="text-xs bg-slate-800/40 border border-slate-700/60 p-3 rounded-xl text-slate-300">
                <span className="font-semibold text-white block mb-0.5">Seller Instructions:</span>
                {trade.paymentMethod.instructions}
              </div>
            </div>
          </div>

          {/* Interactive Role Actions Panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <h3 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Escrow Protection Controls ({activeRole} Perspective)
            </h3>

            {/* Buyer Controls */}
            {isBuyer && (
              <div className="space-y-3">
                {trade.status === 'ESCROW_LOCKED' && (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-400">
                      Step 1: Transfer exact <strong className="text-white">${trade.fiatAmount}</strong> via {trade.paymentMethod.name}.
                      <br />
                      Step 2: Click the button below to notify the seller and freeze the release timer.
                    </p>
                    <button
                      onClick={() => setShowMarkPaidModal(true)}
                      className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      I Have Transferred Funds (Mark as Paid)
                    </button>
                  </div>
                )}

                {trade.status === 'BUYER_MARKED_PAID' && (
                  <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-xs text-cyan-200 space-y-2">
                    <div className="font-bold flex items-center gap-1.5 text-cyan-400">
                      <Clock className="w-4 h-4" />
                      Payment Marked as Sent
                    </div>
                    <p>
                      Reference: <span className="font-mono text-white font-bold">{trade.paymentReference || 'Bank Transfer Confirmed'}</span>.
                      The seller is checking their bank account. Once confirmed, your {trade.cryptoAmount} {trade.cryptoAsset} will be credited to your available balance immediately.
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  {trade.status === 'ESCROW_LOCKED' && (
                    <button
                      onClick={() => onCancelTrade(trade.id)}
                      className="py-2 px-3 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-medium transition-colors"
                    >
                      Cancel Trade
                    </button>
                  )}
                  {!isCompleted && !isDisputed && (
                    <button
                      onClick={() => setShowDisputeModal(true)}
                      className="py-2 px-3 rounded-lg border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 text-xs font-medium transition-colors ml-auto"
                    >
                      Open Dispute
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Seller Controls */}
            {isSeller && (
              <div className="space-y-3">
                {trade.status === 'BUYER_MARKED_PAID' && (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/30 text-xs text-amber-200">
                      Buyer marked paid with reference: <span className="font-mono text-white font-bold">{trade.paymentReference}</span>.
                      Please open your bank/Zelle application and verify ${trade.fiatAmount} has arrived before releasing.
                    </div>
                    <button
                      onClick={() => setShowReleaseConfirmModal(true)}
                      className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Lock className="w-4 h-4" />
                      Confirm Payment Received &amp; Release Escrow
                    </button>
                  </div>
                )}

                {trade.status === 'ESCROW_LOCKED' && (
                  <p className="text-xs text-slate-400">
                    Awaiting buyer payment. {trade.cryptoAmount} {trade.cryptoAsset} is locked in the smart contract escrow.
                  </p>
                )}

                {!isCompleted && !isDisputed && (
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => setShowDisputeModal(true)}
                      className="py-2 px-3 rounded-lg border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 text-xs font-medium transition-colors"
                    >
                      I Haven't Received Payment (Dispute)
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Arbitrator Controls */}
            {isArbitrator && (
              <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs space-y-3">
                <div className="font-bold text-indigo-300">Escrow Arbitrator Control Desk</div>
                <p className="text-slate-300">
                  Inspect proof documents, chat transcripts, and bank transaction hashes below to issue a final settlement.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onSimulateAction(trade.id, 'ARBITRATOR_RESOLVE_BUYER')}
                    className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs"
                  >
                    Release Escrow to Buyer (Proof Valid)
                  </button>
                  <button
                    onClick={() => onSimulateAction(trade.id, 'ARBITRATOR_RESOLVE_SELLER')}
                    className="flex-1 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
                  >
                    Refund Escrow to Seller (No Receipt)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Cryptographic Audit Trail / Timeline */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <h3 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-400" />
              Cryptographic Escrow Audit Ledger
            </h3>
            <div className="space-y-3">
              {trade.timeline.map((event, idx) => (
                <div key={event.id} className="relative pl-6 pb-3 last:pb-0 border-l border-slate-800">
                  <div className="absolute left-[-5px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white">{event.title}</span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{event.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-mono text-slate-500">Hash: {event.txHash}</span>
                    <button
                      onClick={() => handleCopy(event.txHash, event.id)}
                      className="text-slate-500 hover:text-emerald-400"
                    >
                      {copiedText === event.id ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Counterparty Reputation Card & Real-Time Chat */}
        <div className="lg:col-span-5 space-y-6">
          {/* Counterparty Reputation Scorecard */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs font-semibold text-slate-400">Counterparty Reputation</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold uppercase">
                {trade.seller.trustLevelLabel}
              </span>
            </div>

            <div className="flex items-center gap-3.5 mt-4">
              <img
                src={trade.seller.avatar}
                alt={trade.seller.name}
                className="w-12 h-12 rounded-xl object-cover border border-slate-700"
              />
              <div>
                <div className="font-bold text-white text-base flex items-center gap-1.5">
                  {trade.seller.name}
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                  <span>Trust Score:</span>
                  <span className="font-extrabold text-emerald-400 font-mono text-sm">
                    {trade.seller.score}%
                  </span>
                </div>
              </div>
            </div>

            {/* Badges Grid */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {trade.seller.badges.map((b) => (
                <span
                  key={b}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-medium"
                >
                  ✓ {b}
                </span>
              ))}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-800/80 text-center">
              <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400">Completion</div>
                <div className="text-xs font-bold text-white mt-0.5">{trade.seller.completionRate}%</div>
              </div>
              <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400">Avg Release</div>
                <div className="text-xs font-bold text-emerald-400 mt-0.5">{trade.seller.avgReleaseTimeMinutes}m</div>
              </div>
              <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400">Total Trades</div>
                <div className="text-xs font-bold text-white mt-0.5">{trade.seller.totalTrades}</div>
              </div>
            </div>
          </div>

          {/* Live In-Trade Chat & Evidence Feed */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col h-[480px] shadow-lg overflow-hidden">
            <div className="p-3.5 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-xs font-bold text-white">Live Trade Chat</span>
              </div>
              <span className="text-[10px] text-slate-400">Encrypted &amp; Auditable by Arbitrator</span>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {trade.chatMessages.map((msg) => {
                if (msg.isSystem) {
                  return (
                    <div key={msg.id} className="text-center my-2">
                      <div className="inline-block bg-slate-950/90 border border-slate-800 text-[11px] text-slate-300 px-3 py-1.5 rounded-xl max-w-[90%]">
                        {msg.text}
                      </div>
                    </div>
                  );
                }

                const isMe =
                  (isBuyer && msg.senderRole === 'BUYER') ||
                  (isSeller && msg.senderRole === 'SELLER');

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-0.5 px-1">
                      <span>{msg.senderName}</span>
                      <span>•</span>
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                        isMe
                          ? 'bg-emerald-600 text-slate-950 font-medium rounded-tr-none'
                          : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-none'
                      }`}
                    >
                      {msg.text}
                      {msg.receiptImage && (
                        <div className="mt-2 pt-2 border-t border-black/10">
                          <span className="text-[10px] font-bold block mb-1">Attached Payment Receipt:</span>
                          <img
                            src={msg.receiptImage}
                            alt="Receipt"
                            className="rounded-lg max-h-36 object-cover border border-slate-700"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Canned Prompts */}
            <div className="px-3 py-1.5 bg-slate-950/50 border-t border-slate-800/70 flex gap-1.5 overflow-x-auto text-[11px]">
              <button
                type="button"
                onClick={() => setChatInput('Payment transferred via Zelle, reference TRD-84920.')}
                className="whitespace-nowrap px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                "Payment transferred"
              </button>
              <button
                type="button"
                onClick={() => setChatInput('Checking bank app now, one minute please.')}
                className="whitespace-nowrap px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                "Checking bank now"
              </button>
              <button
                type="button"
                onClick={() => setChatInput('Receipt confirmed, releasing escrow now!')}
                className="whitespace-nowrap px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                "Releasing escrow"
              </button>
            </div>

            {/* Chat Input Bar */}
            <form onSubmit={handleSendChat} className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setReceiptSimulated('https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&auto=format&fit=crop&q=80');
                  setChatInput('Uploaded verified bank transfer receipt screenshot.');
                }}
                className={`p-2 rounded-xl border transition-colors ${
                  receiptSimulated
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
                title="Attach Simulated Payment Proof"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type message to counterparty..."
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />

              <button
                type="submit"
                className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 transition-colors cursor-pointer"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Mark As Paid Modal */}
      {showMarkPaidModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Confirm Payment Sent</h3>
            <p className="text-xs text-slate-400 mb-4">
              Please enter your bank transfer reference ID or transaction confirmation code. Do not mark as paid if funds haven't left your account.
            </p>

            <form onSubmit={submitMarkPaid} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Bank / Transfer Reference Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. ZEL-92819024 or Chase Ref #4912"
                  value={paymentRefInput}
                  onChange={(e) => setPaymentRefInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
                  <span>Attach Bank Proof / Receipt</span>
                  <button
                    type="button"
                    onClick={() => setReceiptSimulated('https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&auto=format&fit=crop&q=80')}
                    className="text-[11px] text-emerald-400 font-bold hover:underline"
                  >
                    {receiptSimulated ? '✓ Receipt Attached' : '+ Attach Receipt'}
                  </button>
                </div>
                {receiptSimulated && (
                  <p className="text-[11px] text-emerald-400/90 font-mono">
                    bank_receipt_wire_0219.png (Verified)
                  </p>
                )}
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300">
                Warning: Making a false declaration degrades your trader trust score and risks account suspension.
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowMarkPaidModal(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-sm font-bold shadow-lg shadow-emerald-600/20"
                >
                  Confirm &amp; Notify Seller
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Release Escrow Confirm Modal */}
      {showReleaseConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-3">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white text-center mb-1">Release Escrow Funds</h3>
            <p className="text-xs text-slate-400 text-center mb-4">
              Are you sure you want to release <strong className="text-white">{trade.cryptoAmount} {trade.cryptoAsset}</strong> to {trade.buyer.name}?
              This action is cryptographically irreversible on the smart contract.
            </p>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs space-y-1.5 mb-4">
              <div className="flex justify-between text-slate-400">
                <span>Received Fiat Amount:</span>
                <span className="font-bold text-white">${trade.fiatAmount.toFixed(2)} {trade.fiatCurrency}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Escrow Smart Vault:</span>
                <span className="font-mono text-emerald-400">#0xescrow_a82f7103e91d</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowReleaseConfirmModal(false)}
                className="w-1/2 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-medium"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowReleaseConfirmModal(false);
                  onReleaseEscrow(trade.id);
                }}
                className="w-1/2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-sm font-bold shadow-lg shadow-emerald-600/20"
              >
                Yes, Release Escrow
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispute Modal */}
      {showDisputeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center gap-2 mb-2 text-rose-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-lg font-bold text-white">Open Escrow Dispute</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Opening a dispute freezes the escrow vault and summons a verified TrustPeer Arbitrator to review chat logs, payment receipts, and bank statements.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Reason for Dispute
                </label>
                <textarea
                  rows={3}
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowDisputeModal(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDisputeModal(false);
                    onRaiseDispute(trade.id, disputeReason);
                  }}
                  className="w-1/2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold shadow-lg shadow-rose-600/20"
                >
                  Submit Dispute
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
