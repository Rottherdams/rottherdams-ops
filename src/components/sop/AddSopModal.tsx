import React from 'react';
import { createPortal } from 'react-dom';

interface AddSopModalProps {
  isOpen: boolean;
  isClosing: boolean;
  newTaskName: string;
  newCategory: string;
  newShift: 'morning' | 'night';
  isSubmitting: boolean;
  setNewTaskName: (val: string) => void;
  setNewCategory: (val: string) => void;
  setNewShift: (val: 'morning' | 'night') => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function AddSopModal({
  isOpen,
  isClosing,
  newTaskName,
  newCategory,
  newShift,
  isSubmitting,
  setNewTaskName,
  setNewCategory,
  setNewShift,
  onClose,
  onSubmit,
}: AddSopModalProps) {
  if (!isOpen) return null;

  return createPortal(
    <div
      onClick={onClose}
      className={`fixed inset-0 bg-black/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 ${
        isClosing ? 'modal-backdrop-out' : 'modal-backdrop-in'
      }`}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-neutral-100 text-left my-auto ${
          isClosing ? 'modal-box-out' : 'modal-box-in'
        }`}
      >
        <h3 className="text-base font-black text-[#111111] mb-1">Tambah Tugas SOP Baru</h3>
        <p className="text-xs text-neutral-400 mb-4">Masukkan tugas operasional baru untuk tim.</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-neutral-600 mb-1">Nama Tugas SOP</label>
            <input
              type="text"
              required
              placeholder="Misal: Clean & Descale Grinder"
              value={newTaskName}
              onChange={e => setNewTaskName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:outline-none focus:border-[#d22027]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-neutral-600 mb-1">Kategori / Divisi</label>
              <select
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:outline-none focus:border-[#d22027] cursor-pointer"
              >
                <option value="Bar">Barista / Bar</option>
                <option value="Kasir">Cashier / Floor</option>
                <option value="Kitchen">Kitchen / Cook</option>
                <option value="General">General / Operasional</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-neutral-600 mb-1">Shift Target</label>
              <select
                value={newShift}
                onChange={e => setNewShift(e.target.value as 'morning' | 'night')}
                className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:outline-none focus:border-[#d22027] cursor-pointer"
              >
                <option value="morning">Morning (Opening)</option>
                <option value="night">Night (Closing)</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 bg-[#d22027] hover:bg-[#bb2026] text-white rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Simpan...' : 'Simpan SOP'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}