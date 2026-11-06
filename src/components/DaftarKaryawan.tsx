import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface CurrentUser {
  name: string;
  role: 'management' | 'kasir' | 'bar' | 'dapur' | 'owner' | string;
  staff_id: string;
}

interface StaffItem {
  id?: number;
  staff_id: string;
  staff_name: string;
  role: string;
  status: 'Aktif' | 'Cuti' | 'Resign' | 'Izin' | string;
  pin_code?: string;
}

interface DaftarKaryawanProps {
  currentUser?: CurrentUser;
}

type SortField = 'staff_id' | 'staff_name' | 'role' | 'status';
type SortOrder = 'asc' | 'desc';

// Fungsi pembantu untuk menentukan bobot urutan ID default (OWN -> MNG -> STF)
const getSortPriority = (id: string) => {
  if (id.startsWith('OWN-')) return 1;
  if (id.startsWith('MNG-')) return 2;
  return 3;
};

const INITIAL_STAFF: StaffItem[] = [
  { staff_id: 'OWN-001', staff_name: 'Iqbal', role: 'owner', status: 'Aktif' },
  { staff_id: 'OWN-002', staff_name: 'Gilang', role: 'owner', status: 'Aktif' },
  { staff_id: 'MNG-001', staff_name: 'Renal', role: 'management', status: 'Aktif' },
  { staff_id: 'STF-001', staff_name: 'Yusuf', role: 'Dapur', status: 'Aktif' },
  { staff_id: 'STF-002', staff_name: 'Indah', role: 'Dapur', status: 'Aktif' },
  { staff_id: 'STF-003', staff_name: 'Tika', role: 'Dapur', status: 'Aktif' },
  { staff_id: 'STF-004', staff_name: 'Rico', role: 'Bar & Server', status: 'Aktif' },
  { staff_id: 'STF-005', staff_name: 'Jamil', role: 'Bar & Server', status: 'Aktif' },
  { staff_id: 'STF-006', staff_name: 'Opang', role: 'Bar & Server', status: 'Aktif' },
  { staff_id: 'STF-007', staff_name: 'Alya', role: 'Kasir', status: 'Resign' },
  { staff_id: 'STF-008', staff_name: 'Firda', role: 'Kasir', status: 'Resign' },
  { staff_id: 'STF-009', staff_name: 'Cece', role: 'Kasir', status: 'Aktif' },
];

export default function DaftarKaryawan({ currentUser }: DaftarKaryawanProps) {
  const [staffList, setStaffList] = useState<StaffItem[]>(INITIAL_STAFF);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');

  // State Pengurutan
  const [sortBy, setSortBy] = useState<SortField>('staff_id');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // State Modal Tambah Karyawan Baru
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'bar' | 'dapur' | 'kasir' | 'management' | 'owner'>('bar');
  const [newStaffPin, setNewStaffPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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

  const fetchStaff = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('staff')
      .select('*');

    setLoading(false);

    if (!error && data && data.length > 0) {
      const normalizedData = data.map((item: any) => ({
        ...item,
        staff_name: item.staff_name || item.name || '',
      }));
      setStaffList(normalizedData as StaffItem[]);
    }
  };

  // Auto Generate ID Staf Berikutnya
  const generateNextStaffId = (role: string) => {
    let prefix = 'STF-';
    if (role === 'management') prefix = 'MNG-';
    if (role === 'owner') prefix = 'OWN-';

    const samePrefixStaff = staffList.filter(s => (s.staff_id || '').startsWith(prefix));
    const nextNum = samePrefixStaff.length + 1;
    return `${prefix}${String(nextNum).padStart(3, '0')}`;
  };

  // Tambah Karyawan Baru ke Supabase
  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim() || !newStaffPin.trim()) {
      setErrorMsg('Nama dan PIN wajib diisi!');
      return;
    }

    if (newStaffPin.length < 4) {
      setErrorMsg('PIN minimal 4 digit angka!');
      return;
    }

    setSaving(true);
    setErrorMsg('');

    const generatedId = generateNextStaffId(newStaffRole);

    const { error } = await supabase.from('staff').insert([
      {
        staff_id: generatedId,
        staff_name: newStaffName.trim(),
        name: newStaffName.trim(),
        role: newStaffRole,
        status: 'Aktif',
        pin_code: newStaffPin.trim(),
      },
    ]);

    if (error) {
      setErrorMsg(`Gagal menambah karyawan: ${error.message}`);
    } else {
      setIsAddModalOpen(false);
      setNewStaffName('');
      setNewStaffPin('');
      setNewStaffRole('bar');
      fetchStaff();
    }
    setSaving(false);
  };

  // 🚀 UBAH STATUS KARYAWAN & AUTO-UPDATE PIN (xxxx jika Resign, 0000 jika Kembali Aktif)
  const handleStatusChange = async (staff_id: string, newStatus: StaffItem['status']) => {
    let updatedFields: { status: string; pin_code?: string } = { status: newStatus };

    if (newStatus === 'Resign') {
      updatedFields.pin_code = 'xxxx';
    } else if (newStatus === 'Aktif') {
      updatedFields.pin_code = '0000';
    }

    setStaffList(prev =>
      prev.map(item =>
        item.staff_id === staff_id
          ? {
              ...item,
              status: newStatus,
              ...(updatedFields.pin_code && { pin_code: updatedFields.pin_code }),
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

  // Reset PIN Manual oleh Management
  const handleResetPin = async (staff_id: string, staff_name: string) => {
    const newPin = prompt(`Masukkan PIN baru untuk ${staff_name}:`);
    if (!newPin || newPin.trim().length < 4) {
      alert('Reset PIN dibatalkan atau kurang dari 4 digit.');
      return;
    }

    const { error } = await supabase
      .from('staff')
      .update({ pin_code: newPin.trim() })
      .eq('staff_id', staff_id);

    if (error) {
      alert(`Gagal mereset PIN: ${error.message}`);
    } else {
      alert(`✅ PIN ${staff_name} berhasil diperbarui menjadi ${newPin.trim()}!`);
      fetchStaff();
    }
  };

  // Toggle arah / ubah kolom pengurutan
  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  // Filter Data Berdasarkan Pencarian
  const filteredStaffList = staffList.filter(s => 
    (s.staff_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.staff_id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.role || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Proses Sorting Data Karyawan
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

  const activeCount = staffList.filter(s => s.status === 'Aktif').length;
  const resignCount = staffList.filter(s => s.status === 'Resign').length;

  return (
    <div className="space-y-6 text-left">
      {/* CARD RINGKASAN SDM */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-neutral-100 shadow-sm">
          <span className="text-2xl">👥</span>
          <p className="text-2xl font-black text-[#111111] mt-1">{staffList.length}</p>
          <p className="text-xs font-bold text-neutral-400">Total Karyawan</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-neutral-100 shadow-sm">
          <span className="text-2xl">🟢</span>
          <p className="text-2xl font-black text-emerald-600 mt-1">{activeCount}</p>
          <p className="text-xs font-bold text-neutral-400">Status Aktif</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-neutral-100 shadow-sm col-span-2 sm:col-span-1">
          <span className="text-2xl">🔴</span>
          <p className="text-2xl font-black text-red-600 mt-1">{resignCount}</p>
          <p className="text-xs font-bold text-neutral-400">Resign / Non-Aktif</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-neutral-100">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-neutral-100">
          <div>
            <h2 className="text-xl font-black text-[#111111]">Daftar & Status Karyawan Rottherdams</h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Kelola status aktif, cuti, izin, PIN, atau pendaftaran karyawan baru.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap w-full sm:w-auto">
            {/* Control Option Sorting Dropdown */}
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

            {/* Tombol Tambah Karyawan Baru */}
            {isManagementOrOwner && (
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="px-4 py-2 bg-[#d22027] hover:bg-red-700 text-white rounded-2xl text-xs font-black transition cursor-pointer shadow-sm active:scale-95 flex items-center gap-1.5"
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
            placeholder="Cari Nama / ID / Divisi Staf..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full sm:w-72 px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:outline-none focus:border-[#d22027]"
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
                  <th
                    onClick={() => handleSort('staff_id')}
                    className="p-3.5 rounded-l-xl cursor-pointer hover:bg-neutral-800 transition select-none"
                  >
                    ID Staf {sortBy === 'staff_id' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  <th
                    onClick={() => handleSort('staff_name')}
                    className="p-3.5 cursor-pointer hover:bg-neutral-800 transition select-none"
                  >
                    Nama Staf {sortBy === 'staff_name' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  <th
                    onClick={() => handleSort('role')}
                    className="p-3.5 cursor-pointer hover:bg-neutral-800 transition select-none"
                  >
                    Divisi {sortBy === 'role' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  <th
                    onClick={() => handleSort('status')}
                    className="p-3.5 cursor-pointer hover:bg-neutral-800 transition select-none"
                  >
                    Status Pegawai {sortBy === 'status' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="p-3.5 rounded-r-xl">Aksi Ubah Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {sortedStaffList.map(staff => (
                  <tr key={staff.staff_id} className="hover:bg-neutral-50 transition">
                    <td className="p-3.5 font-mono text-neutral-400 font-bold">{staff.staff_id}</td>
                    <td className="p-3.5 font-bold text-[#111111]">{staff.staff_name}</td>
                    <td className="p-3.5 text-neutral-500 capitalize">{staff.role}</td>
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
                    <td className="p-3.5 flex items-center gap-2">
                      <select
                        value={staff.status}
                        onChange={e =>
                          handleStatusChange(staff.staff_id, e.target.value as StaffItem['status'])
                        }
                        className="bg-neutral-50 border border-neutral-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-neutral-700 focus:outline-none focus:border-[#d22027] cursor-pointer"
                      >
                        <option value="Aktif">🟢 Aktif</option>
                        <option value="Cuti">🟡 Cuti</option>
                        <option value="Izin">🔵 Izin</option>
                        <option value="Resign">🔴 Resign</option>
                      </select>

                      {isManagementOrOwner && (
                        <button
                          onClick={() => handleResetPin(staff.staff_id, staff.staff_name)}
                          title="Reset PIN Staf"
                          className="px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          🔑 PIN
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL TAMBAH KARYAWAN */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 space-y-4 text-left">
            <div className="flex justify-between items-center pb-3 border-b border-neutral-100">
              <h3 className="font-black text-base text-[#111111]">➕ Tambah Karyawan Baru</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-neutral-400 hover:text-black font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-2xl text-xs font-bold">
                ⚠️ {errorMsg}
              </div>
            )}

            <form onSubmit={handleAddStaff} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-600 mb-1">Nama Lengkap Staf</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Budi Santoso"
                  value={newStaffName}
                  onChange={e => setNewStaffName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-[#d22027]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-600 mb-1">Divisi / Role</label>
                <select
                  value={newStaffRole}
                  onChange={e => setNewStaffRole(e.target.value as any)}
                  className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs font-bold focus:outline-none cursor-pointer"
                >
                  <option value="bar">Bar & Server</option>
                  <option value="dapur">Dapur</option>
                  <option value="kasir">Kasir</option>
                  <option value="management">Management</option>
                  <option value="owner">Owner</option>
                </select>
                <p className="text-[10px] text-neutral-400 mt-1">
                  Auto ID Staf: <strong className="text-black font-mono">{generateNextStaffId(newStaffRole)}</strong>
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-600 mb-1">PIN Akses (Minimal 4 Digit)</label>
                <input
                  type="password"
                  maxLength={6}
                  required
                  placeholder="Masukkan 4-6 digit angka"
                  value={newStaffPin}
                  onChange={e => setNewStaffPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs font-mono font-bold focus:outline-none focus:border-[#d22027]"
                />
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
        </div>
      )}
    </div>
  );
}