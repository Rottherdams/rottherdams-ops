import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import EditRosterModal from './EditRosterModal';
import TukarShiftModal from './TukarShiftModal';
import LeaveRequestModal from './LeaveRequestModal';
import StaffInboxModal from './StaffInboxModal';

interface CurrentUser {
  name: string;
  role: 'management' | 'kasir' | 'bar' | 'dapur' | 'owner' | string;
  staff_id: string;
  avatar_url?: string;
}

interface JadwalStafProps {
  userRole?: string;
  currentUser?: CurrentUser | null;
}

interface StaffSummary {
  staff_id: string;
  staff_name: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  role: string;
  status: string;
  shifts: { [day: string]: string };
  restWarnings: { [day: string]: boolean };
  hasAnyRestWarning: boolean;
  total_shift: number;
  total_shift_1: number;
  total_shift_2: number;
  total_off: number;
}

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const WEEKS = [1, 2, 3, 4];

// 🚀 HELPER: Menghitung Rentang Tanggal Mulai (Senin) & Selesai (Minggu) Berdasarkan Minggu Ke-
const getWeekDateRange = (weekNum: number) => {
  // Rujukan Senin Minggu 1 (November 2026): 2 Nov 2026
  const baseMonday = new Date(2026, 10, 2); 
  
  const startDate = new Date(baseMonday);
  startDate.setDate(baseMonday.getDate() + (weekNum - 1) * 7);

  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);

  // Array Tanggal Presisi untuk 7 Hari (Senin - Minggu)
  const weekDates: string[] = [];
  const dateFormattedLabels: { [day: string]: string } = {};

  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    
    // Format YYYY-MM-DD Lokal
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    weekDates.push(dateStr);

    const dayName = DAYS[i];
    dateFormattedLabels[dayName] = d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short'
    });
  }

  // Format YYYY-MM-DD Lokal untuk start & end
  const formatLocalIso = (dateObj: Date) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  return {
    start: formatLocalIso(startDate),
    end: formatLocalIso(endDate),
    weekDates,
    dateFormattedLabels
  };
};

const getCurrentWeekKey = (): number => {
  const currentDate = new Date().getDate();
  if (currentDate <= 7) return 1;
  if (currentDate <= 14) return 2;
  if (currentDate <= 21) return 3;
  return 4;
};

const getTodayName = (): string => {
  const dayIndex = new Date().getDay();
  const dayMap: { [key: number]: string } = {
    0: 'Minggu',
    1: 'Senin',
    2: 'Selasa',
    3: 'Rabu',
    4: 'Kamis',
    5: 'Jumat',
    6: 'Sabtu',
  };
  return dayMap[dayIndex] || 'Senin';
};

// 🎯 HELPER VALIDASI PRESISI HARI INI
const isSameDate = (dateString: string) => {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const todayFormatted = `${y}-${m}-${d}`;
  return dateString === todayFormatted;
};

export default function JadwalStaf({ userRole = 'management', currentUser }: JadwalStafProps) {
  const [staffSummaries, setStaffSummaries] = useState<StaffSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedWeek, setSelectedWeek] = useState<number>(getCurrentWeekKey());
  const [selectedDay, setSelectedDay] = useState<string>(getTodayName());
  const [dateLabels, setDateLabels] = useState<{ [day: string]: string }>({});
  
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState<boolean>(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState<boolean>(false);
  
  const [isInboxOpen, setIsInboxOpen] = useState<boolean>(false);
  const [pendingInboxCount, setPendingInboxCount] = useState<number>(0);

  const rawRole = (currentUser?.role || userRole || '').toLowerCase();
  const isManagement = 
    rawRole.includes('management') || 
    rawRole.includes('owner') ||
    (currentUser?.staff_id || '').startsWith('MNG-') ||
    (currentUser?.staff_id || '').startsWith('OWN-');

  const currentWeekNow = getCurrentWeekKey();

  useEffect(() => {
    fetchSchedulesFromDatabase();
    if (currentUser?.staff_id) {
      checkPendingInbox();
    }
  }, [selectedWeek, currentUser]);

  const checkPendingInbox = async () => {
    if (!currentUser?.staff_id) return;
    try {
      const { count } = await supabase
        .from('shift_swaps')
        .select('*', { count: 'exact', head: true })
        .eq('target_staff_id', currentUser.staff_id)
        .eq('target_status', 'pending');

      setPendingInboxCount(count || 0);
    } catch (err) {
      console.error('Error checking pending inbox:', err);
    }
  };

  const fetchSchedulesFromDatabase = async () => {
    setLoading(true);

    try {
      // 1. Dapatkan Rentang Tanggal Minggu Terpilih
      const { start, end, dateFormattedLabels } = getWeekDateRange(selectedWeek);
      setDateLabels(dateFormattedLabels);

      // 2. Ambil Data Staf Operasional (Termasuk First Name, Last Name & Avatar URL)
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('staff_id, staff_name, first_name, last_name, avatar_url, role, status')
        .neq('status', 'Resign')
        .not('role', 'ilike', 'owner')
        .not('role', 'ilike', 'management');

      if (staffError) throw staffError;

      // 3. Ambil Data Jadwal dari Tabel 'schedules' Berdasarkan Range Tanggal & Filter Minggu
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('schedules')
        .select('staff_id, staff_name, day, date, shift, week_number')
        .or(`and(date.gte.${start},date.lte.${end}),week_number.eq.${selectedWeek}`);

      if (scheduleError) throw scheduleError;

      // Map untuk Pencarian Jadwal Cepat
      const scheduleMap: { [key: string]: string } = {};
      (scheduleData || []).forEach(item => {
        if (item.date) {
          scheduleMap[`${item.staff_id}_${item.date}`] = item.shift;
        }
        scheduleMap[`${item.staff_id}_${item.day}`] = item.shift;
        if (item.staff_name) {
          scheduleMap[`${item.staff_name.toLowerCase()}_${item.day}`] = item.shift;
        }
      });

      // 4. Susun Data Roster dan Deteksi Rest Time Warning (Shift 2 -> Shift 1)
      const summaries: StaffSummary[] = (staffData || []).map(staf => {
        const shifts: { [day: string]: string } = {};
        const restWarnings: { [day: string]: boolean } = {};
        let total_shift_1 = 0;
        let total_shift_2 = 0;
        let total_off = 0;
        let hasAnyRestWarning = false;

        const displayName = staf.staff_name || 
          (staf.first_name ? `${staf.first_name} ${staf.last_name || ''}`.trim() : 'Staf');

        DAYS.forEach((day, idx) => {
          const shift = scheduleMap[`${staf.staff_id}_${day}`] 
            || scheduleMap[`${displayName.toLowerCase()}_${day}`] 
            || 'OFF';
            
          shifts[day] = shift;

          if (shift === 'Shift 1' || shift === 'S1') {
            total_shift_1 += 1;
          } else if (shift === 'Shift 2' || shift === 'S2') {
            total_shift_2 += 1;
          } else {
            total_off += 1;
          }

          // DETEKSI REST TIME WARNING: Hari kemarin Shift 2 (Malam) -> Hari ini Shift 1 (Pagi)
          if (idx > 0) {
            const prevDay = DAYS[idx - 1];
            const prevShift = shifts[prevDay];
            const isPrevNight = prevShift === 'Shift 2' || prevShift === 'S2';
            const isCurrMorning = shift === 'Shift 1' || shift === 'S1';

            if (isPrevNight && isCurrMorning) {
              restWarnings[day] = true;
              hasAnyRestWarning = true;
            }
          }
        });

        return {
          staff_id: staf.staff_id,
          staff_name: displayName,
          first_name: staf.first_name,
          last_name: staf.last_name,
          avatar_url: staf.avatar_url,
          role: staf.role,
          status: staf.status || 'Aktif',
          shifts,
          restWarnings,
          hasAnyRestWarning,
          total_shift: total_shift_1 + total_shift_2,
          total_shift_1,
          total_shift_2,
          total_off,
        };
      });

      setStaffSummaries(summaries);
    } catch (err) {
      console.error('Error fetching dynamic roster schedules:', err);
    } finally {
      setLoading(false);
    }
  };

  const { weekDates: currentSelectedWeekDates } = getWeekDateRange(selectedWeek);

  return (
    <div className="bg-white rounded-3xl p-5 md:p-6 border border-neutral-200 shadow-sm mb-8 text-left">
      {/* Header Roster */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6 pb-4 border-b border-neutral-100">
        <div>
          <span className="text-[10px] uppercase font-bold text-[#d22027] tracking-widest">
            Roster Kerja Karyawan
          </span>
          <h2 className="text-xl font-bold text-[#111111] mt-0.5">
            Jadwal Operasional Rottherdams
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Shift 1 (09.00 - 17.00) | Shift 2 (15.00 - 23.00)
          </p>
        </div>

        {/* Kontrol Kanan */}
        <div className="flex flex-wrap items-center gap-2">
          {currentUser && (
            <>
              {/* Tombol Inbox & Status Notifikasi Karyawan */}
              <button
                onClick={() => setIsInboxOpen(true)}
                className="px-3.5 py-1.5 bg-[#111111] hover:bg-black text-white rounded-2xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs relative"
              >
                <span>🔔</span> Inbox & Status
                {pendingInboxCount > 0 && (
                  <span className="bg-[#d22027] text-white text-[9px] px-1.5 py-0.2 rounded-full font-black animate-bounce">
                    {pendingInboxCount}
                  </span>
                )}
              </button>

              {/* Tombol Ajukan Izin / Sakit / Cuti */}
              <button
                onClick={() => setIsLeaveModalOpen(true)}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <span>📩</span> Ajukan Izin / Cuti
              </button>

              {/* Tombol Tukar Shift */}
              <button
                onClick={() => setIsSwapModalOpen(true)}
                className="px-3.5 py-1.5 bg-white text-[#111111] border border-neutral-300 rounded-2xl text-xs font-bold hover:bg-neutral-100 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <span>🔄</span> Tukar Shift
              </button>
            </>
          )}

          {isManagement && (
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="px-3.5 py-1.5 bg-[#111111] text-white rounded-2xl text-xs font-bold hover:bg-neutral-800 transition cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <span>✏️</span> Edit Roster
            </button>
          )}

          {/* Selector Minggu (M1 - M4) */}
          <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-2xl border border-neutral-200">
            <span className="text-[10px] font-bold text-neutral-400 px-2 hidden sm:inline">Minggu:</span>
            {WEEKS.map(w => {
              const isCurrent = currentWeekNow === w;
              const isActive = selectedWeek === w;
              return (
                <button
                  key={w}
                  onClick={() => setSelectedWeek(w)}
                  className={`relative px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    isActive
                      ? 'bg-[#d22027] text-white shadow-xs'
                      : 'text-neutral-600 hover:text-[#111111]'
                  }`}
                >
                  M{w}
                  {isCurrent && (
                    <span
                      className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white ${
                        isActive ? 'bg-amber-300 animate-pulse' : 'bg-[#d22027]'
                      }`}
                      title="Minggu Saat Ini"
                    ></span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Filter Hari untuk Tampilan Mobile */}
      <div className="md:hidden flex gap-1 overflow-x-auto pb-3 scrollbar-none mb-3 border-b border-neutral-100">
        {DAYS.map((day, idx) => {
          // 🔴 Indikator Hari Ini HANYA aktif jika tanggal hari di minggu terpilih presisi hari ini
          const isToday = isSameDate(currentSelectedWeekDates[idx]);
          const isActive = selectedDay === day;

          return (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`relative px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-[#111111] text-white'
                  : 'bg-neutral-100 text-neutral-500'
              }`}
            >
              {day} {dateLabels[day] && `(${dateLabels[day]})`}
              {isToday && (
                <span
                  className={`ml-1 inline-block w-1.5 h-1.5 rounded-full ${
                    isActive ? 'bg-amber-300 animate-pulse' : 'bg-[#d22027]'
                  }`}
                  title="Hari Ini"
                ></span>
              )}
            </button>
          );
        })}
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="py-12 text-center text-xs text-neutral-400 animate-pulse">
          Memuat data roster presisi dari database...
        </div>
      ) : (
        <>
          {/* Tampilan Desktop: Tabel Roster */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#111111] text-white">
                  {isManagement && (
                    <th className="p-3 rounded-tl-xl font-bold">ID</th>
                  )}

                  <th className={`p-3 font-bold ${!isManagement ? 'rounded-tl-xl' : ''}`}>
                    Nama Staf
                  </th>
                  <th className="p-3 font-bold">Divisi</th>

                  {/* HEADER HARI + TANGGAL PRESISI */}
                  {DAYS.map((day, idx) => {
                    const isTodayHeader = isSameDate(currentSelectedWeekDates[idx]);

                    return (
                      <th key={day} className="p-3 text-center font-bold">
                        <div>{day}</div>
                        <div className="text-[10px] font-normal opacity-80 mt-0.5">
                          {dateLabels[day] || ''} {isTodayHeader && ' (Hari Ini)'}
                        </div>
                      </th>
                    );
                  })}
                  
                  <th className={`p-3 text-center bg-neutral-800 font-bold ${!isManagement ? 'rounded-tr-xl' : ''}`}>
                    Tot. Shift
                  </th>

                  {isManagement && (
                    <>
                      <th className="p-3 text-center bg-blue-900/60 font-bold">Shift 1</th>
                      <th className="p-3 text-center bg-amber-900/60 font-bold">Shift 2</th>
                      <th className="p-3 text-center bg-red-900/60 rounded-tr-xl font-bold">OFF</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {staffSummaries.map(staff => {
                  const isLoggedUser = currentUser && (
                    currentUser.staff_id === staff.staff_id ||
                    currentUser.name.toLowerCase() === staff.staff_name.toLowerCase()
                  );

                  return (
                    <tr
                      key={staff.staff_id}
                      className={`transition ${
                        isLoggedUser
                          ? 'bg-red-50/80 border-l-4 border-l-[#d22027]'
                          : 'hover:bg-neutral-50'
                      }`}
                    >
                      {isManagement && (
                        <td className="p-3 font-mono font-bold text-neutral-400">{staff.staff_id}</td>
                      )}

                      <td className="p-3 font-bold text-[#111111]">
                        <div className="flex items-center gap-2">
                          {/* AVATAR PROFIL STAF */}
                          {staff.avatar_url ? (
                            <img
                              src={staff.avatar_url}
                              alt={staff.staff_name}
                              className="w-6 h-6 rounded-full object-cover border border-neutral-200 shrink-0"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-neutral-200 text-neutral-600 flex items-center justify-center font-bold text-[9px] shrink-0">
                              {staff.first_name?.[0] || staff.staff_name[0]}
                            </div>
                          )}

                          <div className="flex flex-col">
                            <span className="flex items-center gap-1.5">
                              {staff.staff_name}
                              {isLoggedUser && (
                                <span className="bg-[#d22027] text-white text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase">
                                  Anda
                                </span>
                              )}
                            </span>

                            {/* 🔒 PERINGATAN REST TIME HANYA UTK OWNER/MANAGEMENT */}
                            {isManagement && staff.hasAnyRestWarning && (
                              <span
                                className="mt-0.5 text-[9px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-semibold w-max"
                                title="Terdeteksi jadwal Shift 2 (Malam) disambung Shift 1 (Pagi)"
                              >
                                ⚠️ Rest Time &lt; 8 Jam
                              </span>
                            )}

                            {isManagement && staff.status && staff.status !== 'Aktif' && (
                              <span className="mt-0.5 inline-block px-1.5 py-0.5 text-[9px] rounded font-semibold bg-amber-100 text-amber-700 w-max">
                                {staff.status}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-neutral-500 capitalize">{staff.role}</td>
                      
                      {DAYS.map(day => {
                        const shift = staff.shifts[day] || 'OFF';
                        const isRestWarning = isManagement && staff.restWarnings[day];

                        return (
                          <td key={day} className="p-3 text-center">
                            <span
                              className={`px-2 py-1 rounded-md font-bold text-[10px] inline-block min-w-[54px] ${
                                isRestWarning
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : shift === 'Shift 1' || shift === 'S1'
                                  ? 'bg-blue-50 text-blue-600 border border-blue-100'
                                  : shift === 'Shift 2' || shift === 'S2'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                  : 'bg-red-50 text-red-500 border border-red-100'
                              }`}
                              title={isRestWarning ? 'Waktu istirahat kurang dari 8 jam' : undefined}
                            >
                              {shift}
                              {isRestWarning && <span className="ml-1 text-[9px]">⚠️</span>}
                            </span>
                          </td>
                        );
                      })}

                      <td className="p-3 text-center font-black bg-neutral-50/80 text-[#111111]">
                        {staff.total_shift}
                      </td>

                      {isManagement && (
                        <>
                          <td className="p-3 text-center font-bold text-blue-600 bg-blue-50/40">{staff.total_shift_1}</td>
                          <td className="p-3 text-center font-bold text-amber-700 bg-amber-50/40">{staff.total_shift_2}</td>
                          <td className="p-3 text-center font-bold text-red-500 bg-red-50/40">{staff.total_off}</td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Tampilan Mobile */}
          <div className="md:hidden space-y-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-neutral-400">
                Jadwal Hari {selectedDay} {dateLabels[selectedDay] && `(${dateLabels[selectedDay]})`} (Minggu {selectedWeek})
              </span>
            </div>

            {staffSummaries.map(staff => {
              const shiftToday = staff.shifts[selectedDay] || 'OFF';
              const isRestWarningToday = isManagement && staff.restWarnings[selectedDay];
              const isLoggedUser = currentUser && (
                currentUser.staff_id === staff.staff_id ||
                currentUser.name.toLowerCase() === staff.staff_name.toLowerCase()
              );

              return (
                <div
                  key={staff.staff_id}
                  className={`p-3.5 rounded-2xl border flex justify-between items-center ${
                    isLoggedUser
                      ? 'bg-red-50/90 border-[#d22027]'
                      : 'bg-neutral-50 border-neutral-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* AVATAR PROFIL MOBILE */}
                    {staff.avatar_url ? (
                      <img
                        src={staff.avatar_url}
                        alt={staff.staff_name}
                        className="w-9 h-9 rounded-full object-cover border border-neutral-200 shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-neutral-200 text-neutral-700 flex items-center justify-center font-bold text-xs shrink-0">
                        {staff.first_name?.[0] || staff.staff_name[0]}
                      </div>
                    )}

                    <div>
                      <h3 className="font-bold text-xs text-[#111111] flex items-center gap-1.5">
                        {staff.staff_name}
                        {isLoggedUser && (
                          <span className="bg-[#d22027] text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase">
                            Anda
                          </span>
                        )}
                      </h3>
                      <p className="text-[10px] text-neutral-400 capitalize">{staff.role}</p>

                      {isRestWarningToday && (
                        <span className="mt-1 inline-block text-[9px] bg-amber-100 text-amber-800 border border-amber-300 font-bold px-2 py-0.5 rounded-full">
                          ⚠️ Rest Time &lt; 8 Jam
                        </span>
                      )}
                    </div>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-xl font-bold text-xs ${
                      isRestWarningToday
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : shiftToday === 'Shift 1' || shiftToday === 'S1'
                        ? 'bg-blue-100 text-blue-700'
                        : shiftToday === 'Shift 2' || shiftToday === 'S2'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-red-100 text-red-600'
                    }`}
                  >
                    {shiftToday}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Modal Edit Roster */}
      <EditRosterModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={() => fetchSchedulesFromDatabase()}
        selectedWeek={selectedWeek}
      />

      {/* Modal Tukar Shift */}
      <TukarShiftModal
        isOpen={isSwapModalOpen}
        onClose={() => setIsSwapModalOpen(false)}
        currentUser={currentUser || null}
        onSuccess={() => fetchSchedulesFromDatabase()}
      />

      {/* Modal Pengajuan Izin / Sakit / Cuti */}
      <LeaveRequestModal
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
        onSuccess={() => {
          alert('Pengajuan izin berhasil dikirim!');
          fetchSchedulesFromDatabase();
        }}
        currentUser={currentUser || null}
      />

      {/* Modal Kotak Masuk & Status Notifikasi Karyawan */}
      {currentUser && (
        <StaffInboxModal
          currentUser={{
            name: currentUser.name,
            role: currentUser.role,
            staff_id: currentUser.staff_id,
          }}
          isOpen={isInboxOpen}
          onClose={() => setIsInboxOpen(false)}
          onUpdateSuccess={() => {
            checkPendingInbox();
            fetchSchedulesFromDatabase();
          }}
        />
      )}
    </div>
  );
}