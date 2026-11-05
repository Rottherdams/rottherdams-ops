import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface CurrentUser {
  name: string;
  role: 'management' | 'kasir' | 'bar' | 'dapur' | 'owner';
  staff_id: string;
}

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: CurrentUser;
  onUpdateSuccess: (updatedUser: CurrentUser) => void;
}

export default function EditProfileModal({
  isOpen,
  onClose,
  currentUser,
  onUpdateSuccess,
}: EditProfileModalProps) {
  const [name, setName] = useState(currentUser.name);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('Nama tidak boleh kosong!');
      return;
    }

    if (pin && pin.length < 4) {
      alert('PIN minimal terdiri dari 4 digit!');
      return;
    }

    if (pin && pin !== confirmPin) {
      alert('Konfirmasi PIN baru tidak cocok!');
      return;
    }

    setLoading(true);

    // Data yang akan di-update di database Supabase
    const updateData: any = { staff_name: name.trim() };
    if (pin) {
      updateData.pin = pin;
    }

    const { error } = await supabase
      .from('staff')
      .update(updateData)
      .eq('staff_id', currentUser.staff_id);

    setLoading(false);

    if (error) {
      alert('Gagal memperbarui profil: ' + error.message);
    } else {
      const updatedUser: CurrentUser = {
        ...currentUser,
        name: name.trim(),
      };

      // Simpan ke localStorage & update state global
      localStorage.setItem('rottherdams_user', JSON.stringify(updatedUser));
      onUpdateSuccess(updatedUser);
      alert('Profil & PIN berhasil diperbarui!');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-neutral-100 text-left">
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-neutral-100">
          <div>
            <h3 className="text-base font-black text-[#111111]">Pengaturan Profil Staf</h3>
            <p className="text-[11px] text-neutral-400 font-mono uppercase mt-0.5">
              ID: {currentUser.staff_id} • {currentUser.role}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 text-sm font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-neutral-600 mb-1">
              Nama Lengkap
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-[#111111] focus:outline-none focus:border-[#d22027]"
            />
          </div>

          <div className="pt-2 border-t border-neutral-100">
            <label className="block text-[11px] font-bold text-neutral-600 mb-1">
              PIN Baru (Opsional)
            </label>
            <input
              type="password"
              placeholder="Biarkan kosong jika tidak diubah"
              value={pin}
              onChange={e => setPin(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:outline-none focus:border-[#d22027]"
            />
          </div>

          {pin && (
            <div>
              <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                Konfirmasi PIN Baru
              </label>
              <input
                type="password"
                placeholder="Ketik ulang PIN baru"
                value={confirmPin}
                onChange={e => setConfirmPin(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:outline-none focus:border-[#d22027]"
              />
            </div>
          )}

          <div className="flex gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-[#d22027] hover:bg-[#bb2026] text-white rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Simpan...' : 'Simpan Profil'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}