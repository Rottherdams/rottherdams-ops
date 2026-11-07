import { supabase } from '../lib/supabase';

export interface LeaveRequestInput {
  staff_id: string;
  staff_name: string;
  leave_type: 'Izin' | 'Sakit' | 'Cuti';
  start_date: string;
  end_date: string;
  reason: string;
  file?: File | null;
}

export interface LeaveRequestRecord extends LeaveRequestInput {
  id: number;
  status: 'pending' | 'approved' | 'rejected' | string;
  created_at: string;
  attachment_url: string | null;
}

/**
 * Mengirimkan pengajuan izin/sakit/cuti baru ke Supabase
 * sekaligus mengunggah berkas lampiran jika ada.
 */
export const createLeaveRequest = async (input: LeaveRequestInput) => {
  let attachmentUrl: string | null = null;

  // 1. Upload berkas ke Supabase Storage (jika ada file)
  if (input.file) {
    const fileExt = input.file.name.split('.').pop();
    const fileName = `${Date.now()}_${input.staff_id}.${fileExt}`;
    const filePath = `leave_attachments/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('leave-attachments')
      .upload(filePath, input.file);

    if (uploadError) {
      throw new Error(`Gagal mengunggah lampiran: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from('leave-attachments')
      .getPublicUrl(filePath);

    attachmentUrl = publicUrlData.publicUrl;
  }

  // 2. Insert record ke tabel leave_requests
  const { data, error } = await supabase
    .from('leave_requests')
    .insert([
      {
        staff_id: String(input.staff_id),
        staff_name: input.staff_name,
        leave_type: input.leave_type,
        start_date: input.start_date,
        end_date: input.end_date,
        reason: input.reason,
        status: 'pending',
        attachment_url: attachmentUrl,
      },
    ])
    .select();

  if (error) {
    throw new Error(`Gagal menyimpan pengajuan: ${error.message}`);
  }

  return data[0];
};

/**
 * Mengambil daftar riwayat pengajuan izin berdasarkan staff_id
 */
export const getLeaveRequestsByStaff = async (staffId: string) => {
  const { data, error } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('staff_id', String(staffId))
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Gagal mengambil data pengajuan: ${error.message}`);
  }

  return data as LeaveRequestRecord[];
};

/**
 * Mengambil semua daftar pengajuan izin (khusus Manajemen / Owner)
 */
export const getAllLeaveRequests = async () => {
  const { data, error } = await supabase
    .from('leave_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Gagal mengambil data pengajuan: ${error.message}`);
  }

  return data as LeaveRequestRecord[];
};

/**
 * Memperbarui status pengajuan (Approved / Rejected) oleh Manajemen
 */
export const updateLeaveStatus = async (
  requestId: number,
  status: 'approved' | 'rejected'
) => {
  const { data, error } = await supabase
    .from('leave_requests')
    .update({ status })
    .eq('id', requestId)
    .select();

  if (error) {
    throw new Error(`Gagal memperbarui status pengajuan: ${error.message}`);
  }

  return data[0];
};