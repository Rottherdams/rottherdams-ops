import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { DAYS, getWeekDateRange } from '../../utils/dateUtils';

interface CurrentUser {
  name: string;
  role: string;
  staff_id: string;
  avatar_url?: string;
}

interface StaffOption {
  staff_id: string;
  staff_name: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  role: string;
}

interface SwapRequest {
  id: number | string;
  requester_staff_id: string;
  requester_staff_name: string;
  target_staff_id: string;
  target_staff_name: string;
  week_number: number;
  swap_date: string;
  requester_shift: string;
  target_shift: string;
  reason: string;
  status: string;
  target_status?: string;
  management_status?: string;
  created_at: string;
}

interface TukarShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: CurrentUser | null;
  onSuccess: () => void;
}

export default function TukarShiftModal({
  isOpen,
  onClose,
  currentUser,
  onSuccess,
}: TukarShiftModalProps) {
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingShifts, setFetchingShifts] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isTabChanging, setIsTabChanging] = useState(false);

  const handleTabChange = (newTab: 'form' | 'history') => {
    if (newTab === activeTab) return;
    setIsTabChanging(true);
    setTimeout(() => {
      setActiveTab(newTab);
      setIsTabChanging(false);
    }, 150);
  };

  const [targetStaffId, setTargetStaffId] = useState('');
  const [weekNumber, setWeekNumber] = useState<number>(1);
  const [swapDay, setSwapDay] = useState('Senin');
  
  const [myShift, setMyShift] = useState('Memuat...');
  const [targetShift, setTargetShift] = useState('Memuat...');
  const [reason, setReason] = useState('');

  const rawRole = (currentUser?.role || '').toLowerCase();
  const isManagement = 
    rawRole.includes('management') || 
    rawRole.includes('owner') ||
    rawRole.includes('general_manager') ||
    rawRole.includes('spv') ||
    rawRole.includes('hrd') ||
    rawRole.includes('finance') ||
    currentUser?.staff_id?.startsWith('MNG-') ||
    currentUser?.staff_id?.startsWith('OWN-');

  const selectedTargetStaff = staffList.find(s => String(s.staff_id) === String(targetStaffId));

  const isSameShift = 
    !fetchingShifts && 
    targetStaffId !== '' && 
    myShift !== 'Memuat...' && 
    targetShift !== 'Pilih Pasangan' && 
    myShift === targetShift;

  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      fetchStaffList();
      fetchSwapRequests();
    }
  }, [isOpen, currentUser]);

  useEffect(() => {
    if (isOpen && currentUser) {
      fetchAutoShifts();
    }
  }, [isOpen, currentUser, weekNumber, swapDay, targetStaffId]);

  const handleAnimatedClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 250);
  };

  const fetchStaffList = async () => {
    const { data } = await supabase
      .from('staff')
      .select('staff_id, staff_name, first_name, last_name, avatar_url, role')
      .neq('status', 'Resign');

    if (data) {
      const formatted = data
        .filter(s => {
          const r = (s.role || '').toLowerCase();
          const idUpper = (s.staff_id || '').toUpperCase();
          return (
            !r.includes('owner') &&
            !r.includes('management') &&
            !r.includes('general_manager') &&
            !r.includes('spv') &&
            !r.includes('hrd') &&
            !r.includes('finance') &&
            !idUpper.startsWith('OWN-') &&
            !idUpper.startsWith('MNG-')
          );
        })
        .map(s => ({
          ...s,
          staff_name: s.staff_name || (s.first_name ? `${s.first_name} ${s.last_name || ''}`.trim() : s.staff_id)
        }));
      setStaffList(formatted.filter(s => String(s.staff_id) !== String(currentUser?.staff_id)));
    }
  };

  const fetchSwapRequests = async () => {
    setLoading(true);
    let query = supabase
      .from('shift_swaps')
      .select('*')
      .order('created_at', { ascending: false });

    if (!isManagement && currentUser) {
      query = query.or(
        `requester_staff_id.eq.${currentUser.staff_id},target_staff_id.eq.${currentUser.staff_id}`
      );
    }

    const { data } = await query;
    if (data) setSwapRequests(data);
    setLoading(false);
  };

  const fetchAutoShifts = async () => {
    if (!currentUser) return;
    setFetchingShifts(true);

    try {
      const { start, end } = getWeekDateRange(weekNumber);

      const { data: scheduleData, error } = await supabase
        .from('schedules')
        .select('staff_id, shift, date, day, week_number')
        .or(`and(date.gte.${start},date.lte.${end}),week_number.eq.${weekNumber}`);

      if (error) {
        console.error('Error fetching dynamic shift details:', error);
      }

      let foundMyShift = 'OFF';
      let foundTargetShift = 'OFF';

      (scheduleData || []).forEach(item => {
        const isDayMatch = item.day === swapDay;

        if (String(item.staff_id) === String(currentUser.staff_id) && isDayMatch) {
          foundMyShift = item.shift || 'OFF';
        }

        if (targetStaffId && String(item.staff_id) === String(targetStaffId) && isDayMatch) {
          foundTargetShift = item.shift || 'OFF';
        }
      });

      setMyShift(foundMyShift);
      setTargetShift(targetStaffId ? foundTargetShift : 'Pilih Pasangan');
    } catch (err) {
      console.error('Error fetching automatic shifts:', err);
    } finally {
      setFetchingShifts(false);
    }
  };

  const handleSubmitSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !targetStaffId) {
      alert('Pilih pasangan staf yang ingin diajak tukar shift!');
      return;
    }

    if (isSameShift) {
      alert('Tidak dapat mengajukan tukar shift karena kedua staf berada pada shift yang sama.');
      return;
    }

    if (!selectedTargetStaff) return;

    setLoading(true);

    const newRequest = {
      requester_staff_id: String(currentUser.staff_id),
      requester_staff_name: currentUser.name,
      target_staff_id: String(selectedTargetStaff.staff_id),
      target_staff_name: selectedTargetStaff.staff_name,
      week_number: Number(weekNumber),
      swap_date: swapDay,
      requester_shift: myShift,
      target_shift: targetShift,
      reason: reason || 'Tukar shift operasional',
      status: 'Pending',
      target_status: 'pending',
      management_status: 'pending',
    };

    const { error } = await supabase.from('shift_swaps').insert([newRequest]);

    setLoading(false);

    if (!error) {
      alert('Pengajuan tukar shift berhasil dikirim!');
      setReason('');
      handleTabChange('history');
      fetchSwapRequests();
    } else {
      alert('Gagal mengajukan tukar shift: ' + error.message);
    }
  };

  const handleUpdateStatus = async (
    swapId: number | string,
    status: 'Approved' | 'Rejected',
    reqItem: SwapRequest
  ) => {
    if (!confirm(`Apakah Anda yakin ingin mengonfirmasi pengajuan ini menjadi ${status}?`)) {
      return;
    }

    setLoading(true);

    const mgmtStatus = status === 'Approved' ? 'approved' : 'rejected';

    const { error } = await supabase
      .from('shift_swaps')
      .update({ 
        status,
        management_status: mgmtStatus
      })
      .eq('id', swapId);

    if (error) {
      alert('Gagal memperbarui status: ' + error.message);
      setLoading(false);
      return;
    }

    if (status === 'Approved') {
      await supabase
        .from('schedules')
        .update({ shift: reqItem.target_shift })
        .match({
          staff_id: reqItem.requester_staff_id,
          week_number: reqItem.week_number,
          day: reqItem.swap_date,
        });

      await supabase
        .from('schedules')
        .update({ shift: reqItem.requester_shift })
        .match({
          staff_id: reqItem.target_staff_id,
          week_number: reqItem.week_number,
          day: reqItem.swap_date,
        });
    }

    setLoading(false);
    fetchSwapRequests();
    onSuccess();
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs text-left ${
        isClosing ? 'animate-backdrop-out' : 'animate-backdrop-in'
      }`}
    >
      <style>{`
        @keyframes modalBackdropIn { 0% { opacity: 0; } 100% { opacity: 1; } }
        @keyframes modalBackdropOut { 0% { opacity: 1; } 100% { opacity: 0; } }
        @keyframes modalContentIn {
          0% { opacity: 0; transform: scale(0.92) translateY(12px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes modalContentOut {
          0% { opacity: 1; transform: scale(1) translateY(0); }
          100% { opacity: 0; transform: scale(0.95) translateY(8px); }
        }
        .animate-backdrop-in { animation: modalBackdropIn 0.3s ease-out forwards; }
        .animate-backdrop-out { animation: modalBackdropOut 0.25s ease-in forwards; }
        .animate-modal-in { animation: modalContentIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-modal-out { animation: modalContentOut 0.25s ease-in forwards; }
      `}</style>

      <div
        className={`bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-neutral-100 max-h-[90vh] flex flex-col overflow-hidden my-auto ${
          isClosing ? 'animate-modal-out' : 'animate-modal-in'
        }`}
      >
        <div className="flex justify-between items-center pb-4 border-b border-neutral-100">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#d22027]">
              Shift Exchange Hub
            </span>
            <h3 className="text-lg font-black text-[#111111]">🔁 Pengajuan Tukar Shift</h3>
          </div>
          <button
            onClick={handleAnimatedClose}
            className="w-8 h-8 rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200 flex items-center justify-center font-bold text-sm cursor-pointer transition active:scale-90"
          >
            ✕
          </button>
        </div>

        <div className="relative bg-neutral-100 p-1 rounded-2xl my-4 flex shrink-0 select-none border border-neutral-200">
          <div
            className={`absolute top-1 bottom-1 w-[calc(50%-0.25rem)] bg-[#111111] rounded-xl shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              activeTab === 'history' ? 'translate-x-[calc(100%+0.25rem)]' : 'translate-x-0'
            }`}
          />

          <button
            type="button"
            onClick={() => handleTabChange('form')}
            className={`relative z-10 flex-1 py-2 text-xs font-bold rounded-xl transition-colors duration-200 cursor-pointer flex items-center justify-center ${
              activeTab === 'form' ? 'text-white' : 'text-neutral-500 hover:text-[#111111]'
            }`}
          >
            📝 Form Ajukan Tukar
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('history')}
            className={`relative z-10 flex-1 py-2 text-xs font-bold rounded-xl transition-colors duration-200 cursor-pointer flex items-center justify-center ${
              activeTab === 'history' ? 'text-white' : 'text-neutral-500 hover:text-[#111111]'
            }`}
          >
            📋 Riwayat & Status ({swapRequests.length})
          </button>
        </div>

        <div
          className={`flex-1 overflow-y-auto pr-1 transition-opacity duration-200 ${
            isTabChanging ? 'opacity-0 scale-[0.99]' : 'opacity-100 scale-100'
          }`}
        >
          {activeTab === 'form' ? (
            <form onSubmit={handleSubmitSwap} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Pilih Staf Pasangan Tukar:
                </label>
                <select
                  value={targetStaffId}
                  onChange={e => setTargetStaffId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-[#111111] focus:outline-none focus:border-[#d22027]"
                >
                  <option value="">-- Pilih Rekan Kerjasama --</option>
                  {staffList.map(staf => (
                    <option key={staf.staff_id} value={staf.staff_id}>
                      {staf.staff_name} ({staf.role?.replace(/_/g, ' ')})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">Minggu Ke:</label>
                  <select
                    value={weekNumber}
                    onChange={e => setWeekNumber(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold focus:outline-none"
                  >
                    <option value={1}>Minggu 1 (M1)</option>
                    <option value={2}>Minggu 2 (M2)</option>
                    <option value={3}>Minggu 3 (M3)</option>
                    <option value={4}>Minggu 4 (M4)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">Hari:</label>
                  <select
                    value={swapDay}
                    onChange={e => setSwapDay(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold focus:outline-none"
                  >
                    {DAYS.map(day => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Shift Asal Anda (Otomatis):
                  </label>
                  <div className="w-full px-3.5 py-2.5 bg-neutral-100 border border-neutral-200 rounded-xl text-xs font-black text-[#111111]">
                    {fetchingShifts ? '⌛ Membaca...' : myShift}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Shift Tujuan Pasangan (Otomatis):
                  </label>
                  <div className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-black border transition ${
                    isSameShift 
                      ? 'bg-amber-50 border-amber-300 text-amber-700' 
                      : 'bg-neutral-100 border-neutral-200 text-[#d22027]'
                  }`}>
                    {fetchingShifts ? '⌛ Membaca...' : targetShift}
                  </div>
                </div>
              </div>

              {isSameShift && (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-800 flex items-start gap-2">
                  <span className="text-sm">⚠️</span>
                  <span>
                    <b>Kamu</b> dan <b>{selectedTargetStaff?.staff_name || 'pasangan'}</b> sama-sama dijadwalkan pada <b>{myShift}</b>. Pertukaran tidak dapat dilakukan, silakan pilih hari atau pasangan staf yang berbeda!
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">Alasan Tukar Shift:</label>
                <textarea
                  rows={2}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Misal: Ada keperluan mendadak / keluarga..."
                  className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:outline-none focus:border-[#d22027]"
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={loading || fetchingShifts || isSameShift}
                className={`w-full py-3 font-extrabold text-xs rounded-xl shadow-md transition cursor-pointer active:scale-98 ${
                  isSameShift
                    ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed shadow-none'
                    : 'bg-[#d22027] hover:bg-[#b0181e] text-white'
                }`}
              >
                {loading
                  ? 'Kirim Pengajuan...'
                  : isSameShift
                  ? '🚫 Shift Sama (Tidak Bisa Ditukar)'
                  : '🚀 Kirim Permohonan Tukar Shift'}
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              {loading ? (
                <div className="py-8 text-center text-xs text-neutral-400 animate-pulse">
                  Memuat data riwayat tukar shift...
                </div>
              ) : swapRequests.length === 0 ? (
                <div className="py-8 text-center text-xs text-neutral-400">
                  Belum ada pengajuan tukar shift.
                </div>
              ) : (
                swapRequests.map(req => {
                  const isTargetUser = String(currentUser?.staff_id) === String(req.target_staff_id);
                  const canApprove = isManagement || isTargetUser;

                  return (
                    <div
                      key={req.id}
                      className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 text-xs space-y-2"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-extrabold text-[#111111]">
                            {req.requester_staff_name} ↔️ {req.target_staff_name}
                          </p>
                          <p className="text-[10px] text-neutral-400">
                            M{req.week_number} • {req.swap_date} ({req.requester_shift} 🔄 {req.target_shift})
                          </p>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            req.status === 'Approved'
                              ? 'bg-emerald-100 text-emerald-700'
                              : req.status === 'Rejected'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {req.status}
                        </span>
                      </div>

                      <p className="text-[11px] text-neutral-600 bg-white p-2 rounded-xl border border-neutral-100 italic">
                        "{req.reason}"
                      </p>

                      {req.status === 'Pending' && canApprove && (
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => handleUpdateStatus(req.id, 'Approved', req)}
                            className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-xl transition cursor-pointer"
                          >
                            ✅ Setujui (Approve)
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(req.id, 'Rejected', req)}
                            className="flex-1 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-[11px] rounded-xl transition cursor-pointer"
                          >
                            ❌ Tolak
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}