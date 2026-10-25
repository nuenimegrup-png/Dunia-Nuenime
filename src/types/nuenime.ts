export type CityId =
  | 'aetheria'
  | 'lunaris'
  | 'velmora'
  | 'eldoria'
  | 'drakonia'
  | 'nivara'
  | 'astralis';

export type BottomNavTab = 'beranda' | 'karakter' | 'dunia' | 'klan' | 'lainnya';

export type TimeOfDayMode = 'day' | 'dusk' | 'night';

export type CityMaterialTheme =
  | 'silver-ice'
  | 'lunar-cyan'
  | 'emerald-bronze'
  | 'imperial-gold'
  | 'crimson-obsidian'
  | 'sun-amber'
  | 'astral-violet';

export type MarkerMetalMaterial = CityMaterialTheme;

export type ClanEmblemVariant =
  | 'seraph-wings'
  | 'frost-chalice'
  | 'crescent-tide'
  | 'abyssal-trident'
  | 'world-tree'
  | 'emerald-stag'
  | 'solar-crown'
  | 'aegis-scales'
  | 'dragon-fang'
  | 'storm-hammer'
  | 'mirage-hourglass'
  | 'astral-prism'
  | 'star-shield'
  | 'crescent-blade'
  | 'emerald-bough'
  | 'imperial-crown'
  | 'solar-ankh';

export type CityTierCode =
  | 'Tier I'
  | 'Tier II'
  | 'Tier III'
  | 'Tier IV'
  | 'Tier V'
  | 'Tier VI'
  | 'Tier VII'
  | 'Tier VIII';

export type ExpSourceType =
  | 'simulation'
  | 'production'
  | 'user_xp_transactions'
  | 'apk_activity'
  | 'mission'
  | 'boss_battle';

/**
 * 2. TUJUH PEMIMPIN KOTA SEMENTARA (DEMO ACCOUNTS)
 * Peran dalam sistem Dunia Nuenime, bukan admin aplikasi.
 */
export interface CityLeaderProfile {
  id: string;
  cityId: CityId;
  cityName: string;
  displayName: string;
  handle: string;
  title: string;
  elementAffinity: string;
  isDemoAccount?: boolean;
  role: 'CITY_LEADER';
  isAppAdmin: boolean;
  replaceableByRealAccountId: string | null;
  appointedAt: string;
}

/**
 * Akun aktif yang sedang disimulasikan pengguna (Pemimpin Kota Demo atau Anggota Klan Demo)
 */
export interface ActiveDemoAccount {
  id: string;
  displayName: string;
  handle: string;
  title: string;
  role: 'CITY_LEADER' | 'CLAN_MEMBER';
  ledCityId: CityId | null;
  joinedClanId: string | null;
  isDemoAccount: boolean;
  isAppAdmin: boolean;
  avatarUrl?: string | null;
  borderUrl?: string | null;
  level?: number;
  exp?: number;
  rank?: string;
  isVip?: boolean;
}

/**
 * 5. SISTEM BOS UNIK UNTUK SETIAP KOTA
 * Setiap kota wajib mempunyai bos sendiri (bukan monster global bersama).
 * Kota tidak memiliki HP; HP hanya dimiliki oleh Bos dan Monster.
 */
export type BossTier = 'Normal' | 'Elite' | 'Epic' | 'Legendary' | 'Mythic';

export interface CityBossRecord {
  id: string;
  cityId: CityId;
  cityName: string;
  name: string;
  title: string;
  speciesType: string;
  element: string;
  description: string;
  characteristic: string;
  level: number;
  tier: BossTier | string;
  maxHp: number;
  currentHp: number;
  status: 'ACTIVE' | 'ENRANGED' | 'DORMANT';
  accentColor: string;
  secondaryColor: string;
  /** Posisi monster di peta dunia di dekat marker kota tanpa menutupi nama kota */
  worldXPercent: number;
  worldYPercent: number;
  battleHistoryCount: number;
  defeatedCount?: number;
  respawnAt?: string | null;
  lastUpdatedAt: string;
}

/**
 * 4. SISTEM ANGGOTA KLAN (MAKSIMAL 100 ANGGOTA PER KLAN)
 */
export type ClanRoleTitle =
  | 'Pemimpin Klan'
  | 'Wakil Pemimpin'
  | 'Tetua Klan'
  | 'Panglima Ksatria'
  | 'Arkanis Agung'
  | 'Ksatria Inti'
  | 'Anggota'
  | 'Rekrut Baru';

export interface ClanMember {
  id: string;
  userId: string;
  clanId: string;
  cityId: CityId;
  name: string;
  role: ClanRoleTitle | string;
  title: string;
  elementAffinity: string;
  joinedAt: string;
  /** Total EXP kontribusi anggota ke klan ini */
  contributionScore: number;
  completedMissionsCount: number;
  status: 'ACTIVE' | 'INACTIVE';
  level?: number;
  avatarUrl?: string | null;
  borderUrl?: string | null;
  lastActive?: string;
}

/**
 * 3. SISTEM KLAN (MAKSIMAL 15 KLAN PER KOTA, MAKSIMAL 100 ANGGOTA PER KLAN)
 */
export interface Clan {
  id: string;
  cityId: CityId;
  cityName: string;
  name: string;
  tag: string;
  emblemVariant: ClanEmblemVariant;
  logoUrl?: string;
  accentColor: string;
  motto: string;
  description: string;
  historyLore: string;
  founderId: string;
  leaderId: string;
  leaderName: string;
  leaderTitle: string;
  memberCount: number;
  maxMembers: number;
  /** Total EXP kontribusi klan (akumulasi dari seluruh anggota klan) */
  totalExp: number;
  level: number;
  foundedEra: string;
  createdAt: string;
  lastContributionAt: string;
  strongholdDistrict: string;
  /** Koordinat X markas klan di dalam Peta Kota (0 - 100) */
  cityMapXPercent: number;
  cityMapYPercent: number;
  specialization: string;
  reputationRank: string;
  /** Saldo Coin klan untuk pembelian senjata sekali pakai */
  coins: number;
  members: ClanMember[];
}

export type WeaponRarity = 'Basic' | 'Advanced' | 'Epic' | 'Legendary' | 'Mythic';

export interface ClanWeapon {
  id: string;
  name: string;
  rarity: WeaponRarity;
  damage: number;
  priceCoin: number;
  description: string;
  iconUrl?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export interface ClanInventoryItem {
  clanId: string;
  weaponId: string;
  quantity: number;
  weapon?: ClanWeapon;
  updatedAt?: string;
}

export interface ClanCoinTransaction {
  id: string;
  clanId: string;
  amount: number;
  balanceAfter: number;
  transactionType: string;
  description: string;
  actorUserId: string;
  actorName?: string;
  createdAt: string;
}

export interface BossBattleLog {
  id: string;
  bossId?: string;
  targetBossId?: string;
  targetCityId: CityId | string;
  targetCityName?: string;
  targetBossName?: string;
  attackerUserId: string;
  attackerName: string;
  attackerClanId: string;
  attackerClanName: string;
  originCityId: CityId | string;
  originCityName?: string;
  weaponId?: string | null;
  weaponUsedId?: string | null;
  weaponName?: string | null;
  weaponUsedName?: string | null;
  baseDamage: number;
  weaponDamage: number;
  totalDamage: number;
  bossHpBefore: number;
  bossHpAfter: number;
  bossDefeated?: boolean;
  isBossDefeated?: boolean;
  rewardCoins: number;
  rewardExp?: number;
  createdAt: string;
}

export interface CityDistrict {
  id: string;
  name: string;
  category: string;
  description: string;
  xPercent: number;
  yPercent: number;
}

/**
 * Riwayat Kenaikan Level Kota
 */
export interface CityLevelHistoryRecord {
  id: string;
  cityId: CityId;
  cityName: string;
  previousLevel: number;
  newLevel: number;
  previousTier: CityTierCode;
  newTier: CityTierCode;
  totalExpAtUpgrade: number;
  triggeredByClanId: string;
  triggeredByClanName: string;
  triggeredByUserId: string;
  triggeredByUserName: string;
  timestamp: string;
}

/**
 * 1. STRUKTUR KOTA DUNIA NUENIME (7 KOTA INDEPENDEN)
 * Catatan: Kota TIDAK memiliki HP. HP hanya ada pada Bos dan Monster kota.
 */
export interface WorldCity {
  id: CityId;
  name: string;
  epithet: string;
  regionName: string;
  element: string;
  /** Posisi X dalam persentase lebar peta (0 - 100) */
  worldXPercent: number;
  /** Posisi Y dalam persentase tinggi peta (0 - 100) */
  worldYPercent: number;
  /** Titik fokus kamera Y saat kota dipilih */
  focusYPercent: number;
  labelPosition?: 'right' | 'left';
  material: CityMaterialTheme;
  accentHex: string;
  secondaryHex: string;
  thumbnailAsset: string;
  emblemAsset: string;
  shortDescription: string;
  fullLore: string;
  geographyNote: string;
  magicPhenomenon: string;
  rulingCouncil: string;
  altitudeOrDepth: string;
  /** Relasi Pemimpin Kota */
  leaderId?: string | null;
  leaderProfile?: CityLeaderProfile | null;
  /** Level & Tier Kota (Mulai dari Level 1, tidak dibatasi maksimum tetap) */
  level: number;
  tier: CityTierCode;
  /** Total EXP Kota sepanjang perkembangan (akumulasi kontribusi seluruh klan di kota ini) */
  totalExp: number;
  /** EXP yang telah diperoleh pada level saat ini */
  currentLevelExp: number;
  /** Target EXP yang dibutuhkan untuk naik ke level berikutnya */
  nextLevelTargetExp: number;
  /** Kapasitas maksimal klan di kota ini (15) */
  maxClans: number;
  /** ID & Data Bos unik milik kota ini */
  bossId?: string;
  boss?: CityBossRecord;
  levelHistory: CityLevelHistoryRecord[];
  districts: CityDistrict[];
  clans: Clan[];
}

/**
 * 8. AKTIVITAS PEROLEHAN EXP NYATA NUENIME
 */
export type AnimeActivityType =
  | 'WATCH_EPISODE'
  | 'LIKE_ANIME'
  | 'COMMENT_ANIME'
  | 'WATCH_MILESTONE'
  | 'COMMUNITY_CHALLENGE'
  | 'complete_episode'
  | 'watch_5min'
  | 'complete_movie'
  | 'comment'
  | 'rate_episode'
  | 'daily_login'
  | 'weekly_mission';

export interface SimulationMission {
  id: string;
  title: string;
  description: string;
  activityType: AnimeActivityType;
  targetCount: number;
  rewardExp: number;
  rewardShard?: number;
  isActive: boolean;
  isSimulation?: boolean;
  source?: ExpSourceType | string;
  cooldownSeconds?: number;
  categoryLabel: string;
  difficulty: 'Harian' | 'Mingguan' | 'Tantangan' | 'Berkala' | 'Event' | string;
}

export interface UserMissionProgressRecord {
  missionId: string;
  userId: string;
  currentProgress: number;
  targetCount: number;
  totalClaimedCount: number;
  totalExpEarned: number;
  lastClaimedAt: string | null;
}

/**
 * 9. BUKU BESAR TRANSAKSI EXP (EXPTransactions / ContributionLedger)
 */
export interface EXPTransactionRecord {
  id: string;
  idempotencyKey: string;
  userId: string;
  userName: string;
  clanId: string;
  clanName: string;
  cityId: CityId;
  cityName: string;
  missionId: string;
  missionTitle: string;
  activityType: AnimeActivityType;
  expAmount: number;
  source: ExpSourceType;
  cityLevelBefore: number;
  cityLevelAfter: number;
  timestamp: string;
}

/**
 * 11. STATISTIK GLOBAL DUNIA NUENIME
 */
export interface GlobalWorldStats {
  totalWorldExp: number;
  totalSimulationExp: number;
  totalProductionExp: number;
  totalClansCount: number;
  maxWorldClansCapacity: number;
  totalClanMembersCount: number;
  highestLevelCity: {
    cityId: CityId;
    name: string;
    level: number;
    tier: CityTierCode;
    totalExp: number;
  };
  topExpClan: {
    clanId: string;
    name: string;
    tag: string;
    cityId: CityId;
    cityName: string;
    totalExp: number;
  };
}

/**
 * Artefak Pusaka & Buff Elemen setiap Klan
 */
export interface ClanRelicInfo {
  clanId: string;
  relicName: string;
  relicTitle: string;
  elementBuffName: string;
  baseBonusPercent: number;
  bonusPerLevel: number;
  lore: string;
}

/**
 * Penguasaan Distrik Kota oleh Klan
 */
export interface DistrictInfluenceState {
  clanId: string;
  cityId: CityId;
  districtName: string;
  influencePercent: number;
}

/**
 * Simulasi Rute Perjalanan / Kapal Udara Antar Kota
 */
export interface ActiveTravelRoute {
  fromCityId: CityId;
  toCityId: CityId;
  transportName: string;
  distanceLeagues: number;
  durationMinutes: number;
  hazardLevel: string;
}

/**
 * Input pembuatan klan baru oleh Pemimpin Kota
 */
export interface CreateClanInput {
  cityId: CityId;
  name: string;
  tag: string;
  description: string;
  motto?: string;
  strongholdDistrict: string;
  specialization: string;
  emblemVariant: ClanEmblemVariant;
  logoUrl?: string;
  accentColor?: string;
  requestKey?: string;
}

export type ScreenViewState =
  | { type: 'WORLD_MAP' }
  | {
      type: 'CITY_DETAIL';
      cityId: CityId;
      initialTab?: 'map' | 'clans' | 'lore';
    }
  | { type: 'CLAN_MAIN' }
  | { type: 'CLAN_LEADERBOARD'; cityId?: CityId }
  | { type: 'CLAN_LIST'; cityId?: CityId; initialView?: 'leaderboard' | 'directory' }
  | { type: 'CLAN_DETAIL'; clanId: string; returnToCityId?: CityId };

/** Alias kompatibilitas untuk komponen */
export type WorldBossEvent = CityBossRecord;
export type ClanMission = SimulationMission;
