import React, { useState } from 'react';
import { ChevronRight, Users, X, Flame } from 'lucide-react';
import { WorldCity } from '../types/nuenime';
import { CityEmblemBadge } from './icons/NuenimeAssets';

interface CityInfoPanelProps {
  city: WorldCity | null;
  onEnterCity: (city: WorldCity) => void;
  onSelectCityBoss?: (city: WorldCity) => void;
  onClose: () => void;
}

/**
 * CityInfoPanel menampilkan kartu informasi kota yang dipilih di bagian bawah peta.
 * Didesain presisi, rapi, responsif mobile, tanpa bayangan (flat modern),
 * dengan ukuran tombol seragam dan tema Dark Obsidian Nuenime.
 */
export const CityInfoPanel: React.FC<CityInfoPanelProps> = ({
  city,
  onEnterCity,
  onSelectCityBoss,
  onClose,
}) => {
  const [thumbError, setThumbError] = useState<Record<string, boolean>>({});

  if (!city) return null;

  const hasError = !!thumbError[city.id];
  const expPercent = Math.min(
    100,
    Math.round((city.currentLevelExp / Math.max(1, city.nextLevelTargetExp)) * 100)
  );
  const remainingExp = Math.max(0, city.nextLevelTargetExp - city.currentLevelExp);

  return (
    <div
      className="pointer-events-auto absolute bottom-2.5 left-2.5 right-2.5 z-30 transition-all duration-200 max-w-lg mx-auto"
      role="region"
      aria-label={`Informasi Kota ${city.name}`}
    >
      {/* Clean Dark Glass Card matching Nuenime Library */}
      <div className="relative flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#0B0E14]/95 p-3.5 backdrop-blur-xl shadow-2xl">
        {/* Top-right close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup panel informasi kota"
          className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white active:scale-95"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/* Top Row: Thumbnail + City Title, Level/Tier, Lore & EXP */}
        <div className="flex items-center gap-3">
          {/* Original Circular City Thumbnail with Top Diamond Spike & Bottom Shield Badge */}
          <div className="relative shrink-0 py-1">
            <div
              className="absolute top-0 left-1/2 z-10 h-2 w-2 -translate-x-1/2 rotate-45 border-t border-l border-sky-400/80 bg-slate-900"
              aria-hidden="true"
            />

            <div
              className="relative h-[66px] w-[66px] overflow-hidden rounded-full border-2 bg-slate-950 sm:h-[72px] sm:w-[72px]"
              style={{ borderColor: city.secondaryHex }}
            >
              {!hasError ? (
                <img
                  src={city.thumbnailAsset}
                  alt={`Ilustrasi kota ${city.name}`}
                  referrerPolicy="no-referrer"
                  onError={() => setThumbError((prev) => ({ ...prev, [city.id]: true }))}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center"
                  style={{
                    background: `radial-gradient(circle, ${city.accentHex}44 0%, #0f172a 100%)`,
                  }}
                >
                  <CityEmblemBadge cityId={city.id} material={city.material} size={36} />
                </div>
              )}
            </div>

            {/* Bottom Shield Emblem Overlay */}
            <div className="absolute -bottom-1 left-1/2 z-10 -translate-x-1/2">
              <CityEmblemBadge cityId={city.id} material={city.material} size={24} selected />
            </div>
          </div>

          {/* Right Info Column */}
          <div className="min-w-0 flex-1 pr-6">
            {/* Level, Tier & Region */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="shrink-0 rounded border border-white/10 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-slate-300 tabular-nums">
                Lv.{city.level} · {city.tier}
              </span>
              <span className="truncate text-[11px] font-medium text-slate-400">
                {city.regionName}
              </span>
            </div>

            {/* City Name - Fantasy Display Font */}
            <h2 className="font-display truncate text-base font-bold leading-tight tracking-wide text-white mt-1">
              {city.name}
            </h2>

            {/* Subtle Metadata Row */}
            <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
              <div className="flex items-center gap-1 text-slate-300">
                <Users className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="font-mono tabular-nums">{city.clans.length}/{city.maxClans} Klan</span>
              </div>
              <span className="text-slate-600">·</span>
              <div className="flex items-center gap-1.5 truncate">
                <span
                  className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                    city.boss && city.boss.currentHp > 0
                      ? 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.6)]'
                      : 'bg-emerald-500'
                  }`}
                />
                <span className="truncate text-slate-300">
                  Bos: {city.boss ? `${city.boss.tier} (${city.boss.currentHp > 0 ? 'Aktif' : 'Kalah'})` : 'Aman'}
                </span>
              </div>
            </div>

            {/* City EXP Progress Bar */}
            <div className="mt-1.5 space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-400 font-medium truncate">
                  EXP: <strong className="font-mono text-slate-200 font-bold">{city.totalExp.toLocaleString('id-ID')}</strong>
                </span>
                <span className="font-mono text-slate-500 tabular-nums shrink-0 ml-1">
                  +{remainingExp.toLocaleString('id-ID')} ke Lv.{city.level + 1}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full transition-all duration-300 bg-sky-400"
                  style={{ width: `${expPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Footer Row: Unified Clean Buttons */}
        <div className="grid grid-cols-3 gap-2 border-t border-white/[0.08] pt-2.5">
          {/* 1. Clan Capacity Indicator */}
          <div className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-1 text-xs font-semibold text-slate-300">
            <Users className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="font-mono tabular-nums">
              {city.clans.length}/{city.maxClans}
            </span>
            <span>Klan</span>
          </div>

          {/* 2. City Boss Quick Trigger */}
          {onSelectCityBoss ? (
            <button
              type="button"
              onClick={() => onSelectCityBoss(city)}
              className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-1 text-xs font-semibold text-slate-300 transition-all hover:bg-white/[0.08] hover:text-white active:scale-95"
            >
              <Flame className="h-3.5 w-3.5 shrink-0 text-rose-400" />
              <span className="truncate">Bos: {city.boss?.name || 'Penjaga'}</span>
            </button>
          ) : (
            <div className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-1 text-xs font-semibold text-slate-400">
              <Flame className="h-3.5 w-3.5 shrink-0 text-rose-400/80" />
              <span className="truncate">Bos: {city.boss?.name || 'Penjaga'}</span>
            </div>
          )}

          {/* 3. "Masuk Kota" Primary CTA Button */}
          <button
            type="button"
            onClick={() => onEnterCity(city)}
            className="flex h-9 items-center justify-center gap-1 rounded-xl bg-sky-600 px-2 text-xs font-bold text-white transition-all hover:bg-sky-500 active:scale-95 shadow-sm"
          >
            <span className="truncate">Masuk Kota</span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-sky-100" />
          </button>
        </div>
      </div>
    </div>
  );
};
