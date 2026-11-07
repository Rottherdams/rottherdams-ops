import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface CurrentUser {
  name: string;
  role: string;
  staff_id: string;
}

interface StaffOption {
  staff_id: string;
  staff_name: string;
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
  created_at: string;
}

interface TukarShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: CurrentUser | null;
  onSuccess: () => void;
}

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

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

  // Form State
  const [targetStaffId, setTargetStaffId] = useState('');
  const [weekNumber, setWeekNumber] = useState<number>(1);
  const [swapDay, setSwapDay] = useState('Senin');
  
  // Shift State (Otomatis dari Database)
  const [myShift, setMyShift] = useState('Memuat...');
  const [targetShift, setTargetShift] = useState('Memuat...');
  const [reason, setReason] = useState('');

  const isManagement = currentUser?.role === 'management' || currentUser?.role === 'owner';

  // Ambil objek staf target berdasarkan ID yang dipilih
  const selectedTargetStaff = staffList.find(s => String(s.staff_id) === String(targetStaffId));

  // Deteksi jika shift asal dan shift tujuan persis sama
  const isSameShift = 
    !fetchingShifts && 
    targetStaffId !== '' && 
    myShift !== 'Memuat...' && 
    targetShift !== 'Pilih Pasangan' && 
    myShift === targetShift;

  useEffect(() => {
    if (isOpen) {
      fetchStaffList();
      fetchSwapRequests();
    }
  }, [isOpen, currentUser]);

  // Trigger pencarian shift otomatis setiap kali Minggu, Hari, atau Staf Pasangan berubah
  useEffect(() => {
    if (isOpen && currentUser) {
      fetchAutoShifts();
    }
  }, [isOpen, currentUser, weekNumber, swapDay, targetStaffId]);

  const fetchStaffList = async () => {
    const { data } = await supabase
      .from('staff')
      .select('staff_id, staff_name, role')
      .neq('status', 'Resign')
      .not('role', 'ilike', 'owner')
      .not('role', 'ilike', 'management');

    if (data) {
      setStaffList(data.filter(s => String(s.staff_id) !== String(currentUser?.staff_id)));
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

  // 🤖 FUNGSI UNTUK OTOMATIS MEMBACA SHIFT DARI DATABASE 'schedules'
  const fetchAutoShifts = async () => {
    if (!currentUser) return;
    setFetchingShifts(true);

    try {
      // 1. Ambil shift staf yang sedang login (requester)
      const { data: mySchedule } = await supabase
        .from('schedules')
        .select('shift')
        .eq('staff_id', currentUser.staff_id)
        .eq('week_number', weekNumber)
        .eq('day', swapDay)
        .maybeSingle();

      setMyShift(mySchedule?.shift || 'OFF');

      // 2. Ambil shift staf pasangan (target) jika sudah dipilih
      if (targetStaffId) {
        const { data: targetSchedule } = await supabase
          .from('schedules')
          .select('shift')
          .eq('staff_id', targetStaffId)
          .eq('week_number', weekNumber)
          .eq('day', swapDay)
          .maybeSingle();

        setTargetShift(targetSchedule?.shift || 'OFF');
      } else {
        setTargetShift('Pilih Pasangan');
      }
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
    };

    const { error } = await supabase.from('shift_swaps').insert([newRequest]);

    setLoading(false);

    if (!error) {
      alert('Pengajuan tukar shift berhasil dikirim!');
      setReason('');
      setActiveTab('history');
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

    const { error } = await supabase
      .from('shift_swaps')
      .update({ status })
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs text-left">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-neutral-100 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header Modal */}
        <div className="flex justify-between items-center pb-4 border-b border-neutral-100">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#d22027]">
              Shift Exchange Hub
            </span>
            <h3 className="text-lg font-black text-[#111111]">🔁 Pengajuan Tukar Shift</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200 flex items-center justify-center font-bold text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-neutral-100 p-1 rounded-2xl my-4">
          <button
            onClick={() => setActiveTab('form')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
              activeTab === 'form'
                ? 'bg-[#111111] text-white shadow-xs'
                : 'text-neutral-500 hover:text-[#111111]'
            }`}
          >
            📝 Form Ajukan Tukar
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
              activeTab === 'history'
                ? 'bg-[#111111] text-white shadow-xs'
                : 'text-neutral-500 hover:text-[#111111]'
            }`}
          >
            📋 Riwayat & Status ({swapRequests.length})
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto pr-1">
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
                      {staf.staff_name} ({staf.role})
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

              {/* READ-ONLY / DISPLAY OTOMATIS SHIFT */}
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

              {/* ⚠️ NOTIFIKASI WARNING DENGAN NAMA STAF SPESIFIK */}
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

              {/* TOMBOL SMART DISABLE BILA SHIFT SAMA */}
              <button
                type="submit"
                disabled={loading || fetchingShifts || isSameShift}
                className={`w-full py-3 font-extrabold text-xs rounded-xl shadow-md transition cursor-pointer ${
                  isSameShift
                    ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed shadow-none'
                    : 'bg-[#d22027] hover:bg-[#b0181e] text-white active:scale-98'
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
    </div>
  );
}