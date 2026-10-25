import React from 'react';
import { Clan, CityDistrict } from '../types/nuenime';
import { ClanEmblemIcon } from './icons/NuenimeAssets';
import { useNuenimeRpg } from '../context/NuenimeRpgContext';

export interface ClanStrongholdMarkerProps {
  clan: Clan;
  index?: number;
  totalClans?: number;
  districts?: CityDistrict[];
  isSelected: boolean;
  mapScale: number;
  onSelectClan: (clan: Clan) => void;
}

/**
 * Algoritma Penempatan Markas Klan Otomatis (Radial Orbit System)
 * Memastikan hingga 15 klan tersebar merata mengelilingi pusat kota,
 * tidak menumpuk di tengah (50, 50) dan tidak saling bertabrakan.
 */
export function getClanPositionOnMap(
  clan: Clan,
  index: number = 0,
  totalClans: number = 1,
  cityDistricts?: CityDistrict[]
): { x: number; y: number } {
  // 1. Jika klan memiliki distrik markas yang cocok dengan koordinat distrik kota
  if (cityDistricts && cityDistricts.length > 0) {
    const matchedDistrict = cityDistricts.find(
      (d) => d.name.toLowerCase() === (clan.strongholdDistrict || '').toLowerCase()
    );
    if (matchedDistrict && matchedDistrict.xPercent && matchedDistrict.yPercent) {
      const subAngle = (index * 137.5 * Math.PI) / 180;
      const subRadius = (index % 3) * 5 + 3;
      return {
        x: Math.round(Math.max(16, Math.min(84, matchedDistrict.xPercent + Math.cos(subAngle) * subRadius))),
        y: Math.round(Math.max(18, Math.min(82, matchedDistrict.yPercent + Math.sin(subAngle) * subRadius))),
      };
    }
  }

  // 2. Jika koordinat klan sudah diset secara khusus dan bukan di titik tengah mutlak (50, 50)
  if (
    clan.cityMapXPercent != null &&
    clan.cityMapYPercent != null &&
    !(clan.cityMapXPercent === 50 && clan.cityMapYPercent === 50)
  ) {
    return { x: clan.cityMapXPercent, y: clan.cityMapYPercent };
  }

  // 3. Sebaran Orbit Melingkar mengelilingi pusat kota (radius selang-seling 24% dan 32%)
  const count = Math.max(1, totalClans);
  const angle = (index * (2 * Math.PI)) / count - Math.PI / 2;
  const radius = 24 + (index % 2) * 8; // Selang-seling radius agar plakat tidak bertumpukan
  const x = Math.round(Math.max(16, Math.min(84, 50 + Math.cos(angle) * radius)));
  const y = Math.round(Math.max(20, Math.min(80, 48 + Math.sin(angle) * radius)));
  return { x, y };
}

/**
 * ClanStrongholdMarker dirender di atas Peta Kota dalam sistem koordinat radial terdistribusi.
 * Menggunakan plakat solid (#060c18) 2-baris yang ringkas dan presisi agar tidak saling menumpuk.
 */
export const ClanStrongholdMarker: React.FC<ClanStrongholdMarkerProps> = ({
  clan,
  index = 0,
  totalClans = 1,
  districts,
  isSelected,
  mapScale,
  onSelectClan,
}) => {
  const { joinedClanId, districtInfluence } = useNuenimeRpg();
  const inverseScale = Math.max(0.7, Math.min(1.1, 1 / Math.pow(mapScale, 0.42)));
  const isJoined = joinedClanId === clan.id;
  const influence = districtInfluence[clan.id]?.influencePercent ?? 0;
  const pos = getClanPositionOnMap(clan, index, totalClans, districts);

  return (
    <div
      style={{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        transform: `translate3d(-20px, -50%, 0) scale(${inverseScale})`,
        transformOrigin: '20px 50%',
      }}
      className={`absolute select-none ${isSelected ? 'z-20' : 'z-10'}`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSelectClan(clan);
        }}
        aria-label={`Pilih markas klan ${clan.name}`}
        className="group relative flex min-h-[42px] items-center focus:outline-none"
      >
        {/* Highlight pulse ring when clan is selected */}
        {isSelected && (
          <span
            className="animate-pulse-ring pointer-events-none absolute -left-1 h-11 w-11 rounded-full"
            style={{
              boxShadow: `0 0 18px 4px ${clan.accentColor}`,
              border: `1.5px solid #ffffff`,
            }}
          />
        )}

        {/* Clan Shield Emblem Badge */}
        <div
          className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#060c18] transition-transform duration-150 ${
            isSelected ? 'scale-105' : 'group-hover:scale-105 group-active:scale-95'
          }`}
          style={{
            filter: isSelected
              ? `drop-shadow(0 0 10px ${clan.accentColor}) drop-shadow(0 4px 8px rgba(0,0,0,0.92))`
              : 'drop-shadow(0 4px 7px rgba(0,0,0,0.92))',
          }}
        >
          <ClanEmblemIcon
            variant={clan.emblemVariant}
            accentColor={clan.accentColor}
            logoUrl={clan.logoUrl}
            size={40}
          />
        </div>

        {/* Compact Solid Dark Obsidian Plaque */}
        <div
          className={`relative -ml-2.5 flex flex-col justify-center py-1 pl-3.5 pr-3 text-left transition-all duration-150 ${
            isSelected ? 'bg-[#050a14] text-white' : 'bg-[#070e1c] text-slate-100'
          }`}
          style={{
            clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.9)',
            borderTop: `1.5px solid ${isSelected ? clan.accentColor : 'rgba(226, 232, 240, 0.42)'}`,
            borderBottom: `1.5px solid ${isSelected ? clan.accentColor : 'rgba(148, 163, 184, 0.34)'}`,
          }}
        >
          <div className="flex items-center gap-1">
            <span className="font-display text-[11px] leading-tight font-bold tracking-wide whitespace-nowrap">
              {clan.name}
            </span>
            {isJoined && (
              <span className="font-mono text-[8.5px] font-bold text-emerald-300">
                · AKTIF
              </span>
            )}
          </div>

          <div className="mt-0.5 flex items-center gap-1.5 text-[9.5px] leading-tight font-medium text-slate-300 whitespace-nowrap">
            <span className="font-mono font-bold text-amber-300 tabular-nums">
              {influence}%
            </span>
            <div className="h-1 w-12 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${influence}%`,
                  backgroundColor: clan.accentColor,
                }}
              />
            </div>
          </div>
        </div>
      </button>
    </div>
  );
};
