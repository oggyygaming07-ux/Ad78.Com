import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bomb,
  Headphones,
  HelpCircle,
  Minus,
  Plus,
  ShieldAlert,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AviatorPhase, BetRecord, MinesProState, UserProfile } from '../types';
import {
  playAviatorCashout,
  playBetConfirm,
  playMinesBoom,
  playStarOpen,
  setSoundMuted,
  startMinesProTune,
  stopMinesProTune,
} from '../utils/sound';
import { AVIATOR_MAX_BET, AVIATOR_MIN_BET } from '../utils/validation';

interface MinesProGameProps {
  user: UserProfile | null;
  token: string | null;
  minesPro: MinesProState | null;
  myBets: BetRecord[];
  onBack: () => void;
  onRequireAuth: () => void;
  onOpenDeposit: () => void;
  onOpenSupport: () => void;
  onBalanceUpdate: (newBalance: number) => void;
  onBetPlaced: (bet: BetRecord) => void;
  onCashoutSuccess: (payload: {
    multiplier: number;
    payout: number;
    staked: number;
    balance: number;
    roundId: string;
  }) => void;
}

interface SimLiveBet {
  id: string;
  player: string;
  amount: number;
  targetMult: number;
  cashedOutAt?: number;
  payout?: number;
}

const PRESETS = [10, 100, 500, 1000];

// Exact 21-step Mines:3 multiplier ladder displayed on the 6x4 tile grid matching reference
const TILE_MULTIPLIERS: number[] = [
  1.14, 1.31, 1.52, 1.77, 2.08, 2.48,
  2.97, 3.61, 4.44, 5.56, 7.07, 9.20,
  12.26, 16.86, 24.09, 36.14, 57.82, 101.20,
  202.40, 506.00, 2025.00,
];

const SIM_PLAYERS = [
  'ra***78',
  'vi***99',
  'ak***07',
  'ro***45',
  'sa***21',
  'de***88',
  'pr***12',
  'ar***64',
  'ma***33',
  'su***59',
  'ka***17',
  'ni***82',
  'mo***40',
  'ha***91',
  'sh***26',
  'ad***73',
];

const SIM_AMOUNTS = [100, 150, 200, 300, 500, 750, 1000, 1500, 2000, 3500];

function buildSimBatch(roundId: string, count: number): SimLiveBet[] {
  let seed = 0;
  for (let i = 0; i < roundId.length; i++) {
    seed = (seed * 31 + roundId.charCodeAt(i)) >>> 0;
  }
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  const used = new Set<string>();
  const list: SimLiveBet[] = [];
  for (let i = 0; i < count; i++) {
    let name = SIM_PLAYERS[Math.floor(rand() * SIM_PLAYERS.length)];
    if (used.has(name)) {
      name = `${name.slice(0, 2)}***${Math.floor(10 + rand() * 89)}`;
    }
    used.add(name);
    const amount = SIM_AMOUNTS[Math.floor(rand() * SIM_AMOUNTS.length)];
    const targetMult = Number((1.18 + Math.pow(rand(), 1.5) * 4.5).toFixed(2));
    list.push({
      id: `${roundId}-mp-sim-${i}`,
      player: name,
      amount,
      targetMult,
    });
  }
  return list;
}

export const MinesProGame: React.FC<MinesProGameProps> = ({
  user,
  token,
  minesPro,
  myBets,
  onBack,
  onRequireAuth,
  onOpenDeposit,
  onOpenSupport,
  onBalanceUpdate,
  onBetPlaced,
  onCashoutSuccess,
}) => {
  const [betAmount1, setBetAmount1] = useState<string>('10');
  const [betAmount2, setBetAmount2] = useState<string>('10');
  const [autoPlay1, setAutoPlay1] = useState(false);
  const [autoPlay2, setAutoPlay2] = useState(false);
  const [autoStars1, setAutoStars1] = useState(21);
  const [autoStars2, setAutoStars2] = useState(21);
  const [busySlots, setBusySlots] = useState<Record<1 | 2, boolean>>({ 1: false, 2: false });
  const [muted, setMuted] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [historyViewTab, setHistoryViewTab] = useState<'all' | 'my' | 'stats'>('all');

  const phase: AviatorPhase = minesPro?.phase || 'betting';
  const serverMult = minesPro?.multiplier ?? 1.0;
  const roundId = minesPro?.roundId || '';
  const starsOpened = minesPro?.starsOpened ?? 0;

  const [smoothMult, setSmoothMult] = useState<number>(serverMult);
  const smoothRef = useRef<number>(serverMult);

  useEffect(() => {
    if (phase !== 'flying') {
      smoothRef.current = serverMult;
      setSmoothMult(serverMult);
      return;
    }
    let raf = 0;
    const target = serverMult;
    const tickAnim = () => {
      const curr = smoothRef.current;
      const next = curr + (target - curr) * 0.35;
      smoothRef.current = next;
      setSmoothMult(next);
      if (Math.abs(target - next) > 0.002) {
        raf = requestAnimationFrame(tickAnim);
      } else {
        smoothRef.current = target;
        setSmoothMult(target);
      }
    };
    raf = requestAnimationFrame(tickAnim);
    return () => cancelAnimationFrame(raf);
  }, [serverMult, phase]);

  const [simBets, setSimBets] = useState<SimLiveBet[]>([]);
  const simQueueRef = useRef<SimLiveBet[]>([]);
  const lastSimRoundRef = useRef<string>('');

  useEffect(() => {
    if (!roundId) return;
    if (lastSimRoundRef.current !== roundId) {
      lastSimRoundRef.current = roundId;
      const batch = buildSimBatch(roundId, 24);
      setSimBets(batch.slice(0, 7));
      simQueueRef.current = batch.slice(7);
    }
  }, [roundId]);

  useEffect(() => {
    if (phase !== 'betting') return;
    const interval = window.setInterval(() => {
      if (simQueueRef.current.length > 0) {
        const nextBet = simQueueRef.current.shift()!;
        setSimBets((prev) => [nextBet, ...prev]);
      } else {
        const extra = buildSimBatch(`${roundId}-${Date.now()}`, 1)[0];
        setSimBets((prev) => [extra, ...prev.slice(0, 29)]);
      }
    }, 340);
    return () => window.clearInterval(interval);
  }, [phase, roundId]);

  useEffect(() => {
    if (phase !== 'flying') return;
    setSimBets((prev) =>
      prev.map((item) => {
        if (!item.cashedOutAt && serverMult >= item.targetMult) {
          return {
            ...item,
            cashedOutAt: item.targetMult,
            payout: Number((item.amount * item.targetMult).toFixed(2)),
          };
        }
        return item;
      })
    );
  }, [phase, serverMult]);

  const targetBalance = user?.balance ?? 0;
  const [displayBalance, setDisplayBalance] = useState<number>(targetBalance);
  const displayBalRef = useRef<number>(targetBalance);

  useEffect(() => {
    const startVal = displayBalRef.current;
    const endVal = targetBalance;
    if (Math.abs(endVal - startVal) < 0.01) {
      displayBalRef.current = endVal;
      setDisplayBalance(endVal);
      return;
    }
    const duration = 450;
    const startTime = performance.now();
    let rafId = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = startVal + (endVal - startVal) * eased;
      displayBalRef.current = current;
      setDisplayBalance(current);
      if (t < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        displayBalRef.current = endVal;
        setDisplayBalance(endVal);
      }
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [targetBalance]);

  // Continuous Mines Pro tune from takeoff until mine blasts + star reveal pings
  const prevPhaseRef = useRef<AviatorPhase | null>(null);
  const prevStarsRef = useRef<number>(0);

  useEffect(() => {
    const prev = prevPhaseRef.current;
    if (prev !== phase) {
      prevPhaseRef.current = phase;
      if (!muted) {
        if (phase === 'flying') {
          startMinesProTune();
        } else if (phase === 'crashed') {
          stopMinesProTune();
          playMinesBoom();
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([120, 40, 180]);
          }
        } else if (phase === 'betting') {
          stopMinesProTune();
          prevStarsRef.current = 0;
        }
      } else {
        stopMinesProTune();
      }
    }
  }, [phase, muted]);

  useEffect(() => {
    if (phase === 'flying' && starsOpened > prevStarsRef.current) {
      prevStarsRef.current = starsOpened;
      if (!muted) {
        playStarOpen(starsOpened);
      }
    } else if (phase === 'betting') {
      prevStarsRef.current = 0;
    }
  }, [starsOpened, phase, muted]);

  useEffect(() => {
    return () => {
      stopMinesProTune();
    };
  }, []);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setSoundMuted(next);
    if (next) {
      stopMinesProTune();
    } else if (phase === 'flying') {
      startMinesProTune();
    }
  };

  const currentRoundBets = useMemo(
    () => myBets.filter((b) => b.game === 'mines_pro' && b.periodId === roundId),
    [myBets, roundId]
  );

  const slot1Bet = useMemo(
    () => currentRoundBets.find((b) => (b.slot || 1) === 1) || null,
    [currentRoundBets]
  );
  const slot2Bet = useMemo(
    () => currentRoundBets.find((b) => b.slot === 2) || null,
    [currentRoundBets]
  );

  // Auto Play & Auto Cash Out triggers
  const autoPlacedRef = useRef<{ 1: string; 2: string }>({ 1: '', 2: '' });
  const autoCashRef = useRef<{ 1: string; 2: string }>({ 1: '', 2: '' });

  useEffect(() => {
    if (!user || !token) return;
    if (phase === 'betting') {
      autoCashRef.current = { 1: '', 2: '' };
      if (autoPlay1 && !slot1Bet && autoPlacedRef.current[1] !== roundId && roundId) {
        autoPlacedRef.current[1] = roundId;
        handlePlaceBet(1);
      }
      if (autoPlay2 && !slot2Bet && autoPlacedRef.current[2] !== roundId && roundId) {
        autoPlacedRef.current[2] = roundId;
        handlePlaceBet(2);
      }
    } else if (phase === 'flying') {
      if (
        autoPlay1 &&
        slot1Bet?.status === 'pending' &&
        starsOpened >= autoStars1 &&
        autoCashRef.current[1] !== roundId
      ) {
        autoCashRef.current[1] = roundId;
        handleCashout(1, slot1Bet);
      }
      if (
        autoPlay2 &&
        slot2Bet?.status === 'pending' &&
        starsOpened >= autoStars2 &&
        autoCashRef.current[2] !== roundId
      ) {
        autoCashRef.current[2] = roundId;
        handleCashout(2, slot2Bet);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, roundId, starsOpened, autoPlay1, autoPlay2, autoStars1, autoStars2, slot1Bet?.status, slot2Bet?.status]);

  const adjustAmount = (
    setter: React.Dispatch<React.SetStateAction<string>>,
    delta: number
  ) => {
    setter((prev) => {
      const cur = Number(prev) || AVIATOR_MIN_BET;
      const next = Math.max(AVIATOR_MIN_BET, Math.min(AVIATOR_MAX_BET, cur + delta));
      return String(next);
    });
  };

  const handlePlaceBet = async (slot: 1 | 2) => {
    if (!user || !token) {
      onRequireAuth();
      return;
    }
    if (phase !== 'betting') {
      setFeedback({ type: 'err', text: 'Wait for next round countdown to place bet.' });
      return;
    }
    const rawVal = slot === 1 ? betAmount1 : betAmount2;
    const amt = Number(rawVal);
    if (!Number.isFinite(amt) || amt < AVIATOR_MIN_BET || amt > AVIATOR_MAX_BET) {
      setFeedback({
        type: 'err',
        text: `Bet #${slot} must be between ₹${AVIATOR_MIN_BET} and ₹${AVIATOR_MAX_BET.toLocaleString('en-IN')}.`,
      });
      return;
    }

    setBusySlots((p) => ({ ...p, [slot]: true }));
    setFeedback(null);
    try {
      const res = await fetch('/api/mines-pro/bet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: Math.round(amt), slot }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not place bet');
      if (!muted) playBetConfirm();
      onBalanceUpdate(data.balance);
      onBetPlaced(data.bet);
      setFeedback({
        type: 'ok',
        text: `Mines Pro #${slot} (₹${Math.round(amt)}) locked!`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Bet failed',
      });
    } finally {
      setBusySlots((p) => ({ ...p, [slot]: false }));
    }
  };

  const handleCashout = async (slot: 1 | 2, activeBet: BetRecord) => {
    if (!user || !token || activeBet.status !== 'pending') return;
    setBusySlots((p) => ({ ...p, [slot]: true }));
    setFeedback(null);
    try {
      const res = await fetch('/api/mines-pro/cashout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ slot }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cashout failed');
      if (!muted) playAviatorCashout();
      onBalanceUpdate(data.balance);
      onBetPlaced({
        ...activeBet,
        status: 'won',
        multiplier: data.multiplier,
        payout: data.payout,
      });
      onCashoutSuccess({
        multiplier: data.multiplier,
        payout: data.payout,
        staked: activeBet.amount,
        balance: data.balance,
        roundId,
      });
      setFeedback({
        type: 'ok',
        text: `Cashed out #${slot} @ ${data.multiplier.toFixed(2)}x (+₹${data.payout.toFixed(2)})`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Cashout failed',
      });
    } finally {
      setBusySlots((p) => ({ ...p, [slot]: false }));
    }
  };

  const myMinesProBets = myBets.filter((b) => b.game === 'mines_pro');
  const history = minesPro?.history || [];

  const totalLivePool = useMemo(() => {
    const simSum = simBets.reduce((acc, s) => acc + s.amount, 0);
    const mineSum = currentRoundBets.reduce((acc, b) => acc + b.amount, 0);
    return simSum + mineSum;
  }, [simBets, currentRoundBets]);

  // Progressive 6x4 display state aligned with reference:
  // First 21 tiles display TILE_MULTIPLIERS; last 3 tiles (indices 21, 22, 23) represent the 3 armed mines on blast
  const visibleStarsCount = Math.min(21, starsOpened);
  const blastDisplayIdx =
    phase === 'crashed' ? Math.min(20, visibleStarsCount) : -1;

  const renderBetSlot = (
    slot: 1 | 2,
    amountStr: string,
    setAmountStr: React.Dispatch<React.SetStateAction<string>>,
    activeBet: BetRecord | null,
    autoPlay: boolean,
    setAutoPlay: React.Dispatch<React.SetStateAction<boolean>>,
    autoStars: number,
    setAutoStars: React.Dispatch<React.SetStateAction<number>>
  ) => {
    const parsedAmt = Math.max(0, Number(amountStr) || 0);
    const isPending = activeBet?.status === 'pending';
    const isWon = activeBet?.status === 'won';
    const isBusy = busySlots[slot];
    const inputLocked = Boolean(isPending) || phase === 'flying';
    const targetMult = TILE_MULTIPLIERS[Math.max(0, Math.min(20, autoStars - 1))] || 2025.0;

    return (
      <div className="rounded-2xl bg-[#181a1f] border border-white/10 p-3 space-y-2.5 shadow-lg">
        <div className="grid grid-cols-12 gap-2.5 items-stretch">
          <div className="col-span-6 space-y-1.5">
            <div className="flex items-center justify-between rounded-full bg-[#0f1014] border border-white/15 px-1.5 py-1">
              <button
                type="button"
                disabled={inputLocked}
                onClick={() => adjustAmount(setAmountStr, -10)}
                aria-label={`Decrease bet ${slot}`}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#24262e] text-white hover:bg-[#323642] disabled:opacity-40"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <input
                type="number"
                min={AVIATOR_MIN_BET}
                max={AVIATOR_MAX_BET}
                value={amountStr}
                disabled={inputLocked}
                onChange={(e) => setAmountStr(e.target.value)}
                className="w-full min-w-0 bg-transparent text-center text-sm font-black text-white tabular-nums focus:outline-none disabled:opacity-60"
              />
              <button
                type="button"
                disabled={inputLocked}
                onClick={() => adjustAmount(setAmountStr, 10)}
                aria-label={`Increase bet ${slot}`}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#24262e] text-white hover:bg-[#323642] disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {PRESETS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  disabled={inputLocked}
                  onClick={() => setAmountStr(String(amt))}
                  className="rounded-full bg-[#121318] border border-white/10 py-1 text-xs font-bold text-slate-200 hover:border-amber-400/50 disabled:opacity-40 tabular-nums"
                >
                  {amt}
                </button>
              ))}
            </div>
          </div>

          <div className="col-span-6 flex">
            {isPending && activeBet && phase === 'flying' ? (
              <button
                onClick={() => handleCashout(slot, activeBet)}
                disabled={isBusy}
                className="w-full flex flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-amber-400 to-orange-500 border border-amber-200/50 py-2 px-3 text-center shadow-[0_0_22px_rgba(245,158,11,0.45)] hover:brightness-110 active:scale-[0.98] transition"
              >
                <div className="text-xs font-extrabold uppercase text-slate-950">
                  CASH OUT ({visibleStarsCount}★)
                </div>
                <div className="text-base sm:text-lg font-black text-slate-950 tabular-nums">
                  {(activeBet.amount * smoothMult).toFixed(2)} INR
                </div>
                <div className="text-[10px] font-bold text-slate-900">
                  @ {smoothMult.toFixed(2)}x
                </div>
              </button>
            ) : isWon && activeBet ? (
              <div className="w-full flex flex-col items-center justify-center rounded-2xl bg-emerald-500/20 border border-emerald-400/40 py-2 px-3 text-center">
                <div className="text-xs font-bold text-emerald-300">
                  Cashed Out @ {activeBet.multiplier.toFixed(2)}x
                </div>
                <div className="text-base font-black text-white tabular-nums">
                  +₹{activeBet.payout.toFixed(2)}
                </div>
              </div>
            ) : isPending && activeBet && phase === 'betting' ? (
              <div className="w-full flex flex-col items-center justify-center rounded-2xl bg-[#163621] border border-emerald-400/50 py-2 px-3 text-center">
                <div className="text-sm font-black text-emerald-300">
                  BET LOCKED · ₹{activeBet.amount}
                </div>
                <div className="text-[11px] text-slate-200 mt-0.5">Stars opening soon</div>
              </div>
            ) : (
              <button
                onClick={() => handlePlaceBet(slot)}
                disabled={
                  isBusy ||
                  phase !== 'betting' ||
                  parsedAmt < AVIATOR_MIN_BET ||
                  parsedAmt > AVIATOR_MAX_BET
                }
                className="w-full flex flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-[#34d016] to-[#239b08] border border-lime-300/40 py-2 px-3 text-center shadow-[0_6px_22px_rgba(35,155,8,0.4)] hover:brightness-110 active:scale-[0.98] disabled:opacity-45 transition"
              >
                <div className="text-lg font-extrabold text-white tracking-wide leading-tight">
                  {phase === 'betting' ? (isBusy ? 'PLACING...' : 'BET') : 'WAIT'}
                </div>
                <div className="text-xs sm:text-sm font-bold text-white/95 tabular-nums">
                  {parsedAmt} INR
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Bottom Auto Play + Auto Cash Out Star Target Row (matches Screenshot) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/5 text-[11px]">
          <button
            type="button"
            onClick={() => setAutoPlay((p) => !p)}
            className={`rounded-full px-3.5 py-1 font-extrabold uppercase tracking-wide transition ${
              autoPlay
                ? 'bg-emerald-400 text-slate-950 shadow-[0_0_12px_rgba(52,211,153,0.5)]'
                : 'bg-[#1c7fe8] text-white hover:brightness-110'
            }`}
          >
            {autoPlay ? 'AUTO ON' : 'AUTO PLAY'}
          </button>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-semibold">Auto Cash Out</span>
            <button
              type="button"
              onClick={() => setAutoStars((s) => (s >= 21 ? 1 : s + 1))}
              title="Tap to cycle target stars (1–21)"
              className="rounded-full bg-[#e67300] px-2.5 py-0.5 font-black text-white tabular-nums shadow hover:brightness-110"
            >
              {autoStars}
            </button>
            <span className="rounded-full border border-fuchsia-500/40 bg-[#121318] px-2.5 py-0.5 font-extrabold text-fuchsia-400 tabular-nums">
              {targetMult.toFixed(2)}x
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#101216] text-white flex flex-col justify-between pb-6">
      {/* Top Bar matching MINES PRO Screenshot */}
      <header className="sticky top-0 z-30 flex h-12 items-center justify-between bg-[#16181e]/95 backdrop-blur-md border-b border-white/10 px-3 sm:px-5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              stopMinesProTune();
              onBack();
            }}
            aria-label="Back to Home"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="text-lg font-black tracking-tight">
            <span className="text-white">MINES</span>{' '}
            <span className="text-amber-400">PRO</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleMute}
            aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-slate-200 hover:bg-white/20"
          >
            {muted ? (
              <VolumeX className="h-4 w-4 text-rose-400" />
            ) : (
              <Volume2 className="h-4 w-4 text-emerald-400" />
            )}
          </button>

          <button
            onClick={onOpenSupport}
            aria-label="24x7 Support"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400/20 text-amber-300 hover:bg-amber-400/30"
          >
            <HelpCircle className="h-4 w-4" />
          </button>

          <button
            onClick={onOpenSupport}
            aria-label="Support Desk"
            className="hidden sm:flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-cyan-300 hover:bg-white/20"
          >
            <Headphones className="h-4 w-4" />
          </button>

          {user ? (
            <button
              onClick={onOpenDeposit}
              className="rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs font-extrabold tabular-nums"
            >
              <span className="text-[#28d028]">{Math.floor(displayBalance)}</span>{' '}
              <span className="text-white">INR</span>
            </button>
          ) : (
            <button
              onClick={onRequireAuth}
              className="rounded-full bg-amber-400 px-3.5 py-1 text-xs font-extrabold text-slate-950"
            >
              Login
            </button>
          )}
        </div>
      </header>

      {user?.isFrozen && (
        <div className="bg-rose-500/20 border-b border-rose-500/40 px-4 py-2 text-center text-xs font-semibold text-rose-200 flex items-center justify-center gap-2">
          <ShieldAlert className="h-4 w-4" /> Account frozen. Contact Admin Support.
        </div>
      )}

      <div className="mx-auto w-full max-w-3xl px-2.5 sm:px-4 pt-2 space-y-2.5 flex-1">
        {/* Recent Crash History Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {history.slice(0, 14).map((h, idx) => (
            <span
              key={`${h.roundId}-${idx}`}
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums bg-[#181a20] border border-white/10 ${
                h.crashPoint >= 5
                  ? 'text-fuchsia-300'
                  : h.crashPoint >= 2
                  ? 'text-violet-300'
                  : 'text-sky-300'
              }`}
            >
              {h.crashPoint.toFixed(2)}x
            </span>
          ))}
        </div>

        {/* Round ID + Ping Metadata Bar */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 tabular-nums">
          <span>Round ID: {roundId || 'Syncing...'}</span>
          <span>Live Sync: Active</span>
        </div>

        {/* Authentic 6x4 Mines Pro Multiplier Grid Chamber */}
        <div className="relative overflow-hidden rounded-2xl bg-[#191b21] border border-white/10 p-3 shadow-2xl space-y-2.5">
          {/* Header Inside Stage */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">Mines:3</span>

            <div className="text-center">
              {phase === 'betting' ? (
                <div className="text-lg sm:text-xl font-black text-amber-300 tabular-nums">
                  Starts in {minesPro?.countdownSec ?? 0}s
                </div>
              ) : phase === 'crashed' ? (
                <div className="text-xl sm:text-2xl font-black text-rose-400 tabular-nums">
                  {(minesPro?.crashPoint ?? serverMult).toFixed(2)}x BLAST!
                </div>
              ) : (
                <div className="text-2xl sm:text-3xl font-black text-[#4ae32d] tabular-nums drop-shadow-[0_0_12px_rgba(74,227,45,0.45)]">
                  {smoothMult.toFixed(2)}x
                </div>
              )}
            </div>

            <span className="text-[11px] font-bold text-slate-400 tabular-nums">
              Max 2025x
            </span>
          </div>

          {/* 6 columns x 4 rows = 24 Vault Tiles matching Screenshot */}
          <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
            {Array.from({ length: 24 }, (_, idx) => {
              const stepMult = idx < 21 ? TILE_MULTIPLIERS[idx] : null;
              const isStar =
                phase === 'flying'
                  ? idx < visibleStarsCount
                  : phase === 'crashed'
                  ? idx < visibleStarsCount && idx !== blastDisplayIdx
                  : false;
              const isBlast = phase === 'crashed' && idx === blastDisplayIdx;
              const isHiddenMine = phase === 'crashed' && (idx === 21 || idx === 22);

              return (
                <div key={idx} className="flex flex-col items-center gap-1 select-none">
                  <div
                    className={`relative w-full aspect-[1.28/1] rounded-lg border flex items-center justify-center transition-all duration-200 ${
                      isBlast
                        ? 'bg-gradient-to-b from-rose-500 to-orange-600 border-rose-200 shadow-[0_0_18px_rgba(244,63,94,0.85)] scale-105'
                        : isHiddenMine
                        ? 'bg-rose-950/90 border-rose-400/60'
                        : isStar
                        ? 'bg-gradient-to-b from-[#ffb43a] to-[#e67300] border-[#ffd88a] shadow-[0_4px_12px_rgba(245,158,11,0.5)]'
                        : 'bg-[#2a2c32] border-white/10 shadow-inner'
                    }`}
                  >
                    {isBlast ? (
                      <Bomb className="h-5 w-5 text-white animate-pulse" />
                    ) : isHiddenMine ? (
                      <Bomb className="h-4 w-4 text-rose-300" />
                    ) : isStar ? (
                      <svg
                        viewBox="0 0 24 24"
                        className="h-5 w-5 sm:h-6 sm:w-6 fill-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
                      >
                        <path d="M12 2.2l2.9 6 6.6.9-4.8 4.6 1.2 6.6L12 17.2 6.1 20.3l1.2-6.6-4.8-4.6 6.6-.9z" />
                      </svg>
                    ) : (
                      <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                    )}
                  </div>

                  {stepMult !== null ? (
                    <span
                      className={`text-[10px] font-bold tabular-nums leading-none ${
                        isBlast
                          ? 'text-rose-400'
                          : isStar
                          ? 'text-[#39e32d]'
                          : 'text-slate-300'
                      }`}
                    >
                      {stepMult >= 100
                        ? `${stepMult.toFixed(2)}x`
                        : `${stepMult.toFixed(2)}x`}
                    </span>
                  ) : (
                    <span className="text-[10px] leading-none text-transparent select-none">.</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

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

        {/* Dual Bet Panels Stacked */}
        <div className="space-y-2.5">
          {renderBetSlot(
            1,
            betAmount1,
            setBetAmount1,
            slot1Bet,
            autoPlay1,
            setAutoPlay1,
            autoStars1,
            setAutoStars1
          )}
          {renderBetSlot(
            2,
            betAmount2,
            setBetAmount2,
            slot2Bet,
            autoPlay2,
            setAutoPlay2,
            autoStars2,
            setAutoStars2
          )}
        </div>

        {/* All Bets | My Bets | Stats Tabs */}
        <div className="rounded-2xl bg-[#181a1f] border border-white/10 overflow-hidden">
          <div className="grid grid-cols-3 border-b border-white/10 bg-[#101115] p-1 gap-1">
            {(
              [
                { id: 'all', label: 'All Bets' },
                { id: 'my', label: 'My Bets' },
                { id: 'stats', label: 'Stats' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setHistoryViewTab(t.id)}
                className={`rounded-full py-2 text-xs font-bold transition ${
                  historyViewTab === t.id
                    ? 'bg-[#2a2c35] text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {historyViewTab === 'all' ? (
            <div>
              <div className="flex items-center justify-between bg-[#13151a] px-4 py-2 text-[11px] border-b border-white/5">
                <span className="inline-flex items-center gap-1 text-slate-300 font-semibold">
                  <Users className="h-3.5 w-3.5 text-slate-400" />
                  <span>ALL BETS: {simBets.length + currentRoundBets.length}</span>
                </span>
                <span className="text-slate-300 font-semibold tabular-nums">
                  Pool:{' '}
                  <strong className="text-emerald-400">
                    ₹{totalLivePool.toLocaleString('en-IN')}
                  </strong>
                </span>
              </div>

              <div className="max-h-56 overflow-y-auto divide-y divide-white/5">
                {currentRoundBets.map((b) => (
                  <div
                    key={b.id}
                    className="grid grid-cols-4 items-center px-4 py-2 text-xs bg-amber-500/10"
                  >
                    <span className="font-bold text-amber-300 truncate">
                      {user?.username || 'You'} (#{b.slot || 1})
                    </span>
                    <span className="text-right font-semibold text-white tabular-nums">
                      ₹{b.amount}
                    </span>
                    <span className="text-center font-bold tabular-nums">
                      {b.status === 'won' ? (
                        <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[11px] text-emerald-300">
                          {b.multiplier.toFixed(2)}x
                        </span>
                      ) : phase === 'crashed' ? (
                        <span className="text-rose-400 text-[11px]">Blast</span>
                      ) : (
                        <span className="text-amber-300 text-[11px]">Stars Open</span>
                      )}
                    </span>
                    <span className="text-right font-bold tabular-nums">
                      {b.status === 'won' ? (
                        <span className="text-emerald-400">+₹{b.payout.toFixed(2)}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </span>
                  </div>
                ))}

                {simBets.map((s) => {
                  const won = Boolean(s.cashedOutAt && s.payout);
                  return (
                    <div
                      key={s.id}
                      className={`grid grid-cols-4 items-center px-4 py-2 text-xs ${
                        won ? 'bg-emerald-500/10' : ''
                      }`}
                    >
                      <span className="font-semibold text-slate-300 truncate">{s.player}</span>
                      <span className="text-right text-white font-semibold tabular-nums">
                        ₹{s.amount}
                      </span>
                      <span className="text-center font-bold tabular-nums">
                        {won ? (
                          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[11px] text-emerald-300">
                            {s.cashedOutAt?.toFixed(2)}x
                          </span>
                        ) : phase === 'crashed' ? (
                          <span className="text-[11px] text-rose-400">Blast</span>
                        ) : (
                          <span className="text-[11px] text-slate-500">—</span>
                        )}
                      </span>
                      <span className="text-right font-bold tabular-nums">
                        {won ? (
                          <span className="text-emerald-400">+₹{s.payout?.toFixed(2)}</span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : historyViewTab === 'my' ? (
            !user ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Sign in to view your Mines Pro history.
              </div>
            ) : myMinesProBets.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No Mines Pro rounds played yet.
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto divide-y divide-white/5">
                {myMinesProBets.slice(0, 15).map((b) => (
                  <div key={b.id} className="flex items-center justify-between px-4 py-2.5 text-xs">
                    <div>
                      <div className="font-bold text-white">
                        {b.selection} · <span className="text-slate-400">{b.periodId}</span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Stake ₹{b.amount} {b.resultText ? `· ${b.resultText}` : ''}
                      </div>
                    </div>
                    <div className="text-right font-bold tabular-nums">
                      {b.status === 'pending' && <span className="text-amber-400">Stars Open</span>}
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
            )
          ) : (
            <div className="p-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl bg-[#111217] border border-white/10 p-2.5">
                <div className="text-slate-400 text-[10px]">Armed Mines</div>
                <div className="font-black text-rose-400 text-sm mt-0.5">3 / 24 Tiles</div>
              </div>
              <div className="rounded-xl bg-[#111217] border border-white/10 p-2.5">
                <div className="text-slate-400 text-[10px]">Max Multiplier</div>
                <div className="font-black text-amber-300 text-sm mt-0.5">2025.00x</div>
              </div>
              <div className="rounded-xl bg-[#111217] border border-white/10 p-2.5">
                <div className="text-slate-400 text-[10px]">Min / Max Bet</div>
                <div className="font-black text-emerald-300 text-sm mt-0.5">₹10 – ₹50k</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
