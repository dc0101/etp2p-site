import React, { useState, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import { 
  TrendingUp, 
  Calendar, 
  CheckCircle2, 
  ArrowUpRight, 
  BarChart3, 
  Activity,
  Layers,
  Sparkles
} from 'lucide-react';
import { 
  generate30DayTradeHistory, 
  compute30DayTradeStats, 
  DayTradeDataPoint 
} from '../utils/tradeHistoryChartData.ts';

interface TradeHistoryChartProps {
  totalTrades?: number;
}

export const TradeHistoryChart: React.FC<TradeHistoryChartProps> = ({ totalTrades = 146 }) => {
  const [metric, setMetric] = useState<'DAILY' | 'CUMULATIVE' | 'VOLUME'>('DAILY');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // 30 days data and computed stats
  const data = useMemo(() => generate30DayTradeHistory(totalTrades), [totalTrades]);
  const stats = useMemo(() => compute30DayTradeStats(data), [data]);

  // Chart dimensions
  const width = 800;
  const height = 280;
  const padding = { top: 20, right: 25, bottom: 35, left: 45 };

  // Helper to extract value based on selected metric
  const getValue = (d: DayTradeDataPoint): number => {
    if (metric === 'DAILY') return d.completedTrades;
    if (metric === 'CUMULATIVE') return d.cumulativeTrades;
    return d.volumeUSD;
  };

  const maxY = useMemo(() => {
    const rawMax = d3.max(data, (d) => getValue(d)) || 10;
    return Math.ceil(rawMax * 1.15);
  }, [data, metric]);

  // Scales
  const xScale = useMemo(() => {
    return d3.scaleLinear()
      .domain([0, data.length - 1])
      .range([padding.left, width - padding.right]);
  }, [data.length, padding.left, width, padding.right]);

  const yScale = useMemo(() => {
    return d3.scaleLinear()
      .domain([0, maxY])
      .range([height - padding.bottom, padding.top]);
  }, [maxY, height, padding.bottom, padding.top]);

  // D3 Path generators with smooth monotonic spline interpolation
  const linePath = useMemo(() => {
    const lineGenerator = d3.line<DayTradeDataPoint>()
      .x((_, i) => xScale(i))
      .y((d) => yScale(getValue(d)))
      .curve(d3.curveMonotoneX);
    return lineGenerator(data) || '';
  }, [data, xScale, yScale, metric]);

  const areaPath = useMemo(() => {
    const areaGenerator = d3.area<DayTradeDataPoint>()
      .x((_, i) => xScale(i))
      .y0(height - padding.bottom)
      .y1((d) => yScale(getValue(d)))
      .curve(d3.curveMonotoneX);
    return areaGenerator(data) || '';
  }, [data, xScale, yScale, height, padding.bottom, metric]);

  // Y-axis grid ticks
  const yTicks = yScale.ticks(4);

  // X-axis date labels (every 5-6 days)
  const xTickIndices = [0, 6, 12, 18, 24, 29];

  // Mouse hover handler
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const xPos = e.clientX - rect.left;
    const scaleFactor = width / rect.width;
    const svgX = xPos * scaleFactor;

    const clampedX = Math.max(padding.left, Math.min(width - padding.right, svgX));
    const rawIndex = Math.round(xScale.invert(clampedX));
    const safeIndex = Math.max(0, Math.min(data.length - 1, rawIndex));
    setHoveredIndex(safeIndex);
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  const hoveredPoint = hoveredIndex !== null ? data[hoveredIndex] : null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      {/* Header & Metric Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                30-Day Escrow Trading Trend
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  D3.js Powered
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Verifiable on-chain execution and settlement trajectory across recent peer transactions.
              </p>
            </div>
          </div>
        </div>

        {/* View Metric Tabs */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto text-xs">
          <button
            onClick={() => setMetric('DAILY')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
              metric === 'DAILY'
                ? 'bg-emerald-600 text-slate-950 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Daily Trades
          </button>
          <button
            onClick={() => setMetric('CUMULATIVE')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
              metric === 'CUMULATIVE'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Cumulative Curve
          </button>
          <button
            onClick={() => setMetric('VOLUME')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
              metric === 'VOLUME'
                ? 'bg-cyan-600 text-slate-950 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Volume ($)
          </button>
        </div>
      </div>

      {/* 30-Day Quick Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
          <div className="text-[11px] text-slate-400">30D Completed Trades</div>
          <div className="text-lg font-black text-white font-mono mt-0.5">
            {stats.totalTrades} <span className="text-xs font-normal text-slate-400">orders</span>
          </div>
          <div className="text-[10px] text-emerald-400 font-semibold flex items-center gap-0.5 mt-0.5">
            <CheckCircle2 className="w-3 h-3" />
            100% Escrow Fulfilled
          </div>
        </div>

        <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
          <div className="text-[11px] text-slate-400">30D Volume Settled</div>
          <div className="text-lg font-black text-emerald-400 font-mono mt-0.5">
            ${stats.totalVolumeUSD.toLocaleString()}
          </div>
          <div className="text-[10px] text-emerald-400 font-semibold flex items-center gap-0.5 mt-0.5">
            <ArrowUpRight className="w-3 h-3" />
            +{stats.volumeGrowthRatePercent}% MoM Growth
          </div>
        </div>

        <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
          <div className="text-[11px] text-slate-400">Daily Average Speed</div>
          <div className="text-lg font-black text-cyan-400 font-mono mt-0.5">
            {stats.avgTradesPerDay} <span className="text-xs font-normal text-slate-400">trades/day</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Consistent order flow</div>
        </div>

        <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
          <div className="text-[11px] text-slate-400">Peak Single Day</div>
          <div className="text-lg font-black text-amber-400 font-mono mt-0.5">
            {stats.peakDayTrades} <span className="text-xs font-normal text-slate-400">trades</span>
          </div>
          <div className="text-[10px] text-amber-400/90 mt-0.5">On {stats.peakDayDate}</div>
        </div>
      </div>

      {/* SVG Interactive Chart with D3 */}
      <div className="relative bg-slate-950 rounded-2xl border border-slate-800/90 p-3 pt-6 overflow-hidden">
        {/* Hover Tooltip Badge */}
        {hoveredPoint && (
          <div
            className="absolute top-4 left-6 z-10 bg-slate-900/95 border border-emerald-500/40 rounded-xl px-3.5 py-2 shadow-2xl backdrop-blur-md pointer-events-none flex items-center gap-4 text-xs transition-all"
          >
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                {hoveredPoint.date} (Day {hoveredPoint.dayIndex})
              </span>
              <span className="font-extrabold text-white text-sm font-mono">
                {hoveredPoint.completedTrades} Completed Trades
              </span>
            </div>
            <div className="border-l border-slate-800 pl-3">
              <span className="text-[10px] text-slate-400 block">Volume Settled</span>
              <span className="font-bold text-emerald-400 font-mono">
                ${hoveredPoint.volumeUSD.toLocaleString()} USD
              </span>
            </div>
            <div className="border-l border-slate-800 pl-3">
              <span className="text-[10px] text-slate-400 block">Cumulative</span>
              <span className="font-bold text-indigo-400 font-mono">
                {hoveredPoint.cumulativeTrades} Total
              </span>
            </div>
          </div>
        )}

        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto cursor-crosshair select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            {/* Emerald Gradient for Daily */}
            <linearGradient id="tradeGradientEmerald" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.45" />
              <stop offset="60%" stopColor="#10B981" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
            </linearGradient>

            {/* Indigo Gradient for Cumulative */}
            <linearGradient id="tradeGradientIndigo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366F1" stopOpacity="0.45" />
              <stop offset="60%" stopColor="#6366F1" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#6366F1" stopOpacity="0.0" />
            </linearGradient>

            {/* Cyan Gradient for Volume */}
            <linearGradient id="tradeGradientCyan" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.45" />
              <stop offset="60%" stopColor="#06B6D4" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid Lines & Y Axis Ticks */}
          {yTicks.map((tick) => {
            const y = yScale(tick);
            return (
              <g key={tick}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="#1E293B"
                  strokeDasharray="3 3"
                />
                <text
                  x={padding.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="#64748B"
                  fontFamily="monospace"
                >
                  {metric === 'VOLUME' ? `$${(tick / 1000).toFixed(0)}k` : tick}
                </text>
              </g>
            );
          })}

          {/* Shaded Area */}
          <path
            d={areaPath}
            fill={
              metric === 'DAILY'
                ? 'url(#tradeGradientEmerald)'
                : metric === 'CUMULATIVE'
                ? 'url(#tradeGradientIndigo)'
                : 'url(#tradeGradientCyan)'
            }
          />

          {/* Main Trend Line Stroke */}
          <path
            d={linePath}
            fill="none"
            stroke={metric === 'DAILY' ? '#10B981' : metric === 'CUMULATIVE' ? '#818CF8' : '#06B6D4'}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* X Axis Date Labels */}
          {xTickIndices.map((idx) => {
            const item = data[idx];
            if (!item) return null;
            const x = xScale(idx);
            return (
              <text
                key={item.dayIndex}
                x={x}
                y={height - 12}
                textAnchor="middle"
                fontSize="10"
                fill="#64748B"
                fontWeight="500"
              >
                {item.date}
              </text>
            );
          })}

          {/* Active Hover Crosshair & Data Indicator */}
          {hoveredIndex !== null && (
            <g>
              <line
                x1={xScale(hoveredIndex)}
                y1={padding.top}
                x2={xScale(hoveredIndex)}
                y2={height - padding.bottom}
                stroke={metric === 'DAILY' ? '#34D399' : metric === 'CUMULATIVE' ? '#818CF8' : '#06B6D4'}
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              <circle
                cx={xScale(hoveredIndex)}
                cy={yScale(getValue(data[hoveredIndex]))}
                r="6"
                fill={metric === 'DAILY' ? '#10B981' : metric === 'CUMULATIVE' ? '#6366F1' : '#06B6D4'}
                stroke="#FFFFFF"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>

        {/* Legend strip */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-850 px-2">
          <span>Continuous 30-Day Window: 30 of 30 days active</span>
          <span>Hover anywhere on the curve to inspect daily escrow volume</span>
        </div>
      </div>
    </div>
  );
};
