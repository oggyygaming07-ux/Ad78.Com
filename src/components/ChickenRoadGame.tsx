import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Car,
  Headphones,
  History,
  Minus,
  Plus,
  ShieldCheck,
  Volume2,
  VolumeX,
  Wallet,
  X,
} from 'lucide-react';
import {
  BetRecord,
  ChickenDifficulty,
  ChickenRoadSessionPublic,
  UserProfile,
} from '../types';
import {
  playBetConfirm,
  playChickenCrash,
  playChickenStep,
  playWinChime,
  setSoundMuted,
  startChickenRoadTune,
  stopChickenRoadTune,
} from '../utils/sound';

interface ChickenRoadGameProps {
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

const LANE_PREVIEW: Record<ChickenDifficulty, number[]> = {
  easy: [1.14, 1.32, 1.56, 1.88, 2.35, 3.05, 4.15],
  medium: [1.35, 1.85, 2.65, 3.95, 6.2, 10.5, 18.0],
  hard: [1.75, 3.1, 5.8, 11.5, 24.0, 52.0, 120.0],
};

const FireFlameSvg: React.FC<{ intense?: boolean }> = ({ intense }) => (
  <svg
    viewBox="0 0 48 48"
    className={`animate-flame gpu-layer ${intense ? 'h-12 w-12' : 'h-8 w-8'}`}
  >
    <path
      d="M24 3 C29 12 38 17 37 29 C36 39 30 45 24 45 C18 45 11 39 11 29 C11 21 16 15 19 10 C20 15 22 17 24 17 C22 12 23 7 24 3 Z"
      fill="#f97316"
    />
    <path
      d="M24 14 C27 20 33 23 32 31 C31 38 28 42 24 42 C20 42 16 38 16 31 C16 25 20 20 24 14 Z"
      fill="#facc15"
    />
    <ellipse cx="24" cy="36" rx="4" ry="5" fill="#fef08a" />
  </svg>
);

const ChickenSvg: React.FC<{ crashed?: boolean; hopping?: boolean }> = ({ crashed, hopping }) => (
  <svg
    viewBox="0 0 64 64"
    className={`h-12 w-12 sm:h-14 sm:w-14 drop-shadow-[0_6px_12px_rgba(0,0,0,0.75)] transition-transform duration-200 ${
      hopping ? '-translate-y-2 scale-110' : ''
    }`}
  >
    {crashed ? (
      <g>
        <circle cx="32" cy="34" r="24" fill="#ef4444" opacity="0.4" />
        <path
          d="M18 46 L27 20 L35 28 L47 16 L44 37 L53 46 L35 43 L27 54 Z"
          fill="#f97316"
          stroke="#fef08a"
          strokeWidth="2"
        />
        <text x="32" y="38" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="900">
          BOOM
        </text>
      </g>
    ) : (
      <g>
        <path d="M26 48 L26 57 M22 57 L30 57 M38 48 L38 57 M34 57 L42 57" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
        <ellipse cx="32" cy="36" rx="16" ry="14" fill="#fffbeb" stroke="#fde68a" strokeWidth="1.5" />
        <ellipse cx="26" cy="37" rx="7" ry="5" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.2" />
        <path d="M28 13 C28 9 33 8 35 12 C37 8 41 10 40 15" fill="#ef4444" />
        <circle cx="36" cy="23" r="9.5" fill="#fffbeb" stroke="#fde68a" strokeWidth="1.4" />
        <polygon points="44,22 52,25 44,28" fill="#f97316" />
        <circle cx="39" cy="21" r="2" fill="#0f172a" />
        <circle cx="39.7" cy="20.3" r="0.7" fill="#ffffff" />
      </g>
    )}
  </svg>
);

export const ChickenRoadGame: React.FC<ChickenRoadGameProps> = ({
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
  const [stakeInput, setStakeInput] = useState('50');
  const [difficulty, setDifficulty] = useState<ChickenDifficulty>('easy');
  const [session, setSession] = useState<ChickenRoadSessionPublic | null>(null);
  const [busy, setBusy] = useState(false);
  const [hopping, setHopping] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const presets = [50, 100, 250, 500, 1000];
  const isActive = session?.status === 'active';

  useEffect(() => {
    if (!token) return;
    fetch('/api/chicken-road/active', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.session) {
          setSession(d.session);
          setDifficulty(d.session.difficulty);
        }
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (isActive && !muted) {
      startChickenRoadTune();
    } else {
      stopChickenRoadTune();
    }
    return () => {
      stopChickenRoadTune();
    };
  }, [isActive, muted]);

  const toggleSound = () => {
    const next = !muted;
    setMuted(next);
    setSoundMuted(next);
    if (next) {
      stopChickenRoadTune();
    } else if (isActive) {
      startChickenRoadTune();
    }
  };

  const adjustStake = (delta: number) => {
    const cur = Number(stakeInput) || 50;
    setStakeInput(String(Math.max(50, Math.min(1000, cur + delta))));
  };

  const handleStart = async () => {
    setFeedback(null);
    if (!user || !token) {
      onRequireAuth();
      return;
    }
    const amt = Number(stakeInput);
    if (!Number.isFinite(amt) || amt < 50 || amt > 1000) {
      setFeedback({ type: 'err', text: 'Chicken Road stake must be between ₹50 and ₹1,000.' });
      return;
    }
    if (user.balance < amt) {
      setFeedback({ type: 'err', text: 'Insufficient balance. Tap + Deposit first.' });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/chicken-road/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: amt, difficulty }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'err', text: data.error || 'Could not start Chicken Road.' });
        return;
      }
      if (!muted) {
        playBetConfirm();
        startChickenRoadTune();
      }
      setSession(data.session);
      onBalanceUpdate(data.balance);
      setFeedback({
        type: 'ok',
        text: `Run live (${difficulty.toUpperCase()})! Tap CROSS LANE to dash past speeding traffic & fire traps.`,
      });
    } catch {
      setFeedback({ type: 'err', text: 'Network error starting run.' });
    } finally {
      setBusy(false);
    }
  };

  const handleStep = async () => {
    if (!token || !session || session.status !== 'active' || busy) return;
    setBusy(true);
    setHopping(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/chicken-road/step', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'err', text: data.error || 'Could not advance lane.' });
        return;
      }
      setSession(data.session);
      if (typeof data.balance === 'number') onBalanceUpdate(data.balance);

      if (data.hitTrap) {
        stopChickenRoadTune();
        if (!muted) playChickenCrash();
        if (data.bet) onBetPlaced(data.bet);
        setFeedback({
          type: 'err',
          text: `Flame hazard hit on Lane ${data.session.hitLane || '?'}! Better luck next crossing.`,
        });
      } else if (data.autoCashout) {
        stopChickenRoadTune();
        if (!muted) playWinChime();
        if (data.bet) onBetPlaced(data.bet);
        setFeedback({
          type: 'ok',
          text: `HIGHWAY CLEARED! Full cross win +₹${Number(data.payout).toFixed(2)}!`,
        });
      } else {
        if (!muted) playChickenStep(data.session.currentLane);
        setFeedback({
          type: 'ok',
          text: `Cleared Lane ${data.session.currentLane} (${data.session.currentMultiplier.toFixed(2)}x)! Cashout ₹${data.session.currentPayout.toFixed(2)} or cross again.`,
        });
      }
    } catch {
      setFeedback({ type: 'err', text: 'Network error stepping forward.' });
    } finally {
      window.setTimeout(() => setHopping(false), 220);
      setBusy(false);
    }
  };

  const handleCashout = async () => {
    if (!token || !session || session.status !== 'active' || session.currentLane < 1 || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/chicken-road/cashout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'err', text: data.error || 'Cashout failed.' });
        return;
      }
      stopChickenRoadTune();
      if (!muted) playWinChime();
      setSession(data.session);
      onBalanceUpdate(data.balance);
      if (data.bet) onBetPlaced(data.bet);
      setFeedback({
        type: 'ok',
        text: `CASHED OUT @ ${Number(data.multiplier).toFixed(2)}x! Won ₹${Number(data.payout).toFixed(2)}`,
      });
    } catch {
      setFeedback({ type: 'err', text: 'Network error during cashout.' });
    } finally {
      setBusy(false);
    }
  };

  const laneMultipliers = session?.multipliers || LANE_PREVIEW[difficulty];
  const chickenBets = myBets.filter((b) => b.game === 'chicken_road').slice(0, 20);

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#08101d] text-white">
      <header className="shrink-0 sticky top-0 z-30 flex h-14 items-center justify-between bg-[#0a1426]/95 backdrop-blur-md border-b border-white/10 px-3 sm:px-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              stopChickenRoadTune();
              onBack();
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
            aria-label="Back to home"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="text-sm font-extrabold tracking-wide text-amber-300">CHICKEN ROAD</div>
            <div className="text-[10px] text-slate-400">7-Lane Asphalt Dash · ₹50–₹1,000</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setShowHistory(true)}
            aria-label="Bet History"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-slate-200 hover:bg-white/20"
          >
            <History className="h-4 w-4" />
          </button>
          <button
            onClick={toggleSound}
            aria-label="Toggle sound"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-slate-200 hover:bg-white/20"
          >
            {muted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4 text-emerald-400" />}
          </button>
          <button
            onClick={onOpenSupport}
            aria-label="24x7 Support"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-cyan-300 hover:bg-white/20"
          >
            <Headphones className="h-4 w-4" />
          </button>
          {user ? (
            <button
              onClick={onOpenDeposit}
              className="flex items-center gap-1.5 rounded-full bg-[#10243d] border border-amber-400/35 px-3 py-1.5 text-xs font-bold text-white tabular-nums"
            >
              <Wallet className="h-3.5 w-3.5 text-amber-300" />
              <span>₹{user.balance.toFixed(2)}</span>
            </button>
          ) : (
            <button
              onClick={onRequireAuth}
              className="rounded-full bg-amber-400 px-3.5 py-1.5 text-xs font-bold text-slate-950"
            >
              Login
            </button>
          )}
        </div>
      </header>

      {/* Main Centered Full-Screen Asphalt Highway Crossing Stage */}
      <main className="flex-1 flex flex-col justify-center mx-auto w-full max-w-4xl px-3 sm:px-5 py-3 space-y-3">
        <section className="rounded-2xl border border-orange-400/35 bg-[#0e1729] p-3.5 sm:p-4 space-y-3 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-semibold text-slate-300">Highway Risk Mode</div>
              <div className="text-[11px] text-amber-300 font-bold tabular-nums">
                {session
                  ? `Active: ${session.difficulty.toUpperCase()} · Lane ${session.currentLane}/${session.totalLanes}`
                  : `Up to ${laneMultipliers[laneMultipliers.length - 1]}x Payout`}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {(['easy', 'medium', 'hard'] as ChickenDifficulty[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  disabled={isActive}
                  onClick={() => setDifficulty(d)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-extrabold uppercase transition whitespace-nowrap ${
                    difficulty === d
                      ? d === 'hard'
                        ? 'bg-rose-500 text-white'
                        : d === 'medium'
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-emerald-400 text-slate-950'
                      : 'bg-[#08101f] text-slate-300 border border-white/10 disabled:opacity-45'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* 7-Lane Midnight Asphalt Highway Stage */}
          <div className="relative rounded-2xl border-2 border-slate-700 bg-[#1a1f29] overflow-x-auto shadow-inner">
            {/* Top Highway Guard Curb */}
            <div
              className="h-2.5 w-full min-w-[540px]"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(90deg, #ef4444 0 18px, #f8fafc 18px 36px)',
              }}
            />

            <div className="p-2.5 grid grid-cols-7 gap-0 min-w-[540px]">
              {laneMultipliers.map((mult, idx) => {
                const laneNumber = idx + 1;
                const cleared = (session?.currentLane ?? 0) >= laneNumber;
                const isHit = session?.status === 'lost' && session.hitLane === laneNumber;
                const isNext = isActive && (session?.currentLane ?? 0) === idx;
                const isChickenHere =
                  (session && session.currentLane === laneNumber && session.status !== 'lost') ||
                  isHit;
                const showTrafficCar = !cleared && !isHit && !isChickenHere;

                return (
                  <div
                    key={laneNumber}
                    className={`relative overflow-hidden flex flex-col items-center justify-between h-56 sm:h-68 px-1 py-2.5 transition border-r-2 border-dashed border-amber-300/40 last:border-r-0 ${
                      isHit
                        ? 'bg-gradient-to-b from-rose-950 via-orange-950/95 to-red-950 shadow-[inset_0_0_24px_rgba(249,115,22,0.75)]'
                        : cleared
                        ? 'bg-gradient-to-b from-[#172724] via-[#1b2e2a] to-[#111e1d]'
                        : isNext
                        ? 'bg-gradient-to-b from-[#2c2516] via-[#262218] to-[#1b1c24]'
                        : 'bg-[#1c212c]'
                    }`}
                  >
                    <div className="relative z-10 flex items-center gap-1 rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-black text-slate-300">
                      <span>L{laneNumber}</span>
                      {cleared && <ShieldCheck className="h-3 w-3 text-emerald-400" />}
                    </div>

                    {/* Speeding Oncoming Traffic Hazard on Uncrossed Lanes */}
                    {showTrafficCar && (
                      <div
                        className="pointer-events-none absolute left-1/2 -translate-x-1/2 z-0 flex flex-col items-center opacity-70 animate-traffic-cruise gpu-layer"
                        style={{ animationDelay: `${idx * 0.42}s` }}
                      >
                        <div className="rounded-lg bg-rose-600/85 border border-rose-300/60 p-1.5 shadow-[0_6px_14px_rgba(244,63,94,0.45)]">
                          <Car className="h-4 w-4 text-white" />
                        </div>
                        <div className="mt-0.5 flex gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_8px_#fde047]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_8px_#fde047]" />
                        </div>
                      </div>
                    )}

                    {/* Center Chicken / Safety Barricade / Next Marker */}
                    <div className="relative z-10 flex flex-col items-center justify-center flex-1">
                      {isChickenHere ? (
                        <ChickenSvg crashed={isHit} hopping={hopping} />
                      ) : cleared ? (
                        <div className="flex flex-col items-center gap-1">
                          <div className="h-2.5 w-12 rounded hazard-stripes border border-emerald-400/70 shadow-md" />
                          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-black text-emerald-300 uppercase">
                            SAFE
                          </span>
                        </div>
                      ) : isNext ? (
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-400/25 border-2 border-amber-300 text-amber-300 text-[11px] font-black animate-pulse">
                          NEXT
                        </div>
                      ) : null}
                    </div>

                    {/* Fire Flames erupt on hit or cleared lanes */}
                    {(cleared || isHit) && (
                      <div className="pointer-events-none flex items-center justify-center -mb-1">
                        <FireFlameSvg intense={isHit} />
                      </div>
                    )}

                    {/* Golden Manhole Multiplier Badge */}
                    <div
                      className={`relative z-10 mx-auto w-14 h-14 rounded-full border-2 flex items-center justify-center text-[11px] font-black tabular-nums shadow-lg ${
                        isHit
                          ? 'bg-rose-600 border-rose-200 text-white'
                          : cleared
                          ? 'bg-gradient-to-b from-emerald-300 to-emerald-600 border-emerald-100 text-slate-950'
                          : isNext
                          ? 'bg-gradient-to-b from-amber-300 to-orange-500 border-amber-100 text-slate-950'
                          : 'bg-[#2a3140] border-amber-400/45 text-amber-200'
                      }`}
                    >
                      {mult.toFixed(2)}x
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Curb Strip */}
            <div
              className="h-2.5 w-full min-w-[540px]"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(90deg, #facc15 0 18px, #0f172a 18px 36px)',
              }}
            />
          </div>

          {!session && (
            <div className="flex items-center justify-center gap-2 text-xs text-slate-300 pt-1">
              <ChickenSvg />
              <span>Ready at starting curb — choose ₹50–₹1,000 stake &amp; tap START RUN!</span>
            </div>
          )}
        </section>

        {feedback && (
          <div
            className={`rounded-xl px-4 py-2 text-xs font-semibold border ${
              feedback.type === 'ok'
                ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                : 'bg-rose-500/15 border-rose-400/40 text-rose-200'
            }`}
          >
            {feedback.text}
          </div>
        )}
      </main>

      <footer className="shrink-0 mx-auto w-full max-w-4xl px-3 sm:px-5 pb-4">
        <section className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-3.5 space-y-2.5 shadow-2xl">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isActive}
              onClick={() => adjustStake(-50)}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-40"
              aria-label="Decrease stake"
            >
              <Minus className="h-4 w-4" />
            </button>
            <div className="flex-1">
              <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                Manual Stake (Min ₹50 · Max ₹1,000)
              </label>
              <input
                type="number"
                min={50}
                max={1000}
                disabled={isActive}
                value={stakeInput}
                onChange={(e) => setStakeInput(e.target.value)}
                className="w-full rounded-xl bg-[#08101f] border border-white/15 px-3 py-2 text-base font-bold text-white tabular-nums focus:outline-none focus:border-amber-400 disabled:opacity-60"
              />
            </div>
            <button
              type="button"
              disabled={isActive}
              onClick={() => adjustStake(50)}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-40"
              aria-label="Increase stake"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                disabled={isActive}
                onClick={() => setStakeInput(String(p))}
                className={`rounded-xl border py-1.5 text-xs font-bold transition disabled:opacity-40 ${
                  Number(stakeInput) === p
                    ? 'bg-amber-400 text-slate-950 border-amber-300'
                    : 'bg-[#08101f] border-white/15 text-slate-200 hover:border-amber-400'
                }`}
              >
                ₹{p}
              </button>
            ))}
          </div>

          {!isActive ? (
            <button
              type="button"
              disabled={busy}
              onClick={handleStart}
              className="w-full rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 py-3.5 text-base font-black text-slate-950 shadow-lg hover:brightness-110 transition active:scale-[0.98]"
            >
              {busy ? 'STARTING RUN...' : `START RUN · ₹${stakeInput || 0}`}
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={handleStep}
                className="w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 py-3.5 text-sm sm:text-base font-black text-slate-950 shadow-lg hover:brightness-110 transition active:scale-[0.98] whitespace-nowrap"
              >
                {busy
                  ? 'HOPPING...'
                  : `CROSS LANE ${(session?.currentLane ?? 0) + 1} (${session?.nextMultiplier.toFixed(2)}x)`}
              </button>
              <button
                type="button"
                disabled={busy || (session?.currentLane ?? 0) < 1}
                onClick={handleCashout}
                className="w-full rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 py-3.5 text-sm sm:text-base font-black text-slate-950 shadow-lg hover:brightness-110 transition disabled:opacity-45 whitespace-nowrap"
              >
                CASHOUT ₹{(session?.currentPayout || 0).toFixed(2)}
              </button>
            </div>
          )}
        </section>
      </footer>

      {showHistory && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-3"
          onClick={() => setShowHistory(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[#0e172a] border border-white/15 p-4 space-y-3 shadow-2xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="text-sm font-black text-white">Chicken Road History</h3>
              <button
                onClick={() => setShowHistory(false)}
                className="rounded-full bg-white/10 p-1.5 text-slate-300 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {chickenBets.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No Chicken Road runs played yet.
              </div>
            ) : (
              <div className="divide-y divide-white/5 text-xs">
                {chickenBets.map((b) => (
                  <div key={b.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <div className="font-bold text-white uppercase">{b.selection}</div>
                      <div className="text-[11px] text-slate-400">
                        Stake ₹{b.amount} {b.resultText ? `· ${b.resultText}` : ''}
                      </div>
                    </div>
                    <div className="text-right font-bold tabular-nums">
                      {b.status === 'pending' && <span className="text-amber-300">Active</span>}
                      {b.status === 'won' && (
                        <span className="text-emerald-400">+₹{b.payout.toFixed(2)}</span>
                      )}
                      {b.status === 'lost' && (
                        <span className="text-rose-400">-₹{b.amount.toFixed(2)}</span>
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
