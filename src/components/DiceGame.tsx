import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Coins,
  Flame,
  Headphones,
  History,
  Minus,
  Plus,
  RefreshCw,
  Volume2,
  VolumeX,
  Wallet,
  X,
} from 'lucide-react';
import { BetRecord, DiceRollResult, UserProfile } from '../types';
import {
  playDiceShake,
  playLossTone,
  playWinChime,
  setSoundMuted,
} from '../utils/sound';

interface DiceGameProps {
  user: UserProfile | null;
  token: string | null;
  myBets: BetRecord[];
  onBack: () => void;
  onRequireAuth: () => void;
  onOpenDeposit: () => void;
  onOpenSupport: () => void;
  onBalanceUpdate: (newBalance: number) => void;
  onBetPlaced: (bet: BetRecord) => void;
}

const PRESETS = [10, 50, 100, 500, 1000];

const PIP_COORDS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [
    [28, 28],
    [72, 72],
  ],
  3: [
    [28, 28],
    [50, 50],
    [72, 72],
  ],
  4: [
    [28, 28],
    [72, 28],
    [28, 72],
    [72, 72],
  ],
  5: [
    [28, 28],
    [72, 28],
    [50, 50],
    [28, 72],
    [72, 72],
  ],
  6: [
    [28, 25],
    [72, 25],
    [28, 50],
    [72, 50],
    [28, 75],
    [72, 75],
  ],
};

const DieCubeSvg: React.FC<{ value: number; rolling: boolean; accent: 'cyan' | 'emerald' }> = ({
  value,
  rolling,
  accent,
}) => {
  const pips = PIP_COORDS[Math.max(1, Math.min(6, value))];
  const borderColor = accent === 'cyan' ? '#38bdf8' : '#34d399';
  return (
    <svg
      viewBox="0 0 100 100"
      className={`h-14 w-14 sm:h-16 sm:w-16 drop-shadow-[0_6px_16px_rgba(0,0,0,0.65)] ${
        rolling ? 'animate-dice-tumble gpu-layer' : ''
      }`}
    >
      <defs>
        <linearGradient id={`dieFace-${accent}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </linearGradient>
      </defs>
      <rect
        x="8"
        y="8"
        width="84"
        height="84"
        rx="18"
        fill={`url(#dieFace-${accent})`}
        stroke={borderColor}
        strokeWidth="4"
      />
      {pips.map(([cx, cy], idx) => (
        <circle
          key={idx}
          cx={cx}
          cy={cy}
          r="8"
          fill={value === 1 ? '#e11d48' : '#0f172a'}
        />
      ))}
    </svg>
  );
};

export const DiceGame: React.FC<DiceGameProps> = ({
  user,
  token,
  myBets,
  onBack,
  onRequireAuth,
  onOpenDeposit,
  onOpenSupport,
  onBalanceUpdate,
  onBetPlaced,
}) => {
  const [muted, setMuted] = useState(false);
  const [direction, setDirection] = useState<'over' | 'under'>('under');
  const [target, setTarget] = useState<number>(50);
  const [stakeInput, setStakeInput] = useState('10');
  const [rolling, setRolling] = useState(false);
  const [lastResult, setLastResult] = useState<DiceRollResult | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [showPresets, setShowPresets] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const underChance = Math.max(2, Math.min(98, target));
  const overChance = Math.max(2, Math.min(98, 100 - target));
  const activeChance = direction === 'under' ? underChance : overChance;
  const multiplier = Number((97 / activeChance).toFixed(2));
  const numericStake = Number(stakeInput) || 0;
  const potentialWin = Number((numericStake * multiplier).toFixed(2));

  const myDiceBets = useMemo(
    () => myBets.filter((b) => b.game === 'dice').slice(0, 25),
    [myBets]
  );

  const winStreak = useMemo(() => {
    let s = 0;
    for (const b of myDiceBets) {
      if (b.status === 'won') s += 1;
      else break;
    }
    return s;
  }, [myDiceBets]);

  const dieOneVal = lastResult ? (Math.floor(lastResult.roll) % 6) + 1 : 5;
  const dieTwoVal = lastResult ? (Math.round((lastResult.roll % 1) * 100) % 6) + 1 : 3;

  const toggleSound = () => {
    const next = !muted;
    setMuted(next);
    setSoundMuted(next);
  };

  const adjustStake = (delta: number) => {
    const cur = Number(stakeInput) || 10;
    setStakeInput(String(Math.max(10, Math.min(50000, Math.round(cur + delta)))));
  };

  const handleRoll = async (chosenDir: 'under' | 'over') => {
    setDirection(chosenDir);
    if (!user || !token) {
      onRequireAuth();
      return;
    }
    const amt = Number(stakeInput);
    if (!Number.isFinite(amt) || amt < 10 || amt > 50000) {
      setFeedback({ type: 'err', text: 'Enter a manual bet between ₹10 and ₹50,000.' });
      return;
    }
    if (user.balance < amt) {
      setFeedback({ type: 'err', text: 'Insufficient balance. Tap + Deposit first.' });
      return;
    }

    setRolling(true);
    setFeedback(null);
    if (!muted) playDiceShake();
    try {
      const res = await fetch('/api/dice/roll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: amt,
          direction: chosenDir,
          target,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Dice roll failed.');

      const result = data as DiceRollResult;
      window.setTimeout(() => {
        setLastResult(result);
        onBalanceUpdate(result.balance);
        if (result.bet) onBetPlaced(result.bet);
        setRolling(false);

        if (result.won) {
          if (!muted) playWinChime();
          setFeedback({
            type: 'ok',
            text: `WIN! Rolled ${result.roll.toFixed(2)} — Payout +₹${result.payout.toFixed(2)} (${result.multiplier.toFixed(2)}x)`,
          });
        } else {
          if (!muted) playLossTone();
          setFeedback({
            type: 'err',
            text: `Rolled ${result.roll.toFixed(2)} — Needed ${chosenDir === 'under' ? `< ${target}` : `> ${target}`}.`,
          });
        }
      }, 280);
    } catch (err) {
      setRolling(false);
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Dice roll failed.',
      });
    }
  };

  const markerPos = lastResult ? Math.max(0, Math.min(100, lastResult.roll)) : target;

  return (
    <div className="min-h-screen flex flex-col justify-between bg-gradient-to-b from-[#4a14b8] via-[#3a0d96] to-[#23065c] text-white select-none">
      <header className="shrink-0 flex h-12 items-center justify-between bg-[#24075b]/80 backdrop-blur-md border-b border-white/10 px-3 sm:px-5">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            aria-label="Back to Home"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-black tracking-wide text-white">DICE</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowHistory(true)}
            aria-label="Dice History"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-slate-100 hover:bg-white/20"
          >
            <History className="h-4 w-4" />
          </button>
          <button
            onClick={toggleSound}
            aria-label="Toggle sound"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-slate-100 hover:bg-white/20"
          >
            {muted ? (
              <VolumeX className="h-4 w-4 text-rose-300" />
            ) : (
              <Volume2 className="h-4 w-4 text-emerald-300" />
            )}
          </button>
          <button
            onClick={onOpenSupport}
            aria-label="Support"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-cyan-200 hover:bg-white/20"
          >
            <Headphones className="h-4 w-4" />
          </button>
          {user ? (
            <button
              onClick={onOpenDeposit}
              className="flex items-center gap-1 rounded-full bg-[#190444] border border-white/20 px-3 py-1 text-xs font-extrabold text-white tabular-nums"
            >
              <Wallet className="h-3.5 w-3.5 text-emerald-300" />
              <span>₹{user.balance.toFixed(2)}</span>
            </button>
          ) : (
            <button
              onClick={onRequireAuth}
              className="rounded-full bg-emerald-400 px-3.5 py-1 text-xs font-extrabold text-slate-950"
            >
              Login
            </button>
          )}
        </div>
      </header>

      {/* Main Centered Royal-Violet Dice Stage */}
      <main className="flex-1 flex flex-col justify-center mx-auto w-full max-w-xl px-3 py-3 space-y-2.5">
        {/* Upper Visual Arena: Twin Tumbling Dice + Recent Roll Ribbon + Win Streak */}
        <div className="rounded-2xl bg-[#24085c]/90 border border-white/15 px-3.5 py-3 shadow-xl space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DieCubeSvg value={dieOneVal} rolling={rolling} accent="emerald" />
              <DieCubeSvg value={dieTwoVal} rolling={rolling} accent="cyan" />
            </div>

            <div className="text-right space-y-1">
              {winStreak > 0 && (
                <div className="inline-flex items-center gap-1 rounded-lg bg-emerald-400/20 border border-emerald-400/45 px-2.5 py-1 text-[11px] font-black text-emerald-300">
                  <Flame className="h-3.5 w-3.5 text-amber-300" />
                  <span>STREAK ×{winStreak}</span>
                </div>
              )}
              <div className="text-[11px] font-bold text-violet-200 uppercase tracking-wider">
                {rolling ? 'Rolling Cubes...' : direction === 'under' ? `Win Under ${target}` : `Win Over ${target}`}
              </div>
            </div>
          </div>

          {myDiceBets.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {myDiceBets.slice(0, 8).map((b) => (
                <span
                  key={b.id}
                  className={`shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-extrabold tabular-nums border ${
                    b.status === 'won'
                      ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                      : 'bg-rose-500/20 border-rose-400/40 text-rose-200'
                  }`}
                >
                  {(b.resultText || '').replace(/[^0-9.]/g, '') || (b.status === 'won' ? 'WIN' : 'MISS')}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Dual Barcode Tick Track & Big 50.00 Readout Card */}
        <div className="rounded-2xl bg-[#290969]/90 border border-white/15 p-4 sm:p-5 shadow-2xl space-y-4">
          <div className="text-center">
            <div
              className={`text-5xl sm:text-6xl font-black tabular-nums tracking-tight ${
                !lastResult
                  ? 'text-white'
                  : lastResult.won
                  ? 'text-emerald-300 drop-shadow-[0_0_20px_rgba(52,211,153,0.55)]'
                  : 'text-rose-300 drop-shadow-[0_0_20px_rgba(251,113,133,0.55)]'
              }`}
            >
              {lastResult ? lastResult.roll.toFixed(2) : '50.00'}
            </div>
          </div>

          <div className="relative py-2">
            <div className="relative h-5 rounded-t-md overflow-hidden flex">
              <div
                className="h-full transition-all duration-150"
                style={{
                  width: `${target}%`,
                  backgroundImage:
                    'repeating-linear-gradient(90deg, #a81c45 0px, #a81c45 4px, rgba(0,0,0,0.35) 4px, rgba(0,0,0,0.35) 6px)',
                }}
              />
              <div
                className="h-full transition-all duration-150"
                style={{
                  width: `${100 - target}%`,
                  backgroundImage:
                    'repeating-linear-gradient(90deg, #00b7f1 0px, #00b7f1 4px, rgba(0,0,0,0.28) 4px, rgba(0,0,0,0.28) 6px)',
                }}
              />
            </div>

            <div className="h-1 bg-[#1e0550]" />

            <div className="relative h-5 rounded-b-md overflow-hidden flex">
              <div
                className="h-full transition-all duration-150"
                style={{
                  width: `${target}%`,
                  backgroundImage:
                    'repeating-linear-gradient(90deg, #32d6a0 0px, #32d6a0 4px, rgba(0,0,0,0.28) 4px, rgba(0,0,0,0.28) 6px)',
                }}
              />
              <div
                className="h-full transition-all duration-150"
                style={{
                  width: `${100 - target}%`,
                  backgroundImage:
                    'repeating-linear-gradient(90deg, #8f163b 0px, #8f163b 4px, rgba(0,0,0,0.35) 4px, rgba(0,0,0,0.35) 6px)',
                }}
              />
            </div>

            <div
              className="pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-300"
              style={{ left: `${markerPos}%` }}
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 border-[3px] border-amber-200 shadow-[0_0_16px_rgba(251,191,36,0.95)]">
                <span className="h-2 w-2 rounded-full bg-slate-950" />
              </div>
            </div>
          </div>

          <div className="flex justify-between text-[11px] font-bold text-slate-300 tabular-nums px-0.5">
            <span>0</span>
            <span>25</span>
            <span>50</span>
            <span>75</span>
            <span>100</span>
          </div>
        </div>

        {/* Payout + Interactive Range Slider + Potential Win / Chance Card */}
        <div className="rounded-2xl bg-[#23075b]/90 border border-white/15 p-3.5 shadow-xl space-y-3">
          <div className="grid grid-cols-12 items-center gap-3">
            <div className="col-span-5 text-center space-y-1">
              <div className="text-[11px] font-semibold text-slate-300">Payout</div>
              <div className="rounded-full bg-[#16033b] border border-white/15 py-1.5 px-3 text-base font-black text-white tabular-nums">
                {multiplier.toFixed(2)} x
              </div>
            </div>

            <div className="col-span-7 space-y-1.5">
              <div className="relative flex items-center">
                <input
                  type="range"
                  min={2}
                  max={98}
                  value={target}
                  onChange={(e) => setTarget(Number(e.target.value))}
                  aria-label="Roll Target Threshold"
                  className="w-full accent-violet-400 cursor-pointer h-3"
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-bold text-violet-200">
                <span className="inline-flex items-center gap-0.5">
                  <ChevronLeft className="h-3 w-3" /> Slide Target ({target}) <ChevronRight className="h-3 w-3" />
                </span>
                <span className="tabular-nums">{target}.00</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-white/10 pt-2.5 text-xs">
            <div>
              <span className="text-slate-300">Potential win:</span>{' '}
              <strong className="font-black text-white tabular-nums">
                {potentialWin.toFixed(2)} INR
              </strong>
            </div>
            <div>
              <span className="text-slate-300">Chance:</span>{' '}
              <strong className="font-black text-emerald-300 tabular-nums">
                {activeChance.toFixed(2)} %
              </strong>
            </div>
          </div>
        </div>

        {feedback && (
          <div
            className={`rounded-xl border px-3.5 py-2 text-xs font-semibold ${
              feedback.type === 'ok'
                ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-100'
                : 'bg-rose-500/20 border-rose-400/50 text-rose-100'
            }`}
          >
            {feedback.text}
          </div>
        )}
      </main>

      <footer className="shrink-0 mx-auto w-full max-w-xl rounded-t-3xl sm:rounded-2xl bg-[#210754]/95 border-t sm:border border-white/15 p-3.5 space-y-2.5 shadow-2xl">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDirection((d) => (d === 'under' ? 'over' : 'under'))}
            aria-label="Swap Under and Over mode"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#0ea5e9] to-[#0369a1] border border-cyan-300/40 text-white shadow-lg active:scale-95 transition"
          >
            <RefreshCw className="h-5 w-5" />
          </button>

          <button
            type="button"
            disabled={rolling}
            onClick={() => handleRoll('under')}
            className={`flex-1 flex flex-col items-center justify-center rounded-full py-2 px-3 border shadow-lg transition active:scale-[0.98] disabled:opacity-55 ${
              direction === 'under'
                ? 'bg-gradient-to-b from-[#1dd898] to-[#097a54] border-emerald-200/70'
                : 'bg-gradient-to-b from-[#17b07c] to-[#085e41] border-white/20'
            }`}
          >
            <span className="inline-flex items-center gap-1 text-xs font-black text-white">
              <ArrowDown className="h-4 w-4 stroke-[3]" />
              <span>UNDER</span>
            </span>
            <span className="text-[11px] font-bold text-white/95 tabular-nums">
              &lt; {target.toFixed(2)}
            </span>
          </button>

          <button
            type="button"
            disabled={rolling}
            onClick={() => handleRoll('over')}
            className={`flex-1 flex flex-col items-center justify-center rounded-full py-2 px-3 border shadow-lg transition active:scale-[0.98] disabled:opacity-55 ${
              direction === 'over'
                ? 'bg-gradient-to-b from-[#16c2f5] to-[#056ea8] border-cyan-200/70'
                : 'bg-gradient-to-b from-[#109ec9] to-[#045280] border-white/20'
            }`}
          >
            <span className="inline-flex items-center gap-1 text-xs font-black text-white">
              <ArrowUp className="h-4 w-4 stroke-[3]" />
              <span>OVER</span>
            </span>
            <span className="text-[11px] font-bold text-white/95 tabular-nums">
              &gt; {target.toFixed(2)}
            </span>
          </button>
        </div>

        <div className="relative rounded-full bg-[#5c25c4]/85 border border-white/15 px-3 py-1.5 flex items-center justify-between gap-2">
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <span className="text-[11px] font-bold text-violet-100 shrink-0">Bet INR</span>
            <input
              type="number"
              min={10}
              max={50000}
              value={stakeInput}
              onChange={(e) => setStakeInput(e.target.value)}
              placeholder="10–50000"
              className="w-full min-w-0 rounded-full bg-[#24075b] border border-white/15 px-3 py-1.5 text-center text-sm font-black text-white tabular-nums focus:outline-none focus:border-cyan-300"
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => adjustStake(-10)}
              aria-label="Decrease Bet"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3f1494] border border-white/15 text-white hover:bg-[#4e1bb2]"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setShowPresets((p) => !p)}
              aria-label="Quick stake presets"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3f1494] border border-white/15 text-amber-300 hover:bg-[#4e1bb2]"
            >
              <Coins className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => adjustStake(10)}
              aria-label="Increase Bet"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3f1494] border border-white/15 text-white hover:bg-[#4e1bb2]"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {showPresets && (
          <div className="grid grid-cols-5 gap-1.5 pt-1">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setStakeInput(String(p));
                  setShowPresets(false);
                }}
                className="rounded-xl bg-[#340d82] border border-white/15 py-1.5 text-xs font-bold text-white hover:bg-violet-600 tabular-nums"
              >
                ₹{p}
              </button>
            ))}
          </div>
        )}
      </footer>

      {showHistory && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-3"
          onClick={() => setShowHistory(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[#1a0545] border border-white/15 p-4 space-y-3 shadow-2xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="text-sm font-black text-white">My Dice History</h3>
              <button
                onClick={() => setShowHistory(false)}
                className="rounded-full bg-white/10 p-1.5 text-slate-200 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {myDiceBets.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-300">
                No Dice rolls yet. Tap UNDER or OVER to play!
              </div>
            ) : (
              <div className="space-y-2">
                {myDiceBets.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between rounded-xl bg-[#270966] border border-white/10 px-3 py-2.5 text-xs"
                  >
                    <div>
                      <div className="font-bold text-white">
                        {b.selection} · ₹{b.amount}
                      </div>
                      <div className="text-[11px] text-slate-300">{b.resultText || b.periodId}</div>
                    </div>
                    <div className="text-right tabular-nums">
                      <div
                        className={`font-black ${
                          b.status === 'won' ? 'text-emerald-300' : 'text-rose-300'
                        }`}
                      >
                        {b.status === 'won'
                          ? `+₹${b.payout.toFixed(2)}`
                          : `-₹${b.amount.toFixed(2)}`}
                      </div>
                      {b.multiplier > 0 && b.status === 'won' && (
                        <div className="text-[10px] text-emerald-200">{b.multiplier.toFixed(2)}x</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
