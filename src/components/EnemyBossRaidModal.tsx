import React, { useState } from 'react';
import {
  X,
  Swords,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Package,
  Flame,
  ChevronDown,
  Trophy,
} from 'lucide-react';
import { CityBossRecord, WorldCity } from '../types/nuenime';
import { useNuenimeRpg } from '../context/NuenimeRpgContext';
import { computeBaseAttackDamage } from '../config/nuenimeSystemConfig';
import { CityBossIllustration } from './icons/CityBossIllustrations';

interface EnemyBossRaidModalProps {
  boss?: CityBossRecord | null;
  targetCity?: WorldCity | null;
  bossId?: string | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenShop?: () => void;
}

const TIER_BADGES: Record<string, { label: string; badge: string; color: string }> = {
  Normal: { label: 'Normal', badge: 'bg-slate-800 text-slate-300 border-slate-700', color: '#94A3B8' },
  Elite: { label: 'Elite', badge: 'bg-blue-950 text-blue-300 border-blue-500/50', color: '#38BDF8' },
  Epic: { label: 'Epic', badge: 'bg-purple-950 text-purple-300 border-purple-500/50', color: '#A855F7' },
  Legendary: { label: 'Legendary', badge: 'bg-amber-950 text-amber-300 border-amber-500/50', color: '#F59E0B' },
  Mythic: { label: 'Mythic', badge: 'bg-rose-950 text-rose-300 border-rose-500/50', color: '#F43F5E' },
};

export const EnemyBossRaidModal: React.FC<EnemyBossRaidModalProps> = ({
  boss,
  targetCity,
  bossId,
  isOpen,
  onClose,
  onOpenShop,
}) => {
  const {
    activeAccount,
    cities,
    allClans,
    joinedClanId,
    weaponsCatalog,
    clanInventory,
    attackEnemyBoss,
  } = useNuenimeRpg();

  const [selectedWeaponId, setSelectedWeaponId] = useState<string>('');
  const [isAttacking, setIsAttacking] = useState<boolean>(false);
  const [battleResult, setBattleResult] = useState<{
    ok: boolean;
    message: string;
    totalDamage?: number;
    bossDefeated?: boolean;
    bossHpAfter?: number;
    rewardCoins?: number;
  } | null>(null);

  if (!isOpen) return null;

  // Resolusi boss dan targetCity jika dipanggil hanya dengan bossId
  const effectiveBoss =
    boss ??
    (bossId
      ? cities.map((c) => c.boss).find((b) => b?.id === bossId || b?.cityId === bossId) ?? null
      : null);

  const effectiveCity =
    targetCity ??
    (effectiveBoss ? cities.find((c) => c.id === effectiveBoss.cityId) ?? null : null);

  if (!effectiveBoss || !effectiveCity) return null;

  const userClan = allClans.find((c) => c.id === joinedClanId);
  const userOriginCity = userClan ? cities.find((c) => c.id === userClan.cityId) : undefined;

  // Validasi Hak Akses: Hanya Ketua Klan
  const isLeader = userClan
    ? userClan.leaderId === activeAccount.id ||
      userClan.members.some(
        (m) =>
          m.userId === activeAccount.id &&
          (m.role === 'Pemimpin Klan' || m.role === 'Ketua')
      )
    : false;

  // Validasi Kota Musuh: Kota klan != kota bos
  const isEnemyCity = userClan ? userClan.cityId !== effectiveCity.id : false;

  // Base Damage dihitung dari Level Kota Asal Penyerang
  const originCityLevel = userOriginCity?.level ?? 1;
  const baseDamage = computeBaseAttackDamage(originCityLevel);

  // Weapon Damage
  const selectedWeapon = weaponsCatalog.find((w) => w.id === selectedWeaponId);
  const weaponDamage = selectedWeapon?.damage ?? 0;
  const totalPredictedDamage = baseDamage + weaponDamage;

  // Senjata yang dimiliki di inventory klan (quantity > 0)
  const availableWeapons = clanInventory.filter((i) => i.quantity > 0);

  const tierInfo = TIER_BADGES[effectiveBoss.tier] || TIER_BADGES.Normal;

  const handleExecuteAttack = async () => {
    try {
      setIsAttacking(true);
      setBattleResult(null);
      const res = await attackEnemyBoss(effectiveBoss.id, selectedWeaponId || undefined);
      setBattleResult(res);
      if (res.ok && selectedWeaponId) {
        setSelectedWeaponId('');
      }
    } catch (err: any) {
      setBattleResult({ ok: false, message: err?.message || 'Serangan gagal' });
    } finally {
      setIsAttacking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/85 p-2.5 sm:p-4 backdrop-blur-md">
      <div className="flex h-full max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-rose-500/40 bg-[#0B0E14] text-slate-100 shadow-2xl shadow-rose-950/40">
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-950/95 px-3.5 py-3 sm:px-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rose-500/40 bg-rose-950/60 text-rose-300 shadow-sm">
              <Swords className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display truncate text-[13px] sm:text-sm font-bold text-white tracking-tight">
                Operasi Serangan Bos Kota
              </h2>
              <p className="truncate text-[10.5px] text-rose-300 font-medium">
                Target: <span className="font-semibold text-white">{effectiveBoss.name}</span> · Kota {effectiveCity.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal operasi serangan"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/90 text-slate-400 hover:border-slate-700 hover:text-white active:scale-95 transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="nuenime-scroll flex-1 overflow-y-auto p-3 sm:p-3.5 space-y-3">
          {/* Card Target Bos */}
          <div className="rounded-2xl border border-rose-500/35 bg-gradient-to-b from-slate-900/80 to-slate-950/90 p-3 sm:p-3.5 space-y-2.5">
            <div className="flex items-start gap-3">
              <div
                className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-2xl border-2 bg-slate-950 p-1 shadow-sm"
                style={{ borderColor: effectiveBoss.accentColor }}
              >
                <CityBossIllustration cityId={effectiveCity.id} size={48} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`rounded border px-1.5 py-0.2 font-mono text-[9px] font-bold uppercase ${tierInfo.badge}`}>
                    {tierInfo.label}
                  </span>
                  <span className="rounded border border-slate-700 bg-slate-800/80 px-1.5 py-0.2 font-mono text-[9px] text-slate-300">
                    Lv.{effectiveBoss.level}
                  </span>
                  <span className="text-[10px] text-amber-300/90 font-medium">
                    {effectiveBoss.element}
                  </span>
                </div>
                <h3 className="font-display text-sm sm:text-base font-bold text-white mt-1 truncate">
                  {effectiveBoss.name}
                </h3>
                <p className="text-[10.5px] text-slate-300 truncate">
                  {effectiveBoss.title}
                </p>
              </div>
            </div>

            {/* HP Bar Bos */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-rose-300">
                  HP Bos ({effectiveBoss.status === 'ACTIVE' ? 'Aktif' : effectiveBoss.status === 'ENRANGED' ? 'Mengamuk' : 'Kalah'})
                </span>
                <span className="font-mono font-bold text-white tabular-nums">
                  {effectiveBoss.currentHp.toLocaleString('id-ID')} / {effectiveBoss.maxHp.toLocaleString('id-ID')} HP
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800 shadow-inner">
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${Math.round((effectiveBoss.currentHp / effectiveBoss.maxHp) * 100)}%`,
                    backgroundColor: effectiveBoss.accentColor || '#F43F5E',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Validasi Rules Box */}
          {!userClan ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-950/30 p-3 text-xs text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <strong>Belum Bergabung Klan:</strong> Anda harus mendirikan atau bergabung dengan klan untuk menyerang bos kota musuh.
              </div>
            </div>
          ) : !isEnemyCity ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-sky-500/40 bg-sky-950/30 p-3 text-xs text-sky-200">
              <Shield className="h-4 w-4 shrink-0 text-sky-400 mt-0.5" />
              <div>
                <strong>Bos Kota Domisili:</strong> {effectiveBoss.name} adalah penjaga kota tempat klan Anda bermarkas. Anda hanya diizinkan menyerang Bos di <strong>Kota Musuh</strong>.
              </div>
            </div>
          ) : !isLeader ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-200">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <div>
                <strong>Akses Terbatas:</strong> Sesuai aturan game, hanya <strong>Ketua Klan</strong> yang memiliki izin melancarkan serangan terhadap Bos Kota Musuh.
              </div>
            </div>
          ) : effectiveBoss.currentHp <= 0 ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-xs text-slate-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
              <div>
                <strong>Bos Telah Kalah:</strong> Bos kota ini sedang dalam masa pemulihan (respawn).
              </div>
            </div>
          ) : (
            <>
              {/* Form & Perhitungan Damage */}
              <div className="rounded-2xl border border-slate-800/90 bg-gradient-to-b from-slate-900/70 to-slate-950/90 p-3 sm:p-3.5 space-y-3">
                <h4 className="font-display text-xs font-bold text-white flex items-center gap-1.5">
                  <Flame className="h-4 w-4 text-amber-400" />
                  <span>Kalkulasi Serangan & Persenjataan</span>
                </h4>

                {/* Base Damage Stat */}
                <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/80 p-2.5 text-xs">
                  <div>
                    <div className="text-[10px] text-slate-400">Damage Dasar (Level Kota {userOriginCity?.name || 'Asal'}: Lv.{originCityLevel})</div>
                    <div className="font-semibold text-white mt-0.5">Serangan Pasukan Dasar</div>
                  </div>
                  <div className="font-mono text-sm font-bold text-emerald-400 tabular-nums">
                    +{baseDamage.toLocaleString('id-ID')} HP
                  </div>
                </div>

                {/* Pemilihan Senjata Sekali Pakai */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="text-[11px] font-semibold text-slate-300">
                      Gunakan Senjata Sekali Pakai:
                    </label>
                    {onOpenShop && (
                      <button
                        type="button"
                        onClick={onOpenShop}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 hover:text-amber-200 transition-colors"
                      >
                        <Package className="h-3 w-3" />
                        <span>+ Toko Senjata</span>
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <select
                      value={selectedWeaponId}
                      onChange={(e) => setSelectedWeaponId(e.target.value)}
                      className="w-full appearance-none rounded-xl border border-slate-700/80 bg-slate-950/95 py-2.5 pl-3 pr-9 text-xs font-medium text-white shadow-inner transition-colors focus:border-rose-400 focus:outline-none"
                    >
                      <option value="">Tanpa Senjata Tambahan (Hanya Serangan Dasar)</option>
                      {availableWeapons.map((inv) => {
                        const item = weaponsCatalog.find((w) => w.id === inv.weaponId);
                        if (!item) return null;
                        return (
                          <option key={inv.weaponId} value={inv.weaponId}>
                            {item.name} (+{item.damage.toLocaleString('id-ID')} DMG) — Sisa: {inv.quantity}x
                          </option>
                        );
                      })}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  </div>

                  {availableWeapons.length === 0 && (
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Inventory klan belum memiliki senjata sekali pakai. Kunjungi Toko Senjata Klan untuk menambah daya serang.
                    </p>
                  )}
                </div>

                {/* Total Damage Output */}
                <div className="flex items-center justify-between rounded-xl border border-rose-500/50 bg-gradient-to-r from-rose-950/50 via-rose-950/20 to-slate-950/90 p-3 text-xs shadow-sm">
                  <div>
                    <div className="text-[11px] font-bold text-rose-200">Total Estimasi Damage:</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {baseDamage} (Dasar) {weaponDamage > 0 ? `+ ${weaponDamage} (${selectedWeapon?.name})` : ''}
                    </div>
                  </div>
                  <div className="font-mono text-lg font-black text-rose-300 tabular-nums">
                    -{totalPredictedDamage.toLocaleString('id-ID')} HP
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Result Alert */}
          {battleResult && (
            <div
              className={`rounded-xl border p-3 text-xs space-y-1.5 ${
                battleResult.ok
                  ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-200'
                  : 'border-rose-500/40 bg-rose-950/40 text-rose-200'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs">
                {battleResult.ok ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                )}
                <span>{battleResult.message}</span>
              </div>
              {battleResult.bossDefeated && (
                <div className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-900/60 p-2 text-center text-[11px] font-bold text-amber-300">
                  <Trophy className="h-4 w-4 text-amber-300 shrink-0" />
                  <span>PENAKLUKAN BERHASIL! Klan Anda memperoleh +{battleResult.rewardCoins} Coin klan!</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Button Footer (Mobile Ergonomic) */}
        <div className="border-t border-slate-800/80 bg-slate-950/95 px-3.5 py-3 sm:px-4 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-24 shrink-0 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900/90 text-xs font-semibold text-slate-300 hover:border-slate-500 hover:text-white active:scale-95 transition-all"
          >
            Tutup
          </button>

          {isLeader && isEnemyCity && effectiveBoss.currentHp > 0 && (
            <button
              type="button"
              disabled={isAttacking}
              onClick={handleExecuteAttack}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-rose-500/70 bg-gradient-to-r from-rose-600 via-rose-600 to-rose-700 text-xs font-bold text-white shadow-lg shadow-rose-950/50 hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all"
            >
              <Swords className="h-4 w-4 shrink-0" />
              <span>
                {isAttacking ? 'Menyerang...' : `Serang Bos (${totalPredictedDamage.toLocaleString('id-ID')} HP)`}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
