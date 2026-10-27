import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Shield,
  Users,
  MapPin,
  Award,
  Calendar,
  Compass,
  CheckCircle2,
  Check,
  Swords,
  ArrowUpCircle,
  Camera,
  X,
  ShoppingBag,
  Coins,
  Sparkles,
  Zap,
  LogOut,
  Clock,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { Clan, WorldCity } from '../types/nuenime';
import { ClanEmblemIcon, CityEmblemBadge } from './icons/NuenimeAssets';
import { useNuenimeRpg, CLAN_MISSIONS } from '../context/NuenimeRpgContext';
import { getClanRelicInfo } from '../data/nuenimeRpgFeaturesData';
import { ClanMenuLoadingScreen } from './ClanMenuLoadingScreen';
import { fantasySoundEngine } from '../utils/soundEngine';
import { ClanCombatShopModal } from './ClanCombatShopModal';
import { supabase } from '../lib/supabase';

function resolveBorderAssetUrl(border: string | null | undefined): string | null {
  if (!border) return null;
  const trimmed = border.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/') || trimmed.startsWith('data:')) {
    return trimmed;
  }
  const lower = trimmed.toLowerCase();
  if (lower.includes('white_mage') || lower.includes('white-mage')) {
    return '/assets/borders/border-white-mage.png';
  }
  if (lower.includes('magic_book') || lower.includes('magic-book')) {
    return '/assets/borders/border-magic-book.png';
  }
  return null;
}

interface BorderMeta {
  assetUrl: string;
  innerRatio?: number;
}

interface ClanDetailScreenProps {
  clan: Clan;
  city?: WorldCity;
  onBack: () => void;
  onNavigateToCity: (cityId: Clan['cityId']) => void;
}

/**
 * ClanDetailScreen menampilkan profil lengkap klan, kapasitas anggota (X/100),
 * Artefak Pusaka & Buff Elemen, Misi Komunitas Real-time, serta daftar anggota beserta kontribusi EXP.
 */
export const ClanDetailScreen: React.FC<ClanDetailScreenProps> = ({
  clan,
  city,
  onBack,
  onNavigateToCity,
}) => {
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(true);
  const [isShopOpen, setIsShopOpen] = useState<boolean>(false);

  useEffect(() => {
    setIsLoadingDetail(true);
    fantasySoundEngine.playMarkerSelect();
    const timer = window.setTimeout(() => {
      setIsLoadingDetail(false);
    }, 580);
    return () => window.clearTimeout(timer);
  }, [clan.id]);

  const {
    activeAccount,
    joinedClanId,
    allClans,
    requestJoinClan,
    cancelJoinRequest,
    leaveClan,
    getUserJoinRequest,
    relicShards,
    relicLevels,
    upgradeClanRelic,
    claimDailyRelics,
    isDailyRelicClaimed,
    districtInfluence,
    reinforceClanDistrict,
    getClanTotalScore,
    updateClanLogo,
  } = useNuenimeRpg();

  const [isEditLogoModalOpen, setIsEditLogoModalOpen] = useState(false);
  const [editLogoUrl, setEditLogoUrl] = useState(clan.logoUrl ?? '');
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [isMissionsOpen, setIsMissionsOpen] = useState(false);
  const [isDailyClaimed, setIsDailyClaimed] = useState(isDailyRelicClaimed());

  const liveClan = allClans.find((c) => c.id === clan.id) ?? clan;
  const isJoined = joinedClanId === clan.id;
  const currentJoinedClan = joinedClanId ? allClans.find((c) => c.id === joinedClanId) : undefined;
  const pendingRequest = getUserJoinRequest(clan.id);
  const relicInfo = getClanRelicInfo(clan.id, clan.cityName, clan.specialization);
  const currentRelicLevel = relicLevels[clan.id] ?? 1;
  const currentBuffBonus =
    relicInfo.baseBonusPercent + (currentRelicLevel - 1) * relicInfo.bonusPerLevel;
  const upgradeShardCost = currentRelicLevel * 2;
  const totalClanExp = getClanTotalScore(clan.id);
  const influence = districtInfluence[clan.id]?.influencePercent ?? 68;
  const clanMissions = CLAN_MISSIONS;

  // Resolusi Avatar & Border Khusus Pembuat / Pemimpin Klan
  const isCurrentUserLeader =
    clan.leaderId === activeAccount.id ||
    clan.founderId === activeAccount.id;

  const leaderMember =
    clan.members.find(
      (m) =>
        m.userId === clan.leaderId ||
        m.id === clan.leaderId ||
        m.role === 'Pemimpin Klan' ||
        m.role === 'Ketua'
    ) ?? clan.members[0];

  const leaderAvatar = isCurrentUserLeader
    ? (activeAccount.avatarUrl || leaderMember?.avatarUrl || null)
    : (leaderMember?.avatarUrl || null);

  const rawLeaderBorder = isCurrentUserLeader
    ? (activeAccount.borderUrl || leaderMember?.borderUrl || null)
    : (leaderMember?.borderUrl || null);

  const [leaderBorderMeta, setLeaderBorderMeta] = useState<BorderMeta | null>(() => {
    const local = resolveBorderAssetUrl(rawLeaderBorder);
    return local ? { assetUrl: local, innerRatio: 0.74 } : null;
  });

  useEffect(() => {
    let isMounted = true;
    const local = resolveBorderAssetUrl(rawLeaderBorder);
    if (local) {
      setLeaderBorderMeta({ assetUrl: local, innerRatio: 0.74 });
      return;
    }

    if (rawLeaderBorder) {
      void (async () => {
        try {
          const { data } = await supabase
            .from('avatar_borders_config')
            .select('asset_url, inner_ratio')
            .eq('id', rawLeaderBorder.trim())
            .maybeSingle();
          if (isMounted && data?.asset_url) {
            setLeaderBorderMeta({
              assetUrl: data.asset_url,
              innerRatio: typeof data.inner_ratio === 'number' ? data.inner_ratio : 0.74,
            });
          }
        } catch {
          // ignore
        }
      })();
    }

    const leaderUserId = isCurrentUserLeader
      ? activeAccount.id
      : (leaderMember?.userId || clan.leaderId);

    if (leaderUserId && leaderUserId !== 'guest' && !rawLeaderBorder) {
      void (async () => {
        try {
          const { data: prof } = await supabase
            .from('profiles')
            .select('equipped_border, avatar_url')
            .eq('id', leaderUserId)
            .maybeSingle();
          if (!isMounted || !prof?.equipped_border) return;

          const localFromDb = resolveBorderAssetUrl(prof.equipped_border);
          if (localFromDb) {
            setLeaderBorderMeta({ assetUrl: localFromDb, innerRatio: 0.74 });
            return;
          }
          const { data: bData } = await supabase
            .from('avatar_borders_config')
            .select('asset_url, inner_ratio')
            .eq('id', prof.equipped_border)
            .maybeSingle();
          if (isMounted && bData?.asset_url) {
            setLeaderBorderMeta({
              assetUrl: bData.asset_url,
              innerRatio: typeof bData.inner_ratio === 'number' ? bData.inner_ratio : 0.74,
            });
          }
        } catch {
          // ignore
        }
      })();
    }

    return () => {
      isMounted = false;
    };
  }, [clan.leaderId, rawLeaderBorder, isCurrentUserLeader, activeAccount.id, leaderMember?.userId]);

  const sortedMembers = [...clan.members].sort(
    (a, b) => b.contributionScore - a.contributionScore
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#07090E] text-slate-100">
      {/* Sticky Header */}
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] bg-[#0A0D14]/90 px-3.5 py-2.5 backdrop-blur-xl shrink-0 shadow-sm z-20">
        <button
          type="button"
          onClick={onBack}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 text-xs font-medium text-slate-300 transition-all hover:bg-white/[0.08] hover:text-white active:scale-95 whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Kembali</span>
        </button>

        <div className="min-w-0 text-right">
          <div className="truncate text-xs font-bold text-white tracking-wide font-sans">{liveClan.name}</div>
          <div className="mt-0.5 font-mono text-[10px] text-slate-400 tabular-nums">
            EXP: <span className="font-semibold text-slate-200">{totalClanExp.toLocaleString('id-ID')}</span>
            {isJoined && (
              <>
                <span className="mx-1.5 text-white/20">|</span>
                Relik: <span className="font-semibold text-amber-300/90">{relicShards}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {isLoadingDetail ? (
        <ClanMenuLoadingScreen
          title={`Memasuki Markas ${clan.name} [${clan.tag}]`}
          subtitle={`Distrik ${clan.strongholdDistrict} · Kota ${clan.cityName}`}
          accentColor={clan.accentColor}
        />
      ) : (
      /* Scrollable Clan Profile Content */
      <div className="nuenime-scroll flex-1 space-y-3.5 overflow-y-auto pb-6">
        {/* Hero Crest Pedestal Showcase */}
        <div className="relative flex flex-col items-center justify-end overflow-hidden border-b border-white/[0.06] px-4 pt-5 pb-5 text-center bg-[#090C13]">
          <img
            src="/assets/nuenime/clan_emblem_pedestal.webp"
            alt=""
            referrerPolicy="no-referrer"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25 mix-blend-luminosity"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#090C13] via-[#090C13]/70 to-transparent" />

          <div className="relative z-10 flex flex-col items-center w-full max-w-sm">
            <div className="relative">
              <div className="rounded-2xl p-1.5 bg-black/40 border border-white/[0.08] shadow-lg backdrop-blur-sm">
                <ClanEmblemIcon
                  variant={clan.emblemVariant}
                  accentColor={clan.accentColor}
                  logoUrl={clan.logoUrl}
                  size={72}
                />
              </div>

              {/* Tombol atur/ubah logo foto untuk anggota/pemimpin klan */}
              {isJoined && (
                <button
                  type="button"
                  onClick={() => {
                    setEditLogoUrl(clan.logoUrl ?? '');
                    setIsEditLogoModalOpen(true);
                  }}
                  className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-slate-900 text-slate-300 hover:text-white hover:border-white/40 active:scale-95 transition-all shadow-md"
                  title="Atur / Ubah Logo Foto Klan"
                >
                  <Camera className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Pill Tag & Info */}
            <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[10.5px] font-medium text-slate-300 backdrop-blur-sm">
              <span className="text-slate-400">{clan.reputationRank}</span>
              <span className="text-white/20">·</span>
              <span className="font-mono text-slate-200">[{clan.tag}]</span>
              <span className="text-white/20">·</span>
              <span className="text-amber-400 font-semibold">Lv. {clan.level}</span>
            </div>

            <h1 className="mt-1 text-lg font-bold tracking-tight text-white sm:text-xl">
              {clan.name}
            </h1>
            <p className="mt-0.5 max-w-xs text-[11px] italic text-slate-400 leading-snug">
              &ldquo;{clan.motto}&rdquo;
            </p>

            {/* Clean & Cohesive Actions Bar */}
            <div className="mt-3.5 w-full space-y-2">
              {isJoined ? (
                <div className="grid grid-cols-2 gap-2 w-full">
                  <div className="flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 text-xs font-medium text-emerald-300">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="truncate">Klan Aktif Anda</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsLeaveModalOpen(true)}
                    className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs font-medium text-slate-300 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300 active:scale-95 transition-all"
                  >
                    <LogOut className="h-3.5 w-3.5 opacity-70" />
                    <span className="truncate">Keluar Klan</span>
                  </button>
                </div>
              ) : pendingRequest ? (
                <div className="grid grid-cols-2 gap-2 w-full">
                  <div className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-2.5 text-[11px] font-medium text-amber-300">
                    <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0 animate-pulse" />
                    <span className="truncate">Menunggu Konfirmasi</span>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      setIsSubmittingAction(true);
                      await cancelJoinRequest(clan.id);
                      setIsSubmittingAction(false);
                    }}
                    disabled={isSubmittingAction}
                    className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs font-medium text-slate-300 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300 active:scale-95 transition-all"
                  >
                    <X className="h-3.5 w-3.5 opacity-70" />
                    <span className="truncate">Batalkan</span>
                  </button>
                </div>
              ) : joinedClanId && joinedClanId !== clan.id ? (
                /* Pengguna sudah punya klan lain -> Tombol Gabung Klan di-hide */
                <div className="w-full">
                  <button
                    type="button"
                    onClick={() => onNavigateToCity(clan.cityId)}
                    className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs font-medium text-slate-300 hover:bg-white/[0.07] hover:text-white active:scale-95 transition-all"
                  >
                    <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">Kota {clan.cityName}</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 w-full">
                  <button
                    type="button"
                    onClick={async () => {
                      setIsSubmittingAction(true);
                      await requestJoinClan(clan.id);
                      setIsSubmittingAction(false);
                    }}
                    disabled={isSubmittingAction}
                    className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-sky-400/30 bg-sky-600/90 px-3 text-xs font-semibold text-white shadow-sm hover:bg-sky-500 active:scale-95 transition-all"
                  >
                    <Shield className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Gabung Klan</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onNavigateToCity(clan.cityId)}
                    className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs font-medium text-slate-300 hover:bg-white/[0.07] hover:text-white active:scale-95 transition-all"
                  >
                    <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">Kota {clan.cityName}</span>
                  </button>
                </div>
              )}

              {/* Baris Kedua: Tombol Gudang Senjata & Logistik - HANYA UNTUK KLAN SENDIRI */}
              {isJoined && (
                <button
                  type="button"
                  onClick={() => setIsShopOpen(true)}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-gradient-to-r from-white/[0.05] via-white/[0.08] to-white/[0.05] px-4 text-xs font-semibold text-slate-200 hover:border-amber-400/40 hover:text-amber-200 hover:bg-white/[0.1] active:scale-[0.98] transition-all shadow-sm"
                >
                  <ShoppingBag className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span>Gudang Senjata & Toko Logistik</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3 px-3.5">
          {/* Quick Stats Grid: 4 Kartu Seragam & Elegan */}
          <div className="grid grid-cols-2 gap-2">
            {/* Kotak 1: Kapasitas Anggota */}
            <div className="rounded-xl border border-white/[0.06] bg-[#0E131E]/90 p-3 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-[10.5px] font-medium text-slate-400">
                <Users className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span>Kapasitas Anggota</span>
              </div>
              <div className="mt-1.5 font-mono text-sm font-bold text-white tabular-nums">
                {clan.memberCount} <span className="text-[11px] font-normal text-slate-500">/ {clan.maxMembers}</span>
              </div>
            </div>

            {/* Kotak 2: Kas Koin Klan */}
            <div className="rounded-xl border border-white/[0.06] bg-[#0E131E]/90 p-3 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-[10.5px] font-medium text-slate-400">
                <Coins className="h-3.5 w-3.5 text-amber-400/80 shrink-0" />
                <span>Kas Koin Klan</span>
              </div>
              <div className="mt-1.5 font-mono text-sm font-bold text-white tabular-nums">
                {(liveClan.coins ?? 1000).toLocaleString('id-ID')} <span className="text-[11px] font-normal text-amber-400/80">Coin</span>
              </div>
            </div>

            {/* Kotak 3: Kendali Distrik */}
            <div className="rounded-xl border border-white/[0.06] bg-[#0E131E]/90 p-3 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-[10.5px] font-medium text-slate-400">
                <Compass className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span>Kendali Distrik</span>
              </div>
              <div className="mt-1.5 font-mono text-sm font-bold text-white tabular-nums">
                {influence}%
              </div>
            </div>

            {/* Kotak 4: Total EXP Klan */}
            <div className="rounded-xl border border-white/[0.06] bg-[#0E131E]/90 p-3 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-[10.5px] font-medium text-slate-400">
                <Shield className="h-3.5 w-3.5 text-sky-400/80 shrink-0" />
                <span>Total EXP Klan</span>
              </div>
              <div className="mt-1.5 font-mono text-sm font-bold text-white tabular-nums">
                {totalClanExp.toLocaleString('id-ID')} <span className="text-[11px] font-normal text-sky-400/80">EXP</span>
              </div>
            </div>
          </div>

          {/* Artefak Pusaka: Level Progression & Buff */}
          <div className="rounded-2xl border border-white/[0.07] bg-[#0E131E]/95 p-3.5 space-y-3">
            {/* Header: Title & Level Badge */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-400">
                  <Award className="h-3.5 w-3.5" />
                </div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Level Artefak & Buff
                </h2>
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-amber-300">
                <span>Level {currentRelicLevel}</span>
                <span className="text-[10px] text-amber-400/50">/ 10</span>
              </div>
            </div>

            {/* Level Stepper & Visual Progress Bar */}
            <div className="rounded-xl border border-white/[0.05] bg-black/30 p-3 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-medium text-slate-300">
                  <Zap className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span>Buff Aktif:</span>
                  <span className="font-bold text-emerald-300 font-mono">
                    +{currentBuffBonus}% {relicInfo.elementBuffName}
                  </span>
                </div>
                {currentRelicLevel < 10 && (
                  <span className="font-mono text-[11px] text-slate-400">
                    Lv.+1: <strong className="text-emerald-400/80 font-normal">+{currentBuffBonus + relicInfo.bonusPerLevel}%</strong>
                  </span>
                )}
              </div>

              {/* 10-Segment Level Progression Track */}
              <div className="grid grid-cols-10 gap-1 pt-0.5">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((step) => {
                  const isAchieved = step <= currentRelicLevel;
                  const isCurrent = step === currentRelicLevel;
                  return (
                    <div
                      key={step}
                      className={`h-2 rounded-full transition-all ${
                        isCurrent
                          ? 'bg-amber-400 ring-2 ring-amber-400/30 shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                          : isAchieved
                          ? 'bg-amber-500/70'
                          : 'bg-white/[0.08]'
                      }`}
                      title={`Level ${step}`}
                    />
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span>Lv. 1 ({relicInfo.baseBonusPercent}%)</span>
                <span>Lv. 5</span>
                <span>Lv. 10 ({relicInfo.baseBonusPercent + 9 * relicInfo.bonusPerLevel}%)</span>
              </div>
            </div>

            {/* Relic Count & Action Buttons (Khusus Pemimpin Klan Pemilik) */}
            {isJoined && isCurrentUserLeader ? (
              <div className="flex flex-col gap-2 pt-0.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Pecahan Relik Tersedia:</span>
                  <span className="font-mono text-xs font-bold text-slate-200">
                    {relicShards} <span className="text-[10px] text-slate-400 font-normal">Relik</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Tombol Klaim 5 Relik Harian */}
                  <button
                    type="button"
                    onClick={() => {
                      const res = claimDailyRelics();
                      if (res.ok) {
                        setIsDailyClaimed(true);
                      }
                    }}
                    disabled={isDailyClaimed}
                    className={`flex h-9 items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold transition-all active:scale-95 ${
                      isDailyClaimed
                        ? 'border-white/5 bg-white/[0.02] text-slate-500 cursor-not-allowed'
                        : 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                    }`}
                    title={isDailyClaimed ? 'Sudah diklaim hari ini. Kembali besok!' : 'Klaim jatah 5 relik harian klan'}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span className="truncate">{isDailyClaimed ? 'Sudah Diklaim' : 'Klaim (+5 Relik)'}</span>
                  </button>

                  {/* Tombol Tingkatkan Level Artefak */}
                  <button
                    type="button"
                    onClick={() => upgradeClanRelic(liveClan.id)}
                    disabled={relicShards < upgradeShardCost || currentRelicLevel >= 10}
                    className={`flex h-9 items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold transition-all active:scale-95 ${
                      currentRelicLevel >= 10
                        ? 'border-white/5 bg-white/[0.02] text-slate-500 cursor-not-allowed'
                        : relicShards >= upgradeShardCost
                        ? 'border-amber-400/40 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 shadow-sm'
                        : 'border-white/10 bg-white/[0.03] text-slate-400'
                    }`}
                  >
                    <ArrowUpCircle className="h-3.5 w-3.5 text-amber-400" />
                    <span className="truncate">{currentRelicLevel >= 10 ? 'Level Maks' : `Tingkatkan (${upgradeShardCost})`}</span>
                  </button>
                </div>

                {/* Keterangan Bonus Koin Real per Level-Up */}
                <div className="flex items-center justify-between pt-0.5 px-0.5 text-[10.5px] text-amber-300/85">
                  <span>Bonus Tiap Level:</span>
                  <span className="font-semibold text-amber-300">+1.000 Kas Koin Klan</span>
                </div>
              </div>
            ) : isJoined && !isCurrentUserLeader ? (
              <div className="rounded-xl border border-white/[0.06] bg-black/25 p-2.5 text-center text-xs text-slate-400">
                Hanya <span className="font-semibold text-slate-200">Pemimpin Klan</span> yang berhak mengklaim relik dan menempa Artefak Pusaka.
              </div>
            ) : (
              <div className="rounded-xl border border-white/[0.06] bg-black/25 p-2.5 text-center text-xs text-slate-400">
                Artefak Pusaka ini dikelola khusus oleh Pemimpin klan <span className="font-semibold text-slate-200">{liveClan.name}</span>.
              </div>
            )}
          </div>

          {/* Penguasaan Distrik Markas & Misi Klan */}
          <div className="rounded-2xl border border-white/[0.07] bg-[#0E131E]/95 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400">Distrik Markas Kota {clan.cityName}</div>
                <h2 className="text-xs font-bold text-white mt-0.5">
                  {clan.strongholdDistrict} · Kendali {influence}%
                </h2>
              </div>
              <div className="flex items-center rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 font-mono text-[10px] text-slate-300 shrink-0">
                <span>Realtime</span>
              </div>
            </div>

            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full transition-all duration-300 rounded-full bg-sky-400"
                style={{ width: `${influence}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>
                Kontribusi Distrik: <span className="font-mono text-slate-200 font-semibold">{clan.totalExp.toLocaleString('id-ID')}</span> / {Math.max(1000, (clan.level || 1) * 1000).toLocaleString('id-ID')} EXP
              </span>
            </div>

            {/* Misi Aktivitas Real-Time Komunitas Klan (Collapsible Buka/Tutup) */}
            <div className="pt-1.5 border-t border-white/[0.05]">
              <button
                type="button"
                onClick={() => setIsMissionsOpen((prev) => !prev)}
                className="flex w-full items-center justify-between gap-2 py-1 text-left group transition-all"
              >
                <div className="flex items-center gap-1.5">
                  <ChevronRight
                    className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${
                      isMissionsOpen ? 'rotate-90 text-slate-200' : 'group-hover:text-slate-300'
                    }`}
                  />
                  <span className="text-[11px] font-semibold text-slate-300 group-hover:text-white transition-colors">
                    Misi & Aktivitas Komunitas ({clanMissions.length})
                  </span>
                </div>
                <span className="font-mono text-[10px] text-slate-400">
                  {isMissionsOpen ? 'Tutup' : 'Lihat Misi'}
                </span>
              </button>

              {isMissionsOpen && (
                <div className="space-y-1.5 mt-2 transition-all">
                  {clanMissions.map((msn) => (
                    <div
                      key={msn.id}
                      className="flex items-center justify-between gap-2.5 rounded-xl border border-white/[0.05] bg-black/20 p-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-slate-200 truncate">
                          {msn.title}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          +{msn.rewardExp} EXP klan & distrik
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono text-[11px] font-semibold text-sky-400/90">
                          +{msn.rewardExp} EXP
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Leader Highlight Card */}
          <div className="rounded-2xl border border-white/[0.07] bg-[#0E131E]/95 p-3.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pemimpin Klan</div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* Avatar & Border Pembuat / Pemimpin Klan */}
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center">
                  <div
                    className={`relative h-10 w-10 overflow-hidden rounded-full bg-slate-800 flex items-center justify-center ${
                      leaderBorderMeta?.assetUrl
                        ? ''
                        : 'ring-1 ring-white/20'
                    }`}
                  >
                    {leaderAvatar ? (
                      <img
                        src={leaderAvatar}
                        alt={clan.leaderName}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <span className="text-xs font-bold text-white uppercase">
                        {clan.leaderName.charAt(0) || 'P'}
                      </span>
                    )}
                  </div>

                  {/* Border Avatar Overlay */}
                  {leaderBorderMeta?.assetUrl && (
                    <img
                      src={leaderBorderMeta.assetUrl}
                      alt=""
                      style={{
                        width: `${Math.round(40 / (leaderBorderMeta.innerRatio || 0.74))}px`,
                        height: `${Math.round(40 / (leaderBorderMeta.innerRatio || 0.74))}px`,
                      }}
                      className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-none object-contain z-10 select-none"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-white">
                    {clan.leaderName}
                  </div>
                  <div className="text-[11px] text-slate-400">{clan.leaderTitle}</div>
                </div>
              </div>

              {city && (
                <button
                  type="button"
                  onClick={() => onNavigateToCity(city.id)}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] font-medium text-slate-300 hover:bg-white/[0.07] hover:text-white transition-colors"
                >
                  <CityEmblemBadge cityId={city.id} material={city.material} size={18} />
                  <span>
                    {city.name}
                  </span>
                </button>
              )}
            </div>
          </div>


          {/* Daftar Anggota & Kontribusi EXP */}
          <div className="rounded-2xl border border-white/[0.07] bg-[#0E131E]/95 p-3.5">
            <div className="mb-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-slate-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Daftar Anggota ({clan.memberCount})
                </h2>
              </div>
              <span className="font-mono text-[10.5px] text-slate-400 tabular-nums">
                Kapasitas {clan.maxMembers}
              </span>
            </div>

            <div className="space-y-1.5 mt-2">
              {sortedMembers.map((member, index) => {
                const isCurrentUser = member.userId === activeAccount.id;
                const avatar = isCurrentUser
                  ? (activeAccount.avatarUrl || member.avatarUrl)
                  : member.avatarUrl;
                const rawBorder = isCurrentUser
                  ? (activeAccount.borderUrl || member.borderUrl)
                  : member.borderUrl;
                const resolvedBorder = resolveBorderAssetUrl(rawBorder);
                const userLevel = isCurrentUser
                  ? (activeAccount.level || member.level || 1)
                  : (member.level || 1);

                const isLeader =
                  member.role === 'Pemimpin Klan' ||
                  member.role === 'Ketua' ||
                  member.role === 'Founder';

                const isCoLeader =
                  member.role === 'Wakil Pemimpin' ||
                  member.role === 'Wakil';

                const formattedLevel =
                  userLevel >= 1000000
                    ? `${(userLevel / 1000000).toFixed(1)}M`
                    : userLevel >= 1000
                    ? `${(userLevel / 1000).toFixed(1)}k`
                    : userLevel.toString();

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.05] bg-black/20 p-2.5 transition-colors hover:border-white/10"
                  >
                    {/* Sisi Kiri: Ranking, Avatar + Border, Nama & Badges */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {/* Ranking Number */}
                      <span
                        className={`font-mono text-[11px] font-bold shrink-0 w-4 text-center ${
                          index === 0
                            ? 'text-amber-400'
                            : index === 1
                            ? 'text-slate-300'
                            : index === 2
                            ? 'text-amber-600'
                            : 'text-slate-500'
                        }`}
                      >
                        #{index + 1}
                      </span>

                      {/* Avatar Bulat */}
                      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
                        <div
                          className={`relative h-9 w-9 overflow-hidden rounded-full bg-slate-800 flex items-center justify-center ${
                            resolvedBorder
                              ? ''
                              : isLeader
                              ? 'ring-1 ring-amber-400/60'
                              : 'ring-1 ring-white/10'
                          }`}
                        >
                          {avatar ? (
                            <img
                              src={avatar}
                              alt={member.name}
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <span className="text-xs font-bold text-white uppercase">
                              {member.name.charAt(0) || 'A'}
                            </span>
                          )}
                        </div>

                        {/* Border Avatar */}
                        {resolvedBorder && (
                          <img
                            src={resolvedBorder}
                            alt=""
                            style={{
                              width: `${Math.round(36 / 0.74)}px`,
                              height: `${Math.round(36 / 0.74)}px`,
                            }}
                            className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-none object-contain z-10 select-none"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                          />
                        )}
                      </div>

                      {/* Info Nama, Verifikasi & Badge Role */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="truncate text-xs font-semibold text-white">
                            {member.name}
                          </span>
                          {isLeader && (
                            <span
                              title="Pemimpin Klan"
                              className="inline-flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-amber-500 text-slate-950 font-bold"
                            >
                              <Check className="h-2 w-2 stroke-[3]" />
                            </span>
                          )}
                        </div>

                        {/* Baris Badge: Level + Role */}
                        <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/[0.03] px-1 py-0.2 font-mono text-[9px] font-medium text-slate-300 shrink-0">
                            Lv. {formattedLevel}
                          </span>

                          {isLeader ? (
                            <span className="inline-flex items-center rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.2 font-mono text-[8.5px] font-semibold text-amber-300 uppercase tracking-wider shrink-0">
                              Pemimpin
                            </span>
                          ) : isCoLeader ? (
                            <span className="inline-flex items-center rounded border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.2 font-mono text-[8.5px] font-semibold text-sky-300 uppercase tracking-wider shrink-0">
                              Wakil
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded border border-white/10 bg-white/[0.02] px-1.5 py-0.2 font-mono text-[8.5px] font-medium text-slate-400 uppercase tracking-wider shrink-0">
                              Anggota
                            </span>
                          )}

                          {member.elementAffinity && (
                            <span className="text-[9px] text-slate-400 font-mono shrink-0 hidden xs:inline">
                              · {member.elementAffinity}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Sisi Kanan: Kontribusi EXP */}
                    <div className="shrink-0 text-right pl-1.5 flex flex-col items-end justify-center">
                      <div className="inline-flex items-center gap-1 font-mono text-xs font-bold text-slate-200 tabular-nums">
                        <span>{member.contributionScore.toLocaleString('id-ID')}</span>
                        <span className="text-[10px] text-slate-400 font-normal">EXP</span>
                      </div>
                      <div className="text-[9px] text-slate-400 font-normal whitespace-nowrap">
                        Kontribusi
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Modal Ubah / Atur Logo Foto Klan (Bulat) */}
      {isEditLogoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700/90 bg-[#0B0E14] p-4 text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h3 className="font-display text-sm font-bold text-white">
                Atur Logo Foto Klan {clan.name}
              </h3>
              <button
                type="button"
                onClick={() => setIsEditLogoModalOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-4 flex flex-col items-center text-center">
              {/* Preview Bulat */}
              <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-amber-400/80 bg-slate-900">
                {editLogoUrl.trim() ? (
                  <img
                    src={editLogoUrl.trim()}
                    alt="Preview"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                    className="h-full w-full object-cover rounded-full"
                  />
                ) : (
                  <ClanEmblemIcon
                    variant={clan.emblemVariant}
                    accentColor={clan.accentColor}
                    size={48}
                  />
                )}
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                Preview Logo Bulat Klan
              </p>
            </div>

            <div className="mt-3.5 space-y-2">
              <label className="block text-[11px] font-semibold text-slate-300 text-left">
                Link / URL Foto (Bulat)
              </label>
              <input
                type="url"
                value={editLogoUrl}
                onChange={(e) => setEditLogoUrl(e.target.value)}
                placeholder="https://contoh.com/logo-klan.png"
                className="h-10 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white placeholder-slate-500 focus:border-sky-400 focus:outline-none"
              />
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  updateClanLogo(clan.id, editLogoUrl);
                  setIsEditLogoModalOpen(false);
                }}
                className="flex h-10 flex-1 items-center justify-center rounded-xl border border-emerald-400/50 bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-500 active:scale-95"
              >
                Simpan Logo Bulat
              </button>
              {clan.logoUrl && (
                <button
                  type="button"
                  onClick={() => {
                    updateClanLogo(clan.id, '');
                    setEditLogoUrl('');
                    setIsEditLogoModalOpen(false);
                  }}
                  className="flex h-10 items-center justify-center rounded-xl border border-rose-500/40 bg-rose-950/40 px-3 text-xs font-semibold text-rose-300 hover:bg-rose-900/40"
                >
                  Hapus
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Keluar Klan */}
      {isLeaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl border border-rose-500/40 bg-[#0B0E14] p-4 text-slate-100 shadow-2xl">
            <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-sm font-bold text-white uppercase tracking-wide">
                  Konfirmasi Keluar Klan
                </h3>
                <p className="text-[11px] text-slate-400">{clan.name}</p>
              </div>
            </div>

            <div className="mt-3.5 space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <p>
                Apakah Anda yakin ingin keluar dari klan <strong className="text-white">{clan.name}</strong>?
              </p>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-[11px] text-slate-300 space-y-1">
                <p className="text-emerald-300 font-semibold flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" /> Akun, EXP, dan saldo Crystal Anda tetap aman.
                </p>
                <p className="text-sky-300 font-semibold flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" /> Setelah keluar, Anda dapat mengajukan permintaan bergabung ke klan lain.
                </p>
              </div>
              {isCurrentUserLeader && clan.members.length > 1 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 p-2.5 text-[11px] text-amber-200">
                  <strong className="block text-amber-300 font-bold mb-0.5">Perhatian Pemimpin Klan:</strong>
                  Anda memiliki {clan.members.length} anggota. Anda wajib mengalihkan jabatan kepemimpinan terlebih dahulu sebelum dapat keluar klan.
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsLeaveModalOpen(false)}
                disabled={isSubmittingAction}
                className="flex h-10 flex-1 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  setIsSubmittingAction(true);
                  const res = await leaveClan(clan.id);
                  setIsSubmittingAction(false);
                  if (res.ok) {
                    setIsLeaveModalOpen(false);
                  }
                }}
                disabled={isSubmittingAction}
                className="flex h-10 flex-1 items-center justify-center rounded-xl border border-rose-500/50 bg-rose-600 text-xs font-bold text-white hover:bg-rose-500 active:scale-95 transition-all shadow-md"
              >
                {isSubmittingAction ? 'Memproses...' : 'Keluar dari Klan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dialog Konfirmasi Berpindah Klan */}
      {isSwitchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl border border-sky-500/40 bg-[#0B0E14] p-4 text-slate-100 shadow-2xl">
            <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-sm font-bold text-white uppercase tracking-wide">
                  Konfirmasi Berpindah Klan
                </h3>
                <p className="text-[11px] text-sky-300">Aturan 1 Anggota 1 Klan Aktif</p>
              </div>
            </div>

            <div className="mt-3.5 space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <p>
                Anda masih tergabung dalam klan <strong className="text-amber-300">{currentJoinedClan?.name || 'Klan Saat Ini'}</strong>.
              </p>
              <p>
                Untuk bergabung dengan klan <strong className="text-sky-300">{clan.name}</strong>, Anda harus keluar dari klan saat ini terlebih dahulu. Apakah Anda ingin keluar dari klan sekarang?
              </p>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-[11px] text-slate-300 space-y-1">
                <p className="text-amber-300 font-medium">
                  Catatan: Setelah keluar, Anda perlu mengajukan permintaan bergabung ke klan tujuan dan menunggu konfirmasi dari Pemimpin klan tujuan.
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsSwitchModalOpen(false)}
                disabled={isSubmittingAction}
                className="flex h-10 flex-1 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!currentJoinedClan) return;
                  setIsSubmittingAction(true);
                  const res = await leaveClan(currentJoinedClan.id);
                  setIsSubmittingAction(false);
                  if (res.ok) {
                    setIsSwitchModalOpen(false);
                  }
                }}
                disabled={isSubmittingAction}
                className="flex h-10 flex-1 items-center justify-center rounded-xl border border-rose-500/50 bg-rose-600 text-xs font-bold text-white hover:bg-rose-500 active:scale-95 transition-all shadow-md"
              >
                {isSubmittingAction ? 'Memproses...' : 'Keluar dari Klan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Toko Senjata & Gudang Inventory Klan (Khusus Klan Sendiri) */}
      <ClanCombatShopModal
        clan={isJoined ? liveClan : null}
        isOpen={isShopOpen && isJoined}
        onClose={() => setIsShopOpen(false)}
      />
    </div>
  );
};
