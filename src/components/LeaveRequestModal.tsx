import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';

interface CurrentUser {
  staff_id: string;
  name: string;
  role: string;
  avatar_url?: string;
}

interface LeaveRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentUser: CurrentUser | null;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export default function LeaveRequestModal({
  isOpen,
  onClose,
  onSuccess,
  currentUser,
}: LeaveRequestModalProps) {
  const [leaveType, setLeaveType] = useState<'Cuti' | 'Sakit' | 'Izin Unpaid'>('Cuti');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [leaveQuota, setLeaveQuota] = useState<number>(12);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen && currentUser?.staff_id) {
      setIsClosing(false);
      fetchLeaveQuota();
    }
  }, [isOpen, currentUser]);

  const handleAnimatedClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 250);
  };

  const fetchLeaveQuota = async () => {
    if (!currentUser?.staff_id) return;
    const { data } = await supabase
      .from('staff')
      .select('annual_leave_quota')
      .eq('staff_id', currentUser.staff_id)
      .single();

    if (data && data.annual_leave_quota !== undefined && data.annual_leave_quota !== null) {
      setLeaveQuota(data.annual_leave_quota);
    }
  };

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setErrorMessage('');

    if (selectedFile) {
      if (!ALLOWED_TYPES.includes(selectedFile.type)) {
        setErrorMessage('Format file tidak didukung! Gunakan format JPG, PNG, WEBP, atau PDF.');
        e.target.value = '';
        setFile(null);
        return;
      }

      if (selectedFile.size > MAX_FILE_SIZE) {
        setErrorMessage('Ukuran file terlalu besar! Maksimal ukuran file adalah 5 MB.');
        e.target.value = '';
        setFile(null);
        return;
      }

      setFile(selectedFile);
    } else {
      setFile(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setLoading(true);
    setErrorMessage('');

    try {
      let attachmentUrl = null;

      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${currentUser.staff_id}.${fileExt}`;
        const filePath = `leave_attachments/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('leave-attachments')
          .upload(filePath, file);

        if (uploadError) {
          throw new Error(`Gagal upload file: ${uploadError.message}`);
        }

        const { data: publicUrlData } = supabase.storage
          .from('leave-attachments')
          .getPublicUrl(filePath);

        attachmentUrl = publicUrlData.publicUrl;
      }

      const { data: staffData } = await supabase
        .from('staff')
        .select('first_name, last_name, staff_name')
        .eq('staff_id', currentUser.staff_id)
        .single();

      const displayName = staffData?.staff_name || 
        (staffData?.first_name ? `${staffData.first_name} ${staffData.last_name || ''}`.trim() : currentUser.name);

      const { error: insertError } = await supabase
        .from('leave_requests')
        .insert([
          {
            staff_id: currentUser.staff_id,
            staff_name: displayName,
            role: currentUser.role,
            leave_type: leaveType,
            start_date: startDate,
            end_date: endDate,
            reason: reason.trim(),
            status: 'Pending',
            attachment_url: attachmentUrl,
          },
        ]);

      if (insertError) {
        throw new Error(insertError.message);
      }

      setLeaveType('Cuti');
      setStartDate('');
      setEndDate('');
      setReason('');
      setFile(null);

      setIsClosing(true);
      setTimeout(() => {
        onSuccess();
        onClose();
        setIsClosing(false);
      }, 250);
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan saat mengajukan izin.');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 ${
        isClosing ? 'animate-backdrop-out' : 'animate-backdrop-in'
      }`}
    >
      <style>{`
        @keyframes modalBackdropIn { 0% { opacity: 0; } 100% { opacity: 1; } }
        @keyframes modalBackdropOut { 0% { opacity: 1; } 100% { opacity: 0; } }
        @keyframes modalContentIn {
          0% { opacity: 0; transform: scale(0.92) translateY(12px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes modalContentOut {
          0% { opacity: 1; transform: scale(1) translateY(0); }
          100% { opacity: 0; transform: scale(0.95) translateY(8px); }
        }
        .animate-backdrop-in { animation: modalBackdropIn 0.3s ease-out forwards; }
        .animate-backdrop-out { animation: modalBackdropOut 0.25s ease-in forwards; }
        .animate-modal-in { animation: modalContentIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-modal-out { animation: modalContentOut 0.25s ease-in forwards; }
      `}</style>

      <div
        className={`bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-neutral-100 text-left my-auto ${
          isClosing ? 'animate-modal-out' : 'animate-modal-in'
        }`}
      >
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-neutral-100">
          <div>
            <span className="text-[10px] uppercase font-extrabold text-[#d22027] tracking-wider">
              Form Pengajuan Resmi
            </span>
            <h3 className="text-lg font-black text-[#111111]">Pengajuan Cuti / Izin / Sakit</h3>
          </div>
          <button
            onClick={handleAnimatedClose}
            className="w-8 h-8 rounded-full bg-neutral-100 text-neutral-400 font-bold hover:bg-neutral-200 transition cursor-pointer flex items-center justify-center text-xs active:scale-90"
          >
            ✕
          </button>
        </div>

        {/* Info Kuota Cuti */}
        <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-2xl flex justify-between items-center">
          <div>
            <p className="text-[10px] uppercase font-bold text-purple-600">Sisa Kuota Cuti Tahunan</p>
            <p className="text-xs font-black text-purple-900">{currentUser?.name}</p>
            {currentUser?.role && (
              <p className="text-[9px] font-bold text-purple-700 capitalize">
                Divisi: {currentUser.role.replace(/_/g, ' ')}
              </p>
            )}
          </div>
          <span className="text-sm font-black text-purple-700 bg-purple-100 px-3 py-1 rounded-xl">
            {leaveQuota} Hari
          </span>
        </div>

        {errorMessage && (
          <div className="mb-3 rounded-2xl bg-red-50 p-3 text-xs text-red-600 font-bold border border-red-200">
            ⚠️ {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-neutral-700 mb-1">Jenis Pengajuan:</label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value as any)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 font-bold text-neutral-800 focus:outline-none focus:border-[#d22027]"
              required
            >
              <option value="Cuti">🟣 Cuti Resmi Tahunan (Memotong Kuota)</option>
              <option value="Sakit">🔵 Sakit (Memerlukan Surat Dokter)</option>
              <option value="Izin Unpaid">🟡 Izin Unpaid (Tanpa Gaji)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-neutral-700 mb-1">Tanggal Mulai</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 font-medium text-neutral-800 focus:outline-none focus:border-[#d22027]"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-neutral-700 mb-1">Tanggal Selesai</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 font-medium text-neutral-800 focus:outline-none focus:border-[#d22027]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-neutral-700 mb-1">Alasan / Keterangan</label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Berikan alasan singkat..."
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2 font-medium text-neutral-800 focus:outline-none focus:border-[#d22027]"
              required
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block font-bold text-neutral-700">
                Lampiran (Surat Dokter / Bukti)
              </label>
              <span className="text-[10px] font-bold text-neutral-400">Max 5MB</span>
            </div>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              onChange={handleFileChange}
              className="w-full text-xs text-neutral-500 file:mr-3 file:rounded-xl file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-neutral-700 hover:file:bg-neutral-200 cursor-pointer"
            />
            <p className="mt-1 text-[10px] text-neutral-400">
              Format yang didukung: JPG, PNG, WEBP, PDF
            </p>
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={handleAnimatedClose}
              className="flex-1 py-3 bg-neutral-100 text-neutral-600 font-bold rounded-xl hover:bg-neutral-200 transition cursor-pointer text-xs active:scale-95"
              disabled={loading}
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-[#d22027] text-white font-bold rounded-xl hover:bg-[#b81b21] transition cursor-pointer shadow-md disabled:opacity-50 text-xs active:scale-95"
              disabled={loading}
            >
              {loading ? 'Mengirim...' : 'Kirim Pengajuan'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}