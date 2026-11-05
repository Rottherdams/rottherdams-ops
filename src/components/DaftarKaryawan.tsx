import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface StaffItem {
  staff_id: string;
  staff_name: string;
  role: string;
  status: 'Aktif' | 'Cuti' | 'Resign' | 'Izin';
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

export default function DaftarKaryawan() {
  const [staffList, setStaffList] = useState<StaffItem[]>(INITIAL_STAFF);
  const [loading, setLoading] = useState<boolean>(false);

  // State Pengurutan (Default berdasarkan staff_id Ascending)
  const [sortBy, setSortBy] = useState<SortField>('staff_id');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('staff')
      .select('staff_id, staff_name, role, status');

    setLoading(false);

    if (!error && data && data.length > 0) {
      setStaffList(data as StaffItem[]);
    }
  };

  const handleStatusChange = async (staff_id: string, newStatus: StaffItem['status']) => {
    setStaffList(prev =>
      prev.map(item => (item.staff_id === staff_id ? { ...item, status: newStatus } : item))
    );

    const { error } = await supabase
      .from('staff')
      .update({ status: newStatus })
      .eq('staff_id', staff_id);

    if (error) {
      alert('Gagal mengedit status karyawan: ' + error.message);
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

  // Proses Sorting Data Karyawan
  const sortedStaffList = [...staffList].sort((a, b) => {
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
    <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-neutral-100 text-left">
      {/* Header & Control Sorting */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-black text-[#111111]">Daftar & Status Karyawan Rottherdams</h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Kelola status aktif, cuti, izin, atau karyawan resign.
          </p>
        </div>

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
                  <td className="p-3.5">
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}