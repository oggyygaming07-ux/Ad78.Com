import React, { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Headphones,
  Home,
  Menu,
  User,
  Wallet,
} from 'lucide-react';
import { AviatorState, MinesProState, PlatformConfig, UserProfile } from '../types';
import { BrandLogo } from './BrandLogo';
import { MenuPage } from './WalletAndMenu';

interface HomeDashboardProps {
  user: UserProfile | null;
  aviator: AviatorState | null;
  minesPro: MinesProState | null;
  platformConfig?: PlatformConfig | null;
  onOpenAuth: (mode: 'login' | 'signup') => void;
  onOpenWingo: () => void;
  onOpenAviator: () => void;
  onOpenMinesPro: () => void;
  onOpenMines: () => void;
  onOpenDice: () => void;
  onOpenChickenRoad: () => void;
  onOpenCrystal: () => void;
  onOpenTowerRush: () => void;
  onOpenMenu: (page: MenuPage) => void;
  onOpenSupport: () => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  user,
  aviator,
  minesPro,
  platformConfig,
  onOpenAuth,
  onOpenWingo,
  onOpenAviator,
  onOpenMinesPro,
  onOpenMines,
  onOpenDice,
  onOpenChickenRoad,
  onOpenCrystal,
  onOpenTowerRush,
  onOpenMenu,
  onOpenSupport,
}) => {
  const [slideIdx, setSlideIdx] = useState(0);
  const promoSlides = [
    {
      id: 'wingo',
      title: 'WINGO 30s · 1m · 3m',
      subtitle: 'Color Prediction · Instant Live Draws · Min ₹1',
      image: '/src/assets/images/card_wingo_hero_1795001641085.jpg',
      accent: 'text-amber-300',
      action: onOpenWingo,
    },
    {
      id: 'aviator',
      title: 'AVIATOR CRASH',
      subtitle: 'Watch Multiplier Climb · Cashout Anytime · Min ₹10',
      image: '/src/assets/images/card_aviator_hero_1795003906832.jpg',
      accent: 'text-rose-300',
      action: onOpenAviator,
    },
    {
      id: 'mines_pro',
      title: 'MINES PRO · MAX 2025x',
      subtitle: '3 Armed Mines · Open Golden Stars Live · Double Bet',
      image: '/src/assets/images/card_mines_pro_hero_1795103091509.jpg',
      accent: 'text-amber-300',
      action: onOpenMinesPro,
    },
    {
      id: 'tower_rush',
      title: 'TOWER RUSH',
      subtitle: 'Stack Crane Floors · Cashout Any Floor · ₹50–₹1,000',
      image: '/src/assets/images/card_tower_rush_hero_1795105581680.jpg',
      accent: 'text-amber-300',
      action: onOpenTowerRush,
    },
    {
      id: 'chicken_road',
      title: 'CHICKEN ROAD',
      subtitle: '7-Lane Highway Dash · Up to 120x · ₹50–₹1,000',
      image: '/src/assets/images/card_chicken_road_hero_1795104084752.jpg',
      accent: 'text-orange-300',
      action: onOpenChickenRoad,
    },
    {
      id: 'crystal',
      title: 'CRYSTAL POKER',
      subtitle: '5 Faceted Crystal Hands · Up to 100x · ₹10–₹1,000',
      image: '/src/assets/images/card_crystal_hero_1795105581406.jpg',
      accent: 'text-fuchsia-300',
      action: onOpenCrystal,
    },
    {
      id: 'mines',
      title: 'MINES VAULT',
      subtitle: 'Open Stars · Dodge Spiked Naval Mines · 5×5 Grid',
      image: '/src/assets/images/card_mines_hero_1795103091509.jpg',
      accent: 'text-emerald-300',
      action: onOpenMines,
    },
    {
      id: 'dice',
      title: 'CLASSIC DICE',
      subtitle: 'Over / Under 0–99.99 Roll · ₹10–₹50,000',
      image: '/src/assets/images/card_dice_hero_1795103091674.jpg',
      accent: 'text-cyan-300',
      action: onOpenDice,
    },
  ];

  const disabledSet = new Set(platformConfig?.disabledGames || []);
  const activeSlides = promoSlides.filter((s) => !disabledSet.has(s.id));
  const safeSlideIdx = activeSlides.length > 0 ? slideIdx % activeSlides.length : 0;
  const appTitle = platformConfig?.appName?.trim() || 'AD78';

  useEffect(() => {
    if (activeSlides.length <= 1) return;
    const id = window.setInterval(() => {
      setSlideIdx((prev) => (prev + 1) % activeSlides.length);
    }, 2800);
    return () => window.clearInterval(id);
  }, [activeSlides.length]);

  const guardOpen = (gameId: string, fn: () => void) => {
    if (disabledSet.has(gameId)) return;
    fn();
  };

  return (
    <div className="min-h-screen bg-[#08101d] text-white pb-20">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-[#0a1426]/95 backdrop-blur-md border-b border-white/10 px-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onOpenMenu('menu')}
            aria-label="Open menu"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
          >
            <Menu className="h-5 w-5" />
          </button>
          <BrandLogo size="sm" />
          {appTitle !== 'AD78' && (
            <span className="hidden xs:inline text-xs font-black tracking-wide text-cyan-300">
              {appTitle}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSupport}
            aria-label="24x7 Support"
            title="24x7 Support"
            className="flex items-center gap-1 rounded-full bg-white/10 border border-white/15 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-300 hover:bg-white/20 transition whitespace-nowrap"
          >
            <Headphones className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">24×7 Support</span>
          </button>

          {!user ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onOpenAuth('login')}
                className="rounded-full bg-cyan-400 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:brightness-110 transition whitespace-nowrap"
              >
                Login
              </button>
              <button
                onClick={() => onOpenAuth('signup')}
                className="rounded-full bg-[#0d8b96] px-3.5 py-1.5 text-xs font-bold text-white hover:brightness-110 transition whitespace-nowrap"
              >
                Signup
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onOpenMenu('wallet')}
                className="flex items-center gap-1.5 rounded-full bg-[#10243d] border border-white/20 px-3 py-1.5 text-xs sm:text-sm font-semibold text-white tabular-nums"
              >
                <Wallet className="h-3.5 w-3.5 text-cyan-300" />
                <span>₹{user.balance.toFixed(2)}</span>
              </button>
              <button
                onClick={() => onOpenMenu('deposit')}
                className="rounded-full bg-cyan-400 px-3 py-1.5 text-xs font-bold text-slate-950 hover:brightness-110 whitespace-nowrap"
              >
                + Deposit
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-3 sm:px-6 pt-4 space-y-5">
        {/* Auto-Swiping Featured All-Games Promo Ad Slider */}
        {activeSlides.length > 0 && (
          <section className="relative overflow-hidden rounded-2xl border border-cyan-400/35 bg-[#0d182d] shadow-xl">
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${safeSlideIdx * 100}%)` }}
            >
              {activeSlides.map((slide) => (
                <div
                  key={slide.id}
                  onClick={slide.action}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') slide.action();
                  }}
                  className="relative h-40 sm:h-52 w-full shrink-0 cursor-pointer"
                >
                  <img
                    src={slide.image}
                    alt={slide.title}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-transparent p-4 sm:p-6 flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-cyan-300">
                        Featured Live Game
                      </div>
                      <div className="mt-0.5 text-xl sm:text-3xl font-black text-white">
                        {slide.title}
                      </div>
                      <div className={`mt-1 text-xs sm:text-sm font-semibold ${slide.accent}`}>
                        {slide.subtitle}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex w-fit items-center rounded-full bg-cyan-400 px-4 py-1.5 text-xs font-extrabold text-slate-950 shadow-lg">
                        Play Now
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              aria-label="Previous game ad"
              onClick={() =>
                setSlideIdx((prev) => (prev - 1 + activeSlides.length) % activeSlides.length)
              }
              className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/80 transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Next game ad"
              onClick={() => setSlideIdx((prev) => (prev + 1) % activeSlides.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/80 transition"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <div className="absolute bottom-2.5 right-4 flex items-center gap-1.5">
              {activeSlides.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`Show ${s.title}`}
                  onClick={() => setSlideIdx(idx)}
                  className={`h-1.5 rounded-full transition-all ${
                    safeSlideIdx === idx ? 'w-5 bg-cyan-400' : 'w-1.5 bg-white/40'
                  }`}
                />
              ))}
            </div>
          </section>
        )}

        {/* Promo Banners */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative h-40 sm:h-48 overflow-hidden rounded-2xl border border-white/10 bg-[#0d182d]">
            <img
              src="/src/assets/images/banner_joining_bonus_1795001639122.jpg"
              alt="24x7 Support and Automatic Withdrawal"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-transparent p-4 sm:p-5 flex flex-col justify-between">
              <div>
                <div className="text-lg sm:text-xl font-bold text-white">24×7 Live Support</div>
                <div className="text-sm sm:text-base font-semibold text-cyan-300">
                  Automatic Withdrawal &amp; Auto Deposit
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onOpenSupport}
                  className="w-fit rounded-full bg-white px-5 py-2 text-xs font-bold text-slate-950 shadow-lg hover:bg-cyan-300 transition"
                >
                  24×7 Support
                </button>
                <button
                  onClick={() => (user ? onOpenMenu('withdraw') : onOpenAuth('login'))}
                  className="w-fit rounded-full bg-cyan-400/90 px-4 py-2 text-xs font-bold text-slate-950 shadow-lg hover:bg-cyan-300 transition"
                >
                  Auto Withdraw
                </button>
              </div>
            </div>
          </div>

          <div className="relative h-40 sm:h-48 overflow-hidden rounded-2xl border border-white/10 bg-[#0d182d]">
            <img
              src="/src/assets/images/banner_affiliate_1795001640309.jpg"
              alt="Join Our Affiliate Program"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-transparent p-4 sm:p-5 flex flex-col justify-between">
              <div>
                <div className="text-base sm:text-lg font-bold text-white">
                  Join Our Affiliate Program
                </div>
                <div className="mt-1 text-xs font-medium text-slate-200">
                  Earn daily commission on referrals
                </div>
              </div>
              <button
                onClick={() => (user ? onOpenMenu('affiliate') : onOpenAuth('signup'))}
                className="w-fit rounded-full bg-white px-5 py-2 text-xs font-bold text-slate-950 shadow-lg hover:bg-cyan-300 transition"
              >
                Join Now
              </button>
            </div>
          </div>
        </section>

        {/* Admin Live Update Notice (only shown when set by Admin Panel) */}
        {platformConfig?.noticeText && platformConfig.noticeText.trim().length > 0 && (
          <div className="rounded-xl border border-cyan-400/35 bg-cyan-500/10 px-4 py-2.5 text-xs font-semibold text-cyan-200">
            {platformConfig.noticeText}
          </div>
        )}

        {/* GAMES SECTION: User taps directly on any game card to play */}
        <section id="live-games" className="space-y-3 scroll-mt-16">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">{appTitle} Games</h2>
              <div className="mt-0.5 h-0.5 w-14 bg-cyan-400" />
            </div>
            <span className="text-xs font-semibold text-slate-300">
              Tap a game to play
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* WINGO Card */}
            <button
              onClick={() => guardOpen('wingo', onOpenWingo)}
              disabled={disabledSet.has('wingo')}
              className={`group relative h-36 sm:h-44 overflow-hidden rounded-2xl border border-amber-400/60 bg-gradient-to-b from-orange-500 to-red-600 text-left shadow-lg transition ${
                disabledSet.has('wingo') ? 'opacity-45 cursor-not-allowed' : 'hover:scale-[1.01] active:scale-[0.98]'
              }`}
            >
              <img
                src="/src/assets/images/card_wingo_hero_1795001641085.jpg"
                alt="WINGO Color Prediction"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent p-3 sm:p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[10px] sm:text-xs font-semibold text-white">
                  <span>{disabledSet.has('wingo') ? 'Maintenance' : '30s · 1m · 3m'}</span>
                  <span>Min ₹1</span>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-extrabold tracking-wide text-white">
                    WINGO
                  </div>
                  <div className="text-[11px] font-medium text-emerald-300">
                    Color Prediction
                  </div>
                </div>
              </div>
            </button>

            {/* AVIATOR Card */}
            <button
              onClick={() => guardOpen('aviator', onOpenAviator)}
              disabled={disabledSet.has('aviator')}
              className={`group relative h-36 sm:h-44 overflow-hidden rounded-2xl border border-rose-500/60 bg-gradient-to-b from-slate-900 to-rose-950 text-left shadow-lg transition ${
                disabledSet.has('aviator') ? 'opacity-45 cursor-not-allowed' : 'hover:scale-[1.01] active:scale-[0.98]'
              }`}
            >
              <img
                src="/src/assets/images/card_aviator_hero_1795003906832.jpg"
                alt="AD78 Aviator Crash Game"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent p-3 sm:p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[10px] sm:text-xs font-semibold text-white">
                  <span>
                    {disabledSet.has('aviator')
                      ? 'Maintenance'
                      : aviator?.phase === 'flying'
                      ? `${aviator.multiplier.toFixed(2)}x`
                      : aviator?.phase === 'crashed'
                      ? 'Crashed'
                      : `${aviator?.countdownSec ?? 5}s`}
                  </span>
                  <span>Min ₹10</span>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-extrabold tracking-wide text-white">
                    AVIATOR
                  </div>
                  <div className="text-[11px] font-medium text-rose-300">
                    Live Multiplier Crash
                  </div>
                </div>
              </div>
            </button>

            {/* MINES PRO Card */}
            <button
              onClick={() => guardOpen('mines_pro', onOpenMinesPro)}
              disabled={disabledSet.has('mines_pro')}
              className={`group relative h-36 sm:h-44 overflow-hidden rounded-2xl border border-amber-400/60 bg-gradient-to-b from-[#0b1f2e] to-[#08101d] text-left shadow-lg transition ${
                disabledSet.has('mines_pro') ? 'opacity-45 cursor-not-allowed' : 'hover:scale-[1.01] active:scale-[0.98]'
              }`}
            >
              <img
                src="/src/assets/images/card_mines_pro_hero_1795103091509.jpg"
                alt="AD78 Mines Pro Stars & 3 Mines"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent p-3 sm:p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[10px] sm:text-xs font-semibold text-white">
                  <span>
                    {disabledSet.has('mines_pro')
                      ? 'Maintenance'
                      : `${
                          minesPro?.phase === 'flying'
                            ? `${minesPro.multiplier.toFixed(2)}x`
                            : minesPro?.phase === 'crashed'
                            ? 'Blasted'
                            : `${minesPro?.countdownSec ?? 5}s`
                        } · 3 Mines`}
                  </span>
                  <span>Max 2025x</span>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-extrabold tracking-wide text-white">
                    MINES PRO
                  </div>
                  <div className="text-[11px] font-medium text-amber-300">
                    3 Mines · Opening Stars · Max 2025x
                  </div>
                </div>
              </div>
            </button>

            {/* CHICKEN ROAD Card */}
            <button
              onClick={() => guardOpen('chicken_road', onOpenChickenRoad)}
              disabled={disabledSet.has('chicken_road')}
              className={`group relative h-36 sm:h-44 overflow-hidden rounded-2xl border border-orange-400/60 bg-gradient-to-b from-[#2b1a0c] to-[#08101d] text-left shadow-lg transition ${
                disabledSet.has('chicken_road') ? 'opacity-45 cursor-not-allowed' : 'hover:scale-[1.01] active:scale-[0.98]'
              }`}
            >
              <img
                src="/src/assets/images/card_chicken_road_hero_1795104084752.jpg"
                alt="AD78 Chicken Road Highway Game"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent p-3 sm:p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[10px] sm:text-xs font-semibold text-white">
                  <span>{disabledSet.has('chicken_road') ? 'Maintenance' : '7 Lanes'}</span>
                  <span>Min ₹50</span>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-extrabold tracking-wide text-white">
                    CHICKEN ROAD
                  </div>
                  <div className="text-[11px] font-medium text-orange-300">
                    Cross Highway · Up to 120x
                  </div>
                </div>
              </div>
            </button>

            {/* CRYSTAL POKER Card */}
            <button
              onClick={() => guardOpen('crystal', onOpenCrystal)}
              disabled={disabledSet.has('crystal')}
              className={`group relative h-36 sm:h-44 overflow-hidden rounded-2xl border border-fuchsia-400/60 bg-gradient-to-b from-[#230e36] to-[#08101d] text-left shadow-lg transition ${
                disabledSet.has('crystal') ? 'opacity-45 cursor-not-allowed' : 'hover:scale-[1.01] active:scale-[0.98]'
              }`}
            >
              <img
                src="/src/assets/images/card_crystal_hero_1795105581406.jpg"
                alt="AD78 Crystal Poker Game"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent p-3 sm:p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[10px] sm:text-xs font-semibold text-white">
                  <span>{disabledSet.has('crystal') ? 'Maintenance' : '5 Crystals'}</span>
                  <span>Min ₹10</span>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-extrabold tracking-wide text-white">
                    CRYSTAL POKER
                  </div>
                  <div className="text-[11px] font-medium text-fuchsia-300">
                    Poker Hands · ₹10–₹1,000
                  </div>
                </div>
              </div>
            </button>

            {/* TOWER RUSH Card */}
            <button
              onClick={() => guardOpen('tower_rush', onOpenTowerRush)}
              disabled={disabledSet.has('tower_rush')}
              className={`group relative h-36 sm:h-44 overflow-hidden rounded-2xl border border-amber-400/60 bg-gradient-to-b from-[#2a220c] to-[#08101d] text-left shadow-lg transition ${
                disabledSet.has('tower_rush') ? 'opacity-45 cursor-not-allowed' : 'hover:scale-[1.01] active:scale-[0.98]'
              }`}
            >
              <img
                src="/src/assets/images/card_tower_rush_hero_1795105581680.jpg"
                alt="AD78 Tower Rush Crane Stacking Game"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent p-3 sm:p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[10px] sm:text-xs font-semibold text-white">
                  <span>{disabledSet.has('tower_rush') ? 'Maintenance' : '12 Floors'}</span>
                  <span>Min ₹50</span>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-extrabold tracking-wide text-white">
                    TOWER RUSH
                  </div>
                  <div className="text-[11px] font-medium text-amber-300">
                    Stack Floors · Up to 100x
                  </div>
                </div>
              </div>
            </button>

            {/* MINES Card */}
            <button
              onClick={() => guardOpen('mines', onOpenMines)}
              disabled={disabledSet.has('mines')}
              className={`group relative h-36 sm:h-44 overflow-hidden rounded-2xl border border-emerald-400/60 bg-gradient-to-b from-[#072a28] to-[#08101d] text-left shadow-lg transition ${
                disabledSet.has('mines') ? 'opacity-45 cursor-not-allowed' : 'hover:scale-[1.01] active:scale-[0.98]'
              }`}
            >
              <img
                src="/src/assets/images/card_mines_hero_1795103091509.jpg"
                alt="AD78 Mines Game"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent p-3 sm:p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[10px] sm:text-xs font-semibold text-white">
                  <span>{disabledSet.has('mines') ? 'Maintenance' : '5×5 Grid'}</span>
                  <span>Min ₹10</span>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-extrabold tracking-wide text-white">
                    MINES
                  </div>
                  <div className="text-[11px] font-medium text-emerald-300">
                    Open Stars · Dodge Mines
                  </div>
                </div>
              </div>
            </button>

            {/* DICE Card */}
            <button
              onClick={() => guardOpen('dice', onOpenDice)}
              disabled={disabledSet.has('dice')}
              className={`group relative h-36 sm:h-44 overflow-hidden rounded-2xl border border-cyan-400/60 bg-gradient-to-b from-[#0a2342] to-[#08101d] text-left shadow-lg transition ${
                disabledSet.has('dice') ? 'opacity-45 cursor-not-allowed' : 'hover:scale-[1.01] active:scale-[0.98]'
              }`}
            >
              <img
                src="/src/assets/images/card_dice_hero_1795103091674.jpg"
                alt="AD78 Dice Game"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent p-3 sm:p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[10px] sm:text-xs font-semibold text-white">
                  <span>{disabledSet.has('dice') ? 'Maintenance' : 'Over / Under'}</span>
                  <span>Min ₹10</span>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-extrabold tracking-wide text-white">
                    DICE
                  </div>
                  <div className="text-[11px] font-medium text-cyan-300">
                    Instant 0–99.99 Roll
                  </div>
                </div>
              </div>
            </button>
          </div>
        </section>
      </main>

      {/* Clean 3-Tab Bottom Bar (Games icon removed — tap game card above to play) */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 grid h-16 grid-cols-3 items-center bg-[#091224]/95 backdrop-blur-md border-t border-white/10">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex flex-col items-center justify-center h-full text-cyan-400"
        >
          <Home className="h-5 w-5" />
          <span className="mt-1 text-[10px] font-semibold">Home</span>
        </button>
        <button
          onClick={() => (user ? onOpenMenu('wallet') : onOpenAuth('login'))}
          className="flex flex-col items-center justify-center h-full text-slate-300 hover:text-white"
        >
          <Wallet className="h-5 w-5" />
          <span className="mt-1 text-[10px] font-semibold">Wallet</span>
        </button>
        <button
          onClick={() => onOpenMenu('menu')}
          className="flex flex-col items-center justify-center h-full text-slate-300 hover:text-white"
        >
          <User className="h-5 w-5" />
          <span className="mt-1 text-[10px] font-semibold">Account</span>
        </button>
      </nav>
    </div>
  );
};
