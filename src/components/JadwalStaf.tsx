import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import EditRosterModal from './EditRosterModal';
import TukarShiftModal from './TukarShiftModal';

interface CurrentUser {
  name: string;
  role: 'management' | 'kasir' | 'bar' | 'dapur' | 'owner' | string;
  staff_id: string;
}

interface JadwalStafProps {
  userRole?: string;
  currentUser?: CurrentUser | null;
}

interface StaffSummary {
  staff_id: string;
  staff_name: string;
  role: string;
  status: string;
  shifts: { [day: string]: string };
  total_shift: number;
  total_shift_1: number;
  total_shift_2: number;
  total_off: number;
}

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const WEEKS = [1, 2, 3, 4];

// Helper: Tentukan minggu berjalan otomatis berdasarkan tanggal saat ini
const getCurrentWeekKey = (): number => {
  const currentDate = new Date().getDate();
  if (currentDate <= 7) return 1;
  if (currentDate <= 14) return 2;
  if (currentDate <= 21) return 3;
  return 4;
};

export default function JadwalStaf({ userRole = 'management', currentUser }: JadwalStafProps) {
  const [staffSummaries, setStaffSummaries] = useState<StaffSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedWeek, setSelectedWeek] = useState<number>(getCurrentWeekKey());
  const [selectedDay, setSelectedDay] = useState<string>('Senin');
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState<boolean>(false);

  const isManagement = userRole === 'management' || userRole === 'owner';
  const currentWeekNow = getCurrentWeekKey();

  useEffect(() => {
    fetchSchedulesFromDatabase();
  }, [selectedWeek]);

  const fetchSchedulesFromDatabase = async () => {
    setLoading(true);

    try {
      // 1. Ambil data staf aktif DENGAN MENYARING role Owner & Management
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('staff_id, staff_name, role, status')
        .neq('status', 'Resign')
        .not('role', 'ilike', 'owner')
        .not('role', 'ilike', 'management');

      if (staffError) throw staffError;

      // 2. Ambil data jadwal dari tabel 'schedules'
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('schedules')
        .select('staff_id, staff_name, day, shift, week_number');

      if (scheduleError) throw scheduleError;

      // Filter jadwal berdasarkan minggu yang dipilih
      const currentWeekSchedules = (scheduleData || []).filter(
        item => item.week_number === selectedWeek
      );

      // Map untuk pencarian cepat jadwal (Gunakan ID dan Nama secara case-insensitive)
      const scheduleMap: { [key: string]: string } = {};
      currentWeekSchedules.forEach(item => {
        scheduleMap[`${item.staff_id}_${item.day}`] = item.shift;
        if (item.staff_name) {
          scheduleMap[`${item.staff_name.toLowerCase()}_${item.day}`] = item.shift;
        }
      });

      // 3. Gabungkan data staf operasional & jadwal
      const summaries: StaffSummary[] = (staffData || []).map(staf => {
        const shifts: { [day: string]: string } = {};
        let total_shift_1 = 0;
        let total_shift_2 = 0;
        let total_off = 0;

        DAYS.forEach(day => {
          // Cari berdasarkan ID atau nama staf
          const shift = scheduleMap[`${staf.staff_id}_${day}`] 
            || scheduleMap[`${staf.staff_name.toLowerCase()}_${day}`] 
            || 'OFF';
            
          shifts[day] = shift;

          if (shift === 'Shift 1' || shift === 'S1') {
            total_shift_1 += 1;
          } else if (shift === 'Shift 2' || shift === 'S2') {
            total_shift_2 += 1;
          } else {
            total_off += 1;
          }
        });

        return {
          staff_id: staf.staff_id,
          staff_name: staf.staff_name,
          role: staf.role,
          status: staf.status || 'Aktif',
          shifts,
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

        {/* Kontrol Kanan: Tombol Tukar Shift, Edit Roster & Switcher Minggu */}
        <div className="flex flex-wrap items-center gap-2">
          {currentUser && (
            <button
              onClick={() => setIsSwapModalOpen(true)}
              className="px-3.5 py-1.5 bg-white text-[#111111] border border-neutral-300 rounded-2xl text-xs font-bold hover:bg-neutral-100 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <span>🔄</span> Tukar Shift
            </button>
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
        {DAYS.map(day => (
          <button
            key={day}
            onClick={() => setSelectedDay(day)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              selectedDay === day
                ? 'bg-[#111111] text-white'
                : 'bg-neutral-100 text-neutral-500'
            }`}
          >
            {day}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="py-12 text-center text-xs text-neutral-400 animate-pulse">
          Memuat data roster dari database...
        </div>
      ) : (
        <>
          {/* Tampilan Desktop: Tabel Roster Lengkap */}
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
                  {DAYS.map(day => (
                    <th key={day} className="p-3 text-center font-bold">{day}</th>
                  ))}
                  
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
                        <span className="flex items-center gap-1.5">
                          {staff.staff_name}
                          {isLoggedUser && (
                            <span className="bg-[#d22027] text-white text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase">
                              Anda
                            </span>
                          )}
                        </span>
                        {isManagement && staff.status && staff.status !== 'Aktif' && (
                          <span className="mt-0.5 inline-block px-1.5 py-0.5 text-[9px] rounded font-semibold bg-amber-100 text-amber-700">
                            {staff.status}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-neutral-500 capitalize">{staff.role}</td>
                      
                      {DAYS.map(day => {
                        const shift = staff.shifts[day] || 'OFF';
                        return (
                          <td key={day} className="p-3 text-center">
                            <span
                              className={`px-2 py-1 rounded-md font-bold text-[10px] inline-block min-w-[54px] ${
                                shift === 'Shift 1' || shift === 'S1'
                                  ? 'bg-blue-50 text-blue-600 border border-blue-100'
                                  : shift === 'Shift 2' || shift === 'S2'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                  : 'bg-red-50 text-red-500 border border-red-100'
                              }`}
                            >
                              {shift}
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
                Jadwal Hari {selectedDay} (Minggu {selectedWeek})
              </span>
            </div>

            {staffSummaries.map(staff => {
              const shiftToday = staff.shifts[selectedDay] || 'OFF';
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
                  </div>
                  <span
                    className={`px-3 py-1 rounded-xl font-bold text-xs ${
                      shiftToday === 'Shift 1' || shiftToday === 'S1'
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
    </div>
  );
}