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
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#0B0E14]/95 px-3.5 py-3 backdrop-blur-xl shrink-0 shadow-lg">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-slate-200 transition-colors hover:border-white/20 hover:bg-white/[0.08] active:scale-95 whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Kembali</span>
        </button>

        <div className="min-w-0 text-right">
          <div className="font-display truncate text-sm font-bold text-white tracking-wide">{clan.name}</div>
          <div className="mt-0.5 font-mono text-[10.5px] text-slate-400 tabular-nums">
            EXP Klan: <span className="font-bold text-sky-400">{totalClanExp.toLocaleString('id-ID')}</span> · <span className="font-bold text-amber-400">{relicShards}</span> Pecahan Relik
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
      <div className="nuenime-scroll flex-1 space-y-4 overflow-y-auto pb-5">
        {/* Hero Crest Pedestal Showcase */}
        <div className="relative flex flex-col items-center justify-end overflow-hidden border-b border-slate-800 px-4 pt-6 pb-5 text-center">
          <img
            src="/assets/nuenime/clan_emblem_pedestal.webp"
            alt=""
            referrerPolicy="no-referrer"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-35"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#070d19] via-[#070d19]/65 to-slate-950/40" />

          <div className="relative z-10 flex flex-col items-center">
            <div className="relative">
              <div className="rounded-full p-2">
                <ClanEmblemIcon
                  variant={clan.emblemVariant}
                  accentColor={clan.accentColor}
                  logoUrl={clan.logoUrl}
                  size={76}
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
                  className="absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900/90 text-sky-300 hover:border-sky-400 hover:text-white active:scale-95 transition-all"
                  title="Atur / Ubah Logo Foto Klan"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="mt-2 text-[11px] font-medium text-sky-300">
              {clan.reputationRank} · [{clan.tag}] · Level Klan {clan.level}
            </div>
            <h1 className="font-display mt-0.5 text-xl font-bold tracking-wide text-white">
              {clan.name}
            </h1>
            <p className="mt-1 max-w-xs text-xs italic text-slate-300">
              &ldquo;{clan.motto}&rdquo;
            </p>

            {/* Precision 2-Row Clan Actions:
                Baris 1: [Klan Aktif Anda / Gabung Klan] | [Kota {cityName}]
                Baris 2: [Gudang Senjata & Toko Logistik] (Full Width)
            */}
            <div className="mt-3.5 w-full max-w-sm space-y-2">
              {/* Baris Pertama: Tombol Keanggotaan & Kota */}
              {isJoined ? (
                <div className="grid grid-cols-2 gap-2 w-full">
                  <div className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-emerald-400/60 bg-emerald-950/70 px-3 text-xs font-bold text-emerald-200 shadow-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-300 shrink-0" />
                    <span className="truncate">Klan Aktif Anda</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsLeaveModalOpen(true)}
                    className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-950/40 px-3 text-xs font-bold text-rose-300 hover:border-rose-400 hover:bg-rose-900/50 active:scale-95 transition-all shadow-sm"
                  >
                    <LogOut className="h-4 w-4 text-rose-400 shrink-0" />
                    <span className="truncate">Keluar Klan</span>
                  </button>
                </div>
              ) : pendingRequest ? (
                <div className="grid grid-cols-2 gap-2 w-full">
                  <div className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-amber-400/60 bg-amber-950/60 px-2.5 text-[11px] font-bold text-amber-200 shadow-sm">
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
                    className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/90 px-3 text-xs font-semibold text-slate-300 hover:border-rose-500/60 hover:text-rose-300 active:scale-95 transition-all shadow-sm"
                  >
                    <X className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="truncate">Batalkan</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 w-full">
                  <button
                    type="button"
                    onClick={async () => {
                      if (joinedClanId && joinedClanId !== clan.id) {
                        setIsSwitchModalOpen(true);
                        return;
                      }
                      setIsSubmittingAction(true);
                      const res = await requestJoinClan(clan.id);
                      if (res.requiresLeaveFirst) {
                        setIsSwitchModalOpen(true);
                      }
                      setIsSubmittingAction(false);
                    }}
                    disabled={isSubmittingAction}
                    className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-sky-300/65 bg-gradient-to-r from-sky-600 to-indigo-700 px-3 text-xs font-bold text-white shadow-md active:scale-95 transition-all"
                  >
                    <Shield className="h-4 w-4 shrink-0" />
                    <span className="truncate">Gabung Klan</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onNavigateToCity(clan.cityId)}
                    className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/90 px-3 text-xs font-semibold text-sky-200 hover:border-sky-400/60 active:scale-95 transition-all shadow-sm"
                  >
                    <MapPin className="h-4 w-4 text-sky-300 shrink-0" />
                    <span className="truncate">Kota {clan.cityName}</span>
                  </button>
                </div>
              )}

              {/* Baris Kedua: Tombol Gudang Senjata & Toko Logistik Presisi */}
              <button
                type="button"
                onClick={() => setIsShopOpen(true)}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-amber-400/60 bg-gradient-to-r from-amber-600/30 via-amber-500/20 to-amber-600/30 px-4 text-xs font-bold text-amber-200 hover:border-amber-400 hover:bg-amber-500/30 active:scale-95 transition-all shadow-md shadow-amber-950/40"
              >
                <ShoppingBag className="h-4 w-4 text-amber-300 shrink-0" />
                <span>Gudang Senjata & Toko Logistik</span>
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3.5 px-3.5">
          {/* Quick Stats Row - Tepat 2 Kotak per Baris (2 Baris x 2 Kolom, Bebas Emoji) */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Kotak 1: Kapasitas Anggota */}
            <div className="rounded-xl border border-slate-800/90 bg-slate-900/75 p-3 text-center flex flex-col justify-center">
              <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400">
                <Users className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span>Kapasitas Anggota</span>
              </div>
              <div className="font-mono mt-1 text-sm font-bold text-white tabular-nums">
                {clan.memberCount} / {clan.maxMembers}
              </div>
            </div>

            {/* Kotak 2: Kas Koin Klan */}
            <div className="rounded-xl border border-amber-500/35 bg-amber-950/25 p-3 text-center flex flex-col justify-center">
              <div className="flex items-center justify-center gap-1 text-[11px] text-amber-300 font-semibold">
                <Coins className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span>Kas Koin Klan</span>
              </div>
              <div className="font-mono mt-1 text-sm font-bold text-amber-200 tabular-nums">
                {(clan.coins ?? 1000).toLocaleString('id-ID')} Coin
              </div>
            </div>

            {/* Kotak 3: Kendali Distrik */}
            <div className="rounded-xl border border-slate-800/90 bg-slate-900/75 p-3 text-center flex flex-col justify-center">
              <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400">
                <Compass className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span>Kendali Distrik</span>
              </div>
              <div className="font-mono mt-1 text-sm font-bold text-amber-300 tabular-nums">
                {influence}%
              </div>
            </div>

            {/* Kotak 4: Total EXP Klan */}
            <div className="rounded-xl border border-slate-800/90 bg-slate-900/75 p-3 text-center flex flex-col justify-center">
              <div className="flex items-center justify-center text-[11px] text-slate-400">
                <span>Total EXP Klan</span>
              </div>
              <div className="font-mono mt-1 text-sm font-bold text-sky-300 tabular-nums">
                {totalClanExp.toLocaleString('id-ID')} EXP
              </div>
            </div>
          </div>

          {/* Artefak Pusaka & Buff Elemen Klan */}
          <div className="rounded-2xl border border-amber-400/35 bg-gradient-to-br from-slate-900/95 via-slate-900/85 to-amber-950/25 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-amber-300" />
                <h2 className="font-display text-sm font-bold text-white">
                  Artefak Pusaka & Buff Elemen
                </h2>
              </div>
              <span className="font-mono text-xs font-bold text-amber-300 tabular-nums">
                Level {currentRelicLevel}
              </span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10.5px] font-medium text-amber-300">
                    {relicInfo.relicTitle}
                  </div>
                  <div className="font-display text-sm font-bold text-white">
                    {relicInfo.relicName}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-400">Buff Aktif</div>
                  <div className="font-mono text-xs font-bold text-emerald-300 tabular-nums">
                    +{currentBuffBonus}% {relicInfo.elementBuffName}
                  </div>
                </div>
              </div>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-300">
                {relicInfo.lore}
              </p>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="text-[11px] text-slate-300">
                Pecahan Relik Anda:{' '}
                <span className="font-mono font-bold text-amber-300 tabular-nums">
                  {relicShards}
                </span>
              </div>

              <button
                type="button"
                onClick={() => upgradeClanRelic(clan.id)}
                className="flex min-h-[36px] items-center gap-1.5 rounded-xl border border-amber-400/55 bg-amber-500/20 px-3.5 py-1.5 text-xs font-bold text-amber-100 hover:bg-amber-500/30 active:scale-95 whitespace-nowrap shrink-0"
              >
                <ArrowUpCircle className="h-4 w-4 text-amber-300" />
                <span>Tingkatkan Artefak ({upgradeShardCost} Relik)</span>
              </button>
            </div>
          </div>

          {/* Penguasaan Distrik Markas & Misi Simulasi Klan */}
          <div className="rounded-2xl border border-slate-800/90 bg-slate-900/80 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[10.5px] text-sky-300">Distrik Markas Kota {clan.cityName}</div>
                <h2 className="font-display text-sm font-bold text-white">
                  {clan.strongholdDistrict} (Kendali {influence}%)
                </h2>
              </div>
              <div className="flex items-center rounded-xl border border-sky-400/40 bg-sky-950/60 px-3 py-1.5 font-mono text-[10.5px] font-bold text-sky-200 shrink-0">
                <span>EXP Realtime</span>
              </div>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full transition-all duration-300"
                style={{ width: `${influence}%`, backgroundColor: clan.accentColor }}
              />
            </div>
            <div className="flex items-center justify-between text-[10.5px] text-slate-400">
              <span>
                Kontribusi Distrik: <span className="font-mono text-sky-300 font-bold">{clan.totalExp.toLocaleString('id-ID')}</span> / {Math.max(1000, (clan.level || 1) * 1000).toLocaleString('id-ID')} EXP
              </span>
              <span className="font-mono text-emerald-400">Otomatis dari APK</span>
            </div>

            {/* Misi Aktivitas Real-Time Komunitas Klan (Tanpa Simulasi) */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-200">
                  Misi & Aktivitas Komunitas Klan ({clanMissions.length})
                </span>
                <span className="flex items-center rounded-md bg-emerald-950/80 px-2 py-0.5 font-mono text-[9px] font-bold text-emerald-300 border border-emerald-500/40">
                  <span>AKTIVITAS REAL NUENIME</span>
                </span>
              </div>
              <p className="text-[10.5px] text-slate-400 leading-relaxed">
                Aktivitas nyata Anda di Nuenime otomatis menyumbang EXP langsung ke kontribusi pribadi, klan, dan level kota.
              </p>

              <div className="space-y-2 mt-2">
                {clanMissions.map((msn) => (
                  <div
                    key={msn.id}
                    className="flex items-center justify-between gap-2.5 rounded-xl border border-slate-800 bg-slate-950/70 p-2.5 sm:p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-xs font-bold text-white truncate">
                        {msn.title}
                      </div>
                      <div className="text-[10.5px] text-slate-400 mt-0.5">
                        +{msn.rewardExp} EXP (Anggota → Klan → Kota {clan.cityName})
                      </div>
                    </div>

                    {/* Status Otomatis dari APK (Murni Anti-Cheat, Tanpa Tombol Manual) */}
                    <div className="flex flex-col items-end shrink-0 text-right">
                      <div className="inline-flex items-center rounded-lg border border-sky-400/40 bg-sky-950/60 px-2.5 py-1 font-mono text-[10.5px] font-bold text-sky-200">
                        <span>Otomatis APK</span>
                      </div>
                      <span className="text-[9.5px] text-emerald-400 font-medium mt-0.5">
                        Sinkron Real-time
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Leader Highlight Card */}
          <div className="rounded-2xl border border-slate-800/90 bg-slate-900/80 p-3.5">
            <div className="text-[11px] font-semibold text-amber-300">Pemimpin Klan</div>
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* Avatar & Border Pembuat / Pemimpin Klan */}
                <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
                  <div
                    className={`relative h-11 w-11 overflow-hidden rounded-full bg-gradient-to-tr from-sky-600 via-indigo-600 to-purple-700 flex items-center justify-center ${
                      leaderBorderMeta?.assetUrl
                        ? ''
                        : 'ring-2 ring-amber-400/80 shadow-[0_0_8px_rgba(251,191,36,0.3)]'
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
                      <span className="font-display text-sm font-bold text-white uppercase">
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
                        width: `${Math.round(44 / (leaderBorderMeta.innerRatio || 0.74))}px`,
                        height: `${Math.round(44 / (leaderBorderMeta.innerRatio || 0.74))}px`,
                      }}
                      className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-none object-contain z-10 select-none drop-shadow-[0_0_6px_rgba(251,191,36,0.4)]"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  )}
                </div>
                <div>
                  <div className="font-display text-sm font-bold text-white">
                    {clan.leaderName}
                  </div>
                  <div className="text-xs text-slate-400">{clan.leaderTitle}</div>
                </div>
              </div>

              {city && (
                <button
                  type="button"
                  onClick={() => onNavigateToCity(city.id)}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-700/80 bg-slate-950/80 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 hover:border-sky-400/50"
                >
                  <CityEmblemBadge cityId={city.id} material={city.material} size={20} />
                  <span>
                    {city.name} (Lv.{city.level})
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Deskripsi & Sejarah Klan */}
          <div className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-3.5 space-y-2">
            <h2 className="font-display text-sm font-bold text-white">Profil & Sejarah Klan</h2>
            <p className="text-xs leading-relaxed text-slate-300">{clan.description}</p>
            <p className="text-xs leading-relaxed text-slate-400">{clan.historyLore}</p>

            <div className="mt-3 space-y-1.5 border-t border-slate-800 pt-2.5 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <MapPin className="h-3.5 w-3.5 text-sky-300 shrink-0" />
                <span>Markas Distrik: {clan.strongholdDistrict}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Compass className="h-3.5 w-3.5 text-emerald-300 shrink-0" />
                <span>Spesialisasi: {clan.specialization}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Calendar className="h-3.5 w-3.5 text-purple-300 shrink-0" />
                <span>Era Berdiri: {clan.foundedEra}</span>
              </div>
            </div>
          </div>

          {/* Daftar Anggota & Kontribusi EXP */}
          <div className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-3.5">
            <div className="mb-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-300" />
                <h2 className="font-display text-sm font-bold text-white">
                  Daftar Anggota & Kontribusi EXP
                </h2>
              </div>
              <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                {clan.memberCount} / {clan.maxMembers} Anggota
              </span>
            </div>

            <div className="space-y-2 mt-2">
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
                    className="flex items-center justify-between gap-2 rounded-2xl border border-slate-800/70 bg-transparent p-2.5 sm:p-3 transition-all"
                  >
                    {/* Sisi Kiri: Ranking, Avatar + Border, Nama & Badges */}
                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                      {/* Ranking Number */}
                      <span
                        className={`font-mono text-xs font-bold shrink-0 w-4 text-center ${
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

                      {/* Avatar Bulat dengan Border Overlay Presisi */}
                      <div className="relative flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center">
                        <div
                          className={`relative h-10 w-10 overflow-hidden rounded-full bg-transparent flex items-center justify-center ${
                            resolvedBorder
                              ? ''
                              : isLeader
                              ? 'ring-2 ring-amber-400/80 shadow-[0_0_8px_rgba(251,191,36,0.3)]'
                              : 'ring-1.5 ring-slate-700'
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
                            <span className="font-display text-sm font-bold text-white uppercase">
                              {member.name.charAt(0) || 'A'}
                            </span>
                          )}
                        </div>

                        {/* Border Avatar Presisi Konsentris */}
                        {resolvedBorder && (
                          <img
                            src={resolvedBorder}
                            alt=""
                            style={{
                              width: `${Math.round(40 / 0.74)}px`,
                              height: `${Math.round(40 / 0.74)}px`,
                            }}
                            className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-none object-contain z-10 select-none drop-shadow-[0_0_6px_rgba(251,191,36,0.35)]"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                          />
                        )}
                      </div>

                      {/* Info Nama, Verifikasi & Badge Role Sesuai Mockup Gambar 2 */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="truncate text-xs sm:text-sm font-bold text-white">
                            {member.name}
                          </span>
                          {isLeader && (
                            <span
                              title="Pemimpin Terverifikasi"
                              className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white shadow-sm shadow-rose-950/60"
                            >
                              <Check className="h-2 w-2 stroke-[3]" />
                            </span>
                          )}
                        </div>

                        {/* Baris Badge: Level + Role Klan Sesuai Gambar 2 */}
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          {/* Badge Level Akun */}
                          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/50 bg-transparent px-1.5 py-0.5 font-mono text-[9px] font-bold text-emerald-300 shrink-0">
                            <Shield className="h-2.5 w-2.5 text-emerald-400 shrink-0" />
                            <span>Lv. {formattedLevel}</span>
                          </span>

                          {/* Badge Role / Tag Pemimpin Klan Sesuai Role Klan */}
                          {isLeader ? (
                            <span className="inline-flex items-center rounded-md border border-purple-500/60 bg-transparent px-1.5 py-0.5 font-mono text-[8.5px] font-bold text-purple-300 uppercase tracking-wider shrink-0">
                              Pemimpin Klan
                            </span>
                          ) : isCoLeader ? (
                            <span className="inline-flex items-center rounded-md border border-indigo-500/60 bg-transparent px-1.5 py-0.5 font-mono text-[8.5px] font-bold text-indigo-300 uppercase tracking-wider shrink-0">
                              Wakil Ketua
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-md border border-slate-700 bg-transparent px-1.5 py-0.5 font-mono text-[8.5px] font-bold text-slate-300 uppercase tracking-wider shrink-0">
                              Anggota
                            </span>
                          )}

                          {/* Afinitas Elemen / Info Tambahan */}
                          {member.elementAffinity && (
                            <span className="text-[9px] text-slate-400 font-mono shrink-0 hidden xs:inline">
                              · {member.elementAffinity}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Sisi Kanan: Kontribusi EXP Presisi di Mobile */}
                    <div className="shrink-0 text-right pl-1.5 flex flex-col items-end justify-center">
                      <div className="inline-flex items-center gap-1 font-mono text-xs sm:text-sm font-bold text-amber-300 tabular-nums">
                        <Award className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        <span>{member.contributionScore.toLocaleString('id-ID')}</span>
                        <span className="text-[10px] text-amber-400/90 font-bold">EXP</span>
                      </div>
                      <div className="text-[9px] text-slate-400 font-medium whitespace-nowrap mt-0.5">
                        Kontribusi Klan
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

      {/* Modal Toko Senjata & Gudang Inventory Klan */}
      <ClanCombatShopModal
        isOpen={isShopOpen}
        onClose={() => setIsShopOpen(false)}
      />
    </div>
  );
};
