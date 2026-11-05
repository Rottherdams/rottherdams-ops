import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface CurrentUser {
  name: string;
  role: 'management' | 'kasir' | 'bar' | 'dapur' | 'owner';
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

  const isManagementOrOwner = currentUser.role === 'management' || currentUser.role === 'owner';

  useEffect(() => {
    fetchAttendances();
  }, [currentUser, selectedMonth, selectedYear]);

  const fetchAttendances = async () => {
    setLoading(true);

    let query = supabase
      .from('attendances')
      .select('*')
      .order('clock_in', { ascending: false });

    // Staf biasa hanya bisa melihat datanya sendiri (berdasarkan staff_id atau nama)
    if (!isManagementOrOwner) {
      query = query.or(`staff_id.eq.${currentUser.staff_id},staff_name.ilike.%${currentUser.name}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching attendances:', error.message);
    } else if (data) {
      setAttendances(data);
    }
    setLoading(false);
  };

  // Filter Data Berdasarkan Bulan & Tahun yang Dipilih
  const monthlyAttendances = attendances.filter(item => {
    const d = new Date(item.clock_in);
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
  });

  // Filter Tambahan di UI (Pencarian Nama / Shift)
  const filteredData = monthlyAttendances.filter(item => {
    const matchesName = (item.staff_name || '').toLowerCase().includes(searchStaff.toLowerCase()) ||
                        (item.staff_id || '').toLowerCase().includes(searchStaff.toLowerCase());
    const matchesShift = filterShift === 'All' ? true : item.shift === filterShift;
    return matchesName && matchesShift;
  });

  // Tentukan Batas Hari yang Dihitung dalam Bulan
  const now = new Date();
  const isCurrentMonth = selectedMonth === now.getMonth() && selectedYear === now.getFullYear();
  const daysInMonthTotal = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  // Jika bulan berjalan, hitung sampai tanggal hari ini (agar persentase adil)
  const targetDaysCount = isCurrentMonth ? now.getDate() : daysInMonthTotal;

  // Hitung Statistik Presensi untuk User
  const calculateStaffStats = () => {
    // Ambil record presensi milik user aktif (cocokkan via staff_id ATAU nama)
    const myRecords = monthlyAttendances.filter(a => 
      a.staff_id === currentUser.staff_id || 
      (a.staff_name || '').toLowerCase() === currentUser.name.toLowerCase()
    );

    // Hitung Hari Unik Kehadiran (Clock In)
    const uniqueDaysPresent = new Set(
      myRecords.map(r => new Date(r.clock_in).toDateString())
    ).size;

    const hadir = uniqueDaysPresent;
    const sakit = myRecords.filter(r => (r.status || '').toLowerCase() === 'sakit').length;
    const izin = myRecords.filter(r => ['izin', 'cuti'].includes((r.status || '').toLowerCase())).length;

    // Alpha dihitung dari sisa hari kerja sampai tanggal saat ini
    const totalRecorded = hadir + sakit + izin;
    const alpha = Math.max(0, targetDaysCount - totalRecorded);

    // Persentase Diakui = (Hadir + Sakit + Izin) / Target Hari * 100
    const recognizedPercentage = targetDaysCount > 0 
      ? Math.round(((hadir + sakit + izin) / targetDaysCount) * 100) 
      : 0;

    const pctHadir = targetDaysCount > 0 ? Math.round((hadir / targetDaysCount) * 100) : 0;
    const pctSakit = targetDaysCount > 0 ? Math.round((sakit / targetDaysCount) * 100) : 0;
    const pctIzin = targetDaysCount > 0 ? Math.round((izin / targetDaysCount) * 100) : 0;
    const pctAlpha = targetDaysCount > 0 ? Math.round((alpha / targetDaysCount) * 100) : 0;

    return {
      hadir,
      sakit,
      izin,
      alpha,
      recognizedPercentage,
      pctHadir,
      pctSakit,
      pctIzin,
      pctAlpha,
    };
  };

  const myStats = calculateStaffStats();

  // Helper Render Pie Chart SVG
  const renderPieChart = (stats: ReturnType<typeof calculateStaffStats>) => {
    const { pctHadir, pctSakit, pctIzin, pctAlpha } = stats;

    let cumulativeAngle = 0;
    const slices = [
      { percentage: pctHadir, color: '#10B981', label: 'Hadir' },
      { percentage: pctSakit, color: '#3B82F6', label: 'Sakit' },
      { percentage: pctIzin, color: '#F59E0B', label: 'Izin' },
      { percentage: pctAlpha, color: '#EF4444', label: 'Alpha' },
    ];

    const getCoordinatesForPercent = (percent: number) => {
      const x = Math.cos(2 * Math.PI * percent);
      const y = Math.sin(2 * Math.PI * percent);
      return [x, y];
    };

    return (
      <div className="flex flex-col sm:flex-row items-center gap-6 bg-neutral-50 p-5 rounded-3xl border border-neutral-200">
        {/* SVG Pie Chart */}
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

        {/* Legend Breakdown Stats */}
        <div className="flex-1 grid grid-cols-2 gap-2.5 w-full text-xs">
          <div className="p-2.5 rounded-2xl bg-white border border-neutral-200">
            <span className="text-[10px] font-bold text-emerald-600 block">🟢 HADIR</span>
            <span className="text-sm font-black text-[#111111]">{stats.hadir} Hari</span>
            <span className="text-[10px] text-neutral-400 block mt-0.5">{stats.pctHadir}% dari {targetDaysCount} hari</span>
          </div>

          <div className="p-2.5 rounded-2xl bg-white border border-neutral-200">
            <span className="text-[10px] font-bold text-blue-600 block">🔵 SAKIT</span>
            <span className="text-sm font-black text-[#111111]">{stats.sakit} Hari</span>
            <span className="text-[10px] text-neutral-400 block mt-0.5">{stats.pctSakit}% dari {targetDaysCount} hari</span>
          </div>

          <div className="p-2.5 rounded-2xl bg-white border border-neutral-200">
            <span className="text-[10px] font-bold text-amber-600 block">🟡 IZIN / CUTI</span>
            <span className="text-sm font-black text-[#111111]">{stats.izin} Hari</span>
            <span className="text-[10px] text-neutral-400 block mt-0.5">{stats.pctIzin}% dari {targetDaysCount} hari</span>
          </div>

          <div className="p-2.5 rounded-2xl bg-white border border-neutral-200">
            <span className="text-[10px] font-bold text-red-600 block">🔴 ALPHA</span>
            <span className="text-sm font-black text-[#111111]">{stats.alpha} Hari</span>
            <span className="text-[10px] text-neutral-400 block mt-0.5">{stats.pctAlpha}% dari {targetDaysCount} hari</span>
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
        {/* Header & Filter Bulan */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-neutral-100">
          <div>
            <h2 className="text-lg font-black text-[#111111]">📌 Analytics & Rekap Presensi Staf</h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              {isManagementOrOwner
                ? 'Persentase performa dan riwayat presensi bulanan seluruh tim.'
                : `Riwayat dan analisis presensi ${currentUser.name} bulan ini.`}
            </p>
          </div>

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
        </div>

        {/* SECTION 1: Pie Chart & Persentase Ringkasan */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-extrabold text-sm text-[#111111]">
              📊 Analytics Kehadiran Bulanan ({monthNames[selectedMonth]} {selectedYear})
            </h3>
            <span className="text-[11px] font-bold text-[#d22027] bg-red-50 px-2.5 py-1 rounded-full">
              Sampai Hari Ke-{targetDaysCount} ({daysInMonthTotal} Hari)
            </span>
          </div>

          {/* Render Pie Chart */}
          {renderPieChart(myStats)}

          <div className="mt-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex justify-between items-center text-xs">
            <div>
              <p className="font-extrabold text-emerald-800">
                Total Persentase Diakui: {myStats.recognizedPercentage}%
              </p>
              <p className="text-[11px] text-emerald-600 mt-0.5">
                Formula: (Hadir + Sakit + Izin) / {targetDaysCount} Hari Berjalan × 100%
              </p>
            </div>
            <span className="text-xl">🏆</span>
          </div>
        </div>

        {/* SECTION 2: Tabel Riwayat Detail Presensi */}
        <div className="border-t border-neutral-100 pt-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <h3 className="font-extrabold text-sm text-[#111111]">📋 Log Detail Presensi</h3>

            <div className="flex gap-2 w-full sm:w-auto">
              {isManagementOrOwner && (
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
          ) : filteredData.length === 0 ? (
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
                    <th className="p-3.5 rounded-r-2xl">Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-neutral-100 text-xs">
                  {filteredData.map(item => (
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

                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-block ${
                            item.status === 'On Duty'
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                              : 'bg-neutral-100 text-neutral-600 border-neutral-200'
                          }`}
                        >
                          {item.status === 'On Duty' ? '🟢 On Duty' : '✅ Selesai'}
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
    </div>
  );
}