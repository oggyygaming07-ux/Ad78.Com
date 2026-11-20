import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpFromLine,
  Bomb,
  Building2,
  CheckCircle2,
  Copy,
  Dices,
  Gem,
  Headphones,
  ImagePlus,
  Link2,
  Lock,
  Plane,
  QrCode,
  RefreshCw,
  Settings,
  Shield,
  Sliders,
  Sparkles,
  Trash2,
  Unlock,
  Users,
  Wallet,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import {
  AdminBankSlot,
  AdminUpiSlot,
  AviatorState,
  BetRecord,
  GameOutcomeMode,
  MinesProState,
  PlatformConfig,
  SupportTicket,
  TransactionRecord,
  UserProfile,
  WingoMode,
  WingoModeClock,
} from '../types';
import { compressImageFile } from '../utils/imageCompress';

interface AdminOverview {
  clocks: Record<WingoMode, WingoModeClock>;
  nextPeriodIds?: Record<WingoMode, string>;
  livePools: Record<
    WingoMode,
    {
      periodId: string;
      totalAmount: number;
      bySelection: Record<string, number>;
      bets?: BetRecord[];
      lowestPayoutNumber?: number;
    }
  >;
  overrides: Record<WingoMode, number | null>;
  nextOverrides?: Record<WingoMode, number | null>;
  patterns: Record<WingoMode, number[]>;
  aviator: AviatorState;
  aviatorLiveBets?: BetRecord[];
  aviatorOverride: number | null;
  aviatorNextOverride?: number | null;
  aviatorCurrentTarget?: number | null;
  aviatorIsManualTarget?: boolean;
  aviatorManualHold?: boolean;
  minesPro?: MinesProState;
  minesProLiveBets?: BetRecord[];
  minesProOverride?: number | null;
  minesProNextOverride?: number | null;
  minesProCurrentTarget?: number | null;
  minesProIsManualTarget?: boolean;
  minesForceNextBomb?: boolean;
  activeMinesCount?: number;
  diceNextOverride?: number | null;
  diceForceLoss?: boolean;
  chickenForceNextTrap?: boolean;
  activeChickenCount?: number;
  crystalMode?: 'fair' | 'force_loss' | 'force_win';
  towerForceCollapse?: boolean;
  activeTowerCount?: number;
  platformConfig?: PlatformConfig;
  users: UserProfile[];
  pendingTransactions: TransactionRecord[];
  allTransactions: TransactionRecord[];
  recentBets: BetRecord[];
  supportTickets: SupportTicket[];
  stats: {
    totalUsers: number;
    activeConnections: number;
    activePlayersNow: number;
    totalDepositCount: number;
    totalDeposits: number;
    totalWithdrawals: number;
    totalBetsCount: number;
  };
}

const DEFAULT_UPI_SLOTS: AdminUpiSlot[] = [
  { id: 'upi-1', label: 'UPI 1 (Primary)', upiId: 'ad78.pay@upi', enabled: true },
  { id: 'upi-2', label: 'UPI 2 (Backup)', upiId: '', enabled: false },
];

const DEFAULT_BANK_SLOTS: AdminBankSlot[] = [
  {
    id: 'bank-1',
    label: 'Bank Account 1',
    bankHolder: 'AD78 PAYMENTS ENTERPRISE',
    bankName: 'HDFC BANK',
    bankAccountNumber: '50200078451290',
    bankIfsc: 'HDFC0001780',
    enabled: true,
  },
  {
    id: 'bank-2',
    label: 'Bank Account 2',
    bankHolder: '',
    bankName: '',
    bankAccountNumber: '',
    bankIfsc: '',
    enabled: false,
  },
  {
    id: 'bank-3',
    label: 'Bank Account 3',
    bankHolder: '',
    bankName: '',
    bankAccountNumber: '',
    bankIfsc: '',
    enabled: false,
  },
];

export const AdminPanel: React.FC = () => {
  const [adminToken, setAdminToken] = useState<string>(
    () => localStorage.getItem('ad78_admin_token') || sessionStorage.getItem('ad78_admin_token') || ''
  );
  const [authChecked, setAuthChecked] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [adminId, setAdminId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState<
    | 'wingo'
    | 'aviator'
    | 'mines_pro'
    | 'mines_dice'
    | 'new_games'
    | 'ratios'
    | 'deposits'
    | 'withdrawals'
    | 'accounts'
    | 'support'
    | 'users'
    | 'bets'
  >('wingo');
  const [statusMsg, setStatusMsg] = useState('');

  // WinGo inputs (Live Round & Next Round)
  const [liveNumInputs, setLiveNumInputs] = useState<Record<WingoMode, string>>({
    '30s': '',
    '1m': '',
    '3m': '',
  });
  const [nextNumInputs, setNextNumInputs] = useState<Record<WingoMode, string>>({
    '30s': '',
    '1m': '',
    '3m': '',
  });
  const [patternInputs, setPatternInputs] = useState<Record<WingoMode, string>>({
    '30s': '',
    '1m': '',
    '3m': '',
  });

  // Aviator inputs (Live Round & Next Round)
  const [aviatorCrashInput, setAviatorCrashInput] = useState('');
  const [aviatorNextCrashInput, setAviatorNextCrashInput] = useState('');
  const [minesProCrashInput, setMinesProCrashInput] = useState('');
  const [minesProNextCrashInput, setMinesProNextCrashInput] = useState('');
  const [diceRollInput, setDiceRollInput] = useState('');

  // Users & Support edits
  const [userSearch, setUserSearch] = useState('');
  const [balanceEdits, setBalanceEdits] = useState<Record<string, string>>({});
  const [newPassEdits, setNewPassEdits] = useState<Record<string, string>>({});
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [ticketPassInputs, setTicketPassInputs] = useState<Record<string, string>>({});
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Multi-Account Payment Config + Extra User App Live Controls
  const [upiSlots, setUpiSlots] = useState<AdminUpiSlot[]>(DEFAULT_UPI_SLOTS);
  const [bankSlots, setBankSlots] = useState<AdminBankSlot[]>(DEFAULT_BANK_SLOTS);
  const [noticeText, setNoticeText] = useState('');
  const [appName, setAppName] = useState('AD78');
  const [bankBonusPercent, setBankBonusPercent] = useState('5');
  const [supportWhatsappUrl, setSupportWhatsappUrl] = useState('');
  const [disabledGames, setDisabledGames] = useState<string[]>([]);
  const [cfgLoaded, setCfgLoaded] = useState(false);
  const [savingCfg, setSavingCfg] = useState(false);

  // Hidden Admin Credential Rotation
  const [curAdminId, setCurAdminId] = useState('');
  const [curAdminPass, setCurAdminPass] = useState('');
  const [newAdminId, setNewAdminId] = useState('');
  const [newAdminPass, setNewAdminPass] = useState('');
  const [credBusy, setCredBusy] = useState(false);

  useEffect(() => {
    document.title = 'AD78 — Controller Admin Panel';
  }, []);

  useEffect(() => {
    if (adminToken) return;
    let active = true;
    setAuthChecked(false);
    fetch('/api/admin/auth-status')
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        setIsConfigured(Boolean(data?.isConfigured));
        setAuthChecked(true);
      })
      .catch(() => {
        if (!active) return;
        setAuthChecked(true);
      });
    return () => {
      active = false;
    };
  }, [adminToken]);

  const fetchOverview = useCallback(async () => {
    if (!adminToken) return;
    try {
      const res = await fetch('/api/admin/overview', {
        headers: { 'x-admin-token': adminToken },
      });
      if (res.status === 401) {
        localStorage.removeItem('ad78_admin_token');
        sessionStorage.removeItem('ad78_admin_token');
        setAdminToken('');
        return;
      }
      if (!res.ok) {
        setLoadError('Could not load live server overview. Retrying...');
        return;
      }
      const data = (await res.json()) as AdminOverview;
      setLoadError('');
      setOverview(data);
      setPatternInputs((prev) => ({
        '30s': prev['30s'] || data.patterns['30s'].join(','),
        '1m': prev['1m'] || data.patterns['1m'].join(','),
        '3m': prev['3m'] || data.patterns['3m'].join(','),
      }));
      if (data.platformConfig && !cfgLoaded) {
        if (data.platformConfig.upiSlots && data.platformConfig.upiSlots.length >= 2) {
          setUpiSlots(data.platformConfig.upiSlots);
        } else {
          setUpiSlots([
            {
              id: 'upi-1',
              label: 'UPI 1 (Primary)',
              upiId: data.platformConfig.upiId || '',
              qrImageData: data.platformConfig.qrImageData,
              enabled: true,
            },
            DEFAULT_UPI_SLOTS[1],
          ]);
        }
        if (data.platformConfig.bankSlots && data.platformConfig.bankSlots.length >= 3) {
          setBankSlots(data.platformConfig.bankSlots);
        } else {
          setBankSlots([
            {
              id: 'bank-1',
              label: 'Bank Account 1',
              bankHolder: data.platformConfig.bankHolder || '',
              bankName: data.platformConfig.bankName || '',
              bankAccountNumber: data.platformConfig.bankAccountNumber || '',
              bankIfsc: data.platformConfig.bankIfsc || '',
              enabled: true,
            },
            DEFAULT_BANK_SLOTS[1],
            DEFAULT_BANK_SLOTS[2],
          ]);
        }
        setNoticeText(data.platformConfig.noticeText || '');
        setAppName(data.platformConfig.appName || 'AD78');
        setBankBonusPercent(String(data.platformConfig.bankBonusPercent ?? 5));
        setSupportWhatsappUrl(data.platformConfig.supportWhatsappUrl || '');
        setDisabledGames(
          Array.isArray(data.platformConfig.disabledGames) ? data.platformConfig.disabledGames : []
        );
        setCfgLoaded(true);
      }
    } catch {
      setLoadError('Connection issue reaching AD78 live server.');
    }
  }, [adminToken, cfgLoaded]);

  useEffect(() => {
    if (!adminToken) return;
    fetchOverview();
    const id = window.setInterval(fetchOverview, 1500);
    return () => window.clearInterval(id);
  }, [adminToken, fetchOverview]);

  // Live WebSocket stream for instant countdowns, Aviator multiplier & round settlement inside Admin Panel
  useEffect(() => {
    if (!adminToken) return;
    let closed = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;

    const connect = () => {
      if (closed) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${proto}//${window.location.host}/ws`);
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === 'wingo:tick') {
            setOverview((prev) => {
              if (!prev) return prev;
              const nextClocks = { ...prev.clocks };
              let periodChanged = false;
              if (msg.clocks) {
                (['30s', '1m', '3m'] as WingoMode[]).forEach((m) => {
                  if (msg.clocks[m] && prev.clocks[m]) {
                    if (prev.clocks[m].periodId !== msg.clocks[m].periodId) {
                      periodChanged = true;
                    }
                    nextClocks[m] = {
                      ...msg.clocks[m],
                      history: prev.clocks[m].history,
                    };
                  }
                });
              }
              if (periodChanged) {
                window.setTimeout(fetchOverview, 250);
              }
              return {
                ...prev,
                clocks: nextClocks,
                aviator: msg.aviator || prev.aviator,
                minesPro: msg.minesPro || prev.minesPro,
              };
            });
          } else if ((msg.type === 'aviator:state' || msg.type === 'aviator:tick') && msg.state) {
            setOverview((prev) => (prev ? { ...prev, aviator: msg.state } : prev));
          } else if ((msg.type === 'mines_pro:state' || msg.type === 'mines_pro:tick') && msg.state) {
            setOverview((prev) => (prev ? { ...prev, minesPro: msg.state } : prev));
          } else if (msg.type === 'wingo:result' && msg.mode) {
            fetchOverview();
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
      ws?.close();
    };
  }, [adminToken, fetchOverview]);

  const handleAdminSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (password !== confirmPassword) {
      setAuthError('Password and Confirm Password do not match.');
      return;
    }
    setAuthBusy(true);
    try {
      const res = await fetch('/api/admin/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: adminId.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create Admin credentials');
      localStorage.setItem('ad78_admin_token', data.token);
      sessionStorage.setItem('ad78_admin_token', data.token);
      setIsConfigured(true);
      setAdminId('');
      setPassword('');
      setConfirmPassword('');
      setAdminToken(data.token);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthBusy(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: adminId.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid Admin User ID or Password');
      localStorage.setItem('ad78_admin_token', data.token);
      sessionStorage.setItem('ad78_admin_token', data.token);
      setAdminId('');
      setPassword('');
      setAdminToken(data.token);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleOverride = async (mode: WingoMode, num: number | null) => {
    try {
      const res = await fetch('/api/admin/wingo/override', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken,
        },
        body: JSON.stringify({ mode, number: num }),
      });
      const data = await res.json();
      if (res.ok) {
        setLiveNumInputs((p) => ({ ...p, [mode]: '' }));
        setOverview((prev) => (prev ? { ...prev, overrides: data.overrides } : prev));
        setStatusMsg(
          num === null
            ? `Cleared current-round override for WinGo ${mode}.`
            : `WinGo ${mode} CURRENT ROUND locked to exact #${num}!`
        );
      } else {
        setStatusMsg(data.error || 'Failed to save override.');
      }
    } catch {
      setStatusMsg('Network error saving WinGo override.');
    }
  };

  const handleHouseWinOverride = async (mode: WingoMode) => {
    try {
      const res = await fetch('/api/admin/wingo/override', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken,
        },
        body: JSON.stringify({ mode, houseWin: true }),
      });
      const data = await res.json();
      if (res.ok) {
        setOverview((prev) => (prev ? { ...prev, overrides: data.overrides } : prev));
        setStatusMsg(
          `WinGo ${mode} CURRENT ROUND auto-locked to #${data.overrides[mode]} (House Lowest Payout)!`
        );
      } else {
        setStatusMsg(data.error || 'Could not calculate house-win override.');
      }
    } catch {
      setStatusMsg('Network error locking house-win override.');
    }
  };

  const handleNextOverride = async (mode: WingoMode, num: number | null) => {
    try {
      const res = await fetch('/api/admin/wingo/override', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken,
        },
        body: JSON.stringify({ mode, nextNumber: num }),
      });
      const data = await res.json();
      if (res.ok) {
        setNextNumInputs((p) => ({ ...p, [mode]: '' }));
        setOverview((prev) => (prev ? { ...prev, nextOverrides: data.nextOverrides } : prev));
        setStatusMsg(
          num === null
            ? `Cleared upcoming next-round lock for WinGo ${mode}.`
            : `WinGo ${mode} NEXT ROUND saved & locked to exact #${num}!`
        );
      } else {
        setStatusMsg(data.error || 'Failed to save next round number.');
      }
    } catch {
      setStatusMsg('Network error saving WinGo next round.');
    }
  };

  const handleSavePattern = async (mode: WingoMode) => {
    const nums = patternInputs[mode]
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 9);
    if (nums.length === 0) {
      setStatusMsg('Enter comma-separated digits 0-9 for the pattern.');
      return;
    }
    const res = await fetch('/api/admin/wingo/override', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': adminToken,
      },
      body: JSON.stringify({ mode, pattern: nums }),
    });
    if (res.ok) {
      setStatusMsg(`Updated ${mode} pattern sequence (${nums.length} steps).`);
      fetchOverview();
    }
  };

  const handleAviatorOverride = async (
    payload: {
      crashPoint?: string | null;
      nextCrashPoint?: string | null;
      crashNow?: boolean;
      manualHold?: boolean;
    }
  ) => {
    if ('crashPoint' in payload && typeof payload.crashPoint === 'string') {
      const v = Number(payload.crashPoint);
      if (!Number.isFinite(v) || v < 1.01 || v > 10000) {
        setStatusMsg('Enter a valid live crash multiplier between 1.01x and 10000x.');
        return;
      }
    }
    if ('nextCrashPoint' in payload && typeof payload.nextCrashPoint === 'string') {
      const v = Number(payload.nextCrashPoint);
      if (!Number.isFinite(v) || v < 1.01 || v > 10000) {
        setStatusMsg('Enter a valid next-round multiplier between 1.01x and 10000x.');
        return;
      }
    }
    const res = await fetch('/api/admin/aviator/override', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': adminToken,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatusMsg(data.error || 'Could not update Aviator override');
      return;
    }
    if (typeof payload.manualHold === 'boolean') {
      setStatusMsg(
        payload.manualHold
          ? 'Aviator Manual Hold ENABLED: Plane will keep flying up to 10000x until you press CRASH NOW.'
          : 'Aviator Manual Hold DISABLED: Automatic round crash schedule resumed.'
      );
    } else if ('crashPoint' in payload) {
      setAviatorCrashInput('');
      setStatusMsg(
        payload.crashPoint === null
          ? 'Cleared Aviator live crash override (back to auto).'
          : `Aviator current/takeoff locked to crash at ${data.currentTargetCrash || data.aviatorOverride}x!`
      );
    } else if ('nextCrashPoint' in payload) {
      setAviatorNextCrashInput('');
      setStatusMsg(
        payload.nextCrashPoint === null
          ? 'Cleared Aviator next-round queued crash.'
          : `Aviator NEXT ROUND saved to crash at ${data.aviatorNextOverride}x!`
      );
    } else if (payload.crashNow) {
      setStatusMsg(`Plane crashed immediately at ${data.currentTargetCrash}x!`);
    }
    fetchOverview();
  };

  const handleSupportReply = async (ticketId: string) => {
    const reply = (replyInputs[ticketId] || 'Resolved by AD78 Support').trim();
    const res = await fetch('/api/admin/support/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': adminToken,
      },
      body: JSON.stringify({ ticketId, reply }),
    });
    if (res.ok) {
      setReplyInputs((p) => ({ ...p, [ticketId]: '' }));
      setStatusMsg(`Support ticket ${ticketId} resolved.`);
      fetchOverview();
    }
  };

  const handleSupportPasswordReset = async (ticketId: string) => {
    const np = (ticketPassInputs[ticketId] || '').trim();
    if (np.length < 6) {
      setStatusMsg('Enter a new password (min 6 chars mixing letters & numbers, e.g. ad78pass9).');
      return;
    }
    try {
      const res = await fetch('/api/admin/support/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken,
        },
        body: JSON.stringify({ ticketId, newPassword: np }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusMsg(data.error || 'Could not reset password for this ticket.');
        return;
      }
      setTicketPassInputs((p) => ({ ...p, [ticketId]: '' }));
      setStatusMsg(
        `Password reset for ${data.user?.username || 'user'} (${data.user?.mobile || ''}) to "${np}" and sent in 24×7 Support reply!`
      );
      fetchOverview();
    } catch {
      setStatusMsg('Network error resetting user password.');
    }
  };

  const handleTxReview = async (transactionId: string, action: 'approve' | 'reject') => {
    const res = await fetch('/api/admin/transaction/review', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': adminToken,
      },
      body: JSON.stringify({ transactionId, action }),
    });
    if (res.ok) {
      setStatusMsg(`Transaction ${transactionId} ${action}d successfully.`);
      fetchOverview();
    }
  };

  const handleAdjustBalance = async (userId: string, sign: 1 | -1) => {
    const raw = Number(balanceEdits[userId] || 0);
    if (!Number.isFinite(raw) || raw <= 0) return;
    const res = await fetch('/api/admin/user/balance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': adminToken,
      },
      body: JSON.stringify({ userId, delta: sign * raw }),
    });
    if (res.ok) {
      setBalanceEdits((p) => ({ ...p, [userId]: '' }));
      setStatusMsg(`Wallet adjusted by ${sign > 0 ? '+' : '-'}₹${raw}.`);
      fetchOverview();
    }
  };

  const handleToggleFreeze = async (user: UserProfile) => {
    const res = await fetch('/api/admin/user/freeze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': adminToken,
      },
      body: JSON.stringify({ userId: user.id, isFrozen: !user.isFrozen }),
    });
    if (res.ok) {
      setStatusMsg(`User ${user.username} ${!user.isFrozen ? 'frozen' : 'unfrozen'}.`);
      fetchOverview();
    }
  };

  const handleResetUserPassword = async (user: UserProfile) => {
    const np = (newPassEdits[user.id] || '').trim();
    if (np.length < 6) {
      setStatusMsg('Enter a new password (min 6 chars mixing letters & numbers).');
      return;
    }
    const res = await fetch('/api/admin/user/password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': adminToken,
      },
      body: JSON.stringify({ userId: user.id, newPassword: np }),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatusMsg(data.error || 'Could not reset password.');
      return;
    }
    setNewPassEdits((p) => ({ ...p, [user.id]: '' }));
    setStatusMsg(`Password updated for user ${user.username} (${user.mobile}) to "${np}".`);
    fetchOverview();
  };

  const handleQrUpload = async (slotIdx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 900, 0.85);
      setUpiSlots((prev) =>
        prev.map((slot, i) => (i === slotIdx ? { ...slot, qrImageData: compressed } : slot))
      );
      setStatusMsg(`QR image loaded for UPI ${slotIdx + 1}. Click "Push Live to User Apps" to publish!`);
    } catch {
      setStatusMsg('Could not read QR image file.');
    }
  };

  const handleMinesProOverride = async (payload: {
    crashPoint?: string | null;
    nextCrashPoint?: string | null;
    crashNow?: boolean;
  }) => {
    try {
      const res = await fetch('/api/admin/mines-pro/override', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        if ('crashPoint' in payload) setMinesProCrashInput('');
        if ('nextCrashPoint' in payload) setMinesProNextCrashInput('');
        setOverview((prev) =>
          prev
            ? {
                ...prev,
                minesProOverride: data.minesProOverride,
                minesProNextOverride: data.minesProNextOverride,
                minesProCurrentTarget: data.currentTargetCrash,
                minesProIsManualTarget: data.minesProIsManualTarget,
              }
            : prev
        );
        if (payload.crashNow) {
          setStatusMsg(`Mines Pro blasted immediately @ ${data.currentTargetCrash}x!`);
        } else if ('crashPoint' in payload) {
          setStatusMsg(
            data.currentTargetCrash
              ? `Mines Pro LIVE round locked to ${data.currentTargetCrash}x!`
              : 'Mines Pro live round lock cleared.'
          );
        } else if ('nextCrashPoint' in payload) {
          setStatusMsg(
            data.minesProNextOverride
              ? `Mines Pro NEXT round saved to ${data.minesProNextOverride}x!`
              : 'Mines Pro next round lock cleared.'
          );
        }
      } else {
        setStatusMsg(data.error || 'Could not update Mines Pro control.');
      }
    } catch {
      setStatusMsg('Network error updating Mines Pro control.');
    }
  };

  const handleMinesControl = async (forceNextBomb: boolean) => {
    try {
      const res = await fetch('/api/admin/mines/control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken,
        },
        body: JSON.stringify({ forceNextBomb }),
      });
      const data = await res.json();
      if (res.ok) {
        setOverview((prev) =>
          prev ? { ...prev, minesForceNextBomb: data.minesForceNextBomb } : prev
        );
        setStatusMsg(
          data.minesForceNextBomb
            ? 'Mines armed: Next tile opened by any player will be a BOMB.'
            : 'Mines reset to fair random bomb placement.'
        );
      } else {
        setStatusMsg(data.error || 'Could not update Mines control.');
      }
    } catch {
      setStatusMsg('Network error updating Mines control.');
    }
  };

  const handleDiceOverride = async (payload: { nextRoll?: string | null; forceLoss?: boolean }) => {
    try {
      const res = await fetch('/api/admin/dice/override', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        if ('nextRoll' in payload) setDiceRollInput('');
        setOverview((prev) =>
          prev
            ? {
                ...prev,
                diceNextOverride: data.diceNextOverride,
                diceForceLoss: data.diceForceLoss,
              }
            : prev
        );
        setStatusMsg(
          'nextRoll' in payload
            ? data.diceNextOverride !== null
              ? `Next Dice roll locked to ${Number(data.diceNextOverride).toFixed(2)}!`
              : 'Dice next-roll lock cleared.'
            : data.diceForceLoss
            ? 'Dice armed: Next roll will auto-lose.'
            : 'Dice reset to fair random rolls.'
        );
      } else {
        setStatusMsg(data.error || 'Could not update Dice control.');
      }
    } catch {
      setStatusMsg('Network error updating Dice control.');
    }
  };

  const handleChickenControl = async (forceNextTrap: boolean) => {
    try {
      const res = await fetch('/api/admin/chicken-road/control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken,
        },
        body: JSON.stringify({ forceNextTrap }),
      });
      const data = await res.json();
      if (res.ok) {
        setOverview((prev) =>
          prev ? { ...prev, chickenForceNextTrap: data.chickenForceNextTrap } : prev
        );
        setStatusMsg(
          data.chickenForceNextTrap
            ? 'Chicken Road armed: Next lane step will hit a highway hazard.'
            : 'Chicken Road reset to fair highway traffic.'
        );
      } else {
        setStatusMsg(data.error || 'Could not update Chicken Road control.');
      }
    } catch {
      setStatusMsg('Network error updating Chicken Road control.');
    }
  };

  const handleCrystalOverride = async (mode: 'fair' | 'force_loss' | 'force_win') => {
    try {
      const res = await fetch('/api/admin/crystal/override', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken,
        },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (res.ok) {
        setOverview((prev) => (prev ? { ...prev, crystalMode: data.crystalMode } : prev));
        setStatusMsg(
          data.crystalMode === 'force_loss'
            ? 'Crystal Poker armed: Next hand guaranteed House Win.'
            : data.crystalMode === 'force_win'
            ? 'Crystal Poker armed: Next hand guaranteed 5-Crystal Flush (10x).'
            : 'Crystal Poker reset to fair deals.'
        );
      } else {
        setStatusMsg(data.error || 'Could not update Crystal control.');
      }
    } catch {
      setStatusMsg('Network error updating Crystal control.');
    }
  };

  const handleGameModeChange = async (gameId: string, mode: GameOutcomeMode) => {
    try {
      const res = await fetch('/api/admin/game-mode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken,
        },
        body: JSON.stringify({ gameId, mode }),
      });
      const data = await res.json();
      if (res.ok) {
        setOverview((prev) =>
          prev
            ? {
                ...prev,
                platformConfig: prev.platformConfig
                  ? { ...prev.platformConfig, gameModes: data.gameModes }
                  : prev.platformConfig,
              }
            : prev
        );
        const labelMap: Record<GameOutcomeMode, string> = {
          '6w4l': '6 Wins / 4 Losses',
          '4w6l': '4 Wins / 6 Losses',
          force_win: 'Always Win',
          force_loss: 'Always Loss',
          fair: 'Fair Random',
        };
        setStatusMsg(`${gameId.replace('_', ' ').toUpperCase()} Real-User cycle updated to ${labelMap[mode]} (Live!).`);
      } else {
        setStatusMsg(data.error || 'Could not update game win/loss ratio.');
      }
    } catch {
      setStatusMsg('Network error updating game ratio.');
    }
  };

  const handleTowerControl = async (forceCollapse: boolean) => {
    try {
      const res = await fetch('/api/admin/tower-rush/control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken,
        },
        body: JSON.stringify({ forceCollapse }),
      });
      const data = await res.json();
      if (res.ok) {
        setOverview((prev) =>
          prev ? { ...prev, towerForceCollapse: data.towerForceCollapse } : prev
        );
        setStatusMsg(
          data.towerForceCollapse
            ? 'Tower Rush armed: Next dropped floor will collapse.'
            : 'Tower Rush reset to fair building mode.'
        );
      } else {
        setStatusMsg(data.error || 'Could not update Tower Rush control.');
      }
    } catch {
      setStatusMsg('Network error updating Tower Rush control.');
    }
  };

  const handleSavePlatformConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCfg(true);
    try {
      const bonusNum = Math.min(25, Math.max(0, Math.round(Number(bankBonusPercent) || 0)));
      const res = await fetch('/api/admin/platform/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken,
        },
        body: JSON.stringify({
          upiSlots,
          bankSlots,
          noticeText,
          appName: appName.trim() || 'AD78',
          bankBonusPercent: bonusNum,
          supportWhatsappUrl: supportWhatsappUrl.trim(),
          disabledGames,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.platformConfig?.upiSlots) setUpiSlots(data.platformConfig.upiSlots);
        if (data.platformConfig?.bankSlots) setBankSlots(data.platformConfig.bankSlots);
        setBankBonusPercent(String(data.platformConfig?.bankBonusPercent ?? bonusNum));
        setStatusMsg('Accounts, App Branding, Bonus % & Game Visibility pushed LIVE to all User Apps!');
        fetchOverview();
      } else {
        setStatusMsg(data.error || 'Could not update platform configuration.');
      }
    } catch {
      setStatusMsg('Network error updating platform details.');
    } finally {
      setSavingCfg(false);
    }
  };

  const handleChangeAdminCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setCredBusy(true);
    try {
      const res = await fetch('/api/admin/change-credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken,
        },
        body: JSON.stringify({
          currentAdminId: curAdminId.trim(),
          currentPassword: curAdminPass,
          newAdminId: newAdminId.trim(),
          newPassword: newAdminPass,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusMsg(data.error || 'Could not update Admin credentials.');
        return;
      }
      setCurAdminId('');
      setCurAdminPass('');
      setNewAdminId('');
      setNewAdminPass('');
      setStatusMsg('Hidden Admin User ID & Password updated securely.');
    } catch {
      setStatusMsg('Network error updating Admin credentials.');
    } finally {
      setCredBusy(false);
    }
  };

  if (!adminToken) {
    if (!authChecked) {
      return (
        <div className="min-h-screen bg-[#070b14] flex items-center justify-center p-4">
          <div className="rounded-2xl border border-slate-700 bg-[#0d1424] px-6 py-5 text-sm font-semibold text-slate-300 shadow-2xl">
            Verifying Admin Console Security...
          </div>
        </div>
      );
    }

    if (!isConfigured) {
      return (
        <div className="min-h-screen bg-[#070b14] flex items-center justify-center p-4">
          <form
            onSubmit={handleAdminSetup}
            autoComplete="off"
            className="w-full max-w-sm rounded-2xl border border-amber-500/40 bg-[#0d1424] p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">One-Time Admin Setup</h1>
                <p className="text-xs text-slate-400">
                  Create your permanent hidden Admin User ID &amp; Password
                </p>
              </div>
            </div>

            {authError && (
              <div className="rounded-xl bg-rose-500/15 border border-rose-500/40 px-3 py-2 text-xs text-rose-200">
                {authError}
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">
                Create Admin User ID (Hidden)
              </label>
              <input
                type="password"
                value={adminId}
                onChange={(e) => setAdminId(e.target.value)}
                placeholder="4-32 chars (letters, numbers, _.-)"
                autoComplete="new-password"
                required
                className="w-full rounded-xl bg-[#070b14] border border-slate-700 px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">
                Create Admin Password (Hidden)
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                autoComplete="new-password"
                required
                className="w-full rounded-xl bg-[#070b14] border border-slate-700 px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">
                Confirm Admin Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter Admin Password"
                autoComplete="new-password"
                required
                className="w-full rounded-xl bg-[#070b14] border border-slate-700 px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <p className="text-[11px] leading-relaxed text-amber-200/80">
              Both User ID and Password stay strictly hidden &amp; encrypted. Remember them carefully — every Admin login requires both.
            </p>

            <button
              type="submit"
              disabled={authBusy}
              className="w-full rounded-xl bg-amber-400 py-3 text-sm font-bold text-slate-950 hover:bg-amber-300 transition disabled:opacity-60"
            >
              {authBusy ? 'Creating Credentials...' : 'Create Admin Credentials & Enter'}
            </button>
          </form>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#070b14] flex items-center justify-center p-4">
        <form
          onSubmit={handleAdminLogin}
          autoComplete="off"
          className="w-full max-w-sm rounded-2xl border border-slate-700 bg-[#0d1424] p-6 space-y-4 shadow-2xl"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">AD78 Admin Desk</h1>
              <p className="text-xs text-slate-400">Restricted Operations Console</p>
            </div>
          </div>

          {authError && (
            <div className="rounded-xl bg-rose-500/15 border border-rose-500/40 px-3 py-2 text-xs text-rose-200">
              {authError}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">
              Admin User ID
            </label>
            <input
              type="password"
              value={adminId}
              onChange={(e) => setAdminId(e.target.value)}
              placeholder="••••••••"
              autoComplete="off"
              required
              className="w-full rounded-xl bg-[#070b14] border border-slate-700 px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">
              Admin Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="off"
              required
              className="w-full rounded-xl bg-[#070b14] border border-slate-700 px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <button
            type="submit"
            disabled={authBusy}
            className="w-full rounded-xl bg-amber-400 py-3 text-sm font-bold text-slate-950 hover:bg-amber-300 transition disabled:opacity-60"
          >
            {authBusy ? 'Verifying...' : 'Unlock Admin Panel'}
          </button>
        </form>
      </div>
    );
  }

  const pendingDeposits = (overview?.pendingTransactions || []).filter((t) => t.type === 'deposit');
  const pendingWithdrawals = (overview?.pendingTransactions || []).filter((t) => t.type === 'withdrawal');
  const depositHistory = (overview?.allTransactions || []).filter((t) => t.type === 'deposit');
  const withdrawalHistory = (overview?.allTransactions || []).filter((t) => t.type === 'withdrawal');

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 pb-12">
      <header className="sticky top-0 z-30 flex items-center justify-between bg-[#0d1424]/95 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 py-3.5">
        <div className="flex items-center gap-2.5">
          <Shield className="h-5 w-5 text-amber-400" />
          <div>
            <div className="text-base font-bold text-white">AD78 Controller Admin Panel</div>
            <div className="text-[11px] text-slate-400">
              Live Sync to All Connected APKs &amp; Web Users
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchOverview}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <button
            onClick={() => {
              localStorage.removeItem('ad78_admin_token');
              sessionStorage.removeItem('ad78_admin_token');
              setAdminToken('');
            }}
            className="rounded-lg bg-rose-500/20 border border-rose-500/40 px-3 py-2 text-xs font-bold text-rose-300"
          >
            Lock
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-5 space-y-5">
        {loadError && (
          <div className="rounded-xl bg-rose-500/15 border border-rose-500/40 px-4 py-2.5 text-xs font-semibold text-rose-200">
            {loadError}
          </div>
        )}

        {!overview && !loadError && (
          <div className="rounded-xl bg-[#0d1424] border border-slate-800 px-4 py-8 text-center text-xs text-slate-300">
            Connecting to AD78 Live Controller...
          </div>
        )}

        {overview && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl bg-[#0d1424] border border-slate-800 p-4">
              <div className="text-xs text-slate-400">Total Users</div>
              <div className="mt-1 text-2xl font-bold text-white tabular-nums">
                {overview.stats.totalUsers}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-400">Registered AD78 IDs</div>
            </div>
            <div className="rounded-xl bg-[#0d1424] border border-slate-800 p-4">
              <div className="text-xs text-slate-400">Live Playing Now</div>
              <div className="mt-1 text-2xl font-bold text-cyan-300 tabular-nums">
                {overview.stats.activePlayersNow}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-400">
                {overview.stats.activeConnections} active connections
              </div>
            </div>
            <div className="rounded-xl bg-[#0d1424] border border-slate-800 p-4">
              <div className="text-xs text-slate-400">Deposits Approved</div>
              <div className="mt-1 text-2xl font-bold text-emerald-400 tabular-nums">
                ₹{overview.stats.totalDeposits.toFixed(0)}
              </div>
              <div className="mt-0.5 text-[11px] text-amber-300">
                {pendingDeposits.length} pending UTR checks
              </div>
            </div>
            <div className="rounded-xl bg-[#0d1424] border border-slate-800 p-4">
              <div className="text-xs text-slate-400">Withdrawals / Support</div>
              <div className="mt-1 text-2xl font-bold text-white tabular-nums">
                ₹{overview.stats.totalWithdrawals.toFixed(0)}
              </div>
              <div className="mt-0.5 text-[11px] text-amber-300">
                {pendingWithdrawals.length} withdrawals ·{' '}
                {overview.supportTickets.filter((t) => t.status === 'open').length} open tickets
              </div>
            </div>
          </div>
        )}

        {statusMsg && (
          <div className="rounded-xl bg-amber-500/15 border border-amber-400/40 px-4 py-2.5 text-xs font-semibold text-amber-200 flex items-center justify-between gap-2">
            <span>{statusMsg}</span>
            <button
              type="button"
              onClick={() => setStatusMsg('')}
              className="text-amber-300 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {overview && (
          <div className="rounded-xl bg-[#0d1424] border border-cyan-500/30 p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-cyan-300 font-bold">
              <Link2 className="h-4 w-4 shrink-0" />
              <span>Separate Shareable Links</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg bg-[#070b14] border border-slate-700 px-3 py-1.5">
                <span className="text-slate-400">User App:</span>
                <span className="font-mono text-white truncate max-w-[200px] sm:max-w-[280px]">
                  {typeof window !== 'undefined' ? `${window.location.origin}/` : '/'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(`${window.location.origin}/`);
                    setStatusMsg('User App share link copied!');
                  }}
                  className="inline-flex items-center gap-1 rounded bg-cyan-400/20 px-2 py-0.5 text-[11px] font-bold text-cyan-300 hover:bg-cyan-400/30"
                >
                  <Copy className="h-3 w-3" /> Copy
                </button>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-[#070b14] border border-slate-700 px-3 py-1.5">
                <span className="text-slate-400">Admin Panel:</span>
                <span className="font-mono text-amber-300 truncate max-w-[200px] sm:max-w-[280px]">
                  {typeof window !== 'undefined' ? `${window.location.origin}/admin` : '/admin'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(`${window.location.origin}/admin`);
                    setStatusMsg('Admin Panel link copied!');
                  }}
                  className="inline-flex items-center gap-1 rounded bg-amber-400/20 px-2 py-0.5 text-[11px] font-bold text-amber-300 hover:bg-amber-400/30"
                >
                  <Copy className="h-3 w-3" /> Copy
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dedicated Separate Sections (Tabs) */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'wingo' as const, label: 'WinGo Live & Next', icon: Sliders },
            { id: 'aviator' as const, label: 'Aviator Live & Next', icon: Plane },
            { id: 'mines_dice' as const, label: 'Mines Pro · Mines · Dice', icon: Dices },
            { id: 'new_games' as const, label: 'Chicken · Tower · Crystal', icon: Sparkles },
            { id: 'ratios' as const, label: 'Game Win/Loss (6W/4L · 4W/6L)', icon: Zap },
            {
              id: 'deposits' as const,
              label: `Deposits & UTR${pendingDeposits.length ? ` (${pendingDeposits.length})` : ''}`,
              icon: Wallet,
            },
            {
              id: 'withdrawals' as const,
              label: `Withdrawals${pendingWithdrawals.length ? ` (${pendingWithdrawals.length})` : ''}`,
              icon: ArrowUpFromLine,
            },
            { id: 'accounts' as const, label: '2 UPI/QR & 3 Bank Setup', icon: Settings },
            { id: 'support' as const, label: '24×7 Support', icon: Headphones },
            { id: 'users' as const, label: 'Users & Passwords', icon: Users },
            { id: 'bets' as const, label: 'All Live Bets', icon: Shield },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                  tab === t.id
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-[#0d1424] text-slate-300 border border-slate-800 hover:bg-slate-800'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* 1. WINGO LIVE & NEXT ROUND SEPARATE SECTIONS */}
        {tab === 'wingo' && overview && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {(['30s', '1m', '3m'] as WingoMode[]).map((mode) => {
              const clock = overview.clocks[mode];
              const nextPid = overview.nextPeriodIds?.[mode] || 'Next Round';
              const pool = overview.livePools[mode];
              const currentOverride = overview.overrides[mode];
              const nextOverride = overview.nextOverrides?.[mode] ?? null;
              const liveBets = pool.bets || [];
              const recentHistory = (clock.history || []).slice(0, 8);

              const getBallStyle = (n: number) => {
                if (n === 0) return 'bg-gradient-to-br from-rose-500 to-violet-600 text-white';
                if (n === 5) return 'bg-gradient-to-br from-emerald-500 to-violet-600 text-white';
                return n % 2 === 1
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-rose-500 text-white';
              };

              return (
                <div
                  key={mode}
                  className="rounded-2xl bg-[#0d1424] border border-slate-800 p-4 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-base font-bold text-white">
                        WinGo {mode.toUpperCase()}
                      </div>
                      <div className="text-[11px] text-slate-400 tabular-nums">
                        Period: {clock.periodId}
                      </div>
                    </div>
                    <div
                      className={`rounded-lg px-3 py-1 text-sm font-bold tabular-nums ${
                        clock.isLocked
                          ? 'bg-rose-500/20 text-rose-300'
                          : 'bg-cyan-500/20 text-cyan-300'
                      }`}
                    >
                      {clock.secondsRemaining}s
                    </div>
                  </div>

                  {/* Last 8 Settled Results */}
                  <div className="rounded-xl bg-[#070b14] p-2.5 border border-slate-800">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
                      Recent Results (Latest First)
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {recentHistory.map((r) => (
                        <div
                          key={r.periodId}
                          title={`Period ${r.periodId}: #${r.number} (${r.colors.join('+')} · ${r.size})`}
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold shadow ${getBallStyle(
                            r.number
                          )}`}
                        >
                          {r.number}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Active Pool + Live User Bets */}
                  <div className="rounded-xl bg-[#070b14] p-3 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Active Pool ({liveBets.length} bets)</span>
                      <span className="font-bold text-white tabular-nums">
                        ₹{pool.totalAmount.toFixed(0)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(pool.bySelection).length === 0 ? (
                        <span className="text-[11px] text-slate-500">No bets yet this period</span>
                      ) : (
                        Object.entries(pool.bySelection).map(([sel, amt]) => (
                          <span
                            key={sel}
                            className="rounded bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-white uppercase"
                          >
                            {sel}: ₹{amt}
                          </span>
                        ))
                      )}
                    </div>
                    {liveBets.length > 0 && (
                      <div className="max-h-24 overflow-y-auto border-t border-slate-800 pt-1.5 space-y-1">
                        {liveBets.map((b) => (
                          <div
                            key={b.id}
                            className="flex items-center justify-between text-[11px] text-slate-300"
                          >
                            <span className="font-semibold text-white">{b.username}</span>
                            <span className="text-cyan-300 uppercase">{b.selection}</span>
                            <span className="font-bold text-amber-300 tabular-nums">₹{b.amount}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleHouseWinOverride(mode)}
                      className="w-full rounded-lg bg-emerald-500/20 border border-emerald-400/40 py-1.5 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/30 transition"
                    >
                      Auto House-Profit Lock (Lowest Payout: #{pool.lowestPayoutNumber ?? 0})
                    </button>
                  </div>

                  {/* SECTION A: CURRENT RUNNING ROUND RESULT */}
                  <div className="rounded-xl border border-amber-400/35 bg-[#091224] p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-extrabold text-amber-300">
                          1. Live Round Result
                        </div>
                        <div className="text-[10px] text-slate-400 tabular-nums">
                          Period {clock.periodId.slice(-6)}
                        </div>
                      </div>
                      {currentOverride !== null ? (
                        <button
                          onClick={() => handleOverride(mode, null)}
                          className="rounded bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.5 text-[10px] font-bold text-emerald-300"
                        >
                          LOCKED #{currentOverride} · Clear
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400">Auto</span>
                      )}
                    </div>

                    <div className="grid grid-cols-5 gap-1.5">
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => handleOverride(mode, n)}
                          className={`rounded-lg py-1.5 text-xs font-extrabold transition ${
                            currentOverride === n
                              ? 'ring-2 ring-white scale-[1.03] ' + getBallStyle(n)
                              : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                          }`}
                        >
                          <div>{n}</div>
                          <div className="text-[9px] opacity-80">
                            {n >= 5 ? 'BIG' : 'SML'}
                          </div>
                        </button>
                      ))}
                    </div>

                    <div className="flex gap-1.5">
                      <input
                        type="number"
                        min={0}
                        max={9}
                        value={liveNumInputs[mode]}
                        onChange={(e) =>
                          setLiveNumInputs((p) => ({ ...p, [mode]: e.target.value }))
                        }
                        placeholder="Number (0-9)"
                        className="flex-1 rounded-lg bg-[#070b14] border border-slate-700 px-2.5 py-1.5 text-xs text-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const raw = liveNumInputs[mode].trim();
                          const n = Number(raw);
                          if (raw !== '' && Number.isInteger(n) && n >= 0 && n <= 9) {
                            handleOverride(mode, n);
                          } else {
                            setStatusMsg('Enter a valid digit 0-9 before saving.');
                          }
                        }}
                        className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-slate-950"
                      >
                        Save Live
                      </button>
                    </div>
                  </div>

                  {/* SECTION B: SAVED NEXT ROUND NUMBER (SEPARATE BOX) */}
                  <div className="rounded-xl border border-cyan-400/35 bg-[#081523] p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-extrabold text-cyan-300">
                          2. Save Next Round Number
                        </div>
                        <div className="text-[10px] text-slate-400 tabular-nums">
                          Upcoming Period {nextPid.slice(-6)}
                        </div>
                      </div>
                      {nextOverride !== null ? (
                        <button
                          onClick={() => handleNextOverride(mode, null)}
                          className="rounded bg-cyan-500/20 border border-cyan-400/40 px-2 py-0.5 text-[10px] font-bold text-cyan-200"
                        >
                          SAVED #{nextOverride} · Clear
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400">Not set</span>
                      )}
                    </div>

                    <div className="grid grid-cols-5 gap-1">
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => handleNextOverride(mode, n)}
                          className={`rounded py-1 text-[11px] font-bold transition ${
                            nextOverride === n
                              ? 'bg-cyan-400 text-slate-950 ring-2 ring-white'
                              : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>

                    <div className="flex gap-1.5">
                      <input
                        type="number"
                        min={0}
                        max={9}
                        value={nextNumInputs[mode]}
                        onChange={(e) =>
                          setNextNumInputs((p) => ({ ...p, [mode]: e.target.value }))
                        }
                        placeholder="Next round # (0-9)"
                        className="flex-1 rounded-lg bg-[#070b14] border border-slate-700 px-2.5 py-1.5 text-xs text-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const raw = nextNumInputs[mode].trim();
                          const n = Number(raw);
                          if (raw !== '' && Number.isInteger(n) && n >= 0 && n <= 9) {
                            handleNextOverride(mode, n);
                          } else {
                            setStatusMsg('Enter a valid digit 0-9 for next round.');
                          }
                        }}
                        className="rounded-lg bg-cyan-400 px-3 py-1.5 text-xs font-bold text-slate-950"
                      >
                        Save Next
                      </button>
                    </div>
                  </div>

                  {/* Automated Pattern Sequence */}
                  <div className="space-y-1.5 pt-1 border-t border-slate-800">
                    <label className="block text-[11px] font-semibold text-slate-400">
                      Automated Pattern Sequence (0-9)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={patternInputs[mode]}
                        onChange={(e) =>
                          setPatternInputs((p) => ({ ...p, [mode]: e.target.value }))
                        }
                        className="flex-1 rounded-lg bg-[#070b14] border border-slate-700 px-2.5 py-1.5 text-xs text-white"
                      />
                      <button
                        onClick={() => handleSavePattern(mode)}
                        className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-600"
                      >
                        Save Pattern
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 2. AVIATOR LIVE & NEXT ROUND SEPARATE SECTIONS */}
        {tab === 'aviator' && overview && (
          <div className="space-y-4">
            {/* Live Flight Status & Recent Multipliers */}
            <div className="rounded-2xl bg-[#0d1424] border border-slate-800 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs text-slate-400">
                    Aviator Live Engine · {overview.aviator.roundId}
                  </div>
                  <div className="mt-0.5 text-2xl font-extrabold tabular-nums text-white">
                    {overview.aviator.phase === 'betting' && (
                      <span className="text-cyan-300">
                        BETTING OPEN ({overview.aviator.countdownSec}s)
                      </span>
                    )}
                    {overview.aviator.phase === 'flying' && (
                      <span className="text-emerald-400">
                        FLYING LIVE · {overview.aviator.multiplier.toFixed(2)}x
                      </span>
                    )}
                    {overview.aviator.phase === 'crashed' && (
                      <span className="text-rose-400">
                        CRASHED @ {Number(overview.aviator.crashPoint || overview.aviator.multiplier).toFixed(2)}x
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAviatorOverride({ manualHold: !overview.aviatorManualHold })}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-extrabold border transition ${
                      overview.aviatorManualHold
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.25)]'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <Plane className="h-4 w-4" />
                    {overview.aviatorManualHold
                      ? 'MANUAL HOLD ON (Flies Until CRASH NOW)'
                      : 'Manual Hold OFF'}
                  </button>

                  {overview.aviator.phase === 'flying' && (
                    <button
                      type="button"
                      onClick={() => handleAviatorOverride({ crashNow: true })}
                      className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-5 py-3 text-sm font-extrabold text-white shadow-lg hover:bg-rose-400 transition"
                    >
                      <Zap className="h-4 w-4" /> CRASH NOW ({overview.aviator.multiplier.toFixed(2)}x)
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(overview.aviator.history || []).slice(0, 12).map((h) => (
                  <span
                    key={h.roundId}
                    className={`rounded-lg px-2 py-1 text-[11px] font-bold tabular-nums ${
                      h.crashPoint >= 2
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {h.crashPoint.toFixed(2)}x
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Live Current Flight Control */}
              <div className="rounded-2xl bg-[#0d1424] border border-amber-400/35 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-amber-300">
                      1. Live Flight Control
                    </h2>
                    <p className="text-xs text-slate-400">
                      Locks current takeoff or adjusts active flight crash multiplier (up to 10000x)
                    </p>
                  </div>
                  {(overview.aviatorOverride !== null || overview.aviatorIsManualTarget) && (
                    <span className="rounded-lg bg-amber-500/20 border border-amber-400/40 px-2.5 py-1 text-xs font-bold text-amber-200 tabular-nums">
                      LOCKED {overview.aviatorOverride ?? overview.aviatorCurrentTarget}x
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="1.01"
                    max="10000"
                    value={aviatorCrashInput}
                    onChange={(e) => setAviatorCrashInput(e.target.value)}
                    placeholder="Crash e.g. 1.25 or 5000"
                    className="flex-1 min-w-[160px] rounded-lg bg-[#070b14] border border-slate-700 px-3 py-2 text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleAviatorOverride({ crashPoint: aviatorCrashInput })}
                    className="rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950"
                  >
                    Save Live Crash
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[1.05, 1.25, 2.0, 10.0, 100.0, 1000.0, 5000.0].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => handleAviatorOverride({ crashPoint: String(v) })}
                      className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
                    >
                      {v >= 100 ? `${v}x` : `${v.toFixed(2)}x`}
                    </button>
                  ))}
                  {(overview.aviatorOverride !== null || overview.aviatorIsManualTarget) && (
                    <button
                      type="button"
                      onClick={() => handleAviatorOverride({ crashPoint: null })}
                      className="rounded-lg bg-rose-500/20 border border-rose-500/40 px-3 py-1.5 text-xs font-bold text-rose-300"
                    >
                      Clear Lock
                    </button>
                  )}
                </div>
              </div>

              {/* Separate Next Round Multiplier Section */}
              <div className="rounded-2xl bg-[#0d1424] border border-cyan-400/35 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-cyan-300">
                      2. Save Next Round Multiplier
                    </h2>
                    <p className="text-xs text-slate-400">
                      Queued crash point automatically applies on the very next flight (up to 10000x)
                    </p>
                  </div>
                  {overview.aviatorNextOverride ? (
                    <span className="rounded-lg bg-cyan-500/20 border border-cyan-400/40 px-2.5 py-1 text-xs font-bold text-cyan-200 tabular-nums">
                      SAVED {overview.aviatorNextOverride}x
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">Not queued</span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="1.01"
                    max="10000"
                    value={aviatorNextCrashInput}
                    onChange={(e) => setAviatorNextCrashInput(e.target.value)}
                    placeholder="Next crash e.g. 2.50 or 5000"
                    className="flex-1 min-w-[160px] rounded-lg bg-[#070b14] border border-slate-700 px-3 py-2 text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleAviatorOverride({ nextCrashPoint: aviatorNextCrashInput })}
                    className="rounded-lg bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950"
                  >
                    Save Next Round
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[1.15, 1.8, 5.0, 25.0, 100.0, 1000.0].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => handleAviatorOverride({ nextCrashPoint: String(v) })}
                      className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
                    >
                      {v >= 100 ? `${v}x` : `${v.toFixed(2)}x`}
                    </button>
                  ))}
                  {overview.aviatorNextOverride !== null && overview.aviatorNextOverride !== undefined && (
                    <button
                      type="button"
                      onClick={() => handleAviatorOverride({ nextCrashPoint: null })}
                      className="rounded-lg bg-rose-500/20 border border-rose-500/40 px-3 py-1.5 text-xs font-bold text-rose-300"
                    >
                      Clear Next ({overview.aviatorNextOverride}x)
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Live Players' Active Bets in Current Flight */}
            <div className="rounded-2xl bg-[#0d1424] border border-slate-800 p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">
                  Live Players in Current Flight ({overview.aviator.roundId})
                </span>
                <span className="text-slate-400">
                  {(overview.aviatorLiveBets || []).length} active/settled bets
                </span>
              </div>
              {(!overview.aviatorLiveBets || overview.aviatorLiveBets.length === 0) ? (
                <div className="py-3 text-center text-xs text-slate-500">
                  No real user bets placed in this flight yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-800 text-xs">
                  {overview.aviatorLiveBets.map((b) => (
                    <div key={b.id} className="flex items-center justify-between py-2">
                      <div>
                        <span className="font-bold text-white">{b.username}</span>{' '}
                        <span className="text-slate-400">({b.selection})</span>
                      </div>
                      <div className="flex items-center gap-3 tabular-nums">
                        <span className="text-amber-300 font-bold">₹{b.amount}</span>
                        <span
                          className={`font-bold uppercase ${
                            b.status === 'won'
                              ? 'text-emerald-400'
                              : b.status === 'lost'
                              ? 'text-rose-400'
                              : 'text-cyan-300'
                          }`}
                        >
                          {b.status === 'won'
                            ? `CASHED ${b.multiplier}x (+₹${b.payout.toFixed(2)})`
                            : b.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2B. MINES PRO (MAX 2025x) · MINES · DICE LIVE CONTROLS */}
        {tab === 'mines_dice' && overview && (
          <div className="space-y-4">
            {/* Mines Pro Live Engine Monitor & Controls */}
            <div className="rounded-2xl bg-[#0d1424] border border-amber-400/35 p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs text-slate-400">
                    Mines Pro (3 Mines · Max 2025x) · {overview.minesPro?.roundId || 'Loading...'}
                  </div>
                  <div className="mt-0.5 text-2xl font-extrabold tabular-nums text-white">
                    {overview.minesPro?.phase === 'betting' && (
                      <span className="text-emerald-300">
                        BETTING OPEN ({overview.minesPro.countdownSec}s)
                      </span>
                    )}
                    {overview.minesPro?.phase === 'flying' && (
                      <span className="text-amber-300">
                        CLIMBING LIVE · {overview.minesPro.multiplier.toFixed(2)}x
                      </span>
                    )}
                    {overview.minesPro?.phase === 'crashed' && (
                      <span className="text-rose-400">
                        BLASTED @ {Number(overview.minesPro.crashPoint || overview.minesPro.multiplier).toFixed(2)}x
                      </span>
                    )}
                  </div>
                </div>

                {overview.minesPro?.phase === 'flying' && (
                  <button
                    type="button"
                    onClick={() => handleMinesProOverride({ crashNow: true })}
                    className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-5 py-3 text-sm font-extrabold text-white shadow-lg hover:bg-rose-400 transition"
                  >
                    <Zap className="h-4 w-4" /> BLAST NOW ({overview.minesPro.multiplier.toFixed(2)}x)
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl bg-[#070b14] border border-amber-400/25 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300">
                      1. Mines Pro Live Lock (1.01x – 2025x)
                    </span>
                    {(overview.minesProOverride !== null && overview.minesProOverride !== undefined) ||
                    overview.minesProIsManualTarget ? (
                      <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold text-amber-200 tabular-nums">
                        LOCKED {overview.minesProOverride ?? overview.minesProCurrentTarget}x
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="number"
                      step="0.01"
                      min="1.01"
                      max="2025"
                      value={minesProCrashInput}
                      onChange={(e) => setMinesProCrashInput(e.target.value)}
                      placeholder="Blast e.g. 2.50 or 2025"
                      className="flex-1 min-w-[140px] rounded-lg bg-[#0d1424] border border-slate-700 px-3 py-2 text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={() => handleMinesProOverride({ crashPoint: minesProCrashInput })}
                      className="rounded-lg bg-amber-400 px-3.5 py-2 text-xs font-bold text-slate-950"
                    >
                      Save Live Blast
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[1.1, 2.0, 10.0, 50.0, 500.0, 2025.0].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => handleMinesProOverride({ crashPoint: String(v) })}
                        className="rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-700"
                      >
                        {v}x
                      </button>
                    ))}
                    {((overview.minesProOverride !== null && overview.minesProOverride !== undefined) ||
                      overview.minesProIsManualTarget) && (
                      <button
                        type="button"
                        onClick={() => handleMinesProOverride({ crashPoint: null })}
                        className="rounded-lg bg-rose-500/20 border border-rose-500/40 px-2.5 py-1 text-[11px] font-bold text-rose-300"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <div className="rounded-xl bg-[#070b14] border border-emerald-400/25 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300">
                      2. Save Next Mines Pro Round (1.01x – 2025x)
                    </span>
                    {overview.minesProNextOverride !== null && overview.minesProNextOverride !== undefined && (
                      <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-200 tabular-nums">
                        NEXT: {overview.minesProNextOverride}x
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="number"
                      step="0.01"
                      min="1.01"
                      max="2025"
                      value={minesProNextCrashInput}
                      onChange={(e) => setMinesProNextCrashInput(e.target.value)}
                      placeholder="Next round e.g. 5.00 or 2025"
                      className="flex-1 min-w-[140px] rounded-lg bg-[#0d1424] border border-slate-700 px-3 py-2 text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={() => handleMinesProOverride({ nextCrashPoint: minesProNextCrashInput })}
                      className="rounded-lg bg-emerald-400 px-3.5 py-2 text-xs font-bold text-slate-950"
                    >
                      Save Next Round
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[1.25, 3.0, 15.0, 100.0, 1000.0, 2025.0].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => handleMinesProOverride({ nextCrashPoint: String(v) })}
                        className="rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-700"
                      >
                        {v}x
                      </button>
                    ))}
                    {overview.minesProNextOverride !== null && overview.minesProNextOverride !== undefined && (
                      <button
                        type="button"
                        onClick={() => handleMinesProOverride({ nextCrashPoint: null })}
                        className="rounded-lg bg-rose-500/20 border border-rose-500/40 px-2.5 py-1 text-[11px] font-bold text-rose-300"
                      >
                        Clear Next
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Mines Controller */}
              <div className="rounded-2xl bg-[#0d1424] border border-emerald-400/30 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bomb className="h-5 w-5 text-emerald-400" />
                    <div>
                      <h2 className="text-base font-bold text-white">Mines Live Control</h2>
                      <p className="text-xs text-slate-400">
                        Active Mines Rounds: {overview.activeMinesCount ?? 0}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                      overview.minesForceNextBomb
                        ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
                        : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                    }`}
                  >
                    {overview.minesForceNextBomb ? 'BOMB ARMED' : 'FAIR RANDOM'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleMinesControl(true)}
                    className="rounded-xl bg-rose-500 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-rose-400 transition"
                  >
                    Force Bomb on Next Pick
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMinesControl(false)}
                    className="rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700 transition"
                  >
                    Reset Fair Mode
                  </button>
                </div>
              </div>

              {/* Dice Controller */}
              <div className="rounded-2xl bg-[#0d1424] border border-cyan-400/30 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Dices className="h-5 w-5 text-cyan-400" />
                    <div>
                      <h2 className="text-base font-bold text-white">Dice Live Control</h2>
                      <p className="text-xs text-slate-400">
                        Lock exact next roll (0.00–99.99) or force house win
                      </p>
                    </div>
                  </div>
                  {overview.diceNextOverride !== null && overview.diceNextOverride !== undefined ? (
                    <span className="rounded-lg bg-amber-500/20 border border-amber-400/40 px-2.5 py-1 text-xs font-bold text-amber-200 tabular-nums">
                      NEXT: {Number(overview.diceNextOverride).toFixed(2)}
                    </span>
                  ) : overview.diceForceLoss ? (
                    <span className="rounded-lg bg-rose-500/20 border border-rose-500/40 px-2.5 py-1 text-xs font-bold text-rose-300">
                      HOUSE WIN ARMED
                    </span>
                  ) : (
                    <span className="rounded-lg bg-cyan-500/20 border border-cyan-400/40 px-2.5 py-1 text-xs font-bold text-cyan-300">
                      FAIR RANDOM
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="99.99"
                    value={diceRollInput}
                    onChange={(e) => setDiceRollInput(e.target.value)}
                    placeholder="Next roll e.g. 12.34 or 88.50"
                    className="flex-1 min-w-[160px] rounded-lg bg-[#070b14] border border-slate-700 px-3 py-2 text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleDiceOverride({ nextRoll: diceRollInput })}
                    className="rounded-lg bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950"
                  >
                    Lock Next Roll
                  </button>
                  {overview.diceNextOverride !== null && overview.diceNextOverride !== undefined && (
                    <button
                      type="button"
                      onClick={() => handleDiceOverride({ nextRoll: null })}
                      className="rounded-lg bg-rose-500/20 border border-rose-500/40 px-3 py-2 text-xs font-bold text-rose-300"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleDiceOverride({ forceLoss: true })}
                    className="rounded-xl bg-rose-500 px-4 py-2 text-xs font-bold text-white hover:bg-rose-400"
                  >
                    Force Next Roll Loss
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDiceOverride({ forceLoss: false })}
                    className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700"
                  >
                    Reset Fair Rolls
                  </button>
                </div>
              </div>
            </div>

            {/* Recent Mines Pro, Mines & Dice Bets */}
            <div className="rounded-2xl bg-[#0d1424] border border-slate-800 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-3 py-3">Game</th>
                    <th className="px-3 py-3">Selection</th>
                    <th className="px-3 py-3">Result</th>
                    <th className="px-3 py-3 text-right">Stake</th>
                    <th className="px-3 py-3 text-right">Payout</th>
                    <th className="px-4 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {overview.recentBets
                    .filter((b) => b.game === 'mines_pro' || b.game === 'mines' || b.game === 'dice')
                    .map((b) => (
                      <tr key={b.id}>
                        <td className="px-4 py-2.5 font-semibold text-white">{b.username}</td>
                        <td className="px-3 py-2.5 uppercase font-bold text-cyan-300">
                          {b.game === 'mines_pro' ? 'Mines Pro' : b.game}
                        </td>
                        <td className="px-3 py-2.5 text-slate-200">{b.selection}</td>
                        <td className="px-3 py-2.5 text-slate-400">{b.resultText || '-'}</td>
                        <td className="px-3 py-2.5 text-right text-white tabular-nums">₹{b.amount}</td>
                        <td className="px-3 py-2.5 text-right text-white tabular-nums">
                          ₹{b.payout.toFixed(2)}
                        </td>
                        <td
                          className={`px-4 py-2.5 text-right font-bold uppercase ${
                            b.status === 'won'
                              ? 'text-emerald-400'
                              : b.status === 'lost'
                              ? 'text-rose-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {b.status}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2C. CHICKEN ROAD · VORTEX · TOWER RUSH · CRYSTAL LIVE CONTROLS */}
        {tab === 'new_games' && overview && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Chicken Road Controller */}
              <div className="rounded-2xl bg-[#0d1424] border border-orange-400/35 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-orange-300">Chicken Road Control</h2>
                    <p className="text-xs text-slate-400">
                      Active Runs: {overview.activeChickenCount ?? 0}
                    </p>
                  </div>
                  <span
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                      overview.chickenForceNextTrap
                        ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
                        : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                    }`}
                  >
                    {overview.chickenForceNextTrap ? 'TRAP ARMED' : 'FAIR ROAD'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleChickenControl(true)}
                    className="rounded-xl bg-rose-500 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-rose-400 transition"
                  >
                    Force Trap on Next Step
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChickenControl(false)}
                    className="rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700 transition"
                  >
                    Reset Fair Mode
                  </button>
                </div>
              </div>

              {/* Tower Rush Controller */}
              <div className="rounded-2xl bg-[#0d1424] border border-amber-400/35 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-amber-300" />
                    <div>
                      <h2 className="text-base font-bold text-amber-300">Tower Rush Live Control</h2>
                      <p className="text-xs text-slate-400">
                        Active Towers: {overview.activeTowerCount ?? 0} · Min ₹50–₹1,000
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                      overview.towerForceCollapse
                        ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
                        : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                    }`}
                  >
                    {overview.towerForceCollapse ? 'COLLAPSE ARMED' : 'FAIR STACK'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleTowerControl(true)}
                    className="rounded-xl bg-rose-500 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-rose-400 transition"
                  >
                    Force Collapse Next Floor
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTowerControl(false)}
                    className="rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700 transition"
                  >
                    Reset Fair Mode
                  </button>
                </div>
              </div>

              {/* Crystal Poker Controller */}
              <div className="rounded-2xl bg-[#0d1424] border border-fuchsia-400/35 p-5 space-y-4 md:col-span-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gem className="h-5 w-5 text-fuchsia-300" />
                    <div>
                      <h2 className="text-base font-bold text-white">Crystal Poker Control</h2>
                      <p className="text-xs text-slate-400">Next 5×3 cluster outcome</p>
                    </div>
                  </div>
                  <span
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold uppercase ${
                      overview.crystalMode === 'force_loss'
                        ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
                        : overview.crystalMode === 'force_win'
                        ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                        : 'bg-fuchsia-500/20 border border-fuchsia-400/40 text-fuchsia-300'
                    }`}
                  >
                    {overview.crystalMode || 'fair'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleCrystalOverride('force_win')}
                    className="rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400"
                  >
                    Guarantee Win
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCrystalOverride('force_loss')}
                    className="rounded-xl bg-rose-500 px-3.5 py-2 text-xs font-bold text-white hover:bg-rose-400"
                  >
                    Force Loss
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCrystalOverride('fair')}
                    className="rounded-xl bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700"
                  >
                    Reset Fair
                  </button>
                </div>
              </div>
            </div>

            {/* Recent Chicken Road, Tower Rush & Crystal Bets */}
            <div className="rounded-2xl bg-[#0d1424] border border-slate-800 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-3 py-3">Game</th>
                    <th className="px-3 py-3">Selection</th>
                    <th className="px-3 py-3">Result</th>
                    <th className="px-3 py-3 text-right">Stake</th>
                    <th className="px-3 py-3 text-right">Payout</th>
                    <th className="px-4 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {overview.recentBets
                    .filter(
                      (b) =>
                        b.game === 'chicken_road' ||
                        b.game === 'crystal' ||
                        b.game === 'tower_rush'
                    )
                    .map((b) => (
                      <tr key={b.id}>
                        <td className="px-4 py-2.5 font-semibold text-white">{b.username}</td>
                        <td className="px-3 py-2.5 uppercase font-bold text-fuchsia-300">
                          {b.game === 'chicken_road'
                            ? 'Chicken Road'
                            : b.game === 'tower_rush'
                            ? 'Tower Rush'
                            : 'Crystal Poker'}
                        </td>
                        <td className="px-3 py-2.5 text-slate-200">{b.selection}</td>
                        <td className="px-3 py-2.5 text-slate-400">{b.resultText || '-'}</td>
                        <td className="px-3 py-2.5 text-right text-white tabular-nums">₹{b.amount}</td>
                        <td className="px-3 py-2.5 text-right text-white tabular-nums">
                          ₹{b.payout.toFixed(2)}
                        </td>
                        <td
                          className={`px-4 py-2.5 text-right font-bold uppercase ${
                            b.status === 'won'
                              ? 'text-emerald-400'
                              : b.status === 'lost'
                              ? 'text-rose-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {b.status}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2D. LIVE PER-GAME WIN/LOSS RATIO CONTROL (DEMO ~9W/1L VS REAL 6W/4L · 4W/6L) */}
        {tab === 'ratios' && overview && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-[#0d1424] border border-cyan-500/35 p-4 text-xs space-y-1">
              <div className="font-bold text-cyan-300 text-sm">
                Live Per-Game Win / Loss Ratio Controller
              </div>
              <p className="text-slate-300">
                <strong>Demo Login Users</strong> automatically receive ~9 Wins / 1 Rare Loss across all games.{' '}
                <strong>Real Logged-In Users</strong> follow each game&apos;s selected 10-round ratio below (changes apply live immediately).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { id: 'wingo', label: 'WinGo (30s · 1m · 3m)' },
                { id: 'aviator', label: 'Aviator Crash' },
                { id: 'mines_pro', label: 'Mines Pro' },
                { id: 'mines', label: 'Mines Vault' },
                { id: 'dice', label: 'Classic Dice' },
                { id: 'chicken_road', label: 'Chicken Road' },
                { id: 'crystal', label: 'Crystal Poker' },
                { id: 'tower_rush', label: 'Tower Rush' },
              ].map((g) => {
                const currentMode: GameOutcomeMode =
                  overview.platformConfig?.gameModes?.[g.id] || '4w6l';
                return (
                  <div
                    key={g.id}
                    className="rounded-2xl bg-[#0d1424] border border-slate-800 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-sm text-white">{g.label}</div>
                      <span
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase ${
                          currentMode === '6w4l' || currentMode === 'force_win'
                            ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-300'
                            : currentMode === '4w6l' || currentMode === 'force_loss'
                            ? 'bg-amber-500/20 border border-amber-400/40 text-amber-300'
                            : 'bg-cyan-500/20 border border-cyan-400/40 text-cyan-300'
                        }`}
                      >
                        {currentMode === '6w4l'
                          ? '6 WIN / 4 LOSS'
                          : currentMode === '4w6l'
                          ? '4 WIN / 6 LOSS'
                          : currentMode === 'force_win'
                          ? 'ALWAYS WIN'
                          : currentMode === 'force_loss'
                          ? 'ALWAYS LOSS'
                          : 'FAIR'}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          { id: '6w4l', text: '6 Win / 4 Loss' },
                          { id: '4w6l', text: '4 Win / 6 Loss' },
                          { id: 'force_win', text: 'Force Win' },
                          { id: 'force_loss', text: 'Force Loss' },
                          { id: 'fair', text: 'Fair' },
                        ] as { id: GameOutcomeMode; text: string }[]
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleGameModeChange(g.id, opt.id)}
                          className={`rounded-lg px-3 py-1.5 text-[11px] font-bold border transition ${
                            currentMode === opt.id
                              ? 'bg-amber-400 text-slate-950 border-amber-300'
                              : 'bg-[#070b14] text-slate-200 border-slate-700 hover:bg-slate-800'
                          }`}
                        >
                          {opt.text}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. DEPOSITS & UTR + SCREENSHOT VERIFICATION */}
        {tab === 'deposits' && overview && (
          <div className="rounded-2xl bg-[#0d1424] border border-slate-800 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">
                  Deposit Requests, UTR Check &amp; Payment Screenshots
                </h2>
                <p className="text-[11px] text-slate-400">
                  Fake/duplicate UTRs are blocked automatically; verify screenshot + UTR before approving.
                </p>
              </div>
              <span className="rounded-lg bg-amber-500/15 border border-amber-400/30 px-2.5 py-1 text-xs font-bold text-amber-300">
                {pendingDeposits.length} Processing
              </span>
            </div>

            {pendingDeposits.length > 0 && (
              <div className="divide-y divide-slate-800 border-b border-slate-700 pb-3">
                {pendingDeposits.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">
                          DEPOSIT · PROCESSING
                        </span>
                        <span className="text-sm font-bold text-white">
                          {tx.username} ({tx.mobile})
                        </span>
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                          User ID: {tx.userId}
                        </span>
                        {tx.utrFlag && (
                          <span className="inline-flex items-center gap-1 rounded bg-rose-500/20 border border-rose-400/40 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                            <AlertTriangle className="h-3 w-3" /> {tx.utrFlag}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-slate-300">
                        Process ID: <strong className="text-white">{tx.id}</strong> · {tx.method} ·{' '}
                        <strong className="text-cyan-300">UTR: {tx.reference || 'N/A'}</strong>
                        {tx.pendingBonus ? ` · +₹${tx.pendingBonus} Bank Bonus` : ''}
                      </div>
                      {tx.screenshotData ? (
                        <button
                          type="button"
                          onClick={() => setPreviewImage(tx.screenshotData || null)}
                          className="mt-2 block"
                        >
                          <img
                            src={tx.screenshotData}
                            alt="Deposit payment proof"
                            className="h-24 rounded-lg border border-slate-700 object-contain hover:border-cyan-400"
                          />
                        </button>
                      ) : (
                        <div className="mt-1 text-[11px] font-bold text-rose-400">
                          Warning: No Screenshot Attached
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-white mr-2 tabular-nums">
                        ₹{tx.amount.toFixed(2)}
                      </span>
                      <button
                        onClick={() => handleTxReview(tx.id, 'approve')}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => handleTxReview(tx.id, 'reject')}
                        className="inline-flex items-center gap-1 rounded-lg bg-rose-500/20 border border-rose-500/40 px-3 py-1.5 text-xs font-bold text-rose-300"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Fake / Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="divide-y divide-slate-800">
              {depositHistory.slice(0, 40).map((tx) => (
                <div
                  key={tx.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 font-bold text-white uppercase">
                      <span>
                        {tx.username} ({tx.mobile})
                      </span>
                      <span className="text-cyan-300">User ID: {tx.userId}</span>
                      {tx.utrFlag && (
                        <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] text-rose-300">
                          {tx.utrFlag}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-300">
                      Process ID: {tx.id} · {tx.method} · UTR: {tx.reference || 'N/A'}
                    </div>
                    {tx.screenshotData && (
                      <button
                        type="button"
                        onClick={() => setPreviewImage(tx.screenshotData || null)}
                        className="mt-1 inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#070b14] p-1.5 hover:border-cyan-400"
                      >
                        <img
                          src={tx.screenshotData}
                          alt="Deposit payment screenshot"
                          className="h-14 w-14 rounded object-cover"
                        />
                        <span className="text-[11px] font-semibold text-cyan-300">
                          View Screenshot
                        </span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <div className="text-right tabular-nums">
                      <div className="text-sm font-bold text-white">₹{tx.amount.toFixed(2)}</div>
                      <div
                        className={`text-[10px] font-bold uppercase ${
                          tx.status === 'rejected'
                            ? 'text-rose-400'
                            : tx.status === 'pending'
                            ? 'text-amber-300'
                            : 'text-emerald-400'
                        }`}
                      >
                        {tx.status === 'pending' ? 'PROCESSING' : tx.status}
                      </div>
                    </div>
                    {tx.status === 'approved' && (
                      <button
                        onClick={() => handleTxReview(tx.id, 'reject')}
                        className="rounded-lg bg-rose-500/20 border border-rose-500/40 px-2.5 py-1.5 text-[11px] font-bold text-rose-300 hover:bg-rose-500/30"
                      >
                        Reject
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. DEDICATED WITHDRAWALS SECTION */}
        {tab === 'withdrawals' && overview && (
          <div className="rounded-2xl bg-[#0d1424] border border-slate-800 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">
                Withdrawal Requests &amp; Payout Verification
              </h2>
              <span className="rounded-lg bg-amber-500/15 border border-amber-400/30 px-2.5 py-1 text-xs font-bold text-amber-300">
                {pendingWithdrawals.length} Pending
              </span>
            </div>

            {pendingWithdrawals.length > 0 && (
              <div className="divide-y divide-slate-800 border-b border-slate-700 pb-3">
                {pendingWithdrawals.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">
                          WITHDRAWAL · PROCESSING
                        </span>
                        <span className="text-sm font-bold text-white">
                          {tx.username} ({tx.mobile})
                        </span>
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                          User ID: {tx.userId}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-300">
                        Process ID: <strong className="text-white">{tx.id}</strong> · {tx.method} ·{' '}
                        <strong className="text-emerald-300">{tx.accountDetail}</strong>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-white mr-2 tabular-nums">
                        ₹{tx.amount.toFixed(2)}
                      </span>
                      <button
                        onClick={() => handleTxReview(tx.id, 'approve')}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => handleTxReview(tx.id, 'reject')}
                        className="inline-flex items-center gap-1 rounded-lg bg-rose-500/20 border border-rose-500/40 px-3 py-1.5 text-xs font-bold text-rose-300"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="divide-y divide-slate-800">
              {withdrawalHistory.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500">
                  No withdrawals submitted yet.
                </div>
              ) : (
                withdrawalHistory.slice(0, 40).map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between gap-3 py-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-white uppercase">
                        {tx.username} ({tx.mobile}) · <span className="text-cyan-300">{tx.userId}</span>
                      </div>
                      <div className="text-[11px] text-slate-300">
                        Process ID: {tx.id} · {tx.method} · {tx.accountDetail}
                      </div>
                    </div>
                    <div className="text-right tabular-nums">
                      <div className="text-sm font-bold text-white">₹{tx.amount.toFixed(2)}</div>
                      <div
                        className={`text-[10px] font-bold uppercase ${
                          tx.status === 'rejected'
                            ? 'text-rose-400'
                            : tx.status === 'pending'
                            ? 'text-amber-300'
                            : 'text-emerald-400'
                        }`}
                      >
                        {tx.status === 'pending' ? 'PROCESSING' : tx.status}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 5. SEPARATE MULTI-ACCOUNT DEPOSIT SETUP: 2 UPI/QR + 3 BANK ACCOUNTS */}
        {tab === 'accounts' && (
          <div className="space-y-5">
          <form onSubmit={handleSavePlatformConfig} className="space-y-5">
            {/* 2 UPI IDs + QR IMAGE UPLOAD */}
            <div className="rounded-2xl bg-[#0d1424] border border-cyan-500/35 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-cyan-300" />
                <div>
                  <h2 className="text-base font-bold text-white">
                    Official UPI IDs &amp; QR Code Upload (2 Slots)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Upload custom QR Code image or enter UPI ID. Saves and pushes live into User App Deposit screen immediately.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {upiSlots.map((slot, idx) => (
                  <div
                    key={slot.id}
                    className="rounded-xl bg-[#070b14] border border-slate-800 p-4 space-y-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-cyan-300">{slot.label}</span>
                      <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={slot.enabled}
                          disabled={idx === 0}
                          onChange={(e) =>
                            setUpiSlots((prev) =>
                              prev.map((s, i) =>
                                i === idx ? { ...s, enabled: e.target.checked } : s
                              )
                            )
                          }
                          className="accent-cyan-400"
                        />
                        <span>{idx === 0 ? 'Always Active' : slot.enabled ? 'Active' : 'Disabled'}</span>
                      </label>
                    </div>

                    <div>
                      <label className="mb-1 block font-semibold text-slate-300">Label</label>
                      <input
                        type="text"
                        value={slot.label}
                        onChange={(e) =>
                          setUpiSlots((prev) =>
                            prev.map((s, i) => (i === idx ? { ...s, label: e.target.value } : s))
                          )
                        }
                        className="w-full rounded-lg bg-[#0d1424] border border-slate-700 px-3 py-2 text-white"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block font-semibold text-slate-300">UPI ID</label>
                      <input
                        type="text"
                        value={slot.upiId}
                        onChange={(e) =>
                          setUpiSlots((prev) =>
                            prev.map((s, i) => (i === idx ? { ...s, upiId: e.target.value } : s))
                          )
                        }
                        placeholder="e.g. merchant@ybl"
                        className="w-full rounded-lg bg-[#0d1424] border border-slate-700 px-3 py-2 text-white"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block font-semibold text-slate-300">
                        Upload QR Code Image (Optional — overrides auto QR)
                      </label>
                      <div className="flex items-center gap-2">
                        <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-cyan-400/50 bg-[#0d1424] px-3 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/10">
                          <ImagePlus className="h-4 w-4" />
                          <span>{slot.qrImageData ? 'Change QR Image' : 'Upload QR Image'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleQrUpload(idx, e)}
                            className="hidden"
                          />
                        </label>
                        {slot.qrImageData && (
                          <button
                            type="button"
                            onClick={() =>
                              setUpiSlots((prev) =>
                                prev.map((s, i) =>
                                  i === idx ? { ...s, qrImageData: undefined } : s
                                )
                              )
                            }
                            className="rounded-lg bg-rose-500/20 border border-rose-500/40 p-2 text-rose-300"
                            title="Remove custom QR image"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      {slot.qrImageData && (
                        <img
                          src={slot.qrImageData}
                          alt={`${slot.label} QR`}
                          className="h-28 w-28 rounded-lg border border-slate-700 bg-white p-1 object-contain"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3 BANK ACCOUNT SLOTS */}
            <div className="rounded-2xl bg-[#0d1424] border border-emerald-500/35 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-emerald-300" />
                <div>
                  <h2 className="text-base font-bold text-white">
                    Official Bank Accounts for Deposit (3 Slots)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Add up to 3 Bank Accounts. Enabled accounts appear live in the User App Deposit Bank tab.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {bankSlots.map((slot, idx) => (
                  <div
                    key={slot.id}
                    className="rounded-xl bg-[#070b14] border border-slate-800 p-4 space-y-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-300">Bank Account #{idx + 1}</span>
                      <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={slot.enabled}
                          disabled={idx === 0}
                          onChange={(e) =>
                            setBankSlots((prev) =>
                              prev.map((b, i) =>
                                i === idx ? { ...b, enabled: e.target.checked } : b
                              )
                            )
                          }
                          className="accent-emerald-400"
                        />
                        <span>{idx === 0 ? 'Always Active' : slot.enabled ? 'Active' : 'Disabled'}</span>
                      </label>
                    </div>

                    <div>
                      <label className="mb-1 block text-slate-400">Tab Label</label>
                      <input
                        type="text"
                        value={slot.label}
                        onChange={(e) =>
                          setBankSlots((prev) =>
                            prev.map((b, i) => (i === idx ? { ...b, label: e.target.value } : b))
                          )
                        }
                        className="w-full rounded-lg bg-[#0d1424] border border-slate-700 px-3 py-1.5 text-white"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-slate-400">Account Holder Name</label>
                      <input
                        type="text"
                        value={slot.bankHolder}
                        onChange={(e) =>
                          setBankSlots((prev) =>
                            prev.map((b, i) =>
                              i === idx ? { ...b, bankHolder: e.target.value } : b
                            )
                          )
                        }
                        placeholder="Holder full name"
                        className="w-full rounded-lg bg-[#0d1424] border border-slate-700 px-3 py-1.5 text-white"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-slate-400">Bank Name</label>
                      <input
                        type="text"
                        value={slot.bankName}
                        onChange={(e) =>
                          setBankSlots((prev) =>
                            prev.map((b, i) => (i === idx ? { ...b, bankName: e.target.value } : b))
                          )
                        }
                        placeholder="e.g. SBI / HDFC"
                        className="w-full rounded-lg bg-[#0d1424] border border-slate-700 px-3 py-1.5 text-white"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-slate-400">Account Number</label>
                      <input
                        type="text"
                        value={slot.bankAccountNumber}
                        onChange={(e) =>
                          setBankSlots((prev) =>
                            prev.map((b, i) =>
                              i === idx ? { ...b, bankAccountNumber: e.target.value } : b
                            )
                          )
                        }
                        placeholder="Enter A/C number"
                        className="w-full rounded-lg bg-[#0d1424] border border-slate-700 px-3 py-1.5 text-white"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-slate-400">IFSC Code</label>
                      <input
                        type="text"
                        value={slot.bankIfsc}
                        onChange={(e) =>
                          setBankSlots((prev) =>
                            prev.map((b, i) =>
                              i === idx
                                ? { ...b, bankIfsc: e.target.value.toUpperCase() }
                                : b
                            )
                          )
                        }
                        placeholder="e.g. SBIN0001234"
                        className="w-full rounded-lg bg-[#0d1424] border border-slate-700 px-3 py-1.5 text-white uppercase"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Extra Live User App Controls & Game Toggles */}
            <div className="rounded-2xl bg-[#0d1424] border border-cyan-500/35 p-5 space-y-4 text-xs">
              <div>
                <h2 className="text-sm font-bold text-cyan-300">
                  User App Live Controls &amp; Game Visibility
                </h2>
                <p className="text-[11px] text-slate-400">
                  Modify User App branding, Bank deposit bonus %, WhatsApp deposit link, or enable/disable games live.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block font-semibold text-slate-300">
                    User App Title / Brand
                  </label>
                  <input
                    type="text"
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    placeholder="AD78"
                    className="w-full rounded-lg bg-[#070b14] border border-slate-700 px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-300">
                    Bank Deposit Bonus % (0–25)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="25"
                    step="1"
                    value={bankBonusPercent}
                    onChange={(e) => setBankBonusPercent(e.target.value)}
                    className="w-full rounded-lg bg-[#070b14] border border-slate-700 px-3 py-2 text-white tabular-nums"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-300">
                    WhatsApp Deposit URL
                  </label>
                  <input
                    type="url"
                    value={supportWhatsappUrl}
                    onChange={(e) => setSupportWhatsappUrl(e.target.value)}
                    placeholder="https://wa.me/91..."
                    className="w-full rounded-lg bg-[#070b14] border border-slate-700 px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="font-semibold text-slate-300">
                  Game Live Status (Click to Toggle Maintenance / Active)
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'wingo', label: 'WinGo' },
                    { id: 'aviator', label: 'Aviator' },
                    { id: 'mines_pro', label: 'Mines Pro' },
                    { id: 'mines', label: 'Mines' },
                    { id: 'dice', label: 'Dice' },
                    { id: 'chicken_road', label: 'Chicken Road' },
                    { id: 'crystal', label: 'Crystal Poker' },
                    { id: 'tower_rush', label: 'Tower Rush' },
                  ].map((g) => {
                    const isDisabled = disabledGames.includes(g.id);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() =>
                          setDisabledGames((prev) =>
                            prev.includes(g.id) ? prev.filter((x) => x !== g.id) : [...prev, g.id]
                          )
                        }
                        className={`rounded-lg px-3 py-1.5 text-[11px] font-bold border transition ${
                          isDisabled
                            ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                            : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        }`}
                      >
                        {g.label}: {isDisabled ? 'DISABLED' : 'LIVE'}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Live App Notice & Publish Button */}
            <div className="rounded-2xl bg-[#0d1424] border border-slate-800 p-5 space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-semibold text-slate-300">
                  Live App Announcement Notice (Optional)
                </label>
                <input
                  type="text"
                  value={noticeText}
                  onChange={(e) => setNoticeText(e.target.value)}
                  placeholder="Optional notice banner inside User App (leave blank for none)"
                  className="w-full rounded-lg bg-[#070b14] border border-slate-700 px-3 py-2 text-white"
                />
              </div>

              <button
                type="submit"
                disabled={savingCfg}
                className="rounded-xl bg-amber-400 px-6 py-3 text-xs font-extrabold text-slate-950 hover:bg-amber-300 transition"
              >
                {savingCfg ? 'Pushing Live Update...' : 'Save & Push Live to All User Apps & APKs'}
              </button>
            </div>
          </form>

          {/* Hidden Admin User ID & Password Change Section */}
          <form
            onSubmit={handleChangeAdminCredentials}
            autoComplete="off"
            className="rounded-2xl bg-[#0d1424] border border-rose-500/35 p-5 space-y-3 text-xs"
          >
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-rose-400" />
              <div>
                <h3 className="text-sm font-bold text-white">
                  Update Hidden Admin User ID &amp; Password
                </h3>
                <p className="text-[11px] text-slate-400">
                  Credentials remain strictly masked and hashed — verify current ID &amp; Password to rotate.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-slate-300">Current Admin User ID</label>
                <input
                  type="password"
                  value={curAdminId}
                  onChange={(e) => setCurAdminId(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="off"
                  className="w-full rounded-lg bg-[#070b14] border border-slate-700 px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-300">Current Admin Password</label>
                <input
                  type="password"
                  value={curAdminPass}
                  onChange={(e) => setCurAdminPass(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="off"
                  className="w-full rounded-lg bg-[#070b14] border border-slate-700 px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-300">New Admin User ID</label>
                <input
                  type="password"
                  value={newAdminId}
                  onChange={(e) => setNewAdminId(e.target.value)}
                  placeholder="4-32 chars"
                  required
                  autoComplete="new-password"
                  className="w-full rounded-lg bg-[#070b14] border border-slate-700 px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-300">New Admin Password</label>
                <input
                  type="password"
                  value={newAdminPass}
                  onChange={(e) => setNewAdminPass(e.target.value)}
                  placeholder="Min 6 chars"
                  required
                  autoComplete="new-password"
                  className="w-full rounded-lg bg-[#070b14] border border-slate-700 px-3 py-2 text-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={credBusy}
              className="rounded-xl bg-rose-500 px-5 py-2.5 text-xs font-extrabold text-white hover:bg-rose-400 transition disabled:opacity-60"
            >
              {credBusy ? 'Updating Credentials...' : 'Rotate Admin ID & Password'}
            </button>
          </form>
          </div>
        )}

        {/* 6. SUPPORT TICKETS + PASSWORD RESET OPTION */}
        {tab === 'support' && overview && (
          <div className="rounded-2xl bg-[#0d1424] border border-slate-800 p-4 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-white">
                24×7 Support Tickets, Account Details &amp; Password Reset
              </h2>
              <p className="text-[11px] text-slate-400">
                Shows matched user Name, Mobile, User ID, and Current Password with direct Password Reset back to the user.
              </p>
            </div>
            {overview.supportTickets.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                No support complaints registered yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {overview.supportTickets.map((t) => {
                  const matched =
                    t.matchedUser ||
                    overview.users.find(
                      (u) =>
                        (t.userId && u.id === t.userId) ||
                        u.mobile === t.mobile ||
                        u.username.toLowerCase() === (t.contactName || '').trim().toLowerCase()
                    );

                  return (
                    <div key={t.id} className="py-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="text-xs font-bold text-amber-300">{t.id}</span>
                          <span className="ml-2 text-sm font-bold text-white">
                            {t.contactName} ({t.mobile})
                          </span>
                          <span className="ml-2 rounded bg-slate-800 px-2 py-0.5 text-[11px] text-cyan-300">
                            {t.category}
                          </span>
                        </div>
                        <span
                          className={`text-xs font-bold uppercase ${
                            t.status === 'resolved' ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {t.status}
                        </span>
                      </div>

                      {/* Matched Registered User Info (Name, Mobile, User ID, Current Password) */}
                      <div className="rounded-xl bg-[#070b14] border border-slate-800 px-3 py-2.5 text-xs flex flex-wrap items-center gap-x-4 gap-y-1">
                        {matched ? (
                          <>
                            <span>
                              <span className="text-slate-400">Username/Name:</span>{' '}
                              <strong className="text-white">{matched.username}</strong>
                            </span>
                            <span>
                              <span className="text-slate-400">User ID:</span>{' '}
                              <strong className="text-cyan-300">{matched.id}</strong>
                            </span>
                            <span>
                              <span className="text-slate-400">Mobile:</span>{' '}
                              <strong className="text-cyan-300">{matched.mobile}</strong>
                            </span>
                            <span>
                              <span className="text-slate-400">Current Password:</span>{' '}
                              <strong className="rounded bg-amber-500/15 border border-amber-400/30 px-2 py-0.5 font-mono text-amber-200">
                                {matched.visiblePassword || 'Reset below'}
                              </strong>
                            </span>
                            <span>
                              <span className="text-slate-400">Balance:</span>{' '}
                              <strong className="text-emerald-300">₹{matched.balance.toFixed(2)}</strong>
                            </span>
                          </>
                        ) : (
                          <span className="text-rose-300">
                            No registered account found for Mobile {t.mobile} / Name {t.contactName}.
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-300">{t.message}</p>

                      {t.screenshotData && (
                        <img
                          src={t.screenshotData}
                          alt="Complaint screenshot"
                          className="max-h-56 rounded-xl border border-slate-700 object-contain"
                        />
                      )}

                      {/* Direct Password Reset Option via 24x7 Support */}
                      {matched && (
                        <div className="rounded-xl bg-[#091527] border border-cyan-500/30 p-3 space-y-2">
                          <div className="text-[11px] font-bold text-cyan-300">
                            Reset Password Option (Sends New Password directly to User&apos;s 24×7 Support)
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <input
                              type="text"
                              value={ticketPassInputs[t.id] || ''}
                              onChange={(e) =>
                                setTicketPassInputs((p) => ({ ...p, [t.id]: e.target.value }))
                              }
                              placeholder="New Password (e.g. ad78pass9)"
                              className="flex-1 min-w-[180px] rounded-lg bg-[#070b14] border border-slate-700 px-3 py-1.5 text-xs text-white"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const autoPass = `ad78${Math.floor(1000 + Math.random() * 9000)}`;
                                setTicketPassInputs((p) => ({ ...p, [t.id]: autoPass }));
                              }}
                              className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                            >
                              Auto Generate
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSupportPasswordReset(t.id)}
                              className="rounded-lg bg-cyan-400 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-cyan-300"
                            >
                              Reset Password &amp; Send
                            </button>
                          </div>
                        </div>
                      )}

                      {t.status === 'open' ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={replyInputs[t.id] || ''}
                            onChange={(e) =>
                              setReplyInputs((p) => ({ ...p, [t.id]: e.target.value }))
                            }
                            placeholder="Write general support reply to resolve ticket..."
                            className="flex-1 rounded-lg bg-[#070b14] border border-slate-700 px-3 py-1.5 text-xs text-white"
                          />
                          <button
                            onClick={() => handleSupportReply(t.id)}
                            className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950"
                          >
                            Resolve
                          </button>
                        </div>
                      ) : (
                        t.adminReply && (
                          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-xs text-emerald-300">
                            Reply Sent: {t.adminReply}
                          </div>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 7. USERS */}
        {tab === 'users' && overview && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#0d1424] border border-slate-800 p-3">
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search user by username, mobile number, or AD78U ID..."
                className="flex-1 min-w-[220px] rounded-xl bg-[#070b14] border border-slate-700 px-3.5 py-2 text-xs text-white"
              />
              <span className="text-xs font-semibold text-slate-400 px-2">
                Total Users: {overview.users.length}
              </span>
            </div>

            <div className="rounded-2xl bg-[#0d1424] border border-slate-800 divide-y divide-slate-800">
              {overview.users
                .filter((u) => {
                  const q = userSearch.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    u.username.toLowerCase().includes(q) ||
                    u.mobile.includes(q) ||
                    u.id.toLowerCase().includes(q)
                  );
                })
                .map((u) => (
                  <div
                    key={u.id}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-white">{u.username}</span>
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                          {u.id}
                        </span>
                        <span className="text-xs text-cyan-300">{u.mobile}</span>
                        <span className="rounded bg-amber-500/15 border border-amber-400/30 px-2 py-0.5 text-[11px] font-mono font-bold text-amber-200">
                          Pass: {u.visiblePassword || 'Set below'}
                        </span>
                        {u.isFrozen && (
                          <span className="rounded bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                            FROZEN
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-white font-semibold tabular-nums">
                        Balance: ₹{u.balance.toFixed(2)}
                      </div>
                      {u.savedUpiId && (
                        <div className="mt-0.5 text-[11px] text-cyan-300">
                          Saved UPI: {u.savedUpiId}
                        </div>
                      )}
                      {u.bankAccount && (
                        <div className="mt-0.5 text-[11px] text-slate-400">
                          Bank: {u.bankAccount.accountHolder} · {u.bankAccount.accountNumber} (
                          {u.bankAccount.ifsc})
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        placeholder="Amount ₹"
                        value={balanceEdits[u.id] || ''}
                        onChange={(e) =>
                          setBalanceEdits((p) => ({ ...p, [u.id]: e.target.value }))
                        }
                        className="w-28 rounded-lg bg-[#070b14] border border-slate-700 px-2.5 py-1.5 text-xs text-white"
                      />
                      <button
                        onClick={() => handleAdjustBalance(u.id, 1)}
                        className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950"
                      >
                        + Credit
                      </button>
                      <button
                        onClick={() => handleAdjustBalance(u.id, -1)}
                        className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-bold text-white"
                      >
                        - Debit
                      </button>
                      <button
                        onClick={() => handleToggleFreeze(u)}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200"
                      >
                        {u.isFrozen ? (
                          <Unlock className="h-3.5 w-3.5" />
                        ) : (
                          <Lock className="h-3.5 w-3.5" />
                        )}
                        <span>{u.isFrozen ? 'Unfreeze' : 'Freeze'}</span>
                      </button>
                      <input
                        type="text"
                        placeholder="New pass (e.g. ad78new)"
                        value={newPassEdits[u.id] || ''}
                        onChange={(e) =>
                          setNewPassEdits((p) => ({ ...p, [u.id]: e.target.value }))
                        }
                        className="w-36 rounded-lg bg-[#070b14] border border-slate-700 px-2.5 py-1.5 text-xs text-white"
                      />
                      <button
                        onClick={() => handleResetUserPassword(u)}
                        className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-bold text-slate-950"
                      >
                        Set Pass
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* 8. ALL LIVE BETS */}
        {tab === 'bets' && overview && (
          <div className="rounded-2xl bg-[#0d1424] border border-slate-800 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-3 py-3">Game</th>
                  <th className="px-3 py-3">Selection</th>
                  <th className="px-3 py-3 text-right">Stake</th>
                  <th className="px-3 py-3 text-right">Payout</th>
                  <th className="px-4 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {overview.recentBets.map((b) => (
                  <tr key={b.id}>
                    <td className="px-4 py-2.5 font-semibold text-white">{b.username}</td>
                    <td className="px-3 py-2.5 uppercase text-slate-300">
                      {b.game.replace('_', ' ')} {b.mode || ''}
                    </td>
                    <td className="px-3 py-2.5 text-cyan-300 uppercase">{b.selection}</td>
                    <td className="px-3 py-2.5 text-right text-white tabular-nums">₹{b.amount}</td>
                    <td className="px-3 py-2.5 text-right text-white tabular-nums">
                      ₹{b.payout.toFixed(2)}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-bold uppercase ${
                        b.status === 'won'
                          ? 'text-emerald-400'
                          : b.status === 'lost'
                          ? 'text-rose-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {b.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Full-Size Screenshot Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-lg w-full rounded-2xl bg-[#0d1424] border border-slate-700 p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute right-3 top-3 rounded-full bg-slate-800 p-1.5 text-white hover:bg-slate-700"
              aria-label="Close image preview"
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={previewImage}
              alt="Full payment screenshot"
              className="max-h-[80vh] w-full rounded-xl object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
};
