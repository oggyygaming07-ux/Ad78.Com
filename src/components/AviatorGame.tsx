import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Headphones,
  Minus,
  Plus,
  ShieldAlert,
  Users,
  Volume2,
  VolumeX,
  Wallet,
} from 'lucide-react';
import { AviatorPhase, AviatorState, BetRecord, UserProfile } from '../types';
import {
  playAviatorCashout,
  playAviatorCrash,
  playAviatorTakeoff,
  playBetConfirm,
  setSoundMuted,
  startAviatorFlightLoop,
  stopAviatorFlightLoop,
  updateAviatorFlightPitch,
} from '../utils/sound';
import { AVIATOR_MAX_BET, AVIATOR_MIN_BET } from '../utils/validation';

interface AviatorGameProps {
  user: UserProfile | null;
  token: string | null;
  aviator: AviatorState | null;
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
  'ta***55',
  'ya***19',
  'ga***61',
  'ri***04',
  'pa***87',
  'kr***38',
  'je***14',
  'bh***95',
];

const SIM_AMOUNTS = [100, 150, 200, 300, 500, 750, 1000, 1500, 2000, 3500, 5000];

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
    const targetMult = Number((1.15 + Math.pow(rand(), 1.6) * 6.5).toFixed(2));
    list.push({
      id: `${roundId}-sim-${i}`,
      player: name,
      amount,
      targetMult,
    });
  }
  return list;
}

export const AviatorGame: React.FC<AviatorGameProps> = ({
  user,
  token,
  aviator,
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
  const [slotMode1, setSlotMode1] = useState<'bet' | 'auto'>('bet');
  const [slotMode2, setSlotMode2] = useState<'bet' | 'auto'>('bet');
  const [autoCashout1, setAutoCashout1] = useState<string>('2.00');
  const [autoCashout2, setAutoCashout2] = useState<string>('5.00');
  const [autoActive1, setAutoActive1] = useState(false);
  const [autoActive2, setAutoActive2] = useState(false);

  const [busySlots, setBusySlots] = useState<Record<1 | 2, boolean>>({ 1: false, 2: false });
  const [muted, setMuted] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [historyViewTab, setHistoryViewTab] = useState<'all' | 'previous' | 'top'>('all');

  const phase: AviatorPhase = aviator?.phase || 'betting';
  const serverMult = aviator?.multiplier ?? 1.0;
  const roundId = aviator?.roundId || '';

  // Smooth 60fps interpolated multiplier
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

  // Live simulated player bets feed
  const [simBets, setSimBets] = useState<SimLiveBet[]>([]);
  const simQueueRef = useRef<SimLiveBet[]>([]);
  const lastSimRoundRef = useRef<string>('');

  useEffect(() => {
    if (!roundId) return;
    if (lastSimRoundRef.current !== roundId) {
      lastSimRoundRef.current = roundId;
      const batch = buildSimBatch(roundId, 28);
      setSimBets(batch.slice(0, 8));
      simQueueRef.current = batch.slice(8);
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
    }, 300);
    return () => window.clearInterval(interval);
  }, [phase, roundId]);

  useEffect(() => {
    if (phase !== 'flying') return;
    setSimBets((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        if (!item.cashedOutAt && serverMult >= item.targetMult) {
          changed = true;
          return {
            ...item,
            cashedOutAt: item.targetMult,
            payout: Number((item.amount * item.targetMult).toFixed(2)),
          };
        }
        return item;
      });
      return changed ? next : prev;
    });
  }, [phase, serverMult]);

  // Smooth balance animation
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

  // Authentic Aviator engine flight sound & crash loop
  const prevPhaseRef = useRef<AviatorPhase | null>(null);

  useEffect(() => {
    const prev = prevPhaseRef.current;
    if (prev !== phase) {
      prevPhaseRef.current = phase;
      if (!muted) {
        if (phase === 'flying') {
          playAviatorTakeoff();
          startAviatorFlightLoop(serverMult);
        } else if (phase === 'crashed') {
          playAviatorCrash();
        } else if (phase === 'betting') {
          stopAviatorFlightLoop();
        }
      } else {
        stopAviatorFlightLoop();
      }
    } else if (phase === 'flying' && !muted) {
      updateAviatorFlightPitch(serverMult);
    }
  }, [phase, serverMult, muted]);

  useEffect(() => {
    return () => {
      stopAviatorFlightLoop();
    };
  }, []);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setSoundMuted(next);
    if (next) {
      stopAviatorFlightLoop();
    } else if (phase === 'flying') {
      startAviatorFlightLoop(serverMult);
    }
  };

  const currentRoundBets = useMemo(
    () => myBets.filter((b) => b.game === 'aviator' && b.periodId === roundId),
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

  // Auto cashout watcher during flight
  const autoCashoutTrigRef = useRef<{ 1: string; 2: string }>({ 1: '', 2: '' });
  useEffect(() => {
    if (phase !== 'flying') {
      if (phase === 'betting') {
        autoCashoutTrigRef.current = { 1: '', 2: '' };
      }
      return;
    }
    const target1 = Number(autoCashout1);
    if (
      autoActive1 &&
      slot1Bet?.status === 'pending' &&
      Number.isFinite(target1) &&
      target1 >= 1.05 &&
      serverMult >= target1 &&
      autoCashoutTrigRef.current[1] !== roundId
    ) {
      autoCashoutTrigRef.current[1] = roundId;
      handleCashout(1, slot1Bet);
    }
    const target2 = Number(autoCashout2);
    if (
      autoActive2 &&
      slot2Bet?.status === 'pending' &&
      Number.isFinite(target2) &&
      target2 >= 1.05 &&
      serverMult >= target2 &&
      autoCashoutTrigRef.current[2] !== roundId
    ) {
      autoCashoutTrigRef.current[2] = roundId;
      handleCashout(2, slot2Bet);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, serverMult, roundId, autoActive1, autoActive2, slot1Bet?.status, slot2Bet?.status]);

  // Flight progress along glowing parabolic climb curve (0..1)
  const progress = useMemo(() => {
    if (phase === 'betting') return 0;
    return Math.min(1, Math.log(Math.max(1, smoothMult)) / Math.log(8.5));
  }, [phase, smoothMult]);

  const planeX = 24 + progress * 250;
  const planeY = 152 - Math.pow(progress, 0.85) * 116;

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
      setFeedback({ type: 'err', text: 'Wait for next flight countdown to place bet.' });
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
      const res = await fetch('/api/aviator/bet', {
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
        text: `Bet #${slot} (₹${Math.round(amt)}) locked for ${roundId}!`,
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
      const res = await fetch('/api/aviator/cashout', {
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

  const myAviatorBets = myBets.filter((b) => b.game === 'aviator');
  const history = aviator?.history || [];

  const totalLivePool = useMemo(() => {
    const simSum = simBets.reduce((acc, s) => acc + s.amount, 0);
    const mineSum = currentRoundBets.reduce((acc, b) => acc + b.amount, 0);
    return simSum + mineSum;
  }, [simBets, currentRoundBets]);

  const topMultipliers = useMemo(
    () => [...history].sort((a, b) => b.crashPoint - a.crashPoint).slice(0, 15),
    [history]
  );

  const renderBetSlot = (
    slot: 1 | 2,
    amountStr: string,
    setAmountStr: React.Dispatch<React.SetStateAction<string>>,
    activeBet: BetRecord | null,
    slotMode: 'bet' | 'auto',
    setSlotMode: React.Dispatch<React.SetStateAction<'bet' | 'auto'>>,
    autoCashStr: string,
    setAutoCashStr: React.Dispatch<React.SetStateAction<string>>,
    autoEnabled: boolean,
    setAutoEnabled: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    const parsedAmt = Math.max(0, Number(amountStr) || 0);
    const isPending = activeBet?.status === 'pending';
    const isWon = activeBet?.status === 'won';
    const isBusy = busySlots[slot];
    const inputLocked = Boolean(isPending) || phase === 'flying';

    return (
      <div className="rounded-2xl bg-[#1a1b20] border border-white/10 p-3 space-y-2.5 shadow-lg">
        {/* Top Bet | Auto Segmented Pill */}
        <div className="flex items-center justify-between gap-2">
          <div className="w-8" />
          <div className="inline-flex rounded-full bg-[#101114] p-0.5 border border-white/10">
            <button
              type="button"
              onClick={() => setSlotMode('bet')}
              className={`rounded-full px-5 py-1 text-xs font-bold transition ${
                slotMode === 'bet' ? 'bg-[#2c2e36] text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Bet
            </button>
            <button
              type="button"
              onClick={() => setSlotMode('auto')}
              className={`rounded-full px-5 py-1 text-xs font-bold transition ${
                slotMode === 'auto' ? 'bg-[#2c2e36] text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Auto
            </button>
          </div>
          <span className="text-[10px] font-semibold text-slate-400 tabular-nums">
            ₹10–50k
          </span>
        </div>

        {/* Main 2-Column Bet Box matching Screenshot */}
        <div className="grid grid-cols-12 gap-2.5 items-stretch">
          <div className="col-span-6 space-y-1.5">
            {/* Minus / Input / Plus Pill */}
            <div className="flex items-center justify-between rounded-full bg-[#0e0f13] border border-white/15 px-1.5 py-1">
              <button
                type="button"
                disabled={inputLocked}
                onClick={() => adjustAmount(setAmountStr, -10)}
                aria-label={`Decrease bet ${slot}`}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#24262d] text-white hover:bg-[#32353f] disabled:opacity-40"
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
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#24262d] text-white hover:bg-[#32353f] disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* 2x2 Quick Chips (10, 100, 500, 1000) */}
            <div className="grid grid-cols-2 gap-1.5">
              {PRESETS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  disabled={inputLocked}
                  onClick={() => setAmountStr(String(amt))}
                  className="rounded-full bg-[#131419] border border-white/10 py-1 text-xs font-bold text-slate-200 hover:border-emerald-400/50 hover:text-white disabled:opacity-40 tabular-nums"
                >
                  {amt.toLocaleString('en-IN')}
                </button>
              ))}
            </div>
          </div>

          <div className="col-span-6 flex">
            {isPending && activeBet && phase === 'flying' ? (
              <button
                onClick={() => handleCashout(slot, activeBet)}
                disabled={isBusy}
                className="w-full flex flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-amber-400 to-orange-500 border border-amber-200/50 py-2 px-3 text-center shadow-[0_0_24px_rgba(245,158,11,0.45)] hover:brightness-110 active:scale-[0.98] transition"
              >
                <div className="text-xs font-extrabold uppercase tracking-wide text-slate-950">
                  Cash Out
                </div>
                <div className="text-lg font-black text-slate-950 tabular-nums">
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
                  Bet Locked · ₹{activeBet.amount}
                </div>
                <div className="text-[11px] text-slate-200 mt-0.5">
                  Waiting for takeoff
                </div>
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
                <div className="text-lg sm:text-xl font-bold text-white leading-tight">
                  {phase === 'betting' ? (isBusy ? 'Placing...' : 'Bet') : 'Wait'}
                </div>
                <div className="text-xs sm:text-sm font-semibold text-white/95 tabular-nums">
                  {parsedAmt.toFixed(2)} INR
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Auto Cash Out bar shown cleanly when Auto tab selected */}
        {slotMode === 'auto' && (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-[#111217] border border-white/10 px-3 py-2 text-xs">
            <label className="inline-flex items-center gap-2 font-bold text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={autoEnabled}
                onChange={(e) => setAutoEnabled(e.target.checked)}
                className="accent-emerald-400 h-4 w-4"
              />
              <span>Auto Cash Out</span>
            </label>
            <div className="flex items-center gap-1 rounded-full bg-[#1d1f26] border border-white/15 px-3 py-1">
              <input
                type="number"
                step="0.1"
                min="1.10"
                max="1000"
                value={autoCashStr}
                onChange={(e) => setAutoCashStr(e.target.value)}
                className="w-16 bg-transparent text-right font-extrabold text-amber-300 tabular-nums focus:outline-none"
              />
              <span className="font-bold text-slate-300">x</span>
            </div>
          </div>
        )}

        {parsedAmt > 0 && parsedAmt < AVIATOR_MIN_BET && (
          <div className="flex items-center gap-1 text-[11px] text-rose-400">
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>Minimum Aviator bet is ₹10.</span>
          </div>
        )}
      </div>
    );
  };

  const isBlueFlash = phase === 'flying' && Math.floor(smoothMult * 6) % 2 === 0;
  const isRedFlash = phase === 'flying' && !isBlueFlash;

  // Dynamic Multiplier-Driven Running Light Palette (shifts color automatically as multiplier climbs)
  const flightTheme = useMemo(() => {
    if (smoothMult >= 25) {
      return {
        primary: '#10b981',
        secondary: '#ff1e42',
        glowRgba: 'rgba(16,185,129,0.42)',
        altRgba: 'rgba(255,30,66,0.34)',
        borderClass: 'border-emerald-400/75 shadow-[0_0_32px_rgba(16,185,129,0.35)]',
        tierLabel: 'OVERDRIVE',
      };
    }
    if (smoothMult >= 10) {
      return {
        primary: '#f59e0b',
        secondary: '#fbbf24',
        glowRgba: 'rgba(245,158,11,0.40)',
        altRgba: 'rgba(251,191,36,0.28)',
        borderClass: 'border-amber-400/70 shadow-[0_0_30px_rgba(245,158,11,0.32)]',
        tierLabel: 'GOLD SURGE',
      };
    }
    if (smoothMult >= 5) {
      return {
        primary: '#ec4899',
        secondary: '#f43f5e',
        glowRgba: 'rgba(236,72,153,0.38)',
        altRgba: 'rgba(244,63,94,0.26)',
        borderClass: 'border-pink-400/65 shadow-[0_0_28px_rgba(236,72,153,0.30)]',
        tierLabel: 'MAGENTA BOOST',
      };
    }
    if (smoothMult >= 2) {
      return {
        primary: '#a855f7',
        secondary: '#38bdf8',
        glowRgba: 'rgba(168,85,247,0.36)',
        altRgba: 'rgba(56,189,248,0.24)',
        borderClass: 'border-violet-400/65 shadow-[0_0_26px_rgba(168,85,247,0.28)]',
        tierLabel: 'VIOLET CLIMB',
      };
    }
    return {
      primary: isBlueFlash ? '#38bdf8' : '#ff1e42',
      secondary: isBlueFlash ? '#ff1e42' : '#38bdf8',
      glowRgba: isBlueFlash ? 'rgba(56,189,248,0.32)' : 'rgba(255,30,66,0.30)',
      altRgba: isBlueFlash ? 'rgba(255,30,66,0.18)' : 'rgba(56,189,248,0.20)',
      borderClass: isBlueFlash
        ? 'border-sky-400/60 shadow-[0_0_24px_rgba(56,189,248,0.24)]'
        : 'border-rose-500/60 shadow-[0_0_24px_rgba(255,30,66,0.24)]',
      tierLabel: 'TAKEOFF',
    };
  }, [smoothMult, isBlueFlash]);

  const sweepLeftPct = ((progress * 130 + (smoothMult - 1) * 15) % 120) - 10;

  return (
    <div className="min-h-screen bg-[#0c0d11] text-white flex flex-col justify-between pb-6">
      {/* Authentic Aviator Dark Top Bar */}
      <header className="sticky top-0 z-30 flex h-12 items-center justify-between bg-[#14151a]/95 backdrop-blur-md border-b border-white/10 px-3 sm:px-5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              stopAviatorFlightLoop();
              onBack();
            }}
            aria-label="Back to Home"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span
            className="text-xl sm:text-2xl font-black italic tracking-tight text-[#e51937] select-none"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            Aviator
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={toggleMute}
            aria-label={muted ? 'Unmute flight sound' : 'Mute flight sound'}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
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
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-cyan-300 hover:bg-white/20"
          >
            <Headphones className="h-4 w-4" />
          </button>
          {user ? (
            <button
              onClick={onOpenDeposit}
              className="flex items-center gap-1 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs font-extrabold text-[#28d028] tabular-nums"
            >
              <Wallet className="h-3.5 w-3.5 text-slate-300" />
              <span>{displayBalance.toFixed(2)} INR</span>
            </button>
          ) : (
            <button
              onClick={onRequireAuth}
              className="rounded-full bg-[#e51937] px-3.5 py-1 text-xs font-bold text-white"
            >
              Login
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl px-2.5 sm:px-4 pt-2 space-y-2.5 flex-1">
        {/* Recent Crash History Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar px-1 py-1">
          {history.length === 0 ? (
            <span className="text-xs text-slate-400">Syncing flights...</span>
          ) : (
            history.slice(0, 16).map((item, idx) => (
              <span
                key={`${item.roundId}-${idx}`}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums shrink-0 ${
                  item.crashPoint >= 10.0
                    ? 'text-fuchsia-300 bg-fuchsia-500/15 border border-fuchsia-400/30'
                    : item.crashPoint >= 2.0
                    ? 'text-violet-300 bg-violet-500/15 border border-violet-400/30'
                    : 'text-sky-300 bg-sky-500/15 border border-sky-400/25'
                }`}
              >
                {item.crashPoint.toFixed(2)}x
              </span>
            ))
          )}
        </div>

        {/* Obsidian Sunburst Flight Radar Stage */}
        <div
          className={`relative overflow-hidden rounded-2xl border bg-[#08090d] shadow-2xl transition-colors duration-300 ${
            phase === 'flying'
              ? flightTheme.borderClass
              : phase === 'crashed'
              ? 'border-rose-500/70 shadow-[0_0_26px_rgba(255,30,66,0.28)]'
              : 'border-white/10'
          }`}
        >
          <div className="relative h-64 sm:h-72 w-full overflow-hidden">
            {/* Rotating Sunburst dark rays synced to climb */}
            <div
              className="pointer-events-none absolute -bottom-48 -left-48 h-[600px] w-[600px] opacity-35 transition-transform duration-150"
              style={{
                transform: phase === 'flying' ? `rotate(${(progress * 45 + (smoothMult - 1) * 14) % 360}deg)` : 'rotate(0deg)',
                background:
                  phase === 'flying'
                    ? `repeating-conic-gradient(from 0deg, ${flightTheme.glowRgba} 0deg 6deg, transparent 6deg 22deg)`
                    : 'repeating-conic-gradient(from 0deg, rgba(255,255,255,0.08) 0deg 8deg, transparent 8deg 22deg)',
              }}
            />

            {/* Multiplier-synced Dynamic Color-Shifting Background Lighting */}
            <div
              className="pointer-events-none absolute inset-0 transition-all duration-300"
              style={{
                background:
                  phase === 'crashed'
                    ? 'radial-gradient(circle at 50% 50%, rgba(229,25,55,0.34) 0%, transparent 65%)'
                    : phase === 'flying'
                    ? `radial-gradient(circle at ${(planeX / 320) * 100}% ${(planeY / 170) * 100}%, ${flightTheme.glowRgba} 0%, transparent 56%), radial-gradient(circle at 20% 80%, ${flightTheme.altRgba} 0%, transparent 62%)`
                    : 'radial-gradient(circle at 50% 50%, rgba(56,189,248,0.12) 0%, transparent 60%)',
              }}
            />

            {/* Running Light Sweep Across Stage as Multiplier Climbs */}
            {phase === 'flying' && (
              <div
                className="pointer-events-none absolute inset-y-0 w-36 -skew-x-12 opacity-60 blur-xl transition-all duration-150"
                style={{
                  left: `${sweepLeftPct}%`,
                  background: `linear-gradient(90deg, transparent, ${flightTheme.glowRgba}, transparent)`,
                }}
              />
            )}

            {/* Dual Top Corner Light-Blue & Red Strobe Beacons + Tier Light Pill */}
            {phase === 'flying' && (
              <>
                <span
                  className={`pointer-events-none absolute top-2.5 left-3 h-2.5 w-2.5 rounded-full transition-all duration-100 ${
                    isBlueFlash
                      ? 'bg-sky-300 scale-125 shadow-[0_0_16px_4px_rgba(56,189,248,0.95)] opacity-100'
                      : 'bg-sky-500/40 scale-90 opacity-45'
                  }`}
                />
                <span
                  className={`pointer-events-none absolute top-2.5 right-3 h-2.5 w-2.5 rounded-full transition-all duration-100 ${
                    isRedFlash
                      ? 'bg-rose-400 scale-125 shadow-[0_0_16px_4px_rgba(255,30,66,0.95)] opacity-100'
                      : 'bg-rose-600/40 scale-90 opacity-45'
                  }`}
                />
              </>
            )}

            {/* Coordinate axis ticks along left & bottom */}
            <div className="pointer-events-none absolute left-2 top-3 bottom-6 flex flex-col justify-between text-[9px] font-semibold text-white/25 tabular-nums">
              <span>•</span>
              <span>•</span>
              <span>•</span>
              <span>•</span>
            </div>

            {/* Curved Dynamic Color Trajectory + Filled Area */}
            <svg
              viewBox="0 0 320 170"
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full"
            >
              <defs>
                <linearGradient id="aviatorAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={flightTheme.primary} stopOpacity="0.58" />
                  <stop offset="100%" stopColor={flightTheme.secondary} stopOpacity="0.16" />
                </linearGradient>
              </defs>

              {phase === 'flying' && (
                <>
                  <path
                    d={`M 24 156 Q ${(24 + planeX) * 0.56} 156 ${planeX} ${planeY} L ${planeX} 166 L 24 166 Z`}
                    fill="url(#aviatorAreaGrad)"
                  />
                  <path
                    d={`M 24 156 Q ${(24 + planeX) * 0.56} 156 ${planeX} ${planeY}`}
                    fill="none"
                    stroke={flightTheme.primary}
                    strokeWidth="3.4"
                    strokeLinecap="round"
                  />
                </>
              )}
            </svg>

            {/* Crimson Vintage Aviator Plane with Blinking Light-Blue & Red Strobe Lights */}
            {phase === 'flying' && (
              <div
                className="gpu-layer absolute -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${(planeX / 320) * 100}%`,
                  top: `${(planeY / 170) * 100}%`,
                }}
              >
                <svg
                  width="64"
                  height="38"
                  viewBox="0 0 64 38"
                  className="-rotate-12 drop-shadow-[0_4px_14px_rgba(229,25,55,0.75)]"
                >
                  <path d="M2 22 L12 19 L12 24 Z" fill="#fda4af" opacity="0.7" />
                  <path d="M12 19 L8 9 L16 11 L22 18 Z" fill="#dc2626" />
                  <path
                    d="M12 18 Q28 13 48 16 L54 19 L48 24 Q28 26 12 22 Z"
                    fill="#ff1e42"
                    stroke="#fecdd3"
                    strokeWidth="0.9"
                  />
                  <path d="M26 15 L38 7 L43 9 L35 16 Z" fill="#b91c1c" />
                  <path d="M31 15 Q35 12 39 15 Z" fill="#e0f2fe" />
                  <text x="34" y="21.5" fill="#fff" fontSize="6" fontWeight="900">
                    X
                  </text>
                  <ellipse cx="55" cy="19.5" rx="2.2" ry="9" fill="#f8fafc" opacity="0.88" />
                  <circle cx="54" cy="19.5" r="2.2" fill="#fbbf24" />
                  {/* Tail Red Beacon & Wing Light-Blue Strobe */}
                  <circle
                    cx="11"
                    cy="9"
                    r={isRedFlash ? '3.4' : '1.6'}
                    fill="#ff1e42"
                    opacity={isRedFlash ? '1' : '0.35'}
                  />
                  <circle
                    cx="39"
                    cy="7.5"
                    r={isBlueFlash ? '3.4' : '1.6'}
                    fill="#38bdf8"
                    opacity={isBlueFlash ? '1' : '0.35'}
                  />
                </svg>
              </div>
            )}

            {/* Center Giant Multiplier / Countdown Display */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-4">
              {phase === 'betting' && (
                <div className="text-center space-y-2">
                  <div className="text-xs font-bold uppercase tracking-widest text-rose-400">
                    Waiting For Next Round
                  </div>
                  <div className="text-5xl sm:text-6xl font-black text-white tabular-nums">
                    {aviator?.countdownSec ?? 0}s
                  </div>
                  <div className="mx-auto h-1.5 w-44 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-[#e51937] transition-all duration-300"
                      style={{
                        width: `${Math.min(100, ((aviator?.countdownSec ?? 0) / 6) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {phase === 'flying' && (
                <div className="text-center">
                  <div className="text-5xl sm:text-7xl font-black text-white tabular-nums tracking-tight drop-shadow-[0_4px_20px_rgba(0,0,0,0.9)]">
                    {smoothMult.toFixed(2)}x
                  </div>
                </div>
              )}

              {phase === 'crashed' && (
                <div className="text-center space-y-1">
                  <div className="text-sm sm:text-base font-extrabold uppercase tracking-wider text-white">
                    FLEW AWAY!
                  </div>
                  <div className="text-5xl sm:text-6xl font-black text-[#ff1e42] tabular-nums drop-shadow-[0_0_24px_rgba(255,30,66,0.5)]">
                    {(aviator?.crashPoint ?? serverMult).toFixed(2)}x
                  </div>
                </div>
              )}
            </div>

            {/* Bottom-right live players badge (matching 468 badge in screenshot) */}
            <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 rounded-full bg-black/75 border border-white/15 px-2.5 py-1 text-[11px] font-bold text-white shadow">
              <div className="flex -space-x-1.5">
                <span className="h-4 w-4 rounded-full bg-amber-400 border border-black" />
                <span className="h-4 w-4 rounded-full bg-pink-500 border border-black" />
                <span className="h-4 w-4 rounded-full bg-emerald-400 border border-black" />
              </div>
              <span className="tabular-nums">{simBets.length + currentRoundBets.length + 440}</span>
            </div>
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

        {/* Stacked Dual Bet Panels (#1 & #2) */}
        <div className="space-y-2.5">
          {renderBetSlot(
            1,
            betAmount1,
            setBetAmount1,
            slot1Bet,
            slotMode1,
            setSlotMode1,
            autoCashout1,
            setAutoCashout1,
            autoActive1,
            setAutoActive1
          )}
          {renderBetSlot(
            2,
            betAmount2,
            setBetAmount2,
            slot2Bet,
            slotMode2,
            setSlotMode2,
            autoCashout2,
            setAutoCashout2,
            autoActive2,
            setAutoActive2
          )}
        </div>

        {/* All Bets | Previous | Top Bottom Panel */}
        <div className="rounded-2xl bg-[#16171c] border border-white/10 overflow-hidden">
          <div className="grid grid-cols-3 border-b border-white/10 bg-[#101115] p-1 gap-1">
            {(
              [
                { id: 'all', label: 'All Bets' },
                { id: 'previous', label: 'Previous' },
                { id: 'top', label: 'Top' },
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
              <div className="flex items-center justify-between bg-[#121318] px-4 py-2 text-[11px] border-b border-white/5">
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

              <div className="grid grid-cols-4 px-4 py-1.5 text-[10px] font-bold uppercase text-slate-500 bg-[#0e0f13] border-b border-white/5">
                <span>User</span>
                <span className="text-right">Bet INR</span>
                <span className="text-center">X</span>
                <span className="text-right">Cash out INR</span>
              </div>

              <div className="max-h-60 overflow-y-auto divide-y divide-white/5">
                {currentRoundBets.map((b) => (
                  <div
                    key={b.id}
                    className="grid grid-cols-4 items-center px-4 py-2 text-xs bg-emerald-500/10"
                  >
                    <span className="font-bold text-cyan-300 truncate">
                      {user?.username || 'You'} (#{b.slot || 1})
                    </span>
                    <span className="text-right font-semibold text-white tabular-nums">
                      ₹{b.amount}
                    </span>
                    <span className="text-center font-bold tabular-nums">
                      {b.status === 'won' ? (
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] text-emerald-300">
                          {b.multiplier.toFixed(2)}x
                        </span>
                      ) : phase === 'crashed' ? (
                        <span className="text-rose-400 text-[11px]">Crash</span>
                      ) : (
                        <span className="text-amber-300 text-[11px]">Flying</span>
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
                        {s.amount.toFixed(2)}
                      </span>
                      <span className="text-center font-bold tabular-nums">
                        {won ? (
                          <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[11px] text-violet-300">
                            {s.cashedOutAt?.toFixed(2)}x
                          </span>
                        ) : phase === 'crashed' ? (
                          <span className="text-[11px] text-rose-400">Crash</span>
                        ) : (
                          <span className="text-[11px] text-slate-500">—</span>
                        )}
                      </span>
                      <span className="text-right font-bold tabular-nums">
                        {won ? (
                          <span className="text-emerald-400">{s.payout?.toFixed(2)}</span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : historyViewTab === 'previous' ? (
            !user ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Sign in to view your Aviator flight history.
              </div>
            ) : myAviatorBets.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No Aviator flights played yet.
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto divide-y divide-white/5">
                {myAviatorBets.slice(0, 20).map((b) => (
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
                      {b.status === 'pending' && <span className="text-amber-400">In Flight</span>}
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
            <div className="max-h-60 overflow-y-auto divide-y divide-white/5">
              {topMultipliers.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  No top multipliers recorded yet.
                </div>
              ) : (
                topMultipliers.map((h, i) => (
                  <div key={`${h.roundId}-${i}`} className="flex items-center justify-between px-4 py-2.5 text-xs">
                    <span className="font-bold text-slate-300">#{i + 1} · {h.roundId}</span>
                    <span className="rounded-full bg-fuchsia-500/20 px-3 py-0.5 font-black text-fuchsia-300 tabular-nums">
                      {h.crashPoint.toFixed(2)}x
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
