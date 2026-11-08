import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';

interface EditRosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  selectedWeek: number;
}

interface StaffOption {
  staff_id: string;
  staff_name: string;
  first_name?: string;
  last_name?: string;
  role: string;
  status?: string;
}

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const SHIFTS = ['Shift 1', 'Shift 2', 'OFF'];

const INITIAL_STAFF_OPTIONS: StaffOption[] = [
  { staff_id: 'STF-001', staff_name: 'Yusuf', first_name: 'Yusuf', role: 'dapur', status: 'Aktif' },
  { staff_id: 'STF-002', staff_name: 'Indah', first_name: 'Indah', role: 'dapur', status: 'Aktif' },
  { staff_id: 'STF-003', staff_name: 'Tika', first_name: 'Tika', role: 'dapur', status: 'Aktif' },
  { staff_id: 'STF-004', staff_name: 'Rico', first_name: 'Rico', role: 'bar', status: 'Aktif' },
  { staff_id: 'STF-005', staff_name: 'Jamil', first_name: 'Jamil', role: 'bar', status: 'Aktif' },
  { staff_id: 'STF-006', staff_name: 'Opang', first_name: 'Opang', role: 'bar', status: 'Aktif' },
  { staff_id: 'STF-007', staff_name: 'Cece', first_name: 'Cece', role: 'kasir', status: 'Aktif' },
];

const isOperationalStaff = (roleStr: string) => {
  const r = (roleStr || '').toLowerCase();
  return (
    !r.includes('management') &&
    !r.includes('owner') &&
    !r.includes('manajer') &&
    !r.includes('general_manager') &&
    !r.includes('spv') &&
    !r.includes('hrd') &&
    !r.includes('finance')
  );
};

export default function EditRosterModal({ isOpen, onClose, onSuccess, selectedWeek }: EditRosterModalProps) {
  const [staffList, setStaffList] = useState<StaffOption[]>(INITIAL_STAFF_OPTIONS);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('STF-001');
  const [week, setWeek] = useState<number>(selectedWeek);
  const [day, setDay] = useState<string>('Senin');
  const [shift, setShift] = useState<string>('Shift 1');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isClosing, setIsClosing] = useState<boolean>(false);

  useEffect(() => {
    setWeek(selectedWeek);
    if (isOpen) {
      setIsClosing(false);
      fetchStaffList();
    }
  }, [isOpen, selectedWeek]);

  const handleAnimatedClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 250);
  };

  const fetchStaffList = async () => {
    const { data, error } = await supabase
      .from('staff')
      .select('staff_id, staff_name, first_name, last_name, role, status')
      .order('staff_id', { ascending: true });

    if (!error && data && data.length > 0) {
      const operationalStaff = data.filter(
        s => s.status !== 'Resign' && isOperationalStaff(s.role)
      );

      if (operationalStaff.length > 0) {
        const formattedStaff = operationalStaff.map(s => ({
          ...s,
          staff_name: s.staff_name || (s.first_name ? `${s.first_name} ${s.last_name || ''}`.trim() : s.staff_id),
        }));

        setStaffList(formattedStaff);
        setSelectedStaffId(formattedStaff[0].staff_id);
        return;
      }
    }

    setStaffList(INITIAL_STAFF_OPTIONS);
    setSelectedStaffId(INITIAL_STAFF_OPTIONS[0].staff_id);
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const staffObj = staffList.find(s => s.staff_id === selectedStaffId);
    if (!staffObj) {
      setIsSubmitting(false);
      return;
    }

    const displayName = staffObj.staff_name || 
      (staffObj.first_name ? `${staffObj.first_name} ${staffObj.last_name || ''}`.trim() : staffObj.staff_id);

    const { error } = await supabase.from('schedules').upsert(
      {
        staff_id: staffObj.staff_id,
        staff_name: displayName,
        role: staffObj.role,
        week_number: week,
        day: day,
        shift: shift,
      },
      { onConflict: 'staff_id,week_number,day' }
    );

    setIsSubmitting(false);

    if (error) {
      alert('Gagal memperbarui roster: ' + error.message);
    } else {
      setIsClosing(true);
      setTimeout(() => {
        onSuccess();
        onClose();
        setIsClosing(false);
      }, 250);
    }
  };

  return createPortal(
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 ${
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
        className={`bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-neutral-100 my-auto ${
          isClosing ? 'animate-modal-out' : 'animate-modal-in'
        }`}
      >
        <div className="flex justify-between items-center mb-5 pb-3 border-b border-neutral-100">
          <div>
            <span className="text-[10px] uppercase font-bold text-[#d22027] tracking-wider">
              Management Tool
            </span>
            <h3 className="text-lg font-bold text-[#111111]">Update Roster Kerja</h3>
          </div>
          <button
            onClick={handleAnimatedClose}
            type="button"
            className="w-8 h-8 rounded-full bg-neutral-100 text-neutral-500 font-bold hover:bg-neutral-200 transition cursor-pointer flex items-center justify-center text-sm active:scale-90"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs text-left">
          <div>
            <label className="block font-bold text-neutral-700 mb-1">Pilih Staf Operasional:</label>
            <select
              value={selectedStaffId}
              onChange={e => setSelectedStaffId(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 font-bold text-neutral-800 focus:outline-none focus:border-[#d22027] capitalize cursor-pointer"
            >
              {staffList.map(s => {
                const nameDisplay = s.staff_name || `${s.first_name || ''} ${s.last_name || ''}`.trim();
                const roleFormatted = (s.role || '').replace(/_/g, ' ');
                return (
                  <option key={s.staff_id} value={s.staff_id}>
                    {s.staff_id} - {nameDisplay} ({roleFormatted})
                  </option>
                );
              })}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-neutral-700 mb-1">Minggu Ke-:</label>
              <select
                value={week}
                onChange={e => setWeek(Number(e.target.value))}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 font-medium text-neutral-800 focus:outline-none focus:border-[#d22027] cursor-pointer"
              >
                {[1, 2, 3, 4].map(w => (
                  <option key={w} value={w}>
                    Minggu {w}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-neutral-700 mb-1">Hari:</label>
              <select
                value={day}
                onChange={e => setDay(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 font-medium text-neutral-800 focus:outline-none focus:border-[#d22027] cursor-pointer"
              >
                {DAYS.map(d => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-neutral-700 mb-1">Shift Kerja:</label>
            <div className="grid grid-cols-3 gap-2">
              {SHIFTS.map(s => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setShift(s)}
                  className={`py-2 rounded-xl font-bold border transition text-center cursor-pointer ${
                    shift === s
                      ? s === 'Shift 1'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : s === 'Shift 2'
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-red-600 text-white border-red-600'
                      : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-3 flex gap-2">
            <button
              type="button"
              onClick={handleAnimatedClose}
              className="flex-1 py-3 bg-neutral-100 text-neutral-600 font-bold rounded-xl hover:bg-neutral-200 transition cursor-pointer active:scale-95"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 bg-[#d22027] text-white font-bold rounded-xl hover:bg-[#b81b21] transition cursor-pointer shadow-md disabled:opacity-50 active:scale-95"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Shift'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}