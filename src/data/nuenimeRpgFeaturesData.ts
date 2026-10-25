import {
  SimulationMission,
  ClanRelicInfo,
  WorldCity,
  ActiveTravelRoute,
} from '../types/nuenime';
/**
 * ============================================================================
 * SISTEM EXP NYATA TERINTEGRASI NUENIME APK (100% PURE DATABASE)
 * ============================================================================
 * Seluruh EXP diperoleh secara nyata dari aktivitas pengguna di aplikasi Nuenime
 * (nonton anime, komentar, rating, login harian) yang tersimpan di profiles &
 * user_xp_transactions, lalu otomatis disinkronkan ke Klan dan Kota di Dunia Nuenime.
 */
export const REAL_EXP_ACTIVITIES: SimulationMission[] = [
  {
    id: 'act-watch-episode',
    title: 'Menonton 1 Episode Selesai',
    description: 'Selesaikan pemutaran episode anime favoritmu di player aplikasi Nuenime.',
    activityType: 'complete_episode',
    targetCount: 1,
    rewardExp: 15,
    rewardShard: 1,
    isActive: true,
    isSimulation: false,
    source: 'user_xp_transactions',
    categoryLabel: 'Streaming Anime',
    difficulty: 'Harian',
  },
  {
    id: 'act-watch-5min',
    title: 'Streaming Anime Aktif 5 Menit',
    description: 'Menonton anime secara aktif minimal 5 menit di aplikasi Nuenime.',
    activityType: 'watch_5min',
    targetCount: 1,
    rewardExp: 5,
    rewardShard: 1,
    isActive: true,
    isSimulation: false,
    source: 'user_xp_transactions',
    categoryLabel: 'Streaming Anime',
    difficulty: 'Berkala',
  },
  {
    id: 'act-complete-movie',
    title: 'Menyelesaikan 1 Movie / Film Anime',
    description: 'Tonton film anime panjang hingga tuntas di aplikasi Nuenime.',
    activityType: 'complete_movie',
    targetCount: 1,
    rewardExp: 25,
    rewardShard: 2,
    isActive: true,
    isSimulation: false,
    source: 'user_xp_transactions',
    categoryLabel: 'Film Anime',
    difficulty: 'Event',
  },
  {
    id: 'act-comment-anime',
    title: 'Menulis Komentar & Diskusi Valid',
    description: 'Tulis komentar atau ulasan diskusi yang membangun pada halaman anime.',
    activityType: 'comment',
    targetCount: 1,
    rewardExp: 5,
    rewardShard: 1,
    isActive: true,
    isSimulation: false,
    source: 'user_xp_transactions',
    categoryLabel: 'Interaksi Komunitas',
    difficulty: 'Harian',
  },
  {
    id: 'act-rate-anime',
    title: 'Memberikan Rating Bintang',
    description: 'Beri penilaian rating pada episode atau seri anime favoritmu.',
    activityType: 'rate_episode',
    targetCount: 1,
    rewardExp: 3,
    rewardShard: 1,
    isActive: true,
    isSimulation: false,
    source: 'user_xp_transactions',
    categoryLabel: 'Interaksi Komunitas',
    difficulty: 'Harian',
  },
  {
    id: 'act-daily-login',
    title: 'Presensi / Login Harian Nuenime',
    description: 'Buka aplikasi Nuenime setiap hari untuk mengklaim EXP kehadiran.',
    activityType: 'daily_login',
    targetCount: 1,
    rewardExp: 10,
    rewardShard: 1,
    isActive: true,
    isSimulation: false,
    source: 'user_xp_transactions',
    categoryLabel: 'Keaktifan Akun',
    difficulty: 'Harian',
  },
  {
    id: 'act-weekly-mission',
    title: 'Misi Mingguan Nuenime APK',
    description: 'Selesaikan tantangan menonton dan berdiskusi mingguan di aplikasi.',
    activityType: 'weekly_mission',
    targetCount: 1,
    rewardExp: 75,
    rewardShard: 3,
    isActive: true,
    isSimulation: false,
    source: 'user_xp_transactions',
    categoryLabel: 'Misi APK',
    difficulty: 'Mingguan',
  },
];

export const CLAN_MISSIONS: SimulationMission[] = REAL_EXP_ACTIVITIES;

/**
 * Informasi Artefak Pusaka & Buff Elemen untuk Setiap Klan
 */
export function getClanRelicInfo(
  clanId: string,
  cityName: string,
  specialization: string
): ClanRelicInfo {
  return {
    clanId,
    relicName: `Pusaka Suci ${cityName}`,
    relicTitle: `Artefak Pusaka ${specialization || 'Komunitas'}`,
    elementBuffName: `Aura Kejayaan ${cityName}`,
    baseBonusPercent: 15,
    bonusPerLevel: 4,
    lore: `Artefak pusaka legendaris yang ditempa oleh pendiri klan di ${cityName} untuk memperkuat seluruh anggota klan.`,
  };
}

/**
 * Kalkulator Simulasi Rute Perjalanan & Kapal Udara Antar Kota
 */
export function calculateTravelRoute(
  fromCity: WorldCity,
  toCity: WorldCity
): ActiveTravelRoute {
  const dx = toCity.worldXPercent - fromCity.worldXPercent;
  const dy = toCity.worldYPercent - fromCity.worldYPercent;
  const distUnits = Math.hypot(dx, dy);
  const distanceLeagues = Math.max(12, Math.round(distUnits * 4.8));
  const durationMinutes = Math.max(4, Math.round(distanceLeagues / 9));

  const navalCities = ['lunaris', 'astralis', 'nivara'];
  const highAltitudeCities = ['aetheria', 'drakonia'];

  let transportName = 'Kapal Udara Aether';
  if (navalCities.includes(fromCity.id) && navalCities.includes(toCity.id)) {
    transportName = 'Armada Cepat Pasang Perak';
  } else if (
    highAltitudeCities.includes(fromCity.id) ||
    highAltitudeCities.includes(toCity.id)
  ) {
    transportName = 'Kapal Udara Sky-Galleon';
  } else {
    transportName = 'Skuadron Griffin Kekaisaran';
  }

  let hazardLevel = 'Aman (Jalur Patroli)';
  if (fromCity.id === 'drakonia' || toCity.id === 'drakonia') {
    hazardLevel = 'Tinggi (Wilayah Infernal Wyrm)';
  } else if (distUnits > 50) {
    hazardLevel = 'Menengah (Lintas Samudra)';
  }

  return {
    fromCityId: fromCity.id,
    toCityId: toCity.id,
    transportName,
    distanceLeagues,
    durationMinutes,
    hazardLevel,
  };
}
