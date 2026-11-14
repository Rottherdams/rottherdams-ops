import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { sendTelegramAlert, sendStaffDirectTelegram } from '../lib/telegram';
import EditRosterModal from './EditRosterModal';
import TukarShiftModal from './jadwal/TukarShiftModal';
import LeaveRequestModal from './jadwal/LeaveRequestModal';
import StaffInboxModal from './StaffInboxModal';
import ScheduleHeader from './jadwal/ScheduleHeader';
import ScheduleGrid from './jadwal/ScheduleGrid';
import type { StaffSummary } from './jadwal/ScheduleGrid';

// 🌟 IMPORT UTILS TANGGAL MODULAR
import {
  DAYS,
  WEEKS,
  getWeekDateRange,
  getCurrentWeekKey,
  getTodayName,
  isSameDate,
} from '../utils/dateUtils';

interface CurrentUser {
  name: string;
  role: string;
  staff_id: string;
  avatar_url?: string;
}

interface JadwalStafProps {
  userRole?: string;
  currentUser?: CurrentUser | null;
}

interface SuccessPopupState {
  isOpen: boolean;
  title: string;
  subtitle: string;
  badgeText?: string;
}

export default function JadwalStaf({ userRole = 'management', currentUser }: JadwalStafProps) {
  const [staffSummaries, setStaffSummaries] = useState<StaffSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedWeek, setSelectedWeek] = useState<number>(getCurrentWeekKey());
  const [selectedDay, setSelectedDay] = useState<string>(getTodayName());
  const [dateLabels, setDateLabels] = useState<{ [day: string]: string }>({});
  
  const [animKey, setAnimKey] = useState<number>(0);

  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState<boolean>(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState<boolean>(false);
  
  const [isInboxOpen, setIsInboxOpen] = useState<boolean>(false);
  const [pendingInboxCount, setPendingInboxCount] = useState<number>(0);

  // 🌟 Custom Popup Sukses (Pengganti alert() bawaan browser)
  const [successPopup, setSuccessPopup] = useState<SuccessPopupState>({
    isOpen: false,
    title: '',
    subtitle: '',
  });

  const rawRole = (currentUser?.role || userRole || '').toLowerCase();
  const isManagement = 
    rawRole.includes('management') || 
    rawRole.includes('owner') ||
    rawRole.includes('general_manager') ||
    rawRole.includes('spv') ||
    rawRole.includes('hrd') ||
    rawRole.includes('finance') ||
    (currentUser?.staff_id || '').startsWith('MNG-') ||
    (currentUser?.staff_id || '').startsWith('OWN-');

  const currentWeekNow = getCurrentWeekKey();

  useEffect(() => {
    fetchSchedulesFromDatabase();
    if (currentUser?.staff_id) {
      checkPendingInbox();
    }
  }, [selectedWeek, currentUser]);

  const handleWeekChange = (w: number) => {
    if (w === selectedWeek) return;
    setSelectedWeek(w);
    setAnimKey(prev => prev + 1);
  };

  const handleDayChange = (day: string) => {
    if (day === selectedDay) return;
    setSelectedDay(day);
    setAnimKey(prev => prev + 1);
  };

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
      const { start, end, dateFormattedLabels } = getWeekDateRange(selectedWeek);
      setDateLabels(dateFormattedLabels);

      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('staff_id, staff_name, first_name, last_name, avatar_url, role, status')
        .neq('status', 'Resign');

      if (staffError) throw staffError;

      const operationalStaffData = (staffData || []).filter(s => {
        const r = (s.role || '').toLowerCase();
        return (
          !r.includes('management') &&
          !r.includes('owner') &&
          !r.includes('manajer') &&
          !r.includes('general_manager') &&
          !r.includes('spv') &&
          !r.includes('hrd') &&
          !r.includes('finance')
        );
      });

      const { data: scheduleData, error: scheduleError } = await supabase
        .from('schedules')
        .select('staff_id, staff_name, day, date, shift, week_number')
        .or(`and(date.gte.${start},date.lte.${end}),week_number.eq.${selectedWeek}`);

      if (scheduleError) throw scheduleError;

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

      const summaries: StaffSummary[] = operationalStaffData.map(staf => {
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
      setLoading(false);
      setAnimKey(prev => prev + 1);
    } catch (err) {
      console.error('Error fetching dynamic roster schedules:', err);
      setLoading(false);
    }
  };

  const { weekDates: currentSelectedWeekDates } = getWeekDateRange(selectedWeek);

  return (
    <div className="bg-white rounded-3xl p-5 md:p-6 border border-neutral-200 shadow-sm mb-8 text-left">
      <style>{`
        @keyframes fadeInCol {
          0% { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-col-fade {
          animation: fadeInCol 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }
        @keyframes successPopIn {
          0% { opacity: 0; transform: scale(0.9) translateY(14px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-success-pop {
          animation: successPopIn 0.32s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Header Roster Komponen Baru */}
      <ScheduleHeader
        currentUser={currentUser}
        isManagement={isManagement}
        pendingInboxCount={pendingInboxCount}
        selectedWeek={selectedWeek}
        currentWeekNow={currentWeekNow}
        weeks={WEEKS}
        onWeekChange={handleWeekChange}
        onOpenInbox={() => setIsInboxOpen(true)}
        onOpenLeaveModal={() => setIsLeaveModalOpen(true)}
        onOpenSwapModal={() => setIsSwapModalOpen(true)}
        onOpenEditModal={() => setIsEditModalOpen(true)}
      />

      {loading ? (
        <div className="py-12 text-center text-xs text-neutral-400 animate-pulse">
          Memuat data roster presisi dari database...
        </div>
      ) : (
        /* Grid Roster Komponen Baru */
        <ScheduleGrid
          staffSummaries={staffSummaries}
          days={DAYS}
          dateLabels={dateLabels}
          currentSelectedWeekDates={currentSelectedWeekDates}
          selectedDay={selectedDay}
          selectedWeek={selectedWeek}
          animKey={animKey}
          isManagement={isManagement}
          currentUser={currentUser}
          onDayChange={handleDayChange}
          isSameDate={isSameDate}
        />
      )}

      {/* Modal Actions */}
      <EditRosterModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={() => fetchSchedulesFromDatabase()}
        selectedWeek={selectedWeek}
      />

      <TukarShiftModal
        isOpen={isSwapModalOpen}
        onClose={() => setIsSwapModalOpen(false)}
        currentUser={currentUser || null}
        onSuccess={async (swapDetails) => {
          // 1. Kirim Notifikasi ke Grup Operasional
          await sendTelegramAlert({
            title: '🔄 PENGAJUAN TUKAR SHIFT BARU',
            actor: currentUser ? `${currentUser.name} (${currentUser.staff_id})` : 'Staf',
            details: {
              'Divisi': (currentUser?.role || '').replace(/_/g, ' ').toUpperCase(),
              'Rekan Tujuan': swapDetails?.targetName || '-',
              'Jadwal': swapDetails ? `M${swapDetails.weekNumber} • ${swapDetails.swapDay}` : '-',
              'Detail Shift': swapDetails ? `${swapDetails.requesterShift} ↔️ ${swapDetails.targetShift}` : '-',
              'Status': 'Menunggu konfirmasi rekan kerja',
            },
          });

          // 2. Kirim Notifikasi Personal ke Telegram Karyawan yang Dituju
          if (swapDetails?.targetStaffId) {
            await sendStaffDirectTelegram(swapDetails.targetStaffId, {
              title: '📩 PERMINTAAN TUKAR SHIFT UNTUK ANDA',
              actor: currentUser ? `${currentUser.name} (${currentUser.staff_id})` : 'Rekan Kerja',
              details: {
                'Minggu & Hari': `Minggu ${swapDetails.weekNumber} (${swapDetails.swapDay})`,
                'Shift Dia': swapDetails.requesterShift,
                'Shift Anda': swapDetails.targetShift,
                'Alasan': swapDetails.reason || '-',
                'Tindakan': 'Buka menu Jadwal Staf → Inbox & Status untuk ACC / Tolak',
              },
            });
          }

          fetchSchedulesFromDatabase();
          setSuccessPopup({
            isOpen: true,
            title: 'Permohonan Tukar Shift Terkirim!',
            subtitle: `Ajakan tukar shift ke ${swapDetails?.targetName || 'rekan kerja'} berhasil dikirim. Menunggu persetujuan rekan kerja & manajemen.`,
            badgeText: 'Menunggu Konfirmasi Rekan Kerja',
          });
        }}
      />

      <LeaveRequestModal
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
        onSuccess={async (leaveDetails) => {
          await sendTelegramAlert({
            title: '📝 PENGAJUAN IZIN / CUTI BARU',
            actor: currentUser ? `${currentUser.name} (${currentUser.staff_id})` : 'Staf',
            details: {
              'Divisi': (currentUser?.role || '').replace(/_/g, ' ').toUpperCase(),
              'Jenis': leaveDetails?.leaveType || '-',
              'Tanggal': leaveDetails ? `${leaveDetails.startDate} s/d ${leaveDetails.endDate}` : '-',
              'Alasan': leaveDetails?.reason || '-',
              'Status': 'Menunggu ACC Management di Dashboard',
            },
          });

          fetchSchedulesFromDatabase();
          setSuccessPopup({
            isOpen: true,
            title: 'Pengajuan Berhasil Dikirim!',
            subtitle: `Permohonan ${leaveDetails?.leaveType || 'izin'} Anda telah diteruskan ke Manajemen untuk ditinjau.`,
            badgeText: 'Menunggu ACC Manajemen',
          });
        }}
        currentUser={currentUser || null}
      />

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

      {/* 🌟 CUSTOM SUCCESS MODAL (PENGGANTI BROWSER ALERT) */}
      {successPopup.isOpen &&
        createPortal(
          <div
            onClick={() => setSuccessPopup((prev) => ({ ...prev, isOpen: false }))}
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-neutral-100 text-center space-y-4 animate-success-pop"
            >
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-2xl shadow-2xs">
                ✅
              </div>

              <div className="space-y-1.5">
                {successPopup.badgeText && (
                  <span className="inline-block text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    {successPopup.badgeText}
                  </span>
                )}
                <h3 className="text-base font-black text-[#111111]">
                  {successPopup.title}
                </h3>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  {successPopup.subtitle}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSuccessPopup((prev) => ({ ...prev, isOpen: false }))}
                className="w-full py-3 bg-[#111111] hover:bg-black text-white rounded-2xl text-xs font-extrabold transition cursor-pointer active:scale-95 shadow-sm"
              >
                Oke, Mengerti
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}