import React from 'react';
import {
  ArrowLeft,
  Sun,
  Sunset,
  Moon,
  Volume2,
  VolumeX,
  Flame,
} from 'lucide-react';
import { WorldGlobeIcon, NuenimeCrystalIcon } from './icons/NuenimeAssets';
import { useNuenimeRpg } from '../context/NuenimeRpgContext';
import { TimeOfDayMode } from '../types/nuenime';

interface WorldHeaderProps {
  onBackClick: () => void;
  onOpenWorldInfo: () => void;
  onOpenLegendModal: () => void;
  onOpenRoutePlanner?: () => void;
  onCycleWorldBoss: () => void;
}

function formatCompactCrystals(amount: number): string {
  if (amount >= 1_000_000_000) {
    return (amount / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  }
  if (amount >= 1_000_000) {
    return (amount / 1_000_000).toFixed(2).replace(/\.00$/, '').replace(/\.0$/, '') + 'M';
  }
  if (amount >= 100_000) {
    return (amount / 1_000).toFixed(0) + 'K';
  }
  return amount.toLocaleString('id-ID');
}

export const WorldHeader: React.FC<WorldHeaderProps> = ({
  onBackClick,
  onOpenWorldInfo,
  onOpenLegendModal,
  onOpenRoutePlanner,
  onCycleWorldBoss,
}) => {
  const {
    timeOfDay,
    setTimeOfDay,
    soundEnabled,
    toggleSound,
    activeRoute,
    activeAccount,
    userCrystals,
  } = useNuenimeRpg();

  const cycleTimeOfDay = () => {
    const next: Record<TimeOfDayMode, TimeOfDayMode> = {
      day: 'dusk',
      dusk: 'night',
      night: 'day',
    };
    setTimeOfDay(next[timeOfDay]);
  };

  return (
    <header className="pointer-events-none absolute top-0 left-0 right-0 z-30 flex flex-col gap-1.5 px-2.5 pt-2.5 sm:px-3 sm:pt-3 max-w-lg mx-auto">
      {/* Row 1: Unified Sleek Header Bar */}
      <div className="pointer-events-auto flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-[#0B0E14]/95 p-2 backdrop-blur-xl shadow-xl">
        {/* Left: Back Button + Emblem & Title */}
        <div className="flex min-w-0 items-center gap-2">
          {/* Back Button */}
          <button
            type="button"
            onClick={onBackClick}
            aria-label="Kembali ke Nuenime"
            title="Kembali ke Aplikasi Utama Nuenime"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          {/* Emblem & Title */}
          <div className="flex min-w-0 items-center gap-2">
            <img
              src="/assets/nuenime/dunia-nuenime-emblem.png"
              alt="Dunia Nuenime Emblem"
              className="h-6 w-6 shrink-0 object-contain drop-shadow-[0_0_8px_rgba(56,189,248,0.4)]"
            />
            <div className="min-w-0">
              <h1 className="font-display truncate text-[13px] font-bold leading-tight text-white tracking-wide sm:text-sm">
                Dunia Nuenime
              </h1>
              <p className="truncate text-[10px] leading-tight font-medium text-slate-400">
                {activeAccount.displayName}
              </p>
            </div>
          </div>
        </div>

        {/* Right: Crystal Pill & Action Controls */}
        <div className="flex shrink-0 items-center gap-1.5">
          {/* Crystal Balance Badge */}
          <div
            title={`Saldo Crystal: ${userCrystals.toLocaleString('id-ID')} Crystal\n(Dibutuhkan 2.000 Crystal untuk mendirikan klan)`}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2 font-mono text-xs font-semibold text-slate-200"
          >
            <NuenimeCrystalIcon size={13} />
            <span className="tabular-nums">
              <span className="min-[430px]:hidden">{formatCompactCrystals(userCrystals)}</span>
              <span className="hidden min-[430px]:inline">{userCrystals.toLocaleString('id-ID')}</span>
            </span>
          </div>

          {/* Audio Toggle Button */}
          <button
            type="button"
            onClick={toggleSound}
            aria-label={soundEnabled ? 'Matikan suara RPG' : 'Aktifkan suara RPG'}
            title={soundEnabled ? 'Audio RPG Aktif' : 'Audio RPG Bisu'}
            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-all active:scale-95 ${
              soundEnabled
                ? 'border-white/15 bg-white/10 text-slate-100'
                : 'border-white/10 bg-white/[0.04] text-slate-400 hover:text-white'
            }`}
          >
            {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          </button>

          {/* Guide Button */}
          <button
            type="button"
            onClick={onOpenLegendModal}
            aria-label="Panduan Eksplorasi Dunia"
            title="Panduan Peta & Kontrol"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-xs font-bold text-slate-300 transition-all hover:bg-white/[0.08] hover:text-white active:scale-95"
          >
            !
          </button>
        </div>
      </div>

      {/* Row 2: Precision 3-Column Action Bar */}
      <div className="pointer-events-auto grid grid-cols-3 gap-2">
        {/* Real-Time Auto Day/Night Atmosphere */}
        <button
          type="button"
          onClick={cycleTimeOfDay}
          title="Suasana Waktu Otomatis Mengikuti Jam Nyata (Klik untuk mengganti manual)"
          className="flex h-8 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#0B0E14]/95 px-2 text-xs font-semibold text-slate-300 backdrop-blur-xl transition-all hover:bg-white/[0.06] hover:text-white active:scale-95"
        >
          {timeOfDay === 'day' && <Sun className="h-3.5 w-3.5 shrink-0 text-amber-300" />}
          {timeOfDay === 'dusk' && <Sunset className="h-3.5 w-3.5 shrink-0 text-orange-400" />}
          {timeOfDay === 'night' && <Moon className="h-3.5 w-3.5 shrink-0 text-purple-300" />}
          <span className="truncate">
            {timeOfDay === 'day' ? 'Siang' : timeOfDay === 'dusk' ? 'Senja' : 'Malam'}
            <span className="text-[10px] text-slate-500 font-normal ml-0.5">(Auto)</span>
          </span>
        </button>

        {/* 7 City Bosses Radar Trigger */}
        <button
          type="button"
          onClick={onCycleWorldBoss}
          className="flex h-8 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#0B0E14]/95 px-2 text-xs font-semibold text-slate-300 backdrop-blur-xl transition-all hover:bg-white/[0.06] hover:text-white active:scale-95"
        >
          <Flame className="h-3.5 w-3.5 shrink-0 text-rose-400" />
          <span className="truncate">7 Bos Kota</span>
        </button>

        {/* Info Dunia & Statistik Global Button */}
        <button
          type="button"
          onClick={onOpenWorldInfo}
          className="flex h-8 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#0B0E14]/95 px-2 text-xs font-semibold text-slate-300 backdrop-blur-xl transition-all hover:bg-white/[0.06] hover:text-white active:scale-95"
        >
          <WorldGlobeIcon size={14} className="shrink-0 text-sky-400" />
          <span className="truncate">Info Dunia</span>
        </button>
      </div>
    </header>
  );
};
