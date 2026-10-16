import React from 'react';
import { ShieldCheck, Wallet, ArrowLeftRight, Award, AlertTriangle, UserCheck, Lock } from 'lucide-react';
import { UserRole } from '../types/p2p.ts';

interface NavbarProps {
  activeTab: 'MARKETPLACE' | 'ESCROW_TRACKER' | 'WALLET' | 'REPUTATION' | 'DISPUTES';
  setActiveTab: (tab: 'MARKETPLACE' | 'ESCROW_TRACKER' | 'WALLET' | 'REPUTATION' | 'DISPUTES') => void;
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
  hasActiveTrade: boolean;
  totalPortfolioUsd: number;
  lockedInEscrowUsd: number;
  userTrustScore: number;
  userTier: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  activeRole,
  setActiveRole,
  hasActiveTrade,
  totalPortfolioUsd,
  lockedInEscrowUsd,
  userTrustScore,
  userTier,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50 shadow-md">
      {/* Top Banner: Escrow Security Status */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 border-b border-emerald-500/20 px-4 py-1.5 text-xs text-slate-300 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="font-medium text-emerald-300">Escrow Vault Active:</span>
          <span className="hidden sm:inline text-slate-400">All P2P transactions protected by multi-signature smart escrow & reputation limits</span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-slate-400">Vault Balance Protected: <strong className="text-emerald-400">${lockedInEscrowUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">Your Trust Score: <strong className="text-amber-400">{userTrustScore}%</strong></span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('MARKETPLACE')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <ShieldCheck className="w-6 h-6 text-slate-950 font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-tight text-white">Trust<span className="text-emerald-400">Peer</span></span>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Escrow v2.4
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">P2P Trading & Secure Escrow Vault</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Main Navigation">
            <button
              onClick={() => setActiveTab('MARKETPLACE')}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'MARKETPLACE'
                  ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>Marketplace</span>
            </button>

            <button
              onClick={() => setActiveTab('ESCROW_TRACKER')}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 relative ${
                activeTab === 'ESCROW_TRACKER'
                  ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Lock className="w-4 h-4 text-emerald-400" />
              <span>Escrow Tracker</span>
              {hasActiveTrade && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500 text-slate-950 animate-pulse">
                  LIVE
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('WALLET')}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'WALLET'
                  ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Wallet className="w-4 h-4 text-cyan-400" />
              <span>Secure Vault &amp; Wallet</span>
            </button>

            <button
              onClick={() => setActiveTab('REPUTATION')}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'REPUTATION'
                  ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Award className="w-4 h-4 text-amber-400" />
              <span>Reputation Hub</span>
            </button>

            <button
              onClick={() => setActiveTab('DISPUTES')}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'DISPUTES'
                  ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>Dispute Desk</span>
            </button>
          </nav>

          {/* Right Controls: Perspective Switcher & Wallet Quick Pill */}
          <div className="flex items-center gap-3">
            {/* View Role Switcher */}
            <div className="hidden lg:flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 px-2 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                Role:
              </span>
              <button
                onClick={() => setActiveRole('BUYER')}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${
                  activeRole === 'BUYER'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Switch perspective to Buyer"
              >
                Buyer (You)
              </button>
              <button
                onClick={() => setActiveRole('SELLER')}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${
                  activeRole === 'SELLER'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Switch perspective to Counterparty Seller"
              >
                Seller (Elena)
              </button>
              <button
                onClick={() => setActiveRole('ARBITRATOR')}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${
                  activeRole === 'ARBITRATOR'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Switch perspective to Escrow Arbitrator"
              >
                Arbitrator
              </button>
            </div>

            {/* Quick Wallet Balance Pill */}
            <button
              onClick={() => setActiveTab('WALLET')}
              className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-xl flex items-center gap-2 transition-colors text-left"
              aria-label="View Wallet Balances"
            >
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                $
              </div>
              <div>
                <div className="text-[10px] text-slate-400 leading-none">Vault Balance</div>
                <div className="text-xs font-bold text-white leading-tight">
                  ${totalPortfolioUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="flex md:hidden items-center justify-between py-2 border-t border-slate-800 text-xs overflow-x-auto gap-2">
          <button
            onClick={() => setActiveTab('MARKETPLACE')}
            className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap ${
              activeTab === 'MARKETPLACE' ? 'bg-emerald-600 text-white' : 'text-slate-400'
            }`}
          >
            Marketplace
          </button>
          <button
            onClick={() => setActiveTab('ESCROW_TRACKER')}
            className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap flex items-center gap-1 ${
              activeTab === 'ESCROW_TRACKER' ? 'bg-emerald-600 text-white' : 'text-slate-400'
            }`}
          >
            Escrow Tracker {hasActiveTrade && '●'}
          </button>
          <button
            onClick={() => setActiveTab('WALLET')}
            className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap ${
              activeTab === 'WALLET' ? 'bg-emerald-600 text-white' : 'text-slate-400'
            }`}
          >
            Vault &amp; Wallet
          </button>
          <button
            onClick={() => setActiveTab('REPUTATION')}
            className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap ${
              activeTab === 'REPUTATION' ? 'bg-emerald-600 text-white' : 'text-slate-400'
            }`}
          >
            Reputation
          </button>
          <button
            onClick={() => setActiveTab('DISPUTES')}
            className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap ${
              activeTab === 'DISPUTES' ? 'bg-emerald-600 text-white' : 'text-slate-400'
            }`}
          >
            Disputes
          </button>
        </div>
      </div>
    </header>
  );
};
