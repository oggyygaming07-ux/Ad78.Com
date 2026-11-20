import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  History,
  Minus,
  Plus,
  Repeat,
  Sparkles,
  Volume2,
  VolumeX,
  Wallet,
  X,
} from 'lucide-react';
import { BetRecord, CrystalGemType, CrystalPlayResult, UserProfile } from '../types';
import { playCrystalShatter, playDiceShake, setSoundMuted } from '../utils/sound';

interface CrystalGameProps {
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

const MIN_BET = 10;
const MAX_BET = 1000;
const DEFAULT_HAND: CrystalGemType[] = ['emerald', 'ruby', 'amethyst', 'gold', 'sapphire'];

const WINNING_COMBINATIONS = [
  { name: 'Five of a Kind', dots: ['full', 'full', 'full', 'full', 'full'], mult: '100.00x', val: 100 },
  { name: 'Four of a Kind', dots: ['full', 'full', 'full', 'full', 'empty'], mult: '10.00x', val: 10 },
  { name: 'Full House', dots: ['full', 'full', 'full', 'ring', 'ring'], mult: '5.00x', val: 5 },
  { name: 'Three of a Kind', dots: ['full', 'full', 'full', 'empty', 'empty'], mult: '2.40x', val: 2.4 },
  { name: 'Two Pair', dots: ['full', 'full', 'ring', 'ring', 'empty'], mult: '1.40x', val: 1.4 },
];

const GemFacetSvg: React.FC<{
  type: CrystalGemType;
  highlight?: boolean;
  spinning?: boolean;
  small?: boolean;
}> = ({ type, highlight, spinning, small }) => {
  const palette: Record<CrystalGemType, { fill: string; facet: string; edge: string; glow: string }> = {
    emerald: { fill: '#22c55e', facet: '#bbf7d0', edge: '#14532d', glow: 'rgba(34,197,94,0.75)' },
    ruby: { fill: '#f43f5e', facet: '#fecdd3', edge: '#881337', glow: 'rgba(244,63,94,0.75)' },
    amethyst: { fill: '#a855f7', facet: '#f3e8ff', edge: '#581c87', glow: 'rgba(168,85,247,0.75)' },
    gold: { fill: '#facc15', facet: '#fef9c3', edge: '#92400e', glow: 'rgba(250,204,21,0.75)' },
    sapphire: { fill: '#38bdf8', facet: '#e0f2fe', edge: '#075985', glow: 'rgba(56,189,248,0.75)' },
  };
  const c = palette[type];
  return (
    <svg
      viewBox="0 0 64 72"
      className={`${small ? 'h-6 w-5' : 'h-12 w-11 sm:h-16 sm:w-14'} transition-transform duration-300 ${
        spinning ? 'animate-crystal-spin' : highlight ? 'scale-110' : ''
      }`}
      style={{
        filter: highlight
          ? `drop-shadow(0 0 16px ${c.glow})`
          : 'drop-shadow(0 4px 10px rgba(0,0,0,0.7))',
      }}
    >
      <polygon points="32,3 55,18 59,46 32,69 5,46 9,18" fill={c.fill} stroke={c.facet} strokeWidth="1.8" />
      <polygon points="32,3 55,18 32,32 9,18" fill={c.facet} opacity="0.65" />
      <polygon points="32,32 59,46 32,69" fill={c.edge} opacity="0.72" />
      <polygon points="9,18 32,32 5,46" fill="#ffffff" opacity="0.25" />
      <polygon points="32,12 45,23 32,46 19,23" fill="#ffffff" opacity="0.35" />
      <line x1="32" y1="3" x2="32" y2="69" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="1" />
    </svg>
  );
};

export const CrystalGame: React.FC<CrystalGameProps> = ({
  user,
  token,
  myBets,
  onBack,
  onRequireAuth,
  onOpenDeposit,
  onBalanceUpdate,
  onBetPlaced,
}) => {
  const [stakeStr, setStakeStr] = useState<string>('10');
  const [hand, setHand] = useState<CrystalGemType[]>(DEFAULT_HAND);
  const [revealedCount, setRevealedCount] = useState<number>(5);
  const [lastResult, setLastResult] = useState<CrystalPlayResult | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [autoSpin, setAutoSpin] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
    };
  }, []);

  const parsedStake = Math.max(0, Number(stakeStr) || 0);
  const recentBets = useMemo(
    () => myBets.filter((b) => b.game === 'crystal').slice(0, 20),
    [myBets]
  );

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setSoundMuted(next);
  };

  const handlePlaceBet = async () => {
    setFeedback(null);
    if (!user || !token) {
      setAutoSpin(false);
      onRequireAuth();
      return;
    }
    if (!Number.isFinite(parsedStake) || parsedStake < MIN_BET || parsedStake > MAX_BET) {
      setAutoSpin(false);
      setFeedback({ type: 'err', text: `Crystal Poker bet must be ₹${MIN_BET} – ₹${MAX_BET}.` });
      return;
    }
    if (user.balance < parsedStake) {
      setAutoSpin(false);
      setFeedback({ type: 'err', text: 'Insufficient balance. Deposit funds to continue.' });
      return;
    }

    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
    setSpinning(true);
    setRevealedCount(0);
    if (!muted) playDiceShake();

    try {
      const res = await fetch('/api/crystal/play', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: parsedStake }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Crystal Poker bet failed');

      const result = data as CrystalPlayResult;
      setHand(result.hand || DEFAULT_HAND);

      // Staggered 5-crystal pop reveal
      [1, 2, 3, 4, 5].forEach((n, idx) => {
        timersRef.current.push(
          window.setTimeout(() => {
            setRevealedCount(n);
          }, 95 * (idx + 1))
        );
      });

      timersRef.current.push(
        window.setTimeout(() => {
          setLastResult(result);
          onBalanceUpdate(result.balance);
          if (result.bet) onBetPlaced(result.bet);
          setSpinning(false);
          if (!muted) playCrystalShatter(result.won);
          setFeedback(
            result.won
              ? {
                  type: 'ok',
                  text: `${result.handName} (${result.multiplier.toFixed(2)}x) · Won +₹${result.payout.toFixed(2)}`,
                }
              : {
                  type: 'err',
                  text: 'No poker match — Spin again!',
                }
          );
        }, 560)
      );
    } catch (err) {
      setSpinning(false);
      setRevealedCount(5);
      setAutoSpin(false);
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Bet failed' });
    }
  };

  useEffect(() => {
    if (!autoSpin || spinning) return;
    const t = window.setTimeout(() => {
      handlePlaceBet();
    }, 900);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSpin, spinning]);

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[radial-gradient(circle_at_50%_20%,#261347_0%,#10121a_60%)] text-white select-none overflow-x-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#0c0e15]/90 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setAutoSpin(false);
              onBack();
            }}
            aria-label="Back to Home"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          {user ? (
            <button
              onClick={onOpenDeposit}
              className="flex items-center gap-1.5 rounded-xl bg-[#181b26] border border-white/15 px-3 py-1.5 text-sm font-extrabold tabular-nums"
            >
              <Wallet className="h-4 w-4 text-slate-300" />
              <span>₹{user.balance.toFixed(2)}</span>
            </button>
          ) : (
            <button
              onClick={onRequireAuth}
              className="rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-extrabold text-slate-950"
            >
              Login
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleMute}
            aria-label="Sound"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
          >
            {muted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4 text-slate-200" />}
          </button>
          <button
            type="button"
            onClick={() => setShowHistory(true)}
            aria-label="Bet History"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
          >
            <History className="h-4 w-4 text-slate-200" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-between px-4 py-3 max-w-md mx-auto w-full">
        {/* Circular Rainbow Poker Chip Crest */}
        <div className="relative flex flex-col items-center">
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-tr from-sky-500 via-fuchsia-500 to-amber-400 p-1 shadow-[0_0_28px_rgba(168,85,247,0.45)]">
            <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[#131622] border-2 border-dashed border-white/30 text-center">
              <span className="text-sm font-black italic tracking-wide bg-gradient-to-r from-cyan-300 via-white to-amber-300 bg-clip-text text-transparent">
                CRYSTAL
              </span>
              <span className="text-[11px] font-bold italic text-amber-300 -mt-1">Poker</span>
            </div>
          </div>
          {!spinning && lastResult?.won && (
            <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/50 px-3 py-0.5 text-[11px] font-black text-emerald-300">
              <Sparkles className="h-3 w-3" /> {lastResult.handName} · {lastResult.multiplier.toFixed(2)}x
            </div>
          )}
        </div>

        {/* Winning Combinations + Bonus Chest */}
        <div className="w-full grid grid-cols-12 gap-3 items-center my-2">
          <div className="col-span-8 space-y-1.5">
            <div className="text-xs font-semibold text-slate-300 mb-1">Winning combinations:</div>
            {WINNING_COMBINATIONS.map((combo) => {
              const active = !spinning && lastResult?.won && lastResult.handName === combo.name;
              return (
                <div
                  key={combo.name}
                  className={`flex items-center justify-between rounded-lg px-2 py-0.5 transition ${
                    active ? 'bg-emerald-500/20 ring-1 ring-emerald-400/60' : ''
                  }`}
                >
                  <div className="flex items-center gap-1">
                    {combo.dots.map((d, i) => (
                      <span
                        key={i}
                        className={`h-3 w-3 rounded-full ${
                          d === 'full'
                            ? active
                              ? 'bg-emerald-400'
                              : 'bg-slate-500'
                            : d === 'ring'
                            ? active
                              ? 'border-2 border-amber-300 bg-amber-300/30'
                              : 'border-2 border-slate-500'
                            : 'border border-slate-600'
                        }`}
                      />
                    ))}
                  </div>
                  <span
                    className={`text-xs font-extrabold tabular-nums ${
                      active ? 'text-emerald-300' : 'text-slate-400'
                    }`}
                  >
                    {combo.mult}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="col-span-4 flex flex-col items-center">
            <div className="text-[11px] font-semibold text-slate-300 mb-1">Bonus chest:</div>
            <div className="w-16 rounded-2xl border border-amber-400/30 bg-[#161925] p-2 flex flex-col items-center gap-2 shadow-inner">
              {([0, 1, 2] as const).map((slotIdx) => {
                const lit = (lastResult?.bonusGemsLit ?? 0) > slotIdx;
                return (
                  <div
                    key={slotIdx}
                    className={`h-8 w-8 rounded-lg border flex items-center justify-center transition ${
                      lit
                        ? 'border-amber-300 bg-amber-400/20 shadow-[0_0_12px_rgba(251,191,36,0.5)] animate-pulse'
                        : 'border-white/10 bg-[#10121b] opacity-35'
                    }`}
                  >
                    <GemFacetSvg
                      type={slotIdx === 0 ? 'emerald' : slotIdx === 1 ? 'amethyst' : 'sapphire'}
                      small
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Staggered 5 Metallic-Bezeled Gem Sockets with Specular Sweep */}
        <div className="w-full py-3">
          <div className="grid grid-cols-5 gap-2 items-center">
            {hand.map((gem, idx) => {
              const isRevealed = idx < revealedCount;
              const isMatch = Boolean(!spinning && lastResult?.won && lastResult.winningIndices.includes(idx));
              return (
                <div key={idx} className="flex flex-col items-center">
                  <div
                    className={`relative overflow-hidden flex h-22 w-full items-center justify-center rounded-2xl border-2 transition-all duration-200 ${
                      isMatch
                        ? 'bg-emerald-500/15 border-amber-300 shadow-[0_0_18px_rgba(52,211,153,0.45)]'
                        : 'bg-[#171b29] border-amber-400/25'
                    } ${isRevealed ? 'opacity-100 scale-100' : 'opacity-30 scale-90'}`}
                  >
                    {isMatch && (
                      <div className="pointer-events-none absolute inset-y-0 w-8 bg-gradient-to-r from-transparent via-white/35 to-transparent animate-gem-shine gpu-layer" />
                    )}
                    <GemFacetSvg type={gem} highlight={isMatch} spinning={spinning && !isRevealed} />
                  </div>
                  <div
                    className={`mt-1.5 h-1 w-10 rounded-full transition ${
                      isMatch ? 'bg-emerald-400' : 'bg-white/15'
                    }`}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {feedback && (
          <div
            className={`w-full rounded-xl px-3.5 py-2 text-center text-xs font-bold border ${
              feedback.type === 'ok'
                ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                : 'bg-rose-500/15 border-rose-400/40 text-rose-200'
            }`}
          >
            {feedback.text}
          </div>
        )}
      </main>

      <footer className="mx-auto w-full max-w-md px-4 pb-5 pt-2">
        <div className="rounded-3xl bg-[#161923] border border-white/10 p-3.5 space-y-3 shadow-2xl">
          <div className="text-center">
            <span className="inline-block rounded-full bg-[#242836] px-3 py-0.5 text-[10px] font-bold text-slate-300">
              Minimum ₹{MIN_BET} · Max ₹{MAX_BET.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={spinning}
              onClick={() => setStakeStr(String(MIN_BET))}
              className="rounded-xl bg-[#222634] hover:bg-white/15 border border-white/10 px-3 py-2.5 text-xs font-bold text-white"
            >
              min
            </button>
            <button
              type="button"
              disabled={spinning}
              onClick={() => setStakeStr(String(Math.max(MIN_BET, parsedStake - 10)))}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#222634] hover:bg-white/15 border border-white/10 text-white"
              aria-label="Decrease Bet"
            >
              <Minus className="h-4 w-4" />
            </button>

            <div className="flex-1 text-center">
              <div className="text-[10px] font-semibold text-slate-400">Bet Amount</div>
              <div className="flex items-center justify-center gap-0.5">
                <span className="text-sm font-extrabold text-slate-300">₹</span>
                <input
                  type="number"
                  min={MIN_BET}
                  max={MAX_BET}
                  disabled={spinning}
                  value={stakeStr}
                  onChange={(e) => setStakeStr(e.target.value)}
                  className="w-20 bg-transparent text-center text-base font-extrabold text-white focus:outline-none tabular-nums"
                />
              </div>
            </div>

            <button
              type="button"
              disabled={spinning}
              onClick={() => setStakeStr(String(Math.min(MAX_BET, parsedStake + 10)))}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#222634] hover:bg-white/15 border border-white/10 text-white"
              aria-label="Increase Bet"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={spinning}
              onClick={() => setStakeStr(String(MAX_BET))}
              className="rounded-xl bg-[#222634] hover:bg-white/15 border border-white/10 px-3 py-2.5 text-xs font-bold text-white"
            >
              max
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePlaceBet}
              disabled={spinning}
              className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 py-3.5 text-sm font-black tracking-wider text-slate-950 shadow-lg hover:brightness-110 active:scale-[0.98] transition disabled:opacity-60 uppercase"
            >
              {spinning ? 'DEALING CRYSTALS...' : 'PLACE BET'}
            </button>
            <button
              type="button"
              onClick={() => setAutoSpin((a) => !a)}
              aria-label="Auto Spin"
              className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition ${
                autoSpin
                  ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                  : 'bg-[#222634] text-slate-300 border-white/10'
              }`}
            >
              <Repeat className="h-5 w-5" />
            </button>
          </div>
        </div>
      </footer>

      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#161925] border border-white/15 p-4 space-y-3 max-h-[75vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="text-sm font-extrabold text-white">Crystal Poker History</div>
              <button
                onClick={() => setShowHistory(false)}
                className="rounded-lg bg-white/10 p-1.5 text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {recentBets.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No hands dealt yet.</div>
            ) : (
              <div className="divide-y divide-white/10">
                {recentBets.map((b) => (
                  <div key={b.id} className="flex items-center justify-between py-2.5 text-xs">
                    <div>
                      <div className="font-bold text-white">{b.selection}</div>
                      <div className="text-[11px] text-slate-400">
                        Stake ₹{b.amount} · {b.resultText}
                      </div>
                    </div>
                    <div
                      className={`font-extrabold tabular-nums ${
                        b.status === 'won' ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {b.status === 'won' ? `+₹${b.payout.toFixed(2)}` : `-₹${b.amount.toFixed(2)}`}
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
