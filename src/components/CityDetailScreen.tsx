import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Users,
  Shield,
  BookOpen,
  Map as MapIcon,
  ChevronRight,
  Search,
  Compass,
  X,
  Swords,
  CheckCircle2,
  Award,
  Sun,
  Sunset,
  Moon,
  PlusCircle,
  Heart,
  Trophy,
  History,
  UserCheck,
  RotateCcw,
  RefreshCw,
  Sparkles,
  Package,
  ShieldCheck,
} from 'lucide-react';
import { WorldCity, Clan, TimeOfDayMode, ClanEmblemVariant } from '../types/nuenime';
import { CityEmblemBadge, ClanEmblemIcon, NuenimeCrystalIcon } from './icons/NuenimeAssets';
import { CityBossIllustration } from './icons/CityBossIllustrations';
import { CityMapImage } from './CityMapImage';
import { ClanStrongholdMarker, getClanPositionOnMap } from './ClanStrongholdMarker';
import { WorldMapControls } from './WorldMapControls';
import { useNuenimeRpg, CLAN_MISSIONS } from '../context/NuenimeRpgContext';
import { fantasySoundEngine } from '../utils/soundEngine';
import { ClanMenuLoadingScreen } from './ClanMenuLoadingScreen';
import { ClanCombatShopModal } from './ClanCombatShopModal';
import { EnemyBossRaidModal } from './EnemyBossRaidModal';

interface CityDetailScreenProps {
  city: WorldCity;
  initialTab?: 'map' | 'clans' | 'lore';
  onBackToMap: () => void;
  onSelectClan: (clan: Clan) => void;
  onOpenFullClanList: (city: WorldCity) => void;
}

const MIN_CITY_SCALE = 0.95;
const MAX_CITY_SCALE = 3.0;

const EMBLEM_VARIANTS: Array<{ id: ClanEmblemVariant; label: string }> = [
  { id: 'seraph-wings', label: 'Sayap Seraphim' },
  { id: 'frost-chalice', label: 'Cawan Es' },
  { id: 'crescent-tide', label: 'Sabit Samudra' },
  { id: 'abyssal-trident', label: 'Trisula Abyss' },
  { id: 'world-tree', label: 'Pohon Dunia' },
  { id: 'emerald-stag', label: 'Rusa Zamrud' },
  { id: 'solar-crown', label: 'Mahkota Surya' },
  { id: 'aegis-scales', label: 'Perisai Aegis' },
  { id: 'dragon-fang', label: 'Taring Naga' },
  { id: 'storm-hammer', label: 'Palu Badai' },
  { id: 'mirage-hourglass', label: 'Jam Pasir' },
  { id: 'astral-prism', label: 'Prisma Astral' },
];

export const CityDetailScreen: React.FC<CityDetailScreenProps> = ({
  city,
  initialTab = 'map',
  onBackToMap,
  onSelectClan,
  onOpenFullClanList,
}) => {
  const [activeTab, setActiveTab] = useState<'map' | 'clans' | 'lore'>(initialTab);
  const [isLoadingClanTab, setIsLoadingClanTab] = useState<boolean>(initialTab === 'clans');
  const [selectedClanOnMap, setSelectedClanOnMap] = useState<Clan | null>(
    () => city.clans[0] ?? null
  );
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (activeTab === 'clans') {
      setIsLoadingClanTab(true);
      fantasySoundEngine.playMarkerSelect();
      const timer = window.setTimeout(() => {
        setIsLoadingClanTab(false);
      }, 540);
      return () => window.clearTimeout(timer);
    }
  }, [activeTab, city.id]);

  // Create Clan Modal State
  const [isCreateClanOpen, setIsCreateClanOpen] = useState(false);
  const [newClanName, setNewClanName] = useState('');
  const [newClanTag, setNewClanTag] = useState('');
  const [newClanDesc, setNewClanDesc] = useState('');
  const [newClanDistrict, setNewClanDistrict] = useState('Distrik Benteng Utama');
  const [newClanSpec, setNewClanSpec] = useState(`Pertahanan & Komunitas ${city.element}`);
  const [newClanEmblem, setNewClanEmblem] = useState<ClanEmblemVariant>('solar-crown');
  const [newClanLogoUrl, setNewClanLogoUrl] = useState(
    'https://i.ibb.co.com/5h3d91xW/Black-and-White-Urban-Graffiti-Spray-Junior-Hype-Logo-2.png'
  );
  const [createClanError, setCreateClanError] = useState<string | null>(null);
  const [isSubmittingClan, setIsSubmittingClan] = useState(false);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [isRaidOpen, setIsRaidOpen] = useState(false);

  const {
    timeOfDay,
    setTimeOfDay,
    joinedClanId,
    getClanById,
    joinClan,
    districtInfluence,
    reinforceClanDistrict,
    completedMissionCounts,
    completeClanMission,
    getClanTotalScore,
    setAmbientLocation,
    activeAccount,
    getCityBoss,
    canCreateClanInCity,
    createClanInCity,
    userCrystals,
    getCityClansLeaderboard,
    attackWorldBoss,
    resetWorldBoss,
    expTransactions,
    playerContribution,
    syncRealAccountExp,
  } = useNuenimeRpg();

  const joinedClan = joinedClanId ? getClanById(joinedClanId) : undefined;
  const isHomeCity = Boolean(joinedClan && joinedClan.cityId === city.id);

  const [isSyncingExp, setIsSyncingExp] = useState(false);

  const handleSyncExp = async () => {
    if (isSyncingExp) return;
    setIsSyncingExp(true);
    await syncRealAccountExp();
    setIsSyncingExp(false);
  };

  // Switch ambient synthesizer to this city's elemental theme
  useEffect(() => {
    setAmbientLocation(city.id);
    return () => {
      setAmbientLocation('world');
    };
  }, [city.id, setAmbientLocation]);

  const cityBoss = city.boss || getCityBoss(city.id);

  // Interactive City Map Viewport State
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [vpSize, setVpSize] = useState<{ width: number; height: number }>({
    width: 412,
    height: 760,
  });

  const [cityTransform, setCityTransform] = useState<{
    scale: number;
    tx: number;
    ty: number;
    isAnimated: boolean;
  }>({
    scale: 1.0,
    tx: -200,
    ty: -60,
    isAnimated: false,
  });

  // Keep selectedClanOnMap synced with latest city state
  useEffect(() => {
    setSelectedClanOnMap((prev) => {
      if (!prev) return city.clans[0] ?? null;
      return city.clans.find((c) => c.id === prev.id) ?? city.clans[0] ?? null;
    });
  }, [city]);

  const clampCityTransform = useCallback(
    (tx: number, ty: number, scale: number, vpWidth: number, vpHeight: number) => {
      const baseHeight = Math.max(vpHeight * 1.15, 840);
      const baseWidth = baseHeight;
      const scaledW = baseWidth * scale;
      const scaledH = baseHeight * scale;

      const minTx = Math.min(0, vpWidth - scaledW);
      const maxTx = 0;
      const minTy = Math.min(0, vpHeight - scaledH);
      const maxTy = 0;

      return {
        tx: Math.max(minTx, Math.min(maxTx, tx)),
        ty: Math.max(minTy, Math.min(maxTy, ty)),
      };
    },
    []
  );

  const centerCityCamera = useCallback(
    (vpWidth: number, vpHeight: number) => {
      const baseHeight = Math.max(vpHeight * 1.15, 840);
      const baseWidth = baseHeight;
      const targetScale = 1.0;
      const focusX = baseWidth * 0.5;
      const focusY = baseHeight * 0.48;

      const rawTx = vpWidth / 2 - focusX * targetScale;
      const rawTy = vpHeight * 0.46 - focusY * targetScale;
      const clamped = clampCityTransform(rawTx, rawTy, targetScale, vpWidth, vpHeight);
      setCityTransform({
        scale: targetScale,
        tx: clamped.tx,
        ty: clamped.ty,
        isAnimated: true,
      });
    },
    [clampCityTransform]
  );

  const focusClanStronghold = useCallback(
    (clan: Clan, clanIndex: number = 0) => {
      const baseHeight = Math.max(vpSize.height * 1.15, 840);
      const baseWidth = baseHeight;
      const pos = getClanPositionOnMap(clan, clanIndex, city.clans.length, city.districts);
      setCityTransform((prev) => {
        const nextScale = Math.max(prev.scale, 1.15);
        const clanX = (pos.x / 100) * baseWidth;
        const clanY = (pos.y / 100) * baseHeight;
        const rawTx = vpSize.width * 0.5 - clanX * nextScale;
        const rawTy = vpSize.height * 0.43 - clanY * nextScale;
        const clamped = clampCityTransform(rawTx, rawTy, nextScale, vpSize.width, vpSize.height);
        return {
          scale: nextScale,
          tx: clamped.tx,
          ty: clamped.ty,
          isAnimated: true,
        };
      });
    },
    [clampCityTransform, city.clans.length, city.districts, vpSize.height, vpSize.width]
  );

  // Measure city map container
  useEffect(() => {
    const el = mapContainerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setVpSize({ width: rect.width, height: rect.height });
        centerCityCamera(rect.width, rect.height);
      }
    };
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, [activeTab, centerCityCamera]);

  // Pointer & Pinch Gestures for the City Map
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const dragOriginRef = useRef<{ x: number; y: number; startTx: number; startTy: number } | null>(
    null
  );
  const pinchStateRef = useRef<{
    initialDist: number;
    initialScale: number;
    initialTx: number;
    initialTy: number;
    midX: number;
    midY: number;
  } | null>(null);
  const movedDistanceRef = useRef<number>(0);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = mapContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    activePointersRef.current.set(e.pointerId, { x: localX, y: localY });

    if (activePointersRef.current.size === 1) {
      movedDistanceRef.current = 0;
      dragOriginRef.current = {
        x: localX,
        y: localY,
        startTx: cityTransform.tx,
        startTy: cityTransform.ty,
      };
      pinchStateRef.current = null;
    } else if (activePointersRef.current.size === 2) {
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      pinchStateRef.current = {
        initialDist: Math.max(dist, 20),
        initialScale: cityTransform.scale,
        initialTx: cityTransform.tx,
        initialTy: cityTransform.ty,
        midX,
        midY,
      };
      dragOriginRef.current = null;
      movedDistanceRef.current = 999;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activePointersRef.current.has(e.pointerId)) return;
    const rect = mapContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    activePointersRef.current.set(e.pointerId, { x: localX, y: localY });

    if (activePointersRef.current.size === 2 && pinchStateRef.current) {
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      const pinch = pinchStateRef.current;

      const rawScale = pinch.initialScale * (dist / pinch.initialDist);
      const nextScale = Math.max(MIN_CITY_SCALE, Math.min(MAX_CITY_SCALE, rawScale));
      const ratio = nextScale / pinch.initialScale;
      const rawTx = midX - (pinch.midX - pinch.initialTx) * ratio;
      const rawTy = midY - (pinch.midY - pinch.initialTy) * ratio;
      const clamped = clampCityTransform(rawTx, rawTy, nextScale, vpSize.width, vpSize.height);
      setCityTransform({
        scale: nextScale,
        tx: clamped.tx,
        ty: clamped.ty,
        isAnimated: false,
      });
    } else if (activePointersRef.current.size === 1 && dragOriginRef.current) {
      const dx = localX - dragOriginRef.current.x;
      const dy = localY - dragOriginRef.current.y;
      const dist = Math.hypot(dx, dy);
      movedDistanceRef.current = Math.max(movedDistanceRef.current, dist);

      if (movedDistanceRef.current >= 3) {
        const rawTx = dragOriginRef.current.startTx + dx;
        const rawTy = dragOriginRef.current.startTy + dy;
        const clamped = clampCityTransform(
          rawTx,
          rawTy,
          cityTransform.scale,
          vpSize.width,
          vpSize.height
        );
        setCityTransform((prev) => ({
          ...prev,
          tx: clamped.tx,
          ty: clamped.ty,
          isAnimated: false,
        }));
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(e.pointerId);
    if (activePointersRef.current.size === 1) {
      const rem = Array.from(activePointersRef.current.values())[0];
      dragOriginRef.current = {
        x: rem.x,
        y: rem.y,
        startTx: cityTransform.tx,
        startTy: cityTransform.ty,
      };
      pinchStateRef.current = null;
    } else if (activePointersRef.current.size === 0) {
      dragOriginRef.current = null;
      pinchStateRef.current = null;
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = mapContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.14 : 0.88;

    setCityTransform((prev) => {
      const nextScale = Math.max(MIN_CITY_SCALE, Math.min(MAX_CITY_SCALE, prev.scale * factor));
      const ratio = nextScale / prev.scale;
      const rawTx = cx - (cx - prev.tx) * ratio;
      const rawTy = cy - (cy - prev.ty) * ratio;
      const clamped = clampCityTransform(rawTx, rawTy, nextScale, vpSize.width, vpSize.height);
      return {
        scale: nextScale,
        tx: clamped.tx,
        ty: clamped.ty,
        isAnimated: false,
      };
    });
  };

  const handlePanBy = (dx: number, dy: number) => {
    setCityTransform((prev) => {
      const clamped = clampCityTransform(
        prev.tx + dx,
        prev.ty + dy,
        prev.scale,
        vpSize.width,
        vpSize.height
      );
      return { ...prev, tx: clamped.tx, ty: clamped.ty, isAnimated: true };
    });
  };

  const handleZoomStep = (factor: number) => {
    setCityTransform((prev) => {
      const nextScale = Math.max(MIN_CITY_SCALE, Math.min(MAX_CITY_SCALE, prev.scale * factor));
      const cx = vpSize.width / 2;
      const cy = vpSize.height / 2;
      const ratio = nextScale / prev.scale;
      const rawTx = cx - (cx - prev.tx) * ratio;
      const rawTy = cy - (cy - prev.ty) * ratio;
      const clamped = clampCityTransform(rawTx, rawTy, nextScale, vpSize.width, vpSize.height);
      return {
        scale: nextScale,
        tx: clamped.tx,
        ty: clamped.ty,
        isAnimated: true,
      };
    });
  };

  const cycleTimeOfDay = () => {
    const next: Record<TimeOfDayMode, TimeOfDayMode> = {
      day: 'dusk',
      dusk: 'night',
      night: 'day',
    };
    setTimeOfDay(next[timeOfDay]);
  };

  const sortedCityClans = getCityClansLeaderboard(city.id);

  const filteredClans = sortedCityClans.filter((clan) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      clan.name.toLowerCase().includes(q) ||
      clan.leaderName.toLowerCase().includes(q) ||
      clan.specialization.toLowerCase().includes(q) ||
      clan.tag.toLowerCase().includes(q)
    );
  });

  const cityMissions = CLAN_MISSIONS;
  const cityBaseHeight = Math.max(vpSize.height * 1.15, 840);
  const cityBaseWidth = cityBaseHeight;

  const selectedInfluence = selectedClanOnMap
    ? districtInfluence[selectedClanOnMap.id]?.influencePercent ?? 68
    : 68;

  const createPermission = canCreateClanInCity(city.id);
  const expPercent = Math.min(
    100,
    Math.round((city.currentLevelExp / Math.max(1, city.nextLevelTargetExp)) * 100)
  );
  const remainingExp = Math.max(0, city.nextLevelTargetExp - city.currentLevelExp);
  const cityExpLogs = expTransactions.filter((tx) => tx.cityId === city.id).slice(0, 12);

  const handleCreateClanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingClan) return;
    setCreateClanError(null);

    if (userCrystals < 2000) {
      setCreateClanError(
        `Crystal tidak mencukupi! Anda butuh 2.000 Crystal untuk mendirikan klan (Saldo Anda: ${userCrystals.toLocaleString('id-ID')}).`
      );
      return;
    }

    setIsSubmittingClan(true);

    const requestKey = `create-${city.id}-${newClanName.trim().toLowerCase()}-${Math.floor(Date.now() / 2000)}`;
    const result = await createClanInCity(
      {
        cityId: city.id,
        name: newClanName,
        tag: newClanTag || newClanName.slice(0, 3).toUpperCase(),
        description: newClanDesc,
        motto: `Demi kehormatan Kota ${city.name}!`,
        strongholdDistrict: newClanDistrict,
        specialization: newClanSpec,
        emblemVariant: newClanEmblem,
        logoUrl: newClanLogoUrl.trim() || undefined,
        accentColor: city.accentHex,
      },
      requestKey
    );

    setIsSubmittingClan(false);

    if (!result.ok) {
      setCreateClanError(result.message ?? 'Gagal membuat klan.');
      return;
    }

    setNewClanName('');
    setNewClanTag('');
    setNewClanDesc('');
    setNewClanLogoUrl('');
    setIsCreateClanOpen(false);
    if (result.createdClan) {
      setSelectedClanOnMap(result.createdClan);
    }
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#070d19] text-slate-100">
      {/* Top Dark Glass City Header & Mode Switcher */}
      <div className="z-30 border-b border-slate-800/80 bg-slate-950/95 px-2.5 pt-2.5 pb-2 backdrop-blur-md">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBackToMap}
            className="flex min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-700/80 bg-slate-900/85 px-2.5 py-1.5 text-xs font-semibold text-slate-100 transition-colors hover:border-sky-400/50 active:scale-95 whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="h-4 w-4 text-sky-300" />
            <span>Peta Dunia</span>
          </button>

          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={cycleTimeOfDay}
              title="Ubah Siklus Waktu Peta Kota"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900 text-slate-200 hover:border-sky-400/50"
            >
              {timeOfDay === 'day' && <Sun className="h-4 w-4 text-amber-300" />}
              {timeOfDay === 'dusk' && <Sunset className="h-4 w-4 text-orange-300" />}
              {timeOfDay === 'night' && <Moon className="h-4 w-4 text-purple-300" />}
            </button>
            <CityEmblemBadge cityId={city.id} material={city.material} size={32} selected />
            <div className="min-w-0 text-right">
              <div className="flex items-center justify-end gap-1.5">
                <span className="rounded border border-sky-400/50 bg-sky-950 px-1.5 py-0.2 font-mono text-[9.5px] font-bold text-sky-200">
                  Lv.{city.level} · {city.tier}
                </span>
                <h1 className="font-display truncate text-sm font-bold text-white">
                  {city.name}
                </h1>
              </div>
              <p className="truncate font-mono text-[10px] text-sky-300 tabular-nums">
                Wilayah {city.name} · {city.totalExp.toLocaleString('id-ID')} Total EXP
              </p>
            </div>
          </div>
        </div>

        {/* 3-Tab Mode Bar: Peta Kota | Klan, Bos & Misi | Lore & Riwayat */}
        <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl border border-slate-800 bg-slate-900/95 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('map')}
            className={`flex h-[34px] items-center justify-center gap-1 rounded-lg px-2 text-[11px] font-semibold transition-all ${
              activeTab === 'map'
                ? 'border border-sky-400/60 bg-sky-950 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MapIcon className="h-3.5 w-3.5 shrink-0 text-sky-300" />
            <span className="truncate">Peta Kota</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('clans')}
            className={`flex h-[34px] items-center justify-center gap-1 rounded-lg px-2 text-[11px] font-semibold transition-all ${
              activeTab === 'clans'
                ? 'border border-sky-400/60 bg-sky-950 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="h-3.5 w-3.5 shrink-0 text-amber-300" />
            <span className="truncate">
              Klan ({city.clans.length}/{city.maxClans})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('lore')}
            className={`flex h-[34px] items-center justify-center gap-1 rounded-lg px-2 text-[11px] font-semibold transition-all ${
              activeTab === 'lore'
                ? 'border border-sky-400/60 bg-sky-950 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
            <span className="truncate">Lore & EXP</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          MODE 1: PETA KOTA INTERAKTIF (DENGAN MARKER MARKAS KLAN & PEREBUTAN DISTRIK)
         ===================================================================== */}
      {activeTab === 'map' && (
        <div className="relative flex-1 overflow-hidden">
          <div
            ref={mapContainerRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
            onClick={() => {
              if (movedDistanceRef.current < 6 && selectedClanOnMap) {
                setSelectedClanOnMap(null);
              }
            }}
            className="relative h-full w-full cursor-grab overflow-hidden touch-none active:cursor-grabbing"
          >
            {/* Unified City Coordinate Container */}
            <div
              style={{
                width: `${cityBaseWidth}px`,
                height: `${cityBaseHeight}px`,
                transformOrigin: '0 0',
                transform: `translate3d(${cityTransform.tx}px, ${cityTransform.ty}px, 0) scale(${cityTransform.scale})`,
                transition: cityTransform.isAnimated
                  ? 'transform 320ms cubic-bezier(0.16, 1, 0.3, 1)'
                  : 'none',
                willChange: 'transform',
              }}
              className="relative select-none"
            >
              <CityMapImage city={city} />

              {/* Render All Clan Stronghold Markers inside this City */}
              {city.clans.map((clan, idx) => (
                <ClanStrongholdMarker
                  key={clan.id}
                  clan={clan}
                  index={idx}
                  totalClans={city.clans.length}
                  districts={city.districts}
                  isSelected={selectedClanOnMap?.id === clan.id}
                  mapScale={cityTransform.scale}
                  onSelectClan={(c) => {
                    if (movedDistanceRef.current >= 6) return;
                    fantasySoundEngine.playMarkerSelect();
                    setSelectedClanOnMap(c);
                    focusClanStronghold(c, idx);
                  }}
                />
              ))}
            </div>

            <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-slate-950/40" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-slate-950/60" />
          </div>

          {/* Floating Clan Quick-Select Bar at Top of City Map */}
          <div className="pointer-events-auto absolute top-2.5 left-2.5 right-2.5 z-20 flex items-center gap-1.5 overflow-x-auto pb-1 nuenime-scroll">
            {city.clans.map((clan, idx) => {
              const active = selectedClanOnMap?.id === clan.id;
              const isJoined = joinedClanId === clan.id;
              return (
                <button
                  key={clan.id}
                  type="button"
                  onClick={() => {
                    fantasySoundEngine.playMarkerSelect();
                    setSelectedClanOnMap(clan);
                    focusClanStronghold(clan, idx);
                  }}
                  className={`flex min-h-[32px] items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold backdrop-blur-md transition-all whitespace-nowrap shrink-0 ${
                    active
                      ? 'border-sky-300 bg-slate-950/90 text-white shadow-[0_0_12px_rgba(56,189,248,0.35)]'
                      : 'border-slate-500/35 bg-slate-950/75 text-slate-300 hover:text-white'
                  }`}
                >
                  <ClanEmblemIcon
                    variant={clan.emblemVariant}
                    accentColor={clan.accentColor}
                    logoUrl={clan.logoUrl}
                    size={16}
                  />
                  <span>{clan.name}</span>
                  {isJoined && <span className="text-[9.5px] text-emerald-300">· Klanmu</span>}
                </button>
              );
            })}
          </div>

          {/* City Map D-Pad, Zoom +/-, & Recenter Controls */}
          <WorldMapControls
            onPanBy={handlePanBy}
            onZoomIn={() => handleZoomStep(1.24)}
            onZoomOut={() => handleZoomStep(0.8)}
            onResetCenter={() => centerCityCamera(vpSize.width, vpSize.height)}
            scale={cityTransform.scale}
            minScale={MIN_CITY_SCALE}
            maxScale={MAX_CITY_SCALE}
            hasActiveCityPanel={!!selectedClanOnMap}
          />

          {/* Bottom Solid Dark Obsidian Selected Clan & District Conquest Panel */}
          {selectedClanOnMap && (
            <div
              className="pointer-events-auto absolute bottom-2.5 left-2.5 right-2.5 z-30 transition-all duration-200"
              role="region"
              aria-label={`Informasi Klan ${selectedClanOnMap.name}`}
            >
              <div className="relative rounded-2xl border border-slate-400/40 bg-[#070e1b]/98 p-3 shadow-[0_12px_34px_rgba(0,0,0,0.92)] backdrop-blur-xl">
                <button
                  type="button"
                  onClick={() => setSelectedClanOnMap(null)}
                  aria-label="Tutup panel klan"
                  className="absolute top-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-full border border-slate-700/70 bg-slate-900/90 text-slate-300 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>

                <div className="flex items-center gap-3 pr-7">
                  <div
                    className="relative flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-full border-2 bg-slate-950 shadow-lg"
                    style={{ borderColor: selectedClanOnMap.accentColor }}
                  >
                    <ClanEmblemIcon
                      variant={selectedClanOnMap.emblemVariant}
                      accentColor={selectedClanOnMap.accentColor}
                      logoUrl={selectedClanOnMap.logoUrl}
                      size={selectedClanOnMap.logoUrl ? 54 : 44}
                    />
                    <span className="absolute -bottom-1.5 rounded-md border border-slate-600 bg-slate-950 px-1.5 py-0.5 font-mono text-[9px] font-bold text-sky-200">
                      [{selectedClanOnMap.tag}]
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-sky-300 truncate">
                      <span className="truncate">{selectedClanOnMap.strongholdDistrict}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono text-amber-300 tabular-nums shrink-0">
                        {selectedClanOnMap.totalExp.toLocaleString('id-ID')} EXP
                      </span>
                    </div>
                    <h2 className="font-display truncate text-sm font-bold text-white">
                      {selectedClanOnMap.name}
                    </h2>
                    <p className="mt-0.5 text-[10.5px] text-slate-300">
                      Anggota: {selectedClanOnMap.memberCount}/{selectedClanOnMap.maxMembers} · Kendali Distrik {selectedInfluence}%
                    </p>

                    {/* District Control Progress Bar */}
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full transition-all duration-300"
                        style={{
                          width: `${selectedInfluence}%`,
                          backgroundColor: selectedClanOnMap.accentColor,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Precision 3-Column Action Row: Perkuat Distrik | Gabung Klan | Detail Klan */}
                <div className="mt-2.5 grid grid-cols-3 gap-1.5 border-t border-slate-800/90 pt-2">
                  <div
                    title={`Kendali ${selectedClanOnMap.name} atas distrik dihitung otomatis dari kontribusi EXP nyata di APK.`}
                    className="flex h-[34px] items-center justify-center gap-1 rounded-xl border border-amber-400/50 bg-[#241705] px-2 text-[10.5px] font-semibold text-amber-200"
                  >
                    <Shield className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                    <span className="truncate">Kendali {selectedInfluence}%</span>
                  </div>

                  {joinedClanId !== selectedClanOnMap.id ? (
                    <button
                      type="button"
                      onClick={() => joinClan(selectedClanOnMap.id)}
                      className="flex h-[34px] items-center justify-center gap-1 rounded-xl border border-emerald-400/50 bg-emerald-500/15 px-2 text-[10.5px] font-semibold text-emerald-200 hover:bg-emerald-500/25 active:scale-95"
                    >
                      <span className="truncate">Gabung Klan</span>
                    </button>
                  ) : (
                    <div className="flex h-[34px] items-center justify-center gap-1 rounded-xl border border-emerald-500/40 bg-emerald-950/50 px-2 text-[10.5px] font-semibold text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">Klan Aktif</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => onSelectClan(selectedClanOnMap)}
                    className="flex h-[34px] items-center justify-center gap-1 rounded-xl border border-sky-400/50 bg-[#0c1f38] hover:bg-[#132c4d] px-2 text-[10.5px] font-bold text-white shadow-sm active:scale-95"
                  >
                    <span className="truncate">Detail Klan</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-sky-200" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          MODE 2: PEMIMPIN KOTA, BUAT KLAN (MAKS 15), BOS KOTA, MISI SIMULASI & LEADERBOARD KLAN KOTA
         ===================================================================== */}
      {activeTab === 'clans' &&
        (isLoadingClanTab ? (
          <ClanMenuLoadingScreen
            compact
            title={`Memuat Aula Klan Kota ${city.name}`}
            subtitle={`Kapasitas ${city.clans.length}/${city.maxClans} Klan · Wilayah Terbuka Komunitas`}
            accentColor={city.accentHex}
          />
        ) : (
        <div className="nuenime-scroll flex-1 space-y-3.5 overflow-y-auto px-3.5 py-3.5">
          {/* Card 1: Status Progres Kota & Pembuatan Klan (Biaya 2.000 Crystal, Bebas Masuk) */}
          <div className="rounded-2xl border border-sky-400/35 bg-slate-900/85 p-3.5 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[10px] sm:text-[10.5px] font-semibold text-sky-300">
                  <span className="truncate">Kota Komunitas</span>
                  <span>·</span>
                  <span className="font-mono text-amber-300 shrink-0">
                    Lv.{city.level} ({city.tier})
                  </span>
                </div>
                <div className="mt-0.5 min-w-0">
                  <h2 className="font-display text-sm sm:text-base font-bold text-white tracking-wide truncate">
                    KOTA {city.name.toUpperCase()}
                  </h2>
                  <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                    {city.epithet}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className="rounded-md border border-amber-500/50 bg-[#1f1505] px-2 py-0.5 font-mono text-[10px] font-bold text-amber-300 shrink-0">
                  {city.clans.length}/{city.maxClans} Klan
                </span>
                <div
                  title={`Saldo Crystal: ${userCrystals.toLocaleString('id-ID')}`}
                  className="flex items-center gap-1.5 rounded-md border border-sky-500/40 bg-[#0c1f38] px-2 py-0.5 font-mono text-[10.5px] font-bold text-sky-200 shrink-0 shadow-sm"
                >
                  <NuenimeCrystalIcon size={13} />
                  <span className="tabular-nums">{userCrystals.toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>

            {/* City Level & EXP Bar Presisi Mobile (Stacked Vertikal Anti-Tabrakan) */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col justify-center rounded-xl border border-sky-500/35 bg-[#0a1829] p-2 sm:p-2.5 min-w-0">
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-300 truncate">
                  <Shield className="h-3 w-3 shrink-0" />
                  <span>Tingkat Wilayah</span>
                </span>
                <span className="font-mono text-xs sm:text-sm font-bold text-white tabular-nums mt-0.5 truncate">
                  Lv.{city.level} · {city.tier}
                </span>
              </div>

              <div className="flex flex-col justify-center rounded-xl border border-emerald-500/35 bg-[#092215] p-2 sm:p-2.5 min-w-0">
                <span className="text-[10px] font-semibold text-emerald-300 truncate">
                  Total EXP Wilayah
                </span>
                <span className="font-mono text-xs sm:text-sm font-bold text-emerald-300 tabular-nums mt-0.5 truncate">
                  {city.totalExp.toLocaleString('id-ID')} EXP
                </span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-[10.5px] text-slate-300">
                <span>
                  EXP Level {city.level}: {city.currentLevelExp.toLocaleString('id-ID')} /{' '}
                  {city.nextLevelTargetExp.toLocaleString('id-ID')}
                </span>
                <span className="font-mono text-sky-300 tabular-nums">
                  +{remainingExp.toLocaleString('id-ID')} EXP ke Lv.{city.level + 1}
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full transition-all duration-300"
                  style={{ width: `${expPercent}%`, backgroundColor: city.accentHex }}
                />
              </div>
            </div>

            {/* Create Clan Action / Crystal Fee Notice Solid Color */}
            <div className="border-t border-slate-800 pt-2.5">
              {createPermission.allowed ? (
                <button
                  type="button"
                  onClick={() => {
                    setCreateClanError(null);
                    setIsCreateClanOpen(true);
                  }}
                  className="flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-400 bg-[#059669] hover:bg-[#047857] px-3 py-2 text-xs font-bold text-white shadow-md transition-all active:scale-95"
                >
                  <PlusCircle className="h-4 w-4 shrink-0" />
                  <span className="inline-flex items-center gap-1">
                    <span>Buat Klan Baru di {city.name} (Biaya: 2.000</span>
                    <NuenimeCrystalIcon size={14} className="inline-block" />
                    <span>)</span>
                  </span>
                </button>
              ) : (
                <div className="flex flex-col gap-1.5 rounded-xl border border-rose-500/40 bg-[#160a0f] p-2.5 text-[11px]">
                  <div className="text-slate-300 leading-snug">{createPermission.reason}</div>
                  <div className="flex items-center justify-between text-[10.5px] text-slate-400 pt-1 border-t border-rose-900/40">
                    <span>Saldo Crystal Anda:</span>
                    <span className="font-mono font-bold text-amber-300 inline-flex items-center gap-1">
                      <span>{userCrystals.toLocaleString('id-ID')}</span>
                      <NuenimeCrystalIcon size={12} />
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Bos Penjaga Kota Unik (Presisi Mobile & Solid Color Tanpa Gradasi) */}
          <div className="rounded-2xl border border-rose-500/35 bg-[#140810]/95 p-3 sm:p-3.5 space-y-2.5">
            {/* Baris Atas: Avatar Bos & Info Lengkap Bos */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-full border bg-slate-950 shadow-sm"
                style={{ borderColor: cityBoss.accentColor }}
              >
                <CityBossIllustration cityId={city.id} size={38} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[9.5px] font-semibold">
                  <span className="rounded bg-rose-950 px-1.5 py-0.5 font-mono text-rose-200 border border-rose-400/40 shrink-0">
                    Bos Kota · Lv.{cityBoss.level} ({cityBoss.tier})
                  </span>
                  <span className="text-emerald-400 font-bold shrink-0">
                    {cityBoss.currentHp > 0 ? 'Aktif' : 'Kalah'}
                  </span>
                </div>
                <h3 className="font-display truncate text-xs sm:text-sm font-bold text-white mt-0.5">
                  {cityBoss.name} — {cityBoss.title}
                </h3>
                <div className="font-mono text-[10px] text-rose-300 tabular-nums">
                  HP Bos: {cityBoss.currentHp.toLocaleString('id-ID')} /{' '}
                  {cityBoss.maxHp.toLocaleString('id-ID')} HP
                </div>
              </div>
            </div>

            {/* Baris Tengah: Progres Bar HP Bos */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-900 border border-slate-800">
              <div
                className="h-full bg-[#a855f7] transition-all duration-300"
                style={{
                  width: `${Math.max(0, Math.min(100, (cityBoss.currentHp / (cityBoss.maxHp || 1)) * 100))}%`,
                }}
              />
            </div>

            {/* Baris Bawah: Tombol Aksi Simetris 2 Kolom (100% Bebas Tabrakan & Nyaman untuk Jari Mobile) */}
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => setIsShopOpen(true)}
                title="Buka Toko & Gudang Senjata Klan"
                className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-amber-500/40 bg-[#241705] hover:bg-[#382307] px-2 text-[11px] font-bold text-amber-300 transition-all active:scale-95"
              >
                <Package className="h-3.5 w-3.5 text-amber-300 shrink-0" />
                <span>Gudang</span>
              </button>

              {isHomeCity ? (
                <div
                  title={`Bos ${cityBoss.name} adalah Penjaga Kota ${city.name} tempat klan Anda bermarkas.`}
                  className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-[#092215] px-2 text-[11px] font-bold text-emerald-300 shadow-sm"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span>Pelindung</span>
                </div>
              ) : cityBoss.currentHp > 0 ? (
                <button
                  type="button"
                  onClick={() => setIsRaidOpen(true)}
                  title="Serang Bos Kota Musuh"
                  className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-rose-500 bg-[#e11d48] hover:bg-[#be123c] px-2 text-[11px] font-bold text-white shadow-md shadow-rose-950/50 transition-all active:scale-95"
                >
                  <Swords className="h-3.5 w-3.5 shrink-0" />
                  <span>Serang Bos</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => resetWorldBoss(cityBoss.id)}
                  title="Bangkitkan Bos Kota"
                  className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-sky-400/50 bg-[#0c1f38] hover:bg-[#132c4d] px-2 text-[11px] font-bold text-sky-200 active:scale-95"
                >
                  <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Card 3: Alur Perolehan EXP Nyata Terintegrasi Nuenime APK */}
          <div className="rounded-2xl border border-emerald-500/40 bg-slate-900/90 p-3.5 space-y-3 shadow-lg">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-display text-xs font-bold text-emerald-300">
                    Alur Perolehan EXP Nyata ({city.name})
                  </h3>
                  <span className="rounded border border-emerald-500/60 bg-emerald-950/90 px-1.5 py-0.2 font-mono text-[9px] font-bold text-emerald-300 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    REALTIME APK
                  </span>
                </div>
                <p className="text-[10.5px] text-slate-400 mt-0.5">
                  EXP diperoleh otomatis dari menonton anime di aplikasi Nuenime → Memperkuat Klan → Menaikkan Level & Tier {city.name}
                </p>
              </div>
            </div>

            {/* Banner Sinkronisasi EXP Akun Real (Responsif Mobile) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3">
              <div className="min-w-0">
                <div className="text-[10px] text-emerald-300 font-semibold uppercase tracking-wider">
                  Kontribusi EXP Akun Anda
                </div>
                <div className="font-mono text-base font-bold text-white mt-0.5 tabular-nums">
                  {playerContribution.toLocaleString('id-ID')} <span className="text-xs font-normal text-emerald-300">EXP Terkumpul</span>
                </div>
                <div className="text-[10px] text-slate-400">
                  Tersinkronisasi otomatis dengan profil akun Nuenime
                </div>
              </div>

              <button
                type="button"
                onClick={handleSyncExp}
                disabled={isSyncingExp}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-400/60 bg-emerald-600/30 px-3 py-2 text-xs font-bold text-emerald-100 hover:bg-emerald-600/50 active:scale-95 transition-all shrink-0 disabled:opacity-50 w-full sm:w-auto"
              >
                <RefreshCw className={`h-3.5 w-3.5 text-emerald-300 ${isSyncingExp ? 'animate-spin' : ''}`} />
                <span>{isSyncingExp ? 'Sinkron...' : 'Sinkronkan EXP'}</span>
              </button>
            </div>

            {/* Daftar Aturan EXP Nyata dari APK */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-slate-300">
                <span>Aktivitas Perolehan EXP di Aplikasi Nuenime:</span>
              </div>

              {cityMissions.map((msn) => (
                <div
                  key={msn.id}
                  className="flex items-center justify-between gap-2.5 rounded-xl border border-slate-800 bg-slate-950/80 p-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-sky-300">
                      <span className="rounded bg-emerald-950/80 border border-emerald-500/40 px-1.5 py-0.2 font-mono text-[9px] text-emerald-300">
                        Aktivitas APK
                      </span>
                      <span>{msn.categoryLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-slate-400">{msn.difficulty}</span>
                    </div>
                    <div className="font-display text-xs font-bold text-white truncate mt-0.5">
                      {msn.title}
                    </div>
                    <p className="mt-0.5 text-[10.5px] text-slate-400 line-clamp-1">
                      {msn.description}
                    </p>
                  </div>

                  <div className="flex flex-col items-end justify-center rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-3 py-1.5 text-right shrink-0">
                    <span className="font-mono text-xs font-bold text-emerald-300 tabular-nums">
                      +{msn.rewardExp} EXP
                    </span>
                    <span className="text-[9.5px] text-slate-400">
                      Otomatis via APK
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Search & Leaderboard Header */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Cari klan di leaderboard ${city.name}...`}
                className="h-10 w-full rounded-xl border border-slate-800 bg-slate-900/85 pl-9 pr-3 text-xs text-slate-100 placeholder-slate-500 focus:border-sky-400/60 focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() => onOpenFullClanList(city)}
              className="flex h-10 items-center gap-1 rounded-xl border border-slate-700/80 bg-slate-900/80 px-3 text-xs font-medium text-sky-300 hover:border-sky-400/50 whitespace-nowrap shrink-0"
            >
              <Trophy className="h-3.5 w-3.5 text-amber-300" />
              <span>Global</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Leaderboard Klan Dalam Kota */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <span>
                Leaderboard Klan Kota {city.name} ({filteredClans.length}/{city.maxClans})
              </span>
              <span className="text-[10.5px] text-slate-400">Urut berdasarkan Total EXP</span>
            </div>

            {filteredClans.map((clan, index) => {
              const rank = index + 1;
              const isJoined = joinedClanId === clan.id;
              const totalScore = getClanTotalScore(clan.id);
              const influence = districtInfluence[clan.id]?.influencePercent ?? 68;

              return (
                <div
                  key={clan.id}
                  className={`flex flex-col gap-2.5 rounded-2xl border p-3 ${
                    isJoined
                      ? 'border-emerald-400/50 bg-slate-900/90'
                      : 'border-slate-800/90 bg-slate-900/75'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold tabular-nums ${
                        rank === 1
                          ? 'border border-amber-400/60 bg-amber-500/25 text-amber-200'
                          : rank === 2
                          ? 'border border-slate-300/50 bg-slate-400/20 text-slate-100'
                          : rank === 3
                          ? 'border border-orange-400/50 bg-orange-500/20 text-orange-200'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      #{rank}
                    </div>

                    <ClanEmblemIcon
                      variant={clan.emblemVariant}
                      accentColor={clan.accentColor}
                      logoUrl={clan.logoUrl}
                      size={44}
                      className="shrink-0"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-display truncate text-sm font-bold text-white">
                          {clan.name}{' '}
                          <span className="font-mono text-[10.5px] text-sky-300">[{clan.tag}]</span>
                        </h3>
                        <span className="font-mono text-[11.5px] font-bold text-amber-300 tabular-nums shrink-0">
                          {totalScore.toLocaleString('id-ID')} EXP
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-300">
                        Pemimpin: {clan.leaderName} · Anggota: {clan.memberCount}/{clan.maxMembers}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-slate-800/80 pt-2 text-[11px] text-slate-400">
                    <div className="truncate">
                      <span className="text-slate-200 font-medium">{clan.strongholdDistrict}</span>
                      <span className="font-mono text-sky-300 tabular-nums">
                        {' '}
                        · Kendali {influence}%
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 sm:flex sm:items-center sm:gap-1.5 shrink-0">
                      {!isJoined ? (
                        <button
                          type="button"
                          onClick={() => joinClan(clan.id)}
                          className="flex items-center justify-center rounded-lg border border-emerald-400/50 bg-emerald-500/15 px-2 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/25 active:scale-95"
                        >
                          Gabung
                        </button>
                      ) : (
                        <div className="flex items-center justify-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-2 py-1 text-[11px] font-semibold text-emerald-300">
                          <Award className="h-3 w-3 shrink-0" />
                          <span>Klanmu</span>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedClanOnMap(clan);
                          setActiveTab('map');
                          setTimeout(() => focusClanStronghold(clan), 50);
                        }}
                        className="flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800/90 px-2 py-1 text-[11px] font-medium text-sky-300 hover:border-sky-400/50 active:scale-95"
                      >
                        Peta
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectClan(clan)}
                        className="flex items-center justify-center rounded-lg border border-sky-400/50 bg-[#0c1f38] hover:bg-[#132c4d] px-2 py-1 text-[11px] font-semibold text-white active:scale-95"
                      >
                        Detail
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredClans.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 px-4 py-8 text-center">
                <Shield className="h-10 w-10 text-slate-600 mb-2" />
                <p className="text-xs font-semibold text-slate-300">Belum Ada Klan di Kota {city.name}</p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
                  Seluruh klan di kota ini berasal dari hasil pembuatan klan oleh para petualang. Jadilah pendiri klan pertama!
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCreateClanError(null);
                    setIsCreateClanOpen(true);
                  }}
                  className="mt-3.5 inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/50 bg-emerald-700/80 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-600 active:scale-95 transition-all shadow-md"
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>Dirikan Klan Pertama di {city.name}</span>
                </button>
              </div>
            )}
          </div>
        </div>
        ))}

      {/* =====================================================================
          MODE 3: LORE KOTA, RIWAYAT LEVEL & BUKU BESAR TRANSAKSI EXP
         ===================================================================== */}
      {activeTab === 'lore' && (
        <div className="nuenime-scroll flex-1 space-y-3.5 overflow-y-auto px-3.5 py-3.5">
          <div className="relative h-40 w-full overflow-hidden rounded-2xl border border-slate-800">
            <img
              src={city.thumbnailAsset}
              alt={`Ilustrasi ${city.name}`}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-transparent" />
            <div className="absolute bottom-3 left-3.5 right-3.5">
              <div className="text-[11px] font-medium text-sky-300">
                {city.regionName} · Level {city.level} ({city.tier})
              </div>
              <h2 className="font-display text-xl font-bold text-white">{city.name}</h2>
              <p className="text-xs text-slate-300">{city.epithet}</p>
            </div>
          </div>

          {/* Riwayat Kenaikan Level & Tier Kota */}
          <div className="rounded-2xl border border-slate-800/90 bg-slate-900/80 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-amber-300" />
                <h3 className="font-display text-sm font-bold text-white">
                  Riwayat Progres Level & Tier {city.name}
                </h3>
              </div>
              <span className="font-mono text-[11px] text-sky-300">
                {city.levelHistory.length} Catatan
              </span>
            </div>

            {city.levelHistory.length === 0 ? (
              <p className="text-xs text-slate-400">
                Kota {city.name} saat ini berada di Level 1 ({city.tier}). Jalankan misi simulasi klan untuk menaikkan level dan tier kota!
              </p>
            ) : (
              <div className="space-y-2">
                {city.levelHistory.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs"
                  >
                    <div>
                      <div className="font-bold text-amber-300">
                        Naik dari Lv.{item.previousLevel} ke Lv.{item.newLevel} ({item.newTier})
                      </div>
                      <div className="text-[10.5px] text-slate-400">
                        Total EXP Kota: {item.totalExpAtUpgrade.toLocaleString('id-ID')} EXP
                      </div>
                    </div>
                    <span className="font-mono text-[10px] text-slate-400">
                      {new Date(item.timestamp).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Buku Besar Transaksi EXP Kota */}
          <div className="rounded-2xl border border-slate-800/90 bg-slate-900/80 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-white">
                Buku Besar Kontribusi EXP Kota
              </h3>
              <span className="rounded bg-amber-950/90 px-2 py-0.5 font-mono text-[9.5px] text-amber-300 border border-amber-400/40">
                SUMBER: SIMULASI
              </span>
            </div>

            {cityExpLogs.length === 0 ? (
              <p className="text-xs text-slate-400">
                Belum ada transaksi EXP simulasi baru pada sesi ini. Total EXP awal kota berasal dari akumulasi kontribusi klan ({city.totalExp.toLocaleString('id-ID')} EXP).
              </p>
            ) : (
              <div className="space-y-1.5">
                {cityExpLogs.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/75 px-2.5 py-2 text-[11px]"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate">
                        {tx.userName} → {tx.clanName}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {tx.missionTitle} ({tx.source})
                      </div>
                    </div>
                    <span className="font-mono font-bold text-emerald-300 tabular-nums shrink-0">
                      +{tx.expAmount} EXP
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lore & Sejarah Peradaban Kota */}
          <div className="rounded-2xl border border-slate-800/90 bg-slate-900/75 p-3.5 space-y-2.5">
            <h3 className="font-display text-sm font-bold text-white">
              Sejarah & Peradaban {city.name}
            </h3>
            <p className="text-xs leading-relaxed text-slate-300">{city.fullLore}</p>

            <div className="space-y-2 border-t border-slate-800 pt-2.5 text-xs">
              <div className="flex items-start gap-2">
                <Compass className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
                <div>
                  <span className="font-semibold text-slate-200">Geografi Kota: </span>
                  <span className="text-slate-400">{city.geographyNote}</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                <div>
                  <span className="font-semibold text-slate-200">Fenomena Sihir: </span>
                  <span className="text-slate-400">{city.magicPhenomenon}</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Users className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                <div>
                  <span className="font-semibold text-slate-200">Dewan Penguasa: </span>
                  <span className="text-slate-400">{city.rulingCouncil}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Buat Klan Baru (Khusus Pemimpin Kota, Maks 15 Klan/Kota) */}
      {isCreateClanOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          onClick={() => setIsCreateClanOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="nuenime-scroll max-h-[85vh] w-full max-w-[390px] overflow-y-auto rounded-2xl border border-slate-500/40 bg-slate-950/95 p-4 text-slate-100 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-display text-sm font-bold text-white">
                  Buat Klan Baru di Kota {city.name}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Kapasitas Kota: {city.clans.length} / {city.maxClans} Klan · Maks 100 Anggota/Klan
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateClanOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateClanSubmit} className="mt-3 space-y-3 text-xs">
              {/* Kartu Biaya Crystal Pendirian Klan (Solid Color & Nuenime Crystal Icon) */}
              <div className="flex items-center justify-between rounded-xl border border-sky-500/40 bg-[#0a1829] p-2.5">
                <div className="flex items-center gap-2.5">
                  <NuenimeCrystalIcon size={22} />
                  <div>
                    <div className="text-xs font-bold text-sky-200">Biaya Pendirian Klan</div>
                    <div className="text-[10.5px] text-slate-300">2.000 Crystal Nuenime</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-400">Saldo Crystal Anda</div>
                  <div
                    className={`font-mono text-xs font-bold inline-flex items-center gap-1 justify-end ${
                      userCrystals >= 2000 ? 'text-emerald-300' : 'text-rose-400'
                    }`}
                  >
                    <span>{userCrystals.toLocaleString('id-ID')}</span>
                    <NuenimeCrystalIcon size={13} />
                  </div>
                </div>
              </div>

              {createClanError && (
                <div className="rounded-xl border border-rose-500/50 bg-[#1f0a10] p-2.5 text-rose-200">
                  {createClanError}
                </div>
              )}

              <div>
                <label className="mb-1 block font-semibold text-slate-300">
                  Nama Klan (3–36 Karakter)
                </label>
                <input
                  type="text"
                  required
                  value={newClanName}
                  onChange={(e) => setNewClanName(e.target.value)}
                  placeholder="Contoh: Ordo Bintang Utara"
                  className="h-10 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white focus:border-sky-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="mb-1 block font-semibold text-slate-300">
                    Tag Klan (2–5 Huruf)
                  </label>
                  <input
                    type="text"
                    maxLength={5}
                    value={newClanTag}
                    onChange={(e) => setNewClanTag(e.target.value.toUpperCase())}
                    placeholder="OBU"
                    className="h-10 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 font-mono text-xs uppercase text-white focus:border-sky-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-slate-300">Emblem Klan</label>
                  <select
                    value={newClanEmblem}
                    onChange={(e) => setNewClanEmblem(e.target.value as ClanEmblemVariant)}
                    className="h-10 w-full rounded-xl border border-slate-700 bg-slate-900 px-2.5 text-xs text-white focus:border-sky-400 focus:outline-none"
                  >
                    {EMBLEM_VARIANTS.map((em) => (
                      <option key={em.id} value={em.id}>
                        {em.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Input Link Foto / Logo Bulat Klan */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-300">
                    Link Foto / Logo Bulat Klan
                  </label>
                  <span className="text-[10px] text-slate-400 font-normal">
                    (Opsional · Link Foto Bulat)
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-700 bg-slate-900">
                    {newClanLogoUrl.trim() ? (
                      <img
                        src={newClanLogoUrl.trim()}
                        alt="Preview"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                        className="h-full w-full object-cover rounded-full"
                      />
                    ) : (
                      <ClanEmblemIcon
                        variant={newClanEmblem}
                        accentColor={city.accentHex}
                        size={24}
                      />
                    )}
                  </div>
                  <input
                    type="url"
                    value={newClanLogoUrl}
                    onChange={(e) => setNewClanLogoUrl(e.target.value)}
                    placeholder="https://contoh.com/logo-klan.png"
                    className="h-10 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white placeholder-slate-500 focus:border-sky-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-300">
                  Distrik Markas di {city.name}
                </label>
                <input
                  type="text"
                  value={newClanDistrict}
                  onChange={(e) => setNewClanDistrict(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white focus:border-sky-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-300">
                  Deskripsi Singkat Klan
                </label>
                <textarea
                  rows={2}
                  value={newClanDesc}
                  onChange={(e) => setNewClanDesc(e.target.value)}
                  placeholder={`Klan penjaga kehormatan Kota ${city.name}...`}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-xs text-white focus:border-sky-400 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingClan}
                className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl border border-sky-400 bg-[#0284c7] hover:bg-[#0369a1] px-4 py-2 text-xs font-bold text-white shadow-lg transition-all active:scale-95 disabled:opacity-50"
              >
                <PlusCircle className="h-4 w-4 shrink-0" />
                <span>
                  {isSubmittingClan ? 'Sedang Memproses...' : `Resmikan Klan Baru di ${city.name}`}
                </span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Toko Senjata & Gudang Inventory Klan */}
      <ClanCombatShopModal
        isOpen={isShopOpen}
        onClose={() => setIsShopOpen(false)}
      />

      {/* Modal Serangan Bos Musuh */}
      <EnemyBossRaidModal
        isOpen={isRaidOpen}
        bossId={city.boss?.id ?? null}
        onClose={() => setIsRaidOpen(false)}
        onOpenShop={() => {
          setIsRaidOpen(false);
          setIsShopOpen(true);
        }}
      />
    </div>
  );
};
