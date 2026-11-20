import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminPanel } from './components/AdminPanel';
import { AuthScreenMode, AuthViews } from './components/AuthViews';
import { AviatorGame } from './components/AviatorGame';
import { ChickenRoadGame } from './components/ChickenRoadGame';
import { CrystalGame } from './components/CrystalGame';
import { DiceGame } from './components/DiceGame';
import { HomeDashboard } from './components/HomeDashboard';
import { MinesGame } from './components/MinesGame';
import { MinesProGame } from './components/MinesProGame';
import { ResultModal, ResultModalData } from './components/ResultModal';
import { SupportCenter } from './components/SupportCenter';
import { TowerRushGame } from './components/TowerRushGame';
import { MenuPage, WalletAndMenu } from './components/WalletAndMenu';
import { WingoGame } from './components/WingoGame';
import {
  AviatorState,
  BetRecord,
  MinesProState,
  PlatformConfig,
  TransactionRecord,
  UserProfile,
  WingoMode,
  WingoModeClock,
  WingoRound,
} from './types';
import { playLossTone, playWinChime } from './utils/sound';

type AppScreen =
  | { view: 'home' }
  | { view: 'auth'; mode: AuthScreenMode }
  | { view: 'wingo' }
  | { view: 'aviator' }
  | { view: 'mines_pro' }
  | { view: 'mines' }
  | { view: 'dice' }
  | { view: 'chicken_road' }
  | { view: 'crystal' }
  | { view: 'tower_rush' }
  | { view: 'support'; category?: string }
  | { view: 'menu'; page: MenuPage };

export default function App() {
  const isAdminRoute =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');

  if (isAdminRoute) {
    return <AdminPanel />;
  }

  return <UserApp />;
}

function UserApp() {
  const [showSplash, setShowSplash] = useState(true);
  const [screen, setScreen] = useState<AppScreen>({ view: 'home' });
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('ad78_token')
  );
  const [user, setUser] = useState<UserProfile | null>(null);
  const [clocks, setClocks] = useState<Record<WingoMode, WingoModeClock> | null>(null);
  const [aviator, setAviator] = useState<AviatorState | null>(null);
  const [minesPro, setMinesPro] = useState<MinesProState | null>(null);
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setShowSplash(false), 1500);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (platformConfig?.appName?.trim()) {
      document.title = `${platformConfig.appName.trim()} — Live Arena`;
    }
  }, [platformConfig?.appName]);

  useEffect(() => {
    const disabled = platformConfig?.disabledGames || [];
    if (disabled.includes(screen.view)) {
      setScreen({ view: 'home' });
    }
  }, [platformConfig?.disabledGames, screen.view]);

  const [bets, setBets] = useState<BetRecord[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [summary, setSummary] = useState({
    totalBets: 0,
    totalTurnover: 0,
    totalPayout: 0,
    netProfitLoss: 0,
  });

  const [resultModal, setResultModal] = useState<ResultModalData | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const tokenRef = useRef<string | null>(token);
  tokenRef.current = token;

  const fetchUserHistory = useCallback(async (authToken: string) => {
    try {
      const res = await fetch('/api/user/history', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const rawBets: BetRecord[] = Array.isArray(data.bets) ? data.bets : [];
      const seenBetIds = new Set<string>();
      const uniqueBets = rawBets.filter((b) => {
        if (!b?.id || seenBetIds.has(b.id)) return false;
        seenBetIds.add(b.id);
        return true;
      });
      setBets(uniqueBets);
      setTransactions(data.transactions || []);
      if (data.summary) setSummary(data.summary);
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    fetch('/api/wingo/state')
      .then((r) => r.json())
      .then((d) => {
        if (d?.clocks) setClocks(d.clocks);
        if (d?.platformConfig) setPlatformConfig(d.platformConfig);
      })
      .catch(() => {});

    fetch('/api/aviator/state')
      .then((r) => r.json())
      .then((d) => {
        if (d?.state) setAviator(d.state);
      })
      .catch(() => {});

    fetch('/api/mines-pro/state')
      .then((r) => r.json())
      .then((d) => {
        if (d?.state) setMinesPro(d.state);
      })
      .catch(() => {});

    if (token) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(async (r) => {
          if (!r.ok) {
            localStorage.removeItem('ad78_token');
            setToken(null);
            setUser(null);
            return;
          }
          const data = await r.json();
          setUser(data.user);
          fetchUserHistory(token);
        })
        .catch(() => {});
    }
  }, [token, fetchUserHistory]);

  useEffect(() => {
    let closed = false;
    let reconnectTimer: number | null = null;

    const connect = () => {
      if (closed) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${proto}//${window.location.host}/ws${
        tokenRef.current ? `?token=${encodeURIComponent(tokenRef.current)}` : ''
      }`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === 'wingo:init') {
            if (msg.clocks) setClocks(msg.clocks);
            if (msg.aviator) setAviator(msg.aviator);
            if (msg.minesPro) setMinesPro(msg.minesPro);
            if (msg.platformConfig) setPlatformConfig(msg.platformConfig);
          } else if (msg.type === 'platform:update' && msg.platformConfig) {
            setPlatformConfig(msg.platformConfig);
          } else if (msg.type === 'wingo:tick') {
            if (msg.clocks) {
              let periodChanged = false;
              setClocks((prev) => {
                if (!prev) return null;
                const next: Record<WingoMode, WingoModeClock> = { ...prev };
                (['30s', '1m', '3m'] as WingoMode[]).forEach((m) => {
                  if (msg.clocks[m] && prev[m]) {
                    if (prev[m].periodId !== msg.clocks[m].periodId) {
                      periodChanged = true;
                    }
                    next[m] = {
                      ...msg.clocks[m],
                      history: prev[m].history,
                    };
                  }
                });
                return next;
              });
              if (periodChanged) {
                window.setTimeout(() => {
                  fetch('/api/wingo/state')
                    .then((r) => r.json())
                    .then((d) => {
                      if (d?.clocks) setClocks(d.clocks);
                      if (d?.platformConfig) setPlatformConfig(d.platformConfig);
                    })
                    .catch(() => {});
                }, 450);
              }
            }
            if (msg.aviator) {
              setAviator(msg.aviator);
            }
            if (msg.minesPro) {
              setMinesPro(msg.minesPro);
            }
          } else if ((msg.type === 'aviator:state' || msg.type === 'aviator:tick') && msg.state) {
            setAviator(msg.state);
          } else if ((msg.type === 'mines_pro:state' || msg.type === 'mines_pro:tick') && msg.state) {
            setMinesPro(msg.state);
          } else if (msg.type === 'aviator:settlement') {
            if (typeof msg.balance === 'number') {
              setUser((u) => (u ? { ...u, balance: msg.balance } : u));
            }
            if (tokenRef.current) {
              fetchUserHistory(tokenRef.current);
            }
            playLossTone();
            setResultModal({
              title: 'LOSS',
              subtitle: `Aviator · Flew away @ ${Number(msg.crashPoint || 1).toFixed(2)}x`,
              won: false,
              staked: Number(msg.staked || 0),
              payout: 0,
              netProfit: -Number(msg.staked || 0),
              updatedBalance: Number(msg.balance ?? 0),
            });
          } else if (msg.type === 'mines_pro:settlement') {
            if (typeof msg.balance === 'number') {
              setUser((u) => (u ? { ...u, balance: msg.balance } : u));
            }
            if (tokenRef.current) {
              fetchUserHistory(tokenRef.current);
            }
            playLossTone();
            setResultModal({
              title: 'LOSS',
              subtitle: `Mines Pro · Blasted @ ${Number(msg.crashPoint || 1).toFixed(2)}x`,
              won: false,
              staked: Number(msg.staked || 0),
              payout: 0,
              netProfit: -Number(msg.staked || 0),
              updatedBalance: Number(msg.balance ?? 0),
            });
          } else if (msg.type === 'wingo:result' && msg.mode) {
            const m = msg.mode as WingoMode;
            const hist = msg.history as WingoRound[];
            setClocks((prev) => {
              if (!prev || !prev[m]) return prev;
              return {
                ...prev,
                [m]: {
                  ...prev[m],
                  history: hist,
                },
              };
            });
          } else if (msg.type === 'wingo:settlement') {
            if (typeof msg.balance === 'number') {
              setUser((u) => (u ? { ...u, balance: msg.balance } : u));
            }
            if (tokenRef.current) {
              fetchUserHistory(tokenRef.current);
            }
            if (msg.userOutcome) {
              const out = msg.userOutcome;
              if (out.won) playWinChime();
              else playLossTone();

              setResultModal({
                title: out.won ? 'WIN' : 'LOSS',
                subtitle: `WinGo ${String(msg.mode).toUpperCase()} · Period ${msg.periodId}`,
                won: out.won,
                staked: out.totalStaked,
                payout: out.totalPayout,
                netProfit: out.netProfit,
                updatedBalance: msg.balance ?? 0,
                wingoRound: msg.round,
              });
            }
          } else if (msg.type === 'wallet:update' && typeof msg.balance === 'number') {
            setUser((u) => (u ? { ...u, balance: msg.balance } : u));
            if (tokenRef.current) {
              fetchUserHistory(tokenRef.current);
            }
          }
        } catch {
          // Ignore malformed ws message
        }
      };

      ws.onclose = () => {
        if (!closed) {
          reconnectTimer = window.setTimeout(connect, 1500);
        }
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [fetchUserHistory]);

  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && token) {
      wsRef.current.send(JSON.stringify({ type: 'auth', token }));
    }
  }, [token]);

  const handleAuthSuccess = (newToken: string, newUser: UserProfile) => {
    localStorage.setItem('ad78_token', newToken);
    setToken(newToken);
    setUser(newUser);
    fetchUserHistory(newToken);
    setScreen({ view: 'home' });
  };

  const handleLogout = () => {
    localStorage.removeItem('ad78_token');
    setToken(null);
    setUser(null);
    setBets([]);
    setTransactions([]);
    setScreen({ view: 'home' });
  };

  const handleBalanceUpdate = (newBalance: number) => {
    setUser((prev) => (prev ? { ...prev, balance: newBalance } : prev));
  };

  const handleBetPlaced = (bet: BetRecord) => {
    setBets((prev) => {
      const idx = prev.findIndex((b) => b.id === bet.id);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = bet;
        return next;
      }
      return [bet, ...prev];
    });
    if (token) {
      fetchUserHistory(token);
    }
  };

  const handleCloseResultModal = useCallback(() => {
    setResultModal(null);
  }, []);

  if (showSplash) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_35%,#172554_0%,#091224_52%,#040812_100%)] px-6">
        {/* Ambient Dual Halo Glow */}
        <div className="pointer-events-none absolute h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl animate-pulse" />
        <div className="pointer-events-none absolute h-64 w-64 translate-y-12 rounded-full bg-amber-500/10 blur-3xl" />

        <div className="relative flex items-center justify-center">
          {/* Outer Rotating Orbital Ring */}
          <div className="absolute h-44 w-44 rounded-full border border-cyan-400/30 border-t-cyan-300 border-r-amber-300/60 animate-orbit-slow gpu-layer" />
          {/* Inner Counter-Rotating Ring */}
          <div className="absolute h-36 w-36 rounded-full border border-amber-400/25 border-b-amber-300 border-l-cyan-400/60 animate-orbit-reverse gpu-layer" />

          {/* Main AD78 Emblem Card */}
          <div className="relative flex flex-col items-center justify-center h-28 w-44 rounded-3xl bg-gradient-to-b from-[#132344]/95 to-[#091226]/95 border border-cyan-400/45 shadow-[0_0_60px_rgba(34,211,238,0.28),inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-md">
            <div className="flex items-baseline gap-0.5 select-none">
              <span className="text-4xl sm:text-5xl font-black tracking-tight bg-gradient-to-b from-white via-cyan-100 to-cyan-400 bg-clip-text text-transparent drop-shadow-[0_2px_12px_rgba(34,211,238,0.45)]">
                AD
              </span>
              <span className="text-4xl sm:text-5xl font-black tracking-tight bg-gradient-to-b from-amber-200 via-amber-300 to-orange-500 bg-clip-text text-transparent drop-shadow-[0_2px_12px_rgba(251,191,36,0.45)]">
                78
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="h-1 w-4 rounded-full bg-cyan-400/80" />
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
              <span className="h-1 w-4 rounded-full bg-amber-400/80" />
            </div>
          </div>
        </div>

        <div className="mt-8 h-1.5 w-48 overflow-hidden rounded-full bg-white/10 border border-white/10">
          <div className="h-full w-full rounded-full bg-gradient-to-r from-cyan-400 via-teal-300 to-amber-300 animate-splash-bar gpu-layer" />
        </div>
      </div>
    );
  }

  return (
    <>
      {screen.view === 'home' && (
        <HomeDashboard
          user={user}
          aviator={aviator}
          minesPro={minesPro}
          platformConfig={platformConfig}
          onOpenAuth={(mode) => setScreen({ view: 'auth', mode })}
          onOpenWingo={() => setScreen({ view: 'wingo' })}
          onOpenAviator={() => setScreen({ view: 'aviator' })}
          onOpenMinesPro={() => setScreen({ view: 'mines_pro' })}
          onOpenMines={() => setScreen({ view: 'mines' })}
          onOpenDice={() => setScreen({ view: 'dice' })}
          onOpenChickenRoad={() => setScreen({ view: 'chicken_road' })}
          onOpenCrystal={() => setScreen({ view: 'crystal' })}
          onOpenTowerRush={() => setScreen({ view: 'tower_rush' })}
          onOpenMenu={(page) => setScreen({ view: 'menu', page })}
          onOpenSupport={() => setScreen({ view: 'support' })}
        />
      )}

      {screen.view === 'auth' && (
        <AuthViews
          initialMode={screen.mode}
          onBack={() => setScreen({ view: 'home' })}
          onOpenSupport={(category) => setScreen({ view: 'support', category })}
          onSuccess={handleAuthSuccess}
        />
      )}

      {screen.view === 'wingo' && (
        <WingoGame
          user={user}
          token={token}
          clocks={clocks}
          myBets={bets}
          onBack={() => setScreen({ view: 'home' })}
          onRequireAuth={() => setScreen({ view: 'auth', mode: 'login' })}
          onOpenDeposit={() => setScreen({ view: 'menu', page: 'deposit' })}
          onOpenSupport={() => setScreen({ view: 'support', category: 'WinGo / Aviator Game Issue' })}
          onBalanceUpdate={handleBalanceUpdate}
          onBetPlaced={handleBetPlaced}
        />
      )}

      {screen.view === 'aviator' && (
        <AviatorGame
          user={user}
          token={token}
          aviator={aviator}
          myBets={bets}
          onBack={() => setScreen({ view: 'home' })}
          onRequireAuth={() => setScreen({ view: 'auth', mode: 'login' })}
          onOpenDeposit={() => setScreen({ view: 'menu', page: 'deposit' })}
          onOpenSupport={() => setScreen({ view: 'support', category: 'WinGo / Aviator Game Issue' })}
          onBalanceUpdate={handleBalanceUpdate}
          onBetPlaced={handleBetPlaced}
          onCashoutSuccess={({ multiplier, payout, staked, balance, roundId }) => {
            if (token) fetchUserHistory(token);
            setResultModal({
              title: 'WIN',
              subtitle: `Aviator · Cashed Out @ ${multiplier.toFixed(2)}x (${roundId})`,
              won: true,
              staked,
              payout,
              netProfit: Number((payout - staked).toFixed(2)),
              updatedBalance: balance,
            });
          }}
        />
      )}

      {screen.view === 'mines_pro' && (
        <MinesProGame
          user={user}
          token={token}
          minesPro={minesPro}
          myBets={bets}
          onBack={() => setScreen({ view: 'home' })}
          onRequireAuth={() => setScreen({ view: 'auth', mode: 'login' })}
          onOpenDeposit={() => setScreen({ view: 'menu', page: 'deposit' })}
          onOpenSupport={() => setScreen({ view: 'support', category: 'Mines Pro Issue' })}
          onBalanceUpdate={handleBalanceUpdate}
          onBetPlaced={handleBetPlaced}
          onCashoutSuccess={({ multiplier, payout, staked, balance, roundId }) => {
            if (token) fetchUserHistory(token);
            setResultModal({
              title: 'WIN',
              subtitle: `Mines Pro · Cashed Out @ ${multiplier.toFixed(2)}x (${roundId})`,
              won: true,
              staked,
              payout,
              netProfit: Number((payout - staked).toFixed(2)),
              updatedBalance: balance,
            });
          }}
        />
      )}

      {screen.view === 'mines' && (
        <MinesGame
          user={user}
          token={token}
          myBets={bets}
          onBack={() => setScreen({ view: 'home' })}
          onRequireAuth={() => setScreen({ view: 'auth', mode: 'login' })}
          onOpenDeposit={() => setScreen({ view: 'menu', page: 'deposit' })}
          onOpenSupport={() => setScreen({ view: 'support', category: 'Mines / Dice Game Issue' })}
          onBalanceUpdate={handleBalanceUpdate}
          onBetPlaced={handleBetPlaced}
        />
      )}

      {screen.view === 'dice' && (
        <DiceGame
          user={user}
          token={token}
          myBets={bets}
          onBack={() => setScreen({ view: 'home' })}
          onRequireAuth={() => setScreen({ view: 'auth', mode: 'login' })}
          onOpenDeposit={() => setScreen({ view: 'menu', page: 'deposit' })}
          onOpenSupport={() => setScreen({ view: 'support', category: 'Mines / Dice Game Issue' })}
          onBalanceUpdate={handleBalanceUpdate}
          onBetPlaced={handleBetPlaced}
        />
      )}

      {screen.view === 'chicken_road' && (
        <ChickenRoadGame
          user={user}
          token={token}
          myBets={bets}
          onBack={() => setScreen({ view: 'home' })}
          onRequireAuth={() => setScreen({ view: 'auth', mode: 'login' })}
          onOpenDeposit={() => setScreen({ view: 'menu', page: 'deposit' })}
          onOpenSupport={() => setScreen({ view: 'support', category: 'Chicken Road Game Issue' })}
          onBalanceUpdate={handleBalanceUpdate}
          onBetPlaced={handleBetPlaced}
        />
      )}

      {screen.view === 'crystal' && (
        <CrystalGame
          user={user}
          token={token}
          myBets={bets}
          onBack={() => setScreen({ view: 'home' })}
          onRequireAuth={() => setScreen({ view: 'auth', mode: 'login' })}
          onOpenDeposit={() => setScreen({ view: 'menu', page: 'deposit' })}
          onOpenSupport={() => setScreen({ view: 'support', category: 'Crystal Game Issue' })}
          onBalanceUpdate={handleBalanceUpdate}
          onBetPlaced={handleBetPlaced}
        />
      )}

      {screen.view === 'tower_rush' && (
        <TowerRushGame
          user={user}
          token={token}
          myBets={bets}
          onBack={() => setScreen({ view: 'home' })}
          onRequireAuth={() => setScreen({ view: 'auth', mode: 'login' })}
          onOpenDeposit={() => setScreen({ view: 'menu', page: 'deposit' })}
          onOpenSupport={() => setScreen({ view: 'support', category: 'Tower Rush Game Issue' })}
          onBalanceUpdate={handleBalanceUpdate}
          onBetPlaced={handleBetPlaced}
        />
      )}

      {screen.view === 'support' && (
        <SupportCenter
          user={user}
          token={token}
          initialCategory={screen.category}
          onBack={() => setScreen({ view: 'home' })}
        />
      )}

      {screen.view === 'menu' && (
        <WalletAndMenu
          page={screen.page}
          user={user}
          token={token}
          bets={bets}
          transactions={transactions}
          summary={summary}
          platformConfig={platformConfig}
          onNavigate={(page) => setScreen({ view: 'menu', page })}
          onBackHome={() => setScreen({ view: 'home' })}
          onRequireAuth={() => setScreen({ view: 'auth', mode: 'login' })}
          onOpenSupport={() => setScreen({ view: 'support' })}
          onBalanceUpdate={handleBalanceUpdate}
          onUserUpdate={setUser}
          onRefreshHistory={() => token && fetchUserHistory(token)}
          onLogout={handleLogout}
        />
      )}

      <ResultModal data={resultModal} onClose={handleCloseResultModal} />
    </>
  );
}
