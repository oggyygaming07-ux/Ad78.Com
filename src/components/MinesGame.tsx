import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bomb,
  Headphones,
  Minus,
  Plus,
  Star,
  Volume2,
  VolumeX,
  Wallet,
} from 'lucide-react';
import { BetRecord, MinesSessionPublic, UserProfile } from '../types';
import {
  playBetConfirm,
  playMinesBoom,
  playMinesGem,
  playWinChime,
  setSoundMuted,
} from '../utils/sound';

interface MinesGameProps {
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

const MINE_PRESETS = [1, 3, 5, 10, 16, 20];

function previewMinesMultiplier(minesCount: number, safePicks: number): number {
  if (safePicks <= 0) return 1.0;
  let mult = 0.97;
  for (let i = 0; i < safePicks; i++) {
    mult *= (25 - i) / (25 - minesCount - i);
  }
  return Math.max(1.01, Number(mult.toFixed(2)));
}

const RealisticMineSvg: React.FC<{ exploded?: boolean }> = ({ exploded }) => (
  <svg viewBox="0 0 48 48" className="h-8 w-8 sm:h-9 sm:w-9 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
    <defs>
      <radialGradient id={exploded ? 'mineBlastGrad' : 'mineBodyGrad'} cx="35%" cy="30%" r="70%">
        <stop offset="0%" stopColor={exploded ? '#fed7aa' : '#64748b'} />
        <stop offset="55%" stopColor={exploded ? '#ef4444' : '#1e293b'} />
        <stop offset="100%" stopColor={exploded ? '#7f1d1d' : '#020617'} />
      </radialGradient>
    </defs>
    {/* Spikes */}
    <g stroke={exploded ? '#fca5a5' : '#94a3b8'} strokeWidth="2.8" strokeLinecap="round">
      <line x1="24" y1="5" x2="24" y2="12" />
      <line x1="24" y1="36" x2="24" y2="43" />
      <line x1="5" y1="24" x2="12" y2="24" />
      <line x1="36" y1="24" x2="43" y2="24" />
      <line x1="10.5" y1="10.5" x2="15.5" y2="15.5" />
      <line x1="32.5" y1="32.5" x2="37.5" y2="37.5" />
      <line x1="37.5" y1="10.5" x2="32.5" y2="15.5" />
      <line x1="15.5" y1="32.5" x2="10.5" y2="37.5" />
    </g>
    <circle cx="24" cy="24" r="12.5" fill={`url(#${exploded ? 'mineBlastGrad' : 'mineBodyGrad'})`} stroke="#334155" strokeWidth="1.2" />
    <circle cx="24" cy="24" r="4" fill={exploded ? '#fef08a' : '#ef4444'} />
  </svg>
);

const GoldenStarSvg: React.FC<{ dim?: boolean }> = ({ dim }) => (
  <svg viewBox="0 0 48 48" className={`h-8 w-8 sm:h-9 sm:w-9 ${dim ? 'opacity-40' : 'drop-shadow-[0_0_10px_rgba(251,191,36,0.7)]'}`}>
    <defs>
      <linearGradient id="goldStarGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="50%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#b45309" />
      </linearGradient>
    </defs>
    <polygon
      points="24,5 29.5,16.8 42.5,18.4 33,27.4 35.4,40.3 24,34 12.6,40.3 15,27.4 5.5,18.4 18.5,16.8"
      fill="url(#goldStarGrad)"
      stroke="#fde68a"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

export const MinesGame: React.FC<MinesGameProps> = ({
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
  const [minesCount, setMinesCount] = useState(3);
  const [session, setSession] = useState<MinesSessionPublic | null>(null);
  const [hitBombTile, setHitBombTile] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const presets = user?.stakePresets?.length ? user.stakePresets : [10, 50, 100, 500];
  const isRoundActive = session?.status === 'active';

  useEffect(() => {
    if (!token) return;
    fetch('/api/mines/active', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.session) {
          setSession(d.session);
          setMinesCount(d.session.minesCount);
          setStakeInput(String(d.session.stake));
        }
      })
      .catch(() => {});
  }, [token]);

  const myMinesBets = useMemo(
    () => myBets.filter((b) => b.game === 'mines').slice(0, 20),
    [myBets]
  );

  const toggleSound = () => {
    const next = !muted;
    setMuted(next);
    setSoundMuted(next);
  };

  const handleStartRound = async () => {
    if (!user || !token) {
      onRequireAuth();
      return;
    }
    const amt = Number(stakeInput);
    if (!Number.isFinite(amt) || amt < 10 || amt > 50000) {
      setFeedback({ type: 'err', text: 'Enter a stake between ₹10 and ₹50,000.' });
      return;
    }
    if (user.balance < amt) {
      setFeedback({ type: 'err', text: 'Insufficient balance. Please deposit first.' });
      return;
    }

    setBusy(true);
    setFeedback(null);
    setHitBombTile(null);
    try {
      const res = await fetch('/api/mines/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: amt, minesCount }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.session) setSession(data.session);
        throw new Error(data.error || 'Could not start Mines round.');
      }
      playBetConfirm();
      setSession(data.session);
      onBalanceUpdate(data.balance);
      setFeedback({
        type: 'ok',
        text: `Vault Unlocked! Open golden stars while avoiding ${minesCount} armed mines.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to start Mines round.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handlePickTile = async (tileIndex: number) => {
    if (!user || !token) {
      onRequireAuth();
      return;
    }
    if (!isRoundActive || busy) return;
    if (session?.revealed.includes(tileIndex)) return;

    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/mines/pick', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tileIndex }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Tile pick failed.');

      setSession(data.session);
      if (typeof data.balance === 'number') {
        onBalanceUpdate(data.balance);
      }

      if (data.hitBomb) {
        setHitBombTile(tileIndex);
        playMinesBoom();
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([120, 40, 180]);
        }
        if (data.bet) onBetPlaced(data.bet);
        setFeedback({
          type: 'err',
          text: `BOOM! Mine exploded on Vault #${tileIndex + 1}!`,
        });
      } else if (data.autoCashout) {
        playWinChime();
        if (data.bet) onBetPlaced(data.bet);
        setFeedback({
          type: 'ok',
          text: `ALL STARS CLEARED! Won ₹${Number(data.payout).toFixed(2)} (${data.session.multiplier.toFixed(2)}x)!`,
        });
      } else {
        playMinesGem(data.session?.revealed?.length || 1);
      }
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Error picking tile.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCashout = async () => {
    if (!user || !token || !isRoundActive || busy) return;
    if ((session?.revealed.length || 0) < 1) {
      setFeedback({ type: 'err', text: 'Open at least 1 safe star before cashing out.' });
      return;
    }

    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/mines/cashout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cashout failed.');

      playWinChime();
      setSession(data.session);
      onBalanceUpdate(data.balance);
      if (data.bet) onBetPlaced(data.bet);
      setFeedback({
        type: 'ok',
        text: `Cashed out ₹${Number(data.payout).toFixed(2)} @ ${Number(data.multiplier).toFixed(2)}x!`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Cashout failed.',
      });
    } finally {
      setBusy(false);
    }
  };

  const nextMultDisplay = isRoundActive
    ? session.nextMultiplier
    : previewMinesMultiplier(minesCount, 1);

  return (
    <div className="min-h-screen bg-[#070d1a] text-white pb-12">
      {/* Header */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-[#0a1426]/95 backdrop-blur-md border-b border-white/10 px-3 sm:px-6">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            aria-label="Back to Home"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="text-sm font-extrabold tracking-wide text-white flex items-center gap-1.5">
              <Bomb className="h-4 w-4 text-amber-400" /> AD78 MINES
            </div>
            <div className="text-[10px] text-amber-300 font-semibold">
              5×5 Armored Vault · Stars &amp; Mines
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={toggleSound}
            aria-label="Toggle sound"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-slate-200 hover:bg-white/20"
          >
            {muted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4 text-emerald-400" />}
          </button>
          <button
            onClick={onOpenSupport}
            aria-label="Support"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-cyan-300 hover:bg-white/20"
          >
            <Headphones className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5 rounded-full bg-[#10243d] border border-white/15 px-3 py-1.5 text-xs font-bold tabular-nums">
            <Wallet className="h-3.5 w-3.5 text-cyan-300" />
            <span>₹{(user?.balance ?? 0).toFixed(2)}</span>
          </div>
          <button
            onClick={user ? onOpenDeposit : onRequireAuth}
            className="rounded-full bg-cyan-400 px-3 py-1.5 text-xs font-bold text-slate-950 hover:brightness-110"
          >
            + Deposit
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-3 sm:px-5 pt-4 space-y-4">
        {/* Live Multiplier Status Strip */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-[#0e192d] border border-white/10 p-3 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Current Mult
            </div>
            <div className="mt-0.5 text-lg font-extrabold text-amber-300 tabular-nums">
              {(session?.multiplier ?? 1).toFixed(2)}x
            </div>
          </div>
          <div className="rounded-xl bg-[#0e192d] border border-white/10 p-3 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Next Star
            </div>
            <div className="mt-0.5 text-lg font-extrabold text-emerald-300 tabular-nums">
              {nextMultDisplay.toFixed(2)}x
            </div>
          </div>
          <div className="rounded-xl bg-[#0e192d] border border-white/10 p-3 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Stars / Safe
            </div>
            <div className="mt-0.5 text-lg font-extrabold text-white tabular-nums">
              {session ? `${session.revealed.length}/${25 - session.minesCount}` : `0/${25 - minesCount}`}
            </div>
          </div>
        </div>

        {/* Realistic 5x5 Armored Vault Tile Grid */}
        <div className="rounded-3xl bg-gradient-to-b from-[#111e36] to-[#091224] border border-amber-400/25 p-3.5 sm:p-4 shadow-2xl">
          <div className="grid grid-cols-5 gap-2 sm:gap-2.5">
            {Array.from({ length: 25 }, (_, idx) => {
              const isRevealed = session?.revealed.includes(idx) ?? false;
              const isMine = session?.mines?.includes(idx) ?? false;
              const isFinished = session && session.status !== 'active';
              const isHitMine = hitBombTile === idx;

              let tileClass =
                'bg-gradient-to-b from-[#233554] to-[#132038] border-slate-500/40 shadow-[inset_0_2px_0_rgba(255,255,255,0.14),0_4px_10px_rgba(0,0,0,0.45)] hover:from-[#2b4269] hover:border-amber-400/60 active:translate-y-0.5';
              if (isRevealed) {
                tileClass =
                  'bg-gradient-to-b from-amber-500/25 to-emerald-950/60 border-amber-300/80 shadow-[0_0_18px_rgba(251,191,36,0.35)]';
              } else if (isHitMine) {
                tileClass =
                  'bg-gradient-to-b from-rose-600/85 to-red-950 border-rose-300 shadow-[0_0_28px_rgba(244,63,94,0.85)] scale-[1.03]';
              } else if (isFinished && isMine) {
                tileClass =
                  'bg-gradient-to-b from-rose-950/80 to-slate-950 border-rose-500/60 shadow-[0_0_10px_rgba(244,63,94,0.25)]';
              } else if (isFinished) {
                tileClass = 'bg-[#0e172a] border-white/5 opacity-60';
              }

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={!isRoundActive || isRevealed || busy}
                  onClick={() => handlePickTile(idx)}
                  aria-label={`Mine tile ${idx + 1}`}
                  className={`relative aspect-square rounded-2xl border-2 flex items-center justify-center transition duration-150 overflow-hidden ${tileClass}`}
                >
                  {isHitMine && (
                    <span className="pointer-events-none absolute inset-1 rounded-full bg-orange-400/45 animate-ping" />
                  )}
                  {isRevealed ? (
                    <GoldenStarSvg />
                  ) : isFinished && isMine ? (
                    <RealisticMineSvg exploded={isHitMine} />
                  ) : isFinished ? (
                    <GoldenStarSvg dim />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-0.5">
                      <div className="h-3.5 w-3.5 rounded-full bg-[#0b1322] border border-cyan-300/25 shadow-inner flex items-center justify-center">
                        <div className="h-1.5 w-1.5 rounded-full bg-cyan-400/40" />
                      </div>
                      <span className="text-[8px] font-bold text-slate-400/70 tabular-nums">
                        {idx + 1}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Feedback Banner */}
        {feedback && (
          <div
            className={`rounded-xl border px-4 py-2.5 text-xs font-semibold ${
              feedback.type === 'ok'
                ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                : 'bg-rose-500/15 border-rose-400/40 text-rose-200'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {/* Controls Panel */}
        <div className="rounded-2xl bg-[#0e192d] border border-white/10 p-4 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">
                Armed Mines Count (1 – 24)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isRoundActive || minesCount <= 1}
                  onClick={() => setMinesCount((c) => Math.max(1, c - 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#162540] text-white disabled:opacity-40"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="min-w-[2.2rem] text-center text-sm font-extrabold text-amber-300 tabular-nums">
                  {minesCount}
                </span>
                <button
                  type="button"
                  disabled={isRoundActive || minesCount >= 24}
                  onClick={() => setMinesCount((c) => Math.min(24, c + 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#162540] text-white disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {MINE_PRESETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={isRoundActive}
                  onClick={() => setMinesCount(m)}
                  className={`rounded-lg py-1.5 text-xs font-bold transition disabled:opacity-45 ${
                    minesCount === m
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-[#162540] text-slate-300 hover:bg-[#1f3459]'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">Bet Amount (₹)</span>
              <span className="text-slate-400">Min ₹10 · Max ₹50,000</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                disabled={isRoundActive}
                value={stakeInput}
                onChange={(e) => setStakeInput(e.target.value)}
                min={10}
                max={50000}
                className="flex-1 rounded-xl bg-[#08101d] border border-white/15 px-3.5 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-cyan-400 disabled:opacity-50"
              />
              <button
                type="button"
                disabled={isRoundActive}
                onClick={() =>
                  setStakeInput((s) => String(Math.max(10, Math.floor((Number(s) || 20) / 2))))
                }
                className="rounded-xl bg-[#162540] px-3 py-2.5 text-xs font-bold text-slate-200 disabled:opacity-45"
              >
                1/2
              </button>
              <button
                type="button"
                disabled={isRoundActive}
                onClick={() =>
                  setStakeInput((s) => String(Math.min(50000, (Number(s) || 50) * 2)))
                }
                className="rounded-xl bg-[#162540] px-3 py-2.5 text-xs font-bold text-slate-200 disabled:opacity-45"
              >
                2x
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={isRoundActive}
                  onClick={() => setStakeInput(String(p))}
                  className="rounded-lg bg-[#162540] py-1.5 text-xs font-semibold text-cyan-200 hover:bg-[#1f3459] disabled:opacity-45"
                >
                  ₹{p}
                </button>
              ))}
            </div>
          </div>

          {!isRoundActive ? (
            <button
              type="button"
              disabled={busy}
              onClick={handleStartRound}
              className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-emerald-400 py-3.5 text-sm font-extrabold text-slate-950 shadow-lg hover:brightness-110 active:scale-[0.99] transition disabled:opacity-60"
            >
              {busy ? 'UNLOCKING VAULT...' : `START MINES BET · ₹${Number(stakeInput || 0).toFixed(0)}`}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy || session.revealed.length < 1}
              onClick={handleCashout}
              className={`w-full rounded-xl py-3.5 text-sm font-extrabold shadow-lg transition ${
                session.revealed.length >= 1
                  ? 'bg-gradient-to-r from-amber-400 to-emerald-400 text-slate-950 hover:brightness-110'
                  : 'bg-[#162540] text-slate-400 border border-white/10 cursor-not-allowed'
              }`}
            >
              {session.revealed.length >= 1
                ? `CASHOUT ₹${session.currentPayout.toFixed(2)} (${session.multiplier.toFixed(2)}x)`
                : 'TAP ANY VAULT TILE ABOVE TO REVEAL STARS'}
            </button>
          )}
        </div>

        {/* Recent Mines History */}
        <section className="rounded-2xl bg-[#0e192d] border border-white/10 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Star className="h-4 w-4 text-amber-400 fill-amber-400" /> My Mines History
            </h3>
            <span className="text-[11px] text-slate-400">Recent {myMinesBets.length} rounds</span>
          </div>

          {myMinesBets.length === 0 ? (
            <div className="py-5 text-center text-xs text-slate-400">
              No Mines bets yet. Place your first bet above!
            </div>
          ) : (
            <div className="space-y-2">
              {myMinesBets.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between rounded-xl bg-[#08101d] border border-white/5 px-3 py-2.5 text-xs"
                >
                  <div>
                    <div className="font-bold text-white">
                      {b.selection} · ₹{b.amount}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {b.resultText || (b.status === 'pending' ? 'Active round' : b.periodId)}
                    </div>
                  </div>
                  <div className="text-right tabular-nums">
                    <div
                      className={`font-extrabold ${
                        b.status === 'won'
                          ? 'text-emerald-400'
                          : b.status === 'lost'
                          ? 'text-rose-400'
                          : 'text-amber-300'
                      }`}
                    >
                      {b.status === 'won'
                        ? `+₹${b.payout.toFixed(2)}`
                        : b.status === 'lost'
                        ? `-₹${b.amount.toFixed(2)}`
                        : 'IN PLAY'}
                    </div>
                    {b.multiplier > 0 && b.status === 'won' && (
                      <div className="text-[10px] text-emerald-300">{b.multiplier.toFixed(2)}x</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
