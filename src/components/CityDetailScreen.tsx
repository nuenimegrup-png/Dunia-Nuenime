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
  const [isExpActivitiesOpen, setIsExpActivitiesOpen] = useState(false);

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
      <div className="z-30 border-b border-white/10 bg-[#0B0E14]/95 px-3 pt-3 pb-2.5 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBackToMap}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/10 hover:text-white active:scale-95 whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="h-4 w-4 text-slate-400" />
            <span>Peta Dunia</span>
          </button>

          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={cycleTimeOfDay}
              title="Ubah Siklus Waktu Peta Kota"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 transition-colors"
            >
              {timeOfDay === 'day' && <Sun className="h-4 w-4 text-amber-300" />}
              {timeOfDay === 'dusk' && <Sunset className="h-4 w-4 text-orange-300" />}
              {timeOfDay === 'night' && <Moon className="h-4 w-4 text-purple-300" />}
            </button>
            <CityEmblemBadge cityId={city.id} material={city.material} size={32} selected />
            <div className="min-w-0 text-right">
              <div className="flex items-center justify-end gap-1.5">
                <span className="rounded border border-white/10 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-slate-300">
                  Lv.{city.level} · {city.tier}
                </span>
                <h1 className="font-display truncate text-sm font-bold text-white tracking-wide">
                  {city.name}
                </h1>
              </div>
              <p className="truncate font-mono text-[10px] text-slate-400 tabular-nums">
                Wilayah {city.name} · {city.totalExp.toLocaleString('id-ID')} Total EXP
              </p>
            </div>
          </div>
        </div>

        {/* 3-Tab Mode Bar: Peta Kota | Klan, Bos & Misi | Lore & Riwayat */}
        <div className="mt-2.5 grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          <button
            type="button"
            onClick={() => setActiveTab('map')}
            className={`flex h-8 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition-all ${
              activeTab === 'map'
                ? 'border border-white/10 bg-white/10 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MapIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Peta Kota</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('clans')}
            className={`flex h-8 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition-all ${
              activeTab === 'clans'
                ? 'border border-white/10 bg-white/10 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              Klan ({city.clans.length}/{city.maxClans})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('lore')}
            className={`flex h-8 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition-all ${
              activeTab === 'lore'
                ? 'border border-white/10 bg-white/10 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Profil & Sejarah</span>
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

                {/* Action Row: Kendali Distrik | (Gabung Klan jika belum punya klan) | Detail Klan */}
                <div
                  className={`mt-2.5 grid gap-1.5 border-t border-slate-800/90 pt-2 ${
                    !joinedClanId || joinedClanId === selectedClanOnMap.id ? 'grid-cols-3' : 'grid-cols-2'
                  }`}
                >
                  <div
                    title={`Kendali ${selectedClanOnMap.name} atas distrik dihitung otomatis dari kontribusi EXP nyata di APK.`}
                    className="flex h-[34px] items-center justify-center gap-1 rounded-xl border border-amber-400/50 bg-[#241705] px-2 text-[10.5px] font-semibold text-amber-200"
                  >
                    <Shield className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                    <span className="truncate">Kendali {selectedInfluence}%</span>
                  </div>

                  {/* Tombol Gabung Klan HANYA muncul jika pengguna BELUM bergabung/membuat klan manapun */}
                  {!joinedClanId ? (
                    <button
                      type="button"
                      onClick={() => joinClan(selectedClanOnMap.id)}
                      className="flex h-[34px] items-center justify-center gap-1 rounded-xl border border-emerald-400/50 bg-emerald-500/15 px-2 text-[10.5px] font-semibold text-emerald-200 hover:bg-emerald-500/25 active:scale-95"
                    >
                      <span className="truncate">Gabung Klan</span>
                    </button>
                  ) : joinedClanId === selectedClanOnMap.id ? (
                    <div className="flex h-[34px] items-center justify-center gap-1 rounded-xl border border-emerald-500/40 bg-emerald-950/50 px-2 text-[10.5px] font-semibold text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">Klan Aktif</span>
                    </div>
                  ) : null}

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
          {/* Card 1: Status Progres Kota & Pembuatan Klan */}
          <div className="rounded-2xl border border-white/10 bg-[#0B0E14]/95 p-3.5 sm:p-4 space-y-3 backdrop-blur-xl shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[10px] sm:text-[10.5px] font-semibold text-slate-400">
                  <span className="truncate">Kota Komunitas</span>
                  <span>·</span>
                  <span className="font-mono text-slate-300 shrink-0">
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
                <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-300 shrink-0">
                  {city.clans.length}/{city.maxClans} Klan
                </span>
                <div
                  title={`Saldo Crystal: ${userCrystals.toLocaleString('id-ID')}`}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[10.5px] font-semibold text-slate-200 shrink-0"
                >
                  <NuenimeCrystalIcon size={13} />
                  <span className="tabular-nums">{userCrystals.toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>

            {/* City Level & EXP Bar Presisi Mobile */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col justify-center rounded-xl border border-white/10 bg-white/[0.03] p-2.5 sm:p-3 min-w-0">
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 truncate">
                  <Shield className="h-3 w-3 shrink-0 text-slate-400" />
                  <span>Tingkat Wilayah</span>
                </span>
                <span className="font-mono text-xs sm:text-sm font-bold text-white tabular-nums mt-0.5 truncate">
                  Lv.{city.level} · {city.tier}
                </span>
              </div>

              <div className="flex flex-col justify-center rounded-xl border border-white/10 bg-white/[0.03] p-2.5 sm:p-3 min-w-0">
                <span className="text-[10px] font-semibold text-slate-400 truncate">
                  Total EXP Wilayah
                </span>
                <span className="font-mono text-xs sm:text-sm font-bold text-slate-200 tabular-nums mt-0.5 truncate">
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
                <span className="font-mono text-slate-400 tabular-nums">
                  +{remainingExp.toLocaleString('id-ID')} EXP ke Lv.{city.level + 1}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full transition-all duration-300 bg-sky-400"
                  style={{ width: `${expPercent}%` }}
                />
              </div>
            </div>

            {/* Create Clan Action / Crystal Fee Notice */}
            <div className="border-t border-white/[0.08] pt-2.5">
              {createPermission.allowed ? (
                <button
                  type="button"
                  onClick={() => {
                    setCreateClanError(null);
                    setIsCreateClanOpen(true);
                  }}
                  className="flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 px-3 py-2 text-xs font-bold text-white shadow-sm transition-all active:scale-95"
                >
                  <PlusCircle className="h-4 w-4 shrink-0" />
                  <span className="inline-flex items-center gap-1">
                    <span>Buat Klan Baru di {city.name} (Biaya: 2.000</span>
                    <NuenimeCrystalIcon size={14} className="inline-block" />
                    <span>)</span>
                  </span>
                </button>
              ) : (
                <div className="flex flex-col gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-[11px]">
                  <div className="text-slate-300 leading-snug">{createPermission.reason}</div>
                  <div className="flex items-center justify-between text-[10.5px] text-slate-400 pt-1.5 border-t border-white/[0.06]">
                    <span>Saldo Crystal Anda:</span>
                    <span className="font-mono font-bold text-slate-200 inline-flex items-center gap-1">
                      <span>{userCrystals.toLocaleString('id-ID')}</span>
                      <NuenimeCrystalIcon size={12} />
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Bos Penjaga Kota Unik */}
          <div className="rounded-2xl border border-white/10 bg-[#0B0E14]/95 p-3.5 sm:p-4 space-y-3 backdrop-blur-xl shadow-xl">
            {/* Baris Atas: Avatar Bos & Info Lengkap Bos */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-full border-2 bg-slate-950 shadow-sm"
                style={{ borderColor: cityBoss.accentColor }}
              >
                <CityBossIllustration cityId={city.id} size={38} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[9.5px] font-semibold">
                  <span className="rounded bg-white/[0.06] border border-white/10 px-1.5 py-0.5 font-mono text-slate-300 shrink-0">
                    Bos Kota · Lv.{cityBoss.level} ({cityBoss.tier})
                  </span>
                  <span className="flex items-center gap-1 text-[9.5px] text-slate-300 shrink-0">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        cityBoss.currentHp > 0
                          ? 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.6)]'
                          : 'bg-emerald-500'
                      }`}
                    />
                    {cityBoss.currentHp > 0 ? 'Aktif' : 'Kalah'}
                  </span>
                </div>
                <h3 className="font-display truncate text-xs sm:text-sm font-bold text-white mt-0.5 tracking-wide">
                  {cityBoss.name} — {cityBoss.title}
                </h3>
                <div className="font-mono text-[10px] text-slate-300 tabular-nums">
                  HP Bos: {cityBoss.currentHp.toLocaleString('id-ID')} /{' '}
                  {cityBoss.maxHp.toLocaleString('id-ID')} HP
                </div>
              </div>
            </div>

            {/* Baris Tengah: Progres Bar HP Bos */}
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className="h-full rounded-full bg-rose-500 transition-all duration-300"
                style={{
                  width: `${Math.max(0, Math.min(100, (cityBoss.currentHp / (cityBoss.maxHp || 1)) * 100))}%`,
                }}
              />
            </div>

            {/* Baris Bawah: Tombol Aksi Simetris 2 Kolom */}
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => setIsShopOpen(true)}
                title="Buka Toko & Gudang Senjata Klan"
                className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] px-2 text-xs font-semibold text-slate-200 transition-all active:scale-95"
              >
                <Package className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span>Gudang</span>
              </button>

              <button
                type="button"
                onClick={() => setIsRaidOpen(true)}
                title="Pertarungan Bos Kota & Leaderboard"
                className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 px-2 text-xs font-bold text-white shadow-sm transition-all active:scale-95"
              >
                <Swords className="h-3.5 w-3.5 shrink-0" />
                <span>{cityBoss.currentHp > 0 ? 'Serang Bos' : 'Leaderboard'}</span>
              </button>
            </div>
          </div>

          {/* Card 3: Alur Perolehan EXP Nyata Terintegrasi Nuenime APK */}
          <div className="rounded-2xl border border-white/10 bg-[#0B0E14]/95 p-3.5 sm:p-4 space-y-3 backdrop-blur-xl shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-display text-xs font-bold text-white tracking-wide">
                    Alur Perolehan EXP Nyata ({city.name})
                  </h3>
                  <span className="rounded border border-white/10 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[9px] font-semibold text-slate-300 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    REALTIME APK
                  </span>
                </div>
                <p className="text-[10.5px] text-slate-400 mt-0.5">
                  EXP diperoleh otomatis dari menonton anime di aplikasi Nuenime → Memperkuat Klan → Menaikkan Level & Tier {city.name}
                </p>
              </div>
            </div>

            {/* Banner Sinkronisasi EXP Akun Real */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="min-w-0">
                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                  Kontribusi EXP Akun Anda
                </div>
                <div className="font-mono text-base font-bold text-white mt-0.5 tabular-nums">
                  {playerContribution.toLocaleString('id-ID')} <span className="text-xs font-normal text-slate-400">EXP Terkumpul</span>
                </div>
                <div className="text-[10px] text-slate-500">
                  Tersinkronisasi otomatis dengan profil akun Nuenime
                </div>
              </div>

              <button
                type="button"
                onClick={handleSyncExp}
                disabled={isSyncingExp}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] hover:bg-white/[0.1] px-3.5 py-2 text-xs font-semibold text-slate-200 active:scale-95 transition-all shrink-0 disabled:opacity-50 w-full sm:w-auto"
              >
                <RefreshCw className={`h-3.5 w-3.5 text-slate-300 ${isSyncingExp ? 'animate-spin' : ''}`} />
                <span>{isSyncingExp ? 'Sinkron...' : 'Sinkronkan EXP'}</span>
              </button>
            </div>

            {/* Daftar Aturan EXP Nyata dari APK (Collapsible Buka/Tutup) */}
            <div className="pt-2 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={() => setIsExpActivitiesOpen((prev) => !prev)}
                className="flex w-full items-center justify-between gap-2 py-1 text-left group transition-all"
              >
                <div className="flex items-center gap-1.5">
                  <ChevronRight
                    className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${
                      isExpActivitiesOpen ? 'rotate-90 text-slate-200' : 'group-hover:text-slate-300'
                    }`}
                  />
                  <span className="text-[11px] font-semibold text-slate-300 group-hover:text-white transition-colors">
                    Aktivitas Perolehan EXP di Aplikasi ({cityMissions.length})
                  </span>
                </div>
                <span className="font-mono text-[10px] text-slate-400">
                  {isExpActivitiesOpen ? 'Tutup' : 'Lihat Aktivitas'}
                </span>
              </button>

              {isExpActivitiesOpen && (
                <div className="space-y-1.5 mt-2 transition-all">
                  {cityMissions.map((msn) => (
                    <div
                      key={msn.id}
                      className="flex items-center justify-between gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] p-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                          <span>{msn.categoryLabel}</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-500">{msn.difficulty}</span>
                        </div>
                        <div className="text-xs font-bold text-white truncate mt-0.5 tracking-wide">
                          {msn.title}
                        </div>
                        <p className="mt-0.5 text-[10.5px] text-slate-400 line-clamp-1">
                          {msn.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-right shrink-0">
                        <span className="font-mono text-xs font-bold text-sky-400 tabular-nums">
                          +{msn.rewardExp} EXP
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                className="h-10 w-full rounded-xl border border-white/10 bg-[#0B0E14]/90 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-white/20 focus:outline-none backdrop-blur-xl"
              />
            </div>

            <button
              type="button"
              onClick={() => onOpenFullClanList(city)}
              className="flex h-10 items-center gap-1.5 rounded-xl border border-white/10 bg-[#0B0E14]/90 px-3 text-xs font-semibold text-slate-300 hover:bg-white/[0.06] hover:text-white transition-all shrink-0 backdrop-blur-xl"
            >
              <Trophy className="h-3.5 w-3.5 text-amber-300" />
              <span>Global</span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            </button>
          </div>

          {/* Leaderboard Klan Dalam Kota */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <span className="font-bold text-white tracking-wide">
                Leaderboard Klan Kota {city.name} ({filteredClans.length}/{city.maxClans})
              </span>
              <span className="text-[11px] text-slate-500 font-normal">Urut berdasarkan Total EXP</span>
            </div>

            {filteredClans.map((clan, index) => {
              const rank = index + 1;
              const isJoined = joinedClanId === clan.id;
              const totalScore = getClanTotalScore(clan.id);
              const influence = districtInfluence[clan.id]?.influencePercent ?? 68;

              return (
                <div
                  key={clan.id}
                  className={`flex flex-col gap-2.5 rounded-2xl border p-3.5 backdrop-blur-xl ${
                    isJoined
                      ? 'border-white/25 bg-[#0B0E14]/95 shadow-md'
                      : 'border-white/10 bg-[#0B0E14]/90'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold tabular-nums ${
                        rank === 1
                          ? 'border border-amber-400/40 bg-amber-500/15 text-amber-200'
                          : rank === 2
                          ? 'border border-slate-400/30 bg-slate-400/10 text-slate-200'
                          : rank === 3
                          ? 'border border-orange-400/30 bg-orange-500/10 text-orange-200'
                          : 'border border-white/5 bg-white/[0.03] text-slate-400'
                      }`}
                    >
                      #{rank}
                    </div>

                    <ClanEmblemIcon
                      variant={clan.emblemVariant}
                      accentColor={clan.accentColor}
                      logoUrl={clan.logoUrl}
                      size={42}
                      className="shrink-0"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-display truncate text-sm font-bold text-white tracking-wide">
                          {clan.name}{' '}
                          <span className="font-mono text-[10.5px] text-slate-400">[{clan.tag}]</span>
                        </h3>
                        <span className="font-mono text-xs font-bold text-slate-200 tabular-nums shrink-0">
                          {totalScore.toLocaleString('id-ID')} EXP
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">
                        Pemimpin: {clan.leaderName} · Anggota: {clan.memberCount}/{clan.maxMembers}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-white/[0.06] pt-2 text-xs text-slate-400">
                    <div className="truncate">
                      <span className="text-slate-300 font-medium">{clan.strongholdDistrict}</span>
                      <span className="font-mono text-slate-400 tabular-nums">
                        {' '}· Kendali {influence}%
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 sm:flex sm:items-center sm:gap-1.5 shrink-0">
                      {isJoined ? (
                        <div className="flex h-8 items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-emerald-300">
                          <Award className="h-3 w-3 shrink-0" />
                          <span>Klanmu</span>
                        </div>
                      ) : joinedClanId ? (
                        <div
                          title="Anda sudah memiliki/tergabung dalam klan lain"
                          className="flex h-8 items-center justify-center rounded-lg border border-white/5 bg-white/[0.02] px-3 text-xs font-medium text-slate-500 cursor-not-allowed select-none"
                        >
                          <span>Dilarang</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSelectClan(clan)}
                          className="flex h-8 items-center justify-center rounded-lg bg-sky-600 hover:bg-sky-500 px-3 text-xs font-bold text-white active:scale-95 transition-all shadow-sm"
                        >
                          Gabung
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedClanOnMap(clan);
                          setActiveTab('map');
                          setTimeout(() => focusClanStronghold(clan), 50);
                        }}
                        className="flex h-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] px-2.5 text-xs font-medium text-slate-300 active:scale-95 transition-colors"
                      >
                        Peta
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectClan(clan)}
                        className="flex h-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] px-3 text-xs font-semibold text-slate-200 active:scale-95 transition-colors"
                      >
                        Detail
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredClans.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#0B0E14]/90 px-4 py-8 text-center backdrop-blur-xl shadow-xl">
                <Shield className="h-10 w-10 text-slate-500 mb-2.5" />
                <p className="text-sm font-bold text-white tracking-tight">Belum Ada Klan di Kota {city.name}</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                  Seluruh klan di kota ini berasal dari hasil pembuatan klan oleh para petualang. Jadilah pendiri klan pertama!
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCreateClanError(null);
                    setIsCreateClanOpen(true);
                  }}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 px-4 py-2.5 text-xs font-bold text-white active:scale-95 transition-all shadow-sm"
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
          <div className="relative h-44 w-full overflow-hidden rounded-2xl border border-white/10 shadow-lg">
            <img
              src={city.thumbnailAsset}
              alt={`Ilustrasi ${city.name}`}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B0E14] via-[#0B0E14]/60 to-transparent" />
            <div className="absolute bottom-3.5 left-4 right-4">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/40 border border-white/10 backdrop-blur-md text-[10.5px] font-medium text-slate-300 font-mono mb-1.5">
                <span>{city.regionName}</span>
                <span className="text-slate-500">·</span>
                <span className="text-sky-300">Level {city.level} ({city.tier})</span>
              </div>
              <h2 className="font-display text-xl font-bold tracking-wide text-white">{city.name}</h2>
              <p className="text-xs text-slate-300/90">{city.epithet}</p>
            </div>
          </div>

          {/* Profil & Sejarah Peradaban Kota */}
          <div className="rounded-2xl border border-white/10 bg-[#0B0E14]/95 p-3.5 sm:p-4 backdrop-blur-xl shadow-xl space-y-3">
            <h3 className="font-display text-sm font-bold tracking-wide text-slate-100">
              Sejarah & Peradaban {city.name}
            </h3>
            <p className="text-xs leading-relaxed text-slate-300/90">{city.fullLore}</p>

            <div className="space-y-2 pt-2 border-t border-white/5">
              <div className="flex items-start gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                <Compass className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <div className="text-xs leading-relaxed">
                  <span className="font-semibold text-slate-200">Geografi Kota: </span>
                  <span className="text-slate-400">{city.geographyNote}</span>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <div className="text-xs leading-relaxed">
                  <span className="font-semibold text-slate-200">Fenomena Sihir: </span>
                  <span className="text-slate-400">{city.magicPhenomenon}</span>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                <Users className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <div className="text-xs leading-relaxed">
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          onClick={() => setIsCreateClanOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="nuenime-scroll max-h-[88vh] w-full max-w-[400px] overflow-y-auto rounded-2xl border border-white/10 bg-[#0B0E14]/98 p-4 sm:p-5 text-slate-100 shadow-2xl backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="font-display text-sm font-bold tracking-wide text-white">
                  Buat Klan Baru di Kota {city.name}
                </h3>
                <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                  Kapasitas: {city.clans.length} / {city.maxClans} Klan · Maks 100 Jiwa
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateClanOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors active:scale-95"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateClanSubmit} className="mt-3.5 space-y-3.5 text-xs">
              {/* Kartu Biaya Crystal Pendirian Klan */}
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center gap-2.5">
                  <NuenimeCrystalIcon size={20} />
                  <div>
                    <div className="text-xs font-semibold text-slate-200">Biaya Pendirian Klan</div>
                    <div className="text-[10.5px] text-slate-400">2.000 Crystal Nuenime</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-400">Saldo Crystal Anda</div>
                  <div
                    className={`font-mono text-xs font-bold inline-flex items-center gap-1 justify-end ${
                      userCrystals >= 2000 ? 'text-sky-400' : 'text-rose-400'
                    }`}
                  >
                    <span>{userCrystals.toLocaleString('id-ID')}</span>
                    <NuenimeCrystalIcon size={12} />
                  </div>
                </div>
              </div>

              {createClanError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
                  {createClanError}
                </div>
              )}

              <div>
                <label className="mb-1.5 block font-medium text-slate-300">
                  Nama Klan (3–36 Karakter)
                </label>
                <input
                  type="text"
                  required
                  value={newClanName}
                  onChange={(e) => setNewClanName(e.target.value)}
                  placeholder="Contoh: Ordo Bintang Utara"
                  className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs text-white placeholder-slate-500 focus:border-sky-400/60 focus:bg-white/[0.05] focus:outline-none transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="mb-1.5 block font-medium text-slate-300">
                    Tag Klan (2–5 Huruf)
                  </label>
                  <input
                    type="text"
                    maxLength={5}
                    value={newClanTag}
                    onChange={(e) => setNewClanTag(e.target.value.toUpperCase())}
                    placeholder="OBU"
                    className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 font-mono text-xs uppercase text-white placeholder-slate-500 focus:border-sky-400/60 focus:bg-white/[0.05] focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block font-medium text-slate-300">Emblem Klan</label>
                  <select
                    value={newClanEmblem}
                    onChange={(e) => setNewClanEmblem(e.target.value as ClanEmblemVariant)}
                    className="h-10 w-full rounded-xl border border-white/10 bg-[#0E121B] px-2.5 text-xs text-white focus:border-sky-400/60 focus:outline-none transition-colors"
                  >
                    {EMBLEM_VARIANTS.map((em) => (
                      <option key={em.id} value={em.id} className="bg-[#0E121B] text-white">
                        {em.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Input Link Foto / Logo Bulat Klan */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block font-medium text-slate-300">
                    Link Foto / Logo Bulat Klan
                  </label>
                  <span className="text-[10px] text-slate-400 font-normal">
                    (Opsional · Link Foto Bulat)
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-black/40">
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
                        size={22}
                      />
                    )}
                  </div>
                  <input
                    type="url"
                    value={newClanLogoUrl}
                    onChange={(e) => setNewClanLogoUrl(e.target.value)}
                    placeholder="https://contoh.com/logo-klan.png"
                    className="h-10 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs text-white placeholder-slate-500 focus:border-sky-400/60 focus:bg-white/[0.05] focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block font-medium text-slate-300">
                  Distrik Markas di {city.name}
                </label>
                <input
                  type="text"
                  value={newClanDistrict}
                  onChange={(e) => setNewClanDistrict(e.target.value)}
                  className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs text-white placeholder-slate-500 focus:border-sky-400/60 focus:bg-white/[0.05] focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="mb-1.5 block font-medium text-slate-300">
                  Deskripsi Singkat Klan
                </label>
                <textarea
                  rows={2}
                  value={newClanDesc}
                  onChange={(e) => setNewClanDesc(e.target.value)}
                  placeholder={`Klan penjaga kehormatan Kota ${city.name}...`}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white placeholder-slate-500 focus:border-sky-400/60 focus:bg-white/[0.05] focus:outline-none transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingClan}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 px-4 text-xs font-bold text-white shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
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
