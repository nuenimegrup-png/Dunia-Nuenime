import React, { useState, useEffect } from 'react';
import {
  Settings,
  Shield,
  Users,
  Save,
  CheckCircle2,
  Check,
  X,
  Crown,
  Swords,
  Scroll,
  Award,
  UserCheck,
  Sprout,
  Image as ImageIcon,
  Compass,
  MapPin,
  ChevronRight,
  HelpCircle,
  Trash2,
  UserPlus,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { Clan, ClanRoleTitle, WorldCity, BottomNavTab } from '../types/nuenime';
import { ClanEmblemIcon } from './icons/NuenimeAssets';
import { useNuenimeRpg } from '../context/NuenimeRpgContext';

interface ClanSettingsScreenProps {
  clans: Clan[];
  cities: WorldCity[];
  onSwitchTab: (tab: BottomNavTab) => void;
  onOpenClanDetail?: (clan: Clan) => void;
}

function resolveBorderAssetUrl(border: string | null | undefined): string | null {
  if (!border) return null;
  const trimmed = border.trim();
  if (!trimmed) return null;
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('data:')
  ) {
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

// 8 Pilihan Jabatan Resmi RPG Nuenime (Bersih Tanpa Emoji)
export const CLAN_ROLES_LIST: Array<{
  id: ClanRoleTitle;
  label: string;
  badgeColor: string;
  description: string;
}> = [
  {
    id: 'Pemimpin Klan',
    label: 'Pemimpin Klan',
    badgeColor: 'border-amber-400/60 bg-transparent text-amber-300',
    description: 'Penguasa tertinggi klan dengan kendali penuh pengaturan & anggota.',
  },
  {
    id: 'Wakil Pemimpin',
    label: 'Wakil Pemimpin',
    badgeColor: 'border-sky-400/60 bg-transparent text-sky-200',
    description: 'Tangan kanan pemimpin yang mengawasi aktivitas & rekrutmen klan.',
  },
  {
    id: 'Tetua Klan',
    label: 'Tetua Klan',
    badgeColor: 'border-purple-400/60 bg-transparent text-purple-200',
    description: 'Dewan penasihat klan yang dihormati dan memandu strategi petualang.',
  },
  {
    id: 'Panglima Ksatria',
    label: 'Panglima Ksatria',
    badgeColor: 'border-emerald-400/60 bg-transparent text-emerald-200',
    description: 'Komandan garda depan pertempuran distrik kota dan simulasi misi.',
  },
  {
    id: 'Arkanis Agung',
    label: 'Arkanis Agung',
    badgeColor: 'border-indigo-400/60 bg-transparent text-indigo-200',
    description: 'Penguasa pusaka relik dan pengelola berkah afinitas elemen klan.',
  },
  {
    id: 'Ksatria Inti',
    label: 'Ksatria Inti',
    badgeColor: 'border-teal-400/60 bg-transparent text-teal-200',
    description: 'Pejuang berdedikasi tinggi dengan kontribusi EXP harian yang aktif.',
  },
  {
    id: 'Anggota',
    label: 'Anggota',
    badgeColor: 'border-slate-600 bg-transparent text-slate-300',
    description: 'Warga setia komunitas klan yang berpartisipasi dalam misi kota.',
  },
  {
    id: 'Rekrut Baru',
    label: 'Rekrut Baru',
    badgeColor: 'border-lime-500/50 bg-transparent text-lime-300',
    description: 'Anggota baru yang sedang menjalani masa bimbingan petualangan.',
  },
];

export const ClanSettingsScreen: React.FC<ClanSettingsScreenProps> = ({
  clans,
  cities,
  onSwitchTab,
  onOpenClanDetail,
}) => {
  const {
    joinedClanId,
    updateClanProfile,
    updateMemberRole,
    districtInfluence,
    getClanTotalScore,
    activeAccount,
    clanJoinRequests,
    respondJoinRequest,
    disbandClan,
    transferClanLeadership,
  } = useNuenimeRpg();

  // Ambil klan aktif pengguna
  const currentClan = clans.find((c) => c.id === joinedClanId);

  // Status Otorisasi Pemimpin Klan
  const isCurrentUserLeader =
    Boolean(currentClan && (currentClan.leaderId === activeAccount.id || currentClan.founderId === activeAccount.id));

  // Permintaan bergabung yang masuk ke klan ini
  const incomingRequests = currentClan
    ? clanJoinRequests.filter((r) => r.clanId === currentClan.id && r.status === 'pending')
    : [];

  // Modal State
  const [isRoleGuideModalOpen, setIsRoleGuideModalOpen] = useState(false);
  const [isDisbandModalOpen, setIsDisbandModalOpen] = useState(false);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  // Form State Pengaturan Profil Klan
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [motto, setMotto] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [isSavedRecently, setIsSavedRecently] = useState(false);

  // Inisialisasi formulir dari data klan aktif
  useEffect(() => {
    if (currentClan) {
      setName(currentClan.name);
      setTag(currentClan.tag);
      setMotto(currentClan.motto || '');
      setDescription(currentClan.description || '');
      setLogoUrl(currentClan.logoUrl || '');
    }
  }, [currentClan]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentClan) return;

    updateClanProfile(currentClan.id, {
      name,
      tag,
      motto,
      description,
      logoUrl,
    });

    setIsSavedRecently(true);
    setTimeout(() => setIsSavedRecently(false), 2400);
  };

  // Jika belum memiliki / bergabung ke klan
  if (!currentClan) {
    return (
      <div className="nuenime-scroll flex h-full w-full flex-col items-center justify-center overflow-y-auto bg-[#070d19] px-5 py-8 text-center text-slate-100">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/90 text-amber-300 mb-3">
          <Shield className="h-8 w-8" />
        </div>
        <h1 className="font-display text-base font-bold text-white">
          Belum Ada Klan Aktif
        </h1>
        <p className="mt-1.5 max-w-xs text-xs text-slate-400 leading-relaxed">
          Menu Pengaturan & Manajemen Klan akan aktif setelah Anda mendirikan klan (biaya 2.000 💎 di kota mana pun) atau bergabung ke dalam klan petualang.
        </p>

        <div className="mt-5 flex flex-col gap-2 w-full max-w-xs">
          <button
            type="button"
            onClick={() => onSwitchTab('dunia')}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-sky-400/50 bg-sky-600 text-xs font-bold text-white hover:bg-sky-500 active:scale-95"
          >
            <Compass className="h-4 w-4" />
            <span>Peta Dunia & Aula Kota</span>
          </button>
          <button
            type="button"
            onClick={() => onSwitchTab('klan')}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 text-xs font-semibold text-slate-300 hover:text-white active:scale-95"
          >
            <Users className="h-4 w-4" />
            <span>Buka Leaderboard Klan</span>
          </button>
        </div>
      </div>
    );
  }

  const influence = districtInfluence[currentClan.id]?.influencePercent ?? 68;
  const totalScore = getClanTotalScore(currentClan.id);

  return (
    <div className="nuenime-scroll flex h-full w-full flex-col overflow-y-auto bg-[#070d19] px-3.5 py-3.5 pb-8 text-slate-100">
      {/* Header Utama Pengaturan Klan */}
      <div className="rounded-2xl border border-slate-800/90 bg-[#0B0E14]/95 p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <ClanEmblemIcon
                variant={currentClan.emblemVariant}
                accentColor={currentClan.accentColor}
                logoUrl={currentClan.logoUrl}
                size={46}
                className="shrink-0"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wide">
                  Pengaturan Klan
                </span>
                <span className="rounded bg-sky-950/80 border border-sky-400/40 px-1.5 py-0.2 font-mono text-[9px] font-bold text-sky-200">
                  [{currentClan.tag}]
                </span>
              </div>
              <h1 className="font-display truncate text-sm font-bold text-white mt-0.5">
                {currentClan.name}
              </h1>
              <div className="flex items-center gap-2 text-[10.5px] text-slate-400 mt-0.5">
                <span className="text-sky-300">Kota {currentClan.cityName}</span>
                <span>·</span>
                <span className="font-mono text-amber-300 font-bold">{totalScore.toLocaleString('id-ID')} EXP</span>
              </div>
            </div>
          </div>

          {onOpenClanDetail && (
            <button
              type="button"
              onClick={() => onOpenClanDetail(currentClan)}
              className="flex h-8 items-center gap-1 rounded-xl border border-slate-700/80 bg-slate-900/90 px-2.5 text-[11px] font-semibold text-slate-200 hover:text-white shrink-0 active:scale-95"
            >
              <span>Markas</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* SECTION 1: FORMULIR UBAH PROFIL & LOGO KLAN */}
      <form onSubmit={handleSaveProfile} className="mt-3.5 space-y-3 rounded-2xl border border-slate-800/90 bg-slate-900/80 p-3.5">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-sky-400" />
            <h2 className="font-display text-xs font-bold text-white uppercase tracking-wide">
              Pengaturan Profil & Identitas Klan
            </h2>
          </div>
          {isSavedRecently && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Tersimpan
            </span>
          )}
        </div>

        {/* Preview & Input Link Foto Logo Bulat */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5 text-amber-400" />
              <span>Link Foto / Logo Bulat Klan</span>
            </label>
            <span className="text-[10px] text-slate-400">(Format Gambar: .png / .jpg / .webp)</span>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-2.5">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-amber-400/80 bg-slate-900">
              {logoUrl.trim() ? (
                <img
                  src={logoUrl.trim()}
                  alt="Preview Logo"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                  className="h-full w-full object-cover rounded-full"
                />
              ) : (
                <ClanEmblemIcon
                  variant={currentClan.emblemVariant}
                  accentColor={currentClan.accentColor}
                  size={32}
                />
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://i.ibb.co.com/.../logo.png"
                className="h-9 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 text-xs text-white placeholder-slate-500 focus:border-sky-400 focus:outline-none"
              />
              <p className="text-[10px] text-slate-400">
                Foto akan otomatis dijadikan logo bulat dengan bingkai emas klan.
              </p>
            </div>
          </div>
        </div>

        {/* Nama & Tag Klan */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-semibold text-slate-300">
              Nama Klan
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white focus:border-sky-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">
              Tag Klan
            </label>
            <input
              type="text"
              maxLength={5}
              required
              value={tag}
              onChange={(e) => setTag(e.target.value.toUpperCase())}
              className="h-9 w-full rounded-xl border border-slate-700 bg-slate-900 px-2.5 font-mono text-xs uppercase text-white focus:border-sky-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Motto / Slogan Klan */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-300">
            Moto / Slogan Klan
          </label>
          <input
            type="text"
            value={motto}
            onChange={(e) => setMotto(e.target.value)}
            placeholder="Contoh: Demi kehormatan dan persaudaraan!"
            className="h-9 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white focus:border-sky-400 focus:outline-none"
          />
        </div>

        {/* Deskripsi & Lore Klan */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-300">
            Deskripsi Profil Klan
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-xs text-white focus:border-sky-400 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-sky-400/50 bg-sky-600 text-xs font-bold text-white transition-all hover:bg-sky-500 active:scale-[0.98]"
        >
          <Save className="h-4 w-4" />
          <span>Simpan Perubahan Profil Klan</span>
        </button>
      </form>

      {/* SECTION 1.5: PERMINTAAN BERGABUNG MASUK (KHUSUS PEMIMPIN/PENGELOLA) */}
      {isCurrentUserLeader && (
        <div className="mt-3.5 space-y-3 rounded-2xl border border-sky-500/30 bg-[#0B0E14] p-3.5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <UserPlus className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-display text-xs font-bold text-white uppercase tracking-wide">
                  Permintaan Bergabung Masuk
                </h2>
                <p className="text-[10px] text-slate-400">
                  Konfirmasi calon anggota sebelum resmi bergabung ke {currentClan.name}.
                </p>
              </div>
            </div>
            <span className="rounded-full border border-sky-400/50 bg-sky-950/60 px-2 py-0.5 font-mono text-[10px] font-bold text-sky-200 shrink-0">
              {incomingRequests.length} Menunggu
            </span>
          </div>

          {incomingRequests.length === 0 ? (
            <div className="py-4 text-center text-xs text-slate-500">
              Tidak ada permintaan bergabung yang tertunda saat ini.
            </div>
          ) : (
            <div className="space-y-2">
              {incomingRequests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-slate-900/90 p-2.5 shadow-sm"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-sky-400/50 bg-slate-800">
                      {req.avatarUrl ? (
                        <img
                          src={req.avatarUrl}
                          alt={req.displayName || 'Pemohon'}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover rounded-full"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <Shield className="h-4 w-4 text-sky-400" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-bold text-white">
                        {req.displayName || 'Petualang Nuenime'}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[9px] font-bold text-emerald-300">
                          Lv. {req.level ?? 1}
                        </span>
                        <span className="font-mono text-[9px] text-amber-300">
                          {(req.exp ?? 0).toLocaleString('id-ID')} EXP
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => respondJoinRequest(req.id, 'approve')}
                      className="flex h-8 items-center gap-1 rounded-lg border border-emerald-500/50 bg-emerald-600/30 px-2.5 text-[11px] font-bold text-emerald-200 hover:bg-emerald-600 hover:text-white active:scale-95 transition-all shadow-sm"
                    >
                      <Check className="h-3 w-3 stroke-[3]" />
                      <span>Terima</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => respondJoinRequest(req.id, 'reject')}
                      className="flex h-8 items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2 text-[11px] font-semibold text-rose-300 hover:border-rose-500/50 hover:bg-rose-950/40 active:scale-95 transition-all"
                    >
                      <X className="h-3 w-3 stroke-[3]" />
                      <span>Tolak</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: DAFTAR ANGGOTA & PEMBERIAN JABATAN */}
      <div className="mt-3.5 space-y-3 rounded-2xl border border-slate-800/90 bg-slate-900/80 p-3.5">
        <div className="border-b border-slate-800/80 pb-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-400" />
              <h2 className="font-display text-xs font-bold text-white uppercase tracking-wide">
                Manajemen Anggota & Jabatan Klan
              </h2>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsRoleGuideModalOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-slate-800/90 px-2.5 py-1 text-[10.5px] font-bold text-amber-300 transition-colors hover:border-amber-400 hover:text-white"
              >
                <Award className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span>Panduan Jabatan</span>
              </button>
              <span className="font-mono text-[10.5px] font-bold text-slate-300">
                {currentClan.memberCount}/{currentClan.maxMembers} Anggota
              </span>
            </div>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Atur dan tetapkan gelar kehormatan untuk setiap anggota klan Anda di bawah ini:
          </p>
        </div>

        {/* Daftar Anggota dengan Avatar & Border (Persis Gambar 2) */}
        <div className="space-y-2.5">
          {currentClan.members.map((member, idx) => {
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

            const formattedLevel =
              userLevel >= 1000000
                ? `${(userLevel / 1000000).toFixed(1)}M`
                : userLevel >= 1000
                ? `${(userLevel / 1000).toFixed(1)}k`
                : userLevel.toString();

            return (
              <div
                key={member.id}
                className="flex items-center justify-between gap-2.5 rounded-2xl border border-slate-800/80 bg-slate-950/70 p-2.5 sm:p-3 transition-all"
              >
                {/* Sisi Kiri: Ranking, Avatar + Border, Nama & Level (Persis Gambar 2) */}
                <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                  {/* Ranking Number */}
                  <span
                    className={`font-mono text-xs font-bold shrink-0 w-4 text-center ${
                      idx === 0
                        ? 'text-amber-400'
                        : idx === 1
                        ? 'text-slate-300'
                        : idx === 2
                        ? 'text-amber-600'
                        : 'text-slate-500'
                    }`}
                  >
                    #{idx + 1}
                  </span>

                  {/* Avatar Bulat dengan Border Overlay Presisi */}
                  <div className="relative flex h-11 w-11 shrink-0 items-center justify-center">
                    <div
                      className={`relative h-10 w-10 overflow-hidden rounded-full bg-slate-900 flex items-center justify-center ${
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

                  {/* Info Nama, Verifikasi & Badges */}
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

                    {/* Baris Badge: Level + EXP Kontribusi */}
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/50 bg-transparent px-1.5 py-0.5 font-mono text-[9px] font-bold text-emerald-300 shrink-0">
                        <Shield className="h-2.5 w-2.5 text-emerald-400 shrink-0" />
                        <span>Lv. {formattedLevel}</span>
                      </span>

                      <span className="font-mono text-[9.5px] font-semibold text-amber-300 shrink-0">
                        {member.contributionScore.toLocaleString('id-ID')} EXP
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sisi Kanan: Dropdown Jabatan Kehormatan (Bersih Tanpa Emoji) */}
                <div className="shrink-0 text-right">
                  <label className="block text-[9.5px] font-semibold text-slate-400 mb-0.5">
                    Jabatan:
                  </label>
                  <select
                    value={member.role}
                    onChange={(e) =>
                      updateMemberRole(currentClan.id, member.id, e.target.value)
                    }
                    className="h-8 rounded-lg border border-slate-700 bg-slate-900 px-2 text-[11px] font-semibold text-sky-200 focus:border-sky-400 focus:outline-none"
                  >
                    {CLAN_ROLES_LIST.map((roleItem) => (
                      <option key={roleItem.id} value={roleItem.id}>
                        {roleItem.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 3: PEMBUBARAN KLAN (KHUSUS PEMIMPIN KLAN) */}
      {isCurrentUserLeader && (
        <div className="mt-3.5 space-y-3 rounded-2xl border border-rose-500/30 bg-rose-950/15 p-4 shadow-xl">
          <div className="flex items-center gap-2 text-rose-300">
            <Trash2 className="h-4 w-4 text-rose-400" />
            <h3 className="font-display text-xs sm:text-sm font-bold text-white uppercase tracking-wide">
              Zona Berbahaya: Pembubaran Klan
            </h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Membubarkan klan akan mengakhiri keanggotaan seluruh anggota secara otomatis dan aman. Seluruh anggota dapat bergabung ke klan lain setelahnya.
          </p>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-2.5 text-[11px] text-slate-400 space-y-1">
            <p className="text-emerald-300 font-semibold flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" /> Akun, EXP, level, dan saldo Crystal tidak akan terhapus.
            </p>
            <p className="text-slate-300 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" /> Tindakan pembubaran klan tidak dapat dibatalkan melalui aplikasi.
            </p>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => setIsDisbandModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-rose-500/50 bg-rose-600/30 px-3.5 py-2 text-xs font-bold text-rose-200 hover:border-rose-400 hover:bg-rose-600 hover:text-white active:scale-95 transition-all shadow-md"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-300" />
              <span>Hapus & Bubarkan Klan</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal Dialog Konfirmasi Pembubaran Klan */}
      {isDisbandModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl border border-rose-500/50 bg-[#0B0E14] p-4 text-slate-100 shadow-2xl">
            <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-sm font-bold text-white uppercase tracking-wide">
                  Hapus & Bubarkan Klan
                </h3>
                <p className="text-[11px] text-rose-300">{currentClan.name}</p>
              </div>
            </div>

            <div className="mt-3.5 space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <p>
                Apakah Anda yakin ingin menghapus klan <strong className="text-white">{currentClan.name}</strong>? Semua anggota ({currentClan.memberCount} orang) akan otomatis dikeluarkan dari klan ini. Tindakan ini tidak dapat dibatalkan melalui aplikasi.
              </p>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-[11px] text-slate-300 space-y-1">
                <p className="text-emerald-300 font-semibold flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" /> Akun, EXP, dan saldo Crystal anggota tetap aman.
                </p>
                <p className="text-sky-300 font-semibold flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" /> Seluruh anggota dapat bergabung dengan klan lain setelahnya.
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsDisbandModalOpen(false)}
                disabled={isSubmittingAction}
                className="flex h-10 flex-1 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  setIsSubmittingAction(true);
                  const res = await disbandClan(currentClan.id);
                  setIsSubmittingAction(false);
                  if (res.ok) {
                    setIsDisbandModalOpen(false);
                    onSwitchTab('klan');
                  }
                }}
                disabled={isSubmittingAction}
                className="flex h-10 flex-1 items-center justify-center rounded-xl border border-rose-500/50 bg-rose-600 text-xs font-bold text-white hover:bg-rose-500 active:scale-95 transition-all shadow-md"
              >
                {isSubmittingAction ? 'Memproses...' : 'Bubarkan Klan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pop-up Modal Panduan Hierarki Jabatan (Clean Dark, Tanpa Emoji) */}
      {isRoleGuideModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#0B0E14] p-4 text-slate-100 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-amber-400" />
                <h3 className="font-display text-sm font-bold text-white uppercase tracking-wide">
                  Panduan Hierarki Jabatan Klan
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRoleGuideModalOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-3.5 space-y-2 max-h-[60vh] overflow-y-auto nuenime-scroll pr-1">
              {CLAN_ROLES_LIST.map((role) => (
                <div
                  key={role.id}
                  className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-xs font-bold text-amber-300 tracking-wide">
                      {role.label}
                    </span>
                    <span className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-slate-400">
                      Gelar Resmi
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-300 leading-relaxed">
                    {role.description}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setIsRoleGuideModalOpen(false)}
                className="flex h-9 w-full items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-xs font-bold text-white hover:bg-slate-700 transition-colors"
              >
                Tutup Panduan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
