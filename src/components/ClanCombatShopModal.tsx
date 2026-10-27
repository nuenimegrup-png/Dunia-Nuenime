import React, { useState, useEffect, useMemo } from 'react';
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
  Lock,
} from 'lucide-react';
import { Clan, ClanWeapon, WeaponRarity } from '../types/nuenime';
import { useNuenimeRpg } from '../context/NuenimeRpgContext';
import { supabase } from '../lib/supabase';

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
    badge: 'bg-white/[0.06] text-slate-300 border-white/10',
    text: 'text-slate-300',
    border: 'border-white/[0.08] hover:border-white/20',
    glow: 'shadow-black/20',
    gradient: 'from-white/[0.02] to-transparent',
    iconBg: 'bg-white/[0.04] border-white/10',
    iconColor: 'text-slate-300',
  },
  Advanced: {
    badge: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
    text: 'text-sky-300',
    border: 'border-white/[0.08] hover:border-sky-500/30',
    glow: 'shadow-black/20',
    gradient: 'from-sky-500/[0.03] to-transparent',
    iconBg: 'bg-sky-500/10 border-sky-500/20',
    iconColor: 'text-sky-300',
  },
  Epic: {
    badge: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
    text: 'text-purple-300',
    border: 'border-white/[0.08] hover:border-purple-500/30',
    glow: 'shadow-black/20',
    gradient: 'from-purple-500/[0.03] to-transparent',
    iconBg: 'bg-purple-500/10 border-purple-500/20',
    iconColor: 'text-purple-300',
  },
  Legendary: {
    badge: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    text: 'text-amber-300',
    border: 'border-white/[0.08] hover:border-amber-500/30',
    glow: 'shadow-black/20',
    gradient: 'from-amber-500/[0.03] to-transparent',
    iconBg: 'bg-amber-500/10 border-amber-500/20',
    iconColor: 'text-amber-300',
  },
  Mythic: {
    badge: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
    text: 'text-rose-300',
    border: 'border-white/[0.08] hover:border-rose-500/30',
    glow: 'shadow-black/20',
    gradient: 'from-rose-500/[0.03] to-transparent',
    iconBg: 'bg-rose-500/10 border-rose-500/20',
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
    refreshClanCombatData,
  } = useNuenimeRpg();

  const [activeTab, setActiveTab] = useState<'shop' | 'inventory' | 'history'>('shop');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [liveCoins, setLiveCoins] = useState<number | null>(null);

  // ATURAN PRIVASI GUDANG MUTLAK:
  // Pengguna HANYA diizinkan membuka dan melihat isi gudang klan miliknya sendiri (joinedClanId).
  // Gudang klan lain berstatus RAHASIA / PRIVATE dan tidak boleh diakses oleh pihak luar.
  const userOwnClan = allClans.find((c) => c.id === joinedClanId) ?? null;
  const isTargetingOtherClan = Boolean(clan && joinedClanId && clan.id !== joinedClanId);
  const activeClan = userOwnClan;

  // Sinkronisasi data koin dan inventaris secara live dari Supabase saat modal terbuka
  useEffect(() => {
    if (!isOpen || !activeClan?.id) return;
    let isCurrent = true;

    refreshClanCombatData();

    (async () => {
      try {
        const { data, error } = await supabase
          .from('rpg_clans')
          .select('coins')
          .eq('id', activeClan.id)
          .maybeSingle();

        if (isCurrent && !error && data && data.coins !== undefined && data.coins !== null) {
          setLiveCoins(Number(data.coins));
        }
      } catch (err) {
        console.warn('[ClanCombatShopModal] Gagal mengambil saldo live:', err);
      }
    })();

    return () => {
      isCurrent = false;
    };
  }, [isOpen, activeClan?.id, refreshClanCombatData]);

  // ISOLASI KLAN: Inventaris klan KHUSUS untuk klan yang sedang dibuka (tidak tercampur dengan klan lain)
  const clanSpecificInventory = useMemo(
    () => (activeClan ? clanInventory.filter((i) => i.clanId === activeClan.id) : []),
    [clanInventory, activeClan]
  );

  const totalStockCount = useMemo(
    () => clanSpecificInventory.reduce((sum, i) => sum + i.quantity, 0),
    [clanSpecificInventory]
  );

  // ISOLASI KLAN: Riwayat mutasi koin KHUSUS klan ini
  const clanSpecificTransactions = useMemo(
    () => (activeClan ? clanCoinTransactions.filter((tx) => tx.clanId === activeClan.id) : []),
    [clanCoinTransactions, activeClan]
  );

  // ISOLASI KLAN: Riwayat serangan bos kota oleh klan ini
  const clanSpecificBossLogs = useMemo(
    () => (activeClan ? bossBattleLogs.filter((log) => log.attackerClanId === activeClan.id) : []),
    [bossBattleLogs, activeClan]
  );

  if (!isOpen) return null;

  // Pencegahan Privasi: Jika mencoba mengakses gudang klan orang lain, blokir dan tampilkan pesan penolakan
  if (isTargetingOtherClan) {
    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-sm animate-fadeIn">
        <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-[#0E131C] p-6 text-center text-slate-200 shadow-2xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-rose-400">
            <Lock className="h-6 w-6" />
          </div>
          <h3 className="mt-3.5 text-sm font-semibold text-white">
            Akses Gudang Ditolak
          </h3>
          <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
            Gudang senjata, inventaris, dan kas koin bersifat privat. Anda hanya dapat melihat gudang milik klan Anda sendiri.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-5 w-full h-10 rounded-xl border border-white/10 bg-white/[0.06] text-xs font-semibold text-white hover:bg-white/[0.12] active:scale-95 transition-all"
          >
            Tutup
          </button>
        </div>
      </div>
    );
  }

  if (!activeClan) {
    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-sm animate-fadeIn">
        <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-[#0E131C] p-6 text-center text-slate-200 shadow-2xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <h3 className="mt-3.5 text-sm font-semibold text-white">
            Gudang & Toko Senjata Klan
          </h3>
          <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
            Anda belum bergabung dengan klan mana pun. Bergabunglah dengan salah satu klan untuk mengakses kas dan inventaris senjata klan.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-5 w-full h-10 rounded-xl border border-white/10 bg-white/[0.06] text-xs font-semibold text-white hover:bg-white/[0.12] active:scale-95 transition-all"
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
        (m.role === 'Pemimpin Klan' || m.role === 'Ketua' || m.role === 'Founder')
    );

  const clanCoins = liveCoins !== null ? liveCoins : (activeClan.coins ?? 1000);

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
      const res = await buyClanWeapon(weapon.id, qty, activeClan.id);
      if (res.ok) {
        if (res.remainingCoins !== undefined) {
          setLiveCoins(res.remainingCoins);
        }
        setActionMessage({
          text: `Berhasil membeli ${qty}x ${weapon.name}! Senjata telah masuk ke Stok Gudang Klan ${activeClan.name}.`,
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
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-2 sm:p-4 backdrop-blur-sm animate-fadeIn">
      <div className="relative flex h-full max-h-[90vh] sm:max-h-[640px] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0C1017] text-slate-100 shadow-2xl">
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#0E131C] px-3.5 py-3 sm:px-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] border border-white/10 text-slate-300">
              <ShoppingBag className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-semibold text-white tracking-normal truncate">
                Gudang Senjata & Logistik Klan
              </h2>
              <div className="flex items-center gap-1.5 text-[10.5px] sm:text-[11px] text-slate-400 truncate mt-0.5">
                <span className="font-medium text-slate-300">{activeClan.name}</span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">Kota {activeClan.cityName}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-white hover:bg-white/[0.08] active:scale-95 transition-all ml-2"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Compact Dual Status Bar: Kas Klan & Otoritas */}
        <div className="grid grid-cols-2 gap-2 border-b border-white/[0.06] bg-[#0A0E15] p-2.5 sm:p-3">
          {/* Kas Klan */}
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5 flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/10 text-amber-400 border border-amber-400/20">
              <Coins className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] text-slate-400 font-medium truncate">
                Saldo Kas Klan
              </div>
              <div className="font-mono text-xs sm:text-sm font-bold text-white tabular-nums truncate">
                {clanCoins.toLocaleString('id-ID')}{' '}
                <span className="text-[10px] text-amber-400 font-normal">Coin</span>
              </div>
            </div>
          </div>

          {/* Otoritas */}
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5 flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-slate-300 border border-white/10">
              <Shield className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] text-slate-400 font-medium truncate">
                Status Otoritas
              </div>
              <div className="text-xs font-semibold text-slate-200 truncate">
                {isLeader ? (
                  <span className="text-emerald-400">
                    Ketua <span className="text-[10px] text-slate-400 font-normal">(Bisa Beli)</span>
                  </span>
                ) : (
                  <span>
                    Anggota <span className="text-[10px] text-slate-400 font-normal">(Siap Pakai)</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Message Alert */}
        {actionMessage && (
          <div
            className={`mx-3 mt-2.5 flex items-center gap-2 rounded-xl border p-2.5 text-xs animate-fadeIn ${
              actionMessage.isError
                ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
            }`}
          >
            {actionMessage.isError ? (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            )}
            <span className="flex-1 text-xs leading-tight font-medium">
              {actionMessage.text}
            </span>
          </div>
        )}

        {/* Segmented Tab Navigator */}
        <div className="px-3 pt-2.5 pb-2 bg-[#0A0E15] border-b border-white/[0.06]">
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-black/40 border border-white/[0.06] p-1">
            <button
              type="button"
              onClick={() => setActiveTab('shop')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 px-2 text-xs transition-all ${
                activeTab === 'shop'
                  ? 'bg-white/[0.1] text-white font-semibold border border-white/10 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              <ShoppingBag className="h-3.5 w-3.5 shrink-0" />
              <span>Toko Senjata</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('inventory')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 px-2 text-xs transition-all ${
                activeTab === 'inventory'
                  ? 'bg-white/[0.1] text-white font-semibold border border-white/10 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              <Package className="h-3.5 w-3.5 shrink-0" />
              <span>Stok Gudang</span>
              {totalStockCount > 0 && (
                <span className="ml-1 rounded-md bg-white/[0.12] px-1.5 py-0.2 text-[10px] font-mono text-slate-200 font-bold">
                  {totalStockCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 px-2 text-xs transition-all ${
                activeTab === 'history'
                  ? 'bg-white/[0.1] text-white font-semibold border border-white/10 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              <History className="h-3.5 w-3.5 shrink-0" />
              <span>Riwayat</span>
            </button>
          </div>
        </div>

        {/* Scrollable Body Content */}
        <div className="nuenime-scroll flex-1 overflow-y-auto p-3 space-y-2.5">
          {/* TAB 1: TOKO SENJATA GLOBAL */}
          {activeTab === 'shop' && (
            <div className="space-y-2.5">
              {/* Notice Banner */}
              <div className="rounded-2xl border border-sky-500/25 bg-gradient-to-r from-sky-950/30 via-slate-900/40 to-transparent p-2.5 sm:p-3 text-[10.5px] sm:text-[11px] text-sky-200/90 leading-relaxed">
                <div>
                  Senjata dibeli menggunakan <strong>Coin kas klan</strong> oleh Ketua Klan. Seluruh anggota klan dapat menggunakan stok ini saat menyerang <strong>Bos Kota</strong>.
                </div>
              </div>

              {weaponsCatalog.map((weapon) => {
                const style = RARITY_THEMES[weapon.rarity] || RARITY_THEMES.Basic;
                const ownedItem = clanSpecificInventory.find((i) => i.weaponId === weapon.id);
                const currentStock = ownedItem ? ownedItem.quantity : 0;
                const qty = getQty(weapon.id);
                const totalCost = weapon.priceCoin * qty;
                const canAfford = clanCoins >= totalCost;

                return (
                  <div
                    key={weapon.id}
                    className={`rounded-xl border ${style.border} bg-[#101520] p-3 transition-colors`}
                  >
                    {/* Top Row Info Senjata */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${style.iconBg} ${style.iconColor}`}
                        >
                          <Swords className="h-5 w-5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`rounded-md px-1.5 py-0.5 border text-[10px] font-medium uppercase ${style.badge}`}
                            >
                              {weapon.rarity}
                            </span>
                            <span className="font-mono text-[10px] font-semibold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 rounded-md">
                              +{weapon.damage.toLocaleString('id-ID')} DMG
                            </span>
                            {currentStock > 0 && (
                              <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-md">
                                Gudang: {currentStock}x
                              </span>
                            )}
                          </div>

                          <h4 className="text-xs sm:text-sm font-semibold text-white mt-1 truncate">
                            {weapon.name}
                          </h4>
                          <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
                            {weapon.description}
                          </p>
                        </div>
                      </div>

                      {/* Harga Satuan */}
                      <div className="text-right shrink-0">
                        <div className="text-[10px] text-slate-400 font-medium">Harga</div>
                        <div className="font-mono text-xs sm:text-sm font-bold text-amber-300">
                          {weapon.priceCoin.toLocaleString('id-ID')}{' '}
                          <span className="text-[10px] font-normal text-amber-400/80">Coin</span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Row: Stepper & Tombol Beli */}
                    {isLeader ? (
                      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5">
                        <div className="flex items-center gap-1 bg-black/40 border border-white/[0.08] rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() => setQty(weapon.id, Math.max(1, qty - 1))}
                            className="flex h-7 w-7 items-center justify-center rounded text-xs font-bold text-slate-300 hover:bg-white/[0.1] active:scale-95 transition-all"
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-mono text-xs font-bold text-white">
                            {qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => setQty(weapon.id, qty + 1)}
                            className="flex h-7 w-7 items-center justify-center rounded text-xs font-bold text-slate-300 hover:bg-white/[0.1] active:scale-95 transition-all"
                          >
                            +
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleBuy(weapon)}
                          disabled={!canAfford || isSubmitting}
                          className={`flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-all active:scale-95 ${
                            canAfford
                              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-sm'
                              : 'border border-white/[0.06] bg-white/[0.03] text-slate-500 cursor-not-allowed'
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
                      <div className="mt-2 flex items-center justify-between border-t border-white/[0.06] pt-2 text-[10.5px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Shield className="h-3 w-3 text-slate-400" />
                          Hanya Ketua Klan yang dapat membeli senjata.
                        </span>
                        <span className="text-slate-300 font-mono">Tersedia {currentStock}x di Gudang</span>
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
                <span className="font-medium text-slate-200">Daftar Senjata Siap Tempur:</span>
                <span className="font-mono text-slate-400 font-medium text-[11px]">
                  Total {totalStockCount} unit di gudang
                </span>
              </div>

              {clanSpecificInventory.length === 0 || clanSpecificInventory.every((i) => i.quantity === 0) ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-400 mb-2.5">
                    <Package className="h-5 w-5" />
                  </div>
                  <div className="text-xs sm:text-sm font-semibold text-slate-200">
                    Gudang Klan Masih Kosong
                  </div>
                  <p className="mt-1 text-xs text-slate-400 max-w-xs leading-relaxed">
                    Ketua Klan dapat membeli senjata di tab Toko Senjata menggunakan Coin klan.
                  </p>
                  {isLeader && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('shop')}
                      className="mt-3.5 h-8 rounded-lg border border-white/10 bg-white/[0.08] px-3.5 text-xs font-semibold text-white hover:bg-white/[0.14] active:scale-95 transition-all"
                    >
                      Buka Toko Senjata
                    </button>
                  )}
                </div>
              ) : (
                clanSpecificInventory
                  .filter((i) => i.quantity > 0)
                  .map((item) => {
                    const catalogItem =
                      weaponsCatalog.find((w) => w.id === item.weaponId) ?? item.weapon;
                    const style =
                      RARITY_THEMES[catalogItem?.rarity || 'Basic'] || RARITY_THEMES.Basic;

                    return (
                      <div
                        key={item.weaponId}
                        className={`flex items-center justify-between gap-3 rounded-xl border ${style.border} bg-[#101520] p-3`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${style.iconBg} ${style.iconColor}`}
                          >
                            <Swords className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`rounded px-1.5 py-0.5 border text-[9px] font-medium uppercase ${style.badge}`}
                              >
                                {catalogItem?.rarity || 'Senjata'}
                              </span>
                              <span className="font-mono text-[10px] font-semibold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 rounded">
                                +{catalogItem?.damage.toLocaleString('id-ID')} DMG
                              </span>
                            </div>
                            <h4 className="truncate text-xs sm:text-sm font-semibold text-white mt-0.5">
                              {catalogItem?.name || item.weaponId}
                            </h4>
                            <p className="text-[10.5px] text-slate-400 mt-0.5 truncate flex items-center gap-1">
                              <Zap className="h-3 w-3 text-slate-400" />
                              Sekali pakai saat menyerang Bos Kota Musuh
                            </p>
                          </div>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-right shrink-0">
                          <div className="text-[9.5px] text-slate-400 font-medium">
                            Tersedia
                          </div>
                          <div className="font-mono text-xs sm:text-sm font-bold text-white">
                            {item.quantity} unit
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
                <div className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                  <Coins className="h-3.5 w-3.5 text-slate-400" />
                  <span>Mutasi Kas Koin Klan</span>
                </div>
                {clanSpecificTransactions.length === 0 ? (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center text-xs text-slate-400">
                    Belum ada riwayat transaksi Koin untuk klan ini.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {clanSpecificTransactions.slice(0, 10).map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-[#101520] p-2.5 text-xs gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-slate-200 truncate">
                            {tx.description || tx.transactionType}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                            {tx.actorName || 'Ketua Klan'} · {new Date(tx.createdAt).toLocaleDateString('id-ID')}
                          </div>
                        </div>
                        <div
                          className={`font-mono text-xs font-semibold tabular-nums shrink-0 ${
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
                <div className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                  <Swords className="h-3.5 w-3.5 text-slate-400" />
                  <span>Riwayat Serangan Bos Kota</span>
                </div>
                {clanSpecificBossLogs.length === 0 ? (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center text-xs text-slate-400">
                    Belum ada riwayat serangan ke bos kota oleh klan ini.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {clanSpecificBossLogs.slice(0, 10).map((log) => (
                      <div
                        key={log.id}
                        className="rounded-xl border border-white/[0.05] bg-[#101520] p-2.5 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-slate-200 truncate">
                            Target: Kota {log.targetCityId.toUpperCase()}
                          </span>
                          <span className="font-mono font-semibold text-rose-400 tabular-nums shrink-0">
                            -{log.totalDamage.toLocaleString('id-ID')} DMG
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center justify-between gap-2">
                          <span className="truncate">
                            Penyerang: {log.attackerName} ({log.attackerClanName})
                          </span>
                          <span className="shrink-0">
                            {log.weaponName ? `Senjata: ${log.weaponName}` : 'Serangan Dasar'}
                          </span>
                        </div>
                        {log.bossDefeated && (
                          <div className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 text-[10.5px] font-medium text-emerald-300 text-center">
                            <Trophy className="h-3 w-3 text-amber-400 shrink-0" />
                            <span>Bos Ditaklukkan! Hadiah +{log.rewardCoins} Coin & +{log.rewardExp} EXP</span>
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
        <div className="border-t border-white/[0.08] bg-[#0E131C] px-3.5 py-2.5 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2 truncate">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
            <span className="truncate text-[11px]">Sistem Senjata Sekali Pakai & Koin Klan</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-lg border border-white/10 bg-white/[0.06] px-3.5 font-medium text-slate-200 hover:text-white hover:bg-white/[0.12] active:scale-95 transition-all text-xs shrink-0"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

