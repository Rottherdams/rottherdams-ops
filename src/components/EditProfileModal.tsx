import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface CurrentUser {
  name: string;
  role: 'management' | 'kasir' | 'bar' | 'dapur' | 'owner' | string;
  staff_id: string;
  avatar_url?: string;
}

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: CurrentUser;
  onUpdateSuccess: (updatedUser: CurrentUser) => void;
}

// 📌 NAMA BOT TELEGRAM KAMU (Ganti sesuai username bot Telegram milikmu)
const TELEGRAM_BOT_USERNAME = 'RottherdamsBot'; 

export default function EditProfileModal({
  isOpen,
  onClose,
  currentUser,
  onUpdateSuccess,
}: EditProfileModalProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [staffName, setStaffName] = useState(currentUser.name);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (isOpen && currentUser.staff_id) {
      fetchStaffDetails();
    }
  }, [isOpen, currentUser]);

  const fetchStaffDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('staff_id', currentUser.staff_id)
        .single();

      if (!error && data) {
        setFirstName(data.first_name || '');
        setLastName(data.last_name || '');
        setStaffName(data.staff_name || data.name || currentUser.name);
        setPhoneNumber(data.phone_number || '');
        setEmail(data.email || '');
        setTelegramChatId(data.telegram_chat_id || '');
        setAvatarUrl(data.avatar_url || '');
      }
    } catch (err) {
      console.error('Error fetching staff profile details:', err);
    }
  };

  // 📷 UPLOAD FOTO KE SUPABASE STORAGE
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Batasi ukuran file max 3MB
    if (file.size > 3 * 1024 * 1024) {
      alert('Ukuran foto terlalu besar! Maksimal 3MB.');
      return;
    }

    setUploadingImage(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUser.staff_id}_${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // 1. Upload file ke Supabase Storage (Bucket 'avatars')
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // 2. Ambil Public URL foto
      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      if (publicUrlData?.publicUrl) {
        setAvatarUrl(publicUrlData.publicUrl);
      }
    } catch (err: any) {
      alert('Gagal mengunggah foto: ' + (err.message || 'Pastikan bucket "avatars" sudah publik di Supabase.'));
    } finally {
      setUploadingImage(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName.trim() && !staffName.trim()) {
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

    const displayName = staffName.trim() || `${firstName.trim()} ${lastName.trim()}`.trim();

    // Data yang akan di-update di database Supabase
    const updateData: any = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      staff_name: displayName,
      name: displayName,
      phone_number: phoneNumber.trim(),
      email: email.trim(),
      telegram_chat_id: telegramChatId.trim(),
      avatar_url: avatarUrl.trim(),
    };

    if (pin) {
      updateData.pin_code = pin.trim();
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
        name: displayName,
        avatar_url: avatarUrl.trim(),
      };

      // Simpan ke localStorage & update state global
      localStorage.setItem('rottherdams_user', JSON.stringify(updatedUser));
      onUpdateSuccess(updatedUser);
      alert('Profil & PIN berhasil diperbarui!');
      onClose();
    }
  };

  const telegramConnectUrl = `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${currentUser.staff_id}`;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-neutral-100 text-left my-8 space-y-4">
        {/* Header Modal */}
        <div className="flex justify-between items-center pb-3 border-b border-neutral-100">
          <div>
            <h3 className="text-base font-black text-[#111111]">Pengaturan Profil Saya</h3>
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
          {/* UPLOAD FOTO PROFIL */}
          <div className="flex items-center gap-4 p-3.5 bg-neutral-50 rounded-2xl border border-neutral-100">
            <div className="relative">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar Profil"
                  className="w-16 h-16 rounded-full object-cover border-2 border-[#d22027] shadow-xs"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-neutral-200 text-neutral-600 flex items-center justify-center font-black text-xl border-2 border-neutral-300">
                  {firstName[0] || staffName[0] || '👤'}
                </div>
              )}
              {uploadingImage && (
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center text-[10px] text-white font-bold animate-pulse">
                  Uploading...
                </div>
              )}
            </div>

            <div className="flex-1 space-y-1">
              <label className="block text-xs font-bold text-[#111111]">Foto Profil</label>
              <label className="inline-block px-3 py-1.5 bg-[#111111] hover:bg-black text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs">
                <span>📷 {uploadingImage ? 'Mengunggah...' : 'Pilih Foto'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={uploadingImage}
                  className="hidden"
                />
              </label>
              <p className="text-[9px] text-neutral-400">Format: JPG, PNG (Maks 3MB)</p>
            </div>
          </div>

          {/* INPUT NAMA DEPAN & BELAKANG */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                Nama Depan *
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="Nama depan"
                className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-[#111111] focus:outline-none focus:border-[#d22027]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                Nama Belakang
              </label>
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Nama belakang"
                className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-[#111111] focus:outline-none focus:border-[#d22027]"
              />
            </div>
          </div>

          {/* NAMA PANGGULAN ROSTER */}
          <div>
            <label className="block text-[11px] font-bold text-neutral-600 mb-1">
              Nama Panggilan (Tampilan Roster)
            </label>
            <input
              type="text"
              value={staffName}
              onChange={e => setStaffName(e.target.value)}
              placeholder="Contoh: Yusuf"
              className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-[#111111] focus:outline-none focus:border-[#d22027]"
            />
          </div>

          {/* KONTAK & TELEGRAM */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                No. WhatsApp / HP
              </label>
              <input
                type="text"
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
                placeholder="08123456789"
                className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-[#111111] focus:outline-none focus:border-[#d22027]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                Telegram Chat ID
              </label>
              <input
                type="text"
                value={telegramChatId}
                onChange={e => setTelegramChatId(e.target.value)}
                placeholder="ID Chat Telegram"
                className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-mono font-bold text-[#111111] focus:outline-none focus:border-[#d22027]"
              />
            </div>
          </div>

          {/* BANNER CONNECT TELEGRAM BOT */}
          <div className="p-3 bg-sky-50 border border-sky-200 rounded-2xl flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-sky-900">🤖 Telegram Notification</p>
              <p className="text-[10px] text-sky-700 mt-0.5">
                {telegramChatId ? '✅ Telegram Terhubung' : 'Belum terhubung ke Bot Telegram'}
              </p>
            </div>
            <a
              href={telegramConnectUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-[11px] font-bold transition shadow-2xs whitespace-nowrap"
            >
              Hubungkan Bot 🚀
            </a>
          </div>

          {/* EMAIL */}
          <div>
            <label className="block text-[11px] font-bold text-neutral-600 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@domain.com"
              className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-[#111111] focus:outline-none focus:border-[#d22027]"
            />
          </div>

          {/* UBAH PIN */}
          <div className="pt-2 border-t border-neutral-100 space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                PIN Baru (Opsional)
              </label>
              <input
                type="password"
                maxLength={6}
                placeholder="Biarkan kosong jika tidak diubah"
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-mono focus:outline-none focus:border-[#d22027]"
              />
            </div>

            {pin && (
              <div>
                <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                  Konfirmasi PIN Baru
                </label>
                <input
                  type="password"
                  maxLength={6}
                  placeholder="Ketik ulang PIN baru"
                  value={confirmPin}
                  onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-mono focus:outline-none focus:border-[#d22027]"
                />
              </div>
            )}
          </div>

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
              disabled={loading || uploadingImage}
              className="flex-1 py-2.5 bg-[#d22027] hover:bg-[#bb2026] text-white rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Menyimpan...' : 'Simpan Profil'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}