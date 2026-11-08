import React from 'react';
import { createPortal } from 'react-dom';

export interface StaffItem {
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

export const ROLE_OPTIONS = [
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

interface StaffFormModalProps {
  isAddModalOpen: boolean;
  onCloseAddModal: () => void;
  editingStaff: StaffItem | null;
  onCloseEditModal: () => void;
  
  // State Form Tambah
  newFirstName: string;
  setNewFirstName: (val: string) => void;
  newLastName: string;
  setNewLastName: (val: string) => void;
  newStaffName: string;
  setNewStaffName: (val: string) => void;
  newPhoneNumber: string;
  setNewPhoneNumber: (val: string) => void;
  newEmail: string;
  setNewEmail: (val: string) => void;
  newTelegramId: string;
  setNewTelegramId: (val: string) => void;
  newStaffRole: string;
  setNewStaffRole: (val: string) => void;
  newStaffPin: string;
  setNewStaffPin: (val: string) => void;
  
  // Handlers & State
  saving: boolean;
  errorMsg: string;
  generatedNextId: string;
  onAddSubmit: (e: React.FormEvent) => void;
  onUpdateSubmit: (e: React.FormEvent) => void;
  setEditingStaff: React.Dispatch<React.SetStateAction<StaffItem | null>>;
}

export default function StaffFormModal({
  isAddModalOpen,
  onCloseAddModal,
  editingStaff,
  onCloseEditModal,
  newFirstName,
  setNewFirstName,
  newLastName,
  setNewLastName,
  newStaffName,
  setNewStaffName,
  newPhoneNumber,
  setNewPhoneNumber,
  newEmail,
  setNewEmail,
  newTelegramId,
  setNewTelegramId,
  newStaffRole,
  setNewStaffRole,
  newStaffPin,
  setNewStaffPin,
  saving,
  errorMsg,
  generatedNextId,
  onAddSubmit,
  onUpdateSubmit,
  setEditingStaff,
}: StaffFormModalProps) {
  return (
    <>
      {/* 🌟 MODAL TAMBAH KARYAWAN */}
      {isAddModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-neutral-200 space-y-4 text-left my-8 animate-card-pop">
            <div className="flex justify-between items-center pb-3 border-b border-neutral-100">
              <h3 className="font-black text-base text-[#111111]">➕ Tambah Karyawan Baru</h3>
              <button onClick={onCloseAddModal} className="text-neutral-400 hover:text-black font-bold text-sm cursor-pointer">
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-2xl text-xs font-bold">
                ⚠️ {errorMsg}
              </div>
            )}

            <form onSubmit={onAddSubmit} className="space-y-3">
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
                    ID: <strong className="text-black font-mono">{generatedNextId}</strong>
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
                  onClick={onCloseAddModal}
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

      {/* 🌟 MODAL EDIT KARYAWAN */}
      {editingStaff && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-neutral-200 space-y-4 text-left my-8 animate-card-pop">
            <div className="flex justify-between items-center pb-3 border-b border-neutral-100">
              <h3 className="font-black text-base text-[#111111]">✏️ Edit Data Staf ({editingStaff.staff_id})</h3>
              <button onClick={onCloseEditModal} className="text-neutral-400 hover:text-black font-bold text-sm cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={onUpdateSubmit} className="space-y-3">
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
                  onClick={onCloseEditModal}
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
    </>
  );
}