import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import {
  CityId,
  TimeOfDayMode,
  CityBossRecord,
  SimulationMission,
  DistrictInfluenceState,
  ActiveTravelRoute,
  WorldCity,
  Clan,
  ClanMember,
  ClanEmblemVariant,
  CityLeaderProfile,
  ActiveDemoAccount,
  EXPTransactionRecord,
  CityLevelHistoryRecord,
  UserMissionProgressRecord,
  GlobalWorldStats,
  CreateClanInput,
  ClanWeapon,
  ClanInventoryItem,
  ClanCoinTransaction,
  BossBattleLog,
  ClanJoinRequest,
  ClanJoinRequestStatus,
} from '../types/nuenime';
import { WORLD_CITIES as SEED_WORLD_CITIES } from '../data/nuenimeWorldData';
import {
  CLAN_MISSIONS,
  calculateTravelRoute,
} from '../data/nuenimeRpgFeaturesData';
import {
  NUENIME_SYSTEM_LIMITS,
  computeCityLevelProgressFromTotalExp,
  computeClanLevelFromExp,
  computeBossStatsForCityLevel,
  computeBaseAttackDamage,
  CONSUMABLE_WEAPONS_CATALOG,
} from '../config/nuenimeSystemConfig';
import { fantasySoundEngine } from '../utils/soundEngine';
import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'nuenime_world_repository_v7_clean';

export const TEST_CLAN_IDS = new Set([
  'clan-test-1792940048860',
  'clan-aetheria-1792940077437',
  'clan-aetheria-1792942140417',
]);

export function isTestingClan(clan: { id?: string; name?: string; tag?: string } | null | undefined): boolean {
  if (!clan) return false;
  if (clan.id && TEST_CLAN_IDS.has(clan.id)) return true;
  const name = (clan.name || '').toLowerCase().trim();
  const tag = (clan.tag || '').toUpperCase().trim();
  if (name.includes('uji coba') || name.includes('test sim') || name === 'adknasdsadsd') return true;
  if (tag === 'TEST1' || tag === 'KSIM' || tag === 'AA') return true;
  return false;
}

/**
 * Fungsi Rekonsiliasi & Pemeriksaan Konsistensi Data Dunia Nuenime
 * Memastikan:
 * - Satu pengguna tidak dihitung dua kali dalam klan yang sama.
 * - memberCount === jumlah anggota aktif sebenarnya (maks. 100).
 * - Total EXP Klan === jumlah contributionScore anggotanya.
 * - Total EXP Kota === jumlah totalExp seluruh klan di kota tersebut.
 * - Level & Tier Kota sesuai dengan formula terpusat.
 * - Kota TIDAK memiliki HP sama sekali.
 * - HP hanya dimiliki oleh monster dan bos kota.
 */
export function verifyAndReconcileWorldCities(
  citiesInput: WorldCity[],
  cityBossesInput: CityBossRecord[] = [],
  cityLevelHistoryInput?: Record<CityId, CityLevelHistoryRecord[]>
): WorldCity[] {
  return citiesInput.map((city) => {
    const leaderProfile = city.leaderProfile ?? null;
    const bossRecord =
      cityBossesInput.find((b) => b.cityId === city.id) ??
      city.boss ?? {
        id: `boss-${city.id}`,
        cityId: city.id,
        cityName: city.name,
        name: `Penjaga ${city.name}`,
        title: `Pelindung Takhta ${city.name}`,
        speciesType: 'Entitas Purba',
        element: city.element,
        description: `Monster penjaga kota ${city.name}.`,
        characteristic: `Pelindung gerbang ${city.name}.`,
        level: 0,
        tier: 'Normal',
        maxHp: 10000,
        currentHp: 10000,
        status: 'ACTIVE',
        accentColor: city.accentHex,
        secondaryColor: city.secondaryHex,
        worldXPercent: city.worldXPercent,
        worldYPercent: city.worldYPercent,
        battleHistoryCount: 0,
        lastUpdatedAt: new Date().toISOString(),
      };

    const reconciledClans: Clan[] = (city.clans || [])
      .filter((clan) => !isTestingClan(clan))
      .slice(0, NUENIME_SYSTEM_LIMITS.MAX_CLANS_PER_CITY)
      .map((clan) => {
        // Deduplicate members by userId and enforce max 100 members
        const seenUserIds = new Set<string>();
        const uniqueMembers: ClanMember[] = [];
        for (const m of clan.members) {
          if (
            !seenUserIds.has(m.userId) &&
            uniqueMembers.length < NUENIME_SYSTEM_LIMITS.MAX_MEMBERS_PER_CLAN
          ) {
            seenUserIds.add(m.userId);
            uniqueMembers.push({
              ...m,
              clanId: clan.id,
              cityId: city.id,
              contributionScore: Math.max(0, Math.floor(m.contributionScore)),
            });
          }
        }

        const clanTotalExp = uniqueMembers.reduce((sum, m) => sum + m.contributionScore, 0);

        return {
          ...clan,
          cityId: city.id,
          cityName: city.name,
          coins: clan.coins ?? 1000,
          members: uniqueMembers,
          memberCount: uniqueMembers.length,
          maxMembers: NUENIME_SYSTEM_LIMITS.MAX_MEMBERS_PER_CLAN,
          totalExp: clanTotalExp,
          level: computeClanLevelFromExp(clanTotalExp),
        };
      });

    const cityTotalExp = reconciledClans.reduce((sum, c) => sum + c.totalExp, 0);
    const levelState = computeCityLevelProgressFromTotalExp(cityTotalExp);

    return {
      ...city,
      leaderId: leaderProfile?.id ?? null,
      leaderProfile,
      level: levelState.level,
      tier: levelState.tier,
      totalExp: levelState.totalExp,
      currentLevelExp: levelState.currentLevelExp,
      nextLevelTargetExp: levelState.nextLevelTargetExp,
      maxClans: NUENIME_SYSTEM_LIMITS.MAX_CLANS_PER_CITY,
      bossId: bossRecord.id,
      boss: bossRecord,
      levelHistory: cityLevelHistoryInput?.[city.id] ?? city.levelHistory ?? [],
      clans: reconciledClans,
    };
  });
}

interface PersistedRepositoryState {
  cities: WorldCity[];
  cityBosses: CityBossRecord[];
  activeAccountId: string;
  joinedClanId: string | null;
  playerContribution: number;
  relicShards: number;
  relicLevels: Record<string, number>;
  districtInfluence: Record<string, DistrictInfluenceState>;
  completedMissionCounts: Record<string, number>;
  missionProgressMap: Record<string, UserMissionProgressRecord>;
  expTransactions: EXPTransactionRecord[];
  cityLevelHistory: Record<CityId, CityLevelHistoryRecord[]>;
}

function computeRealDistrictInfluence(cities: WorldCity[]): Record<string, DistrictInfluenceState> {
  const map: Record<string, DistrictInfluenceState> = {};
  cities.forEach((city) => {
    const validClans = (city.clans || []).filter((c) => !isTestingClan(c));
    validClans.forEach((clan) => {
      // Target EXP Penguasaan Penuh Distrik Markas = 1.000 EXP per Level Klan
      const targetExp = Math.max(1000, (clan.level || 1) * 1000);
      const clanExp = Math.max(0, clan.totalExp || 0);
      const pct = Math.min(100, Math.max(0, Math.round((clanExp / targetExp) * 100)));

      map[clan.id] = {
        clanId: clan.id,
        cityId: city.id,
        districtName: clan.strongholdDistrict || 'Distrik Utama',
        influencePercent: pct,
      };
    });
  });
  return map;
}

function buildDefaultRelicLevels(cities: WorldCity[]): Record<string, number> {
  const map: Record<string, number> = {};
  cities.forEach((city) => {
    city.clans.forEach((clan) => {
      // Hanya VALORA CITY (klan user) yang sudah Level 2, klan lain default Level 1
      map[clan.id] = clan.id === 'clan-aetheria-1792943151390' ? 2 : 1;
    });
  });
  return map;
}

function buildDefaultLevelHistory(): Record<CityId, CityLevelHistoryRecord[]> {
  return {
    aetheria: [],
    lunaris: [],
    velmora: [],
    eldoria: [],
    drakonia: [],
    nivara: [],
    astralis: [],
  };
}

function saveStoredRepository(state: PersistedRepositoryState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

function loadInitialRepositoryState(): PersistedRepositoryState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedRepositoryState>;
      if (parsed.cities && Array.isArray(parsed.cities) && parsed.cities.length === 7) {
        const reconciledCities = verifyAndReconcileWorldCities(parsed.cities);
        return {
          cities: reconciledCities,
          cityBosses:
            parsed.cityBosses && Array.isArray(parsed.cityBosses) && parsed.cityBosses.length === 7
              ? parsed.cityBosses
              : reconciledCities.map((c) => c.boss!).filter(Boolean),
          activeAccountId: parsed.activeAccountId ?? 'nuenime-adventurer',
          joinedClanId:
            parsed.joinedClanId && !TEST_CLAN_IDS.has(parsed.joinedClanId)
              ? parsed.joinedClanId
              : null,
          playerContribution: parsed.playerContribution ?? 0,
          relicShards: Math.max(parsed.relicShards ?? 0, 5),
          relicLevels: {
            ...buildDefaultRelicLevels(reconciledCities),
            ...(parsed.relicLevels ?? {}),
            'clan-aetheria-1792974812499': 1,
            'clan-aetheria-1792943151390': Math.max(2, parsed.relicLevels?.['clan-aetheria-1792943151390'] ?? 2),
          },
          districtInfluence: computeRealDistrictInfluence(reconciledCities),
          completedMissionCounts: parsed.completedMissionCounts ?? {},
          missionProgressMap: parsed.missionProgressMap ?? {},
          expTransactions: parsed.expTransactions ?? [],
          cityLevelHistory: parsed.cityLevelHistory ?? buildDefaultLevelHistory(),
        };
      }
    }
  } catch {
    // Fallback to clean seed
  }

  const baseSeed = verifyAndReconcileWorldCities(SEED_WORLD_CITIES);
  return {
    cities: baseSeed,
    cityBosses: baseSeed.map((c) => c.boss!).filter(Boolean),
    activeAccountId: 'nuenime-adventurer',
    joinedClanId: null,
    playerContribution: 0,
    relicShards: 0,
    relicLevels: buildDefaultRelicLevels(baseSeed),
    districtInfluence: computeRealDistrictInfluence(baseSeed),
    completedMissionCounts: {},
    missionProgressMap: {},
    expTransactions: [],
    cityLevelHistory: buildDefaultLevelHistory(),
  };
}

interface NuenimeRpgContextValue {
  // Core World Entities (Dynamic Repository)
  cities: WorldCity[];
  allClans: Clan[];
  getCityById: (cityId: string) => WorldCity | undefined;
  getClanById: (clanId: string) => Clan | undefined;
  cityLeaders: Record<CityId, CityLeaderProfile | null>;
  getCityLeader: (cityId: CityId) => CityLeaderProfile | null;

  // Demo Account & Role Switcher
  availableDemoAccounts: ActiveDemoAccount[];
  activeAccount: ActiveDemoAccount;
  switchDemoAccount: (accountId: string) => void;
  canCreateClanInCity: (cityId: CityId) => { allowed: boolean; reason: string };

  // Crystals & Economy (Pembuatan Klan Biaya 2.000 Crystal)
  userCrystals: number;
  deductCrystals: (amount: number) => boolean;
  addCrystals: (amount: number) => void;

  // Clan Creation & Membership (15 Clans/City, 100 Members/Clan)
  createClanInCity: (
    input: CreateClanInput,
    idempotencyKey?: string
  ) => Promise<{ ok: boolean; message: string; createdClan?: Clan }>;
  updateClanLogo: (clanId: string, logoUrl: string) => { ok: boolean; message: string };
  updateClanProfile: (
    clanId: string,
    updates: {
      name?: string;
      tag?: string;
      motto?: string;
      description?: string;
      logoUrl?: string;
    }
  ) => { ok: boolean; message: string };
  updateMemberRole: (
    clanId: string,
    memberId: string,
    newRole: string
  ) => { ok: boolean; message: string };
  joinedClanId: string | null;
  joinClan: (clanId: string) => { ok: boolean; message: string };
  clanJoinRequests: ClanJoinRequest[];
  requestJoinClan: (clanId: string) => Promise<{
    ok: boolean;
    message: string;
    requiresLeaveFirst?: boolean;
    currentClanName?: string;
  }>;
  respondJoinRequest: (
    requestId: string,
    action: 'approve' | 'reject'
  ) => Promise<{ ok: boolean; message: string }>;
  cancelJoinRequest: (clanId: string) => Promise<{ ok: boolean; message: string }>;
  leaveClan: (clanId: string) => Promise<{
    ok: boolean;
    message: string;
    isLeader?: boolean;
    hasOtherMembers?: boolean;
  }>;
  disbandClan: (clanId: string) => Promise<{ ok: boolean; message: string }>;
  transferClanLeadership: (
    clanId: string,
    newLeaderId: string
  ) => Promise<{ ok: boolean; message: string }>;
  getUserJoinRequest: (clanId: string) => ClanJoinRequest | undefined;
  refreshClanData: () => Promise<void>;

  // Unique City Bosses (7 Bosses) & Serangan Bos Kota Musuh
  worldBosses: CityBossRecord[];
  getCityBoss: (cityId: CityId) => CityBossRecord;
  attackWorldBoss: (bossId: string) => { damage: number; defeated: boolean };
  resetWorldBoss: (bossId: string) => void;
  attackEnemyBoss: (
    bossId: string,
    weaponId?: string | null
  ) => Promise<{
    ok: boolean;
    message: string;
    damageDealt?: number;
    bossDefeated?: boolean;
    bossHpAfter?: number;
    winnerClanId?: string;
    winnerClanName?: string;
    winnerDamage?: number;
    rewardCoins?: number;
    cooldownSeconds?: number;
    nextAttackAt?: string;
  }>;

  // Gudang & Senjata Sekali Pakai (Consumable Weapons & Clan Economy)
  weaponsCatalog: ClanWeapon[];
  clanInventory: ClanInventoryItem[];
  clanCoinTransactions: ClanCoinTransaction[];
  bossBattleLogs: BossBattleLog[];
  buyClanWeapon: (
    weaponId: string,
    quantity?: number,
    targetClanId?: string
  ) => Promise<{ ok: boolean; message: string; remainingCoins?: number; totalStock?: number }>;
  refreshClanCombatData: () => Promise<void>;

  // Simulation Missions & Atomic EXP Pipeline (Member -> Clan -> City -> Level & Tier)
  simulationMissions: SimulationMission[];
  completedMissionCounts: Record<string, number>;
  missionProgressMap: Record<string, UserMissionProgressRecord>;
  completeClanMission: (
    mission: SimulationMission,
    idempotencyKey?: string
  ) => { ok: boolean; expAdded: number; cityLeveledUp: boolean; newCityLevel: number };
  syncRealAccountExp: () => Promise<{ ok: boolean; message: string; exp?: number }>;
  expTransactions: EXPTransactionRecord[];
  cityLevelHistory: Record<CityId, CityLevelHistoryRecord[]>;
  reconcileWorldConsistency: () => void;
  resetDemoWorldData: () => void;
  resetAllSimulationData: () => void;

  // Global World Stats & Leaderboards
  globalWorldStats: GlobalWorldStats;
  getClanTotalScore: (clanId: string) => number;
  getCityClansLeaderboard: (cityId: CityId) => Clan[];
  getWorldClansLeaderboard: () => Clan[];

  // Atmosphere, Audio, Relics, District Conquest, & Travel Route
  timeOfDay: TimeOfDayMode;
  setTimeOfDay: (mode: TimeOfDayMode) => void;
  soundEnabled: boolean;
  toggleSound: () => void;
  setAmbientLocation: (location: CityId | 'world') => void;
  playerContribution: number;
  relicShards: number;
  relicLevels: Record<string, number>;
  upgradeClanRelic: (clanId: string) => boolean;
  claimDailyRelics: () => { ok: boolean; message: string; shardsAdded: number };
  isDailyRelicClaimed: () => boolean;
  districtInfluence: Record<string, DistrictInfluenceState>;
  reinforceClanDistrict: (clanId: string) => void;
  activeRoute: ActiveTravelRoute | null;
  selectTravelRoute: (fromCityId: CityId, toCityId: CityId) => void;
  clearTravelRoute: () => void;
  toastMessage: string | null;
  dismissToast: () => void;
}

export function getAutoTimeOfDayByCurrentHour(): TimeOfDayMode {
  const hour = new Date().getHours();
  // Malam: 18:00 - 04:59 (jam 6 sore hingga subuh)
  if (hour >= 18 || hour < 5) return 'night';
  // Senja / Sore: 16:00 - 17:59
  if (hour >= 16 && hour < 18) return 'dusk';
  // Siang / Pagi: 05:00 - 15:59
  return 'day';
}

const NuenimeRpgContext = createContext<NuenimeRpgContextValue | null>(null);

export const NuenimeRpgProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [repo, setRepo] = useState<PersistedRepositoryState>(loadInitialRepositoryState);
  const [timeOfDay, setTimeOfDayState] = useState<TimeOfDayMode>(getAutoTimeOfDayByCurrentHour);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [activeRoute, setActiveRoute] = useState<ActiveTravelRoute | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Otomatis sinkronkan suasana siang/senja/malam mengikuti jam nyata lokal
  useEffect(() => {
    const updateAutoTime = () => {
      setTimeOfDayState(getAutoTimeOfDayByCurrentHour());
    };
    updateAutoTime();
    const interval = setInterval(updateAutoTime, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Gudang & Senjata Sekali Pakai (Consumable Weapons & Clan Economy)
  const [weaponsCatalog, setWeaponsCatalog] = useState<ClanWeapon[]>(CONSUMABLE_WEAPONS_CATALOG);
  const [clanInventory, setClanInventory] = useState<ClanInventoryItem[]>([]);
  const [clanCoinTransactions, setClanCoinTransactions] = useState<ClanCoinTransaction[]>([]);
  const [bossBattleLogs, setBossBattleLogs] = useState<BossBattleLog[]>([]);
  const [clanJoinRequests, setClanJoinRequests] = useState<ClanJoinRequest[]>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = window.localStorage.getItem('nuenime_rpg_clan_join_requests');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        }
      }
    } catch {}
    return [];
  });

  // Auto-persist clanJoinRequests ke localStorage agar status "Menunggu Konfirmasi" permanen & tidak hilang saat reload / keluar
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('nuenime_rpg_clan_join_requests', JSON.stringify(clanJoinRequests));
      }
    } catch {}
  }, [clanJoinRequests]);

  // Idempotency lock set to prevent duplicate clan creations or duplicate mission claims
  const processedRequestKeysRef = useRef<Set<string>>(new Set());

  // Persist repository state to localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(repo));
    } catch {
      // Ignore storage quota errors
    }
  }, [repo]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 3800);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const dismissToast = useCallback(() => setToastMessage(null), []);

  const hydratedCities = useMemo(
    () =>
      verifyAndReconcileWorldCities(repo.cities, repo.cityBosses, repo.cityLevelHistory),
    [repo.cities, repo.cityBosses, repo.cityLevelHistory]
  );

  const allClans = useMemo(() => hydratedCities.flatMap((c) => c.clans), [hydratedCities]);

  const getCityById = useCallback(
    (cityId: string) => hydratedCities.find((c) => c.id === cityId),
    [hydratedCities]
  );

  const getClanById = useCallback(
    (clanId: string) => allClans.find((c) => c.id === clanId),
    [allClans]
  );

  const cityLeaders = useMemo(() => {
    const map: Partial<Record<CityId, CityLeaderProfile | null>> = {};
    hydratedCities.forEach((c) => {
      map[c.id] = c.leaderProfile ?? null;
    });
    return map as Record<CityId, CityLeaderProfile | null>;
  }, [hydratedCities]);

  const getCityLeader = useCallback((cityId: CityId): CityLeaderProfile | null => {
    const city = hydratedCities.find((c) => c.id === cityId);
    return city?.leaderProfile ?? null;
  }, [hydratedCities]);

  const getCityBoss = useCallback(
    (cityId: CityId): CityBossRecord => {
      const boss =
        repo.cityBosses.find((b) => b.cityId === cityId) ??
        hydratedCities.find((c) => c.id === cityId)?.boss;
      if (boss) return boss;
      return {
        id: `boss-${cityId}`,
        cityId,
        cityName: cityId,
        name: `Penjaga ${cityId}`,
        title: `Pelindung Takhta`,
        speciesType: 'Entitas Purba',
        element: 'Aether',
        description: `Monster penjaga kota ${cityId}.`,
        characteristic: `Pelindung gerbang ${cityId}.`,
        level: 0,
        tier: 'Tier I',
        maxHp: 10000,
        currentHp: 10000,
        status: 'ACTIVE',
        accentColor: '#38BDF8',
        secondaryColor: '#E0F2FE',
        worldXPercent: 50,
        worldYPercent: 50,
        battleHistoryCount: 0,
        lastUpdatedAt: new Date().toISOString(),
      };
    },
    [repo.cityBosses, hydratedCities]
  );

  const activeAccount: ActiveDemoAccount = useMemo(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const name = params.get('name');
        const uid = params.get('uid');
        const level = params.get('level');
        const exp = params.get('exp');
        const rank = params.get('rank');
        const avatar = params.get('avatar');
        const border = params.get('border');
        const vip = params.get('vip') === '1';

        if (name) {
          const parsedLevel = level ? parseInt(level, 10) : 1;
          const parsedExp = exp ? parseInt(exp, 10) : 0;
          const parsedRank = rank || 'STONE';
          return {
            id: uid || 'nuenime-adventurer',
            displayName: name,
            handle: `@${name.toLowerCase().replace(/\s+/g, '_')}`,
            title: `Petualang Nuenime (${parsedRank} Lv.${parsedLevel})`,
            role: 'CLAN_MEMBER',
            ledCityId: null,
            joinedClanId: repo.joinedClanId,
            isDemoAccount: false,
            isAppAdmin: false,
            avatarUrl: avatar || null,
            borderUrl: border || null,
            level: parsedLevel,
            exp: parsedExp,
            rank: parsedRank,
            isVip: vip,
          };
        }
      }
    } catch {}

    return {
      id: 'nuenime-adventurer',
      displayName: 'Petualang Nuenime',
      handle: '@petualang_nuenime',
      title: 'Petualang Nuenime (STONE Lv.1)',
      role: 'CLAN_MEMBER',
      ledCityId: null,
      isDemoAccount: false,
      isAppAdmin: false,
      joinedClanId: repo.joinedClanId,
      level: 1,
      rank: 'STONE',
      isVip: false,
    };
  }, [repo.joinedClanId]);

  // Saldo Crystal (Diinisialisasi dari parameter 'crystals' Nuenime App, LocalStorage, atau Supabase)
  const [userCrystals, setUserCrystals] = useState<number>(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const queryCrystals = params.get('crystals');
        if (queryCrystals !== null && !isNaN(parseInt(queryCrystals, 10))) {
          return parseInt(queryCrystals, 10);
        }
        const saved = window.localStorage.getItem('nuenime_rpg_crystals');
        if (saved !== null && !isNaN(parseInt(saved, 10))) {
          return parseInt(saved, 10);
        }
      }
    } catch {}
    return 0;
  });

  // Listener pesan lintas frame dari Nuenime App (Web iframe & React Native WebView)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleParentMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (!data) return;
        if ((data.type === 'SYNC_CRYSTALS' || data.type === 'UPDATE_CRYSTALS') && typeof data.crystals === 'number') {
          setUserCrystals(data.crystals);
          try {
            window.localStorage.setItem('nuenime_rpg_crystals', String(data.crystals));
          } catch {}
        }
      } catch {}
    };

    window.addEventListener('message', handleParentMessage);
    return () => window.removeEventListener('message', handleParentMessage);
  }, []);

  const deductCrystals = useCallback((amount: number): boolean => {
    if (userCrystals < amount) return false;
    const next = userCrystals - amount;
    setUserCrystals(next);
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('nuenime_rpg_crystals', String(next));
        const payload = { type: 'DEDUCT_CRYSTALS', amount, userId: activeAccount.id };
        // React Native WebView Android / iOS
        if ((window as any).ReactNativeWebView) {
          (window as any).ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
        // Web Iframe
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(payload, '*');
        }
      }
    } catch {}
    return true;
  }, [userCrystals, activeAccount.id]);

  const addCrystals = useCallback((amount: number) => {
    setUserCrystals((prev) => {
      const next = prev + amount;
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('nuenime_rpg_crystals', String(next));
        }
      } catch {}
      return next;
    });
  }, []);

  // Sinkronisasi data real-time dari Database Supabase (Menghapus ketergantungan data dummy)
  const refreshClanCombatData = useCallback(async () => {
    try {
      const [
        { data: dbWeapons },
        { data: dbInventory },
        { data: dbCoinTx },
        { data: dbBattleLogs },
        { data: dbBosses },
        { data: dbClans },
      ] = await Promise.all([
        supabase.from('rpg_weapons_catalog').select('*').eq('is_active', true).order('price_coin', { ascending: true }),
        supabase.from('rpg_clan_inventory').select('*, weapon:rpg_weapons_catalog(*)'),
        supabase.from('rpg_clan_coin_transactions').select('*').order('created_at', { ascending: false }).limit(40),
        supabase.from('rpg_boss_battle_logs').select('*').order('created_at', { ascending: false }).limit(30),
        supabase.from('rpg_city_bosses').select('*'),
        supabase.from('rpg_clans').select('id, coins'),
      ]);

      if (dbWeapons && dbWeapons.length > 0) {
        setWeaponsCatalog(
          dbWeapons.map((w: any) => ({
            id: w.id,
            name: w.name,
            icon: w.icon,
            description: w.description,
            damage: Number(w.damage),
            priceCoin: Number(w.price_coin),
            rarity: w.rarity,
            isActive: Boolean(w.is_active),
          }))
        );
      }

      if (dbInventory) {
        setClanInventory(
          dbInventory.map((item: any) => ({
            id: item.id,
            clanId: item.clan_id,
            weaponId: item.weapon_id,
            quantity: Number(item.quantity) || 0,
            updatedAt: item.updated_at,
            weapon: item.weapon
              ? {
                  id: item.weapon.id,
                  name: item.weapon.name,
                  icon: item.weapon.icon,
                  description: item.weapon.description,
                  damage: Number(item.weapon.damage),
                  priceCoin: Number(item.weapon.price_coin),
                  rarity: item.weapon.rarity,
                  isActive: Boolean(item.weapon.is_active),
                }
              : undefined,
          }))
        );
      }

      if (dbCoinTx) {
        setClanCoinTransactions(
          dbCoinTx.map((tx: any) => ({
            id: tx.id,
            clanId: tx.clan_id,
            amount: Number(tx.amount),
            balanceAfter: Number(tx.balance_after),
            transactionType: tx.transaction_type,
            description: tx.description,
            actorUserId: tx.actor_user_id,
            actorName: tx.actor_name,
            createdAt: tx.created_at,
          }))
        );
      }

      if (dbBattleLogs) {
        setBossBattleLogs(
          dbBattleLogs.map((log: any) => ({
            id: log.id,
            bossId: log.boss_id || log.target_boss_id,
            targetBossId: log.target_boss_id || log.boss_id,
            targetCityId: log.target_city_id,
            targetCityName: log.target_city_name,
            targetBossName: log.target_boss_name,
            attackerUserId: log.attacker_user_id,
            attackerName: log.attacker_name,
            attackerClanId: log.attacker_clan_id,
            attackerClanName: log.attacker_clan_name,
            originCityId: log.origin_city_id,
            originCityName: log.origin_city_name,
            weaponId: log.weapon_id || log.weapon_used_id,
            weaponUsedId: log.weapon_used_id || log.weapon_id,
            weaponName: log.weapon_name || log.weapon_used_name,
            weaponUsedName: log.weapon_used_name || log.weapon_name,
            baseDamage: Number(log.base_damage) || 0,
            weaponDamage: Number(log.weapon_damage) || 0,
            totalDamage: Number(log.total_damage) || 0,
            bossHpBefore: Number(log.boss_hp_before) || 0,
            bossHpAfter: Number(log.boss_hp_after) || 0,
            bossDefeated: Boolean(log.boss_defeated || log.is_boss_defeated),
            isBossDefeated: Boolean(log.boss_defeated || log.is_boss_defeated),
            roundId: Number(log.round_id) || 1,
            rewardCoins: Number(log.reward_coins) || 0,
            createdAt: log.created_at,
          }))
        );
      }

      setRepo((prev) => {
        let updatedBosses = prev.cityBosses;
        if (dbBosses && dbBosses.length > 0) {
          updatedBosses = prev.cityBosses.map((boss) => {
            const dbB = dbBosses.find((b: any) => b.city_id === boss.cityId || b.id === boss.id);
            if (!dbB) return boss;
            return {
              ...boss,
              tier: dbB.tier || boss.tier || 'Normal',
              level: Number(dbB.level) || boss.level,
              maxHp: Number(dbB.max_hp) || boss.maxHp,
              currentHp: Number(dbB.current_hp),
              status: (dbB.status as any) || boss.status,
              defeatedCount: Number(dbB.defeated_count) || 0,
              currentRound: Number(dbB.current_round) || 1,
              respawnAt: dbB.respawn_at || null,
              lastUpdatedAt: dbB.updated_at || new Date().toISOString(),
            };
          });
        }

        let updatedCities = prev.cities;
        if (dbClans && dbClans.length > 0) {
          updatedCities = prev.cities.map((city) => {
            const nextClans = city.clans.map((clan) => {
              const matchedDbClan = dbClans.find((c: any) => c.id === clan.id);
              if (matchedDbClan) {
                return {
                  ...clan,
                  coins:
                    matchedDbClan.coins !== undefined && matchedDbClan.coins !== null
                      ? Number(matchedDbClan.coins)
                      : (clan.coins ?? 1000),
                };
              }
              return clan;
            });
            return { ...city, clans: nextClans };
          });
        }

        return {
          ...prev,
          cityBosses: updatedBosses,
          cities: updatedCities,
        };
      });
    } catch (err) {
      console.warn('[Dunia Nuenime] Gagal refreshClanCombatData:', err);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function syncFromSupabase() {
      try {
        const [
          { data: dbClans },
          { data: dbCities },
          { data: dbBosses },
          { data: dbProfile },
          { data: dbExpTx },
          { data: dbWeapons },
          { data: dbInventory },
          { data: dbCoinTx },
          { data: dbBattleLogs },
          { data: dbRequests },
          { data: dbBalance },
        ] = await Promise.all([
          supabase.from('rpg_clans').select('*, members:rpg_clan_members(*)').neq('status', 'disbanded'),
          supabase.from('rpg_cities').select('*'),
          supabase.from('rpg_city_bosses').select('*'),
          supabase.from('profiles').select('id, exp, level').eq('id', activeAccount.id).maybeSingle(),
          supabase.from('user_xp_transactions').select('*').eq('user_id', activeAccount.id).order('created_at', { ascending: false }).limit(20),
          supabase.from('rpg_weapons_catalog').select('*').eq('is_active', true).order('price_coin', { ascending: true }),
          supabase.from('rpg_clan_inventory').select('*, weapon:rpg_weapons_catalog(*)'),
          supabase.from('rpg_clan_coin_transactions').select('*').order('created_at', { ascending: false }).limit(40),
          supabase.from('rpg_boss_battle_logs').select('*').order('created_at', { ascending: false }).limit(30),
          supabase.from('rpg_clan_join_requests').select('*').in('status', ['pending', 'approved', 'rejected']).order('created_at', { ascending: false }),
          supabase.from('user_balances').select('crystal_balance').eq('user_id', activeAccount.id).maybeSingle(),
        ]);

        if (isMounted) {
          if (dbBalance && typeof dbBalance.crystal_balance === 'number') {
            setUserCrystals(dbBalance.crystal_balance);
            try {
              window.localStorage.setItem('nuenime_rpg_crystals', String(dbBalance.crystal_balance));
            } catch {}
          }
          if (dbWeapons && dbWeapons.length > 0) {
            setWeaponsCatalog(
              dbWeapons.map((w: any) => ({
                id: w.id,
                name: w.name,
                icon: w.icon,
                description: w.description,
                damage: Number(w.damage),
                priceCoin: Number(w.price_coin),
                rarity: w.rarity,
                isActive: Boolean(w.is_active),
              }))
            );
          }

          if (dbInventory) {
            setClanInventory(
              dbInventory.map((item: any) => ({
                id: item.id,
                clanId: item.clan_id,
                weaponId: item.weapon_id,
                quantity: Number(item.quantity) || 0,
                updatedAt: item.updated_at,
                weapon: item.weapon
                  ? {
                      id: item.weapon.id,
                      name: item.weapon.name,
                      icon: item.weapon.icon,
                      description: item.weapon.description,
                      damage: Number(item.weapon.damage),
                      priceCoin: Number(item.weapon.price_coin),
                      rarity: item.weapon.rarity,
                      isActive: Boolean(item.weapon.is_active),
                    }
                  : undefined,
              }))
            );
          }

          if (dbCoinTx) {
            setClanCoinTransactions(
              dbCoinTx.map((tx: any) => ({
                id: tx.id,
                clanId: tx.clan_id,
                amount: Number(tx.amount),
                balanceAfter: Number(tx.balance_after),
                transactionType: tx.transaction_type,
                description: tx.description,
                actorUserId: tx.actor_user_id,
                actorName: tx.actor_name,
                createdAt: tx.created_at,
              }))
            );
          }

          if (dbBattleLogs) {
            setBossBattleLogs(
              dbBattleLogs.map((log: any) => ({
                id: log.id,
                attackerUserId: log.attacker_user_id,
                attackerName: log.attacker_name,
                attackerClanId: log.attacker_clan_id,
                attackerClanName: log.attacker_clan_name,
                originCityId: log.origin_city_id,
                originCityName: log.origin_city_name,
                targetCityId: log.target_city_id,
                targetCityName: log.target_city_name,
                targetBossId: log.target_boss_id,
                targetBossName: log.target_boss_name,
                baseDamage: Number(log.base_damage) || 0,
                weaponDamage: Number(log.weapon_damage) || 0,
                weaponUsedId: log.weapon_used_id,
                weaponUsedName: log.weapon_used_name,
                totalDamage: Number(log.total_damage) || 0,
                bossHpBefore: Number(log.boss_hp_before) || 0,
                bossHpAfter: Number(log.boss_hp_after) || 0,
                isBossDefeated: Boolean(log.is_boss_defeated),
                rewardCoins: Number(log.reward_coins) || 0,
                createdAt: log.created_at,
              }))
            );
          }

          if (dbRequests && Array.isArray(dbRequests)) {
            const serverRequests: ClanJoinRequest[] = dbRequests.map((r: any) => ({
              id: r.id,
              clanId: r.clan_id,
              userId: r.user_id,
              status: r.status,
              reviewedBy: r.reviewed_by,
              reviewedAt: r.reviewed_at,
              createdAt: r.created_at,
              displayName: r.display_name,
              avatarUrl: r.avatar_url,
              borderUrl: r.border_url,
              level: Number(r.level) || 1,
              exp: Number(r.exp) || 0,
              rank: r.rank || 'STONE',
            }));

            setClanJoinRequests((prev) => {
              const serverKeySet = new Set(
                serverRequests.map((s) => `${s.clanId}_${s.userId}`.toLowerCase())
              );
              // Pertahankan permintaan pending lokal pengguna yang belum tercatat di server agar tidak hilang saat reload / navigasi
              const preservedLocal = prev.filter((local) => {
                const key = `${local.clanId}_${local.userId}`.toLowerCase();
                return !serverKeySet.has(key) && local.status === 'pending';
              });
              const merged = [...serverRequests, ...preservedLocal];
              try {
                if (typeof window !== 'undefined') {
                  window.localStorage.setItem('nuenime_rpg_clan_join_requests', JSON.stringify(merged));
                }
              } catch {}
              return merged;
            });
          }

          setRepo((prev) => {
            const realUserExp =
              dbProfile?.exp != null
                ? Number(dbProfile.exp)
                : typeof activeAccount.exp === 'number' && activeAccount.exp > 0
                ? activeAccount.exp
                : prev.playerContribution;

            // 1. Sinkronisasi Data Kota & Klan Murni dari Database Supabase (Tanpa HP Kota!)
            const nextCities = prev.cities.map((city) => {
              const dbCity = dbCities?.find((c: any) => c.id === city.id);
              const matchedClans = (dbClans || []).filter(
                (c: any) => c.city_id === city.id && !isTestingClan(c)
              );

              const formattedClans: Clan[] = matchedClans.map((c: any) => {
                const activeMembersOnly = (c.members || []).filter(
                  (m: any) => m.status === 'active' || m.status === 'ACTIVE' || !m.status
                );
                const members: ClanMember[] = activeMembersOnly.map((m: any) => {
                  const isCurrentUser = m.user_id === activeAccount.id;
                  const effectiveScore = isCurrentUser
                    ? Math.max(Number(m.contribution_score) || 0, realUserExp)
                    : Number(m.contribution_score) || 0;

                  return {
                    id: m.id,
                    clanId: c.id,
                    userId: m.user_id,
                    name: m.display_name,
                    role: m.role || 'Anggota',
                    contributionScore: effectiveScore,
                    cityId: city.id,
                    level: Number(m.level) || 1,
                    avatarUrl: m.avatar_url || null,
                    borderUrl: m.border_url || null,
                    joinedAt: m.joined_at,
                    lastActive: m.last_active_at,
                  };
                });

                // Jika user adalah pemimpin/pendiri klan ini namun belum ada di array members dari DB
                if (
                  (c.leader_id === activeAccount.id || c.founder_id === activeAccount.id) &&
                  !members.some((m) => m.userId === activeAccount.id)
                ) {
                  members.push({
                    id: `mem-${activeAccount.id}`,
                    clanId: c.id,
                    userId: activeAccount.id,
                    name: activeAccount.displayName.replace(/\s*\(.*\)/, ''),
                    role: 'Pemimpin Klan',
                    title: c.leader_title || 'Pemimpin Klan',
                    elementAffinity: city.element,
                    contributionScore: realUserExp,
                    completedMissionsCount: 0,
                    status: 'ACTIVE',
                    cityId: city.id,
                    level: Number(dbProfile?.level || activeAccount.level) || 1,
                    avatarUrl: activeAccount.avatarUrl || null,
                    borderUrl: activeAccount.borderUrl || null,
                    joinedAt: c.created_at || new Date().toISOString(),
                    lastActive: new Date().toISOString(),
                  });
                }

                const totalExp = members.reduce((sum, m) => sum + m.contributionScore, 0);
                const clanLevel = Math.max(Number(c.level) || 1, Math.floor(totalExp / 1500) + 1);

                return {
                  id: c.id,
                  name: c.name,
                  tag: c.tag,
                  cityId: city.id,
                  cityName: city.name,
                  coins:
                    c.coins !== undefined && c.coins !== null
                      ? Number(c.coins)
                      : 1000,
                  emblemVariant: (c.emblem_variant as ClanEmblemVariant) || 'solar-crown',
                  accentColor: c.accent_color || '#38BDF8',
                  founderId: c.leader_id || 'system',
                  founderName: c.leader_name || 'Pemimpin',
                  founderUserId: c.leader_id || 'system',
                  leaderId: c.leader_id || 'system',
                  leaderName: c.leader_name || 'Pemimpin',
                  leaderTitle: c.leader_title || 'Pemimpin Klan',
                  leaderUserId: c.leader_id || 'system',
                  logoUrl: c.logo_url || undefined,
                  motto: c.slogan || 'Maju demi kejayaan klan',
                  description: c.description || `Klan resmi yang berpusat di Kota ${city.name}`,
                  historyLore: c.history_lore || `Klan ${c.name} berdiri teguh menjaga wilayah ${city.name}.`,
                  memberCount: members.length,
                  maxMembers: c.max_members || 100,
                  totalExp,
                  level: clanLevel,
                  foundedEra: 'Era Komunitas Nuenime',
                  createdAt: c.created_at,
                  lastContributionAt: c.updated_at,
                  strongholdDistrict: 'Distrik Utama',
                  cityMapXPercent: 50,
                  cityMapYPercent: 50,
                  specialization: 'Komunitas & Raid Kota',
                  reputationRank: `Peringkat #${clanLevel}`,
                  members,
                };
              });

              // Pertahankan klan lokal (filter klan testing agar bersih total)
              const existingLocalClans = (city.clans || []).filter((c) => !isTestingClan(c));
              const mergedClans: Clan[] = formattedClans.filter((c) => !isTestingClan(c));
              for (const localClan of existingLocalClans) {
                if (
                  !isTestingClan(localClan) &&
                  !mergedClans.some(
                    (mc) => mc.id === localClan.id || mc.name.toLowerCase() === localClan.name.toLowerCase()
                  )
                ) {
                  mergedClans.push(localClan);
                }
              }

              const cityTotalExp = dbCity
                ? Math.max(Number(dbCity.total_exp) || 0, mergedClans.reduce((sum, c) => sum + c.totalExp, 0))
                : mergedClans.reduce((sum, c) => sum + c.totalExp, 0);
              const levelProgress = computeCityLevelProgressFromTotalExp(cityTotalExp);

              return {
                ...city,
                name: dbCity?.name || city.name,
                epithet: dbCity?.epithet || city.epithet,
                regionName: dbCity?.region || city.regionName,
                element: dbCity?.element || city.element,
                worldXPercent: dbCity?.world_x_percent != null ? Number(dbCity.world_x_percent) : city.worldXPercent,
                worldYPercent: dbCity?.world_y_percent != null ? Number(dbCity.world_y_percent) : city.worldYPercent,
                focusYPercent: dbCity?.focus_y_percent != null ? Number(dbCity.focus_y_percent) : city.focusYPercent,
                material: dbCity?.material || city.material,
                accentHex: dbCity?.accent_hex || city.accentHex,
                secondaryHex: dbCity?.secondary_hex || city.secondaryHex,
                thumbnailAsset: dbCity?.thumbnail_asset || city.thumbnailAsset,
                emblemAsset: dbCity?.emblem_asset || city.emblemAsset,
                shortDescription: dbCity?.description || city.shortDescription,
                fullLore: dbCity?.full_lore || city.fullLore,
                districts: dbCity?.districts && Array.isArray(dbCity.districts) && dbCity.districts.length > 0 ? dbCity.districts : city.districts,
                level: dbCity ? Number(dbCity.level) : levelProgress.level,
                tier: dbCity ? dbCity.tier_name || levelProgress.tier : levelProgress.tier,
                totalExp: cityTotalExp,
                clans: mergedClans,
              };
            });

            // 2. Sinkronisasi Data Bos Kota Murni dari Database Supabase (Level, Tier, HP Bos, Status)
            const nextBosses: CityBossRecord[] = (dbBosses && dbBosses.length > 0)
              ? dbBosses.map((dbBoss: any) => {
                  const existingBoss = prev.cityBosses.find((b) => b.cityId === dbBoss.city_id);
                  const matchedCity = prev.cities.find((c) => c.id === dbBoss.city_id);
                  return {
                    id: dbBoss.id || `boss-${dbBoss.city_id}`,
                    cityId: dbBoss.city_id as CityId,
                    cityName: matchedCity?.name || dbBoss.city_id,
                    name: dbBoss.name || `Penjaga ${matchedCity?.name || dbBoss.city_id}`,
                    title: dbBoss.title || 'Pelindung Takhta',
                    speciesType: dbBoss.species_type || 'Monster Penjaga Purba',
                    element: dbBoss.element || matchedCity?.element || 'Elemental',
                    description: dbBoss.description || '',
                    characteristic: dbBoss.characteristic || '',
                    level: Number(dbBoss.level) || 0,
                    tier: dbBoss.tier || 'Normal',
                    maxHp: Number(dbBoss.max_hp) || 10000,
                    currentHp: Number(dbBoss.current_hp),
                    status: (dbBoss.status as any) || 'ACTIVE',
                    accentColor: dbBoss.accent_color || matchedCity?.accentHex || '#38BDF8',
                    secondaryColor: dbBoss.secondary_color || matchedCity?.secondaryHex || '#E0F2FE',
                    worldXPercent: dbBoss.world_x_percent != null ? Number(dbBoss.world_x_percent) : (existingBoss?.worldXPercent ?? matchedCity?.worldXPercent ?? 50),
                    worldYPercent: dbBoss.world_y_percent != null ? Number(dbBoss.world_y_percent) : (existingBoss?.worldYPercent ?? matchedCity?.worldYPercent ?? 50),
                    battleHistoryCount: Number(dbBoss.defeated_count) || 0,
                    defeatedCount: Number(dbBoss.defeated_count) || 0,
                    respawnAt: dbBoss.respawn_at || null,
                    lastUpdatedAt: dbBoss.updated_at || new Date().toISOString(),
                  };
                })
              : prev.cityBosses;

            // 3. Deteksi Keanggotaan Klan Pengguna Murni dari Database (Filter klan testing & disbanded)
            const userClan = (dbClans || [])
              .filter((c: any) => !isTestingClan(c) && c.status !== 'disbanded')
              .find((c: any) =>
                (c.members || []).some(
                  (m: any) =>
                    m.user_id === activeAccount.id &&
                    (m.status === 'active' || m.status === 'ACTIVE' || !m.status)
                ) ||
                (c.leader_id === activeAccount.id && c.status !== 'disbanded')
              );
            const resolvedJoinedClanId = userClan
              ? userClan.id
              : null;

            const reconciled = verifyAndReconcileWorldCities(nextCities, nextBosses);

            // 4. Background RPC Sync EXP akun ke Database Supabase jika ada EXP aktif
            if (activeAccount.id && activeAccount.id !== 'guest' && realUserExp > 0) {
              void (async () => {
                try {
                  await supabase.rpc('rpc_sync_user_real_exp', { p_user_id: activeAccount.id });
                } catch {
                  await supabase
                    .from('rpg_clan_members')
                    .update({
                      contribution_score: realUserExp,
                      last_active_at: new Date().toISOString(),
                    })
                    .eq('user_id', activeAccount.id);
                }
              })();
            }

            return {
              ...prev,
              cities: reconciled,
              cityBosses: nextBosses,
              districtInfluence: computeRealDistrictInfluence(reconciled),
              joinedClanId: resolvedJoinedClanId,
              playerContribution: realUserExp,
              expTransactions: (dbExpTx && dbExpTx.length > 0)
                ? dbExpTx.map((tx: any) => ({
                    id: String(tx.id),
                    idempotencyKey: `tx-${tx.id}`,
                    userId: tx.user_id,
                    userName: activeAccount.displayName,
                    clanId: resolvedJoinedClanId || '',
                    clanName: 'Klan Nuenime',
                    cityId: 'aetheria',
                    cityName: 'Dunia Nuenime',
                    missionId: tx.activity_type || 'apk_activity',
                    missionTitle: tx.description || `Aktivitas APK (${tx.activity_type})`,
                    activityType: tx.activity_type || 'complete_episode',
                    expAmount: Number(tx.total_xp || tx.base_xp) || 0,
                    source: 'user_xp_transactions',
                    cityLevelBefore: 1,
                    cityLevelAfter: 1,
                    timestamp: tx.created_at || new Date().toISOString(),
                  }))
                : prev.expTransactions,
            };
          });
        }
      } catch (err) {
        console.warn('[Dunia Nuenime] Gagal menyinkronkan data database Supabase:', err);
      }
    }

    void syncFromSupabase();

    // Real-time listener saldo Crystal dari Supabase
    let balanceChannel: any = null;
    if (activeAccount.id && activeAccount.id !== 'guest') {
      balanceChannel = supabase
        .channel(`dunia_crystal_live_${activeAccount.id}_${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_balances',
            filter: `user_id=eq.${activeAccount.id}`,
          },
          (payload: any) => {
            const newBal = payload.new?.crystal_balance;
            if (typeof newBal === 'number' && isMounted) {
              setUserCrystals(newBal);
              try {
                window.localStorage.setItem('nuenime_rpg_crystals', String(newBal));
              } catch {}
            }
          }
        )
        .subscribe();
    }

    return () => {
      isMounted = false;
      if (balanceChannel) {
        supabase.removeChannel(balanceChannel).catch(() => {});
      }
    };
  }, [activeAccount.id]);

  // switchDemoAccount: fitur demo dihapus — semua akun dikelola langsung via Supabase Auth
  const switchDemoAccount = useCallback(
    (_accountId: string) => {
      console.warn('[Dunia Nuenime] switchDemoAccount sudah tidak didukung.');
    },
    []
  );

  /**
   * Memeriksa hak akses pembuatan klan di suatu kota:
   * - SEMUA user di Nuenime dapat mendirikan klan di kota mana saja tanpa batasan pemimpin kota.
   * - Biaya pembuatan klan adalah 2.000 Crystal.
   * - Kapasitas maksimal adalah 15 klan per kota.
   */
  const canCreateClanInCity = useCallback(
    (cityId: CityId): { allowed: boolean; reason: string } => {
      const city = repo.cities.find((c) => c.id === cityId);
      if (!city) {
        return { allowed: false, reason: 'Kota tidak ditemukan di Dunia Nuenime.' };
      }
      if (city.clans.length >= NUENIME_SYSTEM_LIMITS.MAX_CLANS_PER_CITY) {
        return {
          allowed: false,
          reason: `Kapasitas kota ${city.name} telah penuh (${city.clans.length}/${NUENIME_SYSTEM_LIMITS.MAX_CLANS_PER_CITY} Klan).`,
        };
      }

      // 1 User Hanya Dapat Memiliki 1 Klan (Sebagai Pemimpin / Pendiri)
      const existingOwnedClan = allClans.find(
        (c) => c.founderId === activeAccount.id || c.leaderId === activeAccount.id
      );
      if (existingOwnedClan) {
        return {
          allowed: false,
          reason: `Anda sudah memimpin klan "${existingOwnedClan.name}". Setiap petualang hanya dapat mendirikan 1 klan di Dunia Nuenime.`,
        };
      }

      // 1 User Hanya Dapat Bergabung dalam 1 Klan (Tinggalkan klan lama dahulu)
      const existingJoinedClan = repo.joinedClanId
        ? allClans.find((c) => c.id === repo.joinedClanId)
        : allClans.find((c) =>
            c.members?.some(
              (m) => m.userId === activeAccount.id || m.id === activeAccount.id
            )
          );
      if (existingJoinedClan) {
        return {
          allowed: false,
          reason: `Anda saat ini masih terdaftar di klan "${existingJoinedClan.name}". Anda harus keluar dari klan lama jika ingin mendirikan klan baru.`,
        };
      }

      if (userCrystals < 2000) {
        return {
          allowed: false,
          reason: `Crystal tidak mencukupi! Membutuhkan 2.000 Crystal untuk mendirikan klan di ${city.name} (Crystal Anda: ${userCrystals.toLocaleString('id-ID')}).`,
        };
      }
      return {
        allowed: true,
        reason: `Semua petualang Nuenime bebas mendirikan klan di ${city.name} dengan biaya 2.000 Crystal (Crystal Anda: ${userCrystals.toLocaleString('id-ID')}).`,
      };
    },
    [repo.cities, userCrystals, allClans, activeAccount.id, repo.joinedClanId]
  );

  /**
   * 3. PEMBUATAN KLAN BARU (MAKSIMAL 15 KLAN PER KOTA)
   * Divalidasi penuh di tingkat repository (kepemilikan kota, kapasitas 15 klan,
   * validasi nama & tag, serta idempotency key anti-klik ganda).
   */
  const createClanInCity = useCallback(
    async (
      input: CreateClanInput,
      idempotencyKey?: string
    ): Promise<{ ok: boolean; message: string; createdClan?: Clan }> => {
      const reqKey =
        idempotencyKey ?? `create-clan:${input.cityId}:${input.name.trim().toLowerCase()}`;
      if (processedRequestKeysRef.current.has(reqKey)) {
        return {
          ok: false,
          message: 'Permintaan pembuatan klan sedang diproses (mencegah duplikasi).',
        };
      }

      const permission = canCreateClanInCity(input.cityId);
      if (!permission.allowed) {
        return { ok: false, message: permission.reason };
      }

      // Periksa saldo Crystal untuk mendirikan klan (2.000 Crystal)
      if (userCrystals < 2000) {
        return {
          ok: false,
          message: `Crystal Anda tidak mencukupi untuk membuat klan! Membutuhkan 2.000 Crystal (Saldo Anda: ${userCrystals.toLocaleString('id-ID')}).`,
        };
      }

      const cleanName = input.name.trim();
      const cleanTag = input.tag.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
      const cleanDesc = input.description.trim();
      const cleanMotto = (input.motto ?? '').trim() || `Demi kehormatan ${cleanName}!`;

      if (cleanName.length < 3 || cleanName.length > 36) {
        return {
          ok: false,
          message: 'Nama klan wajib diisi antara 3 hingga 36 karakter.',
        };
      }
      if (cleanTag.length < 2 || cleanTag.length > 5) {
        return {
          ok: false,
          message: 'Tag klan wajib 2–5 karakter huruf/angka (contoh: AETH).',
        };
      }
      if (cleanDesc.length < 10) {
        return {
          ok: false,
          message: 'Deskripsi klan minimal 10 karakter.',
        };
      }

      const duplicateName = allClans.some(
        (c) => c.name.toLowerCase() === cleanName.toLowerCase()
      );
      if (duplicateName) {
        return {
          ok: false,
          message: `Nama klan "${cleanName}" sudah terdaftar di Dunia Nuenime.`,
        };
      }

      const duplicateTag = allClans.some((c) => c.tag.toUpperCase() === cleanTag);
      if (duplicateTag) {
        return {
          ok: false,
          message: `Tag klan [${cleanTag}] sudah digunakan oleh klan lain.`,
        };
      }

      processedRequestKeysRef.current.add(reqKey);

      const targetCity = repo.cities.find((c) => c.id === input.cityId)!;
      if (targetCity.clans.length >= NUENIME_SYSTEM_LIMITS.MAX_CLANS_PER_CITY) {
        return {
          ok: false,
          message: `Kapasitas kota ${targetCity.name} sudah mencapai batas 15/15 Klan.`,
        };
      }

      const nowIso = new Date().toISOString();
      const newClanId = `clan-${input.cityId}-${Date.now()}`;
      const existingCount = targetCity.clans.length;

      // Hitung posisi markas baru di Peta Kota secara melingkar agar rapi
      const angle = (existingCount * 137.5 * Math.PI) / 180;
      const radius = 16 + (existingCount % 3) * 6;
      const mapX = Math.round(Math.max(20, Math.min(80, 50 + Math.cos(angle) * radius)));
      const mapY = Math.round(Math.max(22, Math.min(72, 46 + Math.sin(angle) * radius)));

      const founderMember: ClanMember = {
        id: `mem-${Date.now()}`,
        userId: activeAccount.id,
        clanId: newClanId,
        cityId: targetCity.id,
        name: activeAccount.displayName.replace(/\s*\(.*\)/, ''),
        role: 'Pemimpin Klan',
        title: `Pendiri ${cleanName}`,
        elementAffinity: targetCity.element,
        joinedAt: nowIso,
        contributionScore: 0,
        completedMissionsCount: 0,
        status: 'ACTIVE',
      };

      const newClan: Clan = {
        id: newClanId,
        cityId: targetCity.id,
        cityName: targetCity.name,
        name: cleanName,
        tag: cleanTag,
        coins: 1000,
        emblemVariant: input.emblemVariant,
        logoUrl: (input.logoUrl || '').trim() || undefined,
        accentColor: input.accentColor || targetCity.accentHex,
        motto: cleanMotto,
        description: cleanDesc,
        historyLore: `Didirikan secara resmi di ${targetCity.name} oleh ${activeAccount.displayName} untuk memperkuat distrik ${input.strongholdDistrict}.`,
        founderId: activeAccount.id,
        leaderId: activeAccount.id,
        leaderName: founderMember.name,
        leaderTitle: founderMember.title,
        memberCount: 1,
        maxMembers: NUENIME_SYSTEM_LIMITS.MAX_MEMBERS_PER_CLAN,
        totalExp: 0,
        level: 1,
        foundedEra: 'Era Komunitas Baru',
        createdAt: nowIso,
        lastContributionAt: nowIso,
        strongholdDistrict:
          input.strongholdDistrict || targetCity.districts[0]?.name || 'Distrik Pusat',
        cityMapXPercent: mapX,
        cityMapYPercent: mapY,
        specialization: input.specialization || 'Pertahanan & Kontribusi Komunitas',
        reputationRank: `Peringkat ${existingCount + 1} — ${targetCity.name}`,
        members: [founderMember],
      };

      // 1. Simpan langsung ke Supabase (Database Real Dunia Nuenime) dengan pengecekan
      try {
        const { error: clanInsertError } = await supabase.from('rpg_clans').insert({
          id: newClan.id,
          city_id: input.cityId,
          name: cleanName,
          tag: cleanTag,
          slogan: input.motto?.trim() || 'Bersatu dalam kejayaan Nuenime',
          description: input.description?.trim() || 'Klan petualang aktif di Dunia Nuenime.',
          logo_url: input.logoUrl?.trim() || null,
          leader_id: activeAccount.id,
          leader_name: activeAccount.displayName,
          level: 1,
          total_exp: 0,
          member_count: 1,
          max_members: NUENIME_SYSTEM_LIMITS.MAX_MEMBERS_PER_CLAN,
          verified: true,
        });

        if (clanInsertError) {
          console.warn('[Supabase DB] Error saat menyimpan klan baru:', clanInsertError);
          return {
            ok: false,
            message:
              clanInsertError.message ||
              'Gagal mendirikan klan di server database. Pastikan nama/tag belum digunakan.',
          };
        }

        const { error: memberInsertError } = await supabase.from('rpg_clan_members').insert({
          clan_id: newClan.id,
          user_id: activeAccount.id,
          display_name: activeAccount.displayName,
          avatar_url: activeAccount.avatarUrl || null,
          border_url: activeAccount.borderUrl || null,
          role: 'Pemimpin Klan',
          contribution_score: 0,
          level: activeAccount.level || 1,
        });

        if (memberInsertError) {
          console.warn('[Supabase DB] Error saat menyimpan member founder:', memberInsertError);
        }

        await supabase.from('rpg_exp_transactions').insert({
          user_id: activeAccount.id,
          clan_id: newClan.id,
          city_id: input.cityId,
          amount: 0,
          source_type: 'CLAN_CREATE',
          description: `Pendirian klan "${cleanName}" oleh ${activeAccount.displayName}`,
        });
      } catch (dbErr: any) {
        console.warn('[Supabase DB] Exception saat menyimpan klan baru:', dbErr);
      }

      // Potong 2.000 Crystal setelah insert berhasil
      deductCrystals(2000);

      fantasySoundEngine.playClanJoinFanfare();

      setRepo((prev) => {
        const nextCities = prev.cities.map((c) => {
          if (c.id !== input.cityId) return c;
          if (c.clans.length >= NUENIME_SYSTEM_LIMITS.MAX_CLANS_PER_CITY) return c;
          return {
            ...c,
            clans: [...c.clans, newClan],
          };
        });

        const nextState = {
          ...prev,
          cities: verifyAndReconcileWorldCities(nextCities),
          joinedClanId: newClan.id,
          relicLevels: {
            ...prev.relicLevels,
            [newClan.id]: 1,
          },
          districtInfluence: {
            ...prev.districtInfluence,
            [newClan.id]: {
              clanId: newClan.id,
              cityId: targetCity.id,
              districtName: newClan.strongholdDistrict,
              influencePercent: 60,
            },
          },
        };

        saveStoredRepository(nextState);
        return nextState;
      });

      const updatedCount = existingCount + 1;
      showToast(
        `Klan "${cleanName}" resmi didirikan di ${targetCity.name} (-2.000 Crystal)! (${updatedCount}/${NUENIME_SYSTEM_LIMITS.MAX_CLANS_PER_CITY} Klan)`
      );

      return {
        ok: true,
        message: `Klan ${cleanName} berhasil dibuat.`,
        createdClan: newClan,
      };
    },
    [activeAccount.displayName, activeAccount.id, allClans, canCreateClanInCity, deductCrystals, repo.cities, showToast, userCrystals]
  );

  /**
   * 4. BERGABUNG KE KLAN (MAKSIMAL 100 ANGGOTA PER KLAN)
   * Memastikan:
   * - Satu pengguna tidak dihitung dua kali dalam klan yang sama.
   * - Jumlah anggota tidak melebihi 100.
   * - Jumlah anggota konsisten dengan array members sebenarnya.
   */
  /**
   * 4. SISTEM PERMINTAAN BERGABUNG, KELUAR, DISBAND, & TRANSFER KLAN
   */
  const getUserJoinRequest = useCallback(
    (clanId: string): ClanJoinRequest | undefined => {
      const activeId = activeAccount.id?.trim();
      return clanJoinRequests.find((r) => {
        if (r.clanId !== clanId || r.status !== 'pending') return false;
        if (!activeId || activeId === 'guest') return false;
        if (r.userId === activeId) return true;
        if (r.userId && r.userId.trim().toLowerCase() === activeId.toLowerCase()) return true;
        return false;
      });
    },
    [clanJoinRequests, activeAccount.id]
  );

  const refreshClanData = useCallback(async () => {
    try {
      const [
        { data: dbClans },
        { data: dbRequests },
        { data: dbMembers },
      ] = await Promise.all([
        supabase.from('rpg_clans').select('*, members:rpg_clan_members(*)').neq('status', 'disbanded'),
        supabase.from('rpg_clan_join_requests').select('*').in('status', ['pending', 'approved', 'rejected']).order('created_at', { ascending: false }),
        supabase.from('rpg_clan_members').select('*').eq('status', 'active'),
      ]);

      if (dbRequests && Array.isArray(dbRequests)) {
        const serverRequests: ClanJoinRequest[] = dbRequests.map((r: any) => ({
          id: r.id,
          clanId: r.clan_id,
          userId: r.user_id,
          status: r.status,
          reviewedBy: r.reviewed_by,
          reviewedAt: r.reviewed_at,
          createdAt: r.created_at,
          displayName: r.display_name,
          avatarUrl: r.avatar_url,
          borderUrl: r.border_url,
          level: Number(r.level) || 1,
          exp: Number(r.exp) || 0,
          rank: r.rank || 'STONE',
        }));

        setClanJoinRequests((prev) => {
          const serverKeySet = new Set(
            serverRequests.map((s) => `${s.clanId}_${s.userId}`.toLowerCase())
          );
          const preservedLocal = prev.filter((local) => {
            const key = `${local.clanId}_${local.userId}`.toLowerCase();
            return !serverKeySet.has(key) && local.status === 'pending';
          });
          const merged = [...serverRequests, ...preservedLocal];
          try {
            if (typeof window !== 'undefined') {
              window.localStorage.setItem('nuenime_rpg_clan_join_requests', JSON.stringify(merged));
            }
          } catch {}
          return merged;
        });
      }

      if (dbMembers) {
        const activeUserMembership = dbMembers.find((m: any) => m.user_id === activeAccount.id);
        if (activeUserMembership) {
          setRepo((prev) => ({
            ...prev,
            joinedClanId: activeUserMembership.clan_id,
          }));
        } else {
          setRepo((prev) => ({
            ...prev,
            joinedClanId: null,
          }));
        }
      }
    } catch (err) {
      console.warn('[Dunia Nuenime] Gagal refreshClanData:', err);
    }
  }, [activeAccount.id]);

  // Realtime subscription untuk mendeteksi permintaan bergabung klan secara instan antar perangkat
  useEffect(() => {
    const channel = supabase
      .channel('realtime:rpg_clan_join_requests')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rpg_clan_join_requests' },
        () => {
          void refreshClanData();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refreshClanData]);

  const requestJoinClan = useCallback(
    async (
      clanId: string
    ): Promise<{
      ok: boolean;
      message: string;
      requiresLeaveFirst?: boolean;
      currentClanName?: string;
    }> => {
      const targetClan = allClans.find((c) => c.id === clanId);
      if (!targetClan) {
        return { ok: false, message: 'Klan tidak ditemukan di Dunia Nuenime.' };
      }

      // 1. Cek apakah user sudah menjadi anggota aktif klan ini
      const isAlreadyMemberThisClan = targetClan.members.some(
        (m) =>
          (m.userId === activeAccount.id || m.id === activeAccount.id) &&
          (m.status === 'active' || m.status === 'ACTIVE' || !m.status)
      );
      if (repo.joinedClanId === clanId || isAlreadyMemberThisClan) {
        showToast(`Anda sudah menjadi anggota aktif di klan ${targetClan.name}.`);
        return { ok: true, message: `Sudah menjadi anggota aktif di klan ${targetClan.name}.` };
      }

      // 2. Cek apakah user sedang aktif di klan LAIN -> Buka konfirmasi berpindah klan!
      if (repo.joinedClanId && repo.joinedClanId !== clanId) {
        const currentClan = allClans.find((c) => c.id === repo.joinedClanId);
        const currentClanName = currentClan?.name || 'Klan Saat Ini';
        return {
          ok: false,
          message: `Anda masih tergabung dalam klan ${currentClanName}. Untuk bergabung dengan klan ${targetClan.name}, Anda harus keluar dari klan saat ini terlebih dahulu. Apakah Anda ingin keluar dari klan sekarang?`,
          requiresLeaveFirst: true,
          currentClanName,
        };
      }

      // 3. Cek apakah sudah ada permintaan pending untuk klan ini
      const activeId = activeAccount.id?.trim();
      const existingPending = clanJoinRequests.find(
        (r) =>
          r.clanId === clanId &&
          r.status === 'pending' &&
          (r.userId === activeId || (activeId && r.userId && r.userId.trim().toLowerCase() === activeId.toLowerCase()))
      );
      if (existingPending) {
        showToast(`Permintaan Anda sedang menunggu konfirmasi dari Pemimpin ${targetClan.name}.`);
        return {
          ok: false,
          message: `Permintaan bergabung ke ${targetClan.name} sudah terkirim (Menunggu Konfirmasi Pemimpin).`,
        };
      }

      // 4. Panggil RPC Supabase rpc_request_join_clan atau fallback langsung ke tabel
      try {
        const { data, error } = await supabase.rpc('rpc_request_join_clan', {
          p_clan_id: clanId,
          p_user_id: activeAccount.id,
          p_display_name: activeAccount.displayName.replace(/\s*\(.*\)/, '') || 'Petualang',
          p_avatar_url: activeAccount.avatarUrl || null,
          p_border_url: activeAccount.borderUrl || null,
          p_level: activeAccount.level || 1,
        });

        if (error) {
          console.warn('[Supabase RPC] Error request_join_clan, mencoba fallback tabel:', error);
          try {
            await supabase.from('rpg_clan_join_requests').upsert(
              {
                clan_id: clanId,
                user_id: activeAccount.id,
                status: 'pending',
                display_name: activeAccount.displayName.replace(/\s*\(.*\)/, '') || 'Petualang',
                avatar_url: activeAccount.avatarUrl || null,
                border_url: activeAccount.borderUrl || null,
                level: activeAccount.level || 1,
                exp: activeAccount.exp || 0,
                rank: activeAccount.rank || 'STONE',
                created_at: new Date().toISOString(),
              },
              { onConflict: 'clan_id,user_id' }
            );
          } catch (tableErr) {
            console.warn('[Supabase Table Fallback] Gagal upsert rpg_clan_join_requests:', tableErr);
          }
        } else if (data) {
          if (!data.ok) {
            if (data.requires_leave_first) {
              return {
                ok: false,
                message: data.message,
                requiresLeaveFirst: true,
                currentClanName: data.current_clan_name,
              };
            }
            showToast(data.message);
            return { ok: false, message: data.message };
          }
        }
      } catch (rpcErr) {
        console.warn('[Supabase RPC] Exception request_join_clan:', rpcErr);
        try {
          await supabase.from('rpg_clan_join_requests').upsert(
            {
              clan_id: clanId,
              user_id: activeAccount.id,
              status: 'pending',
              display_name: activeAccount.displayName.replace(/\s*\(.*\)/, '') || 'Petualang',
              avatar_url: activeAccount.avatarUrl || null,
              border_url: activeAccount.borderUrl || null,
              level: activeAccount.level || 1,
              exp: activeAccount.exp || 0,
              rank: activeAccount.rank || 'STONE',
              created_at: new Date().toISOString(),
            },
            { onConflict: 'clan_id,user_id' }
          );
        } catch {}
      }

      // 5. Tambahkan request pending ke state lokal & localStorage secara permanen
      const newReq: ClanJoinRequest = {
        id: `req-${activeAccount.id}-${Date.now()}`,
        clanId,
        userId: activeAccount.id,
        status: 'pending',
        createdAt: new Date().toISOString(),
        displayName: activeAccount.displayName.replace(/\s*\(.*\)/, ''),
        avatarUrl: activeAccount.avatarUrl || null,
        borderUrl: activeAccount.borderUrl || null,
        level: activeAccount.level || 1,
        exp: activeAccount.exp || 0,
        rank: activeAccount.rank || 'STONE',
        clanName: targetClan.name,
        clanTag: targetClan.tag,
      };

      setClanJoinRequests((prev) => {
        const next = [
          newReq,
          ...prev.filter(
            (r) =>
              !(
                r.clanId === clanId &&
                (r.userId === activeAccount.id ||
                  (activeAccount.id && r.userId && r.userId.trim().toLowerCase() === activeAccount.id.trim().toLowerCase()))
              )
          ),
        ];
        try {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('nuenime_rpg_clan_join_requests', JSON.stringify(next));
          }
        } catch {}
        return next;
      });

      fantasySoundEngine.playTap();
      showToast(`Permintaan bergabung ke ${targetClan.name} terkirim! Menunggu konfirmasi Pemimpin.`);
      return {
        ok: true,
        message: `Permintaan terkirim. Menunggu konfirmasi Pemimpin ${targetClan.name}.`,
      };
    },
    [allClans, activeAccount, repo.joinedClanId, clanJoinRequests, showToast]
  );

  const respondJoinRequest = useCallback(
    async (
      requestId: string,
      action: 'approve' | 'reject'
    ): Promise<{ ok: boolean; message: string }> => {
      let rpcHandled = false;
      try {
        const { data, error } = await supabase.rpc('rpc_respond_clan_join_request', {
          p_request_id: requestId,
          p_actor_user_id: activeAccount.id,
          p_action: action,
        });

        if (error) {
          console.warn('[Supabase RPC] Error respond_clan_join_request:', error);
        } else if (data && !data.ok) {
          showToast(data.message);
          return { ok: false, message: data.message };
        } else if (data && data.ok) {
          rpcHandled = true;
        }
      } catch (rpcErr) {
        console.warn('[Supabase RPC] Exception respond_clan_join_request:', rpcErr);
      }

      // Fallback update status di tabel rpg_clan_join_requests jika RPC belum berjalan
      if (!rpcHandled) {
        try {
          await supabase
            .from('rpg_clan_join_requests')
            .update({
              status: action === 'approve' ? 'approved' : 'rejected',
              reviewed_by: activeAccount.id,
              reviewed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', requestId);
        } catch (updateErr) {
          console.warn('[Supabase direct] Update join request error:', updateErr);
        }
      }

      const targetReq = clanJoinRequests.find((r) => r.id === requestId);
      if (action === 'approve' && targetReq) {
        // Fallback insert/update member ke rpg_clan_members jika belum diproses oleh RPC
        if (!rpcHandled) {
          try {
            const { data: existingRows } = await supabase
              .from('rpg_clan_members')
              .select('id')
              .eq('clan_id', targetReq.clanId)
              .eq('user_id', targetReq.userId)
              .limit(1);

            if (existingRows && existingRows.length > 0) {
              await supabase
                .from('rpg_clan_members')
                .update({
                  status: 'active',
                  role: 'Anggota',
                  display_name: targetReq.displayName || 'Petualang',
                  avatar_url: targetReq.avatarUrl || null,
                  border_url: targetReq.borderUrl || null,
                  level: targetReq.level || 1,
                  last_active_at: new Date().toISOString(),
                })
                .eq('id', existingRows[0].id);
            } else {
              await supabase.from('rpg_clan_members').insert({
                clan_id: targetReq.clanId,
                user_id: targetReq.userId,
                display_name: targetReq.displayName || 'Petualang',
                avatar_url: targetReq.avatarUrl || null,
                border_url: targetReq.borderUrl || null,
                role: 'Anggota',
                level: targetReq.level || 1,
                status: 'active',
                contribution_score: 0,
                joined_at: new Date().toISOString(),
                last_active_at: new Date().toISOString(),
              });
            }

            // Sync user profile clan_id jika ada
            try {
              await supabase
                .from('rpg_user_profiles')
                .update({
                  clan_id: targetReq.clanId,
                  updated_at: new Date().toISOString(),
                })
                .eq('user_id', targetReq.userId);
            } catch {}
          } catch (memberErr) {
            console.warn('[Supabase direct] Member save error:', memberErr);
          }
        }

        // Tambahkan ke repo anggota klan secara lokal jika belum terdaftar
        setRepo((prev) => {
          const nextCities = prev.cities.map((c) => ({
            ...c,
            clans: c.clans.map((cl) => {
              if (cl.id !== targetReq.clanId) return cl;
              const alreadyMember = cl.members.some(
                (m) => m.userId === targetReq.userId || m.id === targetReq.userId
              );
              if (alreadyMember) return cl;
              const newMember: ClanMember = {
                id: targetReq.userId,
                userId: targetReq.userId,
                clanId: targetReq.clanId,
                cityId: (cl.cityId || 'CITY_1') as CityId,
                name: targetReq.displayName || 'Petualang',
                role: 'Anggota',
                title: 'Petualang Klan',
                elementAffinity: 'Netral',
                avatarUrl: targetReq.avatarUrl,
                borderUrl: targetReq.borderUrl,
                level: targetReq.level || 1,
                contributionScore: 0,
                completedMissionsCount: 0,
                joinedAt: new Date().toISOString(),
                lastActive: new Date().toISOString(),
                status: 'active',
              };
              return {
                ...cl,
                memberCount: cl.memberCount + 1,
                members: [...cl.members, newMember],
              };
            }),
          }));

          return {
            ...prev,
            cities: nextCities,
            ...(targetReq.userId === activeAccount.id ? { joinedClanId: targetReq.clanId } : {}),
          };
        });
      }

      setClanJoinRequests((prev) => {
        const next = prev.map((r) =>
          r.id === requestId
            ? {
                ...r,
                status: (action === 'approve' ? 'approved' : 'rejected') as ClanJoinRequestStatus,
                reviewedBy: activeAccount.id,
                reviewedAt: new Date().toISOString(),
              }
            : r
        );
        try {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('nuenime_rpg_clan_join_requests', JSON.stringify(next));
          }
        } catch {}
        return next;
      });

      if (action === 'approve') {
        fantasySoundEngine.playClanJoinFanfare();
        showToast('Permintaan disetujui! Anggota baru telah resmi bergabung ke klan.');
      } else {
        showToast('Permintaan bergabung ditolak.');
      }

      void refreshClanData();
      return {
        ok: true,
        message: action === 'approve' ? 'Permintaan diterima.' : 'Permintaan ditolak.',
      };
    },
    [activeAccount.id, clanJoinRequests, showToast, refreshClanData]
  );

  const cancelJoinRequest = useCallback(
    async (clanId: string): Promise<{ ok: boolean; message: string }> => {
      try {
        await supabase.rpc('rpc_cancel_clan_join_request', {
          p_clan_id: clanId,
          p_user_id: activeAccount.id,
        });
      } catch (err) {
        console.warn('[Supabase RPC] cancel_clan_join_request error:', err);
      }

      try {
        await supabase
          .from('rpg_clan_join_requests')
          .delete()
          .eq('clan_id', clanId)
          .eq('user_id', activeAccount.id);
      } catch {}

      setClanJoinRequests((prev) => {
        const next = prev.filter(
          (r) =>
            !(
              r.clanId === clanId &&
              (r.userId === activeAccount.id ||
                (activeAccount.id && r.userId && r.userId.trim().toLowerCase() === activeAccount.id.trim().toLowerCase())) &&
              r.status === 'pending'
            )
        );
        try {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('nuenime_rpg_clan_join_requests', JSON.stringify(next));
          }
        } catch {}
        return next;
      });

      showToast('Permintaan bergabung dibatalkan.');
      return { ok: true, message: 'Permintaan bergabung dibatalkan.' };
    },
    [activeAccount.id, showToast]
  );

  const leaveClan = useCallback(
    async (
      clanId: string
    ): Promise<{
      ok: boolean;
      message: string;
      isLeader?: boolean;
      hasOtherMembers?: boolean;
    }> => {
      const targetClan = allClans.find((c) => c.id === clanId);
      if (!targetClan) {
        return { ok: false, message: 'Klan tidak ditemukan.' };
      }

      try {
        const { data, error } = await supabase.rpc('rpc_leave_clan', {
          p_clan_id: clanId,
          p_user_id: activeAccount.id,
        });

        if (error) {
          console.warn('[Supabase RPC] Error leave_clan:', error);
        } else if (data && !data.ok) {
          if (data.is_leader && data.has_other_members) {
            return {
              ok: false,
              message: data.message,
              isLeader: true,
              hasOtherMembers: true,
            };
          }
          showToast(data.message);
          return { ok: false, message: data.message };
        }
      } catch (rpcErr) {
        console.warn('[Supabase RPC] Exception leave_clan:', rpcErr);
      }

      setRepo((prev) => {
        const nextCities = prev.cities.map((city) => {
          if (city.id !== targetClan.cityId) return city;
          return {
            ...city,
            clans: city.clans.map((clan) => {
              if (clan.id !== clanId) return clan;
              const remainingMembers = clan.members.filter(
                (m) => m.userId !== activeAccount.id && m.id !== activeAccount.id
              );
              return {
                ...clan,
                members: remainingMembers,
                memberCount: remainingMembers.length,
              };
            }),
          };
        });

        const nextState = {
          ...prev,
          cities: verifyAndReconcileWorldCities(nextCities),
          joinedClanId: null,
        };
        saveStoredRepository(nextState);
        return nextState;
      });

      fantasySoundEngine.playTap();
      showToast(`Anda telah resmi keluar dari klan ${targetClan.name}.`);
      void refreshClanData();
      return { ok: true, message: `Berhasil keluar dari klan ${targetClan.name}.` };
    },
    [allClans, activeAccount.id, showToast, refreshClanData]
  );

  const disbandClan = useCallback(
    async (clanId: string): Promise<{ ok: boolean; message: string }> => {
      const targetClan = allClans.find((c) => c.id === clanId);
      if (!targetClan) {
        return { ok: false, message: 'Klan tidak ditemukan.' };
      }

      try {
        const { data, error } = await supabase.rpc('rpc_disband_clan', {
          p_clan_id: clanId,
          p_actor_user_id: activeAccount.id,
        });

        if (error) {
          console.warn('[Supabase RPC] Error disband_clan:', error);
        } else if (data && !data.ok) {
          showToast(data.message);
          return { ok: false, message: data.message };
        }
      } catch (rpcErr) {
        console.warn('[Supabase RPC] Exception disband_clan:', rpcErr);
      }

      setRepo((prev) => {
        const nextCities = prev.cities.map((city) => {
          if (city.id !== targetClan.cityId) return city;
          return {
            ...city,
            clans: city.clans.filter((c) => c.id !== clanId),
          };
        });

        const nextState = {
          ...prev,
          cities: verifyAndReconcileWorldCities(nextCities),
          joinedClanId: prev.joinedClanId === clanId ? null : prev.joinedClanId,
        };
        saveStoredRepository(nextState);
        return nextState;
      });

      fantasySoundEngine.playTap();
      showToast(`Klan "${targetClan.name}" telah resmi dibubarkan.`);
      void refreshClanData();
      return { ok: true, message: `Klan ${targetClan.name} berhasil dibubarkan.` };
    },
    [allClans, activeAccount.id, showToast, refreshClanData]
  );

  const transferClanLeadership = useCallback(
    async (clanId: string, newLeaderId: string): Promise<{ ok: boolean; message: string }> => {
      try {
        const { data, error } = await supabase.rpc('rpc_transfer_clan_leadership', {
          p_clan_id: clanId,
          p_current_leader_id: activeAccount.id,
          p_new_leader_id: newLeaderId,
        });

        if (error) {
          console.warn('[Supabase RPC] Error transfer_clan_leadership:', error);
        } else if (data && !data.ok) {
          showToast(data.message);
          return { ok: false, message: data.message };
        }
      } catch (rpcErr) {
        console.warn('[Supabase RPC] Exception transfer_clan_leadership:', rpcErr);
      }

      setRepo((prev) => {
        const nextCities = prev.cities.map((city) => ({
          ...city,
          clans: city.clans.map((clan) => {
            if (clan.id !== clanId) return clan;
            return {
              ...clan,
              leaderId: newLeaderId,
              members: clan.members.map((m) => {
                if (m.userId === newLeaderId || m.id === newLeaderId) {
                  return { ...m, role: 'Pemimpin Klan' };
                }
                if (m.userId === activeAccount.id || m.id === activeAccount.id) {
                  return { ...m, role: 'Anggota' };
                }
                return m;
              }),
            };
          }),
        }));

        const nextState = {
          ...prev,
          cities: verifyAndReconcileWorldCities(nextCities),
        };
        saveStoredRepository(nextState);
        return nextState;
      });

      fantasySoundEngine.playTap();
      showToast('Kepemimpinan klan berhasil dialihkan.');
      void refreshClanData();
      return { ok: true, message: 'Kepemimpinan klan berhasil dialihkan.' };
    },
    [activeAccount.id, showToast, refreshClanData]
  );

  const joinClan = useCallback(
    (clanId: string): { ok: boolean; message: string } => {
      void requestJoinClan(clanId);
      return { ok: true, message: 'Memproses permintaan bergabung...' };
    },
    [requestJoinClan]
  );

  const updateClanLogo = useCallback(
    (clanId: string, logoUrl: string): { ok: boolean; message: string } => {
      const cleanUrl = logoUrl.trim();
      setRepo((prev) => {
        let found = false;
        const nextCities = prev.cities.map((city) => {
          const nextClans = city.clans.map((clan) => {
            if (clan.id === clanId) {
              found = true;
              return { ...clan, logoUrl: cleanUrl || undefined };
            }
            return clan;
          });
          return { ...city, clans: nextClans };
        });
        if (!found) return prev;
        const nextState = { ...prev, cities: nextCities };
        saveStoredRepository(nextState);
        return nextState;
      });

      // Simpan perubahan logo klan ke database Supabase
      void (async () => {
        try {
          await supabase
            .from('rpg_clans')
            .update({
              logo_url: cleanUrl || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', clanId);
        } catch (dbErr) {
          console.warn('[Supabase DB] Error update logo klan:', dbErr);
        }
      })();

      showToast('Logo klan berhasil diperbarui!');
      return { ok: true, message: 'Logo klan berhasil diperbarui!' };
    },
    [showToast]
  );

  const updateClanProfile = useCallback(
    (
      clanId: string,
      updates: {
        name?: string;
        tag?: string;
        motto?: string;
        description?: string;
        logoUrl?: string;
      }
    ): { ok: boolean; message: string } => {
      setRepo((prev) => {
        let found = false;
        const nextCities = prev.cities.map((city) => {
          const nextClans = city.clans.map((clan) => {
            if (clan.id === clanId) {
              found = true;
              return {
                ...clan,
                name: updates.name?.trim() ? updates.name.trim() : clan.name,
                tag: updates.tag?.trim() ? updates.tag.trim().toUpperCase() : clan.tag,
                motto: updates.motto !== undefined ? updates.motto.trim() : clan.motto,
                description:
                  updates.description !== undefined ? updates.description.trim() : clan.description,
                logoUrl:
                  updates.logoUrl !== undefined
                    ? updates.logoUrl.trim() || undefined
                    : clan.logoUrl,
              };
            }
            return clan;
          });
          return { ...city, clans: nextClans };
        });
        if (!found) return prev;
        const nextState = { ...prev, cities: nextCities };
        saveStoredRepository(nextState);
        return nextState;
      });
      showToast('Pengaturan profil klan berhasil disimpan!');

      // Simpan perubahan profil klan ke database Supabase
      void (async () => {
        try {
          const updatePayload: Record<string, any> = {
            updated_at: new Date().toISOString(),
          };
          if (updates.name) updatePayload.name = updates.name.trim();
          if (updates.tag) updatePayload.tag = updates.tag.trim().toUpperCase();
          if (updates.motto !== undefined) updatePayload.slogan = updates.motto.trim();
          if (updates.description !== undefined) updatePayload.description = updates.description.trim();
          if (updates.logoUrl !== undefined) updatePayload.logo_url = updates.logoUrl.trim() || null;

          await supabase.from('rpg_clans').update(updatePayload).eq('id', clanId);
        } catch (dbErr) {
          console.warn('[Supabase DB] Error update profil klan:', dbErr);
        }
      })();

      return { ok: true, message: 'Profil klan berhasil diperbarui!' };
    },
    [showToast]
  );

  const updateMemberRole = useCallback(
    (clanId: string, memberId: string, newRole: string): { ok: boolean; message: string } => {
      setRepo((prev) => {
        let found = false;
        const nextCities = prev.cities.map((city) => {
          const nextClans = city.clans.map((clan) => {
            if (clan.id === clanId) {
              const nextMembers = clan.members.map((m) => {
                if (m.id === memberId || m.userId === memberId) {
                  found = true;
                  return { ...m, role: newRole };
                }
                return m;
              });
              return { ...clan, members: nextMembers };
            }
            return clan;
          });
          return { ...city, clans: nextClans };
        });
        if (!found) return prev;
        const nextState = { ...prev, cities: nextCities };
        saveStoredRepository(nextState);
        return nextState;
      });
      showToast(`Jabatan anggota berhasil diubah menjadi "${newRole}"!`);

      // Simpan perubahan jabatan anggota ke database Supabase
      void (async () => {
        try {
          await supabase
            .from('rpg_clan_members')
            .update({
              role: newRole,
              last_active_at: new Date().toISOString(),
            })
            .eq('clan_id', clanId)
            .or(`id.eq.${memberId},user_id.eq.${memberId}`);
        } catch (dbErr) {
          console.warn('[Supabase DB] Error update jabatan member:', dbErr);
        }
      })();

      return { ok: true, message: `Jabatan berhasil diubah ke ${newRole}` };
    },
    [showToast]
  );

  /**
   * 8 & 9. ALUR EXP ATOMIK DARI ANGGOTA -> KLAN -> KOTA -> LEVEL & TIER KOTA
   * Aktivitas anggota -> EXP kontribusi anggota -> EXP klan -> total EXP kota -> progres level kota.
   * Catatan: Aktivitas misi anime menghasilkan EXP dan TIDAK mengurangi HP Bos secara otomatis.
   */
  const completeClanMission = useCallback(
    (
      mission: SimulationMission,
      idempotencyKey?: string
    ): { ok: boolean; expAdded: number; cityLeveledUp: boolean; newCityLevel: number } => {
      if (!mission.isActive) {
        showToast('Misi ini sedang tidak aktif.');
        return { ok: false, expAdded: 0, cityLeveledUp: false, newCityLevel: 1 };
      }

      const txKey =
        idempotencyKey ?? `mission-claim:${activeAccount.id}:${mission.id}:${Date.now()}`;
      if (processedRequestKeysRef.current.has(txKey)) {
        return { ok: false, expAdded: 0, cityLeveledUp: false, newCityLevel: 1 };
      }
      processedRequestKeysRef.current.add(txKey);

      const targetClan =
        allClans.find((c) => c.id === repo.joinedClanId);
      if (!targetClan) {
        showToast('Anda harus mendirikan atau bergabung ke klan terlebih dahulu untuk menyelesaikan misi!');
        return { ok: false, expAdded: 0, cityLeveledUp: false, newCityLevel: 1 };
      }
      const targetCity = repo.cities.find((c) => c.id === targetClan.cityId);
      if (!targetCity) {
        return { ok: false, expAdded: 0, cityLeveledUp: false, newCityLevel: 1 };
      }

      const expReward = Math.max(1, Math.floor(mission.rewardExp ?? 0));
      const shardReward = Math.max(0, Math.floor(mission.rewardShard ?? 0));
      const nowIso = new Date().toISOString();

      const cityLevelBefore = targetCity.level;
      const cityTierBefore = targetCity.tier;
      const newCityTotalExp = targetCity.totalExp + expReward;
      const nextCityProgress = computeCityLevelProgressFromTotalExp(newCityTotalExp);
      const cityLevelAfter = nextCityProgress.level;
      const cityTierAfter = nextCityProgress.tier;
      const leveledUp = cityLevelAfter > cityLevelBefore;

      fantasySoundEngine.playClanJoinFanfare();

      setRepo((prev) => {
        // 1. Update Member -> Clan -> City atomically
        const updatedCities = prev.cities.map((city) => {
          if (city.id !== targetCity.id) return city;

          const updatedClans = city.clans.map((clan) => {
            if (clan.id !== targetClan.id) return clan;

            const memberExists = clan.members.some((m) => m.userId === activeAccount.id);
            let updatedMembers: ClanMember[];

            if (memberExists) {
              updatedMembers = clan.members.map((m) =>
                m.userId === activeAccount.id
                  ? {
                      ...m,
                      contributionScore: m.contributionScore + expReward,
                      completedMissionsCount: m.completedMissionsCount + 1,
                    }
                  : m
              );
            } else if (clan.members.length < NUENIME_SYSTEM_LIMITS.MAX_MEMBERS_PER_CLAN) {
              updatedMembers = [
                ...clan.members,
                {
                  id: `mem-${activeAccount.id}`,
                  userId: activeAccount.id,
                  clanId: clan.id,
                  cityId: city.id,
                  name: activeAccount.displayName.replace(/\s*\(.*\)/, ''),
                  role: 'Anggota',
                  title: activeAccount.title,
                  elementAffinity: city.element,
                  joinedAt: nowIso,
                  contributionScore: expReward,
                  completedMissionsCount: 1,
                  status: 'ACTIVE',
                },
              ];
            } else {
              // If clan is at 100/100 capacity and user wasn't listed, credit the clan leader's record
              updatedMembers = clan.members.map((m, idx) =>
                idx === 0
                  ? {
                      ...m,
                      contributionScore: m.contributionScore + expReward,
                      completedMissionsCount: m.completedMissionsCount + 1,
                    }
                  : m
              );
            }

            const newClanTotalExp = updatedMembers.reduce(
              (sum, m) => sum + m.contributionScore,
              0
            );

            return {
              ...clan,
              members: updatedMembers,
              memberCount: updatedMembers.length,
              totalExp: newClanTotalExp,
              level: computeClanLevelFromExp(newClanTotalExp),
              lastContributionAt: nowIso,
            };
          });

          const recalculatedCityExp = updatedClans.reduce((sum, c) => sum + c.totalExp, 0);
          const progress = computeCityLevelProgressFromTotalExp(recalculatedCityExp);

          return {
            ...city,
            level: progress.level,
            tier: progress.tier,
            totalExp: progress.totalExp,
            currentLevelExp: progress.currentLevelExp,
            nextLevelTargetExp: progress.nextLevelTargetExp,
            clans: updatedClans,
          };
        });

        // 2. Record EXPTransaction in ContributionLedger
        const newTransaction: EXPTransactionRecord = {
          id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          idempotencyKey: txKey,
          userId: activeAccount.id,
          userName: activeAccount.displayName,
          clanId: targetClan.id,
          clanName: targetClan.name,
          cityId: targetCity.id,
          cityName: targetCity.name,
          missionId: mission.id,
          missionTitle: mission.title,
          activityType: mission.activityType,
          expAmount: expReward,
          source: 'apk_activity',
          cityLevelBefore,
          cityLevelAfter,
          timestamp: nowIso,
        };

        // 3. Record CityLevelHistory if one or multiple levels were gained
        const nextLevelHistory = { ...prev.cityLevelHistory };
        if (leveledUp) {
          const newEntries: CityLevelHistoryRecord[] = [];
          for (let lv = cityLevelBefore + 1; lv <= cityLevelAfter; lv++) {
            const prevLv = lv - 1;
            const prevTier = computeCityLevelProgressFromTotalExp(0).tier; // fallback
            newEntries.push({
              id: `lvlup-${targetCity.id}-${lv}-${Date.now()}`,
              cityId: targetCity.id,
              cityName: targetCity.name,
              previousLevel: prevLv,
              newLevel: lv,
              previousTier: lv - 1 === cityLevelBefore ? cityTierBefore : prevTier,
              newTier: lv === cityLevelAfter ? cityTierAfter : cityTierBefore,
              totalExpAtUpgrade: newCityTotalExp,
              triggeredByClanId: targetClan.id,
              triggeredByClanName: targetClan.name,
              triggeredByUserId: activeAccount.id,
              triggeredByUserName: activeAccount.displayName,
              timestamp: nowIso,
            });
          }
          nextLevelHistory[targetCity.id] = [
            ...newEntries.reverse(),
            ...(nextLevelHistory[targetCity.id] ?? []),
          ].slice(0, 30);
        }

        // 4. Update UserMissionProgress
        const prevProg = prev.missionProgressMap[mission.id] ?? {
          missionId: mission.id,
          userId: activeAccount.id,
          currentProgress: 0,
          targetCount: mission.targetCount,
          totalClaimedCount: 0,
          totalExpEarned: 0,
          lastClaimedAt: null,
        };

        return {
          ...prev,
          cities: verifyAndReconcileWorldCities(updatedCities),
          playerContribution: prev.playerContribution + expReward,
          relicShards: prev.relicShards + shardReward,
          completedMissionCounts: {
            ...prev.completedMissionCounts,
            [mission.id]: (prev.completedMissionCounts[mission.id] ?? 0) + 1,
          },
          missionProgressMap: {
            ...prev.missionProgressMap,
            [mission.id]: {
              ...prevProg,
              currentProgress: mission.targetCount,
              totalClaimedCount: prevProg.totalClaimedCount + 1,
              totalExpEarned: prevProg.totalExpEarned + expReward,
              lastClaimedAt: nowIso,
            },
          },
          expTransactions: [newTransaction, ...prev.expTransactions].slice(0, 80),
          cityLevelHistory: nextLevelHistory,
        };
      });

      if (leveledUp) {
        showToast(
          `LEVEL UP KOTA! ${targetCity.name} naik ke Level ${cityLevelAfter} (${cityTierAfter}) berkat +${expReward} EXP dari ${targetClan.name}!`
        );
      } else {
        showToast(
          `+${expReward} EXP disalurkan ke Anggota → ${targetClan.name} → Kota ${targetCity.name}!`
        );
      }

      // Simpan transaksi EXP & perbarui kontribusi member serta profil akun nyata ke Supabase
      void (async () => {
        try {
          // 1. Catat ke tabel buku besar EXP RPG
          await supabase.from('rpg_exp_transactions').insert({
            user_id: activeAccount.id,
            clan_id: targetClan.id,
            city_id: targetCity.id,
            amount: expReward,
            source_type: mission.activityType,
            description: `Aktivitas: ${mission.title}`,
          });

          // 2. Perbarui kontribusi anggota klan
          const { data: memberRows } = await supabase
            .from('rpg_clan_members')
            .select('contribution_score')
            .eq('clan_id', targetClan.id)
            .eq('user_id', activeAccount.id)
            .limit(1);

          const prevScore = memberRows && memberRows[0] ? Number(memberRows[0].contribution_score) : 0;
          await supabase.from('rpg_clan_members').upsert({
            clan_id: targetClan.id,
            user_id: activeAccount.id,
            display_name: activeAccount.displayName.replace(/\s*\(.*\)/, ''),
            avatar_url: activeAccount.avatarUrl || null,
            border_url: activeAccount.borderUrl || null,
            contribution_score: prevScore + expReward,
            last_active_at: new Date().toISOString(),
          });

          // 3. Tambahkan EXP ke profil asli pengguna di APK (tabel profiles & user_xp_transactions)
          if (activeAccount.id && activeAccount.id !== 'guest' && !activeAccount.id.startsWith('demo-')) {
            const { data: profileRow } = await supabase
              .from('profiles')
              .select('exp, level')
              .eq('id', activeAccount.id)
              .maybeSingle();

            if (profileRow) {
              const currentXp = Number(profileRow.exp) || 0;
              const newTotalXp = currentXp + expReward;
              let newLvl = 1;
              let xpAcc = 0;
              while (true) {
                const needed = 50 + (newLvl - 1) * 15;
                if (newTotalXp < xpAcc + needed) break;
                xpAcc += needed;
                newLvl++;
                if (newLvl >= 200000) break;
              }

              await supabase
                .from('profiles')
                .update({ exp: newTotalXp, level: newLvl })
                .eq('id', activeAccount.id);

              await supabase.from('user_xp_transactions').insert({
                user_id: activeAccount.id,
                activity_type: mission.activityType,
                target_id: `${mission.activityType}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                base_xp: expReward,
                bonus_xp: 0,
                total_xp: expReward,
                multiplier: 1.0,
                description: `Dunia Nuenime: ${mission.title}`,
                metadata: { source: 'dunia-nuenime', clanId: targetClan.id, cityId: targetCity.id },
              });
            }
          }
        } catch (dbErr) {
          console.warn('[Supabase DB] Error sync aktivitas EXP ke database:', dbErr);
        }
      })();

      return {
        ok: true,
        expAdded: expReward,
        cityLeveledUp: leveledUp,
        newCityLevel: cityLevelAfter,
      };
    },
    [activeAccount.avatarUrl, activeAccount.borderUrl, activeAccount.displayName, activeAccount.id, activeAccount.title, allClans, repo.cities, repo.joinedClanId, showToast]
  );

  const syncRealAccountExp = useCallback(async () => {
    try {
      showToast('Menyinkronkan EXP akun dari Nuenime APK...');
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('id, exp, level')
        .eq('id', activeAccount.id)
        .maybeSingle();

      if (!profErr && prof) {
        const realExp = Number(prof.exp) || 0;
        const realLevel = Number(prof.level) || 1;

        if (repo.joinedClanId) {
          await supabase
            .from('rpg_clan_members')
            .update({
              contribution_score: realExp,
              level: realLevel,
              last_active_at: new Date().toISOString(),
            })
            .eq('user_id', activeAccount.id);
        }

        setRepo((prev) => ({
          ...prev,
          playerContribution: realExp,
        }));

        showToast(`EXP Akun berhasil disinkronkan: ${realExp.toLocaleString('id-ID')} EXP (Lv.${realLevel})`);
        return { ok: true, message: 'EXP berhasil disinkronkan', exp: realExp };
      }

      showToast('Profil akun telah diverifikasi.');
      return { ok: true, message: 'Tersinkronisasi' };
    } catch (err: any) {
      showToast('Gagal sinkronisasi EXP.');
      return { ok: false, message: err?.message || 'Error' };
    }
  }, [activeAccount.id, repo.joinedClanId, showToast]);

  /**
   * PEMBELIAN SENJATA SEKALI PAKAI OLEH KETUA KLAN (MENGGUNAKAN COIN KLAN)
   * Terhubung langsung ke RPC PostgreSQL Supabase `rpc_buy_clan_weapon`
   */
  const buyClanWeapon = useCallback(
    async (
      weaponId: string,
      quantity = 1,
      targetClanId?: string
    ): Promise<{ ok: boolean; message: string; remainingCoins?: number; totalStock?: number }> => {
      const clanIdToUse = targetClanId || repo.joinedClanId;
      const userClan = allClans.find((c) => c.id === clanIdToUse);
      if (!userClan) {
        showToast('Klan tidak ditemukan.');
        return { ok: false, message: 'Klan tidak ditemukan.' };
      }

      // Validasi role ketua di client sebelum panggil backend
      const isLeader =
        userClan.leaderId === activeAccount.id ||
        userClan.members.some(
          (m) =>
            (m.userId === activeAccount.id || m.id === activeAccount.id) &&
            (m.role === 'Ketua' || m.role === 'Pemimpin Klan' || m.role === 'Founder')
        );

      if (!isLeader) {
        showToast('Hanya Ketua Klan yang berhak membeli senjata menggunakan saldo Coin klan.');
        return { ok: false, message: 'Hanya Ketua Klan yang berhak membeli senjata.' };
      }

      try {
        const { data, error } = await supabase.rpc('rpc_buy_clan_weapon', {
          p_clan_id: userClan.id,
          p_weapon_id: weaponId,
          p_user_id: activeAccount.id,
          p_quantity: quantity,
        });

        if (error) {
          showToast(`Gagal membeli senjata: ${error.message}`);
          return { ok: false, message: error.message };
        }

        if (!data?.ok) {
          showToast(data?.message || 'Transaksi pembelian senjata ditolak.');
          return { ok: false, message: data?.message || 'Transaksi ditolak.' };
        }

        fantasySoundEngine.playCoinReceive();
        showToast(data.message);

        const remainingCoins =
          data.remaining_coins !== undefined ? Number(data.remaining_coins) : undefined;
        const totalStock =
          data.total_stock !== undefined ? Number(data.total_stock) : undefined;

        // Update saldo koin klan di local repository secara instan
        if (remainingCoins !== undefined) {
          setRepo((prev) => ({
            ...prev,
            cities: prev.cities.map((city) => ({
              ...city,
              clans: city.clans.map((cl) =>
                cl.id === userClan.id ? { ...cl, coins: remainingCoins } : cl
              ),
            })),
          }));
        }

        // Update stok klan di inventory klan secara instan
        if (totalStock !== undefined) {
          setClanInventory((prev) => {
            const exists = prev.some((i) => i.clanId === userClan.id && i.weaponId === weaponId);
            if (exists) {
              return prev.map((i) =>
                i.clanId === userClan.id && i.weaponId === weaponId
                  ? { ...i, quantity: totalStock, updatedAt: new Date().toISOString() }
                  : i
              );
            } else {
              const catalogWeapon = weaponsCatalog.find((w) => w.id === weaponId);
              return [
                ...prev,
                {
                  id: `inv-${userClan.id}-${weaponId}`,
                  clanId: userClan.id,
                  weaponId,
                  quantity: totalStock,
                  updatedAt: new Date().toISOString(),
                  weapon: catalogWeapon,
                },
              ];
            }
          });
        }

        await refreshClanCombatData();
        return {
          ok: true,
          message: data.message,
          remainingCoins,
          totalStock,
        };
      } catch (err: any) {
        const msg = err?.message || 'Terjadi kesalahan sistem saat pembelian senjata.';
        showToast(msg);
        return { ok: false, message: msg };
      }
    },
    [activeAccount.id, allClans, refreshClanCombatData, repo.joinedClanId, showToast, weaponsCatalog]
  );

  /**
   * SERANGAN BOS KOTA MUSUH KHUSUS KETUA KLAN
   * Terhubung langsung ke RPC PostgreSQL Supabase `rpc_attack_enemy_city_boss`
   * - Menghitung base damage dari level kota asal penyerang
   * - Mengonsumsi senjata sekali pakai jika dipilih
   * - Mengurangi HP bos nyata di database
   * - Mencatat riwayat battle log & memberi reward coin klan jika bos defeated
   */
  const attackEnemyBoss = useCallback(
    async (
      bossId: string,
      weaponId?: string | null
    ): Promise<{
      ok: boolean;
      message: string;
      damageDealt?: number;
      bossDefeated?: boolean;
      bossHpAfter?: number;
      winnerClanId?: string;
      winnerClanName?: string;
      winnerDamage?: number;
      rewardCoins?: number;
      cooldownSeconds?: number;
      nextAttackAt?: string;
    }> => {
      const userClan = allClans.find((c) => c.id === repo.joinedClanId);
      if (!userClan) {
        showToast('Anda harus bergabung dengan klan untuk menyerang bos.');
        return { ok: false, message: 'Belum bergabung ke klan.' };
      }

      // Validasi bos target
      const targetBoss =
        repo.cityBosses.find((b) => b.id === bossId || b.cityId === bossId) ??
        hydratedCities.find((c) => c.id === bossId || c.boss?.id === bossId)?.boss;

      if (!targetBoss) {
        showToast('Bos kota tidak ditemukan.');
        return { ok: false, message: 'Bos tidak ditemukan.' };
      }


      // Validasi Hak Akses: HANYA Pemimpin Klan yang berhak memulai serangan Bos
      const isLeader =
        userClan.leaderId === activeAccount.id ||
        userClan.members.some(
          (m) =>
            (m.userId === activeAccount.id || m.id === activeAccount.id) &&
            (m.role === 'Ketua' || m.role === 'Pemimpin Klan' || m.role === 'Founder')
        );

      if (!isLeader) {
        showToast('Hanya Pemimpin Klan yang berhak memulai serangan ke Bos Kota!');
        return {
          ok: false,
          message: 'Hanya Pemimpin Klan yang berhak memulai serangan ke Bos Kota.',
        };
      }

      try {
        const { data, error } = await supabase.rpc('rpc_attack_enemy_city_boss', {
          p_boss_id: targetBoss.id,
          p_clan_id: userClan.id,
          p_user_id: activeAccount.id,
          p_user_name: activeAccount.displayName.replace(/\s*\(.*\)/, ''),
          p_weapon_id: weaponId || null,
        });

        if (error) {
          showToast(`Gagal menyerang bos: ${error.message}`);
          return { ok: false, message: error.message };
        }

        if (!data?.ok) {
          showToast(data?.message || 'Serangan tidak dapat diproses.');
          return {
            ok: false,
            message: data?.message || 'Gagal menyerang.',
            cooldownSeconds: data?.cooldown_seconds,
            nextAttackAt: data?.next_attack_at,
          };
        }

        const isDefeated = Boolean(data.boss_defeated || data.is_boss_defeated);

        if (isDefeated) {
          fantasySoundEngine.playClanJoinFanfare();
          const winnerText = data.winner_clan_name
            ? `Klan ${data.winner_clan_name} Juara 1!`
            : `Klan ${userClan.name} Juara 1!`;
          showToast(
            `KEMENANGAN BOS! ${winnerText} Meraih +${Number(data.reward_coins || 0).toLocaleString('id-ID')} Coin Kas Klan!`
          );
        } else {
          fantasySoundEngine.playBossStrike();
          showToast(
            `Serangan berhasil! Total -${data.total_damage} Damage diberikan ke ${targetBoss.name} (Sisa HP: ${data.boss_hp_after?.toLocaleString('id-ID')}).`
          );
        }

        if (weaponId) {
          setClanInventory((prev) =>
            prev.map((i) =>
              i.clanId === userClan.id && i.weaponId === weaponId
                ? { ...i, quantity: Math.max(0, i.quantity - 1), updatedAt: new Date().toISOString() }
                : i
            )
          );
        }

        if (isDefeated && data.reward_coins) {
          const winnerClanId = data.winner_clan_id || userClan.id;
          const rewardCoins = Number(data.reward_coins);
          setRepo((prev) => ({
            ...prev,
            cities: prev.cities.map((city) => ({
              ...city,
              clans: city.clans.map((cl) =>
                cl.id === winnerClanId ? { ...cl, coins: (cl.coins ?? 0) + rewardCoins } : cl
              ),
            })),
          }));
        }

        await refreshClanCombatData();
        return {
          ok: true,
          message: data.message,
          damageDealt: data.total_damage,
          bossDefeated: isDefeated,
          bossHpAfter: data.boss_hp_after,
          winnerClanId: data.winner_clan_id,
          winnerClanName: data.winner_clan_name,
          winnerDamage: data.winner_damage,
          rewardCoins: data.reward_coins,
          cooldownSeconds: data.cooldown_seconds ?? 3600,
          nextAttackAt: data.next_attack_at,
        };
      } catch (err: any) {
        const msg = err?.message || 'Terjadi kesalahan sistem saat melancarkan serangan.';
        showToast(msg);
        return { ok: false, message: msg };
      }
    },
    [activeAccount.displayName, activeAccount.id, allClans, hydratedCities, refreshClanCombatData, repo.cityBosses, repo.joinedClanId, showToast]
  );

  /**
   * 6B. PERTARUNGAN BOS KOTA
   * Terintegrasi dengan sistem serangan bos kota musuh
   */
  const attackWorldBoss = useCallback(
    (bossId: string) => {
      void attackEnemyBoss(bossId, null);
      return { damage: 100, defeated: false };
    },
    [attackEnemyBoss]
  );

  const resetWorldBoss = useCallback(
    (bossId: string) => {
      fantasySoundEngine.playTap();
      setRepo((prev) => ({
        ...prev,
        cityBosses: prev.cityBosses.map((b) =>
          b.id === bossId
            ? {
                ...b,
                currentHp: b.maxHp,
                status: 'ACTIVE',
                lastUpdatedAt: new Date().toISOString(),
              }
            : b
        ),
      }));

      // Pulihkan bos di database Supabase
      void (async () => {
        try {
          await supabase
            .from('rpg_city_bosses')
            .update({
              current_hp: 10000,
              status: 'ACTIVE',
              last_attacked_at: new Date().toISOString(),
            })
            .eq('id', bossId);
        } catch (dbErr) {
          console.warn('[Supabase DB] Error reset bos di database:', dbErr);
        }
      })();

      showToast('HP Bos Kota telah dipulihkan ke kondisi penuh.');
    },
    [showToast]
  );

  const reconcileWorldConsistency = useCallback(() => {
    fantasySoundEngine.playTap();
    setRepo((prev) => ({
      ...prev,
      cities: verifyAndReconcileWorldCities(prev.cities),
    }));
    showToast('Konsistensi EXP Anggota, Klan, Kota, dan Level telah diverifikasi 100% akurat.');
  }, [showToast]);

  const resetDemoWorldData = useCallback(() => {
    fantasySoundEngine.playTap();
    processedRequestKeysRef.current.clear();
    const freshCities = verifyAndReconcileWorldCities(SEED_WORLD_CITIES);
    setRepo({
      cities: freshCities,
      cityBosses: freshCities.map((c) => c.boss!).filter(Boolean),
      activeAccountId: 'nuenime-adventurer',
      joinedClanId: null,
      playerContribution: 0,
      relicShards: 6,
      relicLevels: buildDefaultRelicLevels(freshCities),
      districtInfluence: computeRealDistrictInfluence(freshCities),
      completedMissionCounts: {},
      missionProgressMap: {},
      expTransactions: [],
      cityLevelHistory: buildDefaultLevelHistory(),
    });
    showToast('Data simulasi Dunia Nuenime dikembalikan ke kondisi awal (Level 1).');
  }, [showToast]);

  /**
   * 10. LEADERBOARD KLAN (DALAM KOTA & SELURUH DUNIA)
   * Diurutkan berdasarkan totalExp tertinggi dengan aturan tie-break waktu kontribusi terakhir.
   */
  const sortClansForLeaderboard = useCallback((clansList: Clan[]): Clan[] => {
    return [...clansList].sort((a, b) => {
      if (b.totalExp !== a.totalExp) {
        return b.totalExp - a.totalExp;
      }
      // Tie-breaker 1: waktu kontribusi terakhir lebih awal
      const timeA = Date.parse(a.lastContributionAt || a.createdAt || '2026-01-01');
      const timeB = Date.parse(b.lastContributionAt || b.createdAt || '2026-01-01');
      if (timeA !== timeB) {
        return timeA - timeB;
      }
      return a.name.localeCompare(b.name);
    });
  }, []);

  const getCityClansLeaderboard = useCallback(
    (cityId: CityId): Clan[] => {
      const city = repo.cities.find((c) => c.id === cityId);
      if (!city) return [];
      return sortClansForLeaderboard(city.clans);
    },
    [repo.cities, sortClansForLeaderboard]
  );

  const getWorldClansLeaderboard = useCallback((): Clan[] => {
    return sortClansForLeaderboard(allClans);
  }, [allClans, sortClansForLeaderboard]);

  const getClanTotalScore = useCallback(
    (clanId: string): number => {
      const clan = allClans.find((c) => c.id === clanId);
      return clan ? clan.totalExp : 0;
    },
    [allClans]
  );

  /**
   * 11. STATISTIK GLOBAL DUNIA NUENIME
   * Agregasi dari 7 kota independen tanpa mencampurkan progres masing-masing kota.
   */
  const globalWorldStats: GlobalWorldStats = useMemo(() => {
    const totalWorldExp = repo.cities.reduce((sum, c) => sum + c.totalExp, 0);
    const totalClansCount = allClans.length;
    const totalClanMembersCount = allClans.reduce((sum, c) => sum + c.memberCount, 0);

    const sortedCities = [...repo.cities].sort((a, b) => {
      if (b.level !== a.level) return b.level - a.level;
      return b.totalExp - a.totalExp;
    });
    const topCity = sortedCities[0] ?? repo.cities[0];

    const worldLeaderboard = sortClansForLeaderboard(allClans);
    const topClan = worldLeaderboard[0] ?? allClans[0];

    return {
      totalWorldExp,
      totalSimulationExp: totalWorldExp,
      totalProductionExp: 0,
      totalClansCount,
      maxWorldClansCapacity: repo.cities.length * NUENIME_SYSTEM_LIMITS.MAX_CLANS_PER_CITY,
      totalClanMembersCount,
      highestLevelCity: topCity
        ? {
            cityId: topCity.id,
            name: topCity.name,
            level: topCity.level,
            tier: topCity.tier,
            totalExp: topCity.totalExp,
          }
        : {
            cityId: 'aetheria',
            name: 'Aetheria',
            level: 1,
            tier: 'Tier I',
            totalExp: 0,
          },
      topExpClan: topClan
        ? {
            clanId: topClan.id,
            name: topClan.name,
            tag: topClan.tag,
            cityId: topClan.cityId,
            cityName: topClan.cityName,
            totalExp: topClan.totalExp,
          }
        : {
            clanId: '',
            name: 'Belum ada klan',
            tag: '---',
            cityId: 'aetheria',
            cityName: 'Aetheria',
            totalExp: 0,
          },
    };
  }, [allClans, repo.cities, sortClansForLeaderboard]);

  const setTimeOfDay = useCallback(
    (mode: TimeOfDayMode) => {
      setTimeOfDayState(mode);
      fantasySoundEngine.playTap();
    },
    []
  );

  const toggleSound = useCallback(() => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    fantasySoundEngine.setEnabled(next);
    showToast(next ? 'Audio RPG & Ambient diaktifkan' : 'Audio RPG & Ambient dimatikan');
  }, [soundEnabled, showToast]);

  const setAmbientLocation = useCallback((location: CityId | 'world') => {
    fantasySoundEngine.setAmbientCity(location);
  }, []);

  const upgradeClanRelic = useCallback(
    (clanId: string): boolean => {
      // 1. Validasi kepemilikan klan: Hanya bisa upgrade klan sendiri
      if (!repo.joinedClanId || repo.joinedClanId !== clanId) {
        showToast('Anda hanya dapat meningkatkan Artefak Pusaka milik klan Anda sendiri!');
        return false;
      }

      // 2. Validasi peran: Hanya Pemimpin / Ketua Klan yang berhak menempa artefak
      const targetClan = allClans.find((c) => c.id === clanId);
      const isLeader =
        targetClan &&
        (targetClan.leaderId === activeAccount.id ||
          targetClan.founderId === activeAccount.id ||
          targetClan.members.some(
            (m) =>
              (m.userId === activeAccount.id || m.id === activeAccount.id) &&
              (m.role === 'Pemimpin Klan' || m.role === 'Ketua' || m.role === 'Founder')
          ));

      if (!isLeader) {
        showToast('Hanya Pemimpin / Ketua Klan yang berhak meningkatkan Artefak Pusaka!');
        return false;
      }

      const currentLv = repo.relicLevels[clanId] ?? 1;
      if (currentLv >= 10) {
        showToast('Artefak Pusaka Klan sudah mencapai level maksimum (Level 10)!');
        return false;
      }

      const cost = currentLv * 2;
      if (repo.relicShards < cost) {
        showToast(
          `Butuh ${cost} Pecahan Relik (Anda punya ${repo.relicShards}). Klaim jatah harian relik klan!`
        );
        return false;
      }

      const nextLv = currentLv + 1;
      const coinReward = 1000;

      fantasySoundEngine.playQuestComplete();
      setRepo((prev) => ({
        ...prev,
        relicShards: Math.max(0, prev.relicShards - cost),
        relicLevels: {
          ...prev.relicLevels,
          [clanId]: nextLv,
        },
        cities: prev.cities.map((city) => ({
          ...city,
          clans: city.clans.map((cl) =>
            cl.id === clanId
              ? { ...cl, coins: (cl.coins ?? 1000) + coinReward }
              : cl
          ),
        })),
      }));

      // Sinkronisasi permanen penambahan koin nyata ke Supabase (rpg_clans.coins)
      (async () => {
        try {
          const { data: dbClan } = await supabase
            .from('rpg_clans')
            .select('coins')
            .eq('id', clanId)
            .maybeSingle();

          const currentDbCoins =
            dbClan?.coins !== undefined && dbClan?.coins !== null
              ? Number(dbClan.coins)
              : 1000;
          const nextCoins = currentDbCoins + coinReward;

          await supabase
            .from('rpg_clans')
            .update({ coins: nextCoins, updated_at: new Date().toISOString() })
            .eq('id', clanId);
        } catch (err) {
          console.warn('[Dunia Nuenime] Gagal menyimpan penambahan koin ke Supabase:', err);
        }
      })();

      showToast(`Artefak Pusaka Klan naik ke Level ${nextLv}! Kas Klan memperoleh +1.000 Coin!`);
      return true;
    },
    [activeAccount.id, allClans, repo.joinedClanId, repo.relicLevels, repo.relicShards, showToast]
  );

  const getDailyRelicStorageKey = useCallback(() => {
    return `nuenime_daily_relic_${activeAccount.id || 'guest'}`;
  }, [activeAccount.id]);

  const isDailyRelicClaimed = useCallback((): boolean => {
    if (typeof window === 'undefined') return false;
    const todayKey = new Date().toISOString().slice(0, 10);
    return window.localStorage.getItem(getDailyRelicStorageKey()) === todayKey;
  }, [getDailyRelicStorageKey]);

  const claimDailyRelics = useCallback((): { ok: boolean; message: string; shardsAdded: number } => {
    // 1. Validasi kepemilikan klan
    if (!repo.joinedClanId) {
      showToast('Anda harus memiliki klan untuk mengklaim Relik Pusaka!');
      return { ok: false, message: 'Belum bergabung ke klan', shardsAdded: 0 };
    }

    // 2. Validasi Ketua Klan
    const userClan = allClans.find((c) => c.id === repo.joinedClanId);
    const isLeader =
      userClan &&
      (userClan.leaderId === activeAccount.id ||
        userClan.founderId === activeAccount.id ||
        userClan.members.some(
          (m) =>
            (m.userId === activeAccount.id || m.id === activeAccount.id) &&
            (m.role === 'Pemimpin Klan' || m.role === 'Ketua' || m.role === 'Founder')
        ));

    if (!isLeader) {
      showToast('Hanya Pemimpin / Ketua Klan yang berhak mengklaim 5 Relik harian klan!');
      return { ok: false, message: 'Hanya untuk Ketua Klan', shardsAdded: 0 };
    }

    const todayKey = new Date().toISOString().slice(0, 10);
    const storageKey = getDailyRelicStorageKey();
    if (typeof window !== 'undefined' && window.localStorage.getItem(storageKey) === todayKey) {
      showToast('Jatah 5 Relik klan harian sudah diklaim hari ini. Kembali lagi besok!');
      return { ok: false, message: 'Sudah diklaim hari ini', shardsAdded: 0 };
    }

    fantasySoundEngine.playQuestComplete();
    setRepo((prev) => ({
      ...prev,
      relicShards: (prev.relicShards || 0) + 5,
    }));

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, todayKey);
    }

    showToast('Berhasil mengklaim +5 Pecahan Relik harian klan!');
    return { ok: true, message: 'Berhasil mengklaim +5 Relik!', shardsAdded: 5 };
  }, [activeAccount.id, allClans, getDailyRelicStorageKey, repo.joinedClanId, showToast]);

  const reinforceClanDistrict = useCallback(
    (_clanId: string) => {
      fantasySoundEngine.playButtonClick();
      showToast('Kendali distrik diperkuat otomatis secara real-time dari aktivitas menonton di aplikasi Nuenime!');
    },
    [showToast]
  );

  const selectTravelRoute = useCallback(
    (fromCityId: CityId, toCityId: CityId) => {
      const fromCity = repo.cities.find((c) => c.id === fromCityId);
      const toCity = repo.cities.find((c) => c.id === toCityId);
      if (!fromCity || !toCity || fromCityId === toCityId) return;

      const route = calculateTravelRoute(fromCity, toCity);
      setActiveRoute(route);
      fantasySoundEngine.playRouteDepart();
      showToast(
        `Ekspedisi ${route.transportName}: ${fromCity.name} → ${toCity.name} (${route.distanceLeagues} League)`
      );
    },
    [repo.cities, showToast]
  );

  const clearTravelRoute = useCallback(() => {
    setActiveRoute(null);
    fantasySoundEngine.playTap();
  }, []);

  return (
    <NuenimeRpgContext.Provider
      value={{
        cities: hydratedCities,
        allClans,
        getCityById,
        getClanById,
        cityLeaders,
        getCityLeader,
        availableDemoAccounts: [],
        activeAccount,
        switchDemoAccount,
        canCreateClanInCity,
        createClanInCity,
        updateClanLogo,
        updateClanProfile,
        updateMemberRole,
        userCrystals,
        deductCrystals,
        addCrystals,
        joinedClanId: repo.joinedClanId,
        joinClan,
        clanJoinRequests,
        requestJoinClan,
        respondJoinRequest,
        cancelJoinRequest,
        leaveClan,
        disbandClan,
        transferClanLeadership,
        getUserJoinRequest,
        refreshClanData,
        worldBosses: repo.cityBosses,
        getCityBoss,
        attackWorldBoss,
        resetWorldBoss,
        attackEnemyBoss,
        weaponsCatalog,
        clanInventory,
        clanCoinTransactions,
        bossBattleLogs,
        buyClanWeapon,
        refreshClanCombatData,
        simulationMissions: CLAN_MISSIONS,
        completedMissionCounts: repo.completedMissionCounts,
        missionProgressMap: repo.missionProgressMap,
        completeClanMission,
        syncRealAccountExp,
        expTransactions: repo.expTransactions,
        cityLevelHistory: repo.cityLevelHistory,
        reconcileWorldConsistency,
        resetDemoWorldData,
        resetAllSimulationData: resetDemoWorldData,
        globalWorldStats,
        getClanTotalScore,
        getCityClansLeaderboard,
        getWorldClansLeaderboard,
        timeOfDay,
        setTimeOfDay,
        soundEnabled,
        toggleSound,
        setAmbientLocation,
        playerContribution: repo.playerContribution,
        relicShards: repo.relicShards,
        relicLevels: repo.relicLevels,
        upgradeClanRelic,
        claimDailyRelics,
        isDailyRelicClaimed,
        districtInfluence: repo.districtInfluence,
        reinforceClanDistrict,
        activeRoute,
        selectTravelRoute,
        clearTravelRoute,
        toastMessage,
        dismissToast,
      }}
    >
      {children}
    </NuenimeRpgContext.Provider>
  );
};

export function useNuenimeRpg() {
  const ctx = useContext(NuenimeRpgContext);
  if (!ctx) {
    throw new Error('useNuenimeRpg harus digunakan di dalam NuenimeRpgProvider');
  }
  return ctx;
}

export { CLAN_MISSIONS };
