import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket, WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

type WingoMode = '30s' | '1m' | '3m';
type WingoColor = 'green' | 'red' | 'violet';
type AviatorPhase = 'betting' | 'flying' | 'crashed';
type GameOutcomeMode = '6w4l' | '4w6l' | 'fair' | 'force_win' | 'force_loss';

interface BankAccount {
  accountHolder: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
}

interface WingoRound {
  periodId: string;
  mode: WingoMode;
  number: number;
  colors: WingoColor[];
  size: 'big' | 'small';
  timestamp: number;
}

interface StoredUser {
  id: string;
  username: string;
  mobile: string;
  passwordHash: string;
  adminVisiblePassword?: string;
  balance: number;
  bonusBalance: number;
  referralCode: string;
  createdAt: number;
  isFrozen: boolean;
  isDemo?: boolean;
  playCycle?: boolean[];
  demoCycle?: boolean[];
  gameCycles?: Record<string, boolean[]>;
  gameCycleModes?: Record<string, GameOutcomeMode>;
  stakePresets: number[];
  savedUpiId?: string;
  bankAccount?: BankAccount;
}

interface BetRecord {
  id: string;
  userId: string;
  username: string;
  game: 'wingo' | 'aviator' | 'mines_pro' | 'mines' | 'dice' | 'chicken_road' | 'vertex' | 'crystal' | 'tower_rush' | 'money_coming';
  mode?: WingoMode;
  periodId?: string;
  slot?: 1 | 2;
  selectionType?: 'color' | 'size' | 'number';
  selection: string;
  amount: number;
  multiplier: number;
  payout: number;
  profit: number;
  status: 'pending' | 'won' | 'lost';
  resultText?: string;
  createdAt: number;
  settledAt?: number;
}

interface MinesSession {
  id: string;
  betId: string;
  userId: string;
  username: string;
  stake: number;
  minesCount: number;
  mines: number[];
  revealed: number[];
  multiplier: number;
  shouldWinRound?: boolean;
  lossPickIndex?: number;
  status: 'active' | 'won' | 'lost';
  createdAt: number;
}

type ChickenDifficulty = 'easy' | 'medium' | 'hard';

interface ChickenRoadSession {
  id: string;
  betId: string;
  userId: string;
  username: string;
  stake: number;
  difficulty: ChickenDifficulty;
  currentLane: number;
  totalLanes: number;
  multipliers: number[];
  trapLanes: number[]; // indices 0..totalLanes-1 that will lose on step
  status: 'active' | 'won' | 'lost';
  hitLane?: number | null;
  createdAt: number;
}

interface TowerRushSession {
  id: string;
  betId: string;
  userId: string;
  username: string;
  stake: number;
  floors: number;
  maxFloors: number;
  multipliers: number[];
  collapseOnFloor: number | null; // null = safe run (Demo or 4/10 win cycle), 1 or 2 = collapse floor (6/10 loss cycle)
  status: 'active' | 'won' | 'lost';
  collapsedFloor?: number | null;
  createdAt: number;
}

type CrystalGemType = 'emerald' | 'ruby' | 'amethyst' | 'gold' | 'sapphire';

interface TransactionRecord {
  id: string;
  userId: string;
  username: string;
  mobile: string;
  type: 'deposit' | 'withdrawal' | 'bet' | 'win' | 'bonus' | 'refund' | 'admin_credit' | 'admin_debit';
  amount: number;
  method?: string;
  reference?: string;
  accountDetail?: string;
  screenshotData?: string;
  pendingBonus?: number;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  utrFlag?: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

interface AdminUpiSlot {
  id: string;
  label: string;
  upiId: string;
  qrImageData?: string;
  enabled: boolean;
}

interface AdminBankSlot {
  id: string;
  label: string;
  bankHolder: string;
  bankName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  enabled: boolean;
}

interface PlatformConfig {
  upiId: string;
  qrImageData?: string;
  upiSlots?: AdminUpiSlot[];
  bankHolder: string;
  bankName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankSlots?: AdminBankSlot[];
  noticeText: string;
  appName?: string;
  bankBonusPercent?: number;
  supportWhatsappUrl?: string;
  disabledGames?: string[];
  gameModes?: Record<string, GameOutcomeMode>;
}

interface AdminAuthCredentials {
  adminIdHash: string;
  passwordHash: string;
  createdAt: number;
}

interface SupportTicket {
  id: string;
  userId?: string;
  contactName: string;
  mobile: string;
  category: string;
  message: string;
  screenshotData?: string;
  status: 'open' | 'resolved';
  adminReply?: string;
  createdAt: number;
}

interface DatabaseSchema {
  users: StoredUser[];
  wingoHistory: Record<WingoMode, WingoRound[]>;
  wingoOverrides: Record<WingoMode, number | null>;
  wingoNextOverrides: Record<WingoMode, number | null>;
  wingoPatterns: Record<WingoMode, number[]>;
  wingoPatternCursor: Record<WingoMode, number>;
  aviatorOverride: number | null;
  aviatorNextOverride: number | null;
  aviatorManualHold?: boolean;
  aviatorPatternCursor: number;
  aviatorHistory: { roundId: string; crashPoint: number; timestamp: number }[];
  minesProOverride?: number | null;
  minesProNextOverride?: number | null;
  minesProPatternCursor?: number;
  minesProHistory?: { roundId: string; crashPoint: number; timestamp: number }[];
  minesSessions?: Record<string, MinesSession>;
  minesForceNextBomb?: boolean;
  diceNextOverride?: number | null;
  diceForceLoss?: boolean;
  chickenSessions?: Record<string, ChickenRoadSession>;
  chickenForceNextTrap?: boolean;
  vertexNextOverride?: number | null;
  vertexForceLoss?: boolean;
  vortexRings?: Record<string, { fire: number; earth: number; water: number }>;
  crystalMode?: 'fair' | 'force_loss' | 'force_win';
  moneyComingMode?: 'fair' | 'force_loss' | 'force_win';
  towerSessions?: Record<string, TowerRushSession>;
  towerForceCollapse?: boolean;
  bets: BetRecord[];
  transactions: TransactionRecord[];
  supportTickets: SupportTicket[];
  platformConfig?: PlatformConfig;
  adminAuth?: AdminAuthCredentials;
  sessionSecret?: string;
}

const MODE_SECONDS: Record<WingoMode, number> = {
  '30s': 30,
  '1m': 60,
  '3m': 180,
};

const MODE_CODE: Record<WingoMode, string> = {
  '30s': '01',
  '1m': '02',
  '3m': '03',
};

const DEFAULT_PATTERN: Record<WingoMode, number[]> = {
  '30s': [1, 4, 7, 2, 9, 0, 3, 8, 5, 6, 1, 8, 3, 4, 7, 6],
  '1m': [8, 9, 9, 2, 1, 5, 4, 7, 0, 3, 6, 9, 2, 7, 4, 1],
  '3m': [3, 6, 9, 4, 1, 8, 5, 2, 7, 0, 9, 4, 3, 6, 1, 8],
};

// Realistic Aviator patterns by ratio mode
const AVIATOR_PATTERN_4W6L = [1.14, 2.45, 1.04, 1.21, 3.85, 1.08, 2.18, 1.02, 1.17, 5.1];
const AVIATOR_PATTERN_6W4L = [2.28, 1.12, 3.45, 2.08, 1.05, 4.9, 2.62, 1.19, 6.4, 1.24];
const AVIATOR_PATTERN = AVIATOR_PATTERN_4W6L;

// 3-Mines Pro pattern (Max multiplier 2025.00x)
const MINES_PRO_MAX_MULT = 2025.0;
const MINES_PRO_PATTERN_4W6L = [1.34, 3.65, 1.11, 7.4, 1.48, 15.2, 1.19, 4.1, 1.07, 32.8];
const MINES_PRO_PATTERN_6W4L = [2.85, 1.18, 5.4, 3.2, 1.09, 12.6, 4.5, 1.22, 24.5, 1.14];
const MINES_PRO_PATTERN = MINES_PRO_PATTERN_4W6L;

const ACTIVE_GAME_IDS = [
  'wingo',
  'aviator',
  'mines_pro',
  'mines',
  'dice',
  'chicken_road',
  'crystal',
  'tower_rush',
] as const;

const DEFAULT_GAME_MODES: Record<string, GameOutcomeMode> = {
  wingo: '4w6l',
  aviator: '4w6l',
  mines_pro: '6w4l',
  mines: '4w6l',
  dice: '6w4l',
  chicken_road: '4w6l',
  crystal: '6w4l',
  tower_rush: '4w6l',
};

function getColorsForNumber(num: number): WingoColor[] {
  if (num === 0) return ['red', 'violet'];
  if (num === 5) return ['green', 'violet'];
  return num % 2 === 1 ? ['green'] : ['red'];
}

function getSizeForNumber(num: number): 'big' | 'small' {
  return num >= 5 ? 'big' : 'small';
}

function getPeriodInfo(mode: WingoMode, nowMs: number) {
  const durationSec = MODE_SECONDS[mode];
  const durationMs = durationSec * 1000;
  const epochBucket = Math.floor(nowMs / durationMs);
  const elapsedMs = nowMs % durationMs;
  const secondsRemaining = Math.max(0, Math.ceil((durationMs - elapsedMs) / 1000));

  // Format date in IST (UTC+5:30) so period starts with current local date 20261118...
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(epochBucket * durationMs + istOffsetMs);
  const yyyy = istDate.getUTCFullYear();
  const mm = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(istDate.getUTCDate()).padStart(2, '0');
  const dayStartUtcMs = Date.UTC(yyyy, istDate.getUTCMonth(), istDate.getUTCDate()) - istOffsetMs;
  const roundInDay = Math.max(
    1,
    Math.floor((epochBucket * durationMs - dayStartUtcMs) / durationMs) + 1
  );
  const periodId = `${yyyy}${mm}${dd}${MODE_CODE[mode]}${String(roundInDay).padStart(5, '0')}`;

  return {
    mode,
    periodId,
    secondsRemaining,
    totalSeconds: durationSec,
    isLocked: secondsRemaining <= 5,
    epochBucket,
  };
}

function seedHistoryForMode(mode: WingoMode, nowMs: number): WingoRound[] {
  const durationMs = MODE_SECONDS[mode] * 1000;
  const currentBucket = Math.floor(nowMs / durationMs);
  const pattern = DEFAULT_PATTERN[mode];
  const rounds: WingoRound[] = [];

  for (let i = 1; i <= 25; i++) {
    const targetMs = (currentBucket - i) * durationMs + 1000;
    const info = getPeriodInfo(mode, targetMs);
    const num = pattern[(currentBucket - i + pattern.length * 100) % pattern.length];
    rounds.push({
      periodId: info.periodId,
      mode,
      number: num,
      colors: getColorsForNumber(num),
      size: getSizeForNumber(num),
      timestamp: targetMs,
    });
  }
  return rounds;
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(':');
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(derived, 'hex'));
}

function validateGenuineMobileServer(raw: string): { valid: boolean; error?: string } {
  const mobile = String(raw || '').trim();
  if (!/^\d{10}$/.test(mobile)) {
    return { valid: false, error: 'Enter a valid 10-digit mobile number.' };
  }
  if (!/^[6-9]\d{9}$/.test(mobile)) {
    return { valid: false, error: 'Genuine mobile numbers must start with 6, 7, 8, or 9.' };
  }
  if (/(.)\1{2,}/.test(mobile)) {
    return { valid: false, error: 'Fake number rejected: 3 or more identical consecutive digits are not allowed.' };
  }
  if (new Set(mobile.split('')).size < 4) {
    return { valid: false, error: 'Repeated digit patterns are not allowed. Use a genuine mobile number.' };
  }
  const seqs = ['0123456789', '1234567890', '9876543210', '0987654321', '6789012345', '9012345678'];
  for (const seq of seqs) {
    for (let i = 0; i <= seq.length - 6; i++) {
      if (mobile.includes(seq.slice(i, i + 6))) {
        return { valid: false, error: 'Sequential fake mobile numbers are not allowed.' };
      }
    }
  }
  return { valid: true };
}

function validateDepositUtrServer(raw: string): { valid: boolean; clean: string; error?: string } {
  const clean = String(raw || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!/^[A-Z0-9]{8,24}$/.test(clean)) {
    return {
      valid: false,
      clean,
      error: 'Fake/Invalid UTR: Enter a genuine 12-digit UTR or bank transaction reference (8-24 chars).',
    };
  }
  if (/^(.)\1{5,}$/.test(clean) || new Set(clean.split('')).size < 4) {
    return {
      valid: false,
      clean,
      error: 'Fake UTR rejected: Repeated character references are not allowed.',
    };
  }
  const fakeSeqs = ['0123456789', '1234567890', '123456789012', '9876543210', '987654321098'];
  if (fakeSeqs.some((s) => clean.includes(s))) {
    return {
      valid: false,
      clean,
      error: 'Fake UTR rejected: Sequential dummy numbers are not allowed.',
    };
  }
  return { valid: true, clean };
}

const DEFAULT_PLATFORM_CONFIG: PlatformConfig = {
  upiId: 'ad78.pay@upi',
  upiSlots: [
    { id: 'upi-1', label: 'UPI 1 (Primary)', upiId: 'ad78.pay@upi', enabled: true },
    { id: 'upi-2', label: 'UPI 2 (Backup)', upiId: '', enabled: false },
  ],
  bankHolder: 'AD78 PAYMENTS ENTERPRISE',
  bankName: 'HDFC BANK',
  bankAccountNumber: '50200078451290',
  bankIfsc: 'HDFC0001780',
  bankSlots: [
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
  ],
  noticeText: '',
  appName: 'AD78',
  bankBonusPercent: 5,
  supportWhatsappUrl: '',
  disabledGames: [],
  gameModes: { ...DEFAULT_GAME_MODES },
};

function normalizeGameModes(incoming?: Record<string, unknown>): Record<string, GameOutcomeMode> {
  const result: Record<string, GameOutcomeMode> = { ...DEFAULT_GAME_MODES };
  if (incoming && typeof incoming === 'object') {
    for (const gid of ACTIVE_GAME_IDS) {
      const val = incoming[gid];
      if (
        val === '6w4l' ||
        val === '4w6l' ||
        val === 'fair' ||
        val === 'force_win' ||
        val === 'force_loss'
      ) {
        result[gid] = val;
      }
    }
  }
  return result;
}

function normalizePlatformConfig(cfg?: Partial<PlatformConfig>): PlatformConfig {
  const base = cfg || {};
  const upiSlots: AdminUpiSlot[] = [0, 1].map((idx) => {
    const incoming = base.upiSlots?.[idx];
    if (idx === 0) {
      return {
        id: 'upi-1',
        label: incoming?.label || 'UPI 1 (Primary)',
        upiId: String(incoming?.upiId ?? base.upiId ?? DEFAULT_PLATFORM_CONFIG.upiId).trim(),
        qrImageData: incoming?.qrImageData ?? base.qrImageData,
        enabled: incoming?.enabled ?? true,
      };
    }
    return {
      id: 'upi-2',
      label: incoming?.label || 'UPI 2 (Backup)',
      upiId: String(incoming?.upiId ?? '').trim(),
      qrImageData: incoming?.qrImageData,
      enabled: Boolean(incoming?.enabled && (String(incoming?.upiId || '').trim() || incoming?.qrImageData)),
    };
  });

  const bankSlots: AdminBankSlot[] = [0, 1, 2].map((idx) => {
    const incoming = base.bankSlots?.[idx];
    if (idx === 0) {
      return {
        id: 'bank-1',
        label: incoming?.label || 'Bank Account 1',
        bankHolder: String(incoming?.bankHolder ?? base.bankHolder ?? DEFAULT_PLATFORM_CONFIG.bankHolder).trim(),
        bankName: String(incoming?.bankName ?? base.bankName ?? DEFAULT_PLATFORM_CONFIG.bankName).trim(),
        bankAccountNumber: String(
          incoming?.bankAccountNumber ?? base.bankAccountNumber ?? DEFAULT_PLATFORM_CONFIG.bankAccountNumber
        ).trim(),
        bankIfsc: String(incoming?.bankIfsc ?? base.bankIfsc ?? DEFAULT_PLATFORM_CONFIG.bankIfsc)
          .trim()
          .toUpperCase(),
        enabled: incoming?.enabled ?? true,
      };
    }
    return {
      id: `bank-${idx + 1}`,
      label: incoming?.label || `Bank Account ${idx + 1}`,
      bankHolder: String(incoming?.bankHolder ?? '').trim(),
      bankName: String(incoming?.bankName ?? '').trim(),
      bankAccountNumber: String(incoming?.bankAccountNumber ?? '').trim(),
      bankIfsc: String(incoming?.bankIfsc ?? '').trim().toUpperCase(),
      enabled: Boolean(incoming?.enabled && String(incoming?.bankAccountNumber || '').trim()),
    };
  });

  const rawBonus = Number(base.bankBonusPercent ?? 5);
  const bankBonusPercent = Number.isFinite(rawBonus) ? Math.max(0, Math.min(25, Math.round(rawBonus))) : 5;
  const disabledGames = Array.isArray(base.disabledGames)
    ? base.disabledGames.map((g) => String(g).trim()).filter(Boolean)
    : [];

  return {
    upiId: upiSlots[0].upiId || DEFAULT_PLATFORM_CONFIG.upiId,
    qrImageData: upiSlots[0].qrImageData,
    upiSlots,
    bankHolder: bankSlots[0].bankHolder || DEFAULT_PLATFORM_CONFIG.bankHolder,
    bankName: bankSlots[0].bankName || DEFAULT_PLATFORM_CONFIG.bankName,
    bankAccountNumber: bankSlots[0].bankAccountNumber || DEFAULT_PLATFORM_CONFIG.bankAccountNumber,
    bankIfsc: bankSlots[0].bankIfsc || DEFAULT_PLATFORM_CONFIG.bankIfsc,
    bankSlots,
    noticeText: String(base.noticeText ?? '').trim(),
    appName: String(base.appName || 'AD78').trim().slice(0, 24) || 'AD78',
    bankBonusPercent,
    supportWhatsappUrl: String(base.supportWhatsappUrl ?? '').trim(),
    disabledGames,
    gameModes: normalizeGameModes(base.gameModes as Record<string, unknown> | undefined),
  };
}

function loadDatabase(): DatabaseSchema {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const now = Date.now();
  if (fs.existsSync(DB_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')) as DatabaseSchema;
      if (parsed && Array.isArray(parsed.users) && parsed.wingoHistory) {
        if (!Array.isArray(parsed.supportTickets)) parsed.supportTickets = [];
        if (!Array.isArray(parsed.aviatorHistory)) parsed.aviatorHistory = [];
        if (parsed.aviatorOverride === undefined) parsed.aviatorOverride = null;
        if (parsed.aviatorNextOverride === undefined) parsed.aviatorNextOverride = null;
        if (!parsed.wingoNextOverrides) {
          parsed.wingoNextOverrides = { '30s': null, '1m': null, '3m': null };
        }
        if (typeof parsed.aviatorPatternCursor !== 'number') parsed.aviatorPatternCursor = 0;
        if (!Array.isArray(parsed.minesProHistory)) {
          parsed.minesProHistory = [
            { roundId: 'MP20261119001', crashPoint: 2.35, timestamp: now - 45000 },
            { roundId: 'MP20261119002', crashPoint: 14.8, timestamp: now - 30000 },
            { roundId: 'MP20261119003', crashPoint: 1.18, timestamp: now - 15000 },
          ];
        }
        if (parsed.minesProOverride === undefined) parsed.minesProOverride = null;
        if (parsed.minesProNextOverride === undefined) parsed.minesProNextOverride = null;
        if (typeof parsed.minesProPatternCursor !== 'number') parsed.minesProPatternCursor = 0;
        if (!parsed.minesSessions) parsed.minesSessions = {};
        if (typeof parsed.minesForceNextBomb !== 'boolean') parsed.minesForceNextBomb = false;
        if (parsed.diceNextOverride === undefined) parsed.diceNextOverride = null;
        if (typeof parsed.diceForceLoss !== 'boolean') parsed.diceForceLoss = false;
        if (!parsed.chickenSessions) parsed.chickenSessions = {};
        if (typeof parsed.chickenForceNextTrap !== 'boolean') parsed.chickenForceNextTrap = false;
        if (parsed.vertexNextOverride === undefined) parsed.vertexNextOverride = null;
        if (typeof parsed.vertexForceLoss !== 'boolean') parsed.vertexForceLoss = false;
        if (!parsed.vortexRings) parsed.vortexRings = {};
        if (typeof parsed.aviatorManualHold !== 'boolean') parsed.aviatorManualHold = false;
        if (!parsed.crystalMode) parsed.crystalMode = 'fair';
        if (!parsed.moneyComingMode) parsed.moneyComingMode = 'fair';
        if (!parsed.towerSessions) parsed.towerSessions = {};
        if (typeof parsed.towerForceCollapse !== 'boolean') parsed.towerForceCollapse = false;
        parsed.platformConfig = normalizePlatformConfig(parsed.platformConfig);
        if (!parsed.sessionSecret) {
          parsed.sessionSecret = crypto.randomBytes(32).toString('hex');
        }
        return parsed;
      }
    } catch {
      // Fallback
    }
  }

  const demoUser: StoredUser = {
    id: 'usr_demo_001',
    username: 'demo78',
    mobile: '9824517360',
    passwordHash: hashPassword('ad78pass'),
    adminVisiblePassword: 'ad78pass',
    balance: 5000,
    bonusBalance: 500,
    referralCode: 'AD78500',
    createdAt: now,
    isFrozen: false,
    isDemo: true,
    stakePresets: [10, 50, 100, 500],
  };

  const initial: DatabaseSchema = {
    users: [demoUser],
    wingoHistory: {
      '30s': seedHistoryForMode('30s', now),
      '1m': seedHistoryForMode('1m', now),
      '3m': seedHistoryForMode('3m', now),
    },
    wingoOverrides: {
      '30s': null,
      '1m': null,
      '3m': null,
    },
    wingoNextOverrides: {
      '30s': null,
      '1m': null,
      '3m': null,
    },
    wingoPatterns: {
      '30s': [...DEFAULT_PATTERN['30s']],
      '1m': [...DEFAULT_PATTERN['1m']],
      '3m': [...DEFAULT_PATTERN['3m']],
    },
    wingoPatternCursor: {
      '30s': 0,
      '1m': 0,
      '3m': 0,
    },
    aviatorOverride: null,
    aviatorNextOverride: null,
    aviatorManualHold: false,
    aviatorPatternCursor: 0,
    aviatorHistory: [
      { roundId: 'AV20261118001', crashPoint: 1.18, timestamp: now - 60000 },
      { roundId: 'AV20261118002', crashPoint: 2.84, timestamp: now - 45000 },
      { roundId: 'AV20261118003', crashPoint: 1.07, timestamp: now - 30000 },
      { roundId: 'AV20261118004', crashPoint: 4.15, timestamp: now - 15000 },
    ],
    minesProOverride: null,
    minesProNextOverride: null,
    minesProPatternCursor: 0,
    minesProHistory: [
      { roundId: 'MP20261119001', crashPoint: 2.35, timestamp: now - 45000 },
      { roundId: 'MP20261119002', crashPoint: 14.8, timestamp: now - 30000 },
      { roundId: 'MP20261119003', crashPoint: 1.18, timestamp: now - 15000 },
    ],
    minesSessions: {},
    minesForceNextBomb: false,
    diceNextOverride: null,
    diceForceLoss: false,
    chickenSessions: {},
    chickenForceNextTrap: false,
    vertexNextOverride: null,
    vertexForceLoss: false,
    vortexRings: {},
    crystalMode: 'fair',
    moneyComingMode: 'fair',
    towerSessions: {},
    towerForceCollapse: false,
    bets: [],
    transactions: [
      {
        id: 'tx_demo_welcome',
        userId: demoUser.id,
        username: demoUser.username,
        mobile: demoUser.mobile,
        type: 'bonus',
        amount: 5000,
        method: 'Demo Wallet',
        status: 'completed',
        note: 'Demo account starting balance',
        createdAt: now,
        updatedAt: now,
      },
    ],
    supportTickets: [],
    platformConfig: { ...DEFAULT_PLATFORM_CONFIG },
    sessionSecret: crypto.randomBytes(32).toString('hex'),
  };
  fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
  return initial;
}

const db: DatabaseSchema = loadDatabase();
if (!db.sessionSecret) {
  db.sessionSecret = crypto.randomBytes(32).toString('hex');
}
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function saveNow() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmp = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, DB_FILE);
  } catch (err) {
    console.error('Failed to persist DB:', err);
  }
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveNow();
  }, 150);
}

function signToken(payload: string): string {
  const secret = db.sessionSecret || 'ad78_fallback_secret';
  const body = Buffer.from(payload, 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken(token: string, expectedPrefix: string): string | null {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.', 2);
  if (!body || !sig) return null;
  const secret = db.sessionSecret || 'ad78_fallback_secret';
  const expectedSig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  const bufA = Buffer.from(sig);
  const bufB = Buffer.from(expectedSig);
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    return null;
  }
  try {
    const decoded = Buffer.from(body, 'base64url').toString('utf8');
    if (!decoded.startsWith(expectedPrefix)) return null;
    return decoded.slice(expectedPrefix.length);
  } catch {
    return null;
  }
}

const otpStore = new Map<string, { code: string; userId: string; expiresAt: number }>();

function sanitizeUser(u: StoredUser) {
  return {
    id: u.id,
    username: u.username,
    mobile: u.mobile,
    balance: Number(u.balance.toFixed(2)),
    bonusBalance: Number(u.bonusBalance.toFixed(2)),
    referralCode: u.referralCode,
    createdAt: u.createdAt,
    isFrozen: u.isFrozen,
    isDemo: Boolean(u.isDemo),
    stakePresets: u.stakePresets || [10, 50, 100, 500],
    savedUpiId: u.savedUpiId,
    bankAccount: u.bankAccount,
  };
}

function sanitizeAdminUser(u: StoredUser) {
  return {
    ...sanitizeUser(u),
    visiblePassword: u.adminVisiblePassword || '',
  };
}

function buildShuffledCycle(wins: number, losses: number): boolean[] {
  const cycle = [
    ...Array.from({ length: wins }, () => true),
    ...Array.from({ length: losses }, () => false),
  ];
  for (let i = cycle.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [cycle[i], cycle[j]] = [cycle[j], cycle[i]];
  }
  return cycle;
}

function getGameMode(gameId: string): GameOutcomeMode {
  const cfg = normalizePlatformConfig(db.platformConfig);
  return cfg.gameModes?.[gameId] || DEFAULT_GAME_MODES[gameId] || '4w6l';
}

/**
 * Per-user, per-game outcome selector controlled live from Admin Panel:
 * - Demo users win almost every round with very rare losses (9 Wins / 1 Loss shuffled cycle).
 * - Real registered users follow each game's Admin-configured mode:
 *   - '6w4l': 6 Wins / 4 Losses shuffled 10-round cycle
 *   - '4w6l': 4 Wins / 6 Losses shuffled 10-round cycle
 *   - 'force_win': Guaranteed win
 *   - 'force_loss': Guaranteed loss
 *   - 'fair': 50/50 random fair outcome
 */
function consumeUserOutcome(user: StoredUser, gameId = 'general'): boolean {
  if (user.isDemo) {
    if (!Array.isArray(user.demoCycle) || user.demoCycle.length === 0) {
      user.demoCycle = buildShuffledCycle(9, 1);
    }
    return user.demoCycle.pop() === true;
  }

  const mode = getGameMode(gameId);
  if (mode === 'force_win') return true;
  if (mode === 'force_loss') return false;
  if (mode === 'fair') return crypto.randomInt(0, 2) === 0;

  if (!user.gameCycles) user.gameCycles = {};
  if (!user.gameCycleModes) user.gameCycleModes = {};

  const existing = user.gameCycles[gameId];
  const prevMode = user.gameCycleModes[gameId];

  if (!Array.isArray(existing) || existing.length === 0 || prevMode !== mode) {
    user.gameCycles[gameId] =
      mode === '6w4l' ? buildShuffledCycle(6, 4) : buildShuffledCycle(4, 6);
    user.gameCycleModes[gameId] = mode;
  }
  return user.gameCycles[gameId].pop() === true;
}

function getAuthUser(req: express.Request): StoredUser | null {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return null;
  const userId = verifyToken(token, 'u:');
  if (!userId) return null;
  return db.users.find((u) => u.id === userId) || null;
}

function isAdminAuthed(req: express.Request): boolean {
  const token = String(req.headers['x-admin-token'] || '').trim();
  return Boolean(token && verifyToken(token, 'admin:'));
}

interface WsClientMeta {
  ws: WebSocket;
  userId?: string;
}
const wsClients = new Set<WsClientMeta>();

function broadcastWs(payload: unknown) {
  const text = JSON.stringify(payload);
  for (const client of wsClients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(text);
    }
  }
}

function sendToUserWs(userId: string, payload: unknown) {
  const text = JSON.stringify(payload);
  for (const client of wsClients) {
    if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(text);
    }
  }
}

function getWingoClockPayload() {
  const now = Date.now();
  const modes: WingoMode[] = ['30s', '1m', '3m'];
  const clocks: Record<WingoMode, ReturnType<typeof getPeriodInfo> & { history: WingoRound[] }> = {} as Record<
    WingoMode,
    ReturnType<typeof getPeriodInfo> & { history: WingoRound[] }
  >;
  for (const m of modes) {
    const info = getPeriodInfo(m, now);
    clocks[m] = {
      ...info,
      history: db.wingoHistory[m].slice(0, 30),
    };
  }
  return clocks;
}

const lastKnownPeriod: Record<WingoMode, string> = {
  '30s': getPeriodInfo('30s', Date.now()).periodId,
  '1m': getPeriodInfo('1m', Date.now()).periodId,
  '3m': getPeriodInfo('3m', Date.now()).periodId,
};

function computeWingoPayoutMultiplier(
  bet: BetRecord,
  winningNumber: number,
  winningColors: WingoColor[],
  winningSize: 'big' | 'small'
): number {
  if (bet.selectionType === 'number') {
    return Number(bet.selection) === winningNumber ? 9 : 0;
  }
  if (bet.selectionType === 'size') {
    return bet.selection === winningSize ? 2 : 0;
  }
  if (bet.selectionType === 'color') {
    if (bet.selection === 'violet') {
      return winningColors.includes('violet') ? 4.5 : 0;
    }
    if (bet.selection === 'green') {
      if (winningNumber === 5) return 1.5;
      if (winningColors.includes('green')) return 2;
      return 0;
    }
    if (bet.selection === 'red') {
      if (winningNumber === 0) return 1.5;
      if (winningColors.includes('red')) return 2;
      return 0;
    }
  }
  return 0;
}

/**
 * Automatic pattern & risk engine:
 * 1) If Admin override is set -> uses that exact number.
 * 2) If any bet in the round is > ₹1000 -> picks number that minimizes payout (high bets lose).
 * 3) If bets exist, checks risk-managed minimum-payout selection 4 out of 5 rounds; otherwise advances pattern.
 */
function promoteNextWingoOverride(mode: WingoMode) {
  if (!db.wingoNextOverrides) {
    db.wingoNextOverrides = { '30s': null, '1m': null, '3m': null };
  }
  const queued = db.wingoNextOverrides[mode];
  if (queued !== null && queued !== undefined && queued >= 0 && queued <= 9) {
    db.wingoOverrides[mode] = queued;
    db.wingoNextOverrides[mode] = null;
  } else {
    db.wingoOverrides[mode] = null;
  }
}

function pickAutomatedWingoNumber(mode: WingoMode, pendingBets: BetRecord[]): number {
  const override = db.wingoOverrides[mode];
  if (override !== null && override !== undefined && override >= 0 && override <= 9) {
    promoteNextWingoOverride(mode);
    scheduleSave();
    return override;
  }

  promoteNextWingoOverride(mode);

  const pattern = db.wingoPatterns[mode]?.length ? db.wingoPatterns[mode] : DEFAULT_PATTERN[mode];
  const cursor = db.wingoPatternCursor[mode] || 0;
  const patternCandidate = pattern[cursor % pattern.length];
  db.wingoPatternCursor[mode] = (cursor + 1) % pattern.length;

  if (pendingBets.length === 0) {
    return patternCandidate;
  }

  const pickExtremePayoutNumber = (maximize: boolean): number => {
    let bestNum = patternCandidate;
    let bestPayout = maximize ? -1 : Infinity;
    for (let candidate = 0; candidate <= 9; candidate++) {
      const cColors = getColorsForNumber(candidate);
      const cSize = getSizeForNumber(candidate);
      let totalPayout = 0;
      for (const b of pendingBets) {
        totalPayout += b.amount * computeWingoPayoutMultiplier(b, candidate, cColors, cSize);
      }
      if (maximize ? totalPayout > bestPayout : totalPayout < bestPayout) {
        bestPayout = totalPayout;
        bestNum = candidate;
      }
    }
    return bestNum;
  };

  // Demo account bets: win 9/10 rounds with very rare 1/10 loss
  const allDemoBets = pendingBets.every((b) => {
    const u = db.users.find((usr) => usr.id === b.userId);
    return Boolean(u?.isDemo);
  });
  if (allDemoBets) {
    const demoUser = db.users.find((u) => u.id === pendingBets[0].userId);
    const demoShouldWin = demoUser ? consumeUserOutcome(demoUser, 'wingo') : true;
    return demoShouldWin ? pickExtremePayoutNumber(true) : pickExtremePayoutNumber(false);
  }

  const wingoModeCfg = getGameMode('wingo');
  if (wingoModeCfg === 'force_win') {
    return pickExtremePayoutNumber(true);
  }
  if (wingoModeCfg === 'force_loss') {
    return pickExtremePayoutNumber(false);
  }
  if (wingoModeCfg === 'fair') {
    return crypto.randomInt(0, 10);
  }

  const hasOver1000 = pendingBets.some((b) => b.amount > 1000);
  if (hasOver1000) {
    return pickExtremePayoutNumber(false);
  }

  const firstUser = db.users.find((u) => u.id === pendingBets[0].userId);
  const shouldUserWin = firstUser ? consumeUserOutcome(firstUser, 'wingo') : cursor % 10 < (wingoModeCfg === '6w4l' ? 6 : 4);
  return shouldUserWin ? pickExtremePayoutNumber(true) : pickExtremePayoutNumber(false);
}

function settleWingoPeriod(mode: WingoMode, periodId: string) {
  if (db.wingoHistory[mode].some((r) => r.periodId === periodId)) {
    return;
  }

  const pendingBets = db.bets.filter(
    (b) => b.game === 'wingo' && b.mode === mode && b.periodId === periodId && b.status === 'pending'
  );

  const winningNumber = pickAutomatedWingoNumber(mode, pendingBets);
  const colors = getColorsForNumber(winningNumber);
  const size = getSizeForNumber(winningNumber);
  const now = Date.now();

  const round: WingoRound = {
    periodId,
    mode,
    number: winningNumber,
    colors,
    size,
    timestamp: now,
  };

  db.wingoHistory[mode].unshift(round);
  if (db.wingoHistory[mode].length > 100) {
    db.wingoHistory[mode] = db.wingoHistory[mode].slice(0, 100);
  }

  const userSummaries = new Map<
    string,
    { totalStaked: number; totalPayout: number; bets: BetRecord[] }
  >();

  for (const bet of pendingBets) {
    const mult = computeWingoPayoutMultiplier(bet, winningNumber, colors, size);
    const payout = Number((bet.amount * mult).toFixed(2));
    bet.multiplier = mult;
    bet.payout = payout;
    bet.profit = Number((payout - bet.amount).toFixed(2));
    bet.status = payout > 0 ? 'won' : 'lost';
    bet.resultText = `#${winningNumber} (${colors.join('+').toUpperCase()} · ${size.toUpperCase()})`;
    bet.settledAt = now;

    const user = db.users.find((u) => u.id === bet.userId);
    if (user && payout > 0) {
      user.balance = Number((user.balance + payout).toFixed(2));
      db.transactions.unshift({
        id: `tx_${crypto.randomBytes(6).toString('hex')}`,
        userId: user.id,
        username: user.username,
        mobile: user.mobile,
        type: 'win',
        amount: payout,
        method: `WinGo ${mode}`,
        reference: periodId,
        status: 'completed',
        note: `Won ₹${payout} on ${bet.selection.toUpperCase()}`,
        createdAt: now,
        updatedAt: now,
      });
    }

    const summary = userSummaries.get(bet.userId) || {
      totalStaked: 0,
      totalPayout: 0,
      bets: [],
    };
    summary.totalStaked += bet.amount;
    summary.totalPayout += payout;
    summary.bets.push(bet);
    userSummaries.set(bet.userId, summary);
  }

  scheduleSave();

  broadcastWs({
    type: 'wingo:result',
    mode,
    periodId,
    round,
    history: db.wingoHistory[mode].slice(0, 30),
  });

  for (const [userId, summary] of userSummaries.entries()) {
    const user = db.users.find((u) => u.id === userId);
    sendToUserWs(userId, {
      type: 'wingo:settlement',
      mode,
      periodId,
      round,
      balance: user ? user.balance : 0,
      userOutcome: {
        totalStaked: Number(summary.totalStaked.toFixed(2)),
        totalPayout: Number(summary.totalPayout.toFixed(2)),
        netProfit: Number((summary.totalPayout - summary.totalStaked).toFixed(2)),
        won: summary.totalPayout > 0,
        bets: summary.bets,
      },
    });
  }
}

// --- GLOBAL SYNCHRONIZED AVIATOR ENGINE ---
interface AviatorEngine {
  roundNumber: number;
  roundId: string;
  phase: AviatorPhase;
  phaseStartedAt: number;
  bettingDurationMs: number;
  crashDurationMs: number;
  targetCrashPoint: number;
  isManualTarget: boolean;
  multiplier: number;
}

const aviatorEngine: AviatorEngine = {
  roundNumber: 1,
  roundId: `AV20261118005`,
  phase: 'betting',
  phaseStartedAt: Date.now(),
  bettingDurationMs: 6000,
  crashDurationMs: 3000,
  targetCrashPoint: 2.45,
  isManualTarget: false,
  multiplier: 1.0,
};

function nextAviatorCrashPoint(): { crashPoint: number; isManual: boolean } {
  if (db.aviatorOverride !== null && db.aviatorOverride >= 1.01) {
    const val = db.aviatorOverride;
    if (db.aviatorNextOverride !== null && db.aviatorNextOverride >= 1.01) {
      db.aviatorOverride = db.aviatorNextOverride;
      db.aviatorNextOverride = null;
    } else {
      db.aviatorOverride = null;
    }
    scheduleSave();
    return { crashPoint: val, isManual: true };
  }
  if (db.aviatorNextOverride !== null && db.aviatorNextOverride >= 1.01) {
    const nextVal = db.aviatorNextOverride;
    db.aviatorNextOverride = null;
    scheduleSave();
    return { crashPoint: nextVal, isManual: true };
  }
  if (db.aviatorManualHold) {
    return { crashPoint: 10000, isManual: true };
  }

  // Normal User App auto flight curve (High multipliers 10x-10000x are triggered via Admin overrides)
  const roundBets = db.bets.filter(
    (b) => b.game === 'aviator' && b.periodId === aviatorEngine.roundId && b.status === 'pending'
  );
  const allDemoBets =
    roundBets.length > 0 &&
    roundBets.every((b) => {
      const u = db.users.find((usr) => usr.id === b.userId);
      return Boolean(u?.isDemo);
    });

  if (allDemoBets) {
    const demoUser = db.users.find((u) => u.id === roundBets[0].userId);
    const demoWin = demoUser ? consumeUserOutcome(demoUser, 'aviator') : true;
    const cp = demoWin
      ? Number((2.2 + crypto.randomInt(0, 420) / 100).toFixed(2))
      : Number((1.05 + crypto.randomInt(0, 28) / 100).toFixed(2));
    return { crashPoint: cp, isManual: false };
  }

  const mode = getGameMode('aviator');
  let crashPoint = 1.85;
  if (mode === 'force_win') {
    crashPoint = Number((2.35 + crypto.randomInt(0, 565) / 100).toFixed(2));
  } else if (mode === 'force_loss') {
    crashPoint = Number((1.01 + crypto.randomInt(0, 14) / 100).toFixed(2));
  } else if (mode === 'fair') {
    const r = crypto.randomInt(1, 1000) / 1000;
    crashPoint = Number(Math.max(1.02, Math.min(18.0, 0.97 / Math.max(0.05, r))).toFixed(2));
  } else {
    const seq = mode === '6w4l' ? AVIATOR_PATTERN_6W4L : AVIATOR_PATTERN_4W6L;
    const idx = db.aviatorPatternCursor % seq.length;
    crashPoint = seq[idx];
    db.aviatorPatternCursor = (db.aviatorPatternCursor + 1) % seq.length;
    scheduleSave();
  }
  return { crashPoint, isManual: false };
}

function getAviatorPublicState() {
  const now = Date.now();
  const countdownSec =
    aviatorEngine.phase === 'betting'
      ? Math.max(0, Math.ceil((aviatorEngine.bettingDurationMs - (now - aviatorEngine.phaseStartedAt)) / 1000))
      : 0;
  return {
    roundId: aviatorEngine.roundId,
    phase: aviatorEngine.phase,
    countdownSec,
    multiplier: Number(aviatorEngine.multiplier.toFixed(2)),
    crashPoint: aviatorEngine.phase === 'crashed' ? aviatorEngine.targetCrashPoint : undefined,
    history: db.aviatorHistory.slice(0, 20),
  };
}

function settleUncashedAviatorBets(roundId: string, crashPoint: number) {
  const pending = db.bets.filter(
    (b) => b.game === 'aviator' && b.periodId === roundId && b.status === 'pending'
  );
  const now = Date.now();
  const userTotals = new Map<string, number>();

  for (const b of pending) {
    b.status = 'lost';
    b.payout = 0;
    b.profit = -b.amount;
    b.resultText = `Flew away @ ${crashPoint.toFixed(2)}x`;
    b.settledAt = now;
    userTotals.set(b.userId, (userTotals.get(b.userId) || 0) + b.amount);
  }

  for (const [userId, totalStaked] of userTotals.entries()) {
    const u = db.users.find((usr) => usr.id === userId);
    sendToUserWs(userId, {
      type: 'aviator:settlement',
      roundId,
      won: false,
      staked: Number(totalStaked.toFixed(2)),
      payout: 0,
      crashPoint,
      balance: u ? u.balance : 0,
    });
  }
  if (pending.length > 0) scheduleSave();
}

function tickAviatorEngine() {
  const now = Date.now();
  const elapsed = now - aviatorEngine.phaseStartedAt;

  if (aviatorEngine.phase === 'betting') {
    aviatorEngine.multiplier = 1.0;
    if (elapsed >= aviatorEngine.bettingDurationMs) {
      aviatorEngine.phase = 'flying';
      aviatorEngine.phaseStartedAt = now;
      const nextCfg = nextAviatorCrashPoint();
      aviatorEngine.targetCrashPoint = nextCfg.crashPoint;
      aviatorEngine.isManualTarget = nextCfg.isManual;
      broadcastWs({ type: 'aviator:state', state: getAviatorPublicState() });
    }
  } else if (aviatorEngine.phase === 'flying') {
    const flightSec = elapsed / 1000;
    const nextMult = Number(Math.pow(Math.E, flightSec * 0.34).toFixed(2));
    const effectiveTarget =
      db.aviatorManualHold && !aviatorEngine.isManualTarget ? 10000 : aviatorEngine.targetCrashPoint;
    if (nextMult >= effectiveTarget) {
      const finalCrash = Math.min(10000, effectiveTarget);
      aviatorEngine.targetCrashPoint = finalCrash;
      aviatorEngine.multiplier = finalCrash;
      aviatorEngine.phase = 'crashed';
      aviatorEngine.phaseStartedAt = now;

      db.aviatorHistory.unshift({
        roundId: aviatorEngine.roundId,
        crashPoint: finalCrash,
        timestamp: now,
      });
      if (db.aviatorHistory.length > 50) {
        db.aviatorHistory = db.aviatorHistory.slice(0, 50);
      }
      settleUncashedAviatorBets(aviatorEngine.roundId, finalCrash);
      scheduleSave();
      broadcastWs({ type: 'aviator:state', state: getAviatorPublicState() });
    } else {
      aviatorEngine.multiplier = nextMult;
      broadcastWs({ type: 'aviator:tick', state: getAviatorPublicState() });
    }
  } else if (aviatorEngine.phase === 'crashed') {
    if (elapsed >= aviatorEngine.crashDurationMs) {
      aviatorEngine.roundNumber += 1;
      const istOffsetMs = 5.5 * 60 * 60 * 1000;
      const d = new Date(now + istOffsetMs);
      const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
      aviatorEngine.roundId = `AV${ymd}${String(100 + aviatorEngine.roundNumber).padStart(4, '0')}`;
      aviatorEngine.phase = 'betting';
      aviatorEngine.phaseStartedAt = now;
      aviatorEngine.multiplier = 1.0;
      aviatorEngine.isManualTarget = false;
      if (db.aviatorOverride === null && db.aviatorNextOverride !== null && db.aviatorNextOverride >= 1.01) {
        db.aviatorOverride = db.aviatorNextOverride;
        db.aviatorNextOverride = null;
        scheduleSave();
      }
      broadcastWs({ type: 'aviator:state', state: getAviatorPublicState() });
    }
  }
}

// --- GLOBAL SYNCHRONIZED MINES PRO ENGINE (3 MINES · STARS OPENING · MAX 2025x) ---
interface MinesProEngineState extends AviatorEngine {
  mines: number[];
  starTiles: number[];
  starsOpened: number;
  bombTile: number | null;
}

const MINES_PRO_STAR_THRESHOLDS = [
  1.0, 1.25, 1.6, 2.0, 2.5, 3.0, 4.0, 5.5, 7.5, 10.0, 14.0, 20.0,
  30.0, 50.0, 85.0, 140.0, 225.0, 360.0, 580.0, 920.0, 1450.0, 2025.0,
];

function dealMinesProBoard(): { mines: number[]; starTiles: number[] } {
  const pool = Array.from({ length: 25 }, (_, i) => i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return {
    mines: pool.slice(0, 3),
    starTiles: pool.slice(3),
  };
}

function computeStarsOpened(mult: number): number {
  let count = 0;
  for (const th of MINES_PRO_STAR_THRESHOLDS) {
    if (mult >= th) count += 1;
  }
  return Math.max(1, Math.min(22, count));
}

const initialMpBoard = dealMinesProBoard();
const minesProEngine: MinesProEngineState = {
  roundNumber: 1,
  roundId: `MP20261119004`,
  phase: 'betting',
  phaseStartedAt: Date.now(),
  bettingDurationMs: 6000,
  crashDurationMs: 3000,
  targetCrashPoint: MINES_PRO_PATTERN[0],
  isManualTarget: false,
  multiplier: 1.0,
  mines: initialMpBoard.mines,
  starTiles: initialMpBoard.starTiles,
  starsOpened: 0,
  bombTile: null,
};

function nextMinesProCrashPoint(): { crashPoint: number; isManual: boolean } {
  if (db.minesProOverride !== null && db.minesProOverride !== undefined && db.minesProOverride >= 1.01) {
    const val = Math.min(MINES_PRO_MAX_MULT, db.minesProOverride);
    if (
      db.minesProNextOverride !== null &&
      db.minesProNextOverride !== undefined &&
      db.minesProNextOverride >= 1.01
    ) {
      db.minesProOverride = Math.min(MINES_PRO_MAX_MULT, db.minesProNextOverride);
      db.minesProNextOverride = null;
    } else {
      db.minesProOverride = null;
    }
    scheduleSave();
    return { crashPoint: val, isManual: true };
  }
  if (
    db.minesProNextOverride !== null &&
    db.minesProNextOverride !== undefined &&
    db.minesProNextOverride >= 1.01
  ) {
    const nextVal = Math.min(MINES_PRO_MAX_MULT, db.minesProNextOverride);
    db.minesProNextOverride = null;
    scheduleSave();
    return { crashPoint: nextVal, isManual: true };
  }

  const roundBets = db.bets.filter(
    (b) => b.game === 'mines_pro' && b.periodId === minesProEngine.roundId && b.status === 'pending'
  );
  const allDemoBets =
    roundBets.length > 0 &&
    roundBets.every((b) => {
      const u = db.users.find((usr) => usr.id === b.userId);
      return Boolean(u?.isDemo);
    });
  if (allDemoBets) {
    const demoUser = db.users.find((u) => u.id === roundBets[0].userId);
    const demoWin = demoUser ? consumeUserOutcome(demoUser, 'mines_pro') : true;
    const cp = demoWin
      ? Number((2.5 + crypto.randomInt(0, 750) / 100).toFixed(2))
      : Number((1.06 + crypto.randomInt(0, 22) / 100).toFixed(2));
    return { crashPoint: cp, isManual: false };
  }

  const mode = getGameMode('mines_pro');
  if (mode === 'force_win') {
    return { crashPoint: Number((3.0 + crypto.randomInt(0, 900) / 100).toFixed(2)), isManual: false };
  }
  if (mode === 'force_loss') {
    return { crashPoint: Number((1.02 + crypto.randomInt(0, 15) / 100).toFixed(2)), isManual: false };
  }
  if (mode === 'fair') {
    const r = crypto.randomInt(1, 1000) / 1000;
    return {
      crashPoint: Number(Math.max(1.03, Math.min(45.0, 1.05 / Math.max(0.025, r))).toFixed(2)),
      isManual: false,
    };
  }

  const seq = mode === '6w4l' ? MINES_PRO_PATTERN_6W4L : MINES_PRO_PATTERN_4W6L;
  const cursor = db.minesProPatternCursor || 0;
  const idx = cursor % seq.length;
  db.minesProPatternCursor = (cursor + 1) % seq.length;
  scheduleSave();
  return { crashPoint: seq[idx], isManual: false };
}

function getMinesProPublicState() {
  const now = Date.now();
  const countdownSec =
    minesProEngine.phase === 'betting'
      ? Math.max(0, Math.ceil((minesProEngine.bettingDurationMs - (now - minesProEngine.phaseStartedAt)) / 1000))
      : 0;
  return {
    roundId: minesProEngine.roundId,
    phase: minesProEngine.phase,
    countdownSec,
    multiplier: Number(minesProEngine.multiplier.toFixed(2)),
    starsOpened: minesProEngine.phase === 'betting' ? 0 : minesProEngine.starsOpened,
    starTiles:
      minesProEngine.phase === 'betting'
        ? []
        : minesProEngine.starTiles.slice(0, minesProEngine.starsOpened),
    bombTile: minesProEngine.phase === 'crashed' ? minesProEngine.bombTile : null,
    mines: minesProEngine.phase === 'crashed' ? minesProEngine.mines : undefined,
    crashPoint: minesProEngine.phase === 'crashed' ? minesProEngine.targetCrashPoint : undefined,
    history: (db.minesProHistory || []).slice(0, 20),
  };
}

function settleUncashedMinesProBets(roundId: string, crashPoint: number) {
  const pending = db.bets.filter(
    (b) => b.game === 'mines_pro' && b.periodId === roundId && b.status === 'pending'
  );
  const now = Date.now();
  const userTotals = new Map<string, number>();

  for (const b of pending) {
    b.status = 'lost';
    b.payout = 0;
    b.profit = -b.amount;
    b.resultText = `Mine blast @ ${crashPoint.toFixed(2)}x`;
    b.settledAt = now;
    userTotals.set(b.userId, (userTotals.get(b.userId) || 0) + b.amount);
  }

  for (const [userId, totalStaked] of userTotals.entries()) {
    const u = db.users.find((usr) => usr.id === userId);
    sendToUserWs(userId, {
      type: 'mines_pro:settlement',
      roundId,
      won: false,
      staked: Number(totalStaked.toFixed(2)),
      payout: 0,
      crashPoint,
      balance: u ? u.balance : 0,
    });
  }
  if (pending.length > 0) scheduleSave();
}

function tickMinesProEngine() {
  const now = Date.now();
  const elapsed = now - minesProEngine.phaseStartedAt;

  if (minesProEngine.phase === 'betting') {
    minesProEngine.multiplier = 1.0;
    minesProEngine.starsOpened = 0;
    minesProEngine.bombTile = null;
    if (elapsed >= minesProEngine.bettingDurationMs) {
      minesProEngine.phase = 'flying';
      minesProEngine.phaseStartedAt = now;
      const board = dealMinesProBoard();
      minesProEngine.mines = board.mines;
      minesProEngine.starTiles = board.starTiles;
      minesProEngine.starsOpened = 1;
      minesProEngine.bombTile = null;
      const nextCfg = nextMinesProCrashPoint();
      minesProEngine.targetCrashPoint = Math.min(MINES_PRO_MAX_MULT, nextCfg.crashPoint);
      minesProEngine.isManualTarget = nextCfg.isManual;
      broadcastWs({ type: 'mines_pro:state', state: getMinesProPublicState() });
    }
  } else if (minesProEngine.phase === 'flying') {
    const flightSec = elapsed / 1000;
    const rawMult = Number(Math.pow(Math.E, flightSec * 0.28).toFixed(2));
    const nextMult = Math.min(MINES_PRO_MAX_MULT, rawMult);
    if (nextMult >= minesProEngine.targetCrashPoint || nextMult >= MINES_PRO_MAX_MULT) {
      const finalCrash = Math.min(MINES_PRO_MAX_MULT, minesProEngine.targetCrashPoint);
      minesProEngine.multiplier = finalCrash;
      minesProEngine.phase = 'crashed';
      minesProEngine.phaseStartedAt = now;
      minesProEngine.bombTile = minesProEngine.mines[0] ?? 12;

      if (!db.minesProHistory) db.minesProHistory = [];
      db.minesProHistory.unshift({
        roundId: minesProEngine.roundId,
        crashPoint: finalCrash,
        timestamp: now,
      });
      if (db.minesProHistory.length > 50) {
        db.minesProHistory = db.minesProHistory.slice(0, 50);
      }
      settleUncashedMinesProBets(minesProEngine.roundId, finalCrash);
      scheduleSave();
      broadcastWs({ type: 'mines_pro:state', state: getMinesProPublicState() });
    } else {
      minesProEngine.multiplier = nextMult;
      minesProEngine.starsOpened = computeStarsOpened(nextMult);
      broadcastWs({ type: 'mines_pro:tick', state: getMinesProPublicState() });
    }
  } else if (minesProEngine.phase === 'crashed') {
    if (elapsed >= minesProEngine.crashDurationMs) {
      minesProEngine.roundNumber += 1;
      const istOffsetMs = 5.5 * 60 * 60 * 1000;
      const d = new Date(now + istOffsetMs);
      const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
      minesProEngine.roundId = `MP${ymd}${String(100 + minesProEngine.roundNumber).padStart(4, '0')}`;
      minesProEngine.phase = 'betting';
      minesProEngine.phaseStartedAt = now;
      minesProEngine.multiplier = 1.0;
      minesProEngine.starsOpened = 0;
      minesProEngine.bombTile = null;
      minesProEngine.isManualTarget = false;
      if (
        (db.minesProOverride === null || db.minesProOverride === undefined) &&
        db.minesProNextOverride !== null &&
        db.minesProNextOverride !== undefined &&
        db.minesProNextOverride >= 1.01
      ) {
        db.minesProOverride = Math.min(MINES_PRO_MAX_MULT, db.minesProNextOverride);
        db.minesProNextOverride = null;
        scheduleSave();
      }
      broadcastWs({ type: 'mines_pro:state', state: getMinesProPublicState() });
    }
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // --- AUTH ROUTES ---
  app.post('/api/auth/register', (req, res) => {
    const { username, mobile, password } = req.body || {};
    const cleanUsername = String(username || '').trim();
    const cleanMobile = String(mobile || '').trim();
    const cleanPassword = String(password || '').trim();

    if (
      cleanUsername.length < 4 ||
      cleanUsername.length > 20 ||
      !/^[a-zA-Z0-9_]+$/.test(cleanUsername) ||
      !/(?=.*[a-zA-Z])(?=.*\d)/.test(cleanUsername)
    ) {
      return res.status(400).json({
        error: 'Username must be 4-20 chars mixing letters and numbers (e.g. rahul78).',
      });
    }

    const mobileCheck = validateGenuineMobileServer(cleanMobile);
    if (!mobileCheck.valid) {
      return res.status(400).json({ error: mobileCheck.error });
    }

    if (cleanPassword.length < 6 || cleanPassword.length > 24 || !/(?=.*[a-zA-Z])(?=.*\d)/.test(cleanPassword)) {
      return res.status(400).json({
        error: 'Password must be 6-24 chars mixing letters and numbers (e.g. rahul123).',
      });
    }

    if (db.users.some((u) => u.mobile === cleanMobile)) {
      return res.status(409).json({
        error: 'This mobile number is already registered. Only one ID is allowed per mobile number.',
      });
    }

    if (db.users.some((u) => u.username.toLowerCase() === cleanUsername.toLowerCase())) {
      return res.status(409).json({ error: 'Username is already taken. Choose a different username.' });
    }

    const now = Date.now();
    let seqNum = 1001 + db.users.length;
    let uniqueUserId = `AD78U${seqNum}`;
    while (db.users.some((u) => u.id === uniqueUserId)) {
      seqNum += 1;
      uniqueUserId = `AD78U${seqNum}`;
    }

    const newUser: StoredUser = {
      id: uniqueUserId,
      username: cleanUsername,
      mobile: cleanMobile,
      passwordHash: hashPassword(cleanPassword),
      adminVisiblePassword: cleanPassword,
      balance: 0,
      bonusBalance: 0,
      referralCode: `AD78${Math.floor(1000 + Math.random() * 9000)}`,
      createdAt: now,
      isFrozen: false,
      stakePresets: [10, 50, 100, 500],
    };

    db.users.push(newUser);
    saveNow();

    const token = signToken(`u:${newUser.id}`);
    return res.json({ token, user: sanitizeUser(newUser) });
  });

  app.post('/api/auth/login', (req, res) => {
    const { identifier, mobile, password } = req.body || {};
    const loginKey = String(mobile || identifier || '').trim();
    const cleanPassword = String(password || '').trim();

    if (!loginKey || !cleanPassword) {
      return res.status(400).json({ error: 'User ID, mobile number/username and password are required.' });
    }

    const digitsOnly = loginKey.replace(/\D/g, '');
    const normalizedMobile = digitsOnly.length >= 10 ? digitsOnly.slice(-10) : '';

    const user = db.users.find(
      (u) =>
        u.id.toLowerCase() === loginKey.toLowerCase() ||
        u.username.toLowerCase() === loginKey.toLowerCase() ||
        u.mobile === loginKey ||
        (normalizedMobile.length === 10 && u.mobile === normalizedMobile)
    );

    if (!user || !verifyPassword(cleanPassword, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid User ID, mobile number, username or password.' });
    }

    if (user.isFrozen) {
      return res.status(403).json({ error: 'Account is temporarily frozen. Contact 24x7 support.' });
    }

    const token = signToken(`u:${user.id}`);
    return res.json({ token, user: sanitizeUser(user) });
  });

  app.post('/api/auth/demo', (_req, res) => {
    const demoUser = db.users.find((u) => u.isDemo) || db.users[0];
    if (!demoUser) {
      return res.status(500).json({ error: 'Demo user unavailable.' });
    }
    const token = signToken(`u:${demoUser.id}`);
    return res.json({ token, user: sanitizeUser(demoUser) });
  });

  app.post('/api/auth/forgot-otp', (req, res) => {
    const { identifier } = req.body || {};
    const key = String(identifier || '').trim();
    const user = db.users.find(
      (u) =>
        u.id.toLowerCase() === key.toLowerCase() ||
        u.mobile === key ||
        u.username.toLowerCase() === key.toLowerCase()
    );
    if (!user) {
      return res.status(404).json({ error: 'No account found with that mobile number or username.' });
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    otpStore.set(user.id, { code, userId: user.id, expiresAt: Date.now() + 5 * 60 * 1000 });
    return res.json({
      sent: true,
      maskedMobile: `******${user.mobile.slice(-4)}`,
      demoOtp: code,
    });
  });

  app.post('/api/auth/reset-password', (req, res) => {
    const { identifier, otp, newPassword } = req.body || {};
    const key = String(identifier || '').trim();
    const cleanPass = String(newPassword || '').trim();

    if (cleanPass.length < 6 || cleanPass.length > 24 || !/(?=.*[a-zA-Z])(?=.*\d)/.test(cleanPass)) {
      return res.status(400).json({
        error: 'New password must be 6-24 chars mixing letters and numbers.',
      });
    }

    const user = db.users.find(
      (u) =>
        u.id.toLowerCase() === key.toLowerCase() ||
        u.mobile === key ||
        u.username.toLowerCase() === key.toLowerCase()
    );
    if (!user) {
      return res.status(404).json({ error: 'Account not found.' });
    }

    const entry = otpStore.get(user.id);
    if (!entry || entry.code !== String(otp || '').trim() || entry.expiresAt < Date.now()) {
      return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }

    user.passwordHash = hashPassword(cleanPass);
    user.adminVisiblePassword = cleanPass;
    otpStore.delete(user.id);
    saveNow();
    return res.json({ success: true });
  });

  app.get('/api/auth/me', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    return res.json({ user: sanitizeUser(user) });
  });

  app.post('/api/user/stakes', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Please sign in first.' });
    const presets = Array.isArray(req.body?.stakePresets)
      ? req.body.stakePresets.map(Number).filter((n: number) => Number.isFinite(n) && n >= 1 && n <= 10000).slice(0, 4)
      : [];
    if (presets.length !== 4) {
      return res.status(400).json({ error: 'Provide 4 valid stake preset amounts between ₹1 and ₹10,000.' });
    }
    user.stakePresets = presets;
    scheduleSave();
    return res.json({ user: sanitizeUser(user) });
  });

  app.post('/api/user/bank', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Please sign in first.' });
    const accountHolder = String(req.body?.accountHolder || '').trim();
    const accountNumber = String(req.body?.accountNumber || '').trim();
    const ifsc = String(req.body?.ifsc || '').trim().toUpperCase();
    const bankName = String(req.body?.bankName || '').trim();

    if (accountHolder.length < 2) {
      return res.status(400).json({ error: 'Enter a valid Account Holder Name.' });
    }
    if (!/^\d{6,20}$/.test(accountNumber)) {
      return res.status(400).json({ error: 'Enter a valid Bank Account Number (6-20 digits).' });
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
      return res.status(400).json({ error: 'Enter a valid 11-character IFSC Code (e.g. SBIN0001234).' });
    }
    if (bankName.length < 2) {
      return res.status(400).json({ error: 'Enter your Bank Name.' });
    }

    user.bankAccount = { accountHolder, accountNumber, ifsc, bankName };
    scheduleSave();
    return res.json({ user: sanitizeUser(user) });
  });

  app.post('/api/user/upi', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Please sign in first.' });
    const cleanUpi = String(req.body?.savedUpiId || '').trim();
    if (cleanUpi.length < 5 || !cleanUpi.includes('@')) {
      return res.status(400).json({ error: 'Enter a valid UPI ID (e.g. mobile@ybl or name@okaxis).' });
    }
    user.savedUpiId = cleanUpi;
    scheduleSave();
    return res.json({ user: sanitizeUser(user) });
  });

  app.post('/api/user/change-password', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Please sign in first.' });
    const currentPassword = String(req.body?.currentPassword || '').trim();
    const newPassword = String(req.body?.newPassword || '').trim();

    if (!verifyPassword(currentPassword, user.passwordHash)) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }
    if (
      newPassword.length < 6 ||
      newPassword.length > 24 ||
      !/(?=.*[a-zA-Z])(?=.*\d)/.test(newPassword)
    ) {
      return res.status(400).json({
        error: 'New password must be 6-24 chars mixing letters and numbers (e.g. rahul123).',
      });
    }

    user.passwordHash = hashPassword(newPassword);
    user.adminVisiblePassword = newPassword;
    saveNow();
    return res.json({ success: true });
  });

  // --- WINGO & PLATFORM CONFIG ROUTES ---
  app.get('/api/wingo/state', (_req, res) => {
    return res.json({
      clocks: getWingoClockPayload(),
      platformConfig: normalizePlatformConfig(db.platformConfig),
    });
  });

  app.get('/api/platform/config', (_req, res) => {
    return res.json({
      platformConfig: normalizePlatformConfig(db.platformConfig),
    });
  });

  app.get('/api/export/html', (_req, res) => {
    const htmlPath = path.join(__dirname, 'android-apk', 'AD78-app.html');
    if (fs.existsSync(htmlPath)) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="AD78-app.html"');
      return res.sendFile(htmlPath);
    }
    return res.status(404).json({ error: 'HTML export file not found.' });
  });

  app.post('/api/wingo/bet', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Please sign in to place a bet.' });
    if (user.isFrozen) return res.status(403).json({ error: 'Account frozen.' });

    const { mode, selectionType, selection, amount } = req.body || {};
    if (!['30s', '1m', '3m'].includes(mode)) {
      return res.status(400).json({ error: 'Invalid WinGo mode.' });
    }

    const wingoMode = mode as WingoMode;
    const periodInfo = getPeriodInfo(wingoMode, Date.now());
    if (periodInfo.isLocked) {
      return res.status(400).json({ error: 'Betting closed in final 5 seconds. Wait for next round.' });
    }

    const betAmount = Number(amount);
    if (!Number.isFinite(betAmount) || betAmount < 1 || betAmount > 5000) {
      return res.status(400).json({ error: 'Color Prediction bet must be between ₹1 and ₹5,000.' });
    }

    if (user.balance < betAmount) {
      return res.status(400).json({ error: 'Insufficient wallet balance. Please deposit.' });
    }

    if (
      (selectionType === 'color' && !['green', 'red', 'violet'].includes(selection)) ||
      (selectionType === 'size' && !['big', 'small'].includes(selection)) ||
      (selectionType === 'number' && !/^\d$/.test(String(selection))) ||
      !['color', 'size', 'number'].includes(selectionType)
    ) {
      return res.status(400).json({ error: 'Invalid WinGo selection.' });
    }

    const now = Date.now();
    user.balance = Number((user.balance - betAmount).toFixed(2));

    const bet: BetRecord = {
      id: `bet_${crypto.randomBytes(6).toString('hex')}`,
      userId: user.id,
      username: user.username,
      game: 'wingo',
      mode: wingoMode,
      periodId: periodInfo.periodId,
      selectionType,
      selection: String(selection),
      amount: betAmount,
      multiplier: 0,
      payout: 0,
      profit: -betAmount,
      status: 'pending',
      createdAt: now,
    };

    db.bets.unshift(bet);
    db.transactions.unshift({
      id: `tx_${crypto.randomBytes(6).toString('hex')}`,
      userId: user.id,
      username: user.username,
      mobile: user.mobile,
      type: 'bet',
      amount: betAmount,
      method: `WinGo ${wingoMode}`,
      reference: periodInfo.periodId,
      status: 'completed',
      note: `Bet ₹${betAmount} on ${String(selection).toUpperCase()}`,
      createdAt: now,
      updatedAt: now,
    });

    scheduleSave();

    return res.json({ bet, balance: user.balance });
  });

  // --- AVIATOR ROUTES (MIN ₹10, GLOBAL SYNC) ---
  app.get('/api/aviator/state', (_req, res) => {
    return res.json({ state: getAviatorPublicState() });
  });

  app.post('/api/aviator/bet', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Please sign in to play Aviator.' });
    if (user.isFrozen) return res.status(403).json({ error: 'Account frozen.' });

    if (aviatorEngine.phase !== 'betting') {
      return res.status(400).json({ error: 'Wait for next takeoff countdown to place your bet.' });
    }

    const slot: 1 | 2 = req.body?.slot === 2 ? 2 : 1;
    const betAmount = Number(req.body?.amount);
    if (!Number.isFinite(betAmount) || betAmount < 10 || betAmount > 50000) {
      return res.status(400).json({ error: 'Minimum Aviator bet is ₹10 (max ₹50,000).' });
    }
    if (user.balance < betAmount) {
      return res.status(400).json({ error: 'Insufficient wallet balance. Please deposit.' });
    }

    const alreadyPlaced = db.bets.find(
      (b) =>
        b.game === 'aviator' &&
        b.userId === user.id &&
        b.periodId === aviatorEngine.roundId &&
        (b.slot || 1) === slot &&
        b.status === 'pending'
    );
    if (alreadyPlaced) {
      return res.status(400).json({ error: `Bet #${slot} is already active for this flight.` });
    }

    const now = Date.now();
    user.balance = Number((user.balance - betAmount).toFixed(2));

    const bet: BetRecord = {
      id: `bet_${crypto.randomBytes(6).toString('hex')}`,
      userId: user.id,
      username: user.username,
      game: 'aviator',
      periodId: aviatorEngine.roundId,
      slot,
      selection: `Aviator Bet #${slot}`,
      amount: betAmount,
      multiplier: 0,
      payout: 0,
      profit: -betAmount,
      status: 'pending',
      createdAt: now,
    };

    db.bets.unshift(bet);
    db.transactions.unshift({
      id: `tx_${crypto.randomBytes(6).toString('hex')}`,
      userId: user.id,
      username: user.username,
      mobile: user.mobile,
      type: 'bet',
      amount: betAmount,
      method: `Aviator #${slot}`,
      reference: aviatorEngine.roundId,
      status: 'completed',
      note: `Aviator Bet #${slot} ₹${betAmount}`,
      createdAt: now,
      updatedAt: now,
    });
    scheduleSave();

    return res.json({ bet, balance: user.balance });
  });

  app.post('/api/aviator/cashout', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    if (aviatorEngine.phase !== 'flying') {
      return res.status(400).json({ error: 'Plane is not currently flying.' });
    }

    const reqSlot = req.body?.slot === 2 ? 2 : req.body?.slot === 1 ? 1 : undefined;
    const bet = db.bets.find(
      (b) =>
        b.game === 'aviator' &&
        b.userId === user.id &&
        b.periodId === aviatorEngine.roundId &&
        b.status === 'pending' &&
        (reqSlot ? (b.slot || 1) === reqSlot : true)
    );
    if (!bet) {
      return res.status(400).json({ error: 'No active Aviator bet in this slot.' });
    }

    const mult = Number(aviatorEngine.multiplier.toFixed(2));
    const payout = Number((bet.amount * mult).toFixed(2));
    const now = Date.now();

    bet.multiplier = mult;
    bet.payout = payout;
    bet.profit = Number((payout - bet.amount).toFixed(2));
    bet.status = 'won';
    bet.selection = `Cashout ${mult}x`;
    bet.resultText = `Cashed out @ ${mult.toFixed(2)}x`;
    bet.settledAt = now;

    user.balance = Number((user.balance + payout).toFixed(2));
    db.transactions.unshift({
      id: `tx_${crypto.randomBytes(6).toString('hex')}`,
      userId: user.id,
      username: user.username,
      mobile: user.mobile,
      type: 'win',
      amount: payout,
      method: 'Aviator',
      reference: aviatorEngine.roundId,
      status: 'completed',
      note: `Aviator cashout @ ${mult}x (+₹${payout})`,
      createdAt: now,
      updatedAt: now,
    });
    scheduleSave();

    return res.json({
      won: true,
      multiplier: mult,
      payout,
      balance: user.balance,
      bet,
    });
  });

  // --- MINES PRO ROUTES (3 MINES · MAX 2025x · DOUBLE BETS) ---
  app.get('/api/mines-pro/state', (_req, res) => {
    return res.json({ state: getMinesProPublicState() });
  });

  app.post('/api/mines-pro/bet', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Please sign in to play Mines Pro.' });
    if (user.isFrozen) return res.status(403).json({ error: 'Account frozen.' });

    if (minesProEngine.phase !== 'betting') {
      return res.status(400).json({ error: 'Wait for next climb countdown to place your bet.' });
    }

    const slot: 1 | 2 = req.body?.slot === 2 ? 2 : 1;
    const betAmount = Number(req.body?.amount);
    if (!Number.isFinite(betAmount) || betAmount < 10 || betAmount > 50000) {
      return res.status(400).json({ error: 'Minimum Mines Pro bet is ₹10 (max ₹50,000).' });
    }
    if (user.balance < betAmount) {
      return res.status(400).json({ error: 'Insufficient wallet balance. Please deposit.' });
    }

    const alreadyPlaced = db.bets.find(
      (b) =>
        b.game === 'mines_pro' &&
        b.userId === user.id &&
        b.periodId === minesProEngine.roundId &&
        (b.slot || 1) === slot &&
        b.status === 'pending'
    );
    if (alreadyPlaced) {
      return res.status(400).json({ error: `Bet #${slot} is already active for this round.` });
    }

    const now = Date.now();
    user.balance = Number((user.balance - betAmount).toFixed(2));

    const bet: BetRecord = {
      id: `bet_${crypto.randomBytes(6).toString('hex')}`,
      userId: user.id,
      username: user.username,
      game: 'mines_pro',
      periodId: minesProEngine.roundId,
      slot,
      selection: `Mines Pro Bet #${slot} (3 Mines)`,
      amount: betAmount,
      multiplier: 0,
      payout: 0,
      profit: -betAmount,
      status: 'pending',
      createdAt: now,
    };

    db.bets.unshift(bet);
    db.transactions.unshift({
      id: `tx_${crypto.randomBytes(6).toString('hex')}`,
      userId: user.id,
      username: user.username,
      mobile: user.mobile,
      type: 'bet',
      amount: betAmount,
      method: `Mines Pro #${slot}`,
      reference: minesProEngine.roundId,
      status: 'completed',
      note: `Mines Pro Bet #${slot} ₹${betAmount}`,
      createdAt: now,
      updatedAt: now,
    });
    scheduleSave();

    return res.json({ bet, balance: user.balance });
  });

  app.post('/api/mines-pro/cashout', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    if (minesProEngine.phase !== 'flying') {
      return res.status(400).json({ error: 'Round is not currently climbing.' });
    }

    const reqSlot = req.body?.slot === 2 ? 2 : req.body?.slot === 1 ? 1 : undefined;
    const bet = db.bets.find(
      (b) =>
        b.game === 'mines_pro' &&
        b.userId === user.id &&
        b.periodId === minesProEngine.roundId &&
        b.status === 'pending' &&
        (reqSlot ? (b.slot || 1) === reqSlot : true)
    );
    if (!bet) {
      return res.status(400).json({ error: 'No active Mines Pro bet in this slot.' });
    }

    const mult = Math.min(MINES_PRO_MAX_MULT, Number(minesProEngine.multiplier.toFixed(2)));
    const payout = Number((bet.amount * mult).toFixed(2));
    const now = Date.now();

    bet.multiplier = mult;
    bet.payout = payout;
    bet.profit = Number((payout - bet.amount).toFixed(2));
    bet.status = 'won';
    bet.selection = `Cashout ${mult}x`;
    bet.resultText = `Cashed out @ ${mult.toFixed(2)}x`;
    bet.settledAt = now;

    user.balance = Number((user.balance + payout).toFixed(2));
    db.transactions.unshift({
      id: `tx_${crypto.randomBytes(6).toString('hex')}`,
      userId: user.id,
      username: user.username,
      mobile: user.mobile,
      type: 'win',
      amount: payout,
      method: 'Mines Pro',
      reference: minesProEngine.roundId,
      status: 'completed',
      note: `Mines Pro cashout @ ${mult}x (+₹${payout})`,
      createdAt: now,
      updatedAt: now,
    });
    scheduleSave();

    return res.json({
      won: true,
      multiplier: mult,
      payout,
      balance: user.balance,
      bet,
    });
  });

  // --- DEPOSIT (₹200 - ₹50,000, PROCESSING UNTIL ADMIN APPROVAL) & WITHDRAWAL (MIN ₹110) ---
  app.post('/api/wallet/deposit', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Please sign in first.' });
    if (user.isFrozen) return res.status(403).json({ error: 'Account frozen.' });

    const { amount, method, reference, screenshotData } = req.body || {};
    const methodLower = String(method || '').trim().toLowerCase();
    if (!methodLower || (!methodLower.includes('bank') && !methodLower.includes('upi'))) {
      return res.status(400).json({ error: 'Only Bank Transfer and UPI deposits are supported.' });
    }
    const depAmount = Number(amount);
    if (!Number.isFinite(depAmount) || depAmount < 200 || depAmount > 50000) {
      return res.status(400).json({ error: 'Deposit amount must be between ₹200 and ₹50,000.' });
    }

    const utrCheck = validateDepositUtrServer(String(reference || ''));
    if (!utrCheck.valid) {
      return res.status(400).json({ error: utrCheck.error });
    }
    const cleanRef = utrCheck.clean;

    const cleanScreenshot =
      typeof screenshotData === 'string' && screenshotData.startsWith('data:image/')
        ? screenshotData.slice(0, 3_500_000)
        : undefined;
    if (!cleanScreenshot) {
      return res.status(400).json({
        error: 'Payment screenshot upload is required (Fake deposits without proof are not allowed).',
      });
    }

    // Reject duplicate UTR reuse across existing non-rejected deposits
    const duplicateTx = db.transactions.find(
      (t) =>
        t.type === 'deposit' &&
        t.status !== 'rejected' &&
        (t.reference || '').trim().toUpperCase() === cleanRef
    );
    if (duplicateTx) {
      return res.status(400).json({
        error: 'Fake/Duplicate UTR rejected: This UTR reference was already submitted.',
      });
    }

    const isStandard12Digit = /^\d{12}$/.test(cleanRef);
    const utrFlag = isStandard12Digit
      ? undefined
      : 'Non-12-digit UTR — Verify Screenshot Carefully';

    const now = Date.now();
    const methodStr = String(method || 'UPI');
    const isBankMethod = methodStr.toLowerCase().includes('bank');
    const cfgBonusPct = normalizePlatformConfig(db.platformConfig).bankBonusPercent ?? 5;
    const bonus = isBankMethod && cfgBonusPct > 0 ? Number(((depAmount * cfgBonusPct) / 100).toFixed(2)) : 0;

    // Deposit remains in 'pending' (Processing) until verified & approved in Admin Panel
    const tx: TransactionRecord = {
      id: `PRC${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      userId: user.id,
      username: user.username,
      mobile: user.mobile,
      type: 'deposit',
      amount: Number(depAmount.toFixed(2)),
      method: methodStr,
      reference: cleanRef,
      screenshotData: cleanScreenshot,
      pendingBonus: bonus > 0 ? bonus : undefined,
      status: 'pending',
      utrFlag,
      note:
        bonus > 0
          ? `Deposit ₹${depAmount} (+₹${bonus} Bank Bonus on approval) · UTR: ${cleanRef}`
          : `Deposit via ${methodStr} · UTR: ${cleanRef}`,
      createdAt: now,
      updatedAt: now,
    };

    db.transactions.unshift(tx);
    scheduleSave();
    sendToUserWs(user.id, { type: 'wallet:update', balance: user.balance });

    return res.json({ transaction: tx, pendingBonus: bonus, balance: user.balance });
  });

  // --- MINES GAME ROUTES ---
  function computeMinesMultiplier(minesCount: number, safePicks: number): number {
    if (safePicks <= 0) return 1.0;
    let mult = 0.97;
    for (let i = 0; i < safePicks; i++) {
      mult *= (25 - i) / (25 - minesCount - i);
    }
    return Math.max(1.01, Number(mult.toFixed(2)));
  }

  function sanitizeMinesSession(s: MinesSession, revealMines = false) {
    const maxSafe = 25 - s.minesCount;
    const nextMult =
      s.revealed.length + 1 <= maxSafe
        ? computeMinesMultiplier(s.minesCount, s.revealed.length + 1)
        : s.multiplier;
    return {
      id: s.id,
      stake: s.stake,
      minesCount: s.minesCount,
      revealed: s.revealed,
      multiplier: s.multiplier,
      currentPayout: Number((s.stake * s.multiplier).toFixed(2)),
      nextMultiplier: nextMult,
      status: s.status,
      ...(revealMines ? { mines: s.mines } : {}),
    };
  }

  app.get('/api/mines/active', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const session = db.minesSessions?.[user.id];
    if (!session || session.status !== 'active') {
      return res.json({ session: null });
    }
    return res.json({ session: sanitizeMinesSession(session, false) });
  });

  app.post('/api/mines/start', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Please sign in to play Mines.' });
    if (user.isFrozen) return res.status(403).json({ error: 'Account frozen.' });

    if (!db.minesSessions) db.minesSessions = {};
    const existing = db.minesSessions[user.id];
    if (existing && existing.status === 'active') {
      return res.status(400).json({
        error: 'You already have an active Mines round. Cashout or finish it first.',
        session: sanitizeMinesSession(existing, false),
      });
    }

    const stake = Number(req.body?.amount);
    const minesCount = Number(req.body?.minesCount);
    if (!Number.isFinite(stake) || stake < 10 || stake > 50000) {
      return res.status(400).json({ error: 'Mines stake must be between ₹10 and ₹50,000.' });
    }
    if (!Number.isInteger(minesCount) || minesCount < 1 || minesCount > 24) {
      return res.status(400).json({ error: 'Mines count must be between 1 and 24.' });
    }
    if (user.balance < stake) {
      return res.status(400).json({ error: 'Insufficient wallet balance. Please deposit.' });
    }

    const pool = Array.from({ length: 25 }, (_, i) => i);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const mines = pool.slice(0, minesCount);

    const minesMode = getGameMode('mines');
    const shouldWinRound =
      !user.isDemo && minesMode === 'fair' ? undefined : consumeUserOutcome(user, 'mines');
    const lossPickIndex = shouldWinRound === false ? crypto.randomInt(0, 2) : undefined;

    const now = Date.now();
    user.balance = Number((user.balance - stake).toFixed(2));
    const sessionId = `MN${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const betId = `bet_${crypto.randomBytes(6).toString('hex')}`;

    const session: MinesSession = {
      id: sessionId,
      betId,
      userId: user.id,
      username: user.username,
      stake: Number(stake.toFixed(2)),
      minesCount,
      mines,
      revealed: [],
      multiplier: 1.0,
      shouldWinRound,
      lossPickIndex,
      status: 'active',
      createdAt: now,
    };
    db.minesSessions[user.id] = session;

    const bet: BetRecord = {
      id: betId,
      userId: user.id,
      username: user.username,
      game: 'mines',
      periodId: sessionId,
      selection: `${minesCount} Mines`,
      amount: session.stake,
      multiplier: 1.0,
      payout: 0,
      profit: -session.stake,
      status: 'pending',
      createdAt: now,
    };
    db.bets.unshift(bet);
    db.transactions.unshift({
      id: `tx_${crypto.randomBytes(6).toString('hex')}`,
      userId: user.id,
      username: user.username,
      mobile: user.mobile,
      type: 'bet',
      amount: session.stake,
      method: 'Mines',
      reference: sessionId,
      status: 'completed',
      note: `Mines round started (${minesCount} mines)`,
      createdAt: now,
      updatedAt: now,
    });

    scheduleSave();
    sendToUserWs(user.id, { type: 'wallet:update', balance: user.balance });
    return res.json({ session: sanitizeMinesSession(session, false), balance: user.balance });
  });

  app.post('/api/mines/pick', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Please sign in first.' });
    if (user.isFrozen) return res.status(403).json({ error: 'Account frozen.' });

    const session = db.minesSessions?.[user.id];
    if (!session || session.status !== 'active') {
      return res.status(400).json({ error: 'No active Mines round found.' });
    }

    const tileIdx = Number(req.body?.tileIndex);
    if (!Number.isInteger(tileIdx) || tileIdx < 0 || tileIdx > 24) {
      return res.status(400).json({ error: 'Invalid tile index (0-24).' });
    }
    if (session.revealed.includes(tileIdx)) {
      return res.status(400).json({ error: 'Tile already opened.' });
    }

    if (db.minesForceNextBomb && !session.mines.includes(tileIdx)) {
      const swapPos = session.mines.findIndex((m) => !session.revealed.includes(m));
      if (swapPos !== -1) {
        session.mines[swapPos] = tileIdx;
      }
      db.minesForceNextBomb = false;
    } else if (db.minesForceNextBomb) {
      db.minesForceNextBomb = false;
    } else if (session.shouldWinRound === true && session.revealed.length < 3 && session.mines.includes(tileIdx)) {
      const safeAlternate = Array.from({ length: 25 }, (_, i) => i).find(
        (idx) => idx !== tileIdx && !session.mines.includes(idx) && !session.revealed.includes(idx)
      );
      if (safeAlternate !== undefined) {
        const minePos = session.mines.indexOf(tileIdx);
        if (minePos !== -1) session.mines[minePos] = safeAlternate;
      }
    } else if (
      session.shouldWinRound === false &&
      session.revealed.length === (session.lossPickIndex ?? 0) &&
      !session.mines.includes(tileIdx)
    ) {
      const swapPos = session.mines.findIndex((m) => !session.revealed.includes(m));
      if (swapPos !== -1) {
        session.mines[swapPos] = tileIdx;
      }
    }

    const now = Date.now();
    const bet = db.bets.find((b) => b.id === session.betId);

    if (session.mines.includes(tileIdx)) {
      session.status = 'lost';
      if (bet) {
        bet.status = 'lost';
        bet.multiplier = 0;
        bet.payout = 0;
        bet.profit = -session.stake;
        bet.resultText = `Bomb @ tile #${tileIdx + 1}`;
        bet.settledAt = now;
      }
      scheduleSave();
      return res.json({
        hitBomb: true,
        tileIndex: tileIdx,
        session: sanitizeMinesSession(session, true),
        balance: user.balance,
        bet,
      });
    }

    session.revealed.push(tileIdx);
    session.multiplier = computeMinesMultiplier(session.minesCount, session.revealed.length);

    const maxSafe = 25 - session.minesCount;
    if (session.revealed.length >= maxSafe) {
      const payout = Number((session.stake * session.multiplier).toFixed(2));
      const profit = Number((payout - session.stake).toFixed(2));
      session.status = 'won';
      user.balance = Number((user.balance + payout).toFixed(2));
      if (bet) {
        bet.status = 'won';
        bet.multiplier = session.multiplier;
        bet.payout = payout;
        bet.profit = profit;
        bet.resultText = `Cleared all ${maxSafe} gems @ ${session.multiplier.toFixed(2)}x`;
        bet.settledAt = now;
      }
      db.transactions.unshift({
        id: `tx_${crypto.randomBytes(6).toString('hex')}`,
        userId: user.id,
        username: user.username,
        mobile: user.mobile,
        type: 'win',
        amount: payout,
        method: 'Mines',
        reference: session.id,
        status: 'completed',
        note: `Mines full clear win @ ${session.multiplier.toFixed(2)}x`,
        createdAt: now,
        updatedAt: now,
      });
      scheduleSave();
      sendToUserWs(user.id, { type: 'wallet:update', balance: user.balance });
      return res.json({
        hitBomb: false,
        autoCashout: true,
        tileIndex: tileIdx,
        payout,
        session: sanitizeMinesSession(session, true),
        balance: user.balance,
        bet,
      });
    }

    scheduleSave();
    return res.json({
      hitBomb: false,
      tileIndex: tileIdx,
      session: sanitizeMinesSession(session, false),
      balance: user.balance,
    });
  });

  app.post('/api/mines/cashout', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Please sign in first.' });
    if (user.isFrozen) return res.status(403).json({ error: 'Account frozen.' });

    const session = db.minesSessions?.[user.id];
    if (!session || session.status !== 'active') {
      return res.status(400).json({ error: 'No active Mines round to cashout.' });
    }
    if (session.revealed.length < 1) {
      return res.status(400).json({ error: 'Open at least 1 safe gem tile before cashing out.' });
    }

    const now = Date.now();
    const payout = Number((session.stake * session.multiplier).toFixed(2));
    const profit = Number((payout - session.stake).toFixed(2));
    session.status = 'won';
    user.balance = Number((user.balance + payout).toFixed(2));

    const bet = db.bets.find((b) => b.id === session.betId);
    if (bet) {
      bet.status = 'won';
      bet.multiplier = session.multiplier;
      bet.payout = payout;
      bet.profit = profit;
      bet.resultText = `${session.revealed.length} Gems @ ${session.multiplier.toFixed(2)}x`;
      bet.settledAt = now;
    }

    db.transactions.unshift({
      id: `tx_${crypto.randomBytes(6).toString('hex')}`,
      userId: user.id,
      username: user.username,
      mobile: user.mobile,
      type: 'win',
      amount: payout,
      method: 'Mines',
      reference: session.id,
      status: 'completed',
      note: `Mines cashout ${session.revealed.length} gems @ ${session.multiplier.toFixed(2)}x`,
      createdAt: now,
      updatedAt: now,
    });

    scheduleSave();
    sendToUserWs(user.id, { type: 'wallet:update', balance: user.balance });
    return res.json({
      won: true,
      payout,
      multiplier: session.multiplier,
      session: sanitizeMinesSession(session, true),
      balance: user.balance,
      bet,
    });
  });

  // --- DICE GAME ROUTES ---
  app.post('/api/dice/roll', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Please sign in to play Dice.' });
    if (user.isFrozen) return res.status(403).json({ error: 'Account frozen.' });

    const stake = Number(req.body?.amount);
    const direction = req.body?.direction === 'under' ? 'under' : 'over';
    const target = Number(req.body?.target);

    if (!Number.isFinite(stake) || stake < 10 || stake > 50000) {
      return res.status(400).json({ error: 'Dice stake must be between ₹10 and ₹50,000.' });
    }
    if (!Number.isInteger(target) || target < 2 || target > 98) {
      return res.status(400).json({ error: 'Target must be between 2 and 98.' });
    }
    if (user.balance < stake) {
      return res.status(400).json({ error: 'Insufficient wallet balance. Please deposit.' });
    }

    let roll: number;
    if (typeof db.diceNextOverride === 'number' && Number.isFinite(db.diceNextOverride)) {
      roll = Number(Math.max(0, Math.min(99.99, db.diceNextOverride)).toFixed(2));
      db.diceNextOverride = null;
    } else if (db.diceForceLoss) {
      if (direction === 'under') {
        const minInt = target * 100;
        roll = Number((crypto.randomInt(minInt, 10000) / 100).toFixed(2));
      } else {
        const maxInt = target * 100 + 1;
        roll = Number((crypto.randomInt(0, maxInt) / 100).toFixed(2));
      }
      db.diceForceLoss = false;
    } else {
      const shouldWin = consumeUserOutcome(user, 'dice');
      if (shouldWin) {
        if (direction === 'under') {
          const maxInt = Math.max(1, target * 100);
          roll = Number((crypto.randomInt(0, maxInt) / 100).toFixed(2));
        } else {
          const minInt = Math.min(9999, target * 100 + 1);
          roll = Number((crypto.randomInt(minInt, 10000) / 100).toFixed(2));
        }
      } else {
        if (direction === 'under') {
          const minInt = target * 100;
          roll = Number((crypto.randomInt(minInt, 10000) / 100).toFixed(2));
        } else {
          const maxInt = target * 100 + 1;
          roll = Number((crypto.randomInt(0, maxInt) / 100).toFixed(2));
        }
      }
    }

    const winChance = direction === 'under' ? target : 100 - target;
    const multiplier = Number((98 / winChance).toFixed(2));
    const won = direction === 'under' ? roll < target : roll > target;
    const payout = won ? Number((stake * multiplier).toFixed(2)) : 0;
    const profit = Number((payout - stake).toFixed(2));

    const now = Date.now();
    user.balance = Number((user.balance - stake + payout).toFixed(2));
    const roundId = `DC${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const bet: BetRecord = {
      id: `bet_${crypto.randomBytes(6).toString('hex')}`,
      userId: user.id,
      username: user.username,
      game: 'dice',
      periodId: roundId,
      selection: `${direction.toUpperCase()} ${target}`,
      amount: Number(stake.toFixed(2)),
      multiplier: won ? multiplier : 0,
      payout,
      profit,
      status: won ? 'won' : 'lost',
      resultText: `Roll ${roll.toFixed(2)}`,
      createdAt: now,
      settledAt: now,
    };

    db.bets.unshift(bet);
    db.transactions.unshift({
      id: `tx_${crypto.randomBytes(6).toString('hex')}`,
      userId: user.id,
      username: user.username,
      mobile: user.mobile,
      type: won ? 'win' : 'bet',
      amount: won ? payout : Number(stake.toFixed(2)),
      method: 'Dice',
      reference: roundId,
      status: 'completed',
      note: won
        ? `Dice won (${direction.toUpperCase()} ${target}, roll ${roll.toFixed(2)}) @ ${multiplier.toFixed(2)}x`
        : `Dice lost (${direction.toUpperCase()} ${target}, roll ${roll.toFixed(2)})`,
      createdAt: now,
      updatedAt: now,
    });

    scheduleSave();
    sendToUserWs(user.id, { type: 'wallet:update', balance: user.balance });
    return res.json({
      roll,
      won,
      multiplier,
      payout,
      profit,
      balance: user.balance,
      target,
      direction,
      bet,
    });
  });

  // --- CHICKEN ROAD GAME ROUTES ---
  const CHICKEN_MULT_TABLE: Record<ChickenDifficulty, number[]> = {
    easy: [1.24, 1.55, 1.98, 2.6, 3.55, 5.1, 7.8],
    medium: [1.62, 2.68, 4.5, 7.8, 14.2, 27.5, 55.0],
    hard: [2.4, 5.9, 15.0, 39.0, 102.0, 180.0, 250.0],
  };
  const CHICKEN_RISK_PROB: Record<ChickenDifficulty, number> = {
    easy: 0.2,
    medium: 0.36,
    hard: 0.54,
  };

  function sanitizeChickenSession(s: ChickenRoadSession) {
    const curMult = s.currentLane > 0 ? s.multipliers[s.currentLane - 1] || 1 : 1.0;
    const nextMult =
      s.currentLane < s.totalLanes ? s.multipliers[s.currentLane] || curMult : curMult;
    return {
      id: s.id,
      stake: s.stake,
      difficulty: s.difficulty,
      currentLane: s.currentLane,
      totalLanes: s.totalLanes,
      multipliers: s.multipliers,
      currentMultiplier: curMult,
      currentPayout: s.currentLane > 0 ? Number((s.stake * curMult).toFixed(2)) : s.stake,
      nextMultiplier: nextMult,
      status: s.status,
      hitLane: s.hitLane ?? null,
    };
  }

  app.get('/api/chicken-road/active', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const session = db.chickenSessions?.[user.id];
    if (!session || session.status !== 'active') {
      return res.json({ session: null });
    }
    return res.json({ session: sanitizeChickenSession(session) });
  });

  app.post('/api/chicken-road/start', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Please sign in to play Chicken Road.' });
    if (user.isFrozen) return res.status(403).json({ error: 'Account frozen.' });

    if (!db.chickenSessions) db.chickenSessions = {};
    const existing = db.chickenSessions[user.id];
    if (existing && existing.status === 'active') {
      return res.status(400).json({
        error: 'Finish or cash out your active Chicken Road run first.',
        session: sanitizeChickenSession(existing),
      });
    }

    const stake = Number(req.body?.amount);
    const diff: ChickenDifficulty =
      req.body?.difficulty === 'hard'
        ? 'hard'
        : req.body?.difficulty === 'medium'
        ? 'medium'
        : 'easy';
    if (!Number.isFinite(stake) || stake < 50 || stake > 1000) {
      return res.status(400).json({ error: 'Chicken Road stake must be between ₹50 and ₹1,000.' });
    }
    if (user.balance < stake) {
      return res.status(400).json({ error: 'Insufficient wallet balance. Please deposit.' });
    }

    const multipliers = CHICKEN_MULT_TABLE[diff];
    const shouldWin = consumeUserOutcome(user, 'chicken_road');
    const trapLanes: number[] = shouldWin ? [] : [crypto.randomInt(0, 2)];

    const now = Date.now();
    user.balance = Number((user.balance - stake).toFixed(2));
    const sessionId = `CR${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const betId = `bet_${crypto.randomBytes(6).toString('hex')}`;

    const session: ChickenRoadSession = {
      id: sessionId,
      betId,
      userId: user.id,
      username: user.username,
      stake: Number(stake.toFixed(2)),
      difficulty: diff,
      currentLane: 0,
      totalLanes: multipliers.length,
      multipliers,
      trapLanes,
      status: 'active',
      createdAt: now,
    };
    db.chickenSessions[user.id] = session;

    db.bets.unshift({
      id: betId,
      userId: user.id,
      username: user.username,
      game: 'chicken_road',
      periodId: sessionId,
      selection: `${diff.toUpperCase()} Road`,
      amount: session.stake,
      multiplier: 1.0,
      payout: 0,
      profit: -session.stake,
      status: 'pending',
      createdAt: now,
    });
    db.transactions.unshift({
      id: `tx_${crypto.randomBytes(6).toString('hex')}`,
      userId: user.id,
      username: user.username,
      mobile: user.mobile,
      type: 'bet',
      amount: session.stake,
      method: 'Chicken Road',
      reference: sessionId,
      status: 'completed',
      note: `Chicken Road (${diff}) started`,
      createdAt: now,
      updatedAt: now,
    });

    scheduleSave();
    sendToUserWs(user.id, { type: 'wallet:update', balance: user.balance });
    return res.json({ session: sanitizeChickenSession(session), balance: user.balance });
  });

  app.post('/api/chicken-road/step', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Please sign in first.' });
    if (user.isFrozen) return res.status(403).json({ error: 'Account frozen.' });

    const session = db.chickenSessions?.[user.id];
    if (!session || session.status !== 'active') {
      return res.status(400).json({ error: 'No active Chicken Road run.' });
    }

    const nextLaneIdx = session.currentLane;
    const bet = db.bets.find((b) => b.id === session.betId);
    const now = Date.now();

    let hitTrap = session.trapLanes.includes(nextLaneIdx);
    if (db.chickenForceNextTrap) {
      hitTrap = true;
      db.chickenForceNextTrap = false;
    }

    if (hitTrap) {
      session.status = 'lost';
      session.hitLane = nextLaneIdx + 1;
      if (bet) {
        bet.status = 'lost';
        bet.multiplier = 0;
        bet.payout = 0;
        bet.profit = -session.stake;
        bet.resultText = `Caught on Lane ${nextLaneIdx + 1}`;
        bet.settledAt = now;
      }
      scheduleSave();
      return res.json({
        hitTrap: true,
        session: sanitizeChickenSession(session),
        balance: user.balance,
        bet,
      });
    }

    session.currentLane += 1;
    const curMult = session.multipliers[session.currentLane - 1] || 1;

    if (session.currentLane >= session.totalLanes) {
      const payout = Number((session.stake * curMult).toFixed(2));
      const profit = Number((payout - session.stake).toFixed(2));
      session.status = 'won';
      user.balance = Number((user.balance + payout).toFixed(2));
      if (bet) {
        bet.status = 'won';
        bet.multiplier = curMult;
        bet.payout = payout;
        bet.profit = profit;
        bet.resultText = `Crossed all ${session.totalLanes} lanes @ ${curMult.toFixed(2)}x`;
        bet.settledAt = now;
      }
      db.transactions.unshift({
        id: `tx_${crypto.randomBytes(6).toString('hex')}`,
        userId: user.id,
        username: user.username,
        mobile: user.mobile,
        type: 'win',
        amount: payout,
        method: 'Chicken Road',
        reference: session.id,
        status: 'completed',
        note: `Chicken Road full cross win @ ${curMult.toFixed(2)}x`,
        createdAt: now,
        updatedAt: now,
      });
      scheduleSave();
      sendToUserWs(user.id, { type: 'wallet:update', balance: user.balance });
      return res.json({
        hitTrap: false,
        autoCashout: true,
        payout,
        session: sanitizeChickenSession(session),
        balance: user.balance,
        bet,
      });
    }

    scheduleSave();
    return res.json({
      hitTrap: false,
      session: sanitizeChickenSession(session),
      balance: user.balance,
    });
  });

  app.post('/api/chicken-road/cashout', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Please sign in first.' });
    if (user.isFrozen) return res.status(403).json({ error: 'Account frozen.' });

    const session = db.chickenSessions?.[user.id];
    if (!session || session.status !== 'active') {
      return res.status(400).json({ error: 'No active Chicken Road run to cashout.' });
    }
    if (session.currentLane < 1) {
      return res.status(400).json({ error: 'Cross at least 1 highway lane before cashing out.' });
    }

    const now = Date.now();
    const mult = session.multipliers[session.currentLane - 1] || 1;
    const payout = Number((session.stake * mult).toFixed(2));
    const profit = Number((payout - session.stake).toFixed(2));
    session.status = 'won';
    user.balance = Number((user.balance + payout).toFixed(2));

    const bet = db.bets.find((b) => b.id === session.betId);
    if (bet) {
      bet.status = 'won';
      bet.multiplier = mult;
      bet.payout = payout;
      bet.profit = profit;
      bet.resultText = `Lane ${session.currentLane} @ ${mult.toFixed(2)}x`;
      bet.settledAt = now;
    }

    db.transactions.unshift({
      id: `tx_${crypto.randomBytes(6).toString('hex')}`,
      userId: user.id,
      username: user.username,
      mobile: user.mobile,
      type: 'win',
      amount: payout,
      method: 'Chicken Road',
      reference: session.id,
      status: 'completed',
      note: `Chicken Road cashout @ ${mult.toFixed(2)}x`,
      createdAt: now,
      updatedAt: now,
    });

    scheduleSave();
    sendToUserWs(user.id, { type: 'wallet:update', balance: user.balance });
    return res.json({
      won: true,
      payout,
      multiplier: mult,
      session: sanitizeChickenSession(session),
      balance: user.balance,
      bet,
    });
  });

  // --- VORTEX ELEMENTAL SPIN ROUTE (₹5 - ₹100 · FIRE / EARTH / WATER / SKULL) ---
  app.post('/api/vertex/play', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Please sign in to play Vortex.' });
    if (user.isFrozen) return res.status(403).json({ error: 'Account frozen.' });

    const stake = Number(req.body?.amount);
    const rawTarget = req.body?.targetMultiplier;
    const isWheelMode = req.body?.mode === 'wheel' || rawTarget === undefined;
    const target = isWheelMode ? 1.55 : Number(rawTarget);
    if (!Number.isFinite(stake) || stake < 5 || stake > 100) {
      return res.status(400).json({ error: 'Vortex stake must be between ₹5 and ₹100.' });
    }
    if (!Number.isFinite(target) || target < 1.1 || target > 200) {
      return res.status(400).json({ error: 'Target multiplier must be between 1.10x and 200.00x.' });
    }
    if (user.balance < stake) {
      return res.status(400).json({ error: 'Insufficient wallet balance. Please deposit.' });
    }

    const FIRE_STEPS = [3.9, 12.5, 28.0, 52.0, 85.0, 133.0, 200.0];
    const EARTH_STEPS = [2.5, 7.7, 16.0, 27.5, 44.0];
    const WATER_STEPS = [1.55, 4.85, 10.0];

    if (!db.vortexRings) db.vortexRings = {};
    const prevRings = db.vortexRings[user.id] || { fire: 0, earth: 0, water: 0 };

    const cleanTarget = Number(target.toFixed(2));
    let peakMultiplier = 0;
    let won = false;
    let winMult = 0;
    let outcomeElement: 'fire' | 'earth' | 'water' | 'skull' = 'skull';
    let nextRings = { ...prevRings };

    if (typeof db.vertexNextOverride === 'number' && Number.isFinite(db.vertexNextOverride)) {
      peakMultiplier = Number(Math.max(0, Math.min(200.0, db.vertexNextOverride)).toFixed(2));
      db.vertexNextOverride = null;
      if (peakMultiplier >= 1.1) {
        won = true;
        winMult = isWheelMode ? peakMultiplier : cleanTarget;
        outcomeElement = peakMultiplier >= 10 ? 'fire' : peakMultiplier >= 4 ? 'earth' : 'water';
      } else {
        won = false;
        winMult = 0;
        outcomeElement = 'skull';
      }
    } else if (db.vertexForceLoss) {
      peakMultiplier = 0;
      db.vertexForceLoss = false;
      won = false;
      winMult = 0;
      outcomeElement = 'skull';
    } else {
      const shouldWin = consumeUserOutcome(user);
      if (shouldWin) {
        const elems: ('water' | 'earth' | 'fire')[] = ['water', 'earth', 'fire', 'water', 'earth', 'water'];
        const chosen = elems[crypto.randomInt(0, elems.length)];
        outcomeElement = chosen;
        if (chosen === 'fire') {
          const idx = Math.min(FIRE_STEPS.length - 1, nextRings.fire);
          nextRings.fire = (nextRings.fire + 1) % FIRE_STEPS.length;
          winMult = FIRE_STEPS[idx];
        } else if (chosen === 'earth') {
          const idx = Math.min(EARTH_STEPS.length - 1, nextRings.earth);
          nextRings.earth = (nextRings.earth + 1) % EARTH_STEPS.length;
          winMult = EARTH_STEPS[idx];
        } else {
          const idx = Math.min(WATER_STEPS.length - 1, nextRings.water);
          nextRings.water = (nextRings.water + 1) % WATER_STEPS.length;
          winMult = WATER_STEPS[idx];
        }
        if (!isWheelMode) {
          winMult = cleanTarget;
        }
        peakMultiplier = winMult;
        won = true;
      } else {
        outcomeElement = 'skull';
        peakMultiplier = 0;
        won = false;
        winMult = 0;
      }
    }

    if (outcomeElement === 'skull') {
      nextRings = { fire: 0, earth: 0, water: 0 };
    }
    db.vortexRings[user.id] = nextRings;

    const payout = won ? Number((stake * winMult).toFixed(2)) : 0;
    const profit = Number((payout - stake).toFixed(2));
    const now = Date.now();
    user.balance = Number((user.balance - stake + payout).toFixed(2));
    const roundId = `VX${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const FIRE_RING = ['BONUS', '3.9X', '12.5X', '28X', '52X', '85X', '133X', '200X'];
    const CLOVER_RING = ['+20.5X', '2.5X', '7.7X', '16X', '27.5X', '44X'];
    const WATER_RING = ['+7X', '1.55X', '4.85X', '10X'];

    const ringSummary = {
      fire: FIRE_RING[Math.min(FIRE_RING.length - 1, nextRings.fire)],
      clover: CLOVER_RING[Math.min(CLOVER_RING.length - 1, nextRings.earth)],
      water: WATER_RING[Math.min(WATER_RING.length - 1, nextRings.water)],
    };

    const bet: BetRecord = {
      id: `bet_${crypto.randomBytes(6).toString('hex')}`,
      userId: user.id,
      username: user.username,
      game: 'vertex',
      periodId: roundId,
      selection: isWheelMode ? `Vortex Spin (${outcomeElement.toUpperCase()})` : `Target ${cleanTarget.toFixed(2)}x`,
      amount: Number(stake.toFixed(2)),
      multiplier: winMult,
      payout,
      profit,
      status: won ? 'won' : 'lost',
      resultText: won
        ? `${outcomeElement.toUpperCase()} ${winMult.toFixed(2)}x`
        : 'SKULL BUST (0.00x)',
      createdAt: now,
      settledAt: now,
    };

    db.bets.unshift(bet);
    db.transactions.unshift({
      id: `tx_${crypto.randomBytes(6).toString('hex')}`,
      userId: user.id,
      username: user.username,
      mobile: user.mobile,
      type: won ? 'win' : 'bet',
      amount: won ? payout : Number(stake.toFixed(2)),
      method: 'Vortex',
      reference: roundId,
      status: 'completed',
      note: won
        ? `Vortex ${outcomeElement.toUpperCase()} won @ ${winMult.toFixed(2)}x (₹${payout})`
        : 'Vortex spin — Skull Bust 💀',
      createdAt: now,
      updatedAt: now,
    });

    scheduleSave();
    sendToUserWs(user.id, { type: 'wallet:update', balance: user.balance });
    return res.json({
      peakMultiplier,
      targetMultiplier: winMult || cleanTarget,
      outcomeElement,
      elementMultiplier: winMult,
      ringSteps: nextRings,
      ringSummary,
      won,
      payout,
      profit,
      balance: user.balance,
      bet,
    });
  });

  // --- CRYSTAL POKER (5 FACETED CRYSTALS · ₹10 - ₹1,000) ---
  app.post('/api/crystal/play', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Please sign in to play Crystal Poker.' });
    if (user.isFrozen) return res.status(403).json({ error: 'Account frozen.' });

    const stake = Number(req.body?.amount);
    if (!Number.isFinite(stake) || stake < 10 || stake > 1000) {
      return res.status(400).json({ error: 'Crystal Poker stake must be between ₹10 and ₹1,000.' });
    }
    if (user.balance < stake) {
      return res.status(400).json({ error: 'Insufficient wallet balance. Please deposit.' });
    }

    const gems: CrystalGemType[] = ['emerald', 'ruby', 'amethyst', 'gold', 'sapphire'];

    const evaluateHand = (cards: CrystalGemType[]) => {
      const map = new Map<CrystalGemType, number[]>();
      cards.forEach((g, idx) => {
        const list = map.get(g) || [];
        list.push(idx);
        map.set(g, list);
      });
      const groups = Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
      const topLen = groups[0]?.[1].length || 0;
      const secondLen = groups[1]?.[1].length || 0;

      if (topLen === 5) {
        return {
          handName: 'Five of a Kind',
          multiplier: 100.0,
          winningIndices: groups[0][1],
        };
      }
      if (topLen === 4) {
        return {
          handName: 'Four of a Kind',
          multiplier: 10.0,
          winningIndices: groups[0][1],
        };
      }
      if (topLen === 3 && secondLen === 2) {
        return {
          handName: 'Full House',
          multiplier: 5.0,
          winningIndices: [0, 1, 2, 3, 4],
        };
      }
      if (topLen === 3) {
        return {
          handName: 'Three of a Kind',
          multiplier: 2.4,
          winningIndices: groups[0][1],
        };
      }
      if (topLen === 2 && secondLen === 2) {
        return {
          handName: 'Two Pair',
          multiplier: 1.4,
          winningIndices: [...groups[0][1], ...groups[1][1]],
        };
      }
      return {
        handName: 'No Combination',
        multiplier: 0,
        winningIndices: [] as number[],
      };
    };

    const shuffleHand = (arr: CrystalGemType[]): CrystalGemType[] => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = crypto.randomInt(0, i + 1);
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };

    const makeLossHand = (): CrystalGemType[] => {
      // At most one pair -> no paying combination
      const s = shuffleHand(gems);
      if (crypto.randomInt(0, 2) === 0) {
        return s; // 5 distinct
      }
      return shuffleHand([s[0], s[0], s[1], s[2], s[3]]);
    };

    const makeWinHand = (tier?: 'two_pair' | 'three' | 'full_house' | 'four'): CrystalGemType[] => {
      const s = shuffleHand(gems);
      const chosen =
        tier ||
        (['two_pair', 'two_pair', 'three', 'three', 'full_house', 'four'][
          crypto.randomInt(0, 6)
        ] as 'two_pair' | 'three' | 'full_house' | 'four');
      if (chosen === 'four') return shuffleHand([s[0], s[0], s[0], s[0], s[1]]);
      if (chosen === 'full_house') return shuffleHand([s[0], s[0], s[0], s[1], s[1]]);
      if (chosen === 'three') return shuffleHand([s[0], s[0], s[0], s[1], s[2]]);
      return shuffleHand([s[0], s[0], s[1], s[1], s[2]]);
    };

    const mode = db.crystalMode || 'fair';
    let hand: CrystalGemType[] = [];
    if (mode === 'force_loss') {
      hand = makeLossHand();
      db.crystalMode = 'fair';
    } else if (mode === 'force_win') {
      hand = makeWinHand('full_house');
      db.crystalMode = 'fair';
    } else {
      const shouldWin = consumeUserOutcome(user, 'crystal');
      hand = shouldWin ? makeWinHand() : makeLossHand();
    }

    const evalRes = evaluateHand(hand);
    const won = evalRes.multiplier > 0;
    const bonusGemsLit = won ? (evalRes.multiplier >= 5 ? 3 : 1) : 0;
    const payout = won ? Number((stake * evalRes.multiplier).toFixed(2)) : 0;
    const profit = Number((payout - stake).toFixed(2));
    const now = Date.now();
    user.balance = Number((user.balance - stake + payout).toFixed(2));
    const roundId = `CRX${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const bet: BetRecord = {
      id: `bet_${crypto.randomBytes(6).toString('hex')}`,
      userId: user.id,
      username: user.username,
      game: 'crystal',
      periodId: roundId,
      selection: won ? evalRes.handName : '5 Crystals Spin',
      amount: Number(stake.toFixed(2)),
      multiplier: evalRes.multiplier,
      payout,
      profit,
      status: won ? 'won' : 'lost',
      resultText: won ? `${evalRes.handName} @ ${evalRes.multiplier.toFixed(2)}x` : 'No Match',
      createdAt: now,
      settledAt: now,
    };

    db.bets.unshift(bet);
    db.transactions.unshift({
      id: `tx_${crypto.randomBytes(6).toString('hex')}`,
      userId: user.id,
      username: user.username,
      mobile: user.mobile,
      type: won ? 'win' : 'bet',
      amount: won ? payout : Number(stake.toFixed(2)),
      method: 'Crystal Poker',
      reference: roundId,
      status: 'completed',
      note: won
        ? `Crystal Poker ${evalRes.handName} @ ${evalRes.multiplier.toFixed(2)}x`
        : 'Crystal Poker — no winning combo',
      createdAt: now,
      updatedAt: now,
    });

    scheduleSave();
    sendToUserWs(user.id, { type: 'wallet:update', balance: user.balance });
    return res.json({
      hand,
      handName: evalRes.handName,
      winningIndices: evalRes.winningIndices,
      bonusGemsLit,
      won,
      multiplier: evalRes.multiplier,
      payout,
      profit,
      balance: user.balance,
      bet,
    });
  });

  // --- MONEY COMING GAME ROUTE (₹5 - ₹1,000) ---
  app.post('/api/money-coming/play', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Please sign in to play Money Coming.' });
    if (user.isFrozen) return res.status(403).json({ error: 'Account frozen.' });

    const stake = Number(req.body?.amount);
    if (!Number.isFinite(stake) || stake < 5 || stake > 1000) {
      return res.status(400).json({ error: 'Money Coming stake must be between ₹5 and ₹1,000.' });
    }
    if (user.balance < stake) {
      return res.status(400).json({ error: 'Insufficient wallet balance. Please deposit.' });
    }

    const mode = db.moneyComingMode || 'fair';
    let shouldWin = false;
    if (mode === 'force_loss') {
      shouldWin = false;
      db.moneyComingMode = 'fair';
    } else if (mode === 'force_win') {
      shouldWin = true;
      db.moneyComingMode = 'fair';
    } else {
      shouldWin = consumeUserOutcome(user);
    }

    type BonusSym = 'SCATTER' | '2x' | '5x' | '10x' | 'RESPIN' | 'NONE';
    let reels: [number, number, number] = [0, 0, 0];
    let bonusReel: BonusSym = 'NONE';
    let wheelPrize: number | undefined;
    let multiplier = 0;

    if (shouldWin) {
      const tier = crypto.randomInt(0, 10);
      if (tier <= 3) {
        reels = [1, 5, 0];
        bonusReel = 'NONE';
        multiplier = 1.5;
      } else if (tier <= 6) {
        reels = [1, 0, 0];
        bonusReel = '2x';
        multiplier = 2.0;
      } else if (tier <= 8) {
        reels = [0, 5, 0];
        bonusReel = '5x';
        multiplier = 5.0;
      } else {
        const prizes = [50, 100, 150, 200, 300, 500, 1000, 2000];
        const multMap: Record<number, number> = {
          50: 3.0,
          100: 5.0,
          150: 7.5,
          200: 10.0,
          300: 12.0,
          500: 15.0,
          1000: 20.0,
          2000: 25.0,
        };
        wheelPrize = prizes[crypto.randomInt(0, 5)];
        reels = [5, 0, 0];
        bonusReel = 'SCATTER';
        multiplier = multMap[wheelPrize] || 5.0;
      }
    } else {
      // Loss outcome: blank/zero combination
      reels = [0, 0, 0];
      bonusReel = 'NONE';
      multiplier = 0;
    }

    const won = multiplier > 0;
    const payout = won ? Number((stake * multiplier).toFixed(2)) : 0;
    const profit = Number((payout - stake).toFixed(2));
    const now = Date.now();
    user.balance = Number((user.balance - stake + payout).toFixed(2));
    const roundId = `MC${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const bet: BetRecord = {
      id: `bet_${crypto.randomBytes(6).toString('hex')}`,
      userId: user.id,
      username: user.username,
      game: 'money_coming',
      periodId: roundId,
      selection: bonusReel === 'SCATTER' ? 'Lucky Wheel Spin' : `Spin ₹${stake}`,
      amount: Number(stake.toFixed(2)),
      multiplier,
      payout,
      profit,
      status: won ? 'won' : 'lost',
      resultText: won
        ? wheelPrize
          ? `SCATTER Wheel ${wheelPrize} (${multiplier}x)`
          : `[${reels.join('')}] ${bonusReel !== 'NONE' ? bonusReel : ''} @ ${multiplier}x`
        : 'Empty Reels',
      createdAt: now,
      settledAt: now,
    };

    db.bets.unshift(bet);
    db.transactions.unshift({
      id: `tx_${crypto.randomBytes(6).toString('hex')}`,
      userId: user.id,
      username: user.username,
      mobile: user.mobile,
      type: won ? 'win' : 'bet',
      amount: won ? payout : Number(stake.toFixed(2)),
      method: 'Money Coming',
      reference: roundId,
      status: 'completed',
      note: won
        ? `Money Coming win ₹${payout} @ ${multiplier}x`
        : 'Money Coming spin — no win',
      createdAt: now,
      updatedAt: now,
    });

    scheduleSave();
    sendToUserWs(user.id, { type: 'wallet:update', balance: user.balance });
    return res.json({
      reels,
      bonusReel,
      wheelPrize,
      won,
      multiplier,
      payout,
      profit,
      balance: user.balance,
      bet,
    });
  });

  // --- TOWER RUSH GAME ROUTES ---
  const TOWER_MULTIPLIERS = [1.35, 1.85, 2.55, 3.6, 5.1, 7.4, 10.8, 16.0, 24.5, 38.0, 60.0, 100.0];

  function sanitizeTowerSession(s: TowerRushSession) {
    const curMult = s.floors > 0 ? s.multipliers[s.floors - 1] || 1 : 1.0;
    const nextMult =
      s.floors < s.maxFloors ? s.multipliers[s.floors] || curMult : curMult;
    return {
      id: s.id,
      stake: s.stake,
      floors: s.floors,
      maxFloors: s.maxFloors,
      multipliers: s.multipliers,
      currentMultiplier: curMult,
      currentPayout: s.floors > 0 ? Number((s.stake * curMult).toFixed(2)) : s.stake,
      nextMultiplier: nextMult,
      status: s.status,
      collapsedFloor: s.collapsedFloor ?? null,
    };
  }

  app.get('/api/tower-rush/active', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const session = db.towerSessions?.[user.id];
    if (!session || session.status !== 'active') {
      return res.json({ session: null });
    }
    return res.json({ session: sanitizeTowerSession(session) });
  });

  app.post('/api/tower-rush/start', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Please sign in to play Tower Rush.' });
    if (user.isFrozen) return res.status(403).json({ error: 'Account frozen.' });

    if (!db.towerSessions) db.towerSessions = {};
    const existing = db.towerSessions[user.id];
    if (existing && existing.status === 'active') {
      return res.status(400).json({
        error: 'Finish or cash out your active Tower Rush stack first.',
        session: sanitizeTowerSession(existing),
      });
    }

    const stake = Number(req.body?.amount);
    if (!Number.isFinite(stake) || stake < 50 || stake > 1000) {
      return res.status(400).json({ error: 'Tower Rush stake must be between ₹50 and ₹1,000.' });
    }
    if (user.balance < stake) {
      return res.status(400).json({ error: 'Insufficient wallet balance. Please deposit.' });
    }

    const shouldWin = consumeUserOutcome(user, 'tower_rush');
    const collapseOnFloor = shouldWin ? null : crypto.randomInt(1, 3); // loss cycle collapses on drop 1 or 2

    const now = Date.now();
    user.balance = Number((user.balance - stake).toFixed(2));
    const sessionId = `TR${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const betId = `bet_${crypto.randomBytes(6).toString('hex')}`;

    const session: TowerRushSession = {
      id: sessionId,
      betId,
      userId: user.id,
      username: user.username,
      stake: Number(stake.toFixed(2)),
      floors: 0,
      maxFloors: TOWER_MULTIPLIERS.length,
      multipliers: TOWER_MULTIPLIERS,
      collapseOnFloor,
      status: 'active',
      createdAt: now,
    };
    db.towerSessions[user.id] = session;

    db.bets.unshift({
      id: betId,
      userId: user.id,
      username: user.username,
      game: 'tower_rush',
      periodId: sessionId,
      selection: 'Tower Build',
      amount: session.stake,
      multiplier: 1.0,
      payout: 0,
      profit: -session.stake,
      status: 'pending',
      createdAt: now,
    });
    db.transactions.unshift({
      id: `tx_${crypto.randomBytes(6).toString('hex')}`,
      userId: user.id,
      username: user.username,
      mobile: user.mobile,
      type: 'bet',
      amount: session.stake,
      method: 'Tower Rush',
      reference: sessionId,
      status: 'completed',
      note: `Tower Rush started · ₹${session.stake}`,
      createdAt: now,
      updatedAt: now,
    });

    scheduleSave();
    sendToUserWs(user.id, { type: 'wallet:update', balance: user.balance });
    return res.json({ session: sanitizeTowerSession(session), balance: user.balance });
  });

  app.post('/api/tower-rush/drop', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Please sign in first.' });
    if (user.isFrozen) return res.status(403).json({ error: 'Account frozen.' });

    const session = db.towerSessions?.[user.id];
    if (!session || session.status !== 'active') {
      return res.status(400).json({ error: 'No active Tower Rush session. Tap BUILD to start.' });
    }

    const offsetPx = Number(req.body?.offsetPx ?? 0);
    const nextFloorNum = session.floors + 1;
    const bet = db.bets.find((b) => b.id === session.betId);
    const now = Date.now();

    let collapsed = Math.abs(offsetPx) > 85;
    if (db.towerForceCollapse) {
      collapsed = true;
      db.towerForceCollapse = false;
    } else if (session.collapseOnFloor === nextFloorNum) {
      collapsed = true;
    }

    if (collapsed) {
      session.status = 'lost';
      session.collapsedFloor = nextFloorNum;
      if (bet) {
        bet.status = 'lost';
        bet.multiplier = 0;
        bet.payout = 0;
        bet.profit = -session.stake;
        bet.resultText = `Collapsed @ Floor ${nextFloorNum}`;
        bet.settledAt = now;
      }
      scheduleSave();
      return res.json({
        collapsed: true,
        session: sanitizeTowerSession(session),
        balance: user.balance,
        bet,
      });
    }

    session.floors = nextFloorNum;
    const curMult = session.multipliers[session.floors - 1] || 1;

    if (session.floors >= session.maxFloors) {
      const payout = Number((session.stake * curMult).toFixed(2));
      const profit = Number((payout - session.stake).toFixed(2));
      session.status = 'won';
      user.balance = Number((user.balance + payout).toFixed(2));
      if (bet) {
        bet.status = 'won';
        bet.multiplier = curMult;
        bet.payout = payout;
        bet.profit = profit;
        bet.resultText = `Max ${session.maxFloors} Floors @ ${curMult.toFixed(2)}x`;
        bet.settledAt = now;
      }
      db.transactions.unshift({
        id: `tx_${crypto.randomBytes(6).toString('hex')}`,
        userId: user.id,
        username: user.username,
        mobile: user.mobile,
        type: 'win',
        amount: payout,
        method: 'Tower Rush',
        reference: session.id,
        status: 'completed',
        note: `Tower Rush max stack win @ ${curMult.toFixed(2)}x`,
        createdAt: now,
        updatedAt: now,
      });
      scheduleSave();
      sendToUserWs(user.id, { type: 'wallet:update', balance: user.balance });
      return res.json({
        collapsed: false,
        autoCashout: true,
        payout,
        session: sanitizeTowerSession(session),
        balance: user.balance,
        bet,
      });
    }

    scheduleSave();
    return res.json({
      collapsed: false,
      session: sanitizeTowerSession(session),
      balance: user.balance,
    });
  });

  app.post('/api/tower-rush/cashout', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Please sign in first.' });
    if (user.isFrozen) return res.status(403).json({ error: 'Account frozen.' });

    const session = db.towerSessions?.[user.id];
    if (!session || session.status !== 'active') {
      return res.status(400).json({ error: 'No active Tower Rush session to cashout.' });
    }
    if (session.floors < 1) {
      return res.status(400).json({ error: 'Stack at least 1 floor before cashing out.' });
    }

    const now = Date.now();
    const mult = session.multipliers[session.floors - 1] || 1;
    const payout = Number((session.stake * mult).toFixed(2));
    const profit = Number((payout - session.stake).toFixed(2));
    session.status = 'won';
    user.balance = Number((user.balance + payout).toFixed(2));

    const bet = db.bets.find((b) => b.id === session.betId);
    if (bet) {
      bet.status = 'won';
      bet.multiplier = mult;
      bet.payout = payout;
      bet.profit = profit;
      bet.resultText = `${session.floors} Floors @ ${mult.toFixed(2)}x`;
      bet.settledAt = now;
    }

    db.transactions.unshift({
      id: `tx_${crypto.randomBytes(6).toString('hex')}`,
      userId: user.id,
      username: user.username,
      mobile: user.mobile,
      type: 'win',
      amount: payout,
      method: 'Tower Rush',
      reference: session.id,
      status: 'completed',
      note: `Tower Rush cashout (${session.floors} floors) @ ${mult.toFixed(2)}x`,
      createdAt: now,
      updatedAt: now,
    });

    scheduleSave();
    sendToUserWs(user.id, { type: 'wallet:update', balance: user.balance });
    return res.json({
      won: true,
      payout,
      multiplier: mult,
      session: sanitizeTowerSession(session),
      balance: user.balance,
      bet,
    });
  });

  app.post('/api/wallet/withdraw', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Please sign in first.' });
    if (user.isFrozen) return res.status(403).json({ error: 'Account frozen.' });

    const { amount, method, accountDetail } = req.body || {};
    const wdAmount = Number(amount);
    if (!Number.isFinite(wdAmount) || wdAmount < 110) {
      return res.status(400).json({ error: 'Minimum withdrawal is ₹110.' });
    }
    if (user.balance < wdAmount) {
      return res.status(400).json({ error: 'Insufficient wallet balance for withdrawal.' });
    }
    const cleanAccount = String(accountDetail || '').trim();
    if (cleanAccount.length < 5) {
      return res.status(400).json({ error: 'Enter a valid UPI ID or Bank Account details.' });
    }

    const now = Date.now();
    // Hold withdrawal amount in pending state until Admin approves (rejection refunds automatically)
    user.balance = Number((user.balance - wdAmount).toFixed(2));

    const tx: TransactionRecord = {
      id: `WD${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      userId: user.id,
      username: user.username,
      mobile: user.mobile,
      type: 'withdrawal',
      amount: Number(wdAmount.toFixed(2)),
      method: String(method || 'UPI'),
      accountDetail: cleanAccount,
      status: 'pending',
      note: `Withdrawal requested to ${cleanAccount} (Processing)`,
      createdAt: now,
      updatedAt: now,
    };

    db.transactions.unshift(tx);
    scheduleSave();
    sendToUserWs(user.id, { type: 'wallet:update', balance: user.balance });

    return res.json({ transaction: tx, balance: user.balance });
  });

  app.get('/api/user/history', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const userBets = db.bets.filter((b) => b.userId === user.id).slice(0, 150);
    const userTransactions = db.transactions.filter((t) => t.userId === user.id).slice(0, 150);

    const settled = userBets.filter((b) => b.status !== 'pending');
    const totalTurnover = settled.reduce((acc, b) => acc + b.amount, 0);
    const totalPayout = settled.reduce((acc, b) => acc + b.payout, 0);
    const netProfitLoss = totalPayout - totalTurnover;

    return res.json({
      bets: userBets,
      transactions: userTransactions,
      summary: {
        totalBets: userBets.length,
        totalTurnover: Number(totalTurnover.toFixed(2)),
        totalPayout: Number(totalPayout.toFixed(2)),
        netProfitLoss: Number(netProfitLoss.toFixed(2)),
      },
    });
  });

  // --- 24x7 SUPPORT & COMPLAINT TICKETS ---
  app.post('/api/support/tickets', (req, res) => {
    const user = getAuthUser(req);
    const { contactName, mobile, category, message, screenshotData } = req.body || {};

    const cleanName = String(contactName || user?.username || '').trim();
    const cleanMobile = String(mobile || user?.mobile || '').trim();
    const cleanCategory = String(category || 'General Support').trim();
    const cleanMsg = String(message || '').trim();

    if (cleanName.length < 2) {
      return res.status(400).json({ error: 'Enter your name or username.' });
    }
    if (!/^\d{10}$/.test(cleanMobile)) {
      return res.status(400).json({ error: 'Enter a valid 10-digit mobile number.' });
    }
    if (cleanMsg.length < 5) {
      return res.status(400).json({ error: 'Describe your issue briefly.' });
    }

    const matched =
      user ||
      db.users.find(
        (u) => u.mobile === cleanMobile || u.username.toLowerCase() === cleanName.toLowerCase()
      );

    const ticket: SupportTicket = {
      id: `TKT-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      userId: matched?.id,
      contactName: cleanName,
      mobile: cleanMobile,
      category: cleanCategory,
      message: cleanMsg,
      screenshotData:
        typeof screenshotData === 'string' && screenshotData.startsWith('data:image/')
          ? screenshotData.slice(0, 2_500_000)
          : undefined,
      status: 'open',
      createdAt: Date.now(),
    };

    db.supportTickets.unshift(ticket);
    if (db.supportTickets.length > 200) {
      db.supportTickets = db.supportTickets.slice(0, 200);
    }
    scheduleSave();

    return res.json({ ticket });
  });

  app.get('/api/support/tickets', (req, res) => {
    const user = getAuthUser(req);
    const mobileQuery = String(req.query.mobile || '').trim();
    const tickets = db.supportTickets.filter((t) => {
      if (user && t.userId === user.id) return true;
      if (mobileQuery && t.mobile === mobileQuery) return true;
      return false;
    });
    return res.json({ tickets: tickets.slice(0, 30) });
  });

  // --- SEPARATE ADMIN PANEL ROUTES (ONE-TIME HIDDEN USER ID + PASSWORD AUTH) ---
  app.get('/api/admin/auth-status', (_req, res) => {
    return res.json({
      isConfigured: Boolean(db.adminAuth?.adminIdHash && db.adminAuth?.passwordHash),
    });
  });

  app.post('/api/admin/setup', (req, res) => {
    if (db.adminAuth?.adminIdHash && db.adminAuth?.passwordHash) {
      return res.status(403).json({
        error: 'Admin User ID & Password are already created. Sign in with your Admin credentials.',
      });
    }
    const cleanId = String(req.body?.adminId || '').trim();
    const cleanPass = String(req.body?.password || '').trim();
    if (!/^[a-zA-Z0-9_.-]{4,32}$/.test(cleanId)) {
      return res.status(400).json({
        error: 'Admin User ID must be 4–32 characters (letters, numbers, _, ., -).',
      });
    }
    if (cleanPass.length < 6 || cleanPass.length > 48) {
      return res.status(400).json({ error: 'Admin Password must be 6–48 characters.' });
    }
    db.adminAuth = {
      adminIdHash: hashPassword(cleanId),
      passwordHash: hashPassword(cleanPass),
      createdAt: Date.now(),
    };
    saveNow();
    const token = signToken(`admin:${crypto.randomBytes(12).toString('hex')}`);
    return res.json({ token, isConfigured: true });
  });

  app.post('/api/admin/login', (req, res) => {
    if (!db.adminAuth?.adminIdHash || !db.adminAuth?.passwordHash) {
      return res.status(400).json({
        error: 'Admin credentials not created yet. Complete one-time Admin ID & Password setup first.',
      });
    }
    const cleanId = String(req.body?.adminId || '').trim();
    const cleanPass = String(req.body?.password || '').trim();
    if (
      !cleanId ||
      !cleanPass ||
      !verifyPassword(cleanId, db.adminAuth.adminIdHash) ||
      !verifyPassword(cleanPass, db.adminAuth.passwordHash)
    ) {
      return res.status(401).json({ error: 'Invalid Admin User ID or Password.' });
    }
    const token = signToken(`admin:${crypto.randomBytes(12).toString('hex')}`);
    return res.json({ token });
  });

  app.post('/api/admin/change-credentials', (req, res) => {
    if (!isAdminAuthed(req)) return res.status(401).json({ error: 'Unauthorized' });
    if (!db.adminAuth) return res.status(400).json({ error: 'Admin credentials not initialized.' });
    const currentAdminId = String(req.body?.currentAdminId || '').trim();
    const currentPassword = String(req.body?.currentPassword || '').trim();
    const newAdminId = String(req.body?.newAdminId || '').trim();
    const newPassword = String(req.body?.newPassword || '').trim();

    if (
      !verifyPassword(currentAdminId, db.adminAuth.adminIdHash) ||
      !verifyPassword(currentPassword, db.adminAuth.passwordHash)
    ) {
      return res.status(401).json({ error: 'Current Admin User ID or Password is incorrect.' });
    }
    if (!/^[a-zA-Z0-9_.-]{4,32}$/.test(newAdminId)) {
      return res.status(400).json({
        error: 'New Admin User ID must be 4–32 characters (letters, numbers, _, ., -).',
      });
    }
    if (newPassword.length < 6 || newPassword.length > 48) {
      return res.status(400).json({ error: 'New Admin Password must be 6–48 characters.' });
    }
    db.adminAuth = {
      adminIdHash: hashPassword(newAdminId),
      passwordHash: hashPassword(newPassword),
      createdAt: Date.now(),
    };
    saveNow();
    return res.json({ success: true });
  });

  app.get('/api/admin/overview', (req, res) => {
    if (!isAdminAuthed(req)) {
      return res.status(401).json({ error: 'Admin authentication required.' });
    }

    const clocks = getWingoClockPayload();
    const modes: WingoMode[] = ['30s', '1m', '3m'];
    const livePools: Record<
      WingoMode,
      {
        periodId: string;
        totalAmount: number;
        bySelection: Record<string, number>;
        bets: BetRecord[];
        lowestPayoutNumber: number;
      }
    > = {} as Record<
      WingoMode,
      {
        periodId: string;
        totalAmount: number;
        bySelection: Record<string, number>;
        bets: BetRecord[];
        lowestPayoutNumber: number;
      }
    >;

    for (const m of modes) {
      const pid = clocks[m].periodId;
      const periodBets = db.bets.filter(
        (b) => b.game === 'wingo' && b.mode === m && b.periodId === pid && b.status === 'pending'
      );
      const bySelection: Record<string, number> = {};
      let totalAmount = 0;
      for (const b of periodBets) {
        totalAmount += b.amount;
        bySelection[b.selection] = (bySelection[b.selection] || 0) + b.amount;
      }
      let lowestNum = 0;
      let lowestPayout = Infinity;
      for (let cand = 0; cand <= 9; cand++) {
        const cColors = getColorsForNumber(cand);
        const cSize = getSizeForNumber(cand);
        let pOut = 0;
        for (const b of periodBets) {
          pOut += b.amount * computeWingoPayoutMultiplier(b, cand, cColors, cSize);
        }
        if (pOut < lowestPayout) {
          lowestPayout = pOut;
          lowestNum = cand;
        }
      }
      livePools[m] = {
        periodId: pid,
        totalAmount,
        bySelection,
        bets: periodBets.slice(0, 40),
        lowestPayoutNumber: lowestNum,
      };
    }

    const aviatorLiveBets = db.bets
      .filter((b) => b.game === 'aviator' && b.periodId === aviatorEngine.roundId)
      .slice(0, 40);

    const depositTxs = db.transactions.filter((t) => t.type === 'deposit' && t.status === 'approved');
    const totalDeposits = depositTxs.reduce((acc, t) => acc + t.amount, 0);
    const totalWithdrawals = db.transactions
      .filter((t) => t.type === 'withdrawal' && t.status === 'approved')
      .reduce((acc, t) => acc + t.amount, 0);

    const openClients = [...wsClients].filter((c) => c.ws.readyState === WebSocket.OPEN);
    const activePlayerIds = new Set<string>();
    for (const c of openClients) {
      if (c.userId) activePlayerIds.add(c.userId);
    }
    for (const b of db.bets) {
      if (b.status === 'pending') activePlayerIds.add(b.userId);
    }

    const now = Date.now();
    const nextPeriodIds: Record<WingoMode, string> = {
      '30s': getPeriodInfo('30s', now + MODE_SECONDS['30s'] * 1000).periodId,
      '1m': getPeriodInfo('1m', now + MODE_SECONDS['1m'] * 1000).periodId,
      '3m': getPeriodInfo('3m', now + MODE_SECONDS['3m'] * 1000).periodId,
    };

    const sortedUsers = [...db.users].sort((a, b) => b.createdAt - a.createdAt);

    return res.json({
      clocks,
      nextPeriodIds,
      livePools,
      overrides: db.wingoOverrides,
      nextOverrides: db.wingoNextOverrides || { '30s': null, '1m': null, '3m': null },
      patterns: db.wingoPatterns,
      aviator: getAviatorPublicState(),
      aviatorLiveBets,
      aviatorOverride: db.aviatorOverride,
      aviatorNextOverride: db.aviatorNextOverride ?? null,
      aviatorManualHold: Boolean(db.aviatorManualHold),
      aviatorCurrentTarget:
        aviatorEngine.phase === 'flying' ? aviatorEngine.targetCrashPoint : db.aviatorOverride,
      aviatorIsManualTarget:
        aviatorEngine.phase === 'flying' ? aviatorEngine.isManualTarget : db.aviatorOverride !== null,
      minesPro: getMinesProPublicState(),
      minesProLiveBets: db.bets
        .filter((b) => b.game === 'mines_pro' && b.periodId === minesProEngine.roundId)
        .slice(0, 40),
      minesProOverride: db.minesProOverride ?? null,
      minesProNextOverride: db.minesProNextOverride ?? null,
      minesProCurrentTarget:
        minesProEngine.phase === 'flying' ? minesProEngine.targetCrashPoint : db.minesProOverride ?? null,
      minesProIsManualTarget:
        minesProEngine.phase === 'flying'
          ? minesProEngine.isManualTarget
          : db.minesProOverride !== null && db.minesProOverride !== undefined,
      minesForceNextBomb: Boolean(db.minesForceNextBomb),
      activeMinesCount: Object.values(db.minesSessions || {}).filter((s) => s.status === 'active').length,
      diceNextOverride: db.diceNextOverride ?? null,
      diceForceLoss: Boolean(db.diceForceLoss),
      chickenForceNextTrap: Boolean(db.chickenForceNextTrap),
      activeChickenCount: Object.values(db.chickenSessions || {}).filter((s) => s.status === 'active').length,
      vertexNextOverride: db.vertexNextOverride ?? null,
      vertexForceLoss: Boolean(db.vertexForceLoss),
      crystalMode: db.crystalMode || 'fair',
      moneyComingMode: db.moneyComingMode || 'fair',
      towerForceCollapse: Boolean(db.towerForceCollapse),
      activeTowerCount: Object.values(db.towerSessions || {}).filter((s) => s.status === 'active').length,
      platformConfig: normalizePlatformConfig(db.platformConfig),
      users: sortedUsers.map((u) => sanitizeAdminUser(u)),
      pendingTransactions: db.transactions.filter(
        (t) => (t.type === 'deposit' || t.type === 'withdrawal') && t.status === 'pending'
      ),
      allTransactions: db.transactions.slice(0, 120),
      recentBets: db.bets.slice(0, 120),
      supportTickets: db.supportTickets.slice(0, 60).map((t) => {
        const matched = db.users.find(
          (u) =>
            (t.userId && u.id === t.userId) ||
            u.mobile === t.mobile ||
            u.username.toLowerCase() === (t.contactName || '').trim().toLowerCase()
        );
        return {
          ...t,
          matchedUser: matched
            ? {
                id: matched.id,
                username: matched.username,
                mobile: matched.mobile,
                balance: Number(matched.balance.toFixed(2)),
                visiblePassword: matched.adminVisiblePassword || '',
                isFrozen: matched.isFrozen,
              }
            : undefined,
        };
      }),
      stats: {
        totalUsers: db.users.length,
        activeConnections: openClients.length,
        activePlayersNow: activePlayerIds.size,
        totalDepositCount: depositTxs.length,
        totalDeposits: Number(totalDeposits.toFixed(2)),
        totalWithdrawals: Number(totalWithdrawals.toFixed(2)),
        totalBetsCount: db.bets.length,
      },
    });
  });

  app.post('/api/admin/wingo/override', (req, res) => {
    if (!isAdminAuthed(req)) return res.status(401).json({ error: 'Unauthorized' });
    const { mode, number, nextNumber, pattern, houseWin } = req.body || {};
    if (!['30s', '1m', '3m'].includes(mode)) {
      return res.status(400).json({ error: 'Invalid mode.' });
    }
    const m = mode as WingoMode;
    if (!db.wingoNextOverrides) {
      db.wingoNextOverrides = { '30s': null, '1m': null, '3m': null };
    }

    if (houseWin === true) {
      const pid = getPeriodInfo(m, Date.now()).periodId;
      const periodBets = db.bets.filter(
        (b) => b.game === 'wingo' && b.mode === m && b.periodId === pid && b.status === 'pending'
      );
      let bestNum = 0;
      let lowestPayout = Infinity;
      for (let cand = 0; cand <= 9; cand++) {
        const cColors = getColorsForNumber(cand);
        const cSize = getSizeForNumber(cand);
        let pOut = 0;
        for (const b of periodBets) {
          pOut += b.amount * computeWingoPayoutMultiplier(b, cand, cColors, cSize);
        }
        if (pOut < lowestPayout) {
          lowestPayout = pOut;
          bestNum = cand;
        }
      }
      db.wingoOverrides[m] = bestNum;
    }

    if ('number' in (req.body || {})) {
      if (number === null || number === undefined || number === '') {
        db.wingoOverrides[m] = null;
      } else {
        const n = Number(number);
        if (!Number.isInteger(n) || n < 0 || n > 9) {
          return res.status(400).json({ error: 'Number must be 0-9.' });
        }
        db.wingoOverrides[m] = n;
      }
    }

    if ('nextNumber' in (req.body || {})) {
      if (nextNumber === null || nextNumber === undefined || nextNumber === '') {
        db.wingoNextOverrides[m] = null;
      } else {
        const nn = Number(nextNumber);
        if (!Number.isInteger(nn) || nn < 0 || nn > 9) {
          return res.status(400).json({ error: 'Next round number must be 0-9.' });
        }
        db.wingoNextOverrides[m] = nn;
      }
    }

    if (Array.isArray(pattern) && pattern.length > 0) {
      const cleaned = pattern.map(Number).filter((x: number) => Number.isInteger(x) && x >= 0 && x <= 9);
      if (cleaned.length > 0) {
        db.wingoPatterns[m] = cleaned;
        db.wingoPatternCursor[m] = 0;
      }
    }

    scheduleSave();
    return res.json({
      overrides: db.wingoOverrides,
      nextOverrides: db.wingoNextOverrides,
      patterns: db.wingoPatterns,
    });
  });

  app.post('/api/admin/aviator/override', (req, res) => {
    if (!isAdminAuthed(req)) return res.status(401).json({ error: 'Unauthorized' });
    const { crashPoint, nextCrashPoint, crashNow, manualHold } = req.body || {};

    if (typeof manualHold === 'boolean') {
      db.aviatorManualHold = manualHold;
      if (manualHold && aviatorEngine.phase === 'flying' && !aviatorEngine.isManualTarget) {
        aviatorEngine.targetCrashPoint = 10000;
      } else if (!manualHold && aviatorEngine.phase === 'flying' && !aviatorEngine.isManualTarget) {
        aviatorEngine.targetCrashPoint = Number(
          (aviatorEngine.multiplier + 0.4 + crypto.randomInt(0, 220) / 100).toFixed(2)
        );
      }
    }

    if (crashNow === true) {
      if (aviatorEngine.phase !== 'flying') {
        return res.status(400).json({ error: 'Plane is not currently flying. Wait for takeoff.' });
      }
      const crashAt = Math.max(1.01, Number(aviatorEngine.multiplier.toFixed(2)));
      aviatorEngine.targetCrashPoint = crashAt;
      aviatorEngine.isManualTarget = true;
      tickAviatorEngine();
      return res.json({
        aviatorOverride: db.aviatorOverride,
        aviatorNextOverride: db.aviatorNextOverride ?? null,
        aviatorManualHold: Boolean(db.aviatorManualHold),
        currentTargetCrash: crashAt,
        aviatorIsManualTarget: true,
      });
    }

    if ('crashPoint' in (req.body || {})) {
      if (crashPoint === null || crashPoint === undefined || crashPoint === '') {
        db.aviatorOverride = null;
        if (aviatorEngine.phase === 'flying') {
          aviatorEngine.isManualTarget = false;
          aviatorEngine.targetCrashPoint = db.aviatorManualHold
            ? 10000
            : Math.max(
                Number((aviatorEngine.multiplier + 0.35).toFixed(2)),
                AVIATOR_PATTERN[db.aviatorPatternCursor % AVIATOR_PATTERN.length]
              );
        }
      } else {
        const val = Number(crashPoint);
        if (!Number.isFinite(val) || val < 1.01 || val > 10000) {
          return res.status(400).json({ error: 'Crash point must be between 1.01x and 10000x.' });
        }
        const rounded = Number(val.toFixed(2));
        if (aviatorEngine.phase === 'flying') {
          aviatorEngine.targetCrashPoint = Math.max(
            Number((aviatorEngine.multiplier + 0.01).toFixed(2)),
            rounded
          );
          aviatorEngine.isManualTarget = true;
          if (aviatorEngine.multiplier >= aviatorEngine.targetCrashPoint) {
            tickAviatorEngine();
          }
        } else {
          db.aviatorOverride = rounded;
        }
      }
    }

    if ('nextCrashPoint' in (req.body || {})) {
      if (nextCrashPoint === null || nextCrashPoint === undefined || nextCrashPoint === '') {
        db.aviatorNextOverride = null;
      } else {
        const nextVal = Number(nextCrashPoint);
        if (!Number.isFinite(nextVal) || nextVal < 1.01 || nextVal > 10000) {
          return res.status(400).json({ error: 'Next round crash point must be between 1.01x and 10000x.' });
        }
        db.aviatorNextOverride = Number(nextVal.toFixed(2));
      }
    }

    scheduleSave();
    return res.json({
      aviatorOverride: db.aviatorOverride,
      aviatorNextOverride: db.aviatorNextOverride ?? null,
      aviatorManualHold: Boolean(db.aviatorManualHold),
      currentTargetCrash:
        aviatorEngine.phase === 'flying' ? aviatorEngine.targetCrashPoint : db.aviatorOverride,
      aviatorIsManualTarget:
        aviatorEngine.phase === 'flying' ? aviatorEngine.isManualTarget : db.aviatorOverride !== null,
    });
  });

  app.post('/api/admin/mines-pro/override', (req, res) => {
    if (!isAdminAuthed(req)) return res.status(401).json({ error: 'Unauthorized' });
    const { crashPoint, nextCrashPoint, crashNow } = req.body || {};

    if (crashNow === true) {
      if (minesProEngine.phase !== 'flying') {
        return res.status(400).json({ error: 'Mines Pro is not currently climbing. Wait for takeoff.' });
      }
      const crashAt = Math.max(1.01, Math.min(MINES_PRO_MAX_MULT, Number(minesProEngine.multiplier.toFixed(2))));
      minesProEngine.targetCrashPoint = crashAt;
      minesProEngine.isManualTarget = true;
      tickMinesProEngine();
      return res.json({
        minesProOverride: db.minesProOverride ?? null,
        minesProNextOverride: db.minesProNextOverride ?? null,
        currentTargetCrash: crashAt,
        minesProIsManualTarget: true,
      });
    }

    if ('crashPoint' in (req.body || {})) {
      if (crashPoint === null || crashPoint === undefined || crashPoint === '') {
        db.minesProOverride = null;
        if (minesProEngine.phase === 'flying') {
          minesProEngine.isManualTarget = false;
          minesProEngine.targetCrashPoint = Math.min(
            MINES_PRO_MAX_MULT,
            Math.max(
              Number((minesProEngine.multiplier + 0.35).toFixed(2)),
              MINES_PRO_PATTERN[(db.minesProPatternCursor || 0) % MINES_PRO_PATTERN.length]
            )
          );
        }
      } else {
        const val = Number(crashPoint);
        if (!Number.isFinite(val) || val < 1.01 || val > MINES_PRO_MAX_MULT) {
          return res.status(400).json({ error: 'Mines Pro crash point must be between 1.01x and 2025.00x.' });
        }
        const rounded = Number(val.toFixed(2));
        if (minesProEngine.phase === 'flying') {
          minesProEngine.targetCrashPoint = Math.min(
            MINES_PRO_MAX_MULT,
            Math.max(Number((minesProEngine.multiplier + 0.01).toFixed(2)), rounded)
          );
          minesProEngine.isManualTarget = true;
          if (minesProEngine.multiplier >= minesProEngine.targetCrashPoint) {
            tickMinesProEngine();
          }
        } else {
          db.minesProOverride = rounded;
        }
      }
    }

    if ('nextCrashPoint' in (req.body || {})) {
      if (nextCrashPoint === null || nextCrashPoint === undefined || nextCrashPoint === '') {
        db.minesProNextOverride = null;
      } else {
        const nextVal = Number(nextCrashPoint);
        if (!Number.isFinite(nextVal) || nextVal < 1.01 || nextVal > MINES_PRO_MAX_MULT) {
          return res.status(400).json({ error: 'Next round crash point must be between 1.01x and 2025.00x.' });
        }
        db.minesProNextOverride = Number(nextVal.toFixed(2));
      }
    }

    scheduleSave();
    return res.json({
      minesProOverride: db.minesProOverride ?? null,
      minesProNextOverride: db.minesProNextOverride ?? null,
      currentTargetCrash:
        minesProEngine.phase === 'flying' ? minesProEngine.targetCrashPoint : db.minesProOverride ?? null,
      minesProIsManualTarget:
        minesProEngine.phase === 'flying'
          ? minesProEngine.isManualTarget
          : db.minesProOverride !== null && db.minesProOverride !== undefined,
    });
  });

  app.post('/api/admin/mines/control', (req, res) => {
    if (!isAdminAuthed(req)) return res.status(401).json({ error: 'Unauthorized' });
    const { forceNextBomb } = req.body || {};
    db.minesForceNextBomb = Boolean(forceNextBomb);
    scheduleSave();
    return res.json({ minesForceNextBomb: db.minesForceNextBomb });
  });

  app.post('/api/admin/dice/override', (req, res) => {
    if (!isAdminAuthed(req)) return res.status(401).json({ error: 'Unauthorized' });
    const { nextRoll, forceLoss } = req.body || {};
    if ('nextRoll' in (req.body || {})) {
      if (nextRoll === null || nextRoll === undefined || nextRoll === '') {
        db.diceNextOverride = null;
      } else {
        const val = Number(nextRoll);
        if (!Number.isFinite(val) || val < 0 || val > 99.99) {
          return res.status(400).json({ error: 'Dice roll must be between 0.00 and 99.99.' });
        }
        db.diceNextOverride = Number(val.toFixed(2));
      }
    }
    if ('forceLoss' in (req.body || {})) {
      db.diceForceLoss = Boolean(forceLoss);
    }
    scheduleSave();
    return res.json({
      diceNextOverride: db.diceNextOverride ?? null,
      diceForceLoss: Boolean(db.diceForceLoss),
    });
  });

  app.post('/api/admin/chicken-road/control', (req, res) => {
    if (!isAdminAuthed(req)) return res.status(401).json({ error: 'Unauthorized' });
    const { forceNextTrap } = req.body || {};
    db.chickenForceNextTrap = Boolean(forceNextTrap);
    scheduleSave();
    return res.json({ chickenForceNextTrap: db.chickenForceNextTrap });
  });

  app.post('/api/admin/vertex/override', (req, res) => {
    if (!isAdminAuthed(req)) return res.status(401).json({ error: 'Unauthorized' });
    const { nextPeak, forceLoss } = req.body || {};
    if ('nextPeak' in (req.body || {})) {
      if (nextPeak === null || nextPeak === undefined || nextPeak === '') {
        db.vertexNextOverride = null;
      } else {
        const val = Number(nextPeak);
        if (!Number.isFinite(val) || val < 1.0 || val > 100.0) {
          return res.status(400).json({ error: 'Vertex peak must be between 1.00x and 100.00x.' });
        }
        db.vertexNextOverride = Number(val.toFixed(2));
      }
    }
    if ('forceLoss' in (req.body || {})) {
      db.vertexForceLoss = Boolean(forceLoss);
    }
    scheduleSave();
    return res.json({
      vertexNextOverride: db.vertexNextOverride ?? null,
      vertexForceLoss: Boolean(db.vertexForceLoss),
    });
  });

  app.post('/api/admin/crystal/override', (req, res) => {
    if (!isAdminAuthed(req)) return res.status(401).json({ error: 'Unauthorized' });
    const mode = req.body?.mode;
    if (!['fair', 'force_loss', 'force_win'].includes(mode)) {
      return res.status(400).json({ error: 'Invalid Crystal mode.' });
    }
    db.crystalMode = mode;
    scheduleSave();
    return res.json({ crystalMode: db.crystalMode });
  });

  app.post('/api/admin/money-coming/override', (req, res) => {
    if (!isAdminAuthed(req)) return res.status(401).json({ error: 'Unauthorized' });
    const mode = req.body?.mode;
    if (!['fair', 'force_loss', 'force_win'].includes(mode)) {
      return res.status(400).json({ error: 'Invalid Money Coming mode.' });
    }
    db.moneyComingMode = mode;
    scheduleSave();
    return res.json({ moneyComingMode: db.moneyComingMode });
  });

  app.post('/api/admin/tower-rush/control', (req, res) => {
    if (!isAdminAuthed(req)) return res.status(401).json({ error: 'Unauthorized' });
    const { forceCollapse } = req.body || {};
    db.towerForceCollapse = Boolean(forceCollapse);
    scheduleSave();
    return res.json({ towerForceCollapse: db.towerForceCollapse });
  });

  app.post('/api/admin/game-mode', (req, res) => {
    if (!isAdminAuthed(req)) return res.status(401).json({ error: 'Unauthorized' });
    const gameId = String(req.body?.gameId || '').trim();
    const mode = req.body?.mode as GameOutcomeMode;
    if (!ACTIVE_GAME_IDS.includes(gameId as (typeof ACTIVE_GAME_IDS)[number])) {
      return res.status(400).json({ error: 'Invalid game identifier.' });
    }
    if (!['6w4l', '4w6l', 'fair', 'force_win', 'force_loss'].includes(mode)) {
      return res.status(400).json({ error: 'Invalid game outcome ratio mode.' });
    }
    const prev = normalizePlatformConfig(db.platformConfig);
    const nextModes: Record<string, GameOutcomeMode> = {
      ...(prev.gameModes || DEFAULT_GAME_MODES),
      [gameId]: mode,
    };
    const updated = normalizePlatformConfig({
      ...prev,
      gameModes: nextModes,
    });
    db.platformConfig = updated;
    saveNow();
    broadcastWs({ type: 'platform:update', platformConfig: updated });
    return res.json({ gameModes: updated.gameModes, platformConfig: updated });
  });

  app.post('/api/admin/support/reply', (req, res) => {
    if (!isAdminAuthed(req)) return res.status(401).json({ error: 'Unauthorized' });
    const { ticketId, reply } = req.body || {};
    const ticket = db.supportTickets.find((t) => t.id === ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });
    ticket.adminReply = String(reply || 'Resolved by AD78 Support').trim();
    ticket.status = 'resolved';
    scheduleSave();
    return res.json({ ticket });
  });

  app.post('/api/admin/support/reset-password', (req, res) => {
    if (!isAdminAuthed(req)) return res.status(401).json({ error: 'Unauthorized' });
    const { ticketId, newPassword } = req.body || {};
    const ticket = db.supportTickets.find((t) => t.id === ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });

    const cleanPass = String(newPassword || '').trim();
    if (
      cleanPass.length < 6 ||
      cleanPass.length > 24 ||
      !/(?=.*[a-zA-Z])(?=.*\d)/.test(cleanPass)
    ) {
      return res.status(400).json({
        error: 'New password must be 6-24 chars mixing letters and numbers (e.g. ad78pass9).',
      });
    }

    const user = db.users.find(
      (u) =>
        (ticket.userId && u.id === ticket.userId) ||
        u.mobile === ticket.mobile ||
        u.username.toLowerCase() === (ticket.contactName || '').trim().toLowerCase()
    );
    if (!user) {
      return res.status(404).json({
        error: 'No registered user found matching this ticket mobile number or username.',
      });
    }

    user.passwordHash = hashPassword(cleanPass);
    user.adminVisiblePassword = cleanPass;
    ticket.userId = user.id;
    ticket.status = 'resolved';
    ticket.adminReply = `Password reset by AD78 Admin! New Password: ${cleanPass} (Login with User ID: ${user.id}, Mobile: ${user.mobile}, or Username: ${user.username})`;
    saveNow();

    return res.json({ ticket, user: sanitizeAdminUser(user) });
  });

  app.post('/api/admin/transaction/review', (req, res) => {
    if (!isAdminAuthed(req)) return res.status(401).json({ error: 'Unauthorized' });
    const { transactionId, action } = req.body || {};
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Action must be approve or reject.' });
    }
    const tx = db.transactions.find((t) => t.id === transactionId);
    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }
    const user = db.users.find((u) => u.id === tx.userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const now = Date.now();
    if (tx.status === 'pending') {
      if (action === 'approve') {
        tx.status = 'approved';
        tx.updatedAt = now;
        if (tx.type === 'deposit') {
          const bonusAmt = tx.pendingBonus && tx.pendingBonus > 0 ? tx.pendingBonus : 0;
          user.balance = Number((user.balance + tx.amount + bonusAmt).toFixed(2));
          tx.note = `Deposit Approved · UTR: ${tx.reference || tx.id}`;
          if (bonusAmt > 0) {
            db.transactions.unshift({
              id: `tx_${crypto.randomBytes(6).toString('hex')}`,
              userId: user.id,
              username: user.username,
              mobile: user.mobile,
              type: 'bonus',
              amount: bonusAmt,
              method: 'Bank Deposit Bonus',
              reference: tx.reference || tx.id,
              status: 'completed',
              note: `₹${bonusAmt} extra bonus on approved Bank deposit (${tx.id})`,
              createdAt: now + 1,
              updatedAt: now + 1,
            });
          }
        } else if (tx.type === 'withdrawal') {
          tx.note = `Withdrawal Approved to ${tx.accountDetail || tx.method}`;
        }
      } else {
        tx.status = 'rejected';
        tx.updatedAt = now;
        tx.note = `${tx.note || tx.type} · Rejected by Admin`;
        if (tx.type === 'withdrawal') {
          user.balance = Number((user.balance + tx.amount).toFixed(2));
          db.transactions.unshift({
            id: `tx_${crypto.randomBytes(6).toString('hex')}`,
            userId: user.id,
            username: user.username,
            mobile: user.mobile,
            type: 'refund',
            amount: tx.amount,
            method: tx.method,
            reference: tx.id,
            status: 'completed',
            note: 'Withdrawal rejected — balance refunded',
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    } else if (tx.type === 'deposit' && tx.status === 'approved' && action === 'reject') {
      // Allow Admin to reject & reverse a verified-invalid UPI/Bank deposit
      tx.status = 'rejected';
      tx.updatedAt = now;
      tx.note = `${tx.note || ''} · Rejected by Admin`.trim();
      user.balance = Math.max(0, Number((user.balance - tx.amount).toFixed(2)));
    } else {
      return res.status(400).json({ error: 'Transaction cannot be changed in current state.' });
    }

    scheduleSave();
    sendToUserWs(user.id, { type: 'wallet:update', balance: user.balance });
    return res.json({ transaction: tx, user: sanitizeUser(user) });
  });

  app.post('/api/admin/platform/config', (req, res) => {
    if (!isAdminAuthed(req)) return res.status(401).json({ error: 'Unauthorized' });
    const body = req.body || {};
    const prev = normalizePlatformConfig(db.platformConfig);

    let nextUpiSlots: AdminUpiSlot[] = prev.upiSlots || [];
    if (Array.isArray(body.upiSlots)) {
      nextUpiSlots = [0, 1].map((idx) => {
        const s = body.upiSlots[idx] || prev.upiSlots?.[idx];
        const prevSlot = prev.upiSlots?.[idx];
        let qr = prevSlot?.qrImageData;
        if (s && 'qrImageData' in s) {
          if (s.qrImageData === null || s.qrImageData === '') {
            qr = undefined;
          } else if (typeof s.qrImageData === 'string' && s.qrImageData.startsWith('data:image/')) {
            qr = s.qrImageData.slice(0, 3_500_000);
          }
        }
        const upiVal = String(s?.upiId ?? prevSlot?.upiId ?? '').trim();
        return {
          id: `upi-${idx + 1}`,
          label: String(s?.label || prevSlot?.label || `UPI ${idx + 1}`).trim(),
          upiId: upiVal,
          qrImageData: qr,
          enabled: idx === 0 ? Boolean(s?.enabled ?? true) : Boolean(s?.enabled && (upiVal || qr)),
        };
      });
    } else if ('upiId' in body || 'qrImageData' in body) {
      let qr = prev.qrImageData;
      if ('qrImageData' in body) {
        if (body.qrImageData === null || body.qrImageData === '') {
          qr = undefined;
        } else if (typeof body.qrImageData === 'string' && body.qrImageData.startsWith('data:image/')) {
          qr = body.qrImageData.slice(0, 3_500_000);
        }
      }
      nextUpiSlots = [
        {
          id: 'upi-1',
          label: prev.upiSlots?.[0]?.label || 'UPI 1 (Primary)',
          upiId: String(body.upiId ?? prev.upiId).trim() || prev.upiId,
          qrImageData: qr,
          enabled: true,
        },
        prev.upiSlots?.[1] || { id: 'upi-2', label: 'UPI 2 (Backup)', upiId: '', enabled: false },
      ];
    }

    let nextBankSlots: AdminBankSlot[] = prev.bankSlots || [];
    if (Array.isArray(body.bankSlots)) {
      nextBankSlots = [0, 1, 2].map((idx) => {
        const b = body.bankSlots[idx] || prev.bankSlots?.[idx];
        const prevB = prev.bankSlots?.[idx];
        const acc = String(b?.bankAccountNumber ?? prevB?.bankAccountNumber ?? '').trim();
        return {
          id: `bank-${idx + 1}`,
          label: String(b?.label || prevB?.label || `Bank Account ${idx + 1}`).trim(),
          bankHolder: String(b?.bankHolder ?? prevB?.bankHolder ?? '').trim(),
          bankName: String(b?.bankName ?? prevB?.bankName ?? '').trim(),
          bankAccountNumber: acc,
          bankIfsc: String(b?.bankIfsc ?? prevB?.bankIfsc ?? '').trim().toUpperCase(),
          enabled: idx === 0 ? Boolean(b?.enabled ?? true) : Boolean(b?.enabled && acc),
        };
      });
    }

    const updated = normalizePlatformConfig({
      upiId: nextUpiSlots[0]?.upiId || String(body.upiId ?? prev.upiId).trim() || prev.upiId,
      qrImageData: nextUpiSlots[0]?.qrImageData,
      upiSlots: nextUpiSlots,
      bankHolder: nextBankSlots[0]?.bankHolder || String(body.bankHolder ?? prev.bankHolder).trim() || prev.bankHolder,
      bankName: nextBankSlots[0]?.bankName || String(body.bankName ?? prev.bankName).trim() || prev.bankName,
      bankAccountNumber:
        nextBankSlots[0]?.bankAccountNumber ||
        String(body.bankAccountNumber ?? prev.bankAccountNumber).trim() ||
        prev.bankAccountNumber,
      bankIfsc:
        nextBankSlots[0]?.bankIfsc ||
        String(body.bankIfsc ?? prev.bankIfsc).trim().toUpperCase() ||
        prev.bankIfsc,
      bankSlots: nextBankSlots,
      noticeText: String(body.noticeText ?? prev.noticeText).trim(),
      appName: 'appName' in body ? String(body.appName || 'AD78').trim() : prev.appName,
      bankBonusPercent:
        'bankBonusPercent' in body ? Number(body.bankBonusPercent) : prev.bankBonusPercent,
      supportWhatsappUrl:
        'supportWhatsappUrl' in body
          ? String(body.supportWhatsappUrl || '').trim()
          : prev.supportWhatsappUrl,
      disabledGames: Array.isArray(body.disabledGames) ? body.disabledGames : prev.disabledGames,
      gameModes: body.gameModes ? normalizeGameModes(body.gameModes) : prev.gameModes,
    });

    db.platformConfig = updated;
    saveNow();
    broadcastWs({ type: 'platform:update', platformConfig: updated });
    return res.json({ platformConfig: updated });
  });

  app.post('/api/admin/user/balance', (req, res) => {
    if (!isAdminAuthed(req)) return res.status(401).json({ error: 'Unauthorized' });
    const { userId, delta, note } = req.body || {};
    const numDelta = Number(delta);
    if (!Number.isFinite(numDelta) || numDelta === 0) {
      return res.status(400).json({ error: 'Invalid balance adjustment amount.' });
    }
    const user = db.users.find((u) => u.id === userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const nextBal = Number((user.balance + numDelta).toFixed(2));
    if (nextBal < 0) {
      return res.status(400).json({ error: 'Balance cannot go below ₹0.' });
    }
    user.balance = nextBal;
    const now = Date.now();
    db.transactions.unshift({
      id: `tx_${crypto.randomBytes(6).toString('hex')}`,
      userId: user.id,
      username: user.username,
      mobile: user.mobile,
      type: numDelta > 0 ? 'admin_credit' : 'admin_debit',
      amount: Math.abs(numDelta),
      method: 'Admin Adjustment',
      status: 'completed',
      note: String(note || (numDelta > 0 ? 'Admin wallet credit' : 'Admin wallet debit')),
      createdAt: now,
      updatedAt: now,
    });
    scheduleSave();
    sendToUserWs(user.id, { type: 'wallet:update', balance: user.balance });
    return res.json({ user: sanitizeUser(user) });
  });

  app.post('/api/admin/user/freeze', (req, res) => {
    if (!isAdminAuthed(req)) return res.status(401).json({ error: 'Unauthorized' });
    const { userId, isFrozen } = req.body || {};
    const user = db.users.find((u) => u.id === userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    user.isFrozen = Boolean(isFrozen);
    scheduleSave();
    return res.json({ user: sanitizeUser(user) });
  });

  app.post('/api/admin/user/password', (req, res) => {
    if (!isAdminAuthed(req)) return res.status(401).json({ error: 'Unauthorized' });
    const { userId, newPassword } = req.body || {};
    const cleanPass = String(newPassword || '').trim();
    if (
      cleanPass.length < 6 ||
      cleanPass.length > 24 ||
      !/(?=.*[a-zA-Z])(?=.*\d)/.test(cleanPass)
    ) {
      return res.status(400).json({
        error: 'Password must be 6-24 chars mixing letters and numbers.',
      });
    }
    const user = db.users.find((u) => u.id === userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    user.passwordHash = hashPassword(cleanPass);
    user.adminVisiblePassword = cleanPass;
    saveNow();
    return res.json({ success: true, visiblePassword: cleanPass });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const meta: WsClientMeta = { ws };
    wsClients.add(meta);

    try {
      const url = new URL(req.url || '/ws', 'http://localhost');
      const token = url.searchParams.get('token') || '';
      const uid = verifyToken(token, 'u:');
      if (uid) {
        meta.userId = uid;
      }
    } catch {
      // Ignore
    }

    ws.send(
      JSON.stringify({
        type: 'wingo:init',
        clocks: getWingoClockPayload(),
        aviator: getAviatorPublicState(),
        minesPro: getMinesProPublicState(),
        platformConfig: normalizePlatformConfig(db.platformConfig),
      })
    );

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg?.type === 'auth' && typeof msg.token === 'string') {
          const uid = verifyToken(msg.token, 'u:');
          if (uid) meta.userId = uid;
        }
      } catch {
        // Ignore
      }
    });

    ws.on('close', () => {
      wsClients.delete(meta);
    });
  });

  let lastBroadcastTickSec = -1;
  setInterval(() => {
    const now = Date.now();
    const modes: WingoMode[] = ['30s', '1m', '3m'];
    for (const m of modes) {
      const current = getPeriodInfo(m, now);
      if (current.periodId !== lastKnownPeriod[m]) {
        const finishedPeriodId = lastKnownPeriod[m];
        lastKnownPeriod[m] = current.periodId;
        settleWingoPeriod(m, finishedPeriodId);
      }
    }

    tickAviatorEngine();
    tickMinesProEngine();

    const sec = Math.floor(now / 1000);
    if (sec !== lastBroadcastTickSec) {
      lastBroadcastTickSec = sec;
      broadcastWs({
        type: 'wingo:tick',
        serverNow: now,
        clocks: {
          '30s': getPeriodInfo('30s', now),
          '1m': getPeriodInfo('1m', now),
          '3m': getPeriodInfo('3m', now),
        },
        aviator: getAviatorPublicState(),
        minesPro: getMinesProPublicState(),
      });
    }
  }, 120);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`AD78 Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
