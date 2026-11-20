import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpFromLine,
  Award,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  FileSpreadsheet,
  Gift,
  Headphones,
  History,
  ImagePlus,
  KeyRound,
  Landmark,
  LogOut,
  Megaphone,
  QrCode,
  Receipt,
  Settings,
  Share2,
  Smartphone,
  TrendingUp,
  User,
  Wallet,
  X,
} from 'lucide-react';
import { BetRecord, PlatformConfig, TransactionRecord, UserProfile } from '../types';
import { compressImageFile } from '../utils/imageCompress';
import {
  MAX_DEPOSIT,
  MIN_DEPOSIT,
  MIN_WITHDRAWAL,
  validateDepositUtr,
  validateMixedPassword,
} from '../utils/validation';

export type MenuPage =
  | 'menu'
  | 'profile'
  | 'statement'
  | 'bank'
  | 'deposit'
  | 'withdraw'
  | 'bets'
  | 'wallet'
  | 'pnl'
  | 'turnover'
  | 'bonus'
  | 'transactions'
  | 'stakes'
  | 'rules'
  | 'promotions'
  | 'affiliate';

interface WalletAndMenuProps {
  page: MenuPage;
  user: UserProfile | null;
  token: string | null;
  bets: BetRecord[];
  transactions: TransactionRecord[];
  summary: {
    totalBets: number;
    totalTurnover: number;
    totalPayout: number;
    netProfitLoss: number;
  };
  platformConfig?: PlatformConfig | null;
  onNavigate: (page: MenuPage) => void;
  onBackHome: () => void;
  onRequireAuth: () => void;
  onOpenSupport: () => void;
  onBalanceUpdate: (newBalance: number) => void;
  onUserUpdate: (u: UserProfile) => void;
  onRefreshHistory: () => void;
  onLogout: () => void;
}

const MENU_ITEMS: { id: MenuPage; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'profile', label: 'Profile Settings', icon: User },
  { id: 'statement', label: 'Account Statement', icon: Landmark },
  { id: 'bank', label: 'Bank Account', icon: Building2 },
  { id: 'deposit', label: 'Deposit', icon: ArrowDownToLine },
  { id: 'withdraw', label: 'Withdrawal', icon: ArrowUpFromLine },
  { id: 'bets', label: 'My Bets', icon: Receipt },
  { id: 'wallet', label: 'My Wallet', icon: Wallet },
  { id: 'pnl', label: 'Betting Profit & Loss', icon: TrendingUp },
  { id: 'turnover', label: 'Turnover History', icon: History },
  { id: 'bonus', label: 'Bonus Statement', icon: Gift },
  { id: 'transactions', label: 'My Transaction', icon: FileSpreadsheet },
  { id: 'stakes', label: 'Stake Settings', icon: Settings },
  { id: 'rules', label: 'Game Rules', icon: BookOpen },
  { id: 'promotions', label: 'Promotions', icon: Megaphone },
  { id: 'affiliate', label: 'Affiliate Program', icon: Share2 },
];

const UPI_APPS = ['PhonePe', 'Paytm', 'Google Pay', 'Other UPI'] as const;

export const WalletAndMenu: React.FC<WalletAndMenuProps> = ({
  page,
  user,
  token,
  bets,
  transactions,
  summary,
  platformConfig,
  onNavigate,
  onBackHome,
  onRequireAuth,
  onOpenSupport,
  onBalanceUpdate,
  onUserUpdate,
  onRefreshHistory,
  onLogout,
}) => {
  const activeUpiSlots = React.useMemo(() => {
    const raw = platformConfig?.upiSlots?.filter((s) => s.enabled && (s.upiId || s.qrImageData));
    if (raw && raw.length > 0) return raw;
    return [
      {
        id: 'upi-1',
        label: 'UPI 1 (Primary)',
        upiId: platformConfig?.upiId || 'ad78.pay@upi',
        qrImageData: platformConfig?.qrImageData,
        enabled: true,
      },
    ];
  }, [platformConfig]);

  const activeBankSlots = React.useMemo(() => {
    const raw = platformConfig?.bankSlots?.filter((b) => b.enabled && b.bankAccountNumber);
    if (raw && raw.length > 0) return raw;
    return [
      {
        id: 'bank-1',
        label: 'Bank Account 1',
        bankHolder: platformConfig?.bankHolder || 'AD78 PAYMENTS ENTERPRISE',
        bankName: platformConfig?.bankName || 'HDFC BANK',
        bankAccountNumber: platformConfig?.bankAccountNumber || '50200078451290',
        bankIfsc: platformConfig?.bankIfsc || 'HDFC0001780',
        enabled: true,
      },
    ];
  }, [platformConfig]);

  const [selectedUpiIdx, setSelectedUpiIdx] = useState(0);
  const [selectedBankIdx, setSelectedBankIdx] = useState(0);

  const safeUpiSlot = activeUpiSlots[selectedUpiIdx] || activeUpiSlots[0];
  const safeBankSlot = activeBankSlots[selectedBankIdx] || activeBankSlots[0];

  const activeUpiId = safeUpiSlot.upiId || platformConfig?.upiId || 'ad78.pay@upi';
  const activeCustomQr = safeUpiSlot.qrImageData;
  const activeBankHolder = safeBankSlot.bankHolder;
  const activeBankName = safeBankSlot.bankName;
  const activeBankAccount = safeBankSlot.bankAccountNumber;
  const activeBankIfsc = safeBankSlot.bankIfsc;

  const [depAmount, setDepAmount] = useState('200');
  const [depMode, setDepMode] = useState<'upi' | 'bank'>('bank');
  const [showDepositAccount, setShowDepositAccount] = useState(false);
  const [depUpiApp, setDepUpiApp] = useState<string>('PhonePe');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [depRef, setDepRef] = useState('');
  const [depScreenshotData, setDepScreenshotData] = useState('');
  const [depScreenshotName, setDepScreenshotName] = useState('');

  const [wdAmount, setWdAmount] = useState('110');
  const [wdMode, setWdMode] = useState<'upi' | 'bank'>('upi');
  const [wdUpiApp, setWdUpiApp] = useState<string>('PhonePe');
  const [wdUpiId, setWdUpiId] = useState(user?.savedUpiId || '');
  const [savedUpiInput, setSavedUpiInput] = useState(user?.savedUpiId || '');
  const [depSubmittedModal, setDepSubmittedModal] = useState<{
    transaction: TransactionRecord;
    pendingBonus: number;
  } | null>(null);

  // Bank Account form fields
  const [accountHolder, setAccountHolder] = useState(user?.bankAccount?.accountHolder || '');
  const [accountNumber, setAccountNumber] = useState(user?.bankAccount?.accountNumber || '');
  const [ifsc, setIfsc] = useState(user?.bankAccount?.ifsc || '');
  const [bankName, setBankName] = useState(user?.bankAccount?.bankName || '');

  // Change Password form fields (inside Profile Settings)
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [presets, setPresets] = useState<string[]>(
    (user?.stakePresets || [10, 50, 100, 500]).map(String)
  );

  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (user?.savedUpiId) {
      setSavedUpiInput(user.savedUpiId);
      setWdUpiId((prev) => prev || user.savedUpiId || '');
    }
    if (user?.bankAccount) {
      setAccountHolder((prev) => prev || user.bankAccount?.accountHolder || '');
      setAccountNumber((prev) => prev || user.bankAccount?.accountNumber || '');
      setIfsc((prev) => prev || user.bankAccount?.ifsc || '');
      setBankName((prev) => prev || user.bankAccount?.bankName || '');
    }
  }, [user?.savedUpiId, user?.bankAccount]);

  const handleBack = () => {
    setMsg(null);
    setShowDepositAccount(false);
    if (page === 'menu') {
      onBackHome();
    } else {
      onNavigate('menu');
    }
  };

  const buildUpiUri = (amt: number) =>
    `upi://pay?pa=${encodeURIComponent(activeUpiId)}&pn=AD78&am=${amt.toFixed(2)}&cu=INR&tn=AD78Deposit`;

  useEffect(() => {
    if (selectedUpiIdx >= activeUpiSlots.length) setSelectedUpiIdx(0);
  }, [activeUpiSlots.length, selectedUpiIdx]);

  useEffect(() => {
    if (selectedBankIdx >= activeBankSlots.length) setSelectedBankIdx(0);
  }, [activeBankSlots.length, selectedBankIdx]);

  // Live QR regeneration whenever Admin updates UPI ID or uploads Custom QR via WebSocket
  useEffect(() => {
    if (!showDepositAccount || depMode !== 'upi') return;
    if (activeCustomQr) {
      setQrDataUrl(activeCustomQr);
      return;
    }
    const amt = Number(depAmount) || MIN_DEPOSIT;
    const upiUri = `upi://pay?pa=${encodeURIComponent(activeUpiId)}&pn=AD78&am=${amt.toFixed(2)}&cu=INR&tn=AD78Deposit`;
    let cancelled = false;
    QRCode.toDataURL(upiUri, {
      width: 220,
      margin: 2,
      color: { dark: '#09101d', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [showDepositAccount, depMode, depAmount, activeUpiId, activeCustomQr]);

  const handleProceedDeposit = async () => {
    setMsg(null);
    if (!user || !token) {
      onRequireAuth();
      return;
    }
    const amt = Number(depAmount);
    if (!Number.isFinite(amt) || amt < MIN_DEPOSIT || amt > MAX_DEPOSIT) {
      setShowDepositAccount(false);
      setMsg({
        type: 'err',
        text: `Deposit amount must be between ₹${MIN_DEPOSIT} and ₹${MAX_DEPOSIT.toLocaleString('en-IN')}.`,
      });
      return;
    }

    if (depMode === 'upi') {
      if (activeCustomQr) {
        setQrDataUrl(activeCustomQr);
      } else {
        try {
          const upiUri = buildUpiUri(amt);
          const url = await QRCode.toDataURL(upiUri, {
            width: 220,
            margin: 2,
            color: { dark: '#09101d', light: '#ffffff' },
          });
          setQrDataUrl(url);
        } catch {
          setQrDataUrl('');
        }
      }
    }
    setShowDepositAccount(true);
  };

  const handleLaunchUpiApp = (appName: 'PhonePe' | 'Google Pay' | 'Paytm') => {
    const amt = Number(depAmount) || MIN_DEPOSIT;
    const query = `pa=${encodeURIComponent(activeUpiId)}&pn=AD78&am=${amt.toFixed(2)}&cu=INR&tn=AD78Deposit`;
    const schemeMap: Record<'PhonePe' | 'Google Pay' | 'Paytm', string> = {
      PhonePe: `phonepe://pay?${query}`,
      'Google Pay': `tez://upi/pay?${query}`,
      Paytm: `paytmmp://pay?${query}`,
    };
    setDepUpiApp(appName);
    setMsg({
      type: 'ok',
      text: `Opening ${appName} for ₹${amt.toFixed(0)}... Upload payment screenshot & enter UTR below.`,
    });
    const link = document.createElement('a');
    link.href = schemeMap[appName];
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDepScreenshotChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg(null);
    try {
      const compressed = await compressImageFile(file, 1200, 0.82);
      setDepScreenshotName(file.name);
      setDepScreenshotData(compressed);
    } catch {
      setMsg({ type: 'err', text: 'Could not load screenshot image. Please choose a valid JPG/PNG photo.' });
    }
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!user || !token) {
      onRequireAuth();
      return;
    }
    const amt = Number(depAmount);
    if (!Number.isFinite(amt) || amt < MIN_DEPOSIT || amt > MAX_DEPOSIT) {
      setMsg({
        type: 'err',
        text: `Deposit amount must be between ₹${MIN_DEPOSIT} and ₹${MAX_DEPOSIT.toLocaleString('en-IN')}.`,
      });
      return;
    }
    const utrCheck = validateDepositUtr(depRef);
    if (!utrCheck.valid) {
      setMsg({ type: 'err', text: utrCheck.error || 'Enter a valid genuine 12-digit UTR number.' });
      return;
    }
    if (!depScreenshotData) {
      setMsg({ type: 'err', text: 'Please upload your payment screenshot image along with the UTR.' });
      return;
    }
    const methodLabel =
      depMode === 'upi'
        ? `${depUpiApp} UPI (${safeUpiSlot.label})`
        : `Bank (${safeBankSlot.bankName} · ${safeBankSlot.label})`;
    setSubmitting(true);
    try {
      const res = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          amount: amt,
          method: methodLabel,
          reference: depRef.trim(),
          screenshotData: depScreenshotData,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Deposit failed');
      onBalanceUpdate(data.balance);
      setDepRef('');
      setDepScreenshotData('');
      setDepScreenshotName('');
      setShowDepositAccount(false);
      onRefreshHistory();
      setDepSubmittedModal({
        transaction: data.transaction,
        pendingBonus: Number(data.pendingBonus || 0),
      });
      setMsg({
        type: 'ok',
        text: `Deposit Submitted (Processing) · Process ID: ${data.transaction?.id} · User ID: ${user.id}`,
      });
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : 'Deposit failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveUpiId = async (upiValue: string) => {
    setMsg(null);
    if (!user || !token) {
      onRequireAuth();
      return;
    }
    const clean = upiValue.trim();
    if (clean.length < 5 || !clean.includes('@')) {
      setMsg({ type: 'err', text: 'Enter a valid UPI ID (e.g. mobile@ybl or name@okaxis).' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/user/upi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ savedUpiId: clean }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save UPI ID');
      onUserUpdate(data.user);
      setWdUpiId(clean);
      setSavedUpiInput(clean);
      setMsg({ type: 'ok', text: `UPI ID (${clean}) saved to your profile for withdrawals!` });
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : 'Failed to save UPI ID' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!user || !token) {
      onRequireAuth();
      return;
    }
    if (!currentPassword.trim()) {
      setMsg({ type: 'err', text: 'Enter your current password.' });
      return;
    }
    const pCheck = validateMixedPassword(newPassword);
    if (!pCheck.valid) {
      setMsg({ type: 'err', text: pCheck.error || 'New password must mix letters and numbers.' });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setMsg({ type: 'err', text: 'Confirm new password does not match.' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          currentPassword: currentPassword.trim(),
          newPassword: newPassword.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not change password');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setMsg({ type: 'ok', text: 'Password updated successfully!' });
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : 'Failed to change password' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveBankAccount = async () => {
    setMsg(null);
    if (!user || !token) {
      onRequireAuth();
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/user/bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          accountHolder: accountHolder.trim(),
          accountNumber: accountNumber.trim(),
          ifsc: ifsc.trim().toUpperCase(),
          bankName: bankName.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save bank account');
      onUserUpdate(data.user);
      setMsg({ type: 'ok', text: 'Bank Account saved successfully for withdrawals!' });
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : 'Failed to save bank account' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!user || !token) {
      onRequireAuth();
      return;
    }
    const amt = Number(wdAmount);
    if (!Number.isFinite(amt) || amt < MIN_WITHDRAWAL) {
      setMsg({ type: 'err', text: `Minimum withdrawal is ₹${MIN_WITHDRAWAL}.` });
      return;
    }
    if (user.balance < amt) {
      setMsg({ type: 'err', text: 'Insufficient balance for this withdrawal.' });
      return;
    }

    let method = `${wdUpiApp} UPI`;
    let accountDetail = wdUpiId.trim();

    if (wdMode === 'bank') {
      const holder = accountHolder.trim() || user.bankAccount?.accountHolder || '';
      const accNo = accountNumber.trim() || user.bankAccount?.accountNumber || '';
      const ifscCode = (ifsc.trim() || user.bankAccount?.ifsc || '').toUpperCase();
      const bName = bankName.trim() || user.bankAccount?.bankName || '';

      if (!holder || !accNo || !ifscCode || !bName) {
        setMsg({
          type: 'err',
          text: 'Please fill in Account Holder Name, Account Number, IFSC Code, and Bank Name.',
        });
        return;
      }
      method = `Bank (${bName})`;
      accountDetail = `${holder} · A/C ${accNo} · IFSC ${ifscCode}`;
    } else if (accountDetail.length < 5) {
      setMsg({ type: 'err', text: 'Enter a valid UPI ID (e.g. mobile@ybl or name@okaxis).' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: amt, method, accountDetail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Withdrawal failed');
      onBalanceUpdate(data.balance);
      onRefreshHistory();
      setMsg({
        type: 'ok',
        text: `Withdrawal Processing · Process ID: ${data.transaction?.id} · User ID: ${user.id} · ₹${amt} to ${method}`,
      });
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : 'Withdrawal failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSavePresets = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !token) {
      onRequireAuth();
      return;
    }
    const nums = presets.map(Number);
    if (nums.some((n) => !Number.isFinite(n) || n < 1 || n > 10000)) {
      setMsg({ type: 'err', text: 'Each stake preset must be between ₹1 and ₹10,000.' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/user/stakes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stakePresets: nums }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      onUserUpdate(data.user);
      setMsg({ type: 'ok', text: 'Quick stake settings saved!' });
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const pageTitle =
    page === 'menu'
      ? 'Account Menu'
      : MENU_ITEMS.find((m) => m.id === page)?.label || 'Account';

  return (
    <div className="min-h-screen bg-[#09101d] text-white pb-24">
      <header className="sticky top-0 z-30 flex items-center justify-between bg-[#0f172a]/95 backdrop-blur-md border-b border-white/10 px-4 py-3">
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 px-3 py-2 text-sm font-semibold text-white transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </button>

        <h1 className="text-base sm:text-lg font-bold text-white">{pageTitle}</h1>

        {user ? (
          <div className="rounded-xl bg-white/10 border border-white/20 px-3 py-1.5 text-xs font-semibold text-white tabular-nums">
            ₹{user.balance.toFixed(2)}
          </div>
        ) : (
          <button
            onClick={onRequireAuth}
            className="rounded-xl bg-cyan-500 px-3 py-1.5 text-xs font-bold text-slate-950"
          >
            Login
          </button>
        )}
      </header>

      <div className="mx-auto max-w-2xl px-4 pt-4 space-y-4">
        {msg && (
          <div
            className={`rounded-xl px-4 py-3 text-xs font-semibold border ${
              msg.type === 'ok'
                ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                : 'bg-rose-500/15 border-rose-400/40 text-rose-200'
            }`}
          >
            {msg.text}
          </div>
        )}

        {/* ACCOUNT MENU LIST */}
        {page === 'menu' && (
          <div className="space-y-3">
            {user && (
              <div className="rounded-2xl bg-[#101a2f] border border-cyan-500/30 p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-white">{user.username}</div>
                  <div className="text-[11px] text-cyan-300 font-semibold tabular-nums mt-0.5">
                    User ID: <span className="font-mono">{user.id}</span> · {user.mobile}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(user.id);
                    setMsg({
                      type: 'ok',
                      text: `User ID ${user.id} copied! Use this ID & password to login on any phone.`,
                    });
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-400/15 border border-cyan-400/40 px-3 py-1.5 text-xs font-bold text-cyan-300 hover:bg-cyan-400/25 shrink-0"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy ID</span>
                </button>
              </div>
            )}

            <div className="rounded-2xl bg-[#101a2f] border border-white/10 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10 text-xs font-bold tracking-wider text-slate-300 uppercase">
                Account &amp; Wallet
              </div>
            <div className="divide-y divide-white/5">
              {MENU_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setMsg(null);
                      if (!user && item.id !== 'rules' && item.id !== 'promotions') {
                        onRequireAuth();
                        return;
                      }
                      onNavigate(item.id);
                    }}
                    className="flex w-full items-center justify-between px-4 py-3.5 text-left hover:bg-white/5 transition"
                  >
                    <div className="flex items-center gap-3.5">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#091224] border border-cyan-500/30 text-cyan-300">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="text-sm font-semibold text-white">{item.label}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </button>
                );
              })}

              {/* 24x7 Support shortcut inside Account Menu */}
              <button
                onClick={onOpenSupport}
                className="flex w-full items-center justify-between px-4 py-3.5 text-left hover:bg-white/5 transition"
              >
                <div className="flex items-center gap-3.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#091224] border border-cyan-500/30 text-cyan-300">
                    <Headphones className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-semibold text-white">24×7 Support (Complaint / Screenshot)</span>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </button>

              {user && (
                <button
                  onClick={onLogout}
                  className="flex w-full items-center justify-between px-4 py-3.5 text-left hover:bg-rose-500/10 transition"
                >
                  <div className="flex items-center gap-3.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400">
                      <LogOut className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-semibold text-rose-300">Logout</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-rose-500/60" />
                </button>
              )}
            </div>
          </div>
          </div>
        )}

        {/* DEPOSIT SCREEN (STEP 1: AMOUNT + SUBMIT -> STEP 2: ACCOUNT DETAILS & UTR/SCREENSHOT BELOW) */}
        {page === 'deposit' && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-[#0d1729] border border-cyan-500/30 p-4 sm:p-5 space-y-4">
              <div className="rounded-2xl border border-cyan-400/50 bg-[#08101f] px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-950 font-black text-xs">
                    ₹
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-extrabold tracking-wide text-white uppercase">
                      DEPOSIT
                    </h2>
                    <p className="text-[11px] text-slate-300">
                      Min ₹{MIN_DEPOSIT} · Max ₹{MAX_DEPOSIT.toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
                <span className="rounded-lg bg-amber-500/20 border border-amber-400/30 px-2.5 py-1 text-[11px] font-semibold text-amber-200">
                  Admin Verified
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-xs font-bold text-slate-200 mb-1">
                    Please Select Deposit Method:
                  </div>
                  <p className="text-xs font-semibold text-white leading-relaxed">
                    Disclaimer: For faster and more reliable payments, please use the bank transfer option.
                  </p>
                </div>

                {/* Method Pills: BANK (5% BONUS) | UPI | WHATSAPP DEPOSIT (No Crypto) */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDepMode('bank');
                      setMsg(null);
                    }}
                    className={`rounded-full px-4 py-2 text-xs font-extrabold tracking-wide transition border ${
                      depMode === 'bank'
                        ? 'bg-cyan-300 text-slate-950 border-cyan-200 shadow-[0_0_16px_rgba(34,211,238,0.45)]'
                        : 'bg-[#101c31] text-slate-200 border-white/25 hover:bg-white/10'
                    }`}
                  >
                    BANK ({platformConfig?.bankBonusPercent ?? 5}% BONUS)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDepMode('upi');
                      setMsg(null);
                    }}
                    className={`rounded-full px-5 py-2 text-xs font-extrabold tracking-wide transition border ${
                      depMode === 'upi'
                        ? 'bg-cyan-300 text-slate-950 border-cyan-200 shadow-[0_0_16px_rgba(34,211,238,0.45)]'
                        : 'bg-[#101c31] text-slate-200 border-white/25 hover:bg-white/10'
                    }`}
                  >
                    UPI
                  </button>
                  {platformConfig?.supportWhatsappUrl &&
                  /^https?:\/\//i.test(platformConfig.supportWhatsappUrl) ? (
                    <a
                      href={platformConfig.supportWhatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full bg-[#1a8f4d] border border-emerald-400/60 px-4 py-2 text-xs font-extrabold tracking-wide text-white hover:brightness-110 transition"
                    >
                      WHATSAPP DEPOSIT
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={onOpenSupport}
                      className="rounded-full bg-[#1a8f4d] border border-emerald-400/60 px-4 py-2 text-xs font-extrabold tracking-wide text-white hover:brightness-110 transition"
                    >
                      WHATSAPP DEPOSIT
                    </button>
                  )}
                </div>

                {/* Account Option Sub-Tabs (OPTION 1 / OPTION 2 / OPTION 3) */}
                <div className="flex flex-wrap items-center gap-2">
                  {depMode === 'bank'
                    ? activeBankSlots.map((slot, idx) => (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => setSelectedBankIdx(idx)}
                          className={`rounded-full px-4 py-2 text-xs font-extrabold tracking-wide transition border ${
                            selectedBankIdx === idx
                              ? 'bg-cyan-300 text-slate-950 border-cyan-200 shadow-[0_0_14px_rgba(34,211,238,0.4)]'
                              : 'bg-[#101c31] text-slate-200 border-white/25 hover:bg-white/10'
                          }`}
                        >
                          OPTION {idx + 1}
                        </button>
                      ))
                    : activeUpiSlots.map((slot, idx) => (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => setSelectedUpiIdx(idx)}
                          className={`rounded-full px-4 py-2 text-xs font-extrabold tracking-wide transition border ${
                            selectedUpiIdx === idx
                              ? 'bg-cyan-300 text-slate-950 border-cyan-200 shadow-[0_0_14px_rgba(34,211,238,0.4)]'
                              : 'bg-[#101c31] text-slate-200 border-white/25 hover:bg-white/10'
                          }`}
                        >
                          OPTION {idx + 1}
                        </button>
                      ))}
                </div>

                {/* Additive Preset Grid (+500 to +50000 max) */}
                <div className="grid grid-cols-3 gap-2">
                  {[500, 1000, 5000, 10000, 25000, 50000].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => {
                        const cur = Number(depAmount) || 0;
                        const next = cur >= MAX_DEPOSIT || cur === 0 ? v : Math.min(MAX_DEPOSIT, cur + v);
                        setDepAmount(String(Math.min(MAX_DEPOSIT, next)));
                      }}
                      className="rounded-full bg-[#243047] hover:bg-[#31415f] border border-white/10 py-2 text-xs font-bold text-slate-100 tabular-nums transition"
                    >
                      +{v}
                    </button>
                  ))}
                </div>

                <p className="text-xs font-semibold text-amber-400 leading-relaxed">
                  Note : Please allow 30mins for deposit amount to credit, in case of any further delay reach out to customer care.
                </p>

                {/* Enter Amount (INR) with Clear button */}
                <div className="space-y-1.5">
                  <div className="inline-block rounded-full border border-cyan-400/50 bg-[#08101f] px-3 py-1 text-[11px] font-bold text-white">
                    Enter Amount (INR)
                  </div>
                  <div className="relative flex items-center rounded-full bg-[#364156] border border-white/15 px-4 py-2.5">
                    <input
                      type="number"
                      min={MIN_DEPOSIT}
                      max={MAX_DEPOSIT}
                      value={depAmount}
                      onChange={(e) => setDepAmount(e.target.value)}
                      placeholder={`Min ₹${MIN_DEPOSIT} – Max ₹${MAX_DEPOSIT}`}
                      className="w-full bg-transparent text-sm font-bold text-white placeholder:text-slate-300 focus:outline-none tabular-nums pr-14"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setDepAmount('');
                        setShowDepositAccount(false);
                      }}
                      className="absolute right-4 text-xs font-bold text-white hover:text-cyan-300"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Minimum deposit ₹{MIN_DEPOSIT} · Maximum deposit ₹{MAX_DEPOSIT.toLocaleString('en-IN')}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleProceedDeposit}
                  className="w-full sm:w-48 rounded-full bg-gradient-to-r from-cyan-400 to-teal-500 hover:brightness-110 py-3 text-sm font-extrabold text-slate-950 shadow-lg transition"
                >
                  Submit
                </button>
              </div>
            </div>

            {showDepositAccount && (
              <form
                onSubmit={handleDeposit}
                className="rounded-2xl bg-[#0d1729] border border-cyan-400/45 p-4 sm:p-5 space-y-4 shadow-xl"
              >
                <div className="flex items-center justify-between rounded-xl bg-[#08101f] border border-white/10 px-3.5 py-2.5">
                  <span className="text-xs font-bold text-cyan-300 uppercase tracking-wide">
                    Official {depMode === 'upi' ? 'UPI' : 'Bank'} Payment Details
                  </span>
                  <span className="text-sm font-extrabold text-white tabular-nums">
                    Payable: ₹{Number(depAmount || 0).toFixed(2)}
                  </span>
                </div>

                {depMode === 'upi' ? (
                  <div className="space-y-3">
                    {activeUpiSlots.length > 1 && (
                      <div className="grid grid-cols-2 gap-2">
                        {activeUpiSlots.map((slot, idx) => (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => setSelectedUpiIdx(idx)}
                            className={`rounded-xl py-2 px-3 text-xs font-bold border transition ${
                              selectedUpiIdx === idx
                                ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                                : 'bg-[#08101f] text-slate-200 border-white/15 hover:bg-white/10'
                            }`}
                          >
                            {slot.label || `UPI ${idx + 1}`}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-col items-center rounded-2xl bg-[#08101f] border border-cyan-500/30 p-4 text-center space-y-2.5">
                      <div className="text-xs font-bold text-cyan-300">
                        Scan QR Code with Any UPI App (₹{Number(depAmount || 0).toFixed(0)})
                      </div>
                      {qrDataUrl ? (
                        <div className="rounded-xl bg-white p-2 shadow-lg">
                          <img
                            src={qrDataUrl}
                            alt={`UPI QR Code for ₹${depAmount}`}
                            className="h-44 w-44 object-contain"
                          />
                        </div>
                      ) : (
                        <div className="flex h-44 w-44 items-center justify-center rounded-xl bg-white/10 text-xs text-slate-300">
                          QR Ready
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-white font-semibold">
                        <span>{activeUpiId}</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(activeUpiId);
                            setMsg({ type: 'ok', text: 'AD78 UPI ID copied!' });
                          }}
                          className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 text-[11px] text-cyan-300"
                        >
                          <Copy className="h-3 w-3" /> Copy
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-white">
                        <Smartphone className="h-3.5 w-3.5 text-cyan-300" />
                        <span>Tap to Pay via UPI App</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => handleLaunchUpiApp('PhonePe')}
                          className={`rounded-xl py-2.5 px-2 text-xs font-bold border transition ${
                            depUpiApp === 'PhonePe'
                              ? 'bg-[#5f259f] text-white border-purple-300'
                              : 'bg-[#08101f] text-white border-white/15 hover:bg-white/10'
                          }`}
                        >
                          PhonePe
                        </button>
                        <button
                          type="button"
                          onClick={() => handleLaunchUpiApp('Google Pay')}
                          className={`rounded-xl py-2.5 px-2 text-xs font-bold border transition ${
                            depUpiApp === 'Google Pay'
                              ? 'bg-[#1a73e8] text-white border-blue-300'
                              : 'bg-[#08101f] text-white border-white/15 hover:bg-white/10'
                          }`}
                        >
                          Google Pay
                        </button>
                        <button
                          type="button"
                          onClick={() => handleLaunchUpiApp('Paytm')}
                          className={`rounded-xl py-2.5 px-2 text-xs font-bold border transition ${
                            depUpiApp === 'Paytm'
                              ? 'bg-[#00baf2] text-slate-950 border-cyan-200'
                              : 'bg-[#08101f] text-white border-white/15 hover:bg-white/10'
                          }`}
                        >
                          Paytm
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeBankSlots.length > 1 && (
                      <div className="grid grid-cols-3 gap-2">
                        {activeBankSlots.map((slot, idx) => (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => setSelectedBankIdx(idx)}
                            className={`rounded-xl py-2 px-2 text-xs font-bold border transition ${
                              selectedBankIdx === idx
                                ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                                : 'bg-[#08101f] text-slate-200 border-white/15 hover:bg-white/10'
                            }`}
                          >
                            {slot.label || `Bank ${idx + 1}`}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="rounded-xl bg-[#08101f] border border-white/10 p-4 text-xs space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-cyan-300">
                          AD78 Official Bank Account ({safeBankSlot.label})
                        </span>
                        <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 tabular-nums">
                          +₹{((Number(depAmount || 0) * (platformConfig?.bankBonusPercent ?? 5)) / 100).toFixed(2)} Bonus ({platformConfig?.bankBonusPercent ?? 5}%)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Transfer Amount</span>
                        <span className="font-bold text-white tabular-nums">
                          ₹{Number(depAmount || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Account Holder</span>
                        <span className="font-semibold text-white">{activeBankHolder}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Bank Name</span>
                        <span className="font-semibold text-white">{activeBankName}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Account Number</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(activeBankAccount);
                            setMsg({ type: 'ok', text: 'Bank Account Number copied!' });
                          }}
                          className="inline-flex items-center gap-1.5 font-bold text-white"
                        >
                          <span>{activeBankAccount}</span>
                          <Copy className="h-3 w-3 text-cyan-300" />
                        </button>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">IFSC Code</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(activeBankIfsc);
                            setMsg({ type: 'ok', text: 'IFSC Code copied!' });
                          }}
                          className="inline-flex items-center gap-1.5 font-semibold text-white"
                        >
                          <span>{activeBankIfsc}</span>
                          <Copy className="h-3 w-3 text-cyan-300" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-white">
                    Upload {depMode === 'upi' ? 'UPI' : 'Bank Transfer'} Payment Screenshot *
                  </label>
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-cyan-400/50 bg-[#08101f] px-4 py-3 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/10 transition">
                    <ImagePlus className="h-4 w-4" />
                    <span>
                      {depScreenshotName
                        ? `Uploaded: ${depScreenshotName}`
                        : 'Choose Payment Screenshot Image'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleDepScreenshotChange}
                      className="hidden"
                    />
                  </label>
                  {depScreenshotData && (
                    <img
                      src={depScreenshotData}
                      alt="Payment screenshot preview"
                      className="mt-2 max-h-40 rounded-xl border border-white/15 object-contain"
                    />
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-white">
                    UTR / Transaction Reference Number *
                  </label>
                  <input
                    type="text"
                    value={depRef}
                    onChange={(e) => setDepRef(e.target.value)}
                    placeholder="Enter 12-digit UTR number after payment"
                    className="w-full rounded-xl bg-[#08101f] border border-white/15 px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-teal-500 py-3.5 text-sm font-bold text-slate-950 shadow-lg hover:brightness-110 transition"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>
                    {submitting
                      ? 'Submitting Deposit...'
                      : `Submit Deposit Proof ₹${depAmount || 0}`}
                  </span>
                </button>
              </form>
            )}
          </div>
        )}

        {/* WITHDRAWAL SCREEN (MIN ₹110 + UPI Apps & Bank Account) */}
        {page === 'withdraw' && (
          <form
            onSubmit={handleWithdraw}
            className="rounded-2xl bg-[#101a2f] border border-cyan-500/30 p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Withdrawal</h2>
                <p className="text-xs text-slate-300">Minimum Withdrawal: ₹{MIN_WITHDRAWAL}</p>
              </div>
              <span className="rounded-lg bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                Min ₹110
              </span>
            </div>

            <div className="rounded-xl bg-[#08101f] border border-white/10 p-3.5 flex items-center justify-between">
              <span className="text-xs text-slate-300">Withdrawable Balance</span>
              <span className="text-lg font-bold text-white tabular-nums">
                ₹{user?.balance.toFixed(2) || '0.00'}
              </span>
            </div>

            {/* Payout Mode Selector: UPI Apps vs Bank Account */}
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#08101f] p-1 border border-white/10">
              <button
                type="button"
                onClick={() => setWdMode('upi')}
                className={`rounded-lg py-2.5 text-xs font-bold transition ${
                  wdMode === 'upi' ? 'bg-cyan-400 text-slate-950' : 'text-slate-300'
                }`}
              >
                UPI (PhonePe / Paytm / GPay)
              </button>
              <button
                type="button"
                onClick={() => setWdMode('bank')}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-bold transition ${
                  wdMode === 'bank' ? 'bg-cyan-400 text-slate-950' : 'text-slate-300'
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                <span>Bank Account</span>
              </button>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-white">
                Withdrawal Amount (₹110 minimum)
              </label>
              <input
                type="number"
                min={110}
                value={wdAmount}
                onChange={(e) => setWdAmount(e.target.value)}
                className="w-full rounded-xl bg-[#08101f] border border-white/15 px-4 py-3 text-base font-semibold text-white focus:outline-none focus:border-cyan-400"
              />
            </div>

            {wdMode === 'upi' ? (
              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-white">
                    Select UPI App
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {UPI_APPS.map((app) => (
                      <button
                        key={app}
                        type="button"
                        onClick={() => setWdUpiApp(app)}
                        className={`rounded-xl py-2 px-2 text-xs font-semibold border transition ${
                          wdUpiApp === app
                            ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                            : 'bg-[#08101f] text-white border-white/15'
                        }`}
                      >
                        {app}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="block text-xs font-semibold text-white">
                      Your {wdUpiApp} UPI ID *
                    </label>
                    <button
                      type="button"
                      onClick={() => handleSaveUpiId(wdUpiId)}
                      disabled={submitting}
                      className="rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-300 hover:bg-white/20"
                    >
                      Save UPI ID
                    </button>
                  </div>
                  <input
                    type="text"
                    value={wdUpiId}
                    onChange={(e) => setWdUpiId(e.target.value)}
                    placeholder="e.g. 9876543210@ybl or name@okicici"
                    className="w-full rounded-xl bg-[#08101f] border border-white/15 px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3 rounded-xl bg-[#08101f] border border-white/10 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Bank Account Details</span>
                  <button
                    type="button"
                    onClick={handleSaveBankAccount}
                    disabled={submitting}
                    className="rounded-lg bg-white/10 px-3 py-1 text-xs font-semibold text-cyan-300 hover:bg-white/20"
                  >
                    Save Bank Info
                  </button>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-slate-300">Account Holder Name *</label>
                  <input
                    type="text"
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value)}
                    placeholder="Full name as per bank passbook"
                    className="w-full rounded-xl bg-[#101a2f] border border-white/15 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-slate-300">Bank Account Number *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter Bank Account Number"
                    className="w-full rounded-xl bg-[#101a2f] border border-white/15 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-slate-300">IFSC Code *</label>
                    <input
                      type="text"
                      maxLength={11}
                      value={ifsc}
                      onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                      placeholder="e.g. SBIN0001234"
                      className="w-full rounded-xl bg-[#101a2f] border border-white/15 px-3.5 py-2.5 text-sm text-white uppercase focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-300">Bank Name *</label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="e.g. State Bank of India"
                      className="w-full rounded-xl bg-[#101a2f] border border-white/15 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 py-3.5 text-sm font-bold text-slate-950 shadow-lg hover:brightness-110 transition"
            >
              {submitting ? 'Submitting...' : `Submit Withdrawal ₹${wdAmount || 0}`}
            </button>
          </form>
        )}

        {/* BANK ACCOUNT SECTION */}
        {page === 'bank' && (
          <div className="rounded-2xl bg-[#101a2f] border border-cyan-500/30 p-5 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-white">Bank Account Settings</h2>
              <p className="text-xs text-slate-300">
                Save your bank account details once for instant withdrawals.
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-slate-300">Account Holder Name *</label>
                <input
                  type="text"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  placeholder="Full name as per bank passbook"
                  className="w-full rounded-xl bg-[#08101f] border border-white/15 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-300">Bank Account Number *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter Bank Account Number"
                  className="w-full rounded-xl bg-[#08101f] border border-white/15 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-300">IFSC Code *</label>
                  <input
                    type="text"
                    maxLength={11}
                    value={ifsc}
                    onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                    placeholder="e.g. SBIN0001234"
                    className="w-full rounded-xl bg-[#08101f] border border-white/15 px-3.5 py-2.5 text-sm text-white uppercase focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-300">Bank Name *</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. State Bank of India"
                    className="w-full rounded-xl bg-[#08101f] border border-white/15 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSaveBankAccount}
              disabled={submitting}
              className="w-full rounded-xl bg-cyan-400 py-3.5 text-sm font-bold text-slate-950"
            >
              {submitting ? 'Saving...' : 'Save Bank Account'}
            </button>
          </div>
        )}

        {/* MY WALLET */}
        {page === 'wallet' && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-gradient-to-br from-[#0e2a38] to-[#0a1426] border border-cyan-400/30 p-5 space-y-4">
              <div className="text-xs text-slate-300">Total Available Balance</div>
              <div className="text-4xl font-bold text-white tabular-nums">
                ₹{user?.balance.toFixed(2) || '0.00'}
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => onNavigate('deposit')}
                  className="rounded-xl bg-cyan-400 py-3 text-sm font-bold text-slate-950"
                >
                  Deposit (Min ₹200)
                </button>
                <button
                  onClick={() => onNavigate('withdraw')}
                  className="rounded-xl bg-white/10 border border-white/20 py-3 text-sm font-bold text-white"
                >
                  Withdraw (Min ₹110)
                </button>
              </div>
            </div>

            {user?.bankAccount && (
              <div className="rounded-2xl bg-[#101a2f] border border-white/10 p-4 space-y-1 text-xs">
                <div className="font-bold text-white">Saved Bank Account</div>
                <div className="text-slate-300">
                  Holder: {user.bankAccount.accountHolder} · {user.bankAccount.bankName}
                </div>
                <div className="text-slate-300">
                  A/C: {user.bankAccount.accountNumber} · IFSC: {user.bankAccount.ifsc}
                </div>
              </div>
            )}
          </div>
        )}

        {/* MY BETS / TURNOVER */}
        {(page === 'bets' || page === 'turnover') && (
          <div className="rounded-2xl bg-[#101a2f] border border-white/10 divide-y divide-white/5">
            {bets.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">No bets recorded yet.</div>
            ) : (
              bets.map((b) => (
                <div key={b.id} className="flex items-center justify-between p-4 text-xs">
                  <div>
                    <div className="font-bold text-white uppercase">
                      {b.game === 'aviator'
                        ? 'Aviator'
                        : b.game === 'mines_pro'
                        ? 'Mines Pro'
                        : b.game === 'mines'
                        ? 'Mines'
                        : b.game === 'dice'
                        ? 'Dice'
                        : b.game === 'chicken_road'
                        ? 'Chicken Road'
                        : b.game === 'vertex'
                        ? 'Vortex'
                        : b.game === 'crystal'
                        ? 'Crystal Poker'
                        : b.game === 'tower_rush'
                        ? 'Tower Rush'
                        : b.game === 'money_coming'
                        ? 'Money Coming'
                        : `WinGo ${b.mode || ''}`}{' '}
                      · {b.selection}
                    </div>
                    <div className="text-[11px] text-slate-300 mt-0.5">
                      Stake ₹{b.amount} {b.resultText ? `· ${b.resultText}` : ''}
                    </div>
                  </div>
                  <div className="text-right font-bold tabular-nums">
                    {b.status === 'pending' && <span className="text-amber-400">Pending</span>}
                    {b.status === 'won' && (
                      <span className="text-emerald-400">+₹{b.payout.toFixed(2)}</span>
                    )}
                    {b.status === 'lost' && (
                      <span className="text-rose-400">-₹{b.amount.toFixed(2)}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* BETTING PROFIT & LOSS (PLUS / MINUS) */}
        {page === 'pnl' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-[#101a2f] border border-white/10 p-4">
              <div className="text-xs text-slate-300">Total Turnover</div>
              <div className="mt-1 text-2xl font-bold text-white tabular-nums">
                ₹{summary.totalTurnover.toFixed(2)}
              </div>
            </div>
            <div className="rounded-2xl bg-[#101a2f] border border-white/10 p-4">
              <div className="text-xs text-slate-300">Total Winnings</div>
              <div className="mt-1 text-2xl font-bold text-white tabular-nums">
                ₹{summary.totalPayout.toFixed(2)}
              </div>
            </div>
            <div className="col-span-2 rounded-2xl bg-[#101a2f] border border-white/10 p-4">
              <div className="text-xs text-slate-300">Net Profit &amp; Loss (+/-)</div>
              <div
                className={`mt-1 text-3xl font-bold tabular-nums ${
                  summary.netProfitLoss >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {summary.netProfitLoss >= 0 ? '+' : ''}₹{summary.netProfitLoss.toFixed(2)}
              </div>
            </div>
          </div>
        )}

        {/* TRANSACTIONS / ACCOUNT STATEMENT / BONUS STATEMENT */}
        {(page === 'transactions' || page === 'statement' || page === 'bonus') && (
          <div className="rounded-2xl bg-[#101a2f] border border-white/10 divide-y divide-white/5">
            {transactions.filter((t) => (page === 'bonus' ? t.type === 'bonus' : true)).length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">No transactions yet.</div>
            ) : (
              transactions
                .filter((t) => (page === 'bonus' ? t.type === 'bonus' : true))
                .map((t) => (
                  <div key={t.id} className="flex items-start justify-between gap-3 p-4 text-xs">
                    <div className="space-y-1">
                      <div className="font-bold text-white uppercase">
                        {t.type} · {t.method || 'Wallet'}
                      </div>
                      <div className="text-[11px] text-cyan-300 font-semibold tabular-nums">
                        Process ID: {t.id} · User ID: {t.userId}
                      </div>
                      {t.reference && (
                        <div className="text-[11px] text-slate-200 tabular-nums">
                          UTR / Ref: {t.reference}
                        </div>
                      )}
                      {(t.note || t.accountDetail) && (
                        <div className="text-[11px] text-slate-300">
                          {t.note || t.accountDetail}
                        </div>
                      )}
                      <div className="text-[10px] text-slate-400">
                        {new Date(t.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-white tabular-nums">
                        ₹{t.amount.toFixed(2)}
                      </div>
                      <span
                        className={`inline-block mt-0.5 rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                          t.status === 'approved' || t.status === 'completed'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : t.status === 'rejected'
                            ? 'bg-rose-500/15 text-rose-400'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {t.status === 'pending'
                          ? 'PROCESSING'
                          : t.status === 'approved'
                          ? 'SUCCESS'
                          : t.status}
                      </span>
                    </div>
                  </div>
                ))
            )}
          </div>
        )}

        {/* AFFILIATE PROGRAM */}
        {page === 'affiliate' && (
          <div className="rounded-2xl bg-[#101a2f] border border-cyan-500/30 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <Award className="h-8 w-8 text-amber-400" />
              <div>
                <h2 className="text-lg font-bold text-white">AD78 Affiliate Program</h2>
                <p className="text-xs text-slate-300">Earn daily commission on friend turnover</p>
              </div>
            </div>
            <div className="rounded-xl bg-[#08101f] p-4 border border-white/10 flex items-center justify-between">
              <div>
                <div className="text-[11px] text-slate-400">Your Referral Code</div>
                <div className="text-xl font-bold text-white">
                  {user?.referralCode || 'AD78'}
                </div>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(
                    `${window.location.origin}/?ref=${user?.referralCode || ''}`
                  );
                  setMsg({ type: 'ok', text: 'Affiliate invite link copied!' });
                }}
                className="rounded-xl bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950"
              >
                Copy Link
              </button>
            </div>
          </div>
        )}

        {/* PROMOTIONS */}
        {page === 'promotions' && (
          <div className="space-y-3">
            <div className="rounded-2xl bg-gradient-to-r from-[#0e3242] to-[#101a2f] border border-cyan-500/30 p-5">
              <div className="text-xs font-bold text-amber-400 uppercase">Welcome Offer</div>
              <h3 className="mt-1 text-xl font-bold text-white">Deposit Rewards</h3>
              <p className="mt-1 text-xs text-slate-300">
                Deposit ₹200 or more via Bank Account or UPI to start playing and earn Bank Deposit bonus rewards.
              </p>
            </div>
            <div className="rounded-2xl bg-[#101a2f] border border-white/10 p-5">
              <div className="text-xs font-bold text-emerald-400 uppercase">Live Games</div>
              <h3 className="mt-1 text-lg font-bold text-white">WinGo &amp; Aviator</h3>
              <p className="mt-1 text-xs text-slate-300">
                Play WinGo (₹1 – ₹5,000) and Aviator (Min ₹10) with verified Deposit &amp; Withdrawal.
              </p>
            </div>
          </div>
        )}

        {/* STAKE SETTINGS */}
        {page === 'stakes' && (
          <form
            onSubmit={handleSavePresets}
            className="rounded-2xl bg-[#101a2f] border border-white/10 p-5 space-y-4"
          >
            <h2 className="text-lg font-bold text-white">Quick Stake Presets</h2>
            <p className="text-xs text-slate-300">
              Customize your 4 quick bet buttons shown on WinGo betting slips.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {presets.map((val, i) => (
                <div key={i}>
                  <label className="mb-1 block text-xs text-slate-300">Button {i + 1} (₹)</label>
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={val}
                    onChange={(e) => {
                      const next = [...presets];
                      next[i] = e.target.value;
                      setPresets(next);
                    }}
                    className="w-full rounded-xl bg-[#08101f] border border-white/15 px-3 py-2.5 text-sm font-bold text-white"
                  />
                </div>
              ))}
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-cyan-400 py-3 text-sm font-bold text-slate-950"
            >
              Save Stake Settings
            </button>
          </form>
        )}

        {/* GAME RULES */}
        {page === 'rules' && (
          <div className="rounded-2xl bg-[#101a2f] border border-white/10 p-5 space-y-3 text-xs text-slate-300 leading-relaxed">
            <h2 className="text-base font-bold text-white">AD78 Platform Rules</h2>
            <p>1. WinGo Color Prediction supports 30 Sec, 1 Min, and 3 Min synchronized rounds with ₹1 to ₹5,000 manual bets.</p>
            <p>2. Aviator supports live synchronized flights with ₹10 minimum bet.</p>
            <p>3. Auto Deposit accepts ₹200 to ₹50,000 via UPI (PhonePe/Paytm/Google Pay) or Bank Account.</p>
            <p>4. Auto Withdrawal minimum is ₹110 to UPI or Bank Account. 24×7 Support is available for any issue.</p>
          </div>
        )}

        {/* PROFILE SETTINGS + SAVED UPI + CHANGE PASSWORD */}
        {page === 'profile' && user && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-[#101a2f] border border-white/10 p-5 space-y-3 text-xs">
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-slate-300">User ID (Login ID)</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(user.id);
                    setMsg({ type: 'ok', text: `Copied User ID: ${user.id}` });
                  }}
                  className="inline-flex items-center gap-1.5 font-bold text-cyan-300 tabular-nums"
                >
                  <span>{user.id}</span>
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex justify-between py-2 border-b border-white/10">
                <span className="text-slate-300">Username</span>
                <span className="font-bold text-white">{user.username}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/10">
                <span className="text-slate-300">Verified Mobile</span>
                <span className="font-bold text-white">{user.mobile}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/10">
                <span className="text-slate-300">Referral Code</span>
                <span className="font-bold text-white">{user.referralCode}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/10">
                <span className="text-slate-300">Joined</span>
                <span className="text-white">{new Date(user.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  onClick={() => onNavigate('bank')}
                  className="rounded-xl bg-white/10 py-2.5 font-semibold text-white hover:bg-white/20"
                >
                  Bank Account
                </button>
                <button
                  onClick={() => onNavigate('statement')}
                  className="rounded-xl bg-white/10 py-2.5 font-semibold text-white hover:bg-white/20"
                >
                  Account Statement
                </button>
              </div>
            </div>

            {/* Saved UPI ID for Withdrawals */}
            <div className="rounded-2xl bg-[#101a2f] border border-cyan-500/30 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Saved UPI ID (Withdrawals)</h3>
                {user.savedUpiId && (
                  <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                    Saved
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={savedUpiInput}
                  onChange={(e) => setSavedUpiInput(e.target.value)}
                  placeholder="Enter your UPI ID (e.g. 9876543210@ybl)"
                  className="flex-1 rounded-xl bg-[#08101f] border border-white/15 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSaveUpiId(savedUpiInput)}
                  className="rounded-xl bg-cyan-400 px-4 py-2.5 text-xs font-bold text-slate-950 hover:brightness-110 transition"
                >
                  Save UPI
                </button>
              </div>
            </div>

            <form
              onSubmit={handleChangePassword}
              className="rounded-2xl bg-[#101a2f] border border-cyan-500/30 p-5 space-y-3"
            >
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-cyan-300" />
                <h3 className="text-sm font-bold text-white">Change Account Password</h3>
              </div>
              <p className="text-[11px] text-slate-300">
                Passwords can only be changed here inside your account or by AD78 Admin.
              </p>

              <div>
                <label className="mb-1 block text-xs text-slate-300">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full rounded-xl bg-[#08101f] border border-white/15 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-300">
                  New Password (Letters + Numbers)
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 chars, e.g. ad78new"
                  className="w-full rounded-xl bg-[#08101f] border border-white/15 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-300">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full rounded-xl bg-[#08101f] border border-white/15 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-cyan-400 py-3 text-sm font-bold text-slate-950 hover:brightness-110 transition"
              >
                {submitting ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* DEPOSIT SUBMITTED (PROCESSING) POPUP MODAL */}
      {depSubmittedModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onClick={() => setDepSubmittedModal(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-amber-400/50 bg-[#0d182d] p-5 shadow-2xl space-y-3.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-300">
                <Clock className="h-5 w-5" />
                <span className="text-sm font-black uppercase tracking-wider">
                  Deposit Processing
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDepSubmittedModal(null)}
                className="rounded-full bg-white/10 p-1.5 text-slate-300 hover:bg-white/20"
                aria-label="Close deposit popup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-2xl bg-[#08101f] border border-white/10 p-3.5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Status</span>
                <span className="font-extrabold text-amber-300 uppercase">Processing</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Amount</span>
                <span className="font-bold text-white tabular-nums">
                  ₹{depSubmittedModal.transaction.amount.toFixed(2)}
                  {depSubmittedModal.pendingBonus > 0
                    ? ` (+₹${depSubmittedModal.pendingBonus} Bonus)`
                    : ''}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Process ID</span>
                <span className="font-bold text-cyan-300 tabular-nums">
                  {depSubmittedModal.transaction.id}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">User ID</span>
                <span className="font-bold text-white tabular-nums">
                  {depSubmittedModal.transaction.userId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">UTR Number</span>
                <span className="font-bold text-white tabular-nums">
                  {depSubmittedModal.transaction.reference}
                </span>
              </div>
            </div>

            {depSubmittedModal.transaction.screenshotData && (
              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-slate-300">
                  Submitted Payment Screenshot
                </div>
                <img
                  src={depSubmittedModal.transaction.screenshotData}
                  alt="Submitted deposit screenshot"
                  className="max-h-40 w-full rounded-xl border border-white/15 bg-[#08101f] object-contain"
                />
              </div>
            )}

            <p className="text-[11px] text-slate-300 text-center">
              Your wallet will update to <strong>Success</strong> once verified &amp; approved in the Admin Panel.
            </p>

            <button
              type="button"
              onClick={() => {
                setDepSubmittedModal(null);
                onNavigate('transactions');
              }}
              className="w-full rounded-xl bg-amber-400 py-3 text-xs font-extrabold text-slate-950 hover:brightness-110 transition"
            >
              View Processing Status in History
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
