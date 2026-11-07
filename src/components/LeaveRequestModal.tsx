import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

interface LeaveRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentUser: {
    id: string;
    name: string;
  };
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export default function LeaveRequestModal({
  isOpen,
  onClose,
  onSuccess,
  currentUser,
}: LeaveRequestModalProps) {
  const [leaveType, setLeaveType] = useState<'Izin' | 'Sakit' | 'Cuti'>('Izin');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setErrorMessage('');

    if (selectedFile) {
      // 1. Validasi Tipe File (MIME Type)
      if (!ALLOWED_TYPES.includes(selectedFile.type)) {
        setErrorMessage('Format file tidak didukung! Gunakan format JPG, PNG, WEBP, atau PDF.');
        e.target.value = '';
        setFile(null);
        return;
      }

      // 2. Validasi Ukuran File (Maksimal 5 MB)
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
    setLoading(true);
    setErrorMessage('');

    try {
      let attachmentUrl = null;

      // 1. Upload lampiran ke Supabase Storage (bucket leave-attachments)
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${currentUser.id}.${fileExt}`;
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

      // 2. Insert data ke tabel leave_requests
      const { error: insertError } = await supabase
        .from('leave_requests')
        .insert([
          {
            staff_id: currentUser.id,
            staff_name: currentUser.name,
            leave_type: leaveType,
            start_date: startDate,
            end_date: endDate,
            reason: reason,
            status: 'pending',
            attachment_url: attachmentUrl,
          },
        ]);

      if (insertError) {
        throw new Error(insertError.message);
      }

      // Reset Form & Trigger Callback Sukses
      setLeaveType('Izin');
      setStartDate('');
      setEndDate('');
      setReason('');
      setFile(null);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan saat mengajukan izin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-lg font-bold text-gray-800">📩 Form Pengajuan Izin / Sakit / Cuti</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 font-semibold text-xl"
          >
            ✕
          </button>
        </div>

        {errorMessage && (
          <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-600 font-medium">
            ⚠️ {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Tipe Pengajuan */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Tipe Pengajuan</label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value as any)}
              className="mt-1 block w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
              required
            >
              <option value="Izin">Izin</option>
              <option value="Sakit">Sakit</option>
              <option value="Cuti">Cuti</option>
            </select>
          </div>

          {/* Tanggal Mulai & Selesai */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Tanggal Mulai</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Tanggal Selesai</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Alasan */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Alasan / Keterangan</label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Berikan alasan singkat..."
              className="mt-1 block w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
              required
            />
          </div>

          {/* Upload Lampiran (Dengan Restriksi Extension & Size) */}
          <div>
            <div className="flex justify-between items-center">
              <label className="block text-sm font-medium text-gray-700">
                Lampiran (Opsional - Surat Dokter / Bukti)
              </label>
              <span className="text-[10px] font-bold text-gray-400">Max 5MB</span>
            </div>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              onChange={handleFileChange}
              className="mt-1 block w-full text-sm text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
            />
            <p className="mt-1 text-[11px] text-gray-400">
              Format yang didukung: JPG, PNG, WEBP, PDF
            </p>
          </div>

          {/* Tombol Akses */}
          <div className="mt-6 flex justify-end space-x-3 border-t pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              disabled={loading}
            >
              Batal
            </button>
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-emerald-300"
              disabled={loading}
            >
              {loading ? 'Mengirim...' : 'Kirim Pengajuan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}