export type WingoMode = '30s' | '1m' | '3m';

export type WingoColor = 'green' | 'red' | 'violet';

export type WingoSelectionType = 'color' | 'size' | 'number';

export interface BankAccount {
  accountHolder: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
}

export interface WingoRound {
  periodId: string;
  mode: WingoMode;
  number: number; // 0-9
  colors: WingoColor[];
  size: 'big' | 'small';
  timestamp: number;
}

export interface WingoModeClock {
  mode: WingoMode;
  periodId: string;
  secondsRemaining: number;
  totalSeconds: number;
  isLocked: boolean;
  history: WingoRound[];
}

export type AviatorPhase = 'betting' | 'flying' | 'crashed';

export interface AviatorState {
  roundId: string;
  phase: AviatorPhase;
  countdownSec: number;
  multiplier: number;
  crashPoint?: number;
  history: { roundId: string; crashPoint: number; timestamp: number }[];
}

export interface MinesProState {
  roundId: string;
  phase: AviatorPhase;
  countdownSec: number;
  multiplier: number;
  starsOpened?: number;
  starTiles?: number[];
  bombTile?: number | null;
  mines?: number[];
  crashPoint?: number;
  history: { roundId: string; crashPoint: number; timestamp: number }[];
}

export interface UserProfile {
  id: string;
  username: string;
  mobile: string;
  balance: number;
  bonusBalance: number;
  referralCode: string;
  createdAt: number;
  isFrozen: boolean;
  isDemo?: boolean;
  stakePresets: number[];
  bankAccount?: BankAccount;
  savedUpiId?: string;
  visiblePassword?: string;
}

export interface BetRecord {
  id: string;
  userId: string;
  username: string;
  game: 'wingo' | 'aviator' | 'mines_pro' | 'mines' | 'dice' | 'chicken_road' | 'vertex' | 'crystal' | 'tower_rush' | 'money_coming';
  mode?: WingoMode;
  periodId?: string;
  slot?: 1 | 2;
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

export interface MinesSessionPublic {
  id: string;
  stake: number;
  minesCount: number;
  revealed: number[];
  multiplier: number;
  currentPayout: number;
  nextMultiplier: number;
  status: 'active' | 'won' | 'lost';
  mines?: number[];
}

export interface DiceRollResult {
  roll: number;
  won: boolean;
  multiplier: number;
  payout: number;
  profit: number;
  balance: number;
  target: number;
  direction: 'over' | 'under';
  bet: BetRecord;
}

export type ChickenDifficulty = 'easy' | 'medium' | 'hard';

export interface ChickenRoadSessionPublic {
  id: string;
  stake: number;
  difficulty: ChickenDifficulty;
  currentLane: number;
  totalLanes: number;
  multipliers: number[];
  currentMultiplier: number;
  currentPayout: number;
  nextMultiplier: number;
  status: 'active' | 'won' | 'lost';
  hitLane?: number | null;
}

export type CrystalGemType = 'emerald' | 'ruby' | 'amethyst' | 'gold' | 'sapphire';

export interface CrystalPlayResult {
  hand: CrystalGemType[];
  handName: string;
  winningIndices: number[];
  bonusGemsLit: number;
  won: boolean;
  multiplier: number;
  payout: number;
  profit: number;
  balance: number;
  bet: BetRecord;
}

export interface VertexPlayResult {
  peakMultiplier: number;
  targetMultiplier: number;
  outcomeElement: 'fire' | 'earth' | 'water' | 'skull';
  elementMultiplier: number;
  ringSteps: {
    fire: number;
    earth: number;
    water: number;
  };
  ringSummary?: {
    fire: string;
    clover: string;
    water: string;
  };
  won: boolean;
  payout: number;
  profit: number;
  balance: number;
  bet: BetRecord;
}

export interface MoneyComingPlayResult {
  reels: [number, number, number];
  bonusReel: 'SCATTER' | '2x' | '5x' | '10x' | 'RESPIN' | 'NONE';
  wheelPrize?: number;
  won: boolean;
  multiplier: number;
  payout: number;
  profit: number;
  balance: number;
  bet: BetRecord;
}

export interface TowerRushSessionPublic {
  id: string;
  stake: number;
  floors: number;
  maxFloors: number;
  multipliers: number[];
  currentMultiplier: number;
  currentPayout: number;
  nextMultiplier: number;
  status: 'active' | 'won' | 'lost';
  collapsedFloor?: number | null;
}

export interface TransactionRecord {
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

export interface AdminUpiSlot {
  id: string;
  label: string;
  upiId: string;
  qrImageData?: string;
  enabled: boolean;
}

export interface AdminBankSlot {
  id: string;
  label: string;
  bankHolder: string;
  bankName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  enabled: boolean;
}

export type GameOutcomeMode = '6w4l' | '4w6l' | 'fair' | 'force_win' | 'force_loss';

export interface PlatformConfig {
  upiId: string;
  qrImageData?: string;
  upiSlots?: AdminUpiSlot[];
  bankHolder: string;
  bankName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankSlots?: AdminBankSlot[];
  noticeText?: string;
  appName?: string;
  bankBonusPercent?: number;
  supportWhatsappUrl?: string;
  disabledGames?: string[];
  gameModes?: Record<string, GameOutcomeMode>;
}

export interface SupportTicket {
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
  matchedUser?: {
    id: string;
    username: string;
    mobile: string;
    balance: number;
    visiblePassword?: string;
    isFrozen: boolean;
  };
}
