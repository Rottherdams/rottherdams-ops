import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface CurrentUser {
  name: string;
  role: string;
  staff_id: string;
  avatar_url?: string;
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

  // 🌟 STATE ANIMASI OUT MODAL EDIT PROFIL
  const [isClosingModal, setIsClosingModal] = useState(false);

  // --- STATE MODAL CROP FOTO ---
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (isOpen && currentUser.staff_id) {
      setIsClosingModal(false);
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

  // 🌟 FUNGSI PENUTUP MODAL DENGAN ANIMASI OUT
  const handleCloseModal = () => {
    setIsClosingModal(true);
    setTimeout(() => {
      onClose();
      setIsClosingModal(false);
    }, 200); // Sesuai durasi animasi out CSS (200ms)
  };

  // 1. PILIH FILE FOTO (VALIDASI JPG/PNG & MAX 5MB)
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      alert('Format file tidak didukung! Harap pilih gambar bertipe JPG atau PNG.');
      e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Ukuran foto terlalu besar! Maksimal 5MB.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result as string);
      setZoom(1);
      setPan({ x: 0, y: 0 });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // 2. PROSES CROP & UPLOAD FOTO KE SUPABASE STORAGE
  const handleCropAndUpload = async () => {
    if (!cropImageSrc || !imageRef.current) return;

    setUploadingImage(true);

    try {
      const img = imageRef.current;
      const canvas = document.createElement('canvas');
      const size = 400; 
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      if (!ctx) throw new Error('Gagal memproses gambar');

      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);

      const containerSize = 256;
      const scaleFactor = size / containerSize;

      const aspect = img.naturalWidth / img.naturalHeight;
      let baseWidth = containerSize;
      let baseHeight = containerSize;

      if (aspect > 1) {
        baseHeight = containerSize / aspect;
      } else {
        baseWidth = containerSize * aspect;
      }

      const drawWidth = baseWidth * zoom * scaleFactor;
      const drawHeight = baseHeight * zoom * scaleFactor;

      const drawX = (size - drawWidth) / 2 + pan.x * scaleFactor;
      const drawY = (size - drawHeight) / 2 + pan.y * scaleFactor;

      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png', 0.95)
      );

      if (!blob) throw new Error('Gagal memproses crop gambar');

      const fileName = `${currentUser.staff_id}_${Date.now()}.png`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, { upsert: true, contentType: 'image/png' });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      if (publicUrlData?.publicUrl) {
        setAvatarUrl(publicUrlData.publicUrl);
        setCropImageSrc(null);
      }
    } catch (err: any) {
      alert('Gagal mengunggah foto: ' + (err.message || 'Pastikan bucket "avatars" sudah publik.'));
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

    const updateData: any = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      staff_name: displayName,
      phone_number: phoneNumber.trim(),
      email: email.trim(),
      telegram_chat_id: telegramChatId.trim(),
      avatar_url: avatarUrl.trim(),
    };

    if (pin) {
      updateData.pin = pin.trim();
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

      localStorage.setItem('rottherdams_user', JSON.stringify(updatedUser));
      onUpdateSuccess(updatedUser);
      alert('Profil & PIN berhasil diperbarui!');
      handleCloseModal();
    }
  };

  return (
    <div
      onClick={handleCloseModal}
      className={`fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto ${
        isClosingModal ? 'modal-backdrop-out' : 'modal-backdrop-in'
      }`}
    >
      {/* 🌟 KEYFRAMES ANIMASI MODAL IN & OUT */}
      <style>{`
        @keyframes modalOverlayIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes modalOverlayOut {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes modalBoxIn {
          0% {
            opacity: 0;
            transform: scale(0.92) translateY(10px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        @keyframes modalBoxOut {
          0% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
          100% {
            opacity: 0;
            transform: scale(0.92) translateY(10px);
          }
        }

        .modal-backdrop-in {
          animation: modalOverlayIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .modal-backdrop-out {
          animation: modalOverlayOut 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .modal-box-in {
          animation: modalBoxIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .modal-box-out {
          animation: modalBoxOut 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      <div
        onClick={e => e.stopPropagation()}
        className={`bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-neutral-100 text-left my-8 space-y-4 ${
          isClosingModal ? 'modal-box-out' : 'modal-box-in'
        }`}
      >
        {/* Header Modal */}
        <div className="flex justify-between items-center pb-3 border-b border-neutral-100">
          <div>
            <h3 className="text-base font-black text-[#111111]">Pengaturan Profil Saya</h3>
            <p className="text-[11px] text-neutral-400 font-mono uppercase mt-0.5">
              ID: {currentUser.staff_id} • <span className="font-bold text-neutral-700 capitalize">{currentUser.role.replace(/_/g, ' ')}</span>
            </p>
          </div>
          <button
            onClick={handleCloseModal}
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
                  accept="image/png, image/jpeg, image/jpg"
                  onChange={handleFileSelect}
                  disabled={uploadingImage}
                  className="hidden"
                />
              </label>
              <p className="text-[9px] text-neutral-400">Format: JPG, PNG (Maks 5MB)</p>
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
              <label className="block text-[11px] font-bold text-neutral-400 mb-1">
                Telegram Chat ID <span className="text-[9px] font-normal italic">(Belum Tersedia)</span>
              </label>
              <input
                type="text"
                disabled
                value={telegramChatId}
                placeholder="ID Chat Telegram"
                className="w-full px-3.5 py-2 bg-neutral-100 border border-neutral-200 rounded-xl text-xs font-mono font-bold text-neutral-400 cursor-not-allowed select-none"
              />
            </div>
          </div>

          {/* BANNER CONNECT TELEGRAM BOT */}
          <div className="p-3 bg-neutral-100 border border-neutral-200 rounded-2xl flex items-center justify-between gap-2 opacity-75">
            <div>
              <p className="text-xs font-bold text-neutral-500">🤖 Telegram Notification</p>
              <p className="text-[10px] text-neutral-400 mt-0.5">
                Fitur notifikasi Telegram belum tersedia
              </p>
            </div>
            <button
              type="button"
              disabled
              className="px-3 py-1.5 bg-neutral-300 text-neutral-500 rounded-xl text-[11px] font-bold cursor-not-allowed whitespace-nowrap shadow-none"
            >
              Belum Tersedia 🔒
            </button>
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
              onClick={handleCloseModal}
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

      {/* ✂️ MODAL CROP FOTO PROFIL INTERAKTIF */}
      {cropImageSrc && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-60 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 space-y-4 text-center shadow-2xl">
            <div>
              <h4 className="text-sm font-black text-[#111111]">Sesuaikan & Crop Foto</h4>
              <p className="text-[11px] text-neutral-400">Geser atau zoom agar posisi foto pas di lingkaran</p>
            </div>

            {/* AREA CANVAS CROP LINGKARAN */}
            <div
              className="relative w-64 h-64 mx-auto rounded-full overflow-hidden border-4 border-[#d22027] bg-neutral-900 cursor-grab active:cursor-grabbing select-none flex items-center justify-center"
              onMouseDown={(e) => {
                setIsDragging(true);
                setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
              }}
              onMouseMove={(e) => {
                if (!isDragging) return;
                setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
              }}
              onMouseUp={() => setIsDragging(false)}
              onMouseLeave={() => setIsDragging(false)}
              onTouchStart={(e) => {
                setIsDragging(true);
                setDragStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y });
              }}
              onTouchMove={(e) => {
                if (!isDragging) return;
                setPan({ x: e.touches[0].clientX - dragStart.x, y: e.touches[0].clientY - dragStart.y });
              }}
              onTouchEnd={() => setIsDragging(false)}
            >
              <img
                ref={imageRef}
                src={cropImageSrc}
                alt="Crop preview"
                className="max-w-none max-h-none pointer-events-none transition-transform duration-75"
                style={{
                  height: '100%',
                  width: 'auto',
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                }}
              />
            </div>

            {/* SLIDER ZOOM */}
            <div className="space-y-1 px-4">
              <div className="flex justify-between items-center text-[10px] font-bold text-neutral-500">
                <span>Zoom Out</span>
                <span>Zoom In</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full accent-[#d22027]"
              />
            </div>

            {/* ACTION BUTTONS CROP */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCropImageSrc(null)}
                className="flex-1 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCropAndUpload}
                disabled={uploadingImage}
                className="flex-1 py-2 bg-[#d22027] hover:bg-[#bb2026] text-white rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
              >
                {uploadingImage ? 'Mengunggah...' : 'Simpan Foto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}