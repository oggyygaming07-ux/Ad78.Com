import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Headphones,
  History,
  Minus,
  Plus,
  Volume2,
  VolumeX,
  Wallet,
  X,
} from 'lucide-react';
import { BetRecord, TowerRushSessionPublic, UserProfile } from '../types';
import {
  playBetConfirm,
  playTowerCrash,
  playTowerDrop,
  playWinChime,
  setSoundMuted,
} from '../utils/sound';

interface TowerRushGameProps {
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

const MIN_STAKE = 50;
const MAX_STAKE = 1000;
const STAKE_PRESETS = [50, 100, 250, 500, 1000];

const TownHouseFloorSvg: React.FC<{ floorIndex: number; collapsed?: boolean }> = ({
  floorIndex,
  collapsed,
}) => {
  const variant = ((floorIndex % 6) + 6) % 6;
  const cls = `h-14 w-28 sm:h-16 sm:w-32 drop-shadow-[0_6px_12px_rgba(0,0,0,0.45)] ${
    collapsed ? 'animate-debris-drop gpu-layer' : ''
  }`;

  if (variant === 1) {
    // 1. Terracotta Corner Bistro with striped red/cream awning
    return (
      <svg viewBox="0 0 120 68" className={cls}>
        <rect x="6" y="4" width="108" height="7" rx="2" fill="#9a3412" stroke="#431407" strokeWidth="1.5" />
        <rect x="10" y="11" width="100" height="53" rx="2" fill="#c2410c" stroke="#7c2d12" strokeWidth="1.5" />
        <rect x="14" y="16" width="92" height="10" rx="2" fill="#dc2626" />
        <path d="M16 16 L24 26 M32 16 L40 26 M48 16 L56 26 M64 16 L72 26 M80 16 L88 26 M96 16 L104 26" stroke="#fef2f2" strokeWidth="4" />
        <rect x="18" y="30" width="38" height="24" rx="2" fill="#fef08a" stroke="#451a03" strokeWidth="1.5" />
        <line x1="37" y1="30" x2="37" y2="54" stroke="#78350f" strokeWidth="1.5" />
        <rect x="64" y="29" width="38" height="28" rx="3" fill="#451a03" stroke="#fed7aa" strokeWidth="1.5" />
        <rect x="70" y="34" width="26" height="14" rx="1" fill="#fde047" opacity="0.88" />
        <circle cx="95" cy="48" r="2" fill="#fbbf24" />
      </svg>
    );
  }

  if (variant === 2) {
    // 2. Modern Cyan Glass Skyscraper Suite
    return (
      <svg viewBox="0 0 120 68" className={cls}>
        <rect x="8" y="4" width="104" height="6" rx="1.5" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.2" />
        <rect x="10" y="10" width="100" height="54" rx="2" fill="#0369a1" stroke="#0c4a6e" strokeWidth="1.5" />
        <rect x="15" y="14" width="20" height="44" rx="1" fill="#38bdf8" opacity="0.82" />
        <rect x="39" y="14" width="20" height="44" rx="1" fill="#7dd3fc" opacity="0.86" />
        <rect x="63" y="14" width="20" height="44" rx="1" fill="#38bdf8" opacity="0.82" />
        <rect x="87" y="14" width="18" height="44" rx="1" fill="#bae6fd" opacity="0.78" />
        <line x1="12" y1="36" x2="108" y2="36" stroke="#0f172a" strokeWidth="2.4" />
        <path d="M18 16 L28 32 M42 16 L52 32 M66 16 L76 32" stroke="#ffffff" strokeWidth="1.4" opacity="0.5" />
      </svg>
    );
  }

  if (variant === 3) {
    // 3. Emerald Garden Terrace with iron balcony railing & flower pots
    return (
      <svg viewBox="0 0 120 68" className={cls}>
        <rect x="6" y="4" width="108" height="7" rx="2" fill="#047857" stroke="#064e3b" strokeWidth="1.5" />
        <rect x="10" y="11" width="100" height="53" rx="2" fill="#10b981" stroke="#065f46" strokeWidth="1.5" />
        <rect x="18" y="18" width="24" height="26" rx="12" fill="#ecfdf5" stroke="#064e3b" strokeWidth="1.5" />
        <rect x="21" y="21" width="18" height="20" rx="9" fill="#fef08a" />
        <rect x="48" y="18" width="24" height="26" rx="12" fill="#ecfdf5" stroke="#064e3b" strokeWidth="1.5" />
        <rect x="51" y="21" width="18" height="20" rx="9" fill="#fef08a" />
        <rect x="78" y="18" width="24" height="26" rx="12" fill="#ecfdf5" stroke="#064e3b" strokeWidth="1.5" />
        <rect x="81" y="21" width="18" height="20" rx="9" fill="#fef08a" />
        <rect x="12" y="47" width="96" height="12" fill="none" stroke="#064e3b" strokeWidth="1.8" />
        <path d="M22 47 V59 M34 47 V59 M46 47 V59 M58 47 V59 M70 47 V59 M82 47 V59 M94 47 V59" stroke="#064e3b" strokeWidth="1.4" />
        <circle cx="28" cy="46" r="3" fill="#f43f5e" />
        <circle cx="60" cy="46" r="3" fill="#fb923c" />
        <circle cx="92" cy="46" r="3" fill="#f43f5e" />
      </svg>
    );
  }

  if (variant === 4) {
    // 4. Violet Cyber Arcade Studio with glowing cyan strip
    return (
      <svg viewBox="0 0 120 68" className={cls}>
        <rect x="6" y="4" width="108" height="6" rx="2" fill="#4c1d95" stroke="#22d3ee" strokeWidth="1.3" />
        <rect x="10" y="10" width="100" height="54" rx="2" fill="#312e81" stroke="#4338ca" strokeWidth="1.5" />
        <rect x="16" y="15" width="88" height="4" rx="2" fill="#22d3ee" />
        <rect x="18" y="25" width="24" height="30" rx="3" fill="#0f172a" stroke="#a855f7" strokeWidth="1.5" />
        <rect x="22" y="29" width="16" height="16" fill="#38bdf8" opacity="0.85" />
        <rect x="48" y="25" width="24" height="30" rx="3" fill="#0f172a" stroke="#ec4899" strokeWidth="1.5" />
        <circle cx="60" cy="40" r="7" fill="#f472b6" opacity="0.85" />
        <rect x="78" y="25" width="24" height="30" rx="3" fill="#0f172a" stroke="#a855f7" strokeWidth="1.5" />
        <rect x="82" y="29" width="16" height="16" fill="#38bdf8" opacity="0.85" />
      </svg>
    );
  }

  if (variant === 5) {
    // 5. Royal Gold & Crimson Penthouse Clock Block
    return (
      <svg viewBox="0 0 120 68" className={cls}>
        <rect x="6" y="4" width="108" height="7" rx="2" fill="#fbbf24" stroke="#92400e" strokeWidth="1.5" />
        <rect x="10" y="11" width="100" height="53" rx="2" fill="#991b1b" stroke="#fbbf24" strokeWidth="1.5" />
        <rect x="15" y="15" width="8" height="45" fill="#fbbf24" opacity="0.88" />
        <rect x="97" y="15" width="8" height="45" fill="#fbbf24" opacity="0.88" />
        <rect x="28" y="24" width="16" height="24" rx="2" fill="#fef08a" stroke="#fbbf24" strokeWidth="1.4" />
        <rect x="76" y="24" width="16" height="24" rx="2" fill="#fef08a" stroke="#fbbf24" strokeWidth="1.4" />
        <circle cx="60" cy="36" r="13" fill="#fffbeb" stroke="#fbbf24" strokeWidth="2.5" />
        <line x1="60" y1="36" x2="60" y2="27" stroke="#7f1d1d" strokeWidth="2" strokeLinecap="round" />
        <line x1="60" y1="36" x2="67" y2="39" stroke="#7f1d1d" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  // 0. Classic Amber Townhouse
  return (
    <svg viewBox="0 0 120 68" className={cls}>
      <rect x="6" y="4" width="108" height="7" rx="2" fill="#c87b28" stroke="#7c4711" strokeWidth="1.5" />
      <rect x="10" y="11" width="100" height="53" rx="2" fill="#e8aa24" stroke="#8f5414" strokeWidth="1.5" />
      <rect x="13" y="14" width="94" height="47" fill="#f8d26a" opacity="0.24" />
      <rect x="20" y="21" width="6" height="22" rx="1" fill="#2d7a36" stroke="#14451a" strokeWidth="1" />
      <rect x="26" y="21" width="18" height="22" rx="1" fill="#2e211b" stroke="#f8e4b5" strokeWidth="1.5" />
      <rect x="28" y="23" width="14" height="18" fill="#ffd984" opacity="0.72" />
      <line x1="35" y1="22" x2="35" y2="42" stroke="#5b3d24" strokeWidth="1.2" />
      <rect x="44" y="21" width="6" height="22" rx="1" fill="#2d7a36" stroke="#14451a" strokeWidth="1" />
      <rect x="24" y="43" width="22" height="5" rx="1" fill="#8b4513" />
      <circle cx="29" cy="42" r="2.5" fill="#22c55e" />
      <circle cx="35" cy="41.5" r="2.5" fill="#ef4444" />
      <circle cx="41" cy="42" r="2.5" fill="#22c55e" />
      <rect x="68" y="21" width="6" height="28" rx="1" fill="#2d7a36" stroke="#14451a" strokeWidth="1" />
      <rect x="74" y="21" width="20" height="36" rx="2" fill="#7a3e19" stroke="#f8e4b5" strokeWidth="1.5" />
      <rect x="78" y="25" width="12" height="12" rx="1" fill="#ffe08c" opacity="0.82" />
      <circle cx="90" cy="41" r="1.5" fill="#fbbf24" />
      <rect x="94" y="21" width="6" height="28" rx="1" fill="#2d7a36" stroke="#14451a" strokeWidth="1" />
      <path d="M46 31 Q60 36 74 31" fill="none" stroke="#e2e8f0" strokeWidth="1" />
      <rect x="52" y="32" width="7" height="8" rx="1" fill="#f8fafc" />
      <rect x="62" y="32" width="6" height="7" rx="1" fill="#bae6fd" />
    </svg>
  );
};

export const TowerRushGame: React.FC<TowerRushGameProps> = ({
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
  const [session, setSession] = useState<TowerRushSessionPublic | null>(null);
  const [busy, setBusy] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [impactPopup, setImpactPopup] = useState<{ id: number; text: string } | null>(null);
  const [dustFlash, setDustFlash] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const cranePivotRef = useRef<HTMLDivElement | null>(null);
  const trolleyRef = useRef<HTMLDivElement | null>(null);
  const offsetRef = useRef<number>(0);

  const isActive = session?.status === 'active';

  useEffect(() => {
    if (!token) return;
    fetch('/api/tower-rush/active', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.session) {
          setSession(d.session);
        }
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    let rafId = 0;
    const speed = isActive ? 0.0024 + Math.min(0.0022, (session?.floors || 0) * 0.00025) : 0.0016;
    const start = performance.now();

    const frame = (now: number) => {
      const t = (now - start) * speed;
      const swayX = Math.sin(t) * 38;
      const tiltDeg = Math.cos(t) * 3.8;
      offsetRef.current = swayX;
      if (trolleyRef.current) {
        trolleyRef.current.style.transform = `translate3d(${(swayX * 0.55).toFixed(1)}px, 0px, 0)`;
      }
      if (cranePivotRef.current) {
        cranePivotRef.current.style.transform = `translate3d(${swayX.toFixed(1)}px, 0px, 0) rotate(${tiltDeg.toFixed(2)}deg)`;
      }
      rafId = window.requestAnimationFrame(frame);
    };

    rafId = window.requestAnimationFrame(frame);
    return () => window.cancelAnimationFrame(rafId);
  }, [isActive, session?.floors]);

  const toggleSound = () => {
    const next = !muted;
    setMuted(next);
    setSoundMuted(next);
  };

  const clampStake = (val: number) =>
    Math.max(MIN_STAKE, Math.min(MAX_STAKE, Math.round(val)));

  const adjustStake = (delta: number) => {
    const cur = Number(stakeInput) || MIN_STAKE;
    setStakeInput(String(clampStake(cur + delta)));
  };

  const handleAllIn = () => {
    if (!user) {
      setStakeInput(String(MAX_STAKE));
      return;
    }
    const maxAffordable = Math.floor(user.balance);
    if (maxAffordable < MIN_STAKE) {
      setStakeInput(String(MIN_STAKE));
      setFeedback({ type: 'err', text: 'Minimum Tower Rush bet is ₹50.' });
      return;
    }
    setStakeInput(String(clampStake(maxAffordable)));
  };

  const handleDoubleStake = () => {
    const cur = Number(stakeInput) || MIN_STAKE;
    setStakeInput(String(clampStake(cur * 2)));
  };

  const triggerLandEffects = (mult: number) => {
    setDustFlash(true);
    setImpactPopup({ id: Date.now(), text: `+${mult.toFixed(2)}x` });
    window.setTimeout(() => setDustFlash(false), 380);
    window.setTimeout(() => setImpactPopup(null), 950);
  };

  const handleBuildAction = async () => {
    setFeedback(null);
    if (!user || !token) {
      onRequireAuth();
      return;
    }

    if (!isActive) {
      const amt = Number(stakeInput);
      if (!Number.isFinite(amt) || amt < MIN_STAKE || amt > MAX_STAKE) {
        setFeedback({ type: 'err', text: 'Tower Rush bet must be between ₹50 and ₹1,000.' });
        return;
      }
      if (user.balance < amt) {
        setFeedback({ type: 'err', text: 'Insufficient balance. Tap + Deposit first.' });
        return;
      }
      setBusy(true);
      setDropping(true);
      if (!muted) playBetConfirm();
      try {
        const res = await fetch('/api/tower-rush/start', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ amount: amt }),
        });
        const data = await res.json();
        if (!res.ok) {
          setFeedback({ type: 'err', text: data.error || 'Could not start Tower Rush.' });
          return;
        }
        setSession(data.session);
        onBalanceUpdate(data.balance);

        const dropRes = await fetch('/api/tower-rush/drop', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ offsetPx: Math.round(offsetRef.current * 0.4) }),
        });
        const dropData = await dropRes.json();
        if (dropRes.ok) {
          setSession(dropData.session);
          if (typeof dropData.balance === 'number') onBalanceUpdate(dropData.balance);
          if (dropData.collapsed) {
            if (!muted) playTowerCrash();
            if (dropData.bet) onBetPlaced(dropData.bet);
            setFeedback({
              type: 'err',
              text: `Tower collapsed on Floor ${dropData.session.collapsedFloor || 1}! Better luck next build.`,
            });
          } else {
            if (!muted) playTowerDrop(dropData.session.floors);
            triggerLandEffects(dropData.session.currentMultiplier);
            setFeedback({
              type: 'ok',
              text: `Floor ${dropData.session.floors} locked @ ${dropData.session.currentMultiplier.toFixed(2)}x! Cashout ₹${dropData.session.currentPayout.toFixed(2)} or BUILD higher.`,
            });
          }
        }
      } catch {
        setFeedback({ type: 'err', text: 'Network error starting Tower Rush.' });
      } finally {
        window.setTimeout(() => setDropping(false), 200);
        setBusy(false);
      }
      return;
    }

    if (busy) return;
    setBusy(true);
    setDropping(true);
    try {
      const res = await fetch('/api/tower-rush/drop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ offsetPx: Math.round(offsetRef.current * 0.4) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'err', text: data.error || 'Could not drop floor.' });
        return;
      }
      setSession(data.session);
      if (typeof data.balance === 'number') onBalanceUpdate(data.balance);

      if (data.collapsed) {
        if (!muted) playTowerCrash();
        if (data.bet) onBetPlaced(data.bet);
        setFeedback({
          type: 'err',
          text: `Tower toppled at Floor ${data.session.collapsedFloor || '?'}! Start a new stack below.`,
        });
      } else if (data.autoCashout) {
        if (!muted) playWinChime();
        if (data.bet) onBetPlaced(data.bet);
        triggerLandEffects(data.session.currentMultiplier);
        setFeedback({
          type: 'ok',
          text: `MAX TOWER COMPLETE! Won ₹${Number(data.payout).toFixed(2)} @ ${data.session.currentMultiplier.toFixed(2)}x!`,
        });
      } else {
        if (!muted) playTowerDrop(data.session.floors);
        triggerLandEffects(data.session.currentMultiplier);
        setFeedback({
          type: 'ok',
          text: `Floor ${data.session.floors} stacked (${data.session.currentMultiplier.toFixed(2)}x) — Cashout ₹${data.session.currentPayout.toFixed(2)} or keep building!`,
        });
      }
    } catch {
      setFeedback({ type: 'err', text: 'Network error stacking floor.' });
    } finally {
      window.setTimeout(() => setDropping(false), 200);
      setBusy(false);
    }
  };

  const handleCashout = async () => {
    if (!token || !session || session.status !== 'active' || session.floors < 1 || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/tower-rush/cashout', {
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
      if (!muted) playWinChime();
      setSession(data.session);
      onBalanceUpdate(data.balance);
      if (data.bet) onBetPlaced(data.bet);
      setFeedback({
        type: 'ok',
        text: `CASHED OUT @ ${Number(data.multiplier).toFixed(2)}x (${session.floors} Floors)! Won ₹${Number(data.payout).toFixed(2)}!`,
      });
    } catch {
      setFeedback({ type: 'err', text: 'Network error during cashout.' });
    } finally {
      setBusy(false);
    }
  };

  const builtFloors = session?.floors ?? 0;
  const visibleFloorCount = Math.min(builtFloors, 5);
  const cameraShiftPx = Math.max(0, builtFloors - 2) * 14;
  const towerBets = myBets.filter((b) => b.game === 'tower_rush').slice(0, 20);

  // Progressive sky backdrop based on tower height
  const skyGradient =
    builtFloors >= 9
      ? 'from-[#020617] via-[#0f172a] to-[#1e1b4b]'
      : builtFloors >= 6
      ? 'from-[#0f172a] via-[#311042] to-[#7c2d12]'
      : builtFloors >= 3
      ? 'from-[#312e81] via-[#c05621] to-[#f6ad55]'
      : 'from-[#2b7fb8] via-[#67b7cf] to-[#ead29c]';

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#08101d] text-white">
      <header className="shrink-0 sticky top-0 z-30 flex h-14 items-center justify-between bg-[#0a1426]/95 backdrop-blur-md border-b border-white/10 px-3 sm:px-6">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
            aria-label="Back to home"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="text-sm font-extrabold tracking-wide text-amber-300">TOWER RUSH</div>
            <div className="text-[10px] text-slate-400">Crane Stack · ₹50–₹1,000 · Up to 100x</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setShowHistory(true)}
            aria-label="Tower Rush History"
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

      {/* Main Full-Screen Galaxsys-Style Crane Arena */}
      <main className="flex-1 flex flex-col justify-center mx-auto w-full max-w-3xl px-3 sm:px-5 py-3 space-y-2.5">
        <section
          className={`relative flex-1 min-h-[355px] flex flex-col justify-between overflow-hidden rounded-2xl border-2 border-amber-400/45 bg-gradient-to-b ${skyGradient} transition-colors duration-700 shadow-2xl`}
        >
          {/* Twinkling Cosmos Stars at High Altitude */}
          {builtFloors >= 5 && (
            <div className="pointer-events-none absolute inset-0 opacity-75">
              <span className="absolute top-12 left-10 h-1 w-1 rounded-full bg-white animate-pulse" />
              <span className="absolute top-20 right-14 h-1.5 w-1.5 rounded-full bg-amber-200 animate-pulse" />
              <span className="absolute top-32 left-1/3 h-1 w-1 rounded-full bg-cyan-200 animate-pulse" />
              <span className="absolute top-16 left-2/3 h-1 w-1 rounded-full bg-white animate-pulse" />
            </div>
          )}

          {/* Top Altitude HUD */}
          <div className="relative z-30 flex items-center justify-between px-3 pt-2.5 text-xs">
            <div className="rounded-xl bg-slate-950/80 backdrop-blur-sm border border-white/15 px-3 py-1.5 font-bold text-white tabular-nums">
              Floor <span className="text-amber-300">{builtFloors}</span> / {session?.maxFloors ?? 12}
            </div>
            <div className="rounded-xl bg-slate-950/80 backdrop-blur-sm border border-amber-400/40 px-3.5 py-1.5 font-black text-amber-300 tabular-nums">
              {session?.status === 'lost'
                ? 'COLLAPSED'
                : `${(session?.currentMultiplier || 1).toFixed(2)}x`}{' '}
              {isActive && builtFloors > 0 ? `· ₹${session.currentPayout.toFixed(2)}` : ''}
            </div>
            <div className="rounded-xl bg-slate-950/80 backdrop-blur-sm border border-white/15 px-2.5 py-1.5 font-bold text-cyan-300 tabular-nums">
              Next: {(session?.nextMultiplier || 1.35).toFixed(2)}x
            </div>
          </div>

          {/* Articulated Steel Crane Girder & Sliding Yellow Trolley */}
          <div className="relative z-20 mx-auto w-full max-w-md pt-1.5 px-4">
            <div className="relative h-3 w-full rounded bg-gradient-to-b from-amber-300 to-amber-600 border border-slate-900 shadow-md overflow-hidden">
              <div
                className="h-full w-full opacity-50"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(60deg, transparent, transparent 8px, #1e293b 8px, #1e293b 12px)',
                }}
              />
            </div>
            <div
              ref={trolleyRef}
              className="mx-auto -mt-1 h-4 w-14 rounded-b-md bg-slate-900 border-2 border-amber-400 shadow-md gpu-layer flex items-center justify-center"
            >
              <span className="h-1.5 w-6 rounded-full bg-amber-400" />
            </div>
          </div>

          {/* Swinging Cable + Floor Block & Stacked Swaying Tower */}
          <div className="relative flex-1 min-h-[260px] w-full flex flex-col items-center justify-between overflow-hidden">
            <div
              ref={cranePivotRef}
              className={`gpu-layer relative z-20 flex flex-col items-center transition-transform duration-150 ${
                dropping ? 'translate-y-10 scale-95' : 'translate-y-0'
              }`}
              style={{ transformOrigin: '50% -20px' }}
            >
              <div className="h-6 w-1 bg-slate-900" />
              <div className="flex h-5 w-7 items-center justify-center rounded border-2 border-slate-900 bg-amber-400 hazard-stripes shadow-md" />
              <svg viewBox="0 0 110 20" className="h-4 w-24 -mt-0.5">
                <line x1="55" y1="0" x2="16" y2="19" stroke="#0f172a" strokeWidth="2.4" />
                <line x1="55" y1="0" x2="94" y2="19" stroke="#0f172a" strokeWidth="2.4" />
              </svg>
              <div className="-mt-1">
                <TownHouseFloorSvg
                  floorIndex={builtFloors}
                  collapsed={session?.status === 'lost'}
                />
              </div>
            </div>

            {/* Floating +X.XXx Multiplier Badge Popup */}
            {impactPopup && (
              <div
                key={impactPopup.id}
                className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 z-30 rounded-full bg-emerald-400 px-3.5 py-1 text-sm font-black text-slate-950 shadow-xl animate-float-badge gpu-layer"
              >
                {impactPopup.text}
              </div>
            )}

            {/* Skyline Silhouette */}
            <div className="pointer-events-none absolute bottom-3 left-0 right-0 flex items-end justify-between opacity-45 px-3">
              <div className="h-16 w-20 rounded-t bg-slate-800 border-t-2 border-slate-600" />
              <div className="h-24 w-16 rounded-t bg-slate-900" />
            </div>

            {/* Stacked Tower (gently sways as height grows) */}
            <div
              className={`gpu-layer relative z-10 flex flex-col items-center transition-transform duration-300 ease-out ${
                builtFloors >= 4 && session?.status !== 'lost' ? 'animate-tower-sway' : ''
              }`}
              style={{ transform: `translate3d(0, ${cameraShiftPx}px, 0)` }}
            >
              {dustFlash && (
                <div className="pointer-events-none -mb-2 h-4 w-36 rounded-full bg-amber-200/75 blur-sm animate-ping" />
              )}

              {Array.from({ length: visibleFloorCount }).map((_, idx) => {
                const floorIdx = visibleFloorCount - 1 - idx;
                return (
                  <div key={floorIdx} className="-mb-1.5">
                    <TownHouseFloorSvg
                      floorIndex={floorIdx}
                      collapsed={session?.status === 'lost'}
                    />
                  </div>
                );
              })}

              {/* Base Foundation */}
              <div className="relative flex items-end justify-center gap-3 pb-2">
                <div className="flex flex-col items-center">
                  <div className="h-3 w-3 rounded-full bg-amber-300 shadow-[0_0_16px_4px_rgba(251,191,36,0.9)]" />
                  <div className="h-12 w-1 bg-[#92400e]" />
                </div>

                <div className="relative w-32 sm:w-36 rounded-t-md border-2 border-[#144323] bg-[#216337] px-2 pt-1.5 pb-1 shadow-xl">
                  <div className="rounded bg-[#144224] py-0.5 text-center text-[9px] font-black tracking-wider text-amber-200 border border-amber-300/30">
                    AD78 TOWER BASE
                  </div>
                  <div className="mt-1 grid grid-cols-3 gap-1 h-6">
                    <div className="rounded-sm bg-amber-200/80 border border-amber-900/50" />
                    <div className="rounded-sm bg-amber-300/90 border border-amber-900/60" />
                    <div className="rounded-sm bg-amber-200/80 border border-amber-900/50" />
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-20 h-3 w-full bg-[#1e2433] border-t-2 border-amber-400/40" />
          </div>
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

      {/* Bottom Dock: Manual ₹50–₹1,000 Bet Controls */}
      <footer className="shrink-0 mx-auto w-full max-w-3xl px-3 sm:px-5 pb-4">
        <section className="rounded-2xl border border-amber-400/30 bg-[#131924] p-3.5 space-y-2.5 shadow-2xl">
          <div className="grid grid-cols-12 items-center gap-2">
            <button
              type="button"
              disabled={isActive}
              onClick={handleAllIn}
              className="col-span-3 rounded-xl bg-gradient-to-b from-sky-400 to-blue-700 py-3 text-xs sm:text-sm font-black text-white shadow-md hover:brightness-110 active:scale-[0.97] transition disabled:opacity-45"
            >
              ALL IN
            </button>

            <div className="col-span-6 flex items-center justify-between rounded-xl border border-white/15 bg-[#090d16] px-1.5 py-1">
              <button
                type="button"
                disabled={isActive}
                onClick={() => adjustStake(-50)}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40"
                aria-label="Decrease stake"
              >
                <Minus className="h-4 w-4" />
              </button>
              <input
                type="number"
                min={MIN_STAKE}
                max={MAX_STAKE}
                disabled={isActive}
                value={stakeInput}
                onChange={(e) => setStakeInput(e.target.value)}
                className="w-20 bg-transparent text-center text-base font-black text-white tabular-nums focus:outline-none disabled:opacity-60"
              />
              <button
                type="button"
                disabled={isActive}
                onClick={() => adjustStake(50)}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40"
                aria-label="Increase stake"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <button
              type="button"
              disabled={isActive}
              onClick={handleDoubleStake}
              className="col-span-3 rounded-xl bg-gradient-to-b from-sky-400 to-blue-700 py-3 text-xs sm:text-sm font-black text-white shadow-md hover:brightness-110 active:scale-[0.97] transition disabled:opacity-45"
            >
              x2
            </button>
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            {STAKE_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                disabled={isActive}
                onClick={() => setStakeInput(String(p))}
                className={`rounded-xl py-1.5 text-xs font-extrabold border transition tabular-nums disabled:opacity-45 ${
                  Number(stakeInput) === p
                    ? 'bg-amber-400 text-slate-950 border-amber-300'
                    : 'bg-[#08101f] text-slate-200 border-white/10 hover:border-amber-400'
                }`}
              >
                ₹{p}
              </button>
            ))}
          </div>

          <div className={isActive && builtFloors >= 1 ? 'grid grid-cols-2 gap-2.5' : ''}>
            <button
              type="button"
              disabled={busy}
              onClick={handleBuildAction}
              className="w-full rounded-2xl hazard-stripes p-1.5 shadow-xl hover:brightness-105 active:scale-[0.98] transition disabled:opacity-60"
            >
              <div className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 py-3.5 text-base font-black tracking-wide text-slate-950 shadow-inner">
                <Building2 className="h-5 w-5" />
                <span>
                  {busy
                    ? 'DROPPING...'
                    : isActive
                    ? `BUILD FLOOR ${builtFloors + 1} (${(session?.nextMultiplier || 1.35).toFixed(2)}x)`
                    : `BUILD · ₹${stakeInput || MIN_STAKE}`}
                </span>
              </div>
            </button>

            {isActive && builtFloors >= 1 && (
              <button
                type="button"
                disabled={busy}
                onClick={handleCashout}
                className="w-full rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 py-4 text-sm sm:text-base font-black text-slate-950 shadow-xl hover:brightness-110 active:scale-[0.98] transition"
              >
                CASHOUT ₹{(session?.currentPayout || 0).toFixed(2)}
              </button>
            )}
          </div>
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
              <h3 className="text-sm font-black text-white">Tower Rush History</h3>
              <button
                onClick={() => setShowHistory(false)}
                className="rounded-full bg-white/10 p-1.5 text-slate-300 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {towerBets.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No towers built yet. Minimum stake ₹50 · Max ₹1,000.
              </div>
            ) : (
              <div className="divide-y divide-white/5 text-xs">
                {towerBets.map((b) => (
                  <div key={b.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <div className="font-bold text-white uppercase">{b.selection}</div>
                      <div className="text-[11px] text-slate-400">
                        Stake ₹{b.amount} {b.resultText ? `· ${b.resultText}` : ''}
                      </div>
                    </div>
                    <div className="text-right font-bold tabular-nums">
                      {b.status === 'pending' && <span className="text-amber-300">Building</span>}
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
