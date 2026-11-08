import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';

interface CurrentUser {
  name: string;
  role: string;
  staff_id: string;
}

interface StaffItem {
  id?: number;
  staff_id: string;
  staff_name: string;
  first_name?: string;
  last_name?: string;
  role: string;
  status: 'Aktif' | 'Cuti' | 'Resign' | 'Izin' | string;
  pin?: string;
  phone_number?: string;
  telegram_chat_id?: string;
  email?: string;
  avatar_url?: string;
}

interface DaftarKaryawanProps {
  currentUser?: CurrentUser;
}

type SortField = 'staff_id' | 'staff_name' | 'role' | 'status';
type SortOrder = 'asc' | 'desc';

const ROLE_OPTIONS = [
  { group: 'Executive & Management', options: [
    { value: 'owner', label: 'Owner / Co-Founder' },
    { value: 'general_manager', label: 'General Manager' },
    { value: 'management', label: 'Store Manager' },
    { value: 'spv', label: 'Supervisor (SPV)' },
    { value: 'hrd', label: 'HRD & People Ops' },
    { value: 'finance', label: 'Finance & Accounting' },
  ]},
  { group: 'Front of House (FOH)', options: [
    { value: 'head_barista', label: 'Head Barista' },
    { value: 'bar', label: 'Barista / Bartender' },
    { value: 'kasir', label: 'Kasir / Cashier' },
    { value: 'server', label: 'Server / Waiters' },
  ]},
  { group: 'Back of House (BOH)', options: [
    { value: 'head_chef', label: 'Head Chef' },
    { value: 'dapur', label: 'Cook / Staf Dapur' },
    { value: 'kitchen_helper', label: 'Kitchen Helper' },
    { value: 'dishwasher', label: 'Dishwasher / Steward' },
    { value: 'inventory', label: 'Inventory & Stockist' },
  ]},
  { group: 'Support & Facilities', options: [
    { value: 'cleaning', label: 'Cleaning Service' },
    { value: 'maintenance', label: 'Technician / Maintenance' },
  ]},
];

const getSortPriority = (id: string) => {
  if (id.startsWith('OWN-')) return 1;
  if (id.startsWith('MNG-')) return 2;
  return 3;
};

const INITIAL_STAFF: StaffItem[] = [
  { staff_id: 'OWN-001', staff_name: 'Iqbal', first_name: 'Iqbal', last_name: '', role: 'owner', status: 'Aktif' },
  { staff_id: 'OWN-002', staff_name: 'Gilang', first_name: 'Gilang', last_name: '', role: 'owner', status: 'Aktif' },
  { staff_id: 'MNG-001', staff_name: 'Renal', first_name: 'Renal', last_name: '', role: 'management', status: 'Aktif' },
  { staff_id: 'STF-001', staff_name: 'Yusuf', first_name: 'Yusuf', last_name: '', role: 'dapur', status: 'Aktif' },
  { staff_id: 'STF-002', staff_name: 'Indah', first_name: 'Indah', last_name: '', role: 'dapur', status: 'Aktif' },
  { staff_id: 'STF-003', staff_name: 'Tika', first_name: 'Tika', last_name: '', role: 'dapur', status: 'Aktif' },
  { staff_id: 'STF-004', staff_name: 'Rico', first_name: 'Rico', last_name: '', role: 'bar', status: 'Aktif' },
  { staff_id: 'STF-005', staff_name: 'Jamil', first_name: 'Jamil', last_name: '', role: 'bar', status: 'Aktif' },
  { staff_id: 'STF-006', staff_name: 'Opang', first_name: 'Opang', last_name: '', role: 'bar', status: 'Aktif' },
  { staff_id: 'STF-007', staff_name: 'Alya', first_name: 'Alya', last_name: '', role: 'kasir', status: 'Resign' },
  { staff_id: 'STF-008', staff_name: 'Firda', first_name: 'Firda', last_name: '', role: 'kasir', status: 'Resign' },
  { staff_id: 'STF-009', staff_name: 'Cece', first_name: 'Cece', last_name: '', role: 'kasir', status: 'Aktif' },
];

export default function DaftarKaryawan({ currentUser }: DaftarKaryawanProps) {
  const [staffList, setStaffList] = useState<StaffItem[]>(INITIAL_STAFF);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [sortBy, setSortBy] = useState<SortField>('staff_id');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newStaffName, setNewStaffName] = useState('');
  const [newPhoneNumber, setNewPhoneNumber] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newTelegramId, setNewTelegramId] = useState('');
  const [newAvatarUrl, setNewAvatarUrl] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<string>('bar');
  const [newStaffPin, setNewStaffPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [editingStaff, setEditingStaff] = useState<StaffItem | null>(null);

  // 🌟 State Nilai Animasi Counter
  const [animatedTotal, setAnimatedTotal] = useState(0);
  const [animatedActive, setAnimatedActive] = useState(0);
  const [animatedResign, setAnimatedResign] = useState(0);

  // 🌟 State Kontrol Kemunculan Card 2 & 3
  const [showCard2, setShowCard2] = useState(false);
  const [showCard3, setShowCard3] = useState(false);

  const rawRole = (currentUser?.role || '').toLowerCase();
  const isManagementOrOwner = 
    !currentUser || 
    rawRole.includes('management') || 
    rawRole.includes('owner') ||
    currentUser.staff_id?.startsWith('MNG-') ||
    currentUser.staff_id?.startsWith('OWN-');

  useEffect(() => {
    fetchStaff();
  }, []);

  const totalTarget = staffList.length;
  const activeTarget = staffList.filter(s => s.status === 'Aktif').length;
  const resignTarget = staffList.filter(s => s.status === 'Resign').length;

  // 🎬 RANTAI ANIMASI SEQUENTIAL PERFECT
  useEffect(() => {
    if (loading || totalTarget === 0) return;

    // Reset State Awal
    setAnimatedTotal(0);
    setAnimatedActive(totalTarget);
    setAnimatedResign(0);
    setShowCard2(false);
    setShowCard3(false);

    // --- STEP 1: Card 1 (0 ➔ Total Target) [0ms - 500ms] ---
    let start1: number | null = null;
    const duration1 = 500;

    const animateTotal = (ts: number) => {
      if (!start1) start1 = ts;
      const progress = Math.min((ts - start1) / duration1, 1);
      setAnimatedTotal(Math.floor(progress * totalTarget));

      if (progress < 1) {
        requestAnimationFrame(animateTotal);
      } else {
        setAnimatedTotal(totalTarget);

        // --- STEP 2: Card 2 (Total Karyawan ➔ Total Aktif) [500ms - 1000ms] ---
        setShowCard2(true);
        setTimeout(() => {
          let start2: number | null = null;
          const duration2 = 500;

          const animateActive = (ts2: number) => {
            if (!start2) start2 = ts2;
            const p2 = Math.min((ts2 - start2) / duration2, 1);
            const currentVal = Math.round(totalTarget - p2 * (totalTarget - activeTarget));
            setAnimatedActive(currentVal);

            if (p2 < 1) {
              requestAnimationFrame(animateActive);
            } else {
              setAnimatedActive(activeTarget);

              // --- STEP 3: Card 3 (0 ➔ Total Resign) [1000ms - 1400ms] ---
              setShowCard3(true);
              setTimeout(() => {
                let start3: number | null = null;
                const duration3 = 400;

                const animateResign = (ts3: number) => {
                  if (!start3) start3 = ts3;
                  const p3 = Math.min((ts3 - start3) / duration3, 1);
                  setAnimatedResign(Math.floor(p3 * resignTarget));

                  if (p3 < 1) {
                    requestAnimationFrame(animateResign);
                  } else {
                    setAnimatedResign(resignTarget);
                  }
                };
                requestAnimationFrame(animateResign);
              }, 50);
            }
          };
          requestAnimationFrame(animateActive);
        }, 50);
      }
    };

    requestAnimationFrame(animateTotal);
  }, [loading, totalTarget, activeTarget, resignTarget]);

  const fetchStaff = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('staff').select('*');
    setLoading(false);

    if (!error && data && data.length > 0) {
      const normalizedData = data.map((item: any) => ({
        ...item,
        staff_name: item.staff_name || item.first_name || '',
      }));
      setStaffList(normalizedData as StaffItem[]);
    }
  };

  const generateNextStaffId = (role: string) => {
    let prefix = 'STF-';
    const r = role.toLowerCase();
    if (r.includes('management') || r.includes('hrd') || r.includes('finance') || r.includes('general_manager')) prefix = 'MNG-';
    if (r.includes('owner')) prefix = 'OWN-';

    const samePrefixStaff = staffList.filter(s => (s.staff_id || '').startsWith(prefix));
    const nextNum = samePrefixStaff.length + 1;
    return `${prefix}${String(nextNum).padStart(3, '0')}`;
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFirstName.trim() || !newStaffPin.trim()) {
      setErrorMsg('Nama Depan dan PIN wajib diisi!');
      return;
    }

    if (newStaffPin.length < 4) {
      setErrorMsg('PIN minimal 4 digit angka!');
      return;
    }

    setSaving(true);
    setErrorMsg('');

    const generatedId = generateNextStaffId(newStaffRole);
    const displayName = newStaffName.trim() || `${newFirstName.trim()} ${newLastName.trim()}`.trim();

    const { error } = await supabase.from('staff').insert([
      {
        staff_id: generatedId,
        first_name: newFirstName.trim(),
        last_name: newLastName.trim(),
        staff_name: displayName,
        phone_number: newPhoneNumber.trim(),
        email: newEmail.trim(),
        telegram_chat_id: newTelegramId.trim(),
        avatar_url: newAvatarUrl.trim(),
        role: newStaffRole,
        status: 'Aktif',
        pin: newStaffPin.trim(),
      },
    ]);

    if (error) {
      setErrorMsg(`Gagal menambah karyawan: ${error.message}`);
    } else {
      setIsAddModalOpen(false);
      resetForm();
      fetchStaff();
    }
    setSaving(false);
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;

    setSaving(true);
    const displayName = editingStaff.staff_name.trim() || `${editingStaff.first_name?.trim()} ${editingStaff.last_name?.trim()}`.trim();

    const { error } = await supabase
      .from('staff')
      .update({
        first_name: editingStaff.first_name,
        last_name: editingStaff.last_name,
        staff_name: displayName,
        phone_number: editingStaff.phone_number,
        email: editingStaff.email,
        telegram_chat_id: editingStaff.telegram_chat_id,
        avatar_url: editingStaff.avatar_url,
        role: editingStaff.role,
      })
      .eq('staff_id', editingStaff.staff_id);

    if (error) {
      alert(`Gagal memperbarui data: ${error.message}`);
    } else {
      setEditingStaff(null);
      fetchStaff();
    }
    setSaving(false);
  };

  const resetForm = () => {
    setNewFirstName('');
    setNewLastName('');
    setNewStaffName('');
    setNewPhoneNumber('');
    setNewEmail('');
    setNewTelegramId('');
    setNewAvatarUrl('');
    setNewStaffPin('');
    setNewStaffRole('bar');
  };

  const handleStatusChange = async (staff_id: string, newStatus: StaffItem['status']) => {
    let updatedFields: { status: string; pin?: string } = { status: newStatus };

    if (newStatus === 'Resign') {
      updatedFields.pin = 'xxxx';
    } else if (newStatus === 'Aktif') {
      updatedFields.pin = '0000';
    }

    setStaffList(prev =>
      prev.map(item =>
        item.staff_id === staff_id
          ? {
              ...item,
              status: newStatus,
              ...(updatedFields.pin && { pin: updatedFields.pin }),
            }
          : item
      )
    );

    const { error } = await supabase
      .from('staff')
      .update(updatedFields)
      .eq('staff_id', staff_id);

    if (error) {
      alert('Gagal mengedit status karyawan: ' + error.message);
      fetchStaff();
    } else {
      if (newStatus === 'Resign') {
        alert(`🔒 Status diubah ke Resign. PIN staf diubah otomatis menjadi "xxxx".`);
      } else if (newStatus === 'Aktif') {
        alert(`🟢 Staf kembali Aktif. PIN diset ke default "0000".`);
      }
    }
  };

  const handleResetPin = async (staff_id: string, staff_name: string) => {
    const newPin = prompt(`Masukkan PIN baru untuk ${staff_name}:`);
    if (!newPin || newPin.trim().length < 4) {
      alert('Reset PIN dibatalkan atau kurang dari 4 digit.');
      return;
    }

    const { error } = await supabase
      .from('staff')
      .update({ pin: newPin.trim() })
      .eq('staff_id', staff_id);

    if (error) {
      alert(`Gagal mereset PIN: ${error.message}`);
    } else {
      alert(`✅ PIN ${staff_name} berhasil diperbarui menjadi ${newPin.trim()}!`);
      fetchStaff();
    }
  };

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const filteredStaffList = staffList.filter(s => 
    (s.staff_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.first_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.last_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.staff_id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.phone_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.role || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedStaffList = [...filteredStaffList].sort((a, b) => {
    if (sortBy === 'staff_id') {
      const priorityA = getSortPriority(a.staff_id);
      const priorityB = getSortPriority(b.staff_id);

      if (priorityA !== priorityB) {
        return sortOrder === 'asc' ? priorityA - priorityB : priorityB - priorityA;
      }
      return sortOrder === 'asc'
        ? a.staff_id.localeCompare(b.staff_id)
        : b.staff_id.localeCompare(a.staff_id);
    }

    const valA = (a[sortBy] || '').toString().toLowerCase();
    const valB = (b[sortBy] || '').toString().toLowerCase();

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="space-y-6 text-left">
      {/* 🌟 KEYFRAMES ANIMASI SEQUENTIAL */}
      <style>{`
        @keyframes cardPopIn {
          0% { opacity: 0; transform: scale(0.88) translateY(12px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes tableRowSlideIn {
          0% { opacity: 0; transform: translateY(14px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-card-pop { animation: cardPopIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-table-box { animation: cardPopIn 0.45s cubic-bezier(0.16, 1, 0.3, 1) 1.4s forwards; opacity: 0; }
      `}</style>

      {/* CARD RINGKASAN SDM DENGAN SEQUENTIAL ANIMATION */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {/* Card 1: Muncul Duluan (0 ➔ Total Target) */}
        <div className="bg-white p-5 rounded-3xl border border-neutral-100 shadow-sm animate-card-pop">
          <span className="text-2xl">👥</span>
          <p className="text-2xl font-black text-[#111111] mt-1 font-mono">{animatedTotal}</p>
          <p className="text-xs font-bold text-neutral-400">Total Karyawan</p>
        </div>

        {/* Card 2: Muncul setelah Card 1 selesai (Total Karyawan ➔ Total Aktif) */}
        {showCard2 && (
          <div className="bg-white p-5 rounded-3xl border border-neutral-100 shadow-sm animate-card-pop">
            <span className="text-2xl">🟢</span>
            <p className="text-2xl font-black text-emerald-600 mt-1 font-mono">{animatedActive}</p>
            <p className="text-xs font-bold text-neutral-400">Status Aktif</p>
          </div>
        )}

        {/* Card 3: Muncul setelah Card 2 selesai (0 ➔ Total Resign) */}
        {showCard3 && (
          <div className="bg-white p-5 rounded-3xl border border-neutral-100 shadow-sm col-span-2 sm:col-span-1 animate-card-pop">
            <span className="text-2xl">🔴</span>
            <p className="text-2xl font-black text-red-600 mt-1 font-mono">{animatedResign}</p>
            <p className="text-xs font-bold text-neutral-400">Resign / Non-Aktif</p>
          </div>
        )}
      </div>

      {/* TABEL DATA KARYAWAN */}
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-neutral-100 animate-table-box">
        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6 pb-4 border-b border-neutral-100">
          <div>
            <h2 className="text-xl font-black text-[#111111]">Daftar & Data Karyawan Rottherdams</h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Kelola data diri, kontak WA, integrasi Telegram Bot, PIN, dan status staf.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            {/* Dropdown Sorting */}
            <div className="flex items-center gap-2 bg-neutral-50 p-1.5 rounded-2xl border border-neutral-200">
              <span className="text-[11px] font-bold text-neutral-500 pl-2">Urutkan:</span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortField)}
                className="bg-white px-3 py-1.5 rounded-xl border border-neutral-200 text-xs font-bold text-[#111111] focus:outline-none cursor-pointer"
              >
                <option value="staff_id">ID Staf (Default)</option>
                <option value="staff_name">Nama Staf</option>
                <option value="role">Divisi / Role</option>
                <option value="status">Status Pegawai</option>
              </select>

              <button
                onClick={() => setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
                className="px-2.5 py-1.5 bg-white rounded-xl border border-neutral-200 text-xs font-bold hover:bg-neutral-100 transition cursor-pointer"
                title="Ubah Arah Urutan"
              >
                {sortOrder === 'asc' ? '⬆️ Asc' : '⬇️ Desc'}
              </button>
            </div>

            {isManagementOrOwner && (
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="px-4 py-2.5 bg-[#d22027] hover:bg-red-700 text-white rounded-2xl text-xs font-black transition cursor-pointer shadow-sm active:scale-95 flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <span>➕</span> Tambah Staf Baru
              </button>
            )}
          </div>
        </div>

        {/* SEARCH INPUT */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Cari Nama / HP / ID / Divisi Staf..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full sm:w-80 px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:outline-none focus:border-[#d22027]"
          />
        </div>

        {loading ? (
          <p className="text-xs text-neutral-400 font-bold py-8 text-center animate-pulse">
            Memuat data karyawan...
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#111111] text-white rounded-xl">
                  <th onClick={() => handleSort('staff_id')} className="p-3.5 rounded-l-xl cursor-pointer hover:bg-neutral-800 transition select-none">
                    ID Staf {sortBy === 'staff_id' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  <th onClick={() => handleSort('staff_name')} className="p-3.5 cursor-pointer hover:bg-neutral-800 transition select-none">
                    Nama Lengkap {sortBy === 'staff_name' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="p-3.5">Kontak & Telegram</th>
                  <th onClick={() => handleSort('role')} className="p-3.5 cursor-pointer hover:bg-neutral-800 transition select-none">
                    Divisi {sortBy === 'role' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  <th onClick={() => handleSort('status')} className="p-3.5 cursor-pointer hover:bg-neutral-800 transition select-none">
                    Status {sortBy === 'status' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="p-3.5 rounded-r-xl">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {sortedStaffList.map((staff, index) => {
                  const fullName = staff.first_name 
                    ? `${staff.first_name} ${staff.last_name || ''}`.trim()
                    : staff.staff_name;

                  const delay = 1500 + index * 60;

                  return (
                    <tr
                      key={staff.staff_id}
                      className="hover:bg-neutral-50 transition"
                      style={{
                        animation: `tableRowSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms forwards`,
                        opacity: 0,
                      }}
                    >
                      <td className="p-3.5 font-mono text-neutral-400 font-bold">{staff.staff_id}</td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          {staff.avatar_url ? (
                            <img
                              src={staff.avatar_url}
                              alt={fullName}
                              className="w-7 h-7 rounded-full object-cover border border-neutral-200"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-neutral-200 text-neutral-600 flex items-center justify-center font-bold text-[10px]">
                              {staff.first_name?.[0] || staff.staff_name[0]}
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-[#111111]">{fullName}</p>
                            {staff.first_name && (
                              <p className="text-[10px] text-neutral-400">Roster: {staff.staff_name}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <div className="space-y-0.5">
                          {staff.phone_number ? (
                            <p className="text-neutral-700 font-mono text-[11px]">📱 {staff.phone_number}</p>
                          ) : (
                            <p className="text-neutral-300 text-[10px]">Belum ada No HP</p>
                          )}

                          {staff.telegram_chat_id ? (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-sky-600 bg-sky-50 px-1.5 py-0.2 rounded border border-sky-100">
                              🤖 Telegram Ready
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[9px] text-neutral-400">
                              ⚪ Telegram Disconnected
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5 text-neutral-500 font-semibold capitalize">{staff.role.replace('_', ' ')}</td>
                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                            staff.status === 'Aktif'
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                              : staff.status === 'Resign'
                              ? 'bg-red-50 text-red-600 border border-red-200'
                              : 'bg-amber-50 text-amber-600 border border-amber-200'
                          }`}
                        >
                          {staff.status}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5">
                          <select
                            value={staff.status}
                            onChange={e =>
                              handleStatusChange(staff.staff_id, e.target.value as StaffItem['status'])
                            }
                            className="bg-neutral-50 border border-neutral-200 rounded-xl px-2 py-1 text-xs font-bold text-neutral-700 focus:outline-none focus:border-[#d22027] cursor-pointer"
                          >
                            <option value="Aktif">🟢 Aktif</option>
                            <option value="Cuti">🟡 Cuti</option>
                            <option value="Izin">🔵 Izin</option>
                            <option value="Resign">🔴 Resign</option>
                          </select>

                          {isManagementOrOwner && (
                            <>
                              <button
                                onClick={() => setEditingStaff(staff)}
                                title="Edit Detail Data Staf"
                                className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-bold transition cursor-pointer"
                              >
                                ✏️
                              </button>

                              <button
                                onClick={() => handleResetPin(staff.staff_id, staff.staff_name)}
                                title="Reset PIN Staf"
                                className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-bold transition cursor-pointer"
                              >
                                🔑
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 🌟 MODAL TAMBAH KARYAWAN (Dirennder lewat Portal) */}
      {isAddModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-neutral-200 space-y-4 text-left my-8 animate-card-pop">
            <div className="flex justify-between items-center pb-3 border-b border-neutral-100">
              <h3 className="font-black text-base text-[#111111]">➕ Tambah Karyawan Baru</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-neutral-400 hover:text-black font-bold text-sm cursor-pointer">
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-2xl text-xs font-bold">
                ⚠️ {errorMsg}
              </div>
            )}

            <form onSubmit={handleAddStaff} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-600 mb-1">Nama Depan *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Budi"
                    value={newFirstName}
                    onChange={e => setNewFirstName(e.target.value)}
                    className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-[#d22027]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-600 mb-1">Nama Belakang</label>
                  <input
                    type="text"
                    placeholder="Contoh: Santoso"
                    value={newLastName}
                    onChange={e => setNewLastName(e.target.value)}
                    className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-[#d22027]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-600 mb-1">Nama Panggilan di Roster (Opsional)</label>
                <input
                  type="text"
                  placeholder="Kosongkan jika sama dengan Nama Depan"
                  value={newStaffName}
                  onChange={e => setNewStaffName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-[#d22027]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-600 mb-1">No HP / WhatsApp</label>
                  <input
                    type="text"
                    placeholder="08123456789"
                    value={newPhoneNumber}
                    onChange={e => setNewPhoneNumber(e.target.value)}
                    className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-[#d22027]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-600 mb-1">Telegram Chat ID (Opsional)</label>
                  <input
                    type="text"
                    placeholder="Contoh: 5428521206"
                    value={newTelegramId}
                    onChange={e => setNewTelegramId(e.target.value)}
                    className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs font-mono font-bold focus:outline-none focus:border-[#d22027]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-600 mb-1">Email Staf</label>
                <input
                  type="email"
                  placeholder="budi@gmail.com"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-[#d22027]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-600 mb-1">Divisi / Role *</label>
                  <select
                    value={newStaffRole}
                    onChange={e => setNewStaffRole(e.target.value)}
                    className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs font-bold focus:outline-none cursor-pointer focus:border-[#d22027]"
                  >
                    {ROLE_OPTIONS.map(group => (
                      <optgroup key={group.group} label={group.group}>
                        {group.options.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <p className="text-[10px] text-neutral-400 mt-0.5">
                    ID: <strong className="text-black font-mono">{generateNextStaffId(newStaffRole)}</strong>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-600 mb-1">PIN Akses *</label>
                  <input
                    type="password"
                    maxLength={6}
                    required
                    placeholder="Min 4 digit angka"
                    value={newStaffPin}
                    onChange={e => setNewStaffPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs font-mono font-bold focus:outline-none focus:border-[#d22027]"
                  />
                </div>
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold rounded-2xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-[#d22027] hover:bg-red-700 text-white text-xs font-black rounded-2xl transition cursor-pointer shadow-md disabled:opacity-50"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Karyawan'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* 🌟 MODAL EDIT KARYAWAN (Dirennder lewat Portal) */}
      {editingStaff && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-neutral-200 space-y-4 text-left my-8 animate-card-pop">
            <div className="flex justify-between items-center pb-3 border-b border-neutral-100">
              <h3 className="font-black text-base text-[#111111]">✏️ Edit Data Staf ({editingStaff.staff_id})</h3>
              <button onClick={() => setEditingStaff(null)} className="text-neutral-400 hover:text-black font-bold text-sm cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateStaff} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-600 mb-1">Nama Depan</label>
                  <input
                    type="text"
                    value={editingStaff.first_name || ''}
                    onChange={e => setEditingStaff({ ...editingStaff, first_name: e.target.value })}
                    className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-[#d22027]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-600 mb-1">Nama Belakang</label>
                  <input
                    type="text"
                    value={editingStaff.last_name || ''}
                    onChange={e => setEditingStaff({ ...editingStaff, last_name: e.target.value })}
                    className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-[#d22027]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-600 mb-1">Nama Panggilan Roster</label>
                <input
                  type="text"
                  value={editingStaff.staff_name || ''}
                  onChange={e => setEditingStaff({ ...editingStaff, staff_name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-[#d22027]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-600 mb-1">No HP / WhatsApp</label>
                  <input
                    type="text"
                    value={editingStaff.phone_number || ''}
                    onChange={e => setEditingStaff({ ...editingStaff, phone_number: e.target.value })}
                    className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-[#d22027]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-600 mb-1">Telegram Chat ID</label>
                  <input
                    type="text"
                    value={editingStaff.telegram_chat_id || ''}
                    onChange={e => setEditingStaff({ ...editingStaff, telegram_chat_id: e.target.value })}
                    className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs font-mono font-bold focus:outline-none focus:border-[#d22027]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-600 mb-1">Email</label>
                <input
                  type="email"
                  value={editingStaff.email || ''}
                  onChange={e => setEditingStaff({ ...editingStaff, email: e.target.value })}
                  className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-[#d22027]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-600 mb-1">Divisi / Role *</label>
                <select
                  value={(editingStaff.role || '').toLowerCase()}
                  onChange={e => setEditingStaff({ ...editingStaff, role: e.target.value })}
                  className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs font-bold focus:outline-none cursor-pointer focus:border-[#d22027]"
                >
                  {ROLE_OPTIONS.map(group => (
                    <optgroup key={group.group} label={group.group}>
                      {group.options.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="flex-1 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold rounded-2xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-[#d22027] hover:bg-red-700 text-white text-xs font-black rounded-2xl transition cursor-pointer shadow-md disabled:opacity-50"
                >
                  {saving ? 'Menyimpan...' : 'Update Staf'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}