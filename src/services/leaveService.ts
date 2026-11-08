import { supabase } from '../lib/supabase';

export interface LeaveRequestInput {
  staff_id: string;
  staff_name: string;
  role?: string;
  leave_type: 'Cuti' | 'Sakit' | 'Izin Unpaid' | 'Izin' | string;
  start_date: string;
  end_date: string;
  reason: string;
  file?: File | null;
}

export interface LeaveRequestRecord extends LeaveRequestInput {
  id: number;
  status: 'Pending' | 'approved' | 'rejected' | string;
  created_at: string;
  attachment_url: string | null;
}

/**
 * Mengambil sisa kuota cuti tahunan staf dari Supabase
 */
export const getStaffLeaveQuota = async (staffId: string): Promise<number> => {
  const { data, error } = await supabase
    .from('staff')
    .select('annual_leave_quota')
    .eq('staff_id', String(staffId))
    .single();

  if (error || !data) return 12;
  return data.annual_leave_quota ?? 12;
};

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

  // 2. Ambil nama resmi staf dari Supabase (Fallback)
  const { data: staffData } = await supabase
    .from('staff')
    .select('first_name, last_name, staff_name')
    .eq('staff_id', String(input.staff_id))
    .single();

  const displayName = staffData?.staff_name || 
    (staffData?.first_name ? `${staffData.first_name} ${staffData.last_name || ''}`.trim() : input.staff_name);

  // 3. Insert record ke tabel leave_requests
  const { data, error } = await supabase
    .from('leave_requests')
    .insert([
      {
        staff_id: String(input.staff_id),
        staff_name: displayName,
        role: input.role || 'Staf',
        leave_type: input.leave_type,
        start_date: input.start_date,
        end_date: input.end_date,
        reason: input.reason.trim(),
        status: 'Pending',
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
 * Jika pengajuan Cuti disetujui, otomatis mengurangi kuota cuti tahunan staf
 */
export const updateLeaveStatus = async (
  requestId: number,
  status: 'approved' | 'rejected' | 'Approved' | 'Rejected'
) => {
  const formattedStatus = status.toLowerCase() === 'approved' ? 'approved' : 'rejected';

  // Ambil detail permohonan terlebih dahulu
  const { data: leaveItem, error: fetchError } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (fetchError || !leaveItem) {
    throw new Error('Data pengajuan izin tidak ditemukan.');
  }

  const { data, error } = await supabase
    .from('leave_requests')
    .update({ status: formattedStatus })
    .eq('id', requestId)
    .select();

  if (error) {
    throw new Error(`Gagal memperbarui status pengajuan: ${error.message}`);
  }

  // Potong Kuota Cuti Tahunan jika disetujui & bertipe 'Cuti'
  if (formattedStatus === 'approved' && (leaveItem.leave_type || '').toLowerCase() === 'cuti') {
    const start = new Date(leaveItem.start_date);
    const end = new Date(leaveItem.end_date || leaveItem.start_date);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const leaveDaysCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const currentQuota = await getStaffLeaveQuota(leaveItem.staff_id);
    const newQuota = Math.max(0, currentQuota - leaveDaysCount);

    await supabase
      .from('staff')
      .update({ annual_leave_quota: newQuota })
      .eq('staff_id', String(leaveItem.staff_id));
  }

  return data[0];
};