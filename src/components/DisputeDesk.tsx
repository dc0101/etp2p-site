import React, { useState } from 'react';
import { 
  AlertTriangle, 
  ShieldCheck, 
  CheckCircle2, 
  FileText, 
  Lock, 
  Scale, 
  User, 
  ExternalLink, 
  Clock 
} from 'lucide-react';
import { Trade, UserRole } from '../types/p2p.ts';

interface DisputeDeskProps {
  trade: Trade | null;
  activeRole: UserRole;
  onResolveDispute: (tradeId: string, resolution: 'BUYER' | 'SELLER', notes: string) => void;
  onNavigateToEscrow: () => void;
}

export const DisputeDesk: React.FC<DisputeDeskProps> = ({
  trade,
  activeRole,
  onResolveDispute,
  onNavigateToEscrow,
}) => {
  const [arbitratorNotes, setArbitratorNotes] = useState(
    'Bank statement submitted by buyer matches recipient name and amount with unique reference code.'
  );

  const isDisputed = trade?.status === 'DISPUTED';

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Scale className="w-5 h-5 text-rose-400" />
              <h1 className="text-2xl font-black text-white">TrustPeer Arbitration &amp; Dispute Desk</h1>
            </div>
            <p className="text-xs text-slate-400">
              When trades encounter delays or payment discrepancies, the smart escrow vault freezes until neutral arbitrators evaluate cryptographic and banking evidence.
            </p>
          </div>
          <span className="text-xs bg-slate-800 px-3 py-1.5 rounded-xl text-slate-300 font-mono self-start md:self-auto">
            Arbitration Multi-Sig Protocol 2.4
          </span>
        </div>
      </div>

      {!trade || !isDisputed ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center max-w-xl mx-auto shadow-lg space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-white">No Active Disputes Pending</h2>
          <p className="text-xs text-slate-400">
            All ongoing trades are progressing through standard escrow phases without conflict.
          </p>
          {trade && (
            <button
              onClick={onNavigateToEscrow}
              className="mt-2 text-xs text-emerald-400 hover:underline inline-block font-semibold"
            >
              Go to Active Escrow Tracker (Trade #{trade.id}) &rarr;
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Dispute Case Info (7 cols) */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider">
                  Case Under Review
                </span>
                <h3 className="text-base font-bold text-white">
                  Dispute Case: Trade #{trade.id}
                </h3>
              </div>
              <span className="text-xs font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Arbitrator Window Active
              </span>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="text-xs flex justify-between text-slate-400">
                <span>Disputed Asset:</span>
                <strong className="text-white font-mono">{trade.cryptoAmount} {trade.cryptoAsset} (${trade.fiatAmount} {trade.fiatCurrency})</strong>
              </div>
              <div className="text-xs flex justify-between text-slate-400">
                <span>Escrow Smart Vault:</span>
                <span className="font-mono text-emerald-400">#0xescrow_a82f7103e91d (FROZEN)</span>
              </div>
              <div className="text-xs flex justify-between text-slate-400">
                <span>Filed Reason:</span>
                <span className="text-rose-300 font-medium">
                  {trade.dispute?.reason || 'Payment sent but counterparty has not released funds.'}
                </span>
              </div>
            </div>

            {/* Evidence Locker */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Submitted Evidence Documents
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-start gap-3">
                  <FileText className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-white">Zelle Confirmation PDF</div>
                    <div className="text-[10px] text-slate-400">Ref: {trade.paymentReference || 'ZEL-92819024'}</div>
                    <span className="text-[10px] text-emerald-400 font-semibold">✓ Cryptographically Verified</span>
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-start gap-3">
                  <FileText className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-white">In-Trade Chat Transcript</div>
                    <div className="text-[10px] text-slate-400">{trade.chatMessages.length} Messages logged</div>
                    <span className="text-[10px] text-cyan-400 font-semibold">✓ Non-repudiation audit hash</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Arbitrator Ruling Panel (5 cols) */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <Scale className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base font-bold text-white">Arbitrator Settlement Ruling</h3>
            </div>

            <p className="text-xs text-slate-400">
              As an authorized Escrow Arbitrator, you can execute a binding multi-signature unlock to resolve the frozen vault.
            </p>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Official Ruling Justification
              </label>
              <textarea
                rows={3}
                value={arbitratorNotes}
                onChange={(e) => setArbitratorNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => onResolveDispute(trade.id, 'BUYER', arbitratorNotes)}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                Rule in Favor of Buyer (Release {trade.cryptoAmount} {trade.cryptoAsset})
              </button>

              <button
                onClick={() => onResolveDispute(trade.id, 'SELLER', arbitratorNotes)}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-600/20 transition-all cursor-pointer"
              >
                Rule in Favor of Seller (Refund Escrow to Seller)
              </button>
            </div>

            <div className="text-[11px] text-slate-500 border-t border-slate-800 pt-3">
              Note: Ruling will automatically adjust the losing party's reputation score and increase their dispute penalty index.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
