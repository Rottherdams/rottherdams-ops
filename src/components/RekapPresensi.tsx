import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import StaffLeaderboard from './StaffLeaderboard';

interface CurrentUser {
  name: string;
  role: 'management' | 'kasir' | 'bar' | 'dapur' | 'owner' | string;
  staff_id: string;
}

interface AttendanceRecord {
  id: number;
  staff_id: string;
  staff_name: string;
  role: string;
  shift: string;
  clock_in: string;
  clock_out: string | null;
  status: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  photo_url?: string | null;
  is_fake_gps?: boolean | null;
  work_hours?: number;
}

interface StaffSummary {
  staff_id: string;
  staff_name: string;
  role: string;
  totalHadir: number;
  totalJamKerja: number;
  totalAlpha: number;
}

interface RekapPresensiProps {
  currentUser: CurrentUser;
}

export default function RekapPresensi({ currentUser }: RekapPresensiProps) {
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchStaff, setSearchStaff] = useState('');
  const [filterShift, setFilterShift] = useState<'All' | 'morning' | 'night'>('All');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [viewMode, setViewMode] = useState<'pribadi' | 'semua_staf'>('pribadi');

  // State Modal Pratinjau Foto Presensi
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; staffName: string; time: string } | null>(null);

  // State sisa kuota cuti staf login
  const [myLeaveQuota, setMyLeaveQuota] = useState<number>(12);

  const rawRole = (currentUser?.role || '').toLowerCase();
  const isManagementOrOwner = 
    rawRole.includes('management') || 
    rawRole.includes('owner') ||
    currentUser.staff_id?.startsWith('MNG-') ||
    currentUser.staff_id?.startsWith('OWN-');

  useEffect(() => {
    fetchAttendances();
    fetchStaffQuota();
  }, [currentUser, selectedMonth, selectedYear]);

  // Ambil sisa kuota cuti milik staf yang login
  const fetchStaffQuota = async () => {
    if (!currentUser?.staff_id) return;
    const { data } = await supabase
      .from('staff')
      .select('leave_quota')
      .eq('staff_id', currentUser.staff_id)
      .single();

    if (data && data.leave_quota !== undefined && data.leave_quota !== null) {
      setMyLeaveQuota(data.leave_quota);
    }
  };

  const fetchAttendances = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('attendances')
      .select('*')
      .order('clock_in', { ascending: false });

    if (error) {
      console.error('Error fetching attendances:', error.message);
    } else if (data) {
      const processed = data.map((item: any) => {
        let workHours = 0;
        if (item.clock_in && item.clock_out) {
          const start = new Date(item.clock_in).getTime();
          const end = new Date(item.clock_out).getTime();
          workHours = Math.max(0, parseFloat(((end - start) / (1000 * 60 * 60)).toFixed(2)));
        }
        return { ...item, work_hours: workHours };
      });
      setAttendances(processed);
    }
    setLoading(false);
  };

  // Filter Data Berdasarkan Bulan & Tahun yang Dipilih
  const monthlyAttendances = attendances.filter(item => {
    const d = new Date(item.clock_in);
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
  });

  // Target Hari Berjalan
  const now = new Date();
  const isCurrentMonth = selectedMonth === now.getMonth() && selectedYear === now.getFullYear();
  const daysInMonthTotal = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const targetDaysCount = isCurrentMonth ? now.getDate() : daysInMonthTotal;

  // 1. STATISTIK PRESENSI PRIBADI
  const myMonthlyAttendances = monthlyAttendances.filter(a => 
    a.staff_id === currentUser.staff_id || 
    (a.staff_name || '').toLowerCase() === currentUser.name.toLowerCase()
  );

  const calculateStaffStats = () => {
    const uniqueDaysPresent = new Set(
      myMonthlyAttendances
        .filter(r => ['on duty', 'completed', 'selesai', 'hadir'].includes((r.status || '').toLowerCase()))
        .map(r => new Date(r.clock_in).toDateString())
    ).size;

    const sakit = myMonthlyAttendances.filter(r => (r.status || '').toLowerCase() === 'sakit').length;
    const cutiResmi = myMonthlyAttendances.filter(r => (r.status || '').toLowerCase() === 'cuti').length;
    const izinUnpaid = myMonthlyAttendances.filter(r => 
      ['izin', 'izin unpaid', 'tanpa gaji'].includes((r.status || '').toLowerCase())
    ).length;

    const recordedDays = uniqueDaysPresent + sakit + cutiResmi + izinUnpaid;
    const alpha = Math.max(0, targetDaysCount - recordedDays);

    const totalDiakuiCount = uniqueDaysPresent + sakit + cutiResmi;
    const recognizedPercentage = targetDaysCount > 0 
      ? Math.round((totalDiakuiCount / targetDaysCount) * 100) 
      : 0;

    const pctHadir = targetDaysCount > 0 ? Math.round((uniqueDaysPresent / targetDaysCount) * 100) : 0;
    const pctSakit = targetDaysCount > 0 ? Math.round((sakit / targetDaysCount) * 100) : 0;
    const pctCuti = targetDaysCount > 0 ? Math.round((cutiResmi / targetDaysCount) * 100) : 0;
    const pctIzinUnpaid = targetDaysCount > 0 ? Math.round((izinUnpaid / targetDaysCount) * 100) : 0;
    const pctAlpha = targetDaysCount > 0 ? Math.round((alpha / targetDaysCount) * 100) : 0;

    return {
      hadir: uniqueDaysPresent,
      sakit,
      cutiResmi,
      izinUnpaid,
      alpha,
      recognizedPercentage,
      pctHadir,
      pctSakit,
      pctCuti,
      pctIzinUnpaid,
      pctAlpha,
    };
  };

  const myStats = calculateStaffStats();

  // 2. REKAP JAM KERJA STAF LAPANGAN KHUSUS AUDIT TIM
  const staffSummaries: StaffSummary[] = Object.values(
    monthlyAttendances
      .filter(item => {
        const roleLower = (item.role || '').toLowerCase();
        const idUpper = (item.staff_id || '').toUpperCase();
        return !roleLower.includes('management') && 
               !roleLower.includes('owner') && 
               !idUpper.startsWith('MNG-') && 
               !idUpper.startsWith('OWN-');
      })
      .reduce((acc: { [key: string]: StaffSummary }, curr) => {
        if (!acc[curr.staff_id]) {
          acc[curr.staff_id] = {
            staff_id: curr.staff_id,
            staff_name: curr.staff_name,
            role: curr.role,
            totalHadir: 0,
            totalJamKerja: 0,
            totalAlpha: 0,
          };
        }
        const statusLower = (curr.status || '').toLowerCase();
        if (['completed', 'on duty', 'selesai', 'hadir'].includes(statusLower)) {
          acc[curr.staff_id].totalHadir += 1;
          acc[curr.staff_id].totalJamKerja += curr.work_hours || 0;
        } else if (statusLower === 'alpha') {
          acc[curr.staff_id].totalAlpha += 1;
        }
        return acc;
      }, {})
  ).sort((a, b) => a.totalJamKerja - b.totalJamKerja);

  const maxWorkHours = Math.max(...staffSummaries.map(s => s.totalJamKerja), 1);

  // 3. FILTER TABEL LOG PRESENSI
  const activeLogData = (viewMode === 'pribadi' ? myMonthlyAttendances : monthlyAttendances).filter(item => {
    const matchesName = (item.staff_name || '').toLowerCase().includes(searchStaff.toLowerCase()) ||
                        (item.staff_id || '').toLowerCase().includes(searchStaff.toLowerCase());
    const matchesShift = filterShift === 'All' ? true : item.shift === filterShift;
    return matchesName && matchesShift;
  });

  // Helper Render Pie Chart SVG
  const renderPieChart = (stats: ReturnType<typeof calculateStaffStats>) => {
    const { pctHadir, pctSakit, pctCuti, pctIzinUnpaid, pctAlpha } = stats;

    let cumulativeAngle = 0;
    const slices = [
      { percentage: pctHadir, color: '#10B981', label: 'Hadir' },
      { percentage: pctSakit, color: '#3B82F6', label: 'Sakit (Dokter)' },
      { percentage: pctCuti, color: '#8B5CF6', label: 'Cuti Resmi' },
      { percentage: pctIzinUnpaid, color: '#F59E0B', label: 'Izin Unpaid' },
      { percentage: pctAlpha, color: '#EF4444', label: 'Alpha' },
    ];

    const getCoordinatesForPercent = (percent: number) => {
      const x = Math.cos(2 * Math.PI * percent);
      const y = Math.sin(2 * Math.PI * percent);
      return [x, y];
    };

    return (
      <div className="flex flex-col sm:flex-row items-center gap-6 bg-neutral-50 p-5 rounded-3xl border border-neutral-200">
        <div className="relative w-36 h-36 shrink-0">
          <svg viewBox="-1 -1 2 2" className="w-full h-full -rotate-90 transform rounded-full">
            {slices.map((slice, index) => {
              if (slice.percentage <= 0) return null;
              const [startX, startY] = getCoordinatesForPercent(cumulativeAngle);
              cumulativeAngle += slice.percentage / 100;
              const [endX, endY] = getCoordinatesForPercent(cumulativeAngle);
              const largeArcFlag = slice.percentage / 100 > 0.5 ? 1 : 0;

              const pathData = [
                `M ${startX} ${startY}`,
                `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`,
                `L 0 0`,
              ].join(' ');

              return <path key={index} d={pathData} fill={slice.color} />;
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white rounded-full m-5 shadow-xs">
            <span className="text-base font-black text-[#111111]">{stats.recognizedPercentage}%</span>
            <span className="text-[9px] font-bold text-neutral-400 uppercase">Diakui</span>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-2.5 w-full text-xs">
          <div className="p-2.5 rounded-2xl bg-white border border-neutral-200">
            <span className="text-[10px] font-bold text-emerald-600 block">🟢 HADIR</span>
            <span className="text-sm font-black text-[#111111]">{stats.hadir} Hari</span>
            <span className="text-[10px] text-neutral-400 block mt-0.5">{stats.pctHadir}% dari {targetDaysCount} hari</span>
          </div>

          <div className="p-2.5 rounded-2xl bg-white border border-neutral-200">
            <span className="text-[10px] font-bold text-blue-600 block">🔵 SAKIT (DOKTER)</span>
            <span className="text-sm font-black text-[#111111]">{stats.sakit} Hari</span>
            <span className="text-[10px] text-neutral-400 block mt-0.5">{stats.pctSakit}% (Diakui)</span>
          </div>

          <div className="p-2.5 rounded-2xl bg-white border border-purple-200 shadow-xs">
            <span className="text-[10px] font-bold text-purple-600 block">🟣 CUTI RESMI</span>
            <span className="text-sm font-black text-[#111111]">{stats.cutiResmi} Hari</span>
            <span className="text-[10px] text-neutral-400 block mt-0.5">
              {stats.pctCuti}% (Diakui) • <strong className="text-purple-700 font-extrabold">{myLeaveQuota} Hari Sisa</strong>
            </span>
          </div>

          <div className="p-2.5 rounded-2xl bg-white border border-neutral-200">
            <span className="text-[10px] font-bold text-amber-600 block">🟡 IZIN UNPAID</span>
            <span className="text-sm font-black text-[#111111]">{stats.izinUnpaid} Hari</span>
            <span className="text-[10px] text-neutral-400 block mt-0.5">Tanpa Gaji</span>
          </div>

          <div className="p-2.5 rounded-2xl bg-white border border-neutral-200 col-span-2 sm:col-span-2">
            <span className="text-[10px] font-bold text-red-600 block">🔴 ALPHA / MANGKIR</span>
            <span className="text-sm font-black text-[#111111]">{stats.alpha} Hari</span>
            <span className="text-[10px] text-neutral-400 block mt-0.5">{stats.pctAlpha}% (Pengurang Performa)</span>
          </div>
        </div>
      </div>
    );
  };

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  return (
    <div className="space-y-6 text-left">
      <div className="bg-white rounded-3xl p-6 border border-neutral-200 shadow-sm">
        {/* Header, Filter Bulan & Switch View Management */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-neutral-100">
          <div>
            <h2 className="text-lg font-black text-[#111111]">📌 Analytics & Rekap Presensi Staf</h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              {viewMode === 'semua_staf'
                ? 'Persentase performa dan audit presensi bulanan seluruh tim.'
                : `Riwayat dan analisis presensi ${currentUser.name} bulan ini.`}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter Bulan & Tahun */}
            <div className="flex items-center gap-2 bg-neutral-50 p-1.5 rounded-2xl border border-neutral-200">
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(Number(e.target.value))}
                className="bg-white px-3 py-1.5 rounded-xl border border-neutral-200 text-xs font-bold text-[#111111] focus:outline-none cursor-pointer"
              >
                {monthNames.map((m, idx) => (
                  <option key={idx} value={idx}>{m}</option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="bg-white px-2.5 py-1.5 rounded-xl border border-neutral-200 text-xs font-bold text-[#111111] focus:outline-none cursor-pointer"
              >
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
              </select>
            </div>

            {/* Switch Mode Akses Khusus Management / Owner */}
            {isManagementOrOwner && (
              <div className="bg-neutral-100 p-1 rounded-2xl flex border border-neutral-200">
                <button
                  onClick={() => setViewMode('pribadi')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                    viewMode === 'pribadi' ? 'bg-[#111111] text-[#ffffff] shadow-sm' : 'text-neutral-500 hover:text-black'
                  }`}
                >
                  👤 Presensi Saya
                </button>
                <button
                  onClick={() => setViewMode('semua_staf')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                    viewMode === 'semua_staf' ? 'bg-[#d22027] text-white shadow-sm' : 'text-neutral-500 hover:text-black'
                  }`}
                >
                  📊 Audit Tim
                </button>
              </div>
            )}
          </div>
        </div>

        {/* TAMPILAN 1: AUDIT TIM & LEADERBOARD (KHUSUS MANAGEMENT / OWNER ATALAU MODES AUDIT) */}
        {viewMode === 'semua_staf' && isManagementOrOwner ? (
          <div className="space-y-6">
            {/* 🏆 KOMPONEN LEADERBOARD & GAMIFICATION STAF */}
            <StaffLeaderboard />

            {/* AUDIT AKUMULASI JAM KERJA STAF */}
            <div className="bg-[#111111] text-white rounded-3xl p-6 md:p-8 shadow-xl border border-neutral-800 space-y-6">
              <div className="flex justify-between items-center pb-4 border-b border-neutral-800">
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <span className="text-[#d22027]">📉</span> Peringkat Akumulasi Jam Kerja Staf ({monthNames[selectedMonth]} {selectedYear})
                  </h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Diurutkan dari jam kerja <strong className="text-red-400">Paling Sedikit</strong> ke Paling Banyak (Excl. Owner & Management).
                  </p>
                </div>
                <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1 rounded-full font-bold">
                  Executive Audit
                </span>
              </div>

              <div className="space-y-4">
                {staffSummaries.length === 0 ? (
                  <p className="text-xs text-neutral-500 italic">Belum ada data presensi staf lapangan pada bulan ini.</p>
                ) : (
                  staffSummaries.map((staf, idx) => {
                    const percent = Math.min(100, Math.round((staf.totalJamKerja / maxWorkHours) * 100));
                    const isLeastHours = idx === 0 && staf.totalJamKerja >= 0;

                    return (
                      <div key={staf.staff_id} className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-neutral-400 text-[11px]">#{idx + 1}</span>
                            <span className="font-extrabold text-white">{staf.staff_name}</span>
                            <span className="text-[9px] px-2 py-0.5 bg-neutral-800 text-neutral-400 rounded-md uppercase font-mono">
                              {staf.role}
                            </span>
                            {isLeastHours && (
                              <span className="text-[9px] bg-red-600 text-white font-black px-2 py-0.5 rounded-full animate-pulse">
                                ⚠️ Jam Kerja Paling Sedikit
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="font-black text-[#d22027] text-sm">{staf.totalJamKerja.toFixed(1)} Jam</span>
                            <span className="text-neutral-400 text-[11px] ml-2">({staf.totalHadir} Shift)</span>
                          </div>
                        </div>

                        <div className="w-full bg-neutral-800 rounded-full h-3 overflow-hidden p-0.5 border border-neutral-700">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              isLeastHours ? 'bg-red-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.max(5, percent)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        ) : (
          /* TAMPILAN 2: ANALYTICS KEHADIRAN PRIBADI USER */
          <div className="mb-8">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-extrabold text-sm text-[#111111]">
                📊 Analytics Kehadiran Saya ({monthNames[selectedMonth]} {selectedYear})
              </h3>
              <span className="text-[11px] font-bold text-[#d22027] bg-red-50 px-2.5 py-1 rounded-full">
                Sampai Hari Ke-{targetDaysCount} ({daysInMonthTotal} Hari)
              </span>
            </div>

            {renderPieChart(myStats)}

            <div className="mt-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex justify-between items-center text-xs">
              <div>
                <p className="font-extrabold text-emerald-800">
                  Total Persentase Diakui Saya: {myStats.recognizedPercentage}%
                </p>
                <p className="text-[11px] text-emerald-600 mt-0.5">
                  Formula: (Hadir + Sakit Surat Dokter + Cuti Resmi) / {targetDaysCount} Hari Berjalan × 100%
                </p>
              </div>
              <span className="text-xl">🏆</span>
            </div>
          </div>
        )}

        {/* LOG DETAIL PRESENSI */}
        <div className="border-t border-neutral-100 pt-6 mt-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <h3 className="font-extrabold text-sm text-[#111111]">
              📋 {viewMode === 'pribadi' ? 'Log Detail Presensi Saya' : 'Log Detail Presensi Tim'}
            </h3>

            <div className="flex gap-2 w-full sm:w-auto">
              {isManagementOrOwner && viewMode === 'semua_staf' && (
                <input
                  type="text"
                  placeholder="Cari Nama / ID Staf..."
                  value={searchStaff}
                  onChange={e => setSearchStaff(e.target.value)}
                  className="px-3.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:outline-none focus:border-[#d22027] flex-1 sm:w-48"
                />
              )}

              <select
                value={filterShift}
                onChange={e => setFilterShift(e.target.value as any)}
                className="bg-neutral-50 px-3 py-1.5 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-700 focus:outline-none cursor-pointer"
              >
                <option value="All">Semua Shift</option>
                <option value="morning">☀️ Morning</option>
                <option value="night">🌙 Night</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-neutral-400 animate-pulse">
              Memuat riwayat presensi...
            </div>
          ) : activeLogData.length === 0 ? (
            <div className="py-8 text-center text-xs text-neutral-400">
              Belum ada riwayat presensi di bulan {monthNames[selectedMonth]} {selectedYear}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#111111] text-white text-[11px] uppercase tracking-wider rounded-xl">
                    <th className="p-3.5 rounded-l-2xl">Tanggal</th>
                    <th className="p-3.5">Nama Staf</th>
                    <th className="p-3.5">Role & Shift</th>
                    <th className="p-3.5">Clock In</th>
                    <th className="p-3.5">Clock Out</th>
                    <th className="p-3.5 font-bold text-[#d22027]">Durasi Jam</th>
                    {viewMode === 'semua_staf' && isManagementOrOwner && (
                      <>
                        <th className="p-3.5 text-center">Lokasi & Deteksi Fake GPS</th>
                        <th className="p-3.5 text-center">Foto Presensi</th>
                      </>
                    )}
                    <th className="p-3.5 rounded-r-2xl">Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-neutral-100 text-xs">
                  {activeLogData.map(item => (
                    <tr key={item.id} className="hover:bg-neutral-50 transition">
                      <td className="p-3.5 font-bold text-[#111111]">
                        {new Date(item.clock_in).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      <td className="p-3.5">
                        <p className="font-extrabold text-[#111111]">{item.staff_name}</p>
                        <p className="text-[10px] text-neutral-400 font-mono">{item.staff_id}</p>
                      </td>

                      <td className="p-3.5 capitalize">
                        <span className="font-semibold text-neutral-700">{item.role}</span>
                        <span className="block text-[10px] text-neutral-400">
                          {item.shift === 'morning' ? '☀️ Morning' : '🌙 Night'}
                        </span>
                      </td>

                      <td className="p-3.5 font-mono text-emerald-600 font-bold">
                        {new Date(item.clock_in).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WITA
                      </td>

                      <td className="p-3.5 font-mono text-neutral-500 font-semibold">
                        {item.clock_out
                          ? new Date(item.clock_out).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WITA'
                          : '-'}
                      </td>

                      <td className="p-3.5 font-bold text-[#d22027]">
                        {item.work_hours ? `${item.work_hours} Jam` : '-'}
                      </td>

                      {/* AUDIT KEAMANAN LOKASI & FAKE GPS */}
                      {viewMode === 'semua_staf' && isManagementOrOwner && (
                        <>
                          <td className="p-3.5 text-center">
                            {item.latitude && item.longitude ? (
                              <div className="flex flex-col items-center gap-1">
                                <a
                                  href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-xl text-[10px] font-bold inline-flex items-center gap-1 transition"
                                  title="Buka Koordinat di Google Maps"
                                >
                                  📍 Map ({Number(item.latitude).toFixed(3)}, {Number(item.longitude).toFixed(3)})
                                </a>

                                {/* INDIKATOR FAKE GPS / AUDIT GEOFENCING */}
                                {item.is_fake_gps ? (
                                  <span className="text-[9px] bg-red-600 text-white font-black px-2 py-0.5 rounded-full animate-bounce">
                                    🚨 Fake GPS Detected
                                  </span>
                                ) : (
                                  <span className="text-[9px] text-emerald-600 font-bold">
                                    ✓ Real GPS (Valid)
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-neutral-400 italic">-</span>
                            )}
                          </td>

                          {/* FOTO SELFIE PRESENSI */}
                          <td className="p-3.5 text-center">
                            {item.photo_url ? (
                              <button
                                onClick={() =>
                                  setSelectedPhoto({
                                    url: item.photo_url!,
                                    staffName: item.staff_name,
                                    time: new Date(item.clock_in).toLocaleString('id-ID'),
                                  })
                                }
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer transition"
                              >
                                📸 Foto
                              </button>
                            ) : (
                              <span className="text-[10px] text-neutral-400 italic">-</span>
                            )}
                          </td>
                        </>
                      )}

                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-block ${
                            item.status === 'On Duty' || item.status === 'Selesai'
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                              : item.status === 'Sakit'
                              ? 'bg-blue-50 text-blue-600 border-blue-200'
                              : item.status === 'Cuti'
                              ? 'bg-purple-50 text-purple-600 border-purple-200'
                              : item.status === 'Izin' || item.status === 'Izin Unpaid'
                              ? 'bg-amber-50 text-amber-600 border-amber-200'
                              : 'bg-red-50 text-red-600 border-red-200'
                          }`}
                        >
                          {item.status === 'On Duty' ? '🟢 On Duty' : item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MODAL POPUP AUDIT FOTO SELFIE PRESENSI */}
      {selectedPhoto && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white p-5 rounded-3xl max-w-sm w-full space-y-3 relative shadow-2xl border border-neutral-100 text-left">
            <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
              <div>
                <h4 className="font-extrabold text-xs text-[#111111]">📸 Foto Bukti Presensi</h4>
                <p className="text-[10px] text-neutral-400">{selectedPhoto.staffName} • {selectedPhoto.time}</p>
              </div>
              <button
                onClick={() => setSelectedPhoto(null)}
                className="text-neutral-400 hover:text-black font-bold text-xs cursor-pointer"
              >
                ✕ Tutup
              </button>
            </div>
            <div className="bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-200">
              <img
                src={selectedPhoto.url}
                alt={`Bukti Presensi ${selectedPhoto.staffName}`}
                className="w-full h-auto max-h-80 object-cover"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}