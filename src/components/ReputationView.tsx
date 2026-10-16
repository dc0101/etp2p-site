import React from 'react';
import { 
  Award, 
  ShieldCheck, 
  Clock, 
  Star, 
  CheckCircle2, 
  TrendingUp, 
  AlertTriangle, 
  Lock, 
  Layers, 
  ChevronRight,
  Flame,
  UserCheck
} from 'lucide-react';
import { ReputationProfile } from '../types/p2p.ts';
import { TradeHistoryChart } from './TradeHistoryChart.tsx';

interface ReputationViewProps {
  userProfile: ReputationProfile & { name: string; avatar: string; email: string };
  topTraders: Array<ReputationProfile & { id: string; name: string; avatar: string }>;
}

export const ReputationView: React.FC<ReputationViewProps> = ({
  userProfile,
  topTraders,
}) => {
  const reviews = [
    {
      id: 'rev_1',
      author: 'Marcus Vance',
      authorTier: 'PRO TRADER',
      rating: 5,
      date: 'Yesterday',
      text: 'Super clean trade. Funds locked in escrow within 30 seconds and released immediately once Zelle arrived. 10/10 trader.',
      speed: 5,
      communication: 5,
    },
    {
      id: 'rev_2',
      author: 'Elena Rostova',
      authorTier: 'ELITE MERCHANT',
      rating: 5,
      date: '3 days ago',
      text: 'Fast payer! Provided bank wire confirmation reference in chat right away. Pleasure doing business.',
      speed: 5,
      communication: 5,
    },
    {
      id: 'rev_3',
      author: 'David Kim',
      authorTier: 'VERIFIED',
      rating: 5,
      date: '1 week ago',
      text: 'Great communication during SEPA bank transfer. Escrow protocol made the entire process worry-free.',
      speed: 4,
      communication: 5,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Hero Reputation Score Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <img
              src={userProfile.avatar}
              alt={userProfile.name}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-500/30 shadow-lg"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-white">{userProfile.name}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {userProfile.trustLevelLabel}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Account ID: <span className="font-mono text-slate-300">usr_me_01</span> • Member since Oct 2024
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {userProfile.badges.map((badge: string) => (
                  <span
                    key={badge}
                    className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-200 border border-slate-700 font-semibold"
                  >
                    ✓ {badge}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Large Trust Score Dial */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 flex items-center gap-5 shrink-0">
            <div className="relative flex items-center justify-center">
              <div className="w-20 h-20 rounded-full border-4 border-slate-800 border-t-emerald-400 border-r-emerald-400 flex items-center justify-center">
                <span className="text-2xl font-black text-emerald-400 font-mono">
                  {userProfile.score}
                </span>
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-400 font-bold">
                Trust Index Rating
              </div>
              <div className="text-sm font-bold text-white mt-0.5">Top 3% of Global Merchants</div>
              <div className="text-xs text-slate-400 mt-1">
                Max Escrow Limit: <strong className="text-emerald-400 font-mono">${userProfile.maxEscrowLimitUSD.toLocaleString()}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Reputation Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800">
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
            <div className="text-xs text-slate-400 font-medium">Completion Rate</div>
            <div className="text-xl font-black text-white mt-1">{userProfile.completionRate}%</div>
            <div className="text-[10px] text-slate-500 mt-0.5">{userProfile.totalTrades} completed orders</div>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
            <div className="text-xs text-slate-400 font-medium">Avg Release Speed</div>
            <div className="text-xl font-black text-emerald-400 mt-1 flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {userProfile.avgReleaseTimeMinutes} mins
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Faster than 94% of sellers</div>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
            <div className="text-xs text-slate-400 font-medium">Feedback Ratio</div>
            <div className="text-xl font-black text-amber-400 mt-1 flex items-center gap-1">
              <Star className="w-4 h-4 fill-amber-400" />
              {userProfile.positiveCount} Positive
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">{userProfile.negativeCount} negative feedback</div>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
            <div className="text-xs text-slate-400 font-medium">Escrow Custody Fee</div>
            <div className="text-xl font-black text-indigo-400 mt-1">0.25%</div>
            <div className="text-[10px] text-emerald-400 mt-0.5">58% fee discount unlocked</div>
          </div>
        </div>
      </div>

      {/* D3-Powered 30-Day Escrow Trading Trend Line */}
      <TradeHistoryChart totalTrades={userProfile.totalTrades} />

      {/* Tier Benefits & Unlock Milestones */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm mb-2">
            <Award className="w-4 h-4" />
            Tier Progress to Elite Merchant
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-3">
            <div className="bg-amber-400 h-full w-[82%]"></div>
          </div>
          <div className="flex justify-between text-[11px] text-slate-400 mt-1.5 font-medium">
            <span>Score: {userProfile.score}/100</span>
            <span>Requires: 95.0 + 50 trades</span>
          </div>
          <p className="text-xs text-slate-300 mt-3">
            Reach 95+ score to unlock 0.10% VIP escrow fee, $100,000 single transaction capacity, and priority dispute review.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm mb-2">
            <ShieldCheck className="w-4 h-4" />
            Staked Escrow Collateral
          </div>
          <div className="text-2xl font-black text-white font-mono mt-2">$25,000</div>
          <div className="text-xs text-emerald-400 font-medium mt-0.5">Insurance Guarantee Pool Active</div>
          <p className="text-xs text-slate-300 mt-2">
            Merchants with staked collateral receive an instant trust boost and automated buyer preference in search rankings.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm mb-2">
            <Lock className="w-4 h-4" />
            Zero-Dispute Privilege
          </div>
          <div className="text-2xl font-black text-white font-mono mt-2">0.7%</div>
          <div className="text-xs text-slate-400 font-medium mt-0.5">Dispute Rate (Threshold: &lt; 2%)</div>
          <p className="text-xs text-slate-300 mt-2">
            Maintaining a dispute rate under 1.5% exempts your account from mandatory 24h escrow clearing delays.
          </p>
        </div>
      </div>

      {/* 2-Column: Public Reviews & Top Merchants Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Reviews (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-base font-bold text-white">Recent Counterparty Reviews</h2>
              <p className="text-xs text-slate-400">Ratings submitted by verified trading partners after escrow release.</p>
            </div>
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
              100% Verified Trades
            </span>
          </div>

          <div className="space-y-3">
            {reviews.map((rev) => (
              <div key={rev.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-xs">{rev.author}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                      {rev.authorTier}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">{rev.date}</span>
                </div>

                <div className="flex items-center gap-1">
                  {[...Array(rev.rating)].map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  ))}
                  <span className="text-xs font-bold text-amber-400 ml-1">5.0</span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">{rev.text}</p>

                <div className="flex items-center gap-4 pt-1 text-[11px] text-slate-400">
                  <span>Speed: <strong className="text-slate-200">{rev.speed}/5</strong></span>
                  <span>Communication: <strong className="text-slate-200">{rev.communication}/5</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Merchants Leaderboard (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-400" />
              <h2 className="text-base font-bold text-white">Top Verified Merchants</h2>
            </div>
            <span className="text-[11px] text-slate-400">Trust Rankings</span>
          </div>

          <div className="space-y-2.5">
            {topTraders.map((trader, idx) => (
              <div
                key={trader.id}
                className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-800 font-bold text-xs flex items-center justify-center text-slate-300">
                    #{idx + 1}
                  </div>
                  <img
                    src={trader.avatar}
                    alt={trader.name}
                    className="w-9 h-9 rounded-xl object-cover border border-slate-700"
                  />
                  <div>
                    <div className="font-bold text-white text-xs flex items-center gap-1">
                      {trader.name}
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium">
                      {trader.totalTrades} trades • {trader.completionRate}% completion
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-black text-emerald-400 font-mono">
                    {trader.score}%
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {trader.avgReleaseTimeMinutes}m avg
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
