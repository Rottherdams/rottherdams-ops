import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { sendTelegramAlert } from '../lib/telegram';
import StaffSummaryCards from './staff/StaffSummaryCards';
import StaffFormModal from './staff/StaffFormModal';
import type { StaffItem } from './staff/StaffFormModal';

import { getSortPriority, generateNextStaffId, checkIsManagement } from '../utils/staffHelpers';

interface CurrentUser {
  name: string;
  role: string;
  staff_id: string;
}

interface DaftarKaryawanProps {
  currentUser?: CurrentUser;
}

type SortField = 'staff_id' | 'staff_name' | 'role' | 'status';
type SortOrder = 'asc' | 'desc';

export default function DaftarKaryawan({ currentUser }: DaftarKaryawanProps) {
  const [staffList, setStaffList] = useState<StaffItem[]>([]);
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

  const [animatedTotal, setAnimatedTotal] = useState(0);
  const [animatedActive, setAnimatedActive] = useState(0);
  const [animatedResign, setAnimatedResign] = useState(0);

  const [showCard2, setShowCard2] = useState(false);
  const [showCard3, setShowCard3] = useState(false);

  const isManagementOrOwner = !currentUser || checkIsManagement(currentUser.role, currentUser.staff_id);

  useEffect(() => {
    fetchStaff();
  }, []);

  const totalTarget = staffList.length;
  const activeTarget = staffList.filter(s => s.status === 'Aktif').length;
  const resignTarget = staffList.filter(s => s.status === 'Resign').length;

  useEffect(() => {
    if (loading || totalTarget === 0) return;

    setAnimatedTotal(0);
    setAnimatedActive(totalTarget);
    setAnimatedResign(0);
    setShowCard2(false);
    setShowCard3(false);

    let start1: number | null = null;
    const duration1 = 400;

    const animateTotal = (ts: number) => {
      if (!start1) start1 = ts;
      const progress = Math.min((ts - start1) / duration1, 1);
      setAnimatedTotal(Math.floor(progress * totalTarget));

      if (progress < 1) {
        requestAnimationFrame(animateTotal);
      } else {
        setAnimatedTotal(totalTarget);
        setShowCard2(true);
        setAnimatedActive(activeTarget);
        setShowCard3(true);
        setAnimatedResign(resignTarget);
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
    setErrorMsg('');
  };

  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
    resetForm();
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFirstName.trim() || !newStaffPin.trim()) {
      setErrorMsg('Nama Depan dan PIN wajib diisi!');
      return;
    }

    setSaving(true);
    setErrorMsg('');

    const generatedId = generateNextStaffId(newStaffRole, staffList);
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
      sendTelegramAlert({
        title: '🆕 STAF BARU DIDAFTARKAN',
        actor: currentUser ? `${currentUser.name} (${currentUser.staff_id})` : 'Management',
        details: {
          'ID Staf': generatedId,
          'Nama': displayName,
          'Divisi': newStaffRole.replace(/_/g, ' ').toUpperCase(),
          'No. HP': newPhoneNumber.trim() || '-',
        },
      });
      handleCloseAddModal();
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
      sendTelegramAlert({
        title: '✏️ DATA KARYAWAN DIPERBARUI',
        actor: currentUser ? `${currentUser.name} (${currentUser.staff_id})` : 'Management',
        details: {
          'ID Staf': editingStaff.staff_id,
          'Nama': displayName,
          'Divisi': editingStaff.role.replace(/_/g, ' ').toUpperCase(),
          'No. HP': editingStaff.phone_number || '-',
        },
      });
      setEditingStaff(null);
      fetchStaff();
    }
    setSaving(false);
  };

  const handleStatusChange = async (staff_id: string, newStatus: StaffItem['status']) => {
    let updatedFields: { status: string; pin?: string } = { status: newStatus };

    if (newStatus === 'Resign') {
      updatedFields.pin = 'xxxx';
    } else if (newStatus === 'Aktif') {
      updatedFields.pin = '0000';
    }

    const targetStaff = staffList.find(s => s.staff_id === staff_id);

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
      sendTelegramAlert({
        title: '🔄 PERUBAHAN STATUS KARYAWAN',
        actor: currentUser ? `${currentUser.name} (${currentUser.staff_id})` : 'Management',
        details: {
          'Staf': targetStaff ? `${targetStaff.staff_name} (${staff_id})` : staff_id,
          'Status Baru': newStatus,
        },
      });
    }
  };

  const handleResetPin = async (staff_id: string, staff_name: string) => {
    const newPin = prompt(`Masukkan PIN baru untuk ${staff_name}:`);
    if (!newPin || newPin.trim().length < 4) return;

    const { error } = await supabase
      .from('staff')
      .update({ pin: newPin.trim() })
      .eq('staff_id', staff_id);

    if (!error) {
      sendTelegramAlert({
        title: '🔑 RESET PIN STAF',
        actor: currentUser ? `${currentUser.name} (${currentUser.staff_id})` : 'Management',
        details: {
          'Staf': `${staff_name} (${staff_id})`,
          'Status': 'PIN berhasil di-reset',
        },
      });
      alert(`✅ PIN ${staff_name} diperbarui!`);
      fetchStaff();
    }
  };

  const filteredStaffList = staffList.filter(s => 
    (s.staff_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.first_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.staff_id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
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
    <div className="space-y-4 sm:space-y-6 text-left">
      <StaffSummaryCards
        animatedTotal={animatedTotal}
        animatedActive={animatedActive}
        animatedResign={animatedResign}
        showCard2={showCard2}
        showCard3={showCard3}
      />

      <div className="bg-white rounded-3xl p-4 sm:p-6 md:p-8 shadow-sm border border-neutral-100">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-3 mb-5 pb-4 border-b border-neutral-100">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-[#111111]">Daftar Karyawan Rottherdams</h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Kelola data diri, kontak WA, PIN, dan status staf.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto">
            <div className="flex items-center gap-1.5 bg-neutral-50 p-1.5 rounded-2xl border border-neutral-200 justify-between sm:justify-start">
              <span className="text-[10px] font-bold text-neutral-500 pl-1">Urutan:</span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortField)}
                className="bg-white px-2.5 py-1 rounded-xl border border-neutral-200 text-xs font-bold text-[#111111] focus:outline-none cursor-pointer"
              >
                <option value="staff_id">ID Staf</option>
                <option value="staff_name">Nama</option>
                <option value="role">Divisi</option>
                <option value="status">Status</option>
              </select>

              <button
                onClick={() => setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
                className="px-2 py-1 bg-white rounded-xl border border-neutral-200 text-xs font-bold cursor-pointer"
              >
                {sortOrder === 'asc' ? '⬆️ Asc' : '⬇️ Desc'}
              </button>
            </div>

            {isManagementOrOwner && (
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="px-4 py-2 bg-[#d22027] hover:bg-red-700 text-white rounded-2xl text-xs font-black transition cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
              >
                <span>➕</span> Tambah Staf Baru
              </button>
            )}
          </div>
        </div>

        <div className="mb-4">
          <input
            type="text"
            placeholder="Cari Nama / HP / ID / Divisi Staf..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full sm:w-80 px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:outline-none focus:border-[#d22027]"
          />
        </div>

        {loading ? (
          <p className="text-xs text-neutral-400 font-bold py-6 text-center animate-pulse">
            Memuat data karyawan...
          </p>
        ) : (
          <div>
            {/* 🌟 1. MOBIL CARD STACK VIEW (TAMPIL DI HP KECIL) */}
            <div className="block md:hidden space-y-3">
              {sortedStaffList.map(staff => {
                const fullName = staff.first_name 
                  ? `${staff.first_name} ${staff.last_name || ''}`.trim()
                  : staff.staff_name;

                return (
                  <div key={staff.staff_id} className="p-3.5 bg-neutral-50/70 rounded-2xl border border-neutral-200 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2.5">
                        {staff.avatar_url ? (
                          <img src={staff.avatar_url} alt={fullName} className="w-8 h-8 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-neutral-200 text-neutral-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {staff.first_name?.[0] || staff.staff_name[0]}
                          </div>
                        )}
                        <div>
                          <p className="font-extrabold text-xs text-[#111111]">{fullName}</p>
                          <p className="text-[10px] text-neutral-400 font-mono">{staff.staff_id} • {staff.role?.replace('_', ' ')}</p>
                        </div>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${
                          staff.status === 'Aktif'
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                            : staff.status === 'Resign'
                            ? 'bg-red-50 text-red-600 border-red-200'
                            : 'bg-amber-50 text-amber-600 border-amber-200'
                        }`}
                      >
                        {staff.status}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-neutral-200/60 text-xs">
                      <div className="text-[10px] text-neutral-500">
                        {staff.phone_number ? `📱 ${staff.phone_number}` : 'Belum ada No HP'}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <select
                          value={staff.status}
                          onChange={e => handleStatusChange(staff.staff_id, e.target.value as StaffItem['status'])}
                          className="bg-white border border-neutral-200 rounded-lg px-2 py-1 text-[10px] font-bold text-neutral-700"
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
                              className="px-2 py-1 bg-white border border-neutral-200 rounded-lg text-[10px] font-bold"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleResetPin(staff.staff_id, staff.staff_name)}
                              className="px-2 py-1 bg-white border border-neutral-200 rounded-lg text-[10px] font-bold"
                            >
                              🔑
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 🌟 2. TABLE DESKTOP / TABLET VIEW */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#111111] text-white rounded-xl">
                    <th className="p-3.5 rounded-l-xl">ID Staf</th>
                    <th className="p-3.5">Nama Lengkap</th>
                    <th className="p-3.5">Kontak</th>
                    <th className="p-3.5">Divisi</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 rounded-r-xl">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {sortedStaffList.map((staff) => {
                    const fullName = staff.first_name 
                      ? `${staff.first_name} ${staff.last_name || ''}`.trim()
                      : staff.staff_name;

                    return (
                      <tr key={staff.staff_id} className="hover:bg-neutral-50 transition">
                        <td className="p-3.5 font-mono text-neutral-400 font-bold">{staff.staff_id}</td>
                        <td className="p-3.5">
                          <div className="flex items-center gap-2.5">
                            {staff.avatar_url ? (
                              <img src={staff.avatar_url} alt={fullName} className="w-7 h-7 rounded-full object-cover" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-neutral-200 text-neutral-600 flex items-center justify-center font-bold text-[10px]">
                                {staff.first_name?.[0] || staff.staff_name[0]}
                              </div>
                            )}
                            <p className="font-bold text-[#111111]">{fullName}</p>
                          </div>
                        </td>
                        <td className="p-3.5 font-mono text-neutral-600">{staff.phone_number || '-'}</td>
                        <td className="p-3.5 font-semibold capitalize">{staff.role.replace('_', ' ')}</td>
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
                              onChange={e => handleStatusChange(staff.staff_id, e.target.value as StaffItem['status'])}
                              className="bg-neutral-50 border border-neutral-200 rounded-xl px-2 py-1 text-xs font-bold text-neutral-700"
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
                                  className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 rounded-xl text-xs font-bold"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => handleResetPin(staff.staff_id, staff.staff_name)}
                                  className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 rounded-xl text-xs font-bold"
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
          </div>
        )}
      </div>

      <StaffFormModal
        isAddModalOpen={isAddModalOpen}
        onCloseAddModal={handleCloseAddModal}
        editingStaff={editingStaff}
        onCloseEditModal={() => setEditingStaff(null)}
        newFirstName={newFirstName}
        setNewFirstName={setNewFirstName}
        newLastName={newLastName}
        setNewLastName={setNewLastName}
        newStaffName={newStaffName}
        setNewStaffName={setNewStaffName}
        newPhoneNumber={newPhoneNumber}
        setNewPhoneNumber={setNewPhoneNumber}
        newEmail={newEmail}
        setNewEmail={setNewEmail}
        newTelegramId={newTelegramId}
        setNewTelegramId={setNewTelegramId}
        newStaffRole={newStaffRole}
        setNewStaffRole={setNewStaffRole}
        newStaffPin={newStaffPin}
        setNewStaffPin={setNewStaffPin}
        saving={saving}
        errorMsg={errorMsg}
        generatedNextId={generateNextStaffId(newStaffRole, staffList)}
        onAddSubmit={handleAddStaff}
        onUpdateSubmit={handleUpdateStaff}
        setEditingStaff={setEditingStaff}
      />
    </div>
  );
}