import { useState, useEffect } from 'react';
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
  role: string;
  status?: string;
}

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const SHIFTS = ['Shift 1', 'Shift 2', 'OFF'];

// Data Staf Fallback jika di Supabase belum ada record tabel staff (Hanya Staf Operasional)
const INITIAL_STAFF_OPTIONS: StaffOption[] = [
  { staff_id: 'STF-001', staff_name: 'Yusuf', role: 'Dapur', status: 'Aktif' },
  { staff_id: 'STF-002', staff_name: 'Indah', role: 'Dapur', status: 'Aktif' },
  { staff_id: 'STF-003', staff_name: 'Tika', role: 'Dapur', status: 'Aktif' },
  { staff_id: 'STF-004', staff_name: 'Rico', role: 'Bar & Server', status: 'Aktif' },
  { staff_id: 'STF-005', staff_name: 'Jamil', role: 'Bar & Server', status: 'Aktif' },
  { staff_id: 'STF-006', staff_name: 'Opang', role: 'Bar & Server', status: 'Aktif' },
  { staff_id: 'STF-007', staff_name: 'Cece', role: 'Kasir', status: 'Aktif' },
];

// Helper Function: Cek apakah role termasuk manajemen/owner
const isOperationalStaff = (roleStr: string) => {
  const roleLower = (roleStr || '').toLowerCase();
  return !roleLower.includes('management') && !roleLower.includes('owner') && !roleLower.includes('manajer');
};

export default function EditRosterModal({ isOpen, onClose, onSuccess, selectedWeek }: EditRosterModalProps) {
  const [staffList, setStaffList] = useState<StaffOption[]>(INITIAL_STAFF_OPTIONS);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('STF-001');
  const [week, setWeek] = useState<number>(selectedWeek);
  const [day, setDay] = useState<string>('Senin');
  const [shift, setShift] = useState<string>('Shift 1');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    setWeek(selectedWeek);
    if (isOpen) {
      fetchStaffList();
    }
  }, [isOpen, selectedWeek]);

  const fetchStaffList = async () => {
    const { data, error } = await supabase
      .from('staff')
      .select('staff_id, staff_name, role, status')
      .order('staff_id', { ascending: true });

    if (!error && data && data.length > 0) {
      // 🟢 Filter: Pegawai status Aktif / Izin (bukan Resign) DAN HANYA OPERASIONAL (Bukan Management & Owner)
      const operationalStaff = data.filter(
        s => s.status !== 'Resign' && isOperationalStaff(s.role)
      );

      if (operationalStaff.length > 0) {
        setStaffList(operationalStaff);
        setSelectedStaffId(operationalStaff[0].staff_id);
        return;
      }
    }

    // Jika tabel staff di Supabase belum dibuat/kosong, gunakan data fallback operasional
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

    // Simpan / Update jadwal ke database Supabase
    const { error } = await supabase.from('schedules').upsert(
      {
        staff_id: staffObj.staff_id,
        staff_name: staffObj.staff_name,
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
      onSuccess();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-neutral-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex justify-between items-center mb-5 pb-3 border-b border-neutral-100">
          <div>
            <span className="text-[10px] uppercase font-bold text-[#d22027] tracking-wider">
              Management Tool
            </span>
            <h3 className="text-lg font-bold text-[#111111]">Update Roster Kerja</h3>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="w-8 h-8 rounded-full bg-neutral-100 text-neutral-500 font-bold hover:bg-neutral-200 transition cursor-pointer flex items-center justify-center text-sm"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs text-left">
          {/* Pilih Karyawan (Hanya Operasional: Bar, Server, Dapur, Kasir) */}
          <div>
            <label className="block font-bold text-neutral-700 mb-1">Pilih Staf Operasional:</label>
            <select
              value={selectedStaffId}
              onChange={e => setSelectedStaffId(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 font-bold text-neutral-800 focus:outline-none focus:border-[#d22027]"
            >
              {staffList.map(s => (
                <option key={s.staff_id} value={s.staff_id}>
                  {s.staff_id} - {s.staff_name} ({s.role})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Pilih Minggu */}
            <div>
              <label className="block font-bold text-neutral-700 mb-1">Minggu Ke-:</label>
              <select
                value={week}
                onChange={e => setWeek(Number(e.target.value))}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 font-medium text-neutral-800 focus:outline-none focus:border-[#d22027]"
              >
                {[1, 2, 3, 4].map(w => (
                  <option key={w} value={w}>
                    Minggu {w}
                  </option>
                ))}
              </select>
            </div>

            {/* Pilih Hari */}
            <div>
              <label className="block font-bold text-neutral-700 mb-1">Hari:</label>
              <select
                value={day}
                onChange={e => setDay(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 font-medium text-neutral-800 focus:outline-none focus:border-[#d22027]"
              >
                {DAYS.map(d => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Pilih Shift */}
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

          {/* Action Buttons */}
          <div className="pt-3 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-neutral-100 text-neutral-600 font-bold rounded-xl hover:bg-neutral-200 transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 bg-[#d22027] text-white font-bold rounded-xl hover:bg-[#b81b21] transition cursor-pointer shadow-md disabled:opacity-50"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Shift'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}