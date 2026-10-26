import React, { useState } from 'react';
import {
  X,
  Swords,
  Coins,
  Shield,
  ShoppingBag,
  History,
  CheckCircle2,
  AlertCircle,
  Package,
  Trophy,
  Sparkles,
  Flame,
  Zap,
} from 'lucide-react';
import { Clan, ClanWeapon, WeaponRarity } from '../types/nuenime';
import { useNuenimeRpg } from '../context/NuenimeRpgContext';

interface ClanCombatShopModalProps {
  clan?: Clan | null;
  isOpen: boolean;
  onClose: () => void;
}

const RARITY_THEMES: Record<
  WeaponRarity,
  {
    badge: string;
    text: string;
    border: string;
    glow: string;
    gradient: string;
    iconBg: string;
    iconColor: string;
  }
> = {
  Basic: {
    badge: 'bg-slate-800/90 text-slate-300 border-slate-700/80',
    text: 'text-slate-300',
    border: 'border-slate-700/60 hover:border-slate-500/80',
    glow: 'shadow-slate-900/30',
    gradient: 'from-slate-900/80 via-[#0B0E17]/90 to-[#07090F]',
    iconBg: 'bg-slate-800/50 border-slate-700/60',
    iconColor: 'text-slate-300',
  },
  Advanced: {
    badge: 'bg-sky-950/90 text-sky-300 border-sky-500/40',
    text: 'text-sky-300',
    border: 'border-sky-500/40 hover:border-sky-400/80',
    glow: 'shadow-sky-950/40',
    gradient: 'from-sky-950/30 via-[#0B0E17]/90 to-[#07090F]',
    iconBg: 'bg-sky-950/50 border-sky-500/40',
    iconColor: 'text-sky-300',
  },
  Epic: {
    badge: 'bg-purple-950/90 text-purple-300 border-purple-500/40',
    text: 'text-purple-300',
    border: 'border-purple-500/40 hover:border-purple-400/80',
    glow: 'shadow-purple-950/40',
    gradient: 'from-purple-950/30 via-[#0B0E17]/90 to-[#07090F]',
    iconBg: 'bg-purple-950/50 border-purple-500/40',
    iconColor: 'text-purple-300',
  },
  Legendary: {
    badge: 'bg-amber-950/90 text-amber-300 border-amber-500/50',
    text: 'text-amber-300',
    border: 'border-amber-500/50 hover:border-amber-400',
    glow: 'shadow-amber-950/50',
    gradient: 'from-amber-950/35 via-[#0B0E17]/90 to-[#07090F]',
    iconBg: 'bg-amber-950/50 border-amber-500/40',
    iconColor: 'text-amber-300',
  },
  Mythic: {
    badge: 'bg-rose-950/90 text-rose-300 border-rose-500/50',
    text: 'text-rose-300',
    border: 'border-rose-500/50 hover:border-rose-400',
    glow: 'shadow-rose-950/50',
    gradient: 'from-rose-950/35 via-[#0B0E17]/90 to-[#07090F]',
    iconBg: 'bg-rose-950/50 border-rose-500/40',
    iconColor: 'text-rose-300',
  },
};

export const ClanCombatShopModal: React.FC<ClanCombatShopModalProps> = ({
  clan,
  isOpen,
  onClose,
}) => {
  const {
    activeAccount,
    allClans,
    joinedClanId,
    weaponsCatalog,
    clanInventory,
    clanCoinTransactions,
    bossBattleLogs,
    buyClanWeapon,
  } = useNuenimeRpg();

  const [activeTab, setActiveTab] = useState<'shop' | 'inventory' | 'history'>('shop');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  if (!isOpen) return null;

  const activeClan = clan ?? allClans.find((c) => c.id === joinedClanId) ?? null;

  if (!activeClan) {
    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-md">
        <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-amber-500/25 bg-gradient-to-b from-[#0D121F] via-[#090D16] to-[#06080F] p-6 text-center text-slate-200 shadow-2xl backdrop-blur-2xl">
          <div className="pointer-events-none absolute -top-16 left-1/2 h-32 w-48 -translate-x-1/2 rounded-full bg-amber-500/20 blur-3xl" />
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-500/10 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.25)]">
            <ShoppingBag className="h-7 w-7" />
          </div>
          <h3 className="font-display mt-4 text-base font-extrabold text-white tracking-wide uppercase">
            Gudang & Toko Senjata Klan
          </h3>
          <p className="mt-2 text-xs text-slate-400 leading-relaxed">
            Anda belum bergabung dengan klan mana pun. Silakan bergabung atau dirikan klan di salah satu kota untuk mengakses inventaris senjata dan kas koin klan.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-5 w-full h-11 rounded-xl border border-sky-400/50 bg-gradient-to-r from-sky-600 to-indigo-700 text-xs font-bold text-white shadow-lg shadow-sky-950/50 hover:brightness-110 active:scale-95 transition-all"
          >
            Tutup
          </button>
        </div>
      </div>
    );
  }

  const isLeader =
    activeClan.leaderId === activeAccount.id ||
    activeClan.members.some(
      (m) =>
        m.userId === activeAccount.id &&
        (m.role === 'Pemimpin Klan' || m.role === 'Ketua')
    );

  const clanCoins = activeClan.coins ?? 1000;
  const totalStockCount = clanInventory.reduce((sum, i) => sum + i.quantity, 0);

  const getQty = (weaponId: string) => quantities[weaponId] || 1;
  const setQty = (weaponId: string, val: number) => {
    setQuantities((prev) => ({ ...prev, [weaponId]: val }));
  };

  const handleBuy = async (weapon: ClanWeapon) => {
    if (!isLeader) {
      setActionMessage({
        text: 'Hanya Ketua Klan yang berhak membeli senjata menggunakan saldo Coin klan.',
        isError: true,
      });
      return;
    }

    const qty = getQty(weapon.id);
    const totalCost = weapon.priceCoin * qty;
    if (clanCoins < totalCost) {
      setActionMessage({
        text: `Saldo Coin klan tidak cukup! Butuh ${totalCost.toLocaleString('id-ID')} Coin, saldo klan: ${clanCoins.toLocaleString('id-ID')} Coin.`,
        isError: true,
      });
      return;
    }

    try {
      setIsSubmitting(true);
      setActionMessage(null);
      const res = await buyClanWeapon(weapon.id, qty);
      if (res.ok) {
        setActionMessage({
          text: `Berhasil membeli ${qty}x ${weapon.name}! Senjata telah masuk ke Stok Gudang Klan.`,
          isError: false,
        });
        setQty(weapon.id, 1);
      } else {
        setActionMessage({ text: res.message, isError: true });
      }
    } catch (err: any) {
      setActionMessage({ text: err?.message || 'Gagal membeli senjata', isError: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-2 sm:p-4 backdrop-blur-md">
      <div className="relative flex h-full max-h-[92vh] sm:max-h-[660px] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-amber-500/25 bg-gradient-to-b from-[#0D121F] via-[#090D16] to-[#06080F] text-slate-100 shadow-[0_0_50px_rgba(0,0,0,0.85)]">
        {/* Ambient Top Light Beam */}
        <div className="pointer-events-none absolute -top-24 left-1/2 h-36 w-72 -translate-x-1/2 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />

        {/* Header Modal */}
        <div className="relative z-10 flex items-center justify-between border-b border-white/10 bg-[#0B0F19]/90 px-3.5 py-3 sm:px-4 backdrop-blur-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-400/35 bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-transparent text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.25)]">
              <ShoppingBag className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-xs sm:text-sm font-extrabold tracking-wide uppercase bg-gradient-to-r from-amber-200 via-white to-amber-100 bg-clip-text text-transparent truncate">
                Gudang Senjata & Logistik Klan
              </h2>
              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-400 truncate mt-0.5">
                <span className="font-semibold text-amber-300/90">{activeClan.name}</span>
                <span className="text-slate-600">·</span>
                <span className="text-sky-300/90">Kota {activeClan.cityName}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.1] hover:border-white/20 active:scale-90 transition-all ml-2"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Dual Compact Status Bar: Kas Klan & Otoritas */}
        <div className="relative z-10 grid grid-cols-2 gap-2 border-b border-white/5 bg-[#080B13]/80 p-2.5 sm:p-3">
          {/* Kas Klan */}
          <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-950/40 via-amber-900/15 to-slate-900/40 p-2.5 shadow-sm">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400/25 to-amber-600/10 border border-amber-400/30 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.2)]">
                <Coins className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[9.5px] uppercase tracking-wider font-semibold text-amber-300/75 truncate">
                  Saldo Kas Klan
                </div>
                <div className="font-mono text-xs sm:text-sm font-extrabold text-amber-200 tabular-nums truncate">
                  {clanCoins.toLocaleString('id-ID')}{' '}
                  <span className="text-[10px] font-normal text-amber-400/80">Coin</span>
                </div>
              </div>
            </div>
          </div>

          {/* Otoritas */}
          <div
            className={`relative overflow-hidden rounded-2xl border p-2.5 shadow-sm ${
              isLeader
                ? 'border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-emerald-900/15 to-slate-900/40'
                : 'border-slate-700/50 bg-gradient-to-r from-slate-900/60 to-slate-950/60'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                  isLeader
                    ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400'
                }`}
              >
                <Shield className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[9.5px] uppercase tracking-wider font-semibold text-slate-400 truncate">
                  Otoritas Anda
                </div>
                <div className="truncate text-[11px] sm:text-xs font-bold">
                  {isLeader ? (
                    <span className="text-emerald-300 flex items-center gap-1">
                      Ketua <span className="text-[9.5px] font-normal text-emerald-400/80">(Bisa Beli)</span>
                    </span>
                  ) : (
                    <span className="text-slate-300 flex items-center gap-1">
                      Anggota <span className="text-[9.5px] font-normal text-slate-400">(Siap Pakai)</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Message Alert */}
        {actionMessage && (
          <div
            className={`mx-2.5 sm:mx-3 mt-2 flex items-center gap-2 rounded-2xl border p-2.5 text-xs animate-fadeIn ${
              actionMessage.isError
                ? 'border-rose-500/40 bg-rose-950/60 text-rose-200'
                : 'border-emerald-500/40 bg-emerald-950/60 text-emerald-200'
            }`}
          >
            {actionMessage.isError ? (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            )}
            <span className="flex-1 text-[10.5px] sm:text-[11px] leading-tight font-medium">
              {actionMessage.text}
            </span>
          </div>
        )}

        {/* 3-Tab Recessed Capsule Navigator */}
        <div className="px-2.5 sm:px-3 pt-2 pb-1 bg-[#070A10]/90 border-b border-white/5">
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-black/40 border border-white/5 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('shop')}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 transition-all ${
                activeTab === 'shop'
                  ? 'bg-gradient-to-r from-amber-500/25 to-amber-600/15 border border-amber-400/50 text-amber-200 font-bold shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                  : 'text-slate-400 hover:text-white border border-transparent'
              }`}
            >
              <ShoppingBag className="h-3.5 w-3.5 shrink-0" />
              <span className="text-[11px] sm:text-xs">Toko Global</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('inventory')}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 transition-all ${
                activeTab === 'inventory'
                  ? 'bg-gradient-to-r from-sky-500/25 to-sky-600/15 border border-sky-400/50 text-sky-200 font-bold shadow-[0_0_12px_rgba(14,165,233,0.2)]'
                  : 'text-slate-400 hover:text-white border border-transparent'
              }`}
            >
              <Package className="h-3.5 w-3.5 shrink-0" />
              <span className="text-[11px] sm:text-xs">Stok Klan</span>
              {totalStockCount > 0 && (
                <span className="ml-0.5 rounded-full bg-sky-500/30 border border-sky-400/40 px-1.5 py-0.2 text-[9px] font-mono text-sky-200">
                  {totalStockCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 transition-all ${
                activeTab === 'history'
                  ? 'bg-gradient-to-r from-purple-500/25 to-purple-600/15 border border-purple-400/50 text-purple-200 font-bold shadow-[0_0_12px_rgba(168,85,247,0.2)]'
                  : 'text-slate-400 hover:text-white border border-transparent'
              }`}
            >
              <History className="h-3.5 w-3.5 shrink-0" />
              <span className="text-[11px] sm:text-xs">Riwayat</span>
            </button>
          </div>
        </div>

        {/* Scrollable Body Content */}
        <div className="nuenime-scroll flex-1 overflow-y-auto p-2.5 sm:p-3 space-y-3">
          {/* TAB 1: TOKO SENJATA GLOBAL */}
          {activeTab === 'shop' && (
            <div className="space-y-2.5">
              {/* Notice Banner */}
              <div className="flex items-start gap-2.5 rounded-2xl border border-sky-500/25 bg-gradient-to-r from-sky-950/30 via-slate-900/40 to-transparent p-2.5 sm:p-3 text-[10.5px] sm:text-[11px] text-sky-200/90 leading-relaxed">
                <Sparkles className="h-4 w-4 shrink-0 text-sky-400 mt-0.5" />
                <div>
                  Senjata sekali pakai dibeli menggunakan <strong>Coin klan</strong> oleh Ketua Klan. Senjata tersimpan di gudang klan dan dapat digunakan oleh <strong>seluruh anggota klan</strong> saat menyerang <strong>Bos Kota Musuh</strong>.
                </div>
              </div>

              {weaponsCatalog.map((weapon) => {
                const style = RARITY_THEMES[weapon.rarity] || RARITY_THEMES.Basic;
                const ownedItem = clanInventory.find((i) => i.weaponId === weapon.id);
                const currentStock = ownedItem ? ownedItem.quantity : 0;
                const qty = getQty(weapon.id);
                const totalCost = weapon.priceCoin * qty;
                const canAfford = clanCoins >= totalCost;

                return (
                  <div
                    key={weapon.id}
                    className={`group relative overflow-hidden rounded-2xl border ${style.border} bg-gradient-to-b ${style.gradient} p-3 sm:p-3.5 transition-all shadow-md hover:shadow-xl`}
                  >
                    {/* Top Row Info Senjata */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        {/* Glowing Weapon Icon Box */}
                        <div
                          className={`flex h-12 w-12 sm:h-13 sm:w-13 shrink-0 items-center justify-center rounded-2xl border ${style.iconBg} ${style.iconColor} shadow-inner transition-transform group-hover:scale-105`}
                        >
                          <Swords className="h-6 w-6" />
                        </div>

                        {/* Title, Chips, Description */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`rounded-md px-1.5 py-0.5 border font-mono text-[9px] font-extrabold uppercase tracking-wider ${style.badge}`}
                            >
                              {weapon.rarity}
                            </span>
                            <span className="flex items-center gap-1 font-mono text-[10px] font-bold text-rose-300 bg-rose-950/60 border border-rose-500/30 px-1.5 py-0.5 rounded-md">
                              <Flame className="h-3 w-3 text-rose-400" />
                              +{weapon.damage.toLocaleString('id-ID')} DMG
                            </span>
                          </div>
                          <h4 className="font-display text-xs sm:text-sm font-bold text-white mt-1 leading-snug">
                            {weapon.name}
                          </h4>
                          <p className="text-[10px] sm:text-[10.5px] text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                            {weapon.description}
                          </p>
                        </div>
                      </div>

                      {/* Info Harga & Sisa Stok Gudang di Kanan Atas */}
                      <div className="text-right shrink-0">
                        <div className="inline-flex items-center gap-1 rounded-xl border border-amber-400/40 bg-gradient-to-r from-amber-500/20 to-amber-600/10 px-2.5 py-1 font-mono text-xs font-extrabold text-amber-300 shadow-sm">
                          <Coins className="h-3.5 w-3.5 text-amber-400" />
                          <span>{weapon.priceCoin.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 font-mono">
                          Stok: <strong className="text-sky-300 font-bold">{currentStock}x</strong>
                        </div>
                      </div>
                    </div>

                    {/* Integrated Modern Action Bar */}
                    {isLeader ? (
                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/5 pt-2.5">
                        {/* Tight Multiplier Selector: 1x, 3x, 5x */}
                        <div className="flex items-center rounded-xl border border-white/10 bg-black/40 p-0.5">
                          {[1, 3, 5].map((multiplier) => (
                            <button
                              key={multiplier}
                              type="button"
                              onClick={() => setQty(weapon.id, multiplier)}
                              className={`h-7 px-2.5 rounded-lg text-xs font-mono font-bold transition-all ${
                                qty === multiplier
                                  ? 'bg-amber-500/25 border border-amber-400/60 text-amber-300 shadow-sm'
                                  : 'text-slate-400 hover:text-white border border-transparent'
                              }`}
                            >
                              {multiplier}x
                            </button>
                          ))}
                        </div>

                        {/* Gold Gradient Buy Button */}
                        <button
                          type="button"
                          disabled={isSubmitting || !canAfford}
                          onClick={() => handleBuy(weapon)}
                          className={`flex h-9 sm:h-9.5 items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-bold transition-all active:scale-95 ${
                            canAfford
                              ? 'border border-amber-400/70 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-white shadow-md shadow-amber-950/60 hover:brightness-110'
                              : 'border border-slate-800 bg-slate-900/60 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          <Coins className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">
                            {canAfford
                              ? `Beli ${qty}x (${totalCost.toLocaleString('id-ID')} Coin)`
                              : `Coin Kurang (${totalCost.toLocaleString('id-ID')})`}
                          </span>
                        </button>
                      </div>
                    ) : (
                      <div className="mt-2.5 flex items-center justify-between border-t border-white/5 pt-2 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Shield className="h-3 w-3 text-slate-400" />
                          Hanya Ketua Klan yang dapat membeli senjata.
                        </span>
                        <span className="text-sky-300/90 font-mono">Tersedia {currentStock}x di Gudang</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 2: INVENTORY KLAN */}
          {activeTab === 'inventory' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs text-slate-300 px-0.5">
                <span className="font-semibold text-white">Daftar Senjata Siap Tempur:</span>
                <span className="font-mono text-sky-300 font-bold">
                  Total {totalStockCount} Senjata di Gudang
                </span>
              </div>

              {clanInventory.length === 0 || clanInventory.every((i) => i.quantity === 0) ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-800/90 bg-gradient-to-b from-slate-900/40 to-slate-950/60 p-7 sm:p-9 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700/50 bg-slate-800/40 text-slate-500 mb-2.5">
                    <Package className="h-6 w-6" />
                  </div>
                  <div className="font-display text-xs sm:text-sm font-bold text-slate-200">
                    Gudang Logistik Masih Kosong
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400 max-w-xs leading-relaxed">
                    Ketua Klan dapat membeli senjata sekali pakai di tab Toko Global menggunakan Coin klan.
                  </p>
                  {isLeader && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('shop')}
                      className="mt-4 h-9 rounded-xl border border-amber-500/50 bg-gradient-to-r from-amber-600/30 to-amber-700/30 px-4 text-xs font-bold text-amber-200 hover:border-amber-400 hover:bg-amber-600/40 active:scale-95 transition-all shadow-md shadow-amber-950/40"
                    >
                      Buka Toko Senjata
                    </button>
                  )}
                </div>
              ) : (
                clanInventory
                  .filter((i) => i.quantity > 0)
                  .map((item) => {
                    const catalogItem =
                      weaponsCatalog.find((w) => w.id === item.weaponId) ?? item.weapon;
                    const style =
                      RARITY_THEMES[catalogItem?.rarity || 'Basic'] || RARITY_THEMES.Basic;

                    return (
                      <div
                        key={item.weaponId}
                        className={`flex items-center justify-between gap-3 rounded-2xl border ${style.border} bg-gradient-to-b ${style.gradient} p-3 sm:p-3.5 shadow-md`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${style.iconBg} ${style.iconColor}`}
                          >
                            <Swords className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`rounded px-1.5 py-0.5 border font-mono text-[9px] font-bold uppercase ${style.badge}`}
                              >
                                {catalogItem?.rarity || 'Senjata'}
                              </span>
                              <span className="font-mono text-[10px] font-bold text-rose-300 bg-rose-950/60 border border-rose-500/30 px-1.5 py-0.5 rounded">
                                +{catalogItem?.damage.toLocaleString('id-ID')} DMG
                              </span>
                            </div>
                            <h4 className="font-display truncate text-xs sm:text-sm font-bold text-white mt-1">
                              {catalogItem?.name || item.weaponId}
                            </h4>
                            <p className="text-[10px] text-slate-400 mt-0.5 truncate flex items-center gap-1">
                              <Zap className="h-3 w-3 text-amber-400" />
                              Sekali pakai saat menyerang Bos Kota Musuh
                            </p>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-sky-400/40 bg-gradient-to-br from-sky-500/20 to-sky-700/10 px-3.5 py-2 text-right shrink-0 shadow-sm">
                          <div className="text-[9px] text-sky-300/80 font-semibold uppercase tracking-wider">
                            Tersedia
                          </div>
                          <div className="font-mono text-xs sm:text-sm font-extrabold text-white">
                            {item.quantity}x
                          </div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          )}

          {/* TAB 3: RIWAYAT TRANSAKSI & SERANGAN BOS */}
          {activeTab === 'history' && (
            <div className="space-y-3.5">
              {/* Riwayat Coin */}
              <div>
                <h4 className="font-display text-xs font-bold text-amber-300 mb-2 flex items-center gap-1.5">
                  <Coins className="h-3.5 w-3.5" />
                  <span>Mutasi Coin Klan</span>
                </h4>
                {clanCoinTransactions.length === 0 ? (
                  <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-3.5 text-center text-[11px] text-slate-500">
                    Belum ada riwayat transaksi Coin klan.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {clanCoinTransactions.slice(0, 10).map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-900/60 p-2 sm:p-2.5 text-[11px] gap-2 hover:bg-slate-900/80 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-white truncate text-xs">
                            {tx.description || tx.transactionType}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                            Oleh: {tx.actorName || 'Ketua Klan'} · {new Date(tx.createdAt).toLocaleDateString('id-ID')}
                          </div>
                        </div>
                        <div
                          className={`font-mono text-xs font-bold tabular-nums shrink-0 ${
                            tx.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {tx.amount >= 0 ? `+${tx.amount.toLocaleString('id-ID')}` : tx.amount.toLocaleString('id-ID')} Coin
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Riwayat Serangan Bos */}
              <div>
                <h4 className="font-display text-xs font-bold text-rose-300 mb-2 flex items-center gap-1.5">
                  <Swords className="h-3.5 w-3.5" />
                  <span>Riwayat Pertempuran Bos</span>
                </h4>
                {bossBattleLogs.length === 0 ? (
                  <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-3.5 text-center text-[11px] text-slate-500">
                    Belum ada riwayat serangan ke bos kota musuh.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {bossBattleLogs.slice(0, 10).map((log) => (
                      <div
                        key={log.id}
                        className="rounded-xl border border-white/5 bg-slate-900/60 p-2 sm:p-2.5 text-[11px] space-y-1 hover:bg-slate-900/80 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-white truncate text-xs">
                            Target: Kota {log.targetCityId.toUpperCase()}
                          </span>
                          <span className="font-mono font-bold text-rose-300 tabular-nums shrink-0">
                            -{log.totalDamage.toLocaleString('id-ID')} DMG
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center justify-between gap-2">
                          <span className="truncate">
                            Penyerang: {log.attackerName} ({log.attackerClanName})
                          </span>
                          <span className="shrink-0">
                            {log.weaponName ? `Pakai: ${log.weaponName}` : 'Serangan Dasar'}
                          </span>
                        </div>
                        {log.bossDefeated && (
                          <div className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-950/80 border border-emerald-500/40 px-2 py-1 text-[10px] font-bold text-emerald-300 text-center">
                            <Trophy className="h-3 w-3 text-amber-300 shrink-0" />
                            <span>BOS DITAKLUKKAN! Reward +{log.rewardCoins} Coin & +{log.rewardExp} EXP</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 bg-[#090D17]/95 px-3.5 py-3 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-2 truncate">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="truncate text-[10.5px]">Sistem Senjata Sekali Pakai & Coin Nuenime</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-xl border border-slate-700 bg-slate-800/90 px-4 font-semibold text-slate-200 hover:text-white hover:bg-slate-700 active:scale-95 transition-all text-xs shrink-0"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

