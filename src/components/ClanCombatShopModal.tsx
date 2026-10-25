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
} from 'lucide-react';
import { Clan, ClanWeapon, WeaponRarity } from '../types/nuenime';
import { useNuenimeRpg } from '../context/NuenimeRpgContext';

interface ClanCombatShopModalProps {
  clan?: Clan | null;
  isOpen: boolean;
  onClose: () => void;
}

const RARITY_COLORS: Record<WeaponRarity, { badge: string; text: string; border: string; glow: string }> = {
  Basic: { badge: 'bg-slate-800 text-slate-300 border-slate-700', text: 'text-slate-300', border: 'border-slate-700/80', glow: 'shadow-slate-900/40' },
  Advanced: { badge: 'bg-blue-950/90 text-blue-300 border-blue-500/40', text: 'text-blue-300', border: 'border-blue-500/50', glow: 'shadow-blue-950/50' },
  Epic: { badge: 'bg-purple-950/90 text-purple-300 border-purple-500/40', text: 'text-purple-300', border: 'border-purple-500/50', glow: 'shadow-purple-950/50' },
  Legendary: { badge: 'bg-amber-950/90 text-amber-300 border-amber-500/40', text: 'text-amber-300', border: 'border-amber-500/50', glow: 'shadow-amber-950/50' },
  Mythic: { badge: 'bg-rose-950/90 text-rose-300 border-rose-500/40', text: 'text-rose-300', border: 'border-rose-500/50', glow: 'shadow-rose-950/50' },
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
        <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-[#070d19] p-5 text-center text-slate-200 shadow-2xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-950/60 text-amber-300">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <h3 className="font-display mt-3 text-base font-bold text-white">Gudang & Toko Senjata Klan</h3>
          <p className="mt-1.5 text-xs text-slate-400">
            Anda belum bergabung dengan klan mana pun. Silakan bergabung atau dirikan klan di salah satu kota untuk mengakses inventaris senjata dan kas koin klan.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full h-10 rounded-xl border border-slate-700 bg-slate-800 text-xs font-semibold text-white hover:bg-slate-700 active:scale-95"
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
      <div className="flex h-full max-h-[92vh] sm:max-h-[640px] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#070d19] text-slate-100 shadow-2xl">
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/90 px-3.5 py-3 sm:px-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-950/60 text-amber-300 shadow-sm shadow-amber-500/20">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-xs sm:text-sm font-bold text-white truncate">
                Gudang Senjata & Logistik Klan
              </h2>
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                {activeClan.name} · Kota {activeClan.cityName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 active:scale-95 transition-all ml-2"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Saldo Coin & Role Banner */}
        <div className="grid grid-cols-2 gap-2 border-b border-slate-800/80 bg-slate-900/60 p-2.5 sm:p-3 text-xs">
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-950/30 p-2 sm:p-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 border border-amber-400/30 text-amber-300">
              <Coins className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[9px] sm:text-[10px] text-amber-300/80 font-medium truncate">Saldo Kas Klan</div>
              <div className="font-mono text-xs sm:text-sm font-bold text-amber-200 tabular-nums truncate">
                {clanCoins.toLocaleString('id-ID')} Coin
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-2 sm:p-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/20 border border-sky-400/30 text-sky-300">
              <Shield className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[9px] sm:text-[10px] text-slate-400 font-medium truncate">Otoritas Anda</div>
              <div className="truncate text-[11px] sm:text-xs font-bold">
                {isLeader ? (
                  <span className="text-emerald-300">Ketua (Bisa Beli)</span>
                ) : (
                  <span className="text-slate-400">Anggota (Melihat)</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Message Alert */}
        {actionMessage && (
          <div
            className={`mx-2.5 sm:mx-3 mt-2 flex items-center gap-2 rounded-xl border p-2 text-xs ${
              actionMessage.isError
                ? 'border-rose-500/40 bg-rose-950/50 text-rose-200'
                : 'border-emerald-500/40 bg-emerald-950/50 text-emerald-200'
            }`}
          >
            {actionMessage.isError ? (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            )}
            <span className="flex-1 text-[10.5px] sm:text-[11px] leading-tight">{actionMessage.text}</span>
          </div>
        )}

        {/* 3-Tab Navigator */}
        <div className="grid grid-cols-3 gap-1 border-b border-slate-800 bg-slate-950/90 p-1.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('shop')}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 transition-all ${
              activeTab === 'shop'
                ? 'bg-amber-500/20 border border-amber-400/50 text-amber-200 font-bold'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            <span className="text-[11px] sm:text-xs">Toko Global</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 transition-all ${
              activeTab === 'inventory'
                ? 'bg-sky-500/20 border border-sky-400/50 text-sky-200 font-bold'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            <Package className="h-3.5 w-3.5" />
            <span className="text-[11px] sm:text-xs">Stok Klan</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 transition-all ${
              activeTab === 'history'
                ? 'bg-purple-500/20 border border-purple-400/50 text-purple-200 font-bold'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span className="text-[11px] sm:text-xs">Riwayat</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="nuenime-scroll flex-1 overflow-y-auto p-2.5 sm:p-3 space-y-2.5">
          {/* TAB 1: TOKO SENJATA GLOBAL */}
          {activeTab === 'shop' && (
            <div className="space-y-2.5">
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-2.5 text-[10.5px] sm:text-[11px] text-slate-300 leading-relaxed">
                Senjata sekali pakai dibeli menggunakan <strong>Coin klan</strong> oleh Ketua Klan. Senjata akan tersimpan di gudang klan dan langsung digunakan saat menyerang <strong>Bos Kota Musuh</strong>.
              </div>

              {weaponsCatalog.map((weapon) => {
                const style = RARITY_COLORS[weapon.rarity] || RARITY_COLORS.Basic;
                const ownedItem = clanInventory.find((i) => i.weaponId === weapon.id);
                const currentStock = ownedItem ? ownedItem.quantity : 0;
                const qty = getQty(weapon.id);
                const totalCost = weapon.priceCoin * qty;
                const canAfford = clanCoins >= totalCost;

                return (
                  <div
                    key={weapon.id}
                    className={`rounded-2xl border ${style.border} bg-slate-900/80 p-2.5 sm:p-3 transition-all hover:bg-slate-900/95`}
                  >
                    {/* Baris Atas Info Senjata */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 text-amber-300 shadow-inner">
                          <Swords className="h-5 w-5 sm:h-6 sm:w-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`rounded px-1.5 py-0.5 border font-mono text-[9px] font-bold uppercase ${style.badge}`}>
                              {weapon.rarity}
                            </span>
                            <span className="font-mono text-[10px] font-bold text-rose-300 bg-rose-950/60 border border-rose-500/30 px-1.5 py-0.5 rounded">
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

                      {/* Info Harga & Stok Klan di Pojok Kanan */}
                      <div className="text-right shrink-0">
                        <div className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-950/40 px-2 py-0.5 font-mono text-xs font-bold text-amber-300">
                          <Coins className="h-3 w-3 text-amber-400" />
                          <span>{weapon.priceCoin.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 font-mono">
                          Stok: <strong className="text-sky-300 font-bold">{currentStock}x</strong>
                        </div>
                      </div>
                    </div>

                    {/* Tombol Beli / Quantity Selector - Didesain Presisi untuk Mobile */}
                    {isLeader ? (
                      <div className="mt-2.5 flex flex-col xs:flex-row items-stretch xs:items-center justify-between gap-2 border-t border-slate-800/80 pt-2.5">
                        {/* Selector 1x, 3x, 5x */}
                        <div className="flex items-center justify-center rounded-xl border border-slate-800 bg-slate-950 p-0.5 self-center xs:self-auto">
                          {[1, 3, 5].map((multiplier) => (
                            <button
                              key={multiplier}
                              type="button"
                              onClick={() => setQty(weapon.id, multiplier)}
                              className={`h-8 px-3 rounded-lg text-xs font-mono font-bold transition-all ${
                                qty === multiplier
                                  ? 'bg-amber-500/25 border border-amber-400/60 text-amber-300 shadow-sm'
                                  : 'text-slate-400 hover:text-white border border-transparent'
                              }`}
                            >
                              {multiplier}x
                            </button>
                          ))}
                        </div>

                        {/* Tombol Beli */}
                        <button
                          type="button"
                          disabled={isSubmitting || !canAfford}
                          onClick={() => handleBuy(weapon)}
                          className={`flex h-9 sm:h-10 items-center justify-center gap-1.5 rounded-xl px-3 sm:px-4 text-xs font-bold transition-all active:scale-95 ${
                            canAfford
                              ? 'border border-amber-400/60 bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-md shadow-amber-900/40 hover:from-amber-500 hover:to-amber-600'
                              : 'border border-slate-800 bg-slate-800/60 text-slate-500 cursor-not-allowed'
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
                      <div className="mt-2.5 flex items-center justify-between border-t border-slate-800/80 pt-2 text-[10px] text-slate-500">
                        <span>Hanya Ketua Klan yang dapat membeli senjata logistik.</span>
                        <span className="text-sky-400/80 font-mono">Tersedia {currentStock}x di Gudang</span>
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
                <span className="font-medium">Daftar Senjata Siap Tempur:</span>
                <span className="font-mono text-sky-300 font-bold">
                  Total {clanInventory.reduce((sum, i) => sum + i.quantity, 0)} Senjata
                </span>
              </div>

              {clanInventory.length === 0 || clanInventory.every((i) => i.quantity === 0) ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-6 sm:p-8 text-center">
                  <Package className="h-10 w-10 text-slate-600 mb-2" />
                  <div className="font-display text-xs sm:text-sm font-bold text-slate-300">
                    Gudang Logistik Masih Kosong
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 max-w-xs leading-relaxed">
                    Ketua Klan dapat membeli senjata sekali pakai di tab Toko Global menggunakan Coin klan.
                  </p>
                  {isLeader && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('shop')}
                      className="mt-3.5 h-9 rounded-xl border border-amber-500/50 bg-amber-500/20 px-4 text-xs font-bold text-amber-200 hover:bg-amber-500/30 active:scale-95 transition-all"
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
                      RARITY_COLORS[catalogItem?.rarity || 'Basic'] || RARITY_COLORS.Basic;

                    return (
                      <div
                        key={item.weaponId}
                        className={`flex items-center justify-between gap-3 rounded-2xl border ${style.border} bg-slate-900/80 p-2.5 sm:p-3`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 text-amber-300">
                            <Swords className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`rounded px-1.5 py-0.5 border font-mono text-[9px] font-bold uppercase ${style.badge}`}>
                                {catalogItem?.rarity || 'Senjata'}
                              </span>
                              <span className="font-mono text-[10px] font-bold text-rose-300 bg-rose-950/60 border border-rose-500/30 px-1.5 py-0.5 rounded">
                                +{catalogItem?.damage.toLocaleString('id-ID')} DMG
                              </span>
                            </div>
                            <h4 className="font-display truncate text-xs sm:text-sm font-bold text-white mt-0.5">
                              {catalogItem?.name || item.weaponId}
                            </h4>
                            <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                              Sekali pakai saat menyerang Bos Kota Musuh
                            </p>
                          </div>
                        </div>

                        <div className="rounded-xl border border-sky-500/40 bg-sky-950/60 px-3 py-1.5 text-right shrink-0">
                          <div className="text-[9px] text-sky-300/80 font-medium">Tersedia</div>
                          <div className="font-mono text-xs sm:text-sm font-bold text-white">
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
            <div className="space-y-3">
              {/* Riwayat Coin */}
              <div>
                <h4 className="font-display text-xs font-bold text-amber-300 mb-2 flex items-center gap-1.5">
                  <Coins className="h-3.5 w-3.5" />
                  <span>Mutasi Coin Klan</span>
                </h4>
                {clanCoinTransactions.length === 0 ? (
                  <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-center text-[11px] text-slate-500">
                    Belum ada riwayat transaksi Coin klan.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {clanCoinTransactions.slice(0, 10).map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-2 sm:p-2.5 text-[11px] gap-2"
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
                  <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-center text-[11px] text-slate-500">
                    Belum ada riwayat serangan ke bos kota musuh.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {bossBattleLogs.slice(0, 10).map((log) => (
                      <div
                        key={log.id}
                        className="rounded-xl border border-slate-800 bg-slate-900/60 p-2 sm:p-2.5 text-[11px] space-y-1"
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
        <div className="border-t border-slate-800 bg-slate-950 px-3.5 py-2.5 flex items-center justify-between text-[11px] text-slate-400">
          <span className="truncate text-[10.5px]">Sistem Senjata Sekali Pakai & Coin Nuenime</span>
          <button
            type="button"
            onClick={onClose}
            className="h-8 sm:h-9 rounded-xl border border-slate-700 bg-slate-800 px-4 font-semibold text-slate-200 hover:text-white hover:bg-slate-700 active:scale-95 transition-all text-xs"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

