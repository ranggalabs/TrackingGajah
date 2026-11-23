import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ElephantMap } from './components/ElephantMap';
import { LoginPage, LoggedInUser } from './components/LoginPage';
import {
  ElephantGps,
  HistoryPoint,
  AnalyticsResponse,
  DailyAnalyticsSummary,
} from './types';
import {
  Home,
  Calendar,
  Bell,
  Settings,
  RefreshCw,
  Share2,
  Download,
  LogOut,
  Sun,
  Moon,
  MapPin,
  Radio,
  ShieldCheck,
  Clock,
  Activity,
  Navigation,
  Database,
  Server,
  Plus,
  Trash2,
  AlertTriangle,
  Compass,
  Play,
  Pause,
  RotateCcw,
  BarChart3,
  Route,
  Gauge,
  FileSpreadsheet,
} from 'lucide-react';

const TOKEN_STORAGE_KEY = 'elephant_tracker_token';
const USER_STORAGE_KEY = 'elephant_tracker_user';
const THEME_STORAGE_KEY = 'elephant_tracker_theme';

function formatDurationMinutes(totalMinutes?: number): string {
  if (!totalMinutes || totalMinutes <= 0) return '0 menit';
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const mins = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}h`);
  if (hours > 0) parts.push(`${hours}j`);
  if (mins > 0) parts.push(`${mins}m`);
  return parts.join(' ');
}

function getCardinalDirection(deg?: number): string {
  if (deg === undefined || deg === null) return 'Utara';
  const dirs = ['Utara', 'Timur Laut', 'Timur', 'Tenggara', 'Selatan', 'Barat Daya', 'Barat', 'Barat Laut'];
  return dirs[Math.round(((deg %= 360) < 0 ? deg + 360 : deg) / 45) % 8];
}

export const App: React.FC = () => {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem(THEME_STORAGE_KEY, 'light');
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode((prev) => !prev);

  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_STORAGE_KEY),
  );
  const [currentUser, setCurrentUser] = useState<LoggedInUser | null>(() => {
    const saved = localStorage.getItem(USER_STORAGE_KEY);
    if (!saved) return null;
    try {
      return JSON.parse(saved) as LoggedInUser;
    } catch {
      return null;
    }
  });

  const [activeNav, setActiveNav] = useState<'home' | 'analytics' | 'history' | 'device' | 'setting'>('home');
  const [elephants, setElephants] = useState<ElephantGps[]>([]);
  const [selectedElephant, setSelectedElephant] = useState<ElephantGps | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('2026-11-23');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [activeStepNode, setActiveStepNode] = useState<number>(1);
  const [focusCoord, setFocusCoord] = useState<[number, number] | null>(null);

  // Route Playback Player State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackIdx, setPlaybackIdx] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(2); // 1x, 2x, 5x, 10x

  // Status koneksi nyata
  const [backendConnected, setBackendConnected] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [lastHttpCheck, setLastHttpCheck] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Form tambah perangkat baru
  const [newName, setNewName] = useState<string>('');
  const [newPlatNo, setNewPlatNo] = useState<string>('');
  const [newImei, setNewImei] = useState<string>('');
  const [formMsg, setFormMsg] = useState<string | null>(null);

  const handleLoginSuccess = (newToken: string, user: LoggedInUser) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    setToken(newToken);
    setCurrentUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    setToken(null);
    setCurrentUser(null);
    setElephants([]);
    setSelectedElephant(null);
    setHistory([]);
    setAnalytics(null);
    setBackendConnected(false);
  };

  const fetchData = async (selectedGuid?: string, dateFilter?: string) => {
    if (!token) return;
    const activeDate = dateFilter !== undefined ? dateFilter : selectedDate;
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get('/v1/gps/all/paginate?page=1&limit=20', { headers });
      const items: ElephantGps[] = res.data?.data?.items || [];

      setBackendConnected(true);
      setErrorBanner(null);
      setLastHttpCheck(new Date().toLocaleTimeString('id-ID'));
      setElephants(items);

      if (items.length > 0) {
        const targetGuid = selectedGuid || selectedElephant?.deviceGuid;
        const current =
          items.find((i) => i.deviceGuid === targetGuid) ||
          items.find((i) => i.gpsNumber === '355228044909404') ||
          items[0];
        setSelectedElephant(current);

        const [histRes, analyticsRes] = await Promise.all([
          axios.get(
            `/v1/histories/raw/${current.deviceGuid}?limit=2000&date=${activeDate}`,
            { headers },
          ),
          axios.get(`/v1/histories/analytics/${current.deviceGuid}`, { headers }),
        ]);

        const pts: HistoryPoint[] = Array.isArray(histRes.data?.data)
          ? histRes.data.data
          : [];
        setHistory(pts);

        const anData: AnalyticsResponse | null = analyticsRes.data?.data || null;
        setAnalytics(anData);

        // Jika tanggal yang dipilih tidak ada di daftar, pilih tanggal terbaru yang tersedia
        if (
          anData &&
          anData.availableDates.length > 0 &&
          activeDate !== 'all' &&
          !anData.availableDates.includes(activeDate)
        ) {
          const latestAvailable =
            anData.availableDates[anData.availableDates.length - 1];
          setSelectedDate(latestAvailable);
        }
      } else {
        setSelectedElephant(null);
        setHistory([]);
        setAnalytics(null);
      }
    } catch (err: any) {
      if (err.response?.status === 401) {
        handleLogout();
        return;
      }
      setBackendConnected(false);
      setErrorBanner('Koneksi ke server Backend (Port 3000) terputus.');
    }
  };

  // Jalankan Route Playback Animation
  useEffect(() => {
    if (!isPlaying || history.length <= 1) return;
    const intervalMs = Math.max(60, Math.round(500 / playbackSpeed));
    const timer = setInterval(() => {
      setPlaybackIdx((prev) => {
        if (prev + 1 >= history.length) {
          setIsPlaying(false);
          return 0;
        }
        return prev + 1;
      });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed, history.length]);

  const handleDateChange = (newDate: string) => {
    setIsPlaying(false);
    setPlaybackIdx(0);
    setSelectedDate(newDate);
    void fetchData(undefined, newDate);
  };

  const handleManualSync = async () => {
    if (!token || syncing) return;
    setSyncing(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post('/v1/gps/sync', {}, { headers });
      await fetchData();
    } catch (err: any) {
      setBackendConnected(false);
      setErrorBanner(err.response?.data?.message || 'Gagal menyinkronkan data dari perangkat.');
    } finally {
      setSyncing(false);
    }
  };

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setFormMsg(null);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(
        '/v1/gps',
        {
          name: newName.trim(),
          platNo: newPlatNo.trim(),
          gpsNumber: newImei.trim(),
          gpsType: 'hewan',
        },
        { headers },
      );
      setNewName('');
      setNewPlatNo('');
      setNewImei('');
      setFormMsg('Perangkat berhasil ditambahkan ke MongoDB.');
      await fetchData();
    } catch (err: any) {
      setFormMsg(err.response?.data?.message || 'Gagal menambahkan perangkat.');
    }
  };

  const handleDeleteDevice = async (guid: string) => {
    if (!token) return;
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.delete(`/v1/gps/${guid}`, { headers });
      await fetchData();
    } catch (err: any) {
      setErrorBanner(err.response?.data?.message || 'Gagal menghapus perangkat.');
    }
  };

  useEffect(() => {
    if (!token) return;
    void fetchData();
    let interval: any;
    if (autoRefresh && !isPlaying) {
      interval = setInterval(() => void fetchData(), 10000);
    }
    return () => clearInterval(interval);
  }, [token, autoRefresh, selectedDate, isPlaying]);

  if (!token) {
    return (
      <LoginPage
        onLoginSuccess={handleLoginSuccess}
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
      />
    );
  }

  // Ringkasan analitik pada tanggal yang sedang dipilih (atau keseluruhan)
  const currentDaySummary: DailyAnalyticsSummary | null =
    analytics?.dailySummaries.find((d) => d.date === selectedDate) || null;

  const activeDistanceKm =
    selectedDate === 'all'
      ? analytics?.totalDistanceAllDaysKm ?? 0
      : currentDaySummary?.distanceKm ?? 0;

  const activeMaxSpeed =
    selectedDate === 'all'
      ? analytics?.maxSpeedAllDaysKmh ?? 0
      : currentDaySummary?.maxSpeedKmh ?? 0;

  const activeAvgSpeed =
    selectedDate === 'all'
      ? analytics && analytics.dailySummaries.length > 0
        ? Math.round(
            (analytics.dailySummaries.reduce((acc, s) => acc + s.avgMovingSpeedKmh, 0) /
              analytics.dailySummaries.length) *
              10,
          ) / 10
        : 0
      : currentDaySummary?.avgMovingSpeedKmh ?? 0;

  const activeGpsPercent =
    selectedDate === 'all'
      ? analytics?.gpsRatioPercent ?? 100
      : currentDaySummary && currentDaySummary.totalPoints > 0
        ? Math.round((currentDaySummary.gpsPoints / currentDaySummary.totalPoints) * 100)
        : 100;

  const activePlaybackPoint: HistoryPoint | null =
    history.length > 0 && playbackIdx < history.length ? history[playbackIdx] : null;

  const rawDeviceStatus = selectedElephant?.terminalInfo?.deviceStatus || 'Offline';
  const isDeviceOnline =
    backendConnected &&
    selectedElephant !== null &&
    (rawDeviceStatus === 'Move' ||
      rawDeviceStatus === 'Stop' ||
      selectedElephant.terminalInfo?.status === true);

  // Bangun grafik profil kecepatan (Speed vs Time) dari array history tanggal terpilih
  const buildSpeedProfilePath = (): { line: string; area: string } => {
    if (history.length < 2) {
      return { line: 'M 5 65 L 195 65', area: 'M 5 72 L 195 72 Z' };
    }
    const maxPts = 60;
    const stride = Math.max(1, Math.floor(history.length / maxPts));
    const sampled = history.filter((_, i) => i % stride === 0);
    const maxSpd = Math.max(10, ...sampled.map((p) => p.speed || 0));

    const coords = sampled.map((pt, idx) => {
      const x = 5 + (idx / Math.max(1, sampled.length - 1)) * 190;
      const y = 68 - ((pt.speed || 0) / maxSpd) * 56;
      return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
    });

    const line = coords
      .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`)
      .join(' ');
    const area = `${line} L ${coords[coords.length - 1].x} 72 L ${coords[0].x} 72 Z`;
    return { line, area };
  };

  const speedChart = buildSpeedProfilePath();

  // Ekspor CSV Rekap Harian (Untuk Tabel Bab 4 Skripsi)
  const handleExportDailyCsv = () => {
    if (!analytics || analytics.dailySummaries.length === 0) return;
    const headers = [
      'Tanggal',
      'Jumlah Titik',
      'Jarak Tempuh (km)',
      'Kecepatan Rata-rata (km/jam)',
      'Kecepatan Maksimum (km/jam)',
      'Durasi Bergerak (menit)',
      'Durasi Diam (menit)',
      'Titik GPS Satelit',
      'Titik LBS BTS',
      'Luas Area Jelajah (Hektar)',
      'Koordinat Awal',
      'Koordinat Akhir',
    ];
    const rows = analytics.dailySummaries.map((s) => [
      s.date,
      s.totalPoints,
      s.distanceKm,
      s.avgMovingSpeedKmh,
      s.maxSpeedKmh,
      s.movingDurationMinutes,
      s.idleDurationMinutes,
      s.gpsPoints,
      s.lbsPoints,
      s.areaHectares,
      `"${s.startCoord[0]}, ${s.startCoord[1]}"`,
      `"${s.endCoord[0]}, ${s.endCoord[1]}"`,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `rekap-analitik-harian-${selectedElephant?.platNo || 'gt02a'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Ekspor CSV Titik Koordinat pada Tanggal Terpilih
  const handleExportTrackCsv = () => {
    if (history.length === 0) return;
    const headers = [
      'No',
      'Waktu Fix GPS',
      'Latitude',
      'Longitude',
      'Kecepatan (km/jam)',
      'Arah Kompas (Derajat)',
      'Jarak Segmen Haversine (meter)',
      'Sumber Sinyal',
      'Status Berhenti',
    ];
    const rows = history.map((pt, idx) => [
      idx + 1,
      `"${new Date(pt.fixTime).toLocaleString('id-ID')}"`,
      pt.latitude,
      pt.longitude,
      pt.speed,
      pt.course,
      pt.distanceMeters ?? 0,
      pt.dataType === 2 ? 'LBS BTS' : 'GPS Satelit',
      pt.isStop ? 'Diam' : 'Bergerak',
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `rute-koordinat-${selectedDate}-${selectedElephant?.platNo || 'gt02a'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const navItems = [
    {
      id: 'home',
      label: 'Peta & Route Playback',
      sub: `${history.length} Titik (${selectedDate === 'all' ? 'Semua Hari' : selectedDate})`,
      icon: Home,
    },
    {
      id: 'analytics',
      label: 'Analitik Olahan Harian',
      sub: `${analytics?.totalDaysRecorded || 0} Hari • ${analytics?.totalDistanceAllDaysKm || 0} km`,
      icon: BarChart3,
    },
    {
      id: 'history',
      label: 'Tabel Log Koordinat',
      sub: 'Filter Tanggal & Ekspor CSV',
      icon: Calendar,
    },
    {
      id: 'device',
      label: 'Manajemen Perangkat',
      sub: `${elephants.length} Unit Terdaftar`,
      icon: Bell,
    },
    {
      id: 'setting',
      label: 'Pengaturan Sistem',
      sub: 'Konfigurasi & Diagnostik',
      icon: Settings,
    },
  ] as const;

  const protocolSteps = [
    {
      label: '1. Server GT06',
      badge: backendConnected ? 'Port 7018 Aktif' : 'Terputus',
      detail: backendConnected
        ? `REST API Port 3000 & TCP Socket Port 7018 Aktif (Sinkronisasi: ${lastHttpCheck || '-'})`
        : 'Backend tidak merespons pada port 3000',
    },
    {
      label: '2. Jarak Haversine',
      badge: `${activeDistanceKm} km (${selectedDate === 'all' ? 'Total' : selectedDate})`,
      detail: `Dihitung dengan rumus Haversine dari ${history.length} titik koordinat berurutan pada periode ${selectedDate}`,
    },
    {
      label: '3. Kecepatan & Arah',
      badge: `Maks ${activeMaxSpeed} km/j • Rata2 ${activeAvgSpeed} km/j`,
      detail: currentDaySummary
        ? `Durasi Bergerak: ${currentDaySummary.movingDurationMinutes} menit • Area Jelajah: ${currentDaySummary.areaHectares} Hektar (${currentDaySummary.areaKm2} km²)`
        : `Total titik seluruh hari: ${analytics?.totalPointsAllDays || 0} titik`,
    },
    {
      label: '4. Kualitas Sinyal',
      badge: `${activeGpsPercent}% Satelit GPS`,
      detail: `Proporsi penangkapan sinyal: ${activeGpsPercent}% GPS Satelit Murni vs ${100 - activeGpsPercent}% LBS BTS Seluler`,
    },
  ];

  return (
    <div className="h-screen w-screen flex overflow-hidden p-4 lg:p-5 gap-5 select-none">
      {/* =====================================================================
          BAGIAN KIRI: SIDEBAR DASHBOARD NEUMORPHIC
      ===================================================================== */}
      <aside className="w-72 xl:w-80 shrink-0 neu-card rounded-[34px] p-5 flex flex-col justify-between overflow-y-auto">
        <div className="space-y-5">
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-3.5 px-2 pt-1">
            <div className="w-12 h-12 rounded-2xl blue-grad blue-grad-shadow flex items-center justify-center text-2xl text-white shrink-0">
              🐘
            </div>
            <div className="overflow-hidden">
              <h1 className="text-base font-bold text-slate-700 dark:text-slate-100 tracking-tight truncate">
                Elephant Tracker
              </h1>
              <span className="inline-block text-[10px] font-medium px-2.5 py-0.5 rounded-full blue-grad text-white mt-0.5">
                GT02A • {analytics?.totalPointsAllDays || history.length} Real Logs
              </span>
            </div>
          </div>

          {/* Filter Pilih Tanggal Perjalanan (Langsung Memperbarui Peta & Grafik) */}
          <div className="neu-inset-circle rounded-[24px] p-3.5 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              <span className="flex items-center gap-1.5">
                <Route className="w-3.5 h-3.5" />
                Filter Tanggal Rute
              </span>
              <span>{history.length} Titik</span>
            </div>
            <select
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full neu-card rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-100 focus:outline-none cursor-pointer"
            >
              <option value="all" className="text-slate-800">
                🌍 Semua Tanggal ({analytics?.totalPointsAllDays || 0} Titik)
              </option>
              {(analytics?.dailySummaries || [])
                .slice()
                .reverse()
                .map((d) => (
                  <option key={d.date} value={d.date} className="text-slate-800">
                    📅 {d.date} ({d.totalPoints} Titik • {d.distanceKm} km)
                  </option>
                ))}
            </select>
          </div>

          {/* Navigation Menu List */}
          <div className="space-y-2">
            <div className="px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Menu Dashboard
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveNav(item.id)}
                  className={`w-full rounded-[22px] p-2.5 flex items-center gap-3 text-left transition-all cursor-pointer ${
                    isActive
                      ? 'neu-glow-card scale-[1.02]'
                      : 'hover:bg-white/50 dark:hover:bg-slate-800/40 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-all ${
                      isActive
                        ? 'blue-grad blue-grad-shadow text-white'
                        : 'border border-slate-300/80 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="overflow-hidden">
                    <div
                      className={`text-xs font-medium truncate ${
                        isActive
                          ? 'text-blue-600 dark:text-blue-400 font-semibold'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {item.label}
                    </div>
                    <div className="text-[10px] text-slate-400 font-light truncate">
                      {item.sub}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Unit Collar Card in Sidebar */}
          <div className="neu-inset-circle rounded-[24px] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Unit Pelacak
              </span>
              {!backendConnected ? (
                <span className="flex items-center gap-1.5 text-[10px] font-semibold text-red-500">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  Server Mati
                </span>
              ) : isDeviceOnline ? (
                <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  {rawDeviceStatus === 'Move' ? 'Bergerak' : 'Diam (Online)'}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-500">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  Offline
                </span>
              )}
            </div>

            {selectedElephant && (
              <div className="text-[11px] space-y-0.5">
                <div className="font-semibold text-slate-700 dark:text-slate-100 truncate">
                  {selectedElephant.name}
                </div>
                <div className="text-slate-400 font-mono">
                  ID: {selectedElephant.platNo} • IMEI: {selectedElephant.gpsNumber}
                </div>
                <div className="text-slate-400">
                  Total Odometer:{' '}
                  <strong className="text-blue-600 dark:text-blue-400">
                    {analytics?.totalDistanceAllDaysKm ?? selectedElephant.odoMeter ?? 0} km
                  </strong>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={handleManualSync}
                disabled={syncing || !backendConnected}
                className="neu-card rounded-xl py-2 px-2 flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-200 hover:text-blue-600 disabled:opacity-50 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${syncing ? 'animate-spin' : ''}`} />
                <span>{syncing ? 'Syncing...' : 'Sync Cloud'}</span>
              </button>
              <button
                onClick={handleExportDailyCsv}
                disabled={!analytics}
                className="neu-card rounded-xl py-2 px-2 flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-200 hover:text-blue-600 disabled:opacity-50 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                <span>Rekap CSV</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Sidebar: Logged-in User & Logout Button */}
        <div className="pt-3 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-9 h-9 rounded-xl blue-grad flex items-center justify-center text-white font-semibold text-xs shrink-0">
              {currentUser?.name?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                {currentUser?.name}
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                {currentUser?.email}
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            title="Keluar dari Dashboard"
            className="w-10 h-10 rounded-xl neu-card flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-red-500 transition-colors shrink-0 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* =====================================================================
          BAGIAN TENGAH / UTAMA: KONTEN DASHBOARD, PETA RUTE, & ANALITIK
      ===================================================================== */}
      <main className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
        {errorBanner && (
          <div className="neu-card rounded-2xl px-5 py-3 border border-red-300 dark:border-red-500/40 bg-red-50/80 dark:bg-red-950/30 text-red-600 dark:text-red-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorBanner}</span>
            </div>
            <button
              onClick={() => void fetchData()}
              className="px-3 py-1 rounded-lg bg-red-600 text-white font-medium cursor-pointer"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {/* 1. TOP HEADER BAR */}
        <header className="flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div>
            <div className="text-xs text-slate-400 font-light">
              Analitik &amp; Pelacakan Rute Perjalanan •{' '}
              {selectedDate === 'all' ? 'Seluruh Riwayat (8 Hari)' : `Tanggal ${selectedDate}`}
            </div>
            <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-100">
              {navItems.find((n) => n.id === activeNav)?.label}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Quick Date Pills */}
            <div className="hidden 2xl:flex items-center gap-1.5">
              {(analytics?.availableDates || []).slice(-4).map((d) => (
                <button
                  key={d}
                  onClick={() => handleDateChange(d)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    selectedDate === d
                      ? 'blue-grad text-white blue-grad-shadow'
                      : 'neu-card text-slate-500 dark:text-slate-300'
                  }`}
                >
                  {d.slice(5)}
                </button>
              ))}
            </div>

            {/* Neumorphic ON / OFF Auto-Refresh Switch */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              title="Saklar Polling Otomatis"
              className="neu-card rounded-[22px] p-1.5 w-[94px] h-[50px] flex items-center relative cursor-pointer transition-all"
            >
              <div
                className={`w-full h-full rounded-[16px] flex items-center px-2.5 font-medium text-xs transition-all ${
                  autoRefresh
                    ? 'blue-grad text-white justify-end'
                    : 'bg-slate-200/70 dark:bg-slate-800 text-slate-400 justify-start'
                }`}
              >
                <span>{autoRefresh ? 'ON' : 'OFF'}</span>
              </div>
              <div
                className={`absolute top-1.5 bottom-1.5 w-[36px] rounded-[14px] bg-white dark:bg-slate-200 shadow-md flex items-center justify-center gap-0.5 transition-all ${
                  autoRefresh ? 'left-1.5' : 'right-1.5'
                }`}
              >
                <span className="w-0.5 h-3 bg-slate-200 dark:bg-slate-400 rounded-full"></span>
                <span className="w-0.5 h-3 bg-slate-200 dark:bg-slate-400 rounded-full"></span>
              </div>
            </button>

            {/* Dark / Light Mode Button */}
            <button
              onClick={toggleDarkMode}
              title={darkMode ? 'Ganti ke Light Mode' : 'Ganti ke Dark Mode'}
              className="h-[50px] px-4 rounded-[22px] neu-card flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-200 hover:text-blue-600 transition-colors cursor-pointer"
            >
              {darkMode ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-blue-600" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              )}
            </button>
          </div>
        </header>

        {/* 2. TOP ANALYTICS WIDGETS ROW (100% Data Olahan Haversine, Kecepatan, & Kualitas Sinyal) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 shrink-0">
          {/* Card A: Jarak Tempuh Haversine & Area Jelajah (4 cols) */}
          <div className="md:col-span-4 neu-card rounded-[28px] p-4 flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                  JARAK TEMPUH (HAVERSINE)
                </div>
                <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                  {activeDistanceKm}{' '}
                  <span className="text-xs font-normal text-slate-400">km</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-slate-400">Luas Jelajah</div>
                <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                  {currentDaySummary ? `${currentDaySummary.areaHectares} Ha` : `${analytics?.totalDaysRecorded || 0} Hari`}
                </div>
              </div>
            </div>

            {/* Progress Bar Rasio Titik Bergerak vs Berhenti */}
            <div>
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="text-slate-400">
                  Durasi Aktif: {currentDaySummary?.movingDurationMinutes ?? 0} mnt •{' '}
                  {history.length} Titik
                </span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  Maks {activeMaxSpeed} km/j
                </span>
              </div>
              <div className="h-2.5 bg-slate-200/80 dark:bg-slate-800 rounded-full relative flex items-center">
                <div
                  className="h-full rounded-full blue-grad transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.max(12, Math.round((activeDistanceKm / 35) * 100)))}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>

          {/* Card B: Concentric Circular Gauge (Rasio Sinyal Satelit GPS vs LBS BTS) (4 cols) */}
          <div className="md:col-span-4 neu-card rounded-[28px] px-5 py-3.5 flex items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                AKURASI SINYAL &amp; KECEPATAN
              </div>
              <div className="text-lg font-bold text-slate-800 dark:text-slate-100">
                Rata2: {activeAvgSpeed}{' '}
                <span className="text-xs font-normal text-slate-400">km/jam</span>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                <span>Satelit GPS: {currentDaySummary?.gpsPoints ?? history.length} titik</span>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>LBS BTS: {currentDaySummary?.lbsPoints ?? 0} titik</span>
              </div>
            </div>

            <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <defs>
                  <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#1ea7fd" />
                    <stop offset="100%" stopColor="#321fdb" />
                  </linearGradient>
                </defs>
                <circle
                  cx="60"
                  cy="60"
                  r="44"
                  fill="none"
                  stroke={darkMode ? '#334155' : '#cbd5e1'}
                  strokeWidth="8"
                  strokeDasharray="190 280"
                  strokeLinecap="round"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="url(#lineGrad)"
                  strokeWidth="8"
                  strokeDasharray={`${(activeGpsPercent / 100) * 240} 330`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="w-14 h-14 rounded-full neu-inset-circle flex flex-col items-center justify-center">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-100">
                  {activeGpsPercent}%
                </span>
                <span className="text-[8px] text-slate-400">GPS Fix</span>
              </div>
            </div>
          </div>

          {/* Card C: Grafik Profil Kecepatan (Speed vs Time Area Chart) (4 cols) */}
          <div className="md:col-span-4 neu-card rounded-[28px] px-5 py-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-100">
                  Profil Kecepatan ({selectedDate})
                </div>
                <div className="text-[10px] text-slate-400">
                  Puncak: {activeMaxSpeed} km/jam
                </div>
              </div>
              <button
                onClick={handleExportTrackCsv}
                className="px-2.5 py-1 rounded-lg blue-grad text-white text-[10px] font-medium flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3 h-3" />
                <span>CSV Rute</span>
              </button>
            </div>

            <svg viewBox="0 0 200 74" className="w-full h-14 overflow-visible mt-1">
              <defs>
                <linearGradient id="mountGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#1ea7fd" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#2b2eff" stopOpacity="0.15" />
                </linearGradient>
              </defs>
              <path d={speedChart.area} fill="url(#mountGrad)" />
              <path
                d={speedChart.line}
                fill="none"
                stroke="#2563eb"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* 3. CENTER MAIN WORKSPACE: PETA RUTE + ROUTE PLAYBACK PLAYER + PANEL ANALITIK */}
        <div className="flex-1 min-h-[380px] flex flex-col lg:flex-row gap-5">
          {/* Peta Live Tracking & Riwayat Rute */}
          <div
            className={`neu-glow-card rounded-[34px] p-3 flex flex-col gap-2.5 relative transition-all ${
              activeNav === 'home' ? 'w-full' : 'w-full lg:w-7/12'
            }`}
          >
            {/* Floating Overlay Info on Top-Right of Map */}
            <div className="absolute top-6 right-6 z-[400] neu-card rounded-2xl px-4 py-2 flex items-center gap-3 pointer-events-auto">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isPlaying
                    ? 'bg-amber-500 animate-ping'
                    : isDeviceOnline
                      ? 'bg-emerald-500 animate-pulse'
                      : 'bg-blue-500'
                }`}
              ></span>
              <div className="text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-100">
                  {activePlaybackPoint
                    ? `▶️ ${new Date(activePlaybackPoint.fixTime).toLocaleTimeString('id-ID')} (${activePlaybackPoint.speed} km/j)`
                    : `Rute ${selectedDate}: ${history.length} Titik (${activeDistanceKm} km)`}
                </span>
              </div>
            </div>

            {/* Map Canvas */}
            <div className="flex-1 w-full rounded-[24px] overflow-hidden">
              <ElephantMap
                elephant={selectedElephant}
                history={history}
                darkMode={darkMode}
                focusCoord={focusCoord}
                playbackPoint={activePlaybackPoint}
                selectedDate={selectedDate}
              />
            </div>

            {/* Interactive Route Playback Control Bar (Di Bawah Peta) */}
            {history.length > 1 && (
              <div className="neu-card rounded-[20px] px-4 py-2.5 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="px-3.5 py-1.5 rounded-xl blue-grad text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isPlaying ? 'Pause' : 'Putar Rute'}</span>
                </button>

                <button
                  onClick={() => {
                    setIsPlaying(false);
                    setPlaybackIdx(0);
                  }}
                  title="Ulang dari Titik Awal"
                  className="p-1.5 rounded-xl neu-inset-circle text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                {/* Scrubber Slider Waktu Perjalanan */}
                <div className="flex-1 flex items-center gap-3 min-w-[180px]">
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, history.length - 1)}
                    value={playbackIdx}
                    onChange={(e) => {
                      setIsPlaying(false);
                      setPlaybackIdx(Number(e.target.value));
                    }}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                  <span className="text-[11px] font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    Titik {playbackIdx + 1}/{history.length}
                  </span>
                </div>

                {/* Pilihan Kecepatan Putar */}
                <div className="flex items-center gap-1">
                  {[1, 2, 5, 10].map((spd) => (
                    <button
                      key={spd}
                      onClick={() => setPlaybackSpeed(spd)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-semibold cursor-pointer ${
                        playbackSpeed === spd
                          ? 'blue-grad text-white'
                          : 'neu-inset-circle text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Panel Samping Kontekstual: Analitik Olahan Harian / Tabel Log / Perangkat / Setting */}
          {activeNav !== 'home' && (
            <div className="w-full lg:w-5/12 neu-card rounded-[34px] p-5 flex flex-col overflow-y-auto">
              {/* TAB ANALITIK OLAHAN HARIAN (Perbandingan 8 Hari Perjalanan) */}
              {activeNav === 'analytics' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-slate-700 dark:text-slate-100">
                        Olahan Data Perjalanan Harian
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Klik baris tanggal untuk menampilkan rutenya di peta
                      </p>
                    </div>
                    <button
                      onClick={handleExportDailyCsv}
                      className="px-3 py-1.5 rounded-xl blue-grad text-white text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Unduh CSV Skripsi</span>
                    </button>
                  </div>

                  {/* Grafik Batang Perbandingan Jarak Tempuh Harian */}
                  <div className="neu-inset-circle rounded-2xl p-4 space-y-2.5">
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Grafik Perbandingan Jarak Tempuh &amp; Titik per Hari
                    </div>
                    <div className="space-y-2">
                      {(analytics?.dailySummaries || []).map((day) => {
                        const maxDist = Math.max(
                          1,
                          ...(analytics?.dailySummaries.map((d) => d.distanceKm) || [1]),
                        );
                        const barWidth = Math.max(8, Math.round((day.distanceKm / maxDist) * 100));
                        const isSelected = selectedDate === day.date;
                        return (
                          <div
                            key={day.date}
                            onClick={() => handleDateChange(day.date)}
                            className={`p-2 rounded-xl cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-blue-500/10 border border-blue-500/40'
                                : 'hover:bg-white/40 dark:hover:bg-slate-800/40'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px] mb-1">
                              <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                                📅 {day.date} ({day.totalPoints} titik)
                              </span>
                              <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">
                                {day.distanceKm} km • Maks {day.maxSpeedKmh} km/j
                              </span>
                            </div>
                            <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full blue-grad"
                                style={{ width: `${barWidth}%` }}
                              ></div>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                              <span>
                                Aktif: {day.movingDurationMinutes} mnt • Area: {day.areaHectares} Ha
                              </span>
                              <span>
                                GPS: {day.gpsPoints} | LBS: {day.lbsPoints}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB TABEL LOG KOORDINAT */}
              {activeNav === 'history' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-slate-700 dark:text-slate-100">
                        Log Koordinat ({selectedDate}: {history.length} Titik)
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Klik baris untuk melompat ke titik jalan di peta
                      </p>
                    </div>
                    <button
                      onClick={handleExportTrackCsv}
                      disabled={history.length === 0}
                      className="px-3 py-1.5 rounded-xl blue-grad text-white text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Unduh CSV</span>
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                    {history.map((pt, i) => (
                      <button
                        key={pt._id || i}
                        onClick={() => {
                          setPlaybackIdx(i);
                          setFocusCoord([pt.latitude, pt.longitude]);
                        }}
                        className="w-full text-left neu-inset-circle rounded-2xl p-2.5 flex items-center justify-between text-xs hover:border hover:border-blue-500 transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-lg blue-grad text-white font-mono text-[10px] flex items-center justify-center shrink-0">
                            {i + 1}
                          </span>
                          <div>
                            <div className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                              {pt.latitude.toFixed(6)}, {pt.longitude.toFixed(6)}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {new Date(pt.fixTime).toLocaleString('id-ID')} • +
                              {pt.distanceMeters ?? 0}m
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="px-2 py-0.5 rounded-lg blue-grad text-white font-mono text-[10px]">
                            {pt.speed} km/j
                          </span>
                          <div className="text-[9px] text-slate-400 mt-0.5">
                            {pt.dataType === 2 ? 'LBS BTS' : 'GPS Satelit'} • {pt.course}°
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB MANAJEMEN PERANGKAT */}
              {activeNav === 'device' && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-base font-semibold text-slate-700 dark:text-slate-100">
                      Daftar Unit Terdaftar ({elephants.length})
                    </h3>
                    <div className="mt-2.5 space-y-2">
                      {elephants.map((el) => (
                        <div
                          key={el.deviceGuid}
                          className="neu-inset-circle rounded-2xl p-3 flex items-center justify-between text-xs"
                        >
                          <div
                            onClick={() => void fetchData(el.deviceGuid)}
                            className="cursor-pointer flex-1"
                          >
                            <div className="font-semibold text-slate-700 dark:text-slate-200">
                              {el.name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              ID: {el.platNo} • IMEI: {el.gpsNumber}
                            </div>
                          </div>
                          {elephants.length > 1 && (
                            <button
                              onClick={() => void handleDeleteDevice(el.deviceGuid)}
                              title="Hapus Perangkat"
                              className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <form
                    onSubmit={handleAddDevice}
                    className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800"
                  >
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                      <Plus className="w-4 h-4 text-blue-600" />
                      <span>Daftarkan Perangkat GT02A Baru</span>
                    </div>
                    {formMsg && (
                      <div className="text-[11px] text-blue-600 dark:text-blue-400">{formMsg}</div>
                    )}
                    <input
                      type="text"
                      required
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Nama Gajah (misal: Gajah Sumatera - Bona)"
                      className="w-full neu-inset-circle rounded-xl px-3.5 py-2 text-xs text-slate-700 dark:text-slate-100 focus:outline-none"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        required
                        value={newPlatNo}
                        onChange={(e) => setNewPlatNo(e.target.value)}
                        placeholder="ID Kalung (Collar ID)"
                        className="w-full neu-inset-circle rounded-xl px-3.5 py-2 text-xs text-slate-700 dark:text-slate-100 focus:outline-none font-mono"
                      />
                      <input
                        type="text"
                        required
                        value={newImei}
                        onChange={(e) => setNewImei(e.target.value)}
                        placeholder="Nomor IMEI (15 digit)"
                        className="w-full neu-inset-circle rounded-xl px-3.5 py-2 text-xs text-slate-700 dark:text-slate-100 focus:outline-none font-mono"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2 rounded-xl blue-grad text-white text-xs font-medium cursor-pointer"
                    >
                      Simpan Perangkat ke Database
                    </button>
                  </form>
                </div>
              )}

              {/* TAB PENGATURAN SISTEM */}
              {activeNav === 'setting' && (
                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-slate-700 dark:text-slate-100">
                    Pengaturan &amp; Sinkronisasi Riwayat
                  </h3>
                  <div className="space-y-3 text-xs">
                    <div className="neu-inset-circle rounded-2xl p-4 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-700 dark:text-slate-200">
                          Tema Tampilan (Dark Mode)
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Ubah mode terang / gelap neumorphic
                        </div>
                      </div>
                      <button
                        onClick={toggleDarkMode}
                        className="px-4 py-2 rounded-xl blue-grad text-white font-medium cursor-pointer"
                      >
                        {darkMode ? 'Aktif (Dark)' : 'Nonaktif (Light)'}
                      </button>
                    </div>

                    <div className="neu-inset-circle rounded-2xl p-4 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-700 dark:text-slate-200">
                          Impor Ulang Seluruh Riwayat Cloud
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Tarik ulang 1.333+ titik perjalanan dari server alat
                        </div>
                      </div>
                      <button
                        onClick={handleManualSync}
                        disabled={syncing || !backendConnected}
                        className="px-4 py-2 rounded-xl blue-grad text-white font-medium cursor-pointer disabled:opacity-50"
                      >
                        {syncing ? 'Mengimpor...' : 'Impor Sekarang'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 4. BOTTOM TIMELINE STEPPER BAR (Interaktif & Menampilkan Detail Olahan) */}
        <div className="neu-card rounded-[26px] px-8 py-3.5 shrink-0 space-y-2">
          <div className="relative flex items-center justify-between">
            <div className="absolute left-6 right-6 top-3 h-1.5 rounded-full blue-grad"></div>

            {protocolSteps.map((step, idx) => {
              const isSelected = activeStepNode === idx;
              return (
                <div
                  key={idx}
                  onClick={() => setActiveStepNode(idx)}
                  className="relative z-10 flex flex-col items-center cursor-pointer"
                >
                  <div className="w-6 h-6 rounded-full bg-white shadow-md border border-slate-100 flex items-center justify-center">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        idx === 0 && !backendConnected ? 'bg-red-500' : 'bg-blue-600'
                      }`}
                    ></div>
                  </div>
                  <div
                    className={`mt-2 px-3 py-1 rounded-xl text-[11px] font-medium transition-all ${
                      isSelected
                        ? 'blue-grad blue-grad-shadow text-white'
                        : 'neu-card text-slate-500 dark:text-slate-300'
                    }`}
                  >
                    {step.label}: {step.badge}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-center text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            {protocolSteps[activeStepNode]?.detail}
          </div>
        </div>
      </main>
    </div>
  );
};
