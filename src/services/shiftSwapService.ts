import { supabase } from '../lib/supabase';

export interface ShiftSwapInput {
  requester_staff_id: string;
  requester_staff_name: string;
  target_staff_id: string;
  target_staff_name: string;
  week_number: number;
  swap_date: string;
  requester_shift: string;
  target_shift: string;
  reason: string;
}

export interface ShiftSwapRecord extends ShiftSwapInput {
  id: number;
  status: 'Pending' | 'Approved' | 'Rejected' | string;
  target_status?: 'pending' | 'accepted' | 'rejected' | string;
  management_status?: 'pending' | 'approved' | 'rejected' | string;
  created_at: string;
}

/**
 * Mengambil daftar staf yang aktif untuk opsi staf pasangan tukar shift
 */
export const getActiveStaffOptions = async (currentStaffId: string) => {
  const { data, error } = await supabase
    .from('staff')
    .select('staff_id, staff_name, first_name, last_name, avatar_url, role')
    .neq('status', 'Resign');

  if (error) {
    throw new Error(`Gagal mengambil data staf: ${error.message}`);
  }

  const formatted = data
    .filter(s => {
      const r = (s.role || '').toLowerCase();
      const idUpper = (s.staff_id || '').toUpperCase();
      return (
        !r.includes('owner') &&
        !r.includes('management') &&
        !r.includes('general_manager') &&
        !r.includes('spv') &&
        !r.includes('hrd') &&
        !r.includes('finance') &&
        !idUpper.startsWith('OWN-') &&
        !idUpper.startsWith('MNG-')
      );
    })
    .map(s => ({
      ...s,
      staff_name: s.staff_name || (s.first_name ? `${s.first_name} ${s.last_name || ''}`.trim() : s.staff_id)
    }));

  // Filter agar staf tidak memilih dirinya sendiri
  return formatted.filter(s => String(s.staff_id) !== String(currentStaffId));
};

/**
 * Mengirimkan pengajuan tukar shift baru ke tabel shift_swaps
 */
export const createShiftSwapRequest = async (input: ShiftSwapInput) => {
  const { data, error } = await supabase
    .from('shift_swaps')
    .insert([
      {
        requester_staff_id: String(input.requester_staff_id),
        requester_staff_name: input.requester_staff_name,
        target_staff_id: String(input.target_staff_id),
        target_staff_name: input.target_staff_name,
        week_number: Number(input.week_number),
        swap_date: input.swap_date,
        requester_shift: input.requester_shift,
        target_shift: input.target_shift,
        reason: input.reason || 'Tukar shift operasional',
        status: 'Pending',
        target_status: 'pending',
        management_status: 'pending',
      },
    ])
    .select();

  if (error) {
    throw new Error(`Gagal mengajukan tukar shift: ${error.message}`);
  }

  return data[0];
};

/**
 * Mengambil daftar riwayat permohonan tukar shift
 */
export const getShiftSwapRequests = async (staffId?: string, isManagement: boolean = false) => {
  let query = supabase
    .from('shift_swaps')
    .select('*')
    .order('created_at', { ascending: false });

  if (!isManagement && staffId) {
    query = query.or(
      `requester_staff_id.eq.${staffId},target_staff_id.eq.${staffId}`
    );
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Gagal mengambil riwayat tukar shift: ${error.message}`);
  }

  return data as ShiftSwapRecord[];
};

/**
 * Memperbarui respon permohonan dari Staf Target (Pintu 1)
 */
export const respondShiftSwapByTarget = async (
  swapId: number,
  response: 'accepted' | 'rejected'
) => {
  const targetStatusVal = response === 'accepted' ? 'accepted' : 'rejected';
  const legacyStatusVal = response === 'accepted' ? 'Approved' : 'Rejected';

  const { error } = await supabase
    .from('shift_swaps')
    .update({
      target_status: targetStatusVal,
      status: legacyStatusVal,
    })
    .eq('id', swapId);

  if (error) {
    throw new Error(`Gagal merespons tukar shift: ${error.message}`);
  }

  return true;
};

/**
 * Memperbarui status tukar shift oleh Manajemen (Pintu 2)
 * Jika Approved, otomatis melakukan pertukaran jadwal di tabel schedules
 */
export const updateShiftSwapStatus = async (
  swapItem: ShiftSwapRecord,
  newStatus: 'Approved' | 'Rejected'
) => {
  const mgmtStatus = newStatus === 'Approved' ? 'approved' : 'rejected';

  // 1. Update status pengajuan di tabel shift_swaps
  const { error: updateError } = await supabase
    .from('shift_swaps')
    .update({ 
      status: newStatus,
      management_status: mgmtStatus,
    })
    .eq('id', swapItem.id);

  if (updateError) {
    throw new Error(`Gagal memperbarui status: ${updateError.message}`);
  }

  // 2. Jika disetujui, tukar shift secara otomatis di tabel schedules
  if (newStatus === 'Approved') {
    // Update shift staf pengaju -> shift target
    const { error: err1 } = await supabase
      .from('schedules')
      .update({ shift: swapItem.target_shift })
      .match({
        staff_id: swapItem.requester_staff_id,
        week_number: swapItem.week_number,
        day: swapItem.swap_date,
      });

    // Update shift staf target -> shift pengaju
    const { error: err2 } = await supabase
      .from('schedules')
      .update({ shift: swapItem.requester_shift })
      .match({
        staff_id: swapItem.target_staff_id,
        week_number: swapItem.week_number,
        day: swapItem.swap_date,
      });

    if (err1 || err2) {
      throw new Error('Status berubah Approved tetapi gagal mengupdate tabel jadwal (schedules).');
    }
  }

  return true;
};