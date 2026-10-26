import React from 'react';
import {
  ArrowLeft,
  Trophy,
  ChevronRight,
  Shield,
  Users,
  Globe,
  Crown,
  Zap,
  MapPin,
  CheckCircle2,
  Coins,
} from 'lucide-react';
import { WorldCity, Clan, CityId } from '../types/nuenime';
import { ClanEmblemIcon } from './icons/NuenimeAssets';
import { useNuenimeRpg } from '../context/NuenimeRpgContext';

interface ClanHomeScreenProps {
  cities: WorldCity[];
  onOpenLeaderboard: (cityId?: CityId) => void;
  onSelectClan: (clan: Clan) => void;
  onBack: () => void;
}

export const ClanHomeScreen: React.FC<ClanHomeScreenProps> = ({
  cities,
  onOpenLeaderboard,
  onSelectClan,
  onBack,
}) => {
  const {
    joinedClanId,
    playerContribution,
    relicShards,
    getClanTotalScore,
    districtInfluence,
    getWorldClansLeaderboard,
    globalWorldStats,
  } = useNuenimeRpg();

  // Valid ranking dari sistem (seluruh klan diurutkan berdasarkan EXP tertinggi)
  const rankedClans = getWorldClansLeaderboard();
  const topClan = rankedClans.length > 0 ? rankedClans[0] : null;
  const joinedClan = rankedClans.find((c) => c.id === joinedClanId);

  const topClanCity = topClan ? cities.find((c) => c.id === topClan.cityId) : null;
  const topClanScore = topClan ? getClanTotalScore(topClan.id) : 0;
  const topClanInfluence = topClan ? (districtInfluence[topClan.id]?.influencePercent ?? 76) : 0;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#07090E] text-slate-100">
      {/* Top Header Bar */}
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
          <h1 className="font-display truncate text-xs sm:text-sm font-bold text-white tracking-wide uppercase">
            Pusat Komunitas Klan
          </h1>
          <div className="mt-1 flex items-center justify-end gap-1.5 font-mono text-[10px]">
            <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 font-medium text-slate-300 tabular-nums">
              EXP Anda: <span className="font-bold text-sky-400">{playerContribution.toLocaleString('id-ID')}</span>
            </span>
            <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 font-medium text-slate-300 tabular-nums">
              <span className="font-bold text-amber-400">{relicShards}</span> Relik
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="nuenime-scroll flex-1 space-y-3.5 overflow-y-auto px-3.5 py-3.5 pb-6">
        {/* Strip Statistik Ringkas Dunia */}
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-[#0B0E14]/95 p-3 text-center backdrop-blur-xl shadow-xl">
          <div className="flex flex-col items-center justify-center min-w-0">
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <Globe className="h-3 w-3 text-slate-400 shrink-0" />
              <span className="truncate">EXP Dunia</span>
            </div>
            <div className="font-mono text-sm font-bold text-slate-100 tabular-nums truncate mt-0.5">
              {globalWorldStats.totalWorldExp.toLocaleString('id-ID')}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center min-w-0 border-x border-white/5 px-2">
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <Shield className="h-3 w-3 text-slate-400 shrink-0" />
              <span className="truncate">Total Klan</span>
            </div>
            <div className="font-mono text-sm font-bold text-slate-100 tabular-nums truncate mt-0.5">
              {globalWorldStats.totalClansCount}{' '}
              <span className="text-[10px] font-sans font-normal text-slate-400">Klan</span>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center min-w-0">
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <Users className="h-3 w-3 text-slate-400 shrink-0" />
              <span className="truncate">Anggota</span>
            </div>
            <div className="font-mono text-sm font-bold text-slate-100 tabular-nums truncate mt-0.5">
              {globalWorldStats.totalClanMembersCount}{' '}
              <span className="text-[10px] font-sans font-normal text-slate-400">Jiwa</span>
            </div>
          </div>
        </div>

        {/* Klan Aktif Pengguna (Jika sudah bergabung) */}
        {joinedClan && (
          <div className="rounded-2xl border border-white/10 bg-[#0B0E14]/95 p-3.5 backdrop-blur-xl shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <ClanEmblemIcon
                  variant={joinedClan.emblemVariant}
                  accentColor={joinedClan.accentColor}
                  logoUrl={joinedClan.logoUrl}
                  size={40}
                  className="shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400 uppercase tracking-wider">
                      Klan Aktif Anda
                    </span>
                    <span className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9px] font-medium text-slate-300">
                      [{joinedClan.tag}]
                    </span>
                  </div>
                  <div className="truncate font-bold text-sm text-white mt-1">
                    {joinedClan.name}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 font-mono text-[10.5px] text-slate-400 mt-1">
                    <span className="font-semibold text-slate-200">
                      {joinedClan.totalExp.toLocaleString('id-ID')} EXP
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="font-semibold text-slate-200 inline-flex items-center gap-1">
                      <Coins className="h-3 w-3 text-amber-400/90" />
                      <span>{(joinedClan.coins ?? 1000).toLocaleString('id-ID')} Coin</span>
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-400 font-sans">Kota {joinedClan.cityName}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onSelectClan(joinedClan)}
                className="flex h-8 items-center gap-1 rounded-xl border border-white/10 bg-white/[0.06] hover:bg-white/[0.1] px-3 text-xs font-semibold text-slate-200 transition-colors active:scale-95 whitespace-nowrap shrink-0"
              >
                <span>Markas Klan</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* SECTION 1: KARTU UNGGULAN KLAN NOMOR 1 */}
        {topClan ? (
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0B0E14]/95 p-4 backdrop-blur-xl shadow-xl text-slate-100 space-y-3.5">
            {/* Header Kartu: Peringkat #1 & Status */}
            <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 font-mono text-xs font-bold text-amber-300 tracking-wide">
                  <Trophy className="h-3.5 w-3.5 text-amber-300 shrink-0" />
                  <span>PERINGKAT #1 DUNIA</span>
                </span>
              </div>
              <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-slate-300">
                {topClan.reputationRank || 'Klan Juara'}
              </span>
            </div>

            {/* Emblem Besar & Identitas Klan */}
            <div className="flex flex-col items-center text-center">
              <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-black/40 p-2 shadow-inner">
                <ClanEmblemIcon
                  variant={topClan.emblemVariant}
                  accentColor={topClan.accentColor}
                  logoUrl={topClan.logoUrl}
                  size={58}
                  className="shrink-0"
                />
              </div>

              <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
                <h2 className="font-display text-lg font-bold text-white tracking-wide">
                  {topClan.name}
                </h2>
                <span className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9.5px] font-medium text-slate-300">
                  [{topClan.tag}]
                </span>
              </div>

              {topClan.motto && (
                <p className="mt-1 max-w-xs text-xs italic text-slate-400 leading-relaxed">
                  &ldquo;{topClan.motto}&rdquo;
                </p>
              )}
            </div>

            {/* Data Detail & Statistik */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* Kota Asal & Level */}
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5 space-y-0.5">
                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                  <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                  <span>Kota Asal</span>
                </div>
                <div className="font-semibold text-slate-200 truncate">
                  Kota {topClan.cityName}
                </div>
                {topClanCity && (
                  <div className="font-mono text-[10px] text-slate-400">
                    Level {topClanCity.level} · Tier {topClanCity.tier}
                  </div>
                )}
              </div>

              {/* Total EXP Klan */}
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5 space-y-0.5">
                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                  <Trophy className="h-3 w-3 text-slate-400 shrink-0" />
                  <span>Total EXP</span>
                </div>
                <div className="font-mono text-sm font-bold text-amber-300 tabular-nums">
                  {topClanScore.toLocaleString('id-ID')}
                </div>
                <div className="text-[10px] text-slate-400">Poin Akumulasi</div>
              </div>

              {/* Pemimpin Klan */}
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5 space-y-0.5">
                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                  <Crown className="h-3 w-3 text-slate-400 shrink-0" />
                  <span>Pemimpin</span>
                </div>
                <div className="font-semibold text-slate-200 truncate">
                  {topClan.leaderName}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {topClan.leaderTitle}
                </div>
              </div>

              {/* Anggota & Pengaruh */}
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5 space-y-0.5">
                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                  <Users className="h-3 w-3 text-slate-400 shrink-0" />
                  <span>Anggota & Pengaruh</span>
                </div>
                <div className="font-mono font-semibold text-slate-200 tabular-nums">
                  {topClan.memberCount}/{topClan.maxMembers} Anggota
                </div>
                <div className="font-mono text-[10px] text-slate-400">
                  <Zap className="inline h-2.5 w-2.5 mr-0.5 text-slate-400" />
                  {topClanInfluence}% Pengaruh
                </div>
              </div>
            </div>

            {/* Tombol Lihat Detail Klan #1 */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => onSelectClan(topClan)}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white shadow-sm transition-all active:scale-[0.98]"
              >
                <span>Lihat Detail Markas Klan #1</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Empty State yang rapi jika belum ada klan */
          <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#0B0E14]/95 backdrop-blur-xl py-12 px-4 text-center shadow-xl">
            <Shield className="h-10 w-10 text-slate-600 mb-2" />
            <p className="text-sm font-semibold text-slate-300">Belum Ada Klan yang Terdaftar</p>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              Jadilah yang pertama mendirikan klan di salah satu dari 7 kota Dunia Nuenime!
            </p>
          </div>
        )}

        {/* SECTION 2: TOMBOL LEADERBOARD TERPISAH (Clean Mobile UI) */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => onOpenLeaderboard()}
            className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0B0E14]/95 p-3.5 text-left backdrop-blur-xl transition-all hover:border-white/20 hover:bg-[#0E121B] active:scale-[0.98] shadow-xl"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-amber-400/90 group-hover:border-amber-400/30 transition-colors">
                <Trophy className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm font-bold text-white tracking-wide whitespace-nowrap">
                    Leaderboard Klan
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                  Buka ranking lengkap Dunia & filter 7 kota
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 pl-1">
              <div className="flex flex-col items-end gap-0.5">
                <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[10.5px] font-bold text-slate-200 whitespace-nowrap">
                  {rankedClans.length} Klan
                </span>
                <span className="text-[9.5px] font-medium text-slate-400 whitespace-nowrap">
                  Semua Peringkat
                </span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-500 transition-colors group-hover:text-slate-200" />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
