import React, { useEffect, useRef } from 'react';
import { Trophy, X, XCircle } from 'lucide-react';
import { WingoRound } from '../types';

export interface ResultModalData {
  title: string;
  subtitle: string;
  won: boolean;
  staked: number;
  payout: number;
  netProfit: number;
  updatedBalance: number;
  wingoRound?: WingoRound;
  detailLine?: string;
}

interface ResultModalProps {
  data: ResultModalData | null;
  onClose: () => void;
}

export const ResultModal: React.FC<ResultModalProps> = ({ data, onClose }) => {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Auto-dismiss quickly (1.35s) as a small non-blocking floating popup
  useEffect(() => {
    if (!data) return;
    const timer = window.setTimeout(() => {
      onCloseRef.current();
    }, 1350);
    return () => window.clearTimeout(timer);
  }, [data]);

  if (!data) return null;

  const round = data.wingoRound;
  const ballBg = round
    ? round.number === 0
      ? 'bg-gradient-to-br from-red-500 via-red-600 to-purple-600'
      : round.number === 5
      ? 'bg-gradient-to-br from-emerald-500 via-green-600 to-purple-600'
      : round.colors.includes('green')
      ? 'bg-gradient-to-br from-emerald-400 to-green-600'
      : 'bg-gradient-to-br from-rose-500 to-red-600'
    : 'bg-slate-700';

  return (
    <div className="pointer-events-none fixed top-16 left-0 right-0 z-50 flex justify-center px-3">
      <div
        className={`pointer-events-auto relative w-full max-w-[290px] rounded-2xl border px-3.5 py-2.5 shadow-[0_12px_35px_rgba(0,0,0,0.65)] backdrop-blur-md transition-all ${
          data.won
            ? 'bg-[#08241d]/95 border-emerald-400/80'
            : 'bg-[#260f19]/95 border-rose-400/75'
        }`}
      >
        <button
          onClick={onClose}
          aria-label="Close result popup"
          className="absolute right-2 top-2 rounded-full p-0.5 text-slate-300 hover:bg-white/10 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="flex items-center gap-2.5 pr-4">
          {round ? (
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-extrabold text-white border border-white/80 shadow ${ballBg}`}
            >
              {round.number}
            </div>
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10">
              {data.won ? (
                <Trophy className="h-4 w-4 text-amber-400" />
              ) : (
                <XCircle className="h-4 w-4 text-rose-400" />
              )}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-sm font-extrabold uppercase tracking-wider ${
                  data.won ? 'text-emerald-300' : 'text-rose-300'
                }`}
              >
                {data.won ? 'WIN' : 'LOSS'}
              </span>
              <span
                className={`text-sm font-extrabold tabular-nums ${
                  data.won ? 'text-emerald-300' : 'text-rose-300'
                }`}
              >
                {data.won ? `+₹${data.payout.toFixed(2)}` : `-₹${data.staked.toFixed(2)}`}
              </span>
            </div>

            <div className="truncate text-[10px] font-medium text-slate-300">
              {round
                ? `#${round.number} · ${round.colors.join('+').toUpperCase()} · ${round.size.toUpperCase()}`
                : data.subtitle}
            </div>
            <div className="text-[10px] font-semibold text-white/90 tabular-nums">
              Bal: ₹{data.updatedBalance.toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
