import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface CurrentUser {
  name: string;
  role: 'management' | 'kasir' | 'bar' | 'dapur' | 'owner' | string;
  staff_id: string;
}

interface ManagementDashboardProps {
  currentUser: CurrentUser;
}

interface ShiftSwapRequest {
  id: number;
  requester_name?: string;
  requester_id?: string;
  requester_staff_name?: string;
  requester_staff_id?: string;
  target_staff_name: string;
  target_staff_id: string;
  shift_date?: string;
  swap_date?: string;
  date?: string;
  shift_type?: string;
  requester_shift?: string;
  reason: string;
  target_status?: string;
  status?: string;
  management_status: 'pending' | 'approved' | 'rejected' | string;
  created_at: string;
}

interface LeaveRequest {
  id: number;
  staff_name: string;
  staff_id: string;
  leave_type: 'Izin' | 'Cuti' | 'Sakit';
  start_date: string;
  end_date: string;
  reason: string;
  attachment_url?: string;
  status: 'pending' | 'approved' | 'rejected' | string;
  created_at: string;
}

interface SecurityAuditLog {
  id: number;
  staff_name: string;
  staff_id: string;
  role: string;
  action_type: string;
  target_recipe?: string;
  created_at: string;
}

interface HandoverItem {
  id: number;
  staff_name: string;
  shift: string;
  notes: string;
  created_at: string;
}

interface OnDutyItem {
  id: number;
  staff_name: string;
  staff_id: string;
  role: string;
  shift: string;
  clock_in: string;
}

export default function ManagementDashboard({ currentUser }: ManagementDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [totalStaff, setTotalStaff] = useState(0);
  const [onDutyList, setOnDutyList] = useState<OnDutyItem[]>([]);
  const [handoverLogs, setHandoverLogs] = useState<HandoverItem[]>([]);
  const [securityLogs, setSecurityLogs] = useState<SecurityAuditLog[]>([]);
  
  // Data Persetujuan
  const [swapRequests, setSwapRequests] = useState<ShiftSwapRequest[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [approvalTab, setApprovalTab] = useState<'swap' | 'leave'>('swap');

  // Preview Foto Surat Dokter Modal
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Breakdown SOP stats
  const [sopStats, setSopStats] = useState({
    total: 0,
    completed: 0,
    barCompleted: 0,
    barTotal: 0,
    kitchenCompleted: 0,
    kitchenTotal: 0,
    floorCompleted: 0,
    floorTotal: 0,
  });

  const [totalWorkHours, setTotalWorkHours] = useState(0);

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    setLoading(true);

    try {
      // 1. Total Staf Aktif
      const { count: staffCount } = await supabase
        .from('staff')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Aktif');

      // 2. Staf On Duty Hari Ini
      const { data: attendanceData } = await supabase
        .from('attendances')
        .select('*')
        .eq('status', 'On Duty')
        .order('clock_in', { ascending: false });

      // 3. Rekap SOP Checklist
      const { data: sopData } = await supabase.from('sop_checklists').select('*');

      // 4. Catatan Handover Log Terbaru
      const { data: handoverData } = await supabase
        .from('handover_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      // 5. Log Security Audit Terbaru
      const { data: secData } = await supabase
        .from('security_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(6);

      // 6. Data Permintaan Tukar Shift Menunggu ACC Management
      const { data: swapData } = await supabase
        .from('shift_swaps')
        .select('*')
        .order('created_at', { ascending: false });

      // 7. Data Permintaan Izin / Cuti / Sakit Menunggu ACC Management
      const { data: leaveData } = await supabase
        .from('leave_requests')
        .select('*')
        .order('created_at', { ascending: false });

      // 8. Total Jam Kerja Terakumulasi
      const { data: allAttendances } = await supabase.from('attendances').select('clock_in, clock_out');

      let calculatedHours = 0;
      if (allAttendances) {
        allAttendances.forEach((item) => {
          if (item.clock_in && item.clock_out) {
            const start = new Date(item.clock_in).getTime();
            const end = new Date(item.clock_out).getTime();
            calculatedHours += Math.max(0, (end - start) / (1000 * 60 * 60));
          }
        });
      }

      setTotalStaff(staffCount || 0);
      setOnDutyList(attendanceData || []);
      setHandoverLogs(handoverData || []);
      setSecurityLogs(secData || []);
      setSwapRequests(swapData || []);
      setLeaveRequests(leaveData || []);
      setTotalWorkHours(parseFloat(calculatedHours.toFixed(1)));

      if (sopData) {
        const total = sopData.length;
        const completed = sopData.filter((i) => i.is_completed).length;

        const barItems = sopData.filter((i) => (i.category || i.role || '').toLowerCase().includes('bar'));
        const kitchenItems = sopData.filter((i) => {
          const cat = (i.category || i.role || '').toLowerCase();
          return cat.includes('kitchen') || cat.includes('dapur');
        });
        const floorItems = sopData.filter((i) => {
          const cat = (i.category || i.role || '').toLowerCase();
          return cat.includes('kasir') || cat.includes('server') || cat.includes('floor');
        });

        setSopStats({
          total,
          completed,
          barTotal: barItems.length || 1,
          barCompleted: barItems.filter((i) => i.is_completed).length,
          kitchenTotal: kitchenItems.length || 1,
          kitchenCompleted: kitchenItems.filter((i) => i.is_completed).length,
          floorTotal: floorItems.length || 1,
          floorCompleted: floorItems.filter((i) => i.is_completed).length,
        });
      }
    } catch (err) {
      console.error('Error fetching dashboard analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  // 🚀 LOGIKA COUNTER PENDING ACC YANG SUDAH DIPERBAIKI:
  // Hanya hitung butuh ACC jika persetujuan Manajemen 'pending' DAN belum ditolak oleh Staf Pengganti
  const pendingSwapCount = swapRequests.filter((s) => {
    const mgmtStatus = (s.management_status || s.status || 'pending').toLowerCase();
    const targetStatusRaw = (s.target_status && s.target_status !== 'pending' ? s.target_status : s.status) || '';
    const targetStatusLower = targetStatusRaw.toLowerCase();

    const isRejectedByStaff = targetStatusLower === 'rejected' || targetStatusLower === 'tolak';
    const isMgmtPending = mgmtStatus === 'pending';

    return isMgmtPending && !isRejectedByStaff;
  }).length;

  const pendingLeaveCount = leaveRequests.filter(
    (l) => l.status?.toLowerCase() === 'pending'
  ).length;

  const totalPendingApproval = pendingSwapCount + pendingLeaveCount;

  // 🚀 LOGIKA SMART AUTO-SWITCH TAB
  useEffect(() => {
    if (!loading) {
      if (pendingLeaveCount > 0 && pendingSwapCount === 0) {
        setApprovalTab('leave');
      } else if (pendingSwapCount > 0 && pendingLeaveCount === 0) {
        setApprovalTab('swap');
      }
    }
  }, [pendingSwapCount, pendingLeaveCount, loading]);

  // 🚀 UPDATE DENGAN DYNAMIC FALLBACK
  const handleApproveSwap = async (swapId: number, status: 'approved' | 'rejected') => {
    try {
      const { error: primaryError } = await supabase
        .from('shift_swaps')
        .update({ management_status: status })
        .eq('id', swapId);

      if (primaryError) {
        console.warn('Fallback: update kolom status sebagai pengganti management_status');
        const { error: fallbackError } = await supabase
          .from('shift_swaps')
          .update({ status: status === 'approved' ? 'Approved' : 'Rejected' })
          .eq('id', swapId);

        if (fallbackError) throw fallbackError;
      }

      setSwapRequests((prev) =>
        prev.map((item) => (item.id === swapId ? { ...item, management_status: status, status: status === 'approved' ? 'Approved' : 'Rejected' } : item))
      );

      alert(status === 'approved' ? '✅ Tukar Shift Berhasil Di-ACC!' : '❌ Tukar Shift Ditolak!');
      fetchAnalyticsData();
    } catch (err: any) {
      alert(`Gagal memproses persetujuan: ${err.message}`);
    }
  };

  // 🚀 ACC / TOLAK IZIN / CUTI
  const handleApproveLeave = async (leaveItem: LeaveRequest, status: 'approved' | 'rejected') => {
    if (status === 'approved') {
      try {
        const { data: scheduleData } = await supabase
          .from('staff_schedules')
          .select('*')
          .gte('date', leaveItem.start_date)
          .lte('date', leaveItem.end_date || leaveItem.start_date);

        const otherWorkingStaff = scheduleData?.filter((s) => s.staff_id !== leaveItem.staff_id) || [];

        if (otherWorkingStaff.length === 0) {
          const confirmAcc = window.confirm(
            `⚠️ PERINGATAN OPERASIONAL KOSONG!\n\n` +
            `Staf ${leaveItem.staff_name} (${leaveItem.staff_id}) adalah SATU-SATUNYA staf yang dijadwalkan pada ${leaveItem.start_date}.\n\n` +
            `Jika pengajuan ini di-ACC, outlet/shift tersebut akan KOSONG tanpa penjaga.\n\n` +
            `Apakah Manajemen tetap yakin meng-ACC dan akan mencari pengganti (Overtime/Replacement) secara manual?`
          );

          if (!confirmAcc) return;
        }
      } catch (err) {
        console.warn('Gagal memvalidasi kuota jadwal staf:', err);
      }
    }

    const { error } = await supabase
      .from('leave_requests')
      .update({ status })
      .eq('id', leaveItem.id);

    if (error) {
      alert(`Gagal memproses izin: ${error.message}`);
      return;
    }

    setLeaveRequests((prev) =>
      prev.map((item) => (item.id === leaveItem.id ? { ...item, status } : item))
    );

    if (status === 'approved') {
      await supabase.from('attendances').insert([
        {
          staff_id: leaveItem.staff_id,
          staff_name: leaveItem.staff_name,
          role: 'staf',
          shift: 'morning',
          clock_in: new Date(leaveItem.start_date).toISOString(),
          clock_out: new Date(leaveItem.end_date || leaveItem.start_date).toISOString(),
          status: leaveItem.leave_type,
        },
      ]);

      if (leaveItem.leave_type === 'Cuti') {
        const { data: staffData } = await supabase
          .from('staff')
          .select('leave_quota')
          .eq('staff_id', leaveItem.staff_id)
          .single();

        const currentQuota = staffData?.leave_quota ?? 12;
        const newQuota = Math.max(0, currentQuota - 1);

        await supabase
          .from('staff')
          .update({ leave_quota: newQuota })
          .eq('staff_id', leaveItem.staff_id);
      }
    }

    alert(status === 'approved' ? `✅ Permintaan ${leaveItem.leave_type} Di-ACC!` : '❌ Permintaan Ditolak!');
    fetchAnalyticsData();
  };

  const totalSopPct = sopStats.total > 0 ? Math.round((sopStats.completed / sopStats.total) * 100) : 0;
  const barSopPct = Math.round((sopStats.barCompleted / sopStats.barTotal) * 100);
  const kitchenSopPct = Math.round((sopStats.kitchenCompleted / sopStats.kitchenTotal) * 100);
  const floorSopPct = Math.round((sopStats.floorCompleted / sopStats.floorTotal) * 100);

  const screenshotAttemptsCount = securityLogs.filter((l) => l.action_type.includes('SCREENSHOT')).length;

  // 🚀 SMART HELPER: MENGHITUNG HARI MENDATANG TERDEKAT DARI CREATED_AT
  const formatFullDate = (rawDateStr?: string, createdAtStr?: string) => {
    if (!rawDateStr && !createdAtStr) return '-';

    // 1. Jika rawDateStr sudah berbentuk format tanggal valid YYYY-MM-DD / ISO
    if (rawDateStr && rawDateStr.match(/\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}/)) {
      try {
        const d = new Date(rawDateStr);
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString('id-ID', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          });
        }
      } catch {
        // Fallback
      }
    }

    // 2. Jika rawDateStr berupa NAMA HARI (misal "Selasa")
    const dayNames = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
    const cleanDayInput = (rawDateStr || '').trim().toLowerCase();
    const targetDayIndex = dayNames.indexOf(cleanDayInput);

    if (targetDayIndex !== -1 && createdAtStr) {
      try {
        const baseDate = new Date(createdAtStr);
        if (!isNaN(baseDate.getTime())) {
          const currentDayIndex = baseDate.getDay();
          let diff = targetDayIndex - currentDayIndex;

          // 💡 JIKA HARI TERSEBUT SUDAH LEWAT DI MINGGU INI (misal: buat Sabtu, minta Selasa),
          // TAMBAHKAN 7 HARI agar menunjuk ke HARI SELASA MENDATANG (Selasa Depan)!
          if (diff <= 0) {
            diff += 7;
          }

          const resultDate = new Date(baseDate);
          resultDate.setDate(baseDate.getDate() + diff);

          return resultDate.toLocaleDateString('id-ID', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          });
        }
      } catch {
        // Fallback jika terjadi error
      }
    }

    // 3. Fallback jika rawDateStr teks biasa
    if (rawDateStr) return rawDateStr;

    // 4. Fallback ke created_at jika rawDateStr kosong
    if (createdAtStr) {
      try {
        const d = new Date(createdAtStr);
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString('id-ID', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          });
        }
      } catch {
        return createdAtStr;
      }
    }

    return '-';
  };

  return (
    <div className="space-y-6 text-left">
      {/* HEADER EXECUTIVE DASHBOARD */}
      <div className="bg-gradient-to-r from-[#111111] via-neutral-900 to-neutral-800 text-white p-6 md:p-8 rounded-3xl shadow-xl border border-neutral-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-[#d22027] text-white px-3 py-1 rounded-full font-black uppercase tracking-wider">
              {currentUser.role === 'owner' ? 'Owner Executive Suite' : 'Management Control Panel'}
            </span>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold">
              ● Live Systems
            </span>
            {totalPendingApproval > 0 && (
              <span className="text-[10px] bg-red-600 text-white font-black px-2.5 py-0.5 rounded-full animate-bounce">
                ⚠️ {totalPendingApproval} Butuh ACC
              </span>
            )}
          </div>
          <h2 className="text-xl md:text-2xl font-black mt-2 tracking-tight">Executive Analytics Hub 📊</h2>
          <p className="text-xs text-neutral-400 mt-1 max-w-xl">
            Pusat persetujuan tukar shift/izin, pengawasan operasional, audit keamanan resep, dan kepatuhan SOP Rottherdams.
          </p>
        </div>

        <button
          onClick={fetchAnalyticsData}
          className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-bold transition cursor-pointer border border-white/10 active:scale-95 flex items-center gap-2"
        >
          <span>🔄</span> Refresh Data
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-xs text-neutral-400 animate-pulse">
          Menganalisis metrik operasional dan mengumpulkan log persetujuan dari Supabase...
        </div>
      ) : (
        <>
          {/* APPROVAL CENTER */}
          <div className="bg-white rounded-3xl p-6 border-2 border-[#d22027]/20 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-neutral-100">
              <div>
                <h3 className="font-black text-base text-[#111111] flex items-center gap-2">
                  <span>🛎️</span> Pusat Persetujuan Operasional (Approval Center)
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Setujui atau tolak permintaan Tukar Shift & Izin/Cuti dari staf operasional.
                </p>
              </div>

              <div className="bg-neutral-100 p-1 rounded-2xl flex gap-1 border border-neutral-200">
                <button
                  onClick={() => setApprovalTab('swap')}
                  className={`px-3 py-1.5 text-xs font-extrabold rounded-xl transition cursor-pointer ${
                    approvalTab === 'swap' ? 'bg-[#111111] text-white shadow-xs' : 'text-neutral-500 hover:text-black'
                  }`}
                >
                  🔄 Tukar Shift ({pendingSwapCount})
                </button>
                <button
                  onClick={() => setApprovalTab('leave')}
                  className={`px-3 py-1.5 text-xs font-extrabold rounded-xl transition cursor-pointer ${
                    approvalTab === 'leave' ? 'bg-[#d22027] text-white shadow-xs' : 'text-neutral-500 hover:text-black'
                  }`}
                >
                  📄 Izin & Cuti ({pendingLeaveCount})
                </button>
              </div>
            </div>

            {/* TAB 1: TUKAR SHIFT */}
            {approvalTab === 'swap' && (
              <div>
                {swapRequests.length === 0 ? (
                  <p className="text-xs text-neutral-400 italic py-6 text-center">Belum ada pengajuan tukar shift.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-neutral-100 text-neutral-700 font-bold border-b border-neutral-200">
                          <th className="p-3">Pemohon</th>
                          <th className="p-3">Pengganti</th>
                          <th className="p-3">Tanggal & Shift</th>
                          <th className="p-3">Alasan</th>
                          <th className="p-3">Status Pengganti</th>
                          <th className="p-3 text-center">ACC Management</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {swapRequests.map((item) => {
                          const requesterName = item.requester_staff_name || item.requester_name || 'Staf';
                          const requesterId = item.requester_staff_id || item.requester_id || '-';
                          const targetName = item.target_staff_name || '-';
                          const targetId = item.target_staff_id || '-';

                          const rawSwapDate = item.swap_date || item.shift_date || item.date;
                          const formattedDateDisplay = formatFullDate(rawSwapDate, item.created_at);
                          const shiftInfo = item.requester_shift || item.shift_type || 'Shift';

                          // Status Staf Pengganti
                          const targetStatusRaw = (item.target_status && item.target_status !== 'pending' ? item.target_status : item.status) || '';
                          const targetStatusLower = targetStatusRaw.toLowerCase();

                          const isAcceptedByStaff = targetStatusLower === 'accepted' || targetStatusLower === 'setuju' || targetStatusLower === 'approved';
                          const isRejectedByStaff = targetStatusLower === 'rejected' || targetStatusLower === 'tolak';

                          const mgmtStatus = (item.management_status || item.status || 'pending').toLowerCase();
                          const isMgmtApproved = mgmtStatus === 'approved';
                          const isMgmtRejected = mgmtStatus === 'rejected';

                          return (
                            <tr key={item.id} className="hover:bg-neutral-50">
                              <td className="p-3">
                                <p className="font-extrabold text-[#111111]">{requesterName}</p>
                                <p className="text-[10px] text-neutral-400 font-mono">{requesterId}</p>
                              </td>
                              <td className="p-3">
                                <p className="font-extrabold text-[#111111]">{targetName}</p>
                                <p className="text-[10px] text-neutral-400 font-mono">{targetId}</p>
                              </td>
                              <td className="p-3 font-bold text-neutral-700">
                                {formattedDateDisplay} 
                                <span className="block text-[10px] text-[#d22027] font-extrabold uppercase mt-0.5">
                                  {shiftInfo}
                                </span>
                              </td>
                              <td className="p-3 text-neutral-600 max-w-xs">{item.reason || '-'}</td>
                              
                              {/* Status Staf Pengganti */}
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  isAcceptedByStaff
                                    ? 'bg-emerald-50 text-emerald-600'
                                    : isRejectedByStaff
                                    ? 'bg-red-50 text-red-600'
                                    : 'bg-amber-50 text-amber-600'
                                }`}>
                                  {isAcceptedByStaff
                                    ? '🟢 Setuju'
                                    : isRejectedByStaff
                                    ? '❌ Menolak'
                                    : '⏳ Menunggu Staf'}
                                </span>
                              </td>

                              {/* Action ACC Management */}
                              <td className="p-3 text-center">
                                {isRejectedByStaff ? (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-400">
                                    🚫 Batal (Ditolak Staf)
                                  </span>
                                ) : isAcceptedByStaff && !isMgmtApproved && !isMgmtRejected ? (
                                  <div className="flex justify-center gap-1.5">
                                    <button
                                      onClick={() => handleApproveSwap(item.id, 'approved')}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-[11px] shadow-xs cursor-pointer active:scale-95 transition"
                                    >
                                      ✅ ACC
                                    </button>
                                    <button
                                      onClick={() => handleApproveSwap(item.id, 'rejected')}
                                      className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-[11px] shadow-xs cursor-pointer active:scale-95 transition"
                                    >
                                      ❌ Tolak
                                    </button>
                                  </div>
                                ) : (
                                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                                    isMgmtApproved
                                      ? 'bg-emerald-100 text-emerald-700' 
                                      : isMgmtRejected
                                      ? 'bg-red-100 text-red-700' 
                                      : 'bg-amber-100 text-amber-700'
                                  }`}>
                                    {isMgmtApproved 
                                      ? '✅ Approved' 
                                      : isMgmtRejected 
                                      ? '❌ Rejected' 
                                      : '⏳ Menunggu Staf'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: IZIN & CUTI */}
            {approvalTab === 'leave' && (
              <div>
                {leaveRequests.length === 0 ? (
                  <p className="text-xs text-neutral-400 italic py-6 text-center">Belum ada pengajuan izin atau sakit.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-neutral-100 text-neutral-700 font-bold border-b border-neutral-200">
                          <th className="p-3">Nama Staf</th>
                          <th className="p-3">Tipe Izin</th>
                          <th className="p-3">Tanggal Mulai - Selesai</th>
                          <th className="p-3">Alasan / Catatan</th>
                          <th className="p-3 text-center">Bukti Dokumen</th>
                          <th className="p-3 text-center">Aksi ACC Management</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {leaveRequests.map((item) => (
                          <tr key={item.id} className="hover:bg-neutral-50">
                            <td className="p-3">
                              <p className="font-extrabold text-[#111111]">{item.staff_name}</p>
                              <p className="text-[10px] text-neutral-400 font-mono">{item.staff_id}</p>
                            </td>
                            <td className="p-3">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                                item.leave_type === 'Sakit' 
                                  ? 'bg-blue-50 text-blue-600 border border-blue-200' 
                                  : item.leave_type === 'Cuti'
                                  ? 'bg-purple-50 text-purple-600 border border-purple-200'
                                  : 'bg-amber-50 text-amber-600 border border-amber-200'
                              }`}>
                                {item.leave_type}
                              </span>
                            </td>
                            <td className="p-3 font-bold text-neutral-700">
                              {item.start_date} s/d {item.end_date || item.start_date}
                            </td>
                            <td className="p-3 text-neutral-600 max-w-xs">{item.reason || '-'}</td>
                            <td className="p-3 text-center">
                              {item.attachment_url ? (
                                <button
                                  onClick={() => setSelectedImage(item.attachment_url || null)}
                                  className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-[10px] font-bold cursor-pointer transition border border-neutral-200"
                                >
                                  🖼️ Lihat Surat
                                </button>
                              ) : (
                                <span className="text-neutral-400 text-[10px] italic">Tidak Ada</span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {item.status?.toLowerCase() === 'pending' ? (
                                <div className="flex justify-center gap-1.5">
                                  <button
                                    onClick={() => handleApproveLeave(item, 'approved')}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-[11px] shadow-xs cursor-pointer active:scale-95 transition"
                                  >
                                    ✅ ACC
                                  </button>
                                  <button
                                    onClick={() => handleApproveLeave(item, 'rejected')}
                                    className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-[11px] shadow-xs cursor-pointer active:scale-95 transition"
                                  >
                                    ❌ Tolak
                                  </button>
                                </div>
                              ) : (
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                                  item.status?.toLowerCase() === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                }`}>
                                  {item.status?.toLowerCase() === 'approved' ? '✅ Disetujui' : '❌ Ditolak'}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* METRIC SUMMARY CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-neutral-200 shadow-xs hover:border-neutral-300 transition">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">👥</span>
                <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-md">
                  Active Now
                </span>
              </div>
              <p className="text-2xl font-black text-[#111111]">
                {onDutyList.length} <span className="text-xs font-normal text-neutral-400">/ {totalStaff} Staf</span>
              </p>
              <p className="text-[11px] font-bold text-neutral-500 mt-1">Staf On-Duty Bar & Dapur</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-neutral-200 shadow-xs hover:border-neutral-300 transition">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">📋</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  totalSopPct >= 80 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                }`}>
                  {totalSopPct}% Done
                </span>
              </div>
              <p className="text-2xl font-black text-[#111111]">
                {sopStats.completed} <span className="text-xs font-normal text-neutral-400">/ {sopStats.total} Task</span>
              </p>
              <p className="text-[11px] font-bold text-neutral-500 mt-1">SOP Operasional Selesai</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-neutral-200 shadow-xs hover:border-neutral-300 transition">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">⏱️</span>
                <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md">
                  Labor Cost
                </span>
              </div>
              <p className="text-2xl font-black text-[#d22027]">{totalWorkHours} <span className="text-xs font-normal text-neutral-400">Jam</span></p>
              <p className="text-[11px] font-bold text-neutral-500 mt-1">Total Durasi Jam Kerja Staf</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-neutral-200 shadow-xs hover:border-neutral-300 transition">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">🛡️</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  screenshotAttemptsCount > 0 ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-neutral-100 text-neutral-600'
                }`}>
                  {screenshotAttemptsCount > 0 ? '⚠️ Warning' : 'Secure'}
                </span>
              </div>
              <p className="text-2xl font-black text-[#111111]">{screenshotAttemptsCount} <span className="text-xs font-normal text-neutral-400">Percobaan</span></p>
              <p className="text-[11px] font-bold text-neutral-500 mt-1">Indikasi Screenshot / Switch App</p>
            </div>
          </div>

          {/* MATRIKS KEPATUHAN SOP PER DIVISI */}
          <div className="bg-white rounded-3xl p-6 md:p-8 border border-neutral-200 shadow-xs space-y-6">
            <div className="flex justify-between items-center pb-3 border-b border-neutral-100">
              <div>
                <h3 className="font-black text-base text-[#111111]">📋 Matriks Kepatuhan SOP Harian Per Divisi</h3>
                <p className="text-xs text-neutral-400 mt-0.5">Persentase penyelesaian tugas checklist harian staf Bar, Kitchen, dan Floor.</p>
              </div>
              <span className="text-xs font-black text-[#d22027] bg-red-50 px-3 py-1 rounded-full">
                {totalSopPct}% Total Completed
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-2">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span>☕ Bar & Beverage</span>
                  <span className="text-emerald-600 font-black">{barSopPct}%</span>
                </div>
                <div className="w-full bg-neutral-200 rounded-full h-2.5 overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${barSopPct}%` }}></div>
                </div>
                <p className="text-[10px] text-neutral-400">{sopStats.barCompleted} dari {sopStats.barTotal} tugas SOP selesai.</p>
              </div>

              <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-2">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span>🍳 Kitchen & Food</span>
                  <span className="text-amber-600 font-black">{kitchenSopPct}%</span>
                </div>
                <div className="w-full bg-neutral-200 rounded-full h-2.5 overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${kitchenSopPct}%` }}></div>
                </div>
                <p className="text-[10px] text-neutral-400">{sopStats.kitchenCompleted} dari {sopStats.kitchenTotal} tugas SOP selesai.</p>
              </div>

              <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-2">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span>🧹 Floor & Cashier</span>
                  <span className="text-blue-600 font-black">{floorSopPct}%</span>
                </div>
                <div className="w-full bg-neutral-200 rounded-full h-2.5 overflow-hidden">
                  <div className="bg-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${floorSopPct}%` }}></div>
                </div>
                <p className="text-[10px] text-neutral-400">{sopStats.floorCompleted} dari {sopStats.floorTotal} tugas SOP selesai.</p>
              </div>
            </div>
          </div>

          {/* LIVE SECURITY AUDIT & ON-DUTY MONITOR */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#111111] text-white rounded-3xl p-6 shadow-xl border border-neutral-800 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-neutral-800">
                <h3 className="font-black text-sm text-white flex items-center gap-2">
                  <span className="text-[#d22027]">🛡️</span> Live Security Audit Log (Resep & Akses)
                </h3>
                <span className="text-[9px] bg-red-500/20 text-red-400 border border-red-500/30 px-2.5 py-0.5 rounded-full font-bold">
                  Protected
                </span>
              </div>

              {securityLogs.length === 0 ? (
                <p className="text-xs text-neutral-500 italic py-4">Belum ada catatan pelanggaran keamanan.</p>
              ) : (
                <div className="space-y-2.5">
                  {securityLogs.map((log) => {
                    const isScreenshot = log.action_type.includes('SCREENSHOT');
                    return (
                      <div
                        key={log.id}
                        className={`p-3 rounded-2xl border text-xs flex justify-between items-center transition ${
                          isScreenshot
                            ? 'bg-red-950/40 border-red-800/60 text-red-200'
                            : 'bg-neutral-900 border-neutral-800 text-neutral-300'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-[#ffffff]">{log.staff_name}</span>
                            <span className="text-[9px] px-1.5 py-0.2 bg-white/10 rounded font-mono text-neutral-400">
                              {log.staff_id}
                            </span>
                          </div>
                          <p className="text-[10px] mt-0.5 opacity-80">
                            {isScreenshot ? '⚠️ Intip / Percobaan Screenshot Resep' : '📖 Menampilkan Gramasi Resep'}{' '}
                            • <strong className="text-white">{log.target_recipe || 'Dokumen Resep'}</strong>
                          </p>
                        </div>
                        <span className="text-[9px] font-mono text-neutral-500 whitespace-nowrap ml-2">
                          {new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WITA
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-white rounded-3xl p-6 border border-neutral-200 shadow-xs space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-neutral-100">
                <h3 className="font-black text-sm text-[#111111] flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                  Tim On-Duty Aktif ({onDutyList.length})
                </h3>
                <span className="text-[10px] text-neutral-400 font-mono">Shift Operasional</span>
              </div>

              {onDutyList.length === 0 ? (
                <div className="py-8 text-center text-xs text-neutral-400">
                  Saat ini tidak ada staf yang sedang On-Duty / Clock In.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {onDutyList.map((staf) => (
                    <div key={staf.id} className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#111111] text-[#ffffff] flex items-center justify-center text-xs font-black shrink-0">
                        {staf.staff_name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="overflow-hidden">
                        <p className="font-extrabold text-xs text-[#111111] truncate">{staf.staff_name}</p>
                        <p className="text-[10px] text-neutral-400 capitalize">
                          {staf.role} • {staf.shift} Shift
                        </p>
                        <p className="text-[9px] text-emerald-600 font-mono font-bold mt-0.5">
                          In: {new Date(staf.clock_in).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WITA
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* HANDOVER LOG FEED */}
          <div className="bg-white rounded-3xl p-6 border border-neutral-200 shadow-xs space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-neutral-100">
              <h3 className="font-black text-sm text-[#111111]">📝 Catatan Serah Terima Shift Terbaru (Handover Log)</h3>
              <span className="text-xs text-neutral-400">5 Feed Terakhir</span>
            </div>

            {handoverLogs.length === 0 ? (
              <p className="text-xs text-neutral-400 italic py-4">Belum ada catatan handover shift dari tim operasional.</p>
            ) : (
              <div className="space-y-3">
                {handoverLogs.map((log) => (
                  <div key={log.id} className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-[#111111]">{log.staff_name}</span>
                        <span className="text-[9px] bg-neutral-200 px-2 py-0.5 rounded-md font-bold uppercase">
                          {log.shift} Shift
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-neutral-400">
                        {new Date(log.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}{' '}
                        • {new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WITA
                      </span>
                    </div>
                    <p className="text-xs text-neutral-700 leading-relaxed">{log.notes}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* MODAL POPUP BUKTI SURAT FOTO */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white p-4 rounded-3xl max-w-lg w-full space-y-3 relative shadow-2xl border border-neutral-100">
            <div className="flex justify-between items-center pb-2 border-b">
              <h4 className="font-bold text-xs text-[#111111]">🖼️ Dokumen Bukti Izin / Surat Dokter</h4>
              <button
                onClick={() => setSelectedImage(null)}
                className="text-neutral-400 hover:text-black font-bold text-xs cursor-pointer"
              >
                ✕ Tutup
              </button>
            </div>
            <img src={selectedImage} alt="Bukti Surat Dokter" className="w-full h-auto rounded-2xl max-h-96 object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}