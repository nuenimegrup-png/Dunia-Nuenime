import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Clock,
  Crown,
  Coins,
  BarChart3,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { CityBossRecord, WorldCity, BossRoundHistory } from '../types/nuenime';
import { useNuenimeRpg } from '../context/NuenimeRpgContext';
import { computeBaseAttackDamage } from '../config/nuenimeSystemConfig';
import { CityBossIllustration } from './icons/CityBossIllustrations';
import { supabase } from '../lib/supabase';

interface EnemyBossRaidModalProps {
  boss?: CityBossRecord | null;
  targetCity?: WorldCity | null;
  bossId?: string | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenShop?: () => void;
}

const TIER_BADGES: Record<string, { label: string; badge: string; color: string }> = {
  Normal: { label: 'Normal', badge: 'bg-white/[0.06] text-slate-300 border-white/10', color: '#94A3B8' },
  Elite: { label: 'Elite', badge: 'bg-sky-500/10 text-sky-300 border-sky-500/20', color: '#38BDF8' },
  Epic: { label: 'Epic', badge: 'bg-purple-500/10 text-purple-300 border-purple-500/20', color: '#A855F7' },
  Legendary: { label: 'Legendary', badge: 'bg-amber-500/10 text-amber-300 border-amber-500/20', color: '#F59E0B' },
  Mythic: { label: 'Mythic', badge: 'bg-rose-500/10 text-rose-300 border-rose-500/20', color: '#F43F5E' },
};

function formatCooldown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  return `${String(hours).padStart(2, '0')} : ${String(minutes).padStart(2, '0')} : ${String(seconds).padStart(2, '0')}`;
}

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
    refreshClanCombatData,
  } = useNuenimeRpg();

  const [selectedWeaponId, setSelectedWeaponId] = useState<string>('');
  const [isAttacking, setIsAttacking] = useState<boolean>(false);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  const [recentWinners, setRecentWinners] = useState<BossRoundHistory[]>([]);
  const [activeTab, setActiveTab] = useState<'raid' | 'leaderboard' | 'history'>('raid');
  const [isLoadingRaidData, setIsLoadingRaidData] = useState<boolean>(false);

  // Data resmi dari backend via RPC rpc_get_boss_raid_leaderboard
  const [serverRoundData, setServerRoundData] = useState<{
    currentRound: number;
    currentHp: number;
    maxHp: number;
    status: string;
    bossLevel: number;
    clanTotalDamage: number;
  } | null>(null);

  const [serverLeaderboard, setServerLeaderboard] = useState<
    Array<{
      clanId: string;
      clanName: string;
      totalDamage: number;
      totalAttacks: number;
      firstStrikeAt?: string;
    }>
  >([]);

  const [battleResult, setBattleResult] = useState<{
    ok: boolean;
    message: string;
    totalDamage?: number;
    bossDefeated?: boolean;
    bossHpAfter?: number;
    winnerClanId?: string;
    winnerClanName?: string;
    winnerDamage?: number;
    rewardCoins?: number;
  } | null>(null);

  const userClan = allClans.find((c) => c.id === joinedClanId);
  const userOriginCity = userClan ? cities.find((c) => c.id === userClan.cityId) : undefined;

  // Resolusi boss dan targetCity jika dipanggil hanya dengan bossId
  const effectiveBoss =
    boss ??
    (bossId
      ? cities.map((c) => c.boss).find((b) => b?.id === bossId || b?.cityId === bossId) ?? null
      : null);

  const effectiveCity =
    targetCity ??
    (effectiveBoss ? cities.find((c) => c.id === effectiveBoss.cityId) ?? null : null);

  // Validasi Hak Akses: HANYA Pemimpin Klan yang berhak memulai serangan Boss
  const isLeader = Boolean(
    userClan &&
      (userClan.leaderId === activeAccount.id ||
        userClan.members.some(
          (m) =>
            (m.userId === activeAccount.id || m.id === activeAccount.id) &&
            (m.role === 'Pemimpin Klan' || m.role === 'Ketua' || m.role === 'Founder')
        ))
  );

  // Sinkronisasi data resmi dari Supabase via RPC rpc_get_boss_raid_leaderboard
  const fetchClanCooldownAndHistory = useCallback(async () => {
    if (!effectiveBoss) return;
    setIsLoadingRaidData(true);

    try {
      const { data: raidData, error: raidErr } = await supabase.rpc('rpc_get_boss_raid_leaderboard', {
        p_boss_id: effectiveBoss.id,
        p_clan_id: userClan?.id ?? null,
      });

      if (!raidErr && raidData && raidData.ok) {
        setServerRoundData({
          currentRound: Number(raidData.current_round) || 1,
          currentHp: Number(raidData.current_hp),
          maxHp: Number(raidData.max_hp),
          status: raidData.status || 'ACTIVE',
          bossLevel: Math.max(1, Number(raidData.boss_level) || 1),
          clanTotalDamage: Number(raidData.clan_total_damage) || 0,
        });

        if (Array.isArray(raidData.leaderboard)) {
          setServerLeaderboard(
            raidData.leaderboard.map((item: any) => ({
              clanId: item.clan_id,
              clanName: item.clan_name,
              totalDamage: Number(item.total_damage) || 0,
              totalAttacks: Number(item.total_attacks) || 0,
              firstStrikeAt: item.first_strike_at,
            }))
          );
        }

        if (Array.isArray(raidData.round_history)) {
          setRecentWinners(
            raidData.round_history.map((h: any) => ({
              id: h.id,
              bossId: h.boss_id,
              cityId: h.city_id,
              roundNumber: Number(h.round_number),
              bossName: h.boss_name,
              bossLevel: Math.max(1, Number(h.boss_level) || 1),
              winnerClanId: h.winner_clan_id,
              winnerClanName: h.winner_clan_name,
              winnerDamage: Number(h.winner_damage),
              totalRaidDamage: Number(h.total_raid_damage),
              rewardCoins: Number(h.reward_coins),
              lastStrikerClanId: h.last_striker_clan_id,
              lastStrikerClanName: h.last_striker_clan_name,
              completedAt: h.completed_at,
            }))
          );
        }

        if (raidData.cooldown?.is_on_cooldown) {
          setCooldownSeconds(Number(raidData.cooldown.cooldown_seconds) || 0);
        } else {
          setCooldownSeconds(0);
        }
      } else {
        // Fallback langsung ke tabel cooldown klan jika RPC error
        if (userClan) {
          const { data: cdData } = await supabase
            .from('rpg_clan_boss_cooldowns')
            .select('*')
            .eq('clan_id', userClan.id)
            .order('next_attack_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (cdData && cdData.next_attack_at) {
            const nextTime = new Date(cdData.next_attack_at).getTime();
            const diffSeconds = Math.max(0, Math.floor((nextTime - Date.now()) / 1000));
            setCooldownSeconds(diffSeconds);
          } else {
            setCooldownSeconds(0);
          }
        }
      }
    } catch (err) {
      console.warn('[EnemyBossRaidModal] Gagal fetch cooldown/history:', err);
    } finally {
      setIsLoadingRaidData(false);
    }
  }, [effectiveBoss, userClan]);

  // Sinkronisasi data saat modal dibuka atau saat ganti tab
  useEffect(() => {
    if (isOpen) {
      refreshClanCombatData();
      fetchClanCooldownAndHistory();
    }
  }, [isOpen, refreshClanCombatData, fetchClanCooldownAndHistory]);

  // Countdown timer cooldown setiap detik
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  // ISOLASI KLAN: Senjata yang dapat digunakan HANYA berasal dari inventaris klan penyerang sendiri
  const availableWeapons = useMemo(
    () => (userClan ? clanInventory.filter((i) => i.clanId === userClan.id && i.quantity > 0) : []),
    [clanInventory, userClan]
  );

  // Jika senjata yang dipilih stoknya habis, reset pilihan senjata
  useEffect(() => {
    if (selectedWeaponId && !availableWeapons.some((w) => w.weaponId === selectedWeaponId)) {
      setSelectedWeaponId('');
    }
  }, [availableWeapons, selectedWeaponId]);

  if (!isOpen) return null;
  if (!effectiveBoss || !effectiveCity) return null;

  // Nilai status live resmi dari database
  const currentRound = serverRoundData?.currentRound ?? effectiveBoss.currentRound ?? 1;
  const currentHp = serverRoundData?.currentHp ?? effectiveBoss.currentHp;
  const maxHp = serverRoundData?.maxHp ?? effectiveBoss.maxHp ?? 10000;
  const bossLevel = serverRoundData?.bossLevel ?? Math.max(1, effectiveBoss.level || 1);
  const clanRoundDamage = serverRoundData?.clanTotalDamage ?? 0;

  // Base Damage dihitung dari Level Kota Asal Penyerang
  const originCityLevel = userOriginCity?.level ?? 1;
  const baseDamage = computeBaseAttackDamage(originCityLevel);

  // Weapon Damage
  const selectedWeapon = weaponsCatalog.find((w) => w.id === selectedWeaponId);
  const weaponDamage = selectedWeapon?.damage ?? 0;
  const totalPredictedDamage = baseDamage + weaponDamage;

  const tierInfo = TIER_BADGES[effectiveBoss.tier] || TIER_BADGES.Normal;

  // Formula Hadiah Koin Berdasarkan Level Boss: 10.000 x Level Boss
  const coinRewardFormula = bossLevel * 10000;

  const handleExecuteAttack = async () => {
    if (!isLeader) {
      setBattleResult({
        ok: false,
        message: 'Aksi ditolak: Hanya Pemimpin Klan yang berhak memulai serangan ke Bos Kota.',
      });
      return;
    }

    if (cooldownSeconds > 0) {
      setBattleResult({
        ok: false,
        message: `Klan Anda masih dalam masa cooldown serangan (${formatCooldown(cooldownSeconds)}).`,
      });
      return;
    }

    try {
      setIsAttacking(true);
      setBattleResult(null);

      const res = await attackEnemyBoss(effectiveBoss.id, selectedWeaponId || undefined);
      setBattleResult(res);

      if (res.ok) {
        if (selectedWeaponId) {
          setSelectedWeaponId('');
        }
        // Pasang cooldown 60 menit langsung di client
        setCooldownSeconds(res.cooldownSeconds || 3600);
        await fetchClanCooldownAndHistory();
        await refreshClanCombatData();
      } else if (res.cooldownSeconds && res.cooldownSeconds > 0) {
        setCooldownSeconds(res.cooldownSeconds);
      }
    } catch (err: any) {
      setBattleResult({ ok: false, message: err?.message || 'Serangan gagal diproses.' });
    } finally {
      setIsAttacking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 p-2 sm:p-4 backdrop-blur-sm animate-fadeIn">
      <div className="relative flex h-full max-h-[92vh] sm:max-h-[680px] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0C1017] text-slate-100 shadow-2xl">
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#0E131C] px-3.5 py-3 sm:px-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] border border-white/10 text-slate-300">
              <Swords className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xs sm:text-sm font-semibold text-white tracking-normal truncate">
                  Pertarungan Bos Kota
                </h2>
                <span className="rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-0.2 font-mono text-[9px] font-medium text-slate-300">
                  Ronde #{currentRound}
                </span>
                <span className="rounded-md border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.2 font-mono text-[9px] font-semibold text-amber-300">
                  Lv.{bossLevel}
                </span>
              </div>
              <p className="truncate text-[10.5px] text-slate-400 font-medium mt-0.5">
                Target: <span className="font-medium text-slate-200">{effectiveBoss.name}</span> · Wilayah {effectiveCity.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={fetchClanCooldownAndHistory}
              title="Perbarui Data Leaderboard & Status Bos"
              disabled={isLoadingRaidData}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-white hover:bg-white/[0.08] active:scale-95 transition-all"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoadingRaidData ? 'animate-spin text-sky-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup modal operasi serangan"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-white hover:bg-white/[0.08] active:scale-95 transition-all"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 3-Tab Segmented Navigator */}
        <div className="px-3 pt-2.5 pb-2 bg-[#0A0E15] border-b border-white/[0.06]">
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-black/40 border border-white/[0.06] p-1">
            <button
              type="button"
              onClick={() => setActiveTab('raid')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                activeTab === 'raid'
                  ? 'bg-rose-600/90 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }`}
            >
              <Swords className="h-3.5 w-3.5 shrink-0" />
              <span>Operasi</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('leaderboard');
                fetchClanCooldownAndHistory();
              }}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                activeTab === 'leaderboard'
                  ? 'bg-white/[0.12] text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }`}
            >
              <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              <span>Ronde #{currentRound}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('history');
                fetchClanCooldownAndHistory();
              }}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                activeTab === 'history'
                  ? 'bg-white/[0.12] text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }`}
            >
              <Crown className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              <span>Juara ({recentWinners.length})</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3.5">
          {/* TAB 1: OPERASI SERANGAN & STATS BOS */}
          {activeTab === 'raid' && (
            <div className="space-y-3">
              {/* Header Card Status Bos */}
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0F141F] p-3.5 shadow-lg">
                <div className="flex items-center gap-3">
                  <div
                    className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 bg-slate-950 shadow-inner"
                    style={{ borderColor: effectiveBoss.accentColor }}
                  >
                    <CityBossIllustration cityId={effectiveCity.id} size={46} />
                    <span
                      className={`absolute -top-1 -right-1 flex h-3 w-3 rounded-full border-2 border-[#0F141F] ${
                        currentHp > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                      }`}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`rounded-md border px-1.5 py-0.2 font-mono text-[9px] font-medium ${tierInfo.badge}`}>
                        {effectiveBoss.tier}
                      </span>
                      <span className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.2 font-mono text-[9px] text-slate-300">
                        Ronde #{currentRound}
                      </span>
                      <span className="rounded-md border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.2 font-mono text-[9px] font-semibold text-amber-300">
                        Level {bossLevel}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-white mt-1 truncate">
                      {effectiveBoss.name}
                    </h3>
                    <p className="text-[11px] text-slate-400 truncate">
                      {effectiveBoss.title} · Penjaga Kota {effectiveCity.name}
                    </p>
                  </div>
                </div>

                {/* HP Progress Bar */}
                <div className="mt-3 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-slate-400">Status Ketahanan HP:</span>
                    <span className="font-mono font-bold text-rose-300 tabular-nums">
                      {currentHp.toLocaleString('id-ID')} / {maxHp.toLocaleString('id-ID')} HP
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-black/40 border border-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-rose-500 transition-all duration-300 shadow-[0_0_8px_rgba(244,63,94,0.6)]"
                      style={{
                        width: `${Math.max(0, Math.min(100, (currentHp / (maxHp || 1)) * 100))}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Ringkasan Hadiah & Damage Klan Sendiri */}
                <div className="mt-3 grid grid-cols-2 gap-2 pt-2.5 border-t border-white/[0.06]">
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-2 text-center">
                    <div className="text-[9.5px] font-semibold text-amber-300/90 uppercase tracking-wider flex items-center justify-center gap-1">
                      <Coins className="h-3 w-3" />
                      <span>Hadiah Pemenang</span>
                    </div>
                    <div className="font-mono text-xs font-bold text-amber-300 mt-0.5">
                      +{coinRewardFormula.toLocaleString('id-ID')} Coin
                    </div>
                    <div className="text-[9px] text-amber-200/70">10.000 × Lv.{bossLevel} Bos</div>
                  </div>

                  <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-2 text-center">
                    <div className="text-[9.5px] font-semibold text-sky-300/90 uppercase tracking-wider flex items-center justify-center gap-1">
                      <BarChart3 className="h-3 w-3" />
                      <span>Damage Klan Anda</span>
                    </div>
                    <div className="font-mono text-xs font-bold text-sky-300 mt-0.5">
                      {clanRoundDamage.toLocaleString('id-ID')} DMG
                    </div>
                    <div className="text-[9px] text-sky-200/70">Akumulasi Ronde Ini</div>
                  </div>
                </div>
              </div>

              {/* Status Validasi Serangan */}
              {!userClan ? (
                <div className="flex items-start gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-xs text-slate-300">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                  <div>
                    <strong className="text-white">Belum Bergabung Klan:</strong> Anda harus mendirikan atau bergabung dengan klan untuk menyerang bos kota.
                  </div>
                </div>
              ) : !isLeader ? (
                <div className="flex items-start gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-xs text-slate-300">
                  <Shield className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
                  <div>
                    <strong className="text-white">Khusus Pemimpin Klan:</strong> Hanya Pemimpin/Ketua Klan yang berhak memulai serangan ke Bos Kota dan mengerahkan senjata gudang klan.
                  </div>
                </div>
              ) : currentHp <= 0 ? (
                <div className="flex items-start gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-xs text-slate-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                  <div>
                    <strong className="text-white">Bos Sedang Reset Ronde:</strong> Bos telah dikalahkan dan ronde baru sedang disiapkan otomatis oleh server.
                  </div>
                </div>
              ) : (
                <>
                  {/* Form & Perhitungan Damage */}
                  <div className="rounded-xl border border-white/[0.07] bg-[#101520] p-3 space-y-2.5">
                    <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <Flame className="h-3.5 w-3.5 text-amber-400" />
                      <span>Kalkulasi Serangan & Persenjataan Klan</span>
                    </div>

                    {/* Base Damage Stat */}
                    <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] p-2 text-xs">
                      <div>
                        <div className="text-[10px] text-slate-400">
                          Damage Dasar (Kota Domisili {userOriginCity?.name || 'Asal'}: Lv.{originCityLevel})
                        </div>
                        <div className="font-medium text-slate-200 mt-0.5">Serangan Pasukan Dasar</div>
                      </div>
                      <div className="font-mono text-xs font-semibold text-emerald-400 tabular-nums">
                        +{baseDamage.toLocaleString('id-ID')} HP
                      </div>
                    </div>

                    {/* Pemilihan Senjata Sekali Pakai Milik Klan */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <label className="text-[11px] font-medium text-slate-300">
                          Gunakan Senjata Gudang Klan:
                        </label>
                        {onOpenShop && isLeader && (
                          <button
                            type="button"
                            onClick={onOpenShop}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 hover:text-amber-300 transition-colors"
                          >
                            <Package className="h-3 w-3" />
                            <span>+ Buka Gudang Klan</span>
                          </button>
                        )}
                      </div>

                      <div className="relative">
                        <select
                          value={selectedWeaponId}
                          onChange={(e) => setSelectedWeaponId(e.target.value)}
                          className="w-full appearance-none rounded-lg border border-white/10 bg-[#0A0E15] py-2 pl-3 pr-8 text-xs font-medium text-white transition-colors focus:border-rose-400 focus:outline-none"
                        >
                          <option value="">Tanpa Senjata Tambahan (Hanya Serangan Dasar)</option>
                          {availableWeapons.map((inv) => {
                            const item = weaponsCatalog.find((w) => w.id === inv.weaponId);
                            if (!item) return null;
                            return (
                              <option key={inv.weaponId} value={inv.weaponId}>
                                {item.name} (+{item.damage.toLocaleString('id-ID')} DMG) — Stok: {inv.quantity} unit
                              </option>
                            );
                          })}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400">
                          <ChevronDown className="h-4 w-4" />
                        </div>
                      </div>

                      {availableWeapons.length === 0 && (
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                          Gudang klan Anda belum memiliki senjata tambahan. Pemimpin klan dapat membeli senjata di Gudang Senjata Klan menggunakan kas koin klan.
                        </p>
                      )}
                    </div>

                    {/* Total Damage Output */}
                    <div className="flex items-center justify-between rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs">
                      <div>
                        <div className="text-[11px] font-semibold text-rose-200">Total Estimasi Serangan:</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {baseDamage} (Dasar) {weaponDamage > 0 ? `+ ${weaponDamage} (${selectedWeapon?.name})` : ''}
                        </div>
                      </div>
                      <div className="font-mono text-base font-bold text-rose-300 tabular-nums">
                        -{totalPredictedDamage.toLocaleString('id-ID')} HP
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Hasil Serangan Alert */}
              {battleResult && (
                <div
                  className={`rounded-xl border p-3 text-xs space-y-1.5 ${
                    battleResult.ok
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                      : 'border-rose-500/30 bg-rose-500/10 text-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-2 font-medium text-xs">
                    {battleResult.ok ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                    )}
                    <span>{battleResult.message}</span>
                  </div>
                  {battleResult.bossDefeated && (
                    <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-center space-y-1 text-white shadow-sm mt-2">
                      <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-amber-300">
                        <Crown className="h-4 w-4 text-amber-300" />
                        <span>BOS TELAH DIKALAHKAN!</span>
                      </div>
                      <p className="text-xs text-slate-200 font-medium">
                        Klan <strong>{battleResult.winnerClanName || userClan?.name}</strong> memenangkan pertarungan dengan total damage tertinggi {battleResult.winnerDamage?.toLocaleString('id-ID')} DMG!
                      </p>
                      <p className="text-[11px] text-amber-300 font-mono font-semibold">
                        Hadiah Kemenangan: +{battleResult.rewardCoins?.toLocaleString('id-ID')} Koin masuk otomatis ke Kas Klan Pemenang!
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LEADERBOARD RONDE INI */}
          {activeTab === 'leaderboard' && (
            <div className="space-y-2.5">
              <div className="rounded-xl border border-white/[0.07] bg-[#101520] p-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-white">
                    <Trophy className="h-3.5 w-3.5 text-amber-400" />
                    <span>Peringkat Damage Ronde #{currentRound}</span>
                  </div>
                  <span className="font-mono text-[10px] text-amber-300 font-medium">
                    Total Damage Tertinggi Menang
                  </span>
                </div>
                <p className="text-[10.5px] text-slate-400 mt-1 leading-relaxed">
                  Pemenang ronde ditentukan dari total akumulasi damage terbesar saat Bos kalah (bukan serangan terakhir). Hadiah {coinRewardFormula.toLocaleString('id-ID')} Koin langsung masuk ke saldo kas klan pemenang.
                </p>
              </div>

              {serverLeaderboard.length === 0 ? (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center text-xs text-slate-400">
                  Belum ada klan yang melancarkan serangan pada ronde #{currentRound} ini. Jadilah yang pertama!
                </div>
              ) : (
                <div className="space-y-1.5">
                  {serverLeaderboard.map((item, index) => {
                    const isUserClan = userClan?.id === item.clanId;
                    const maxDmg = serverLeaderboard[0]?.totalDamage || 1;
                    const percent = Math.min(100, Math.round((item.totalDamage / maxDmg) * 100));

                    return (
                      <div
                        key={item.clanId}
                        className={`rounded-xl border p-2.5 text-xs space-y-1.5 transition-all ${
                          isUserClan
                            ? 'border-rose-500/40 bg-rose-500/[0.06]'
                            : 'border-white/[0.05] bg-[#101520]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded font-mono text-[10px] font-bold ${
                                index === 0
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                                  : index === 1
                                  ? 'bg-slate-500/20 text-slate-300 border border-slate-400/30'
                                  : index === 2
                                  ? 'bg-orange-500/20 text-orange-300 border border-orange-400/30'
                                  : 'bg-white/[0.05] text-slate-400'
                              }`}
                            >
                              #{index + 1}
                            </span>
                            <span className="font-semibold text-white truncate text-xs">
                              {item.clanName}
                            </span>
                            {isUserClan && (
                              <span className="rounded bg-rose-500/10 border border-rose-400/20 px-1.5 py-0.2 text-[9px] font-semibold text-rose-300 shrink-0">
                                Klan Anda
                              </span>
                            )}
                          </div>

                          <div className="text-right shrink-0">
                            <div className="font-mono font-semibold text-rose-300 text-xs">
                              {item.totalDamage.toLocaleString('id-ID')} DMG
                            </div>
                            <div className="text-[9.5px] text-slate-400">
                              {item.totalAttacks}x Serangan
                            </div>
                          </div>
                        </div>

                        {/* Bar Proporsi Damage */}
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              index === 0 ? 'bg-amber-400' : 'bg-rose-500'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: RIWAYAT JUARA RONDE SEBELUMNYA */}
          {activeTab === 'history' && (
            <div className="space-y-2.5">
              <div className="text-xs font-semibold text-slate-300 px-0.5">
                Daftar Juara Ronde Bos {effectiveBoss.name}:
              </div>

              {recentWinners.length === 0 ? (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center text-xs text-slate-400">
                  Belum ada ronde yang diselesaikan. Pertarungan ronde pertama masih berlangsung!
                </div>
              ) : (
                <div className="space-y-1.5">
                  {recentWinners.map((winner) => (
                    <div
                      key={winner.id}
                      className="rounded-xl border border-white/[0.06] bg-[#101520] p-2.5 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.2 font-mono text-[9.5px] font-medium text-slate-300">
                          Ronde #{winner.roundNumber} (Lv.{winner.bossLevel})
                        </span>
                        <span className="font-mono font-semibold text-amber-300 text-xs flex items-center gap-1">
                          <Coins className="h-3 w-3 text-amber-400" />
                          +{winner.rewardCoins.toLocaleString('id-ID')} Koin
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-semibold text-white truncate text-xs">
                          <Crown className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                          <span className="truncate">Juara: {winner.winnerClanName}</span>
                        </div>
                        <span className="font-mono text-[10.5px] text-rose-300 font-semibold shrink-0">
                          {winner.winnerDamage.toLocaleString('id-ID')} DMG
                        </span>
                      </div>

                      {winner.lastStrikerClanName && (
                        <div className="text-[10px] text-slate-400">
                          Penyerang Terakhir: {winner.lastStrikerClanName} · {new Date(winner.completedAt).toLocaleDateString('id-ID')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Button Footer */}
        <div className="border-t border-white/[0.08] bg-[#0E131C] px-3.5 py-2.5 sm:px-4 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-20 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-xs font-medium text-slate-200 hover:text-white hover:bg-white/[0.12] active:scale-95 transition-all"
          >
            Tutup
          </button>

          {userClan && currentHp > 0 && (
            !isLeader ? (
              <button
                type="button"
                disabled={true}
                className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] text-xs font-medium text-slate-500 cursor-not-allowed"
              >
                <Shield className="h-3.5 w-3.5 text-slate-500" />
                <span>Hanya Pemimpin Klan yang Dapat Menyerang</span>
              </button>
            ) : cooldownSeconds > 0 ? (
              <button
                type="button"
                disabled={true}
                className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] text-xs font-medium text-amber-400/80 cursor-not-allowed"
              >
                <Clock className="h-3.5 w-3.5 text-amber-400 animate-spin" />
                <span>Cooldown: {formatCooldown(cooldownSeconds)}</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isAttacking}
                onClick={handleExecuteAttack}
                className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white shadow-sm active:scale-95 disabled:opacity-50 transition-all"
              >
                <Swords className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {isAttacking ? 'Menyerang...' : `Serang Bos (${totalPredictedDamage.toLocaleString('id-ID')} HP)`}
                </span>
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
};
