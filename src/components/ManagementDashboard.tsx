import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { sendTelegramAlert } from '../lib/telegram';
import MetricsSummary from './dashboard/MetricsSummary';
import ApprovalCenter from './dashboard/ApprovalCenter';
import type { ShiftSwapRequest, LeaveRequest } from './dashboard/ApprovalCenter';
import SopComplianceMatrix from './dashboard/SopComplianceMatrix';
import SecurityAuditWidget from './dashboard/SecurityAuditWidget';
import type { SecurityAuditLog } from './dashboard/SecurityAuditWidget';
import OnDutyWidget from './dashboard/OnDutyWidget';
import type { OnDutyItem } from './dashboard/OnDutyWidget';

interface CurrentUser {
  name: string;
  role: string;
  staff_id: string;
}

interface ManagementDashboardProps {
  currentUser: CurrentUser;
}

interface HandoverItem {
  id: number;
  staff_name: string;
  shift: string;
  notes: string;
  created_at: string;
}

export default function ManagementDashboard({ currentUser }: ManagementDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [totalStaff, setTotalStaff] = useState(0);
  const [onDutyList, setOnDutyList] = useState<OnDutyItem[]>([]);
  const [handoverLogs, setHandoverLogs] = useState<HandoverItem[]>([]);
  const [securityLogs, setSecurityLogs] = useState<SecurityAuditLog[]>([]);
  const [screenshotAttemptsCount, setScreenshotAttemptsCount] = useState<number>(0);
  
  const [swapRequests, setSwapRequests] = useState<ShiftSwapRequest[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [approvalTab, setApprovalTab] = useState<'swap' | 'leave'>('swap');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

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

    const dashboardChannel = supabase
      .channel('management_dashboard_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sop_checklists' }, () => {
        fetchAnalyticsData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendances' }, () => {
        fetchAnalyticsData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shift_swaps' }, () => {
        fetchAnalyticsData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => {
        fetchAnalyticsData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'security_audit_logs' }, () => {
        fetchAnalyticsData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(dashboardChannel);
    };
  }, []);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      const { count: staffCount } = await supabase.from('staff').select('*', { count: 'exact', head: true }).eq('status', 'Aktif');
      const { data: attendanceData } = await supabase.from('attendances').select('*').eq('status', 'On Duty').order('clock_in', { ascending: false });

      let enrichedOnDuty: OnDutyItem[] = [];
      if (attendanceData && attendanceData.length > 0) {
        const staffIds = attendanceData.map((a) => a.staff_id).filter(Boolean);
        const { data: staffProfiles } = await supabase.from('staff').select('staff_id, avatar_url').in('staff_id', staffIds);

        const avatarMap: { [id: string]: string } = {};
        (staffProfiles || []).forEach((s) => { if (s.avatar_url) avatarMap[s.staff_id] = s.avatar_url; });
        enrichedOnDuty = attendanceData.map((item) => ({ ...item, avatar_url: avatarMap[item.staff_id] || undefined }));
      }

      const { data: sopData } = await supabase.from('sop_checklists').select('*');
      const { data: handoverData } = await supabase.from('handover_logs').select('*').order('created_at', { ascending: false }).limit(5);
      const { data: secData } = await supabase.from('security_audit_logs').select('*').order('created_at', { ascending: false }).limit(6);
      const { count: totalScreenshotCount } = await supabase.from('security_audit_logs').select('*', { count: 'exact', head: true }).ilike('action_type', '%SCREENSHOT%');
      const { data: swapData } = await supabase.from('shift_swaps').select('*').order('created_at', { ascending: false });
      const { data: leaveData } = await supabase.from('leave_requests').select('*').order('created_at', { ascending: false });
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

      setScreenshotAttemptsCount(totalScreenshotCount || 0);
      setTotalStaff(staffCount || 0);
      setOnDutyList(enrichedOnDuty);
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
          return cat.includes('kitchen') || cat.includes('dapur') || cat.includes('chef') || cat.includes('cook');
        });
        const floorItems = sopData.filter((i) => {
          const cat = (i.category || i.role || '').toLowerCase();
          return cat.includes('kasir') || cat.includes('cashier') || cat.includes('server') || cat.includes('floor');
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

  const pendingSwapCount = swapRequests.filter((s) => {
    const mgmtStatus = (s.management_status || s.status || 'pending').toLowerCase();
    const targetStatusRaw = (s.target_status && s.target_status !== 'pending' ? s.target_status : s.status) || '';
    const isRejectedByStaff = targetStatusRaw.toLowerCase() === 'rejected' || targetStatusRaw.toLowerCase() === 'tolak';
    return mgmtStatus === 'pending' && !isRejectedByStaff;
  }).length;

  const pendingLeaveCount = leaveRequests.filter((l) => l.status?.toLowerCase() === 'pending').length;
  const totalPendingApproval = pendingSwapCount + pendingLeaveCount;

  useEffect(() => {
    if (!loading) {
      if (pendingLeaveCount > 0 && pendingSwapCount === 0) setApprovalTab('leave');
      else if (pendingSwapCount > 0 && pendingLeaveCount === 0) setApprovalTab('swap');
    }
  }, [pendingSwapCount, pendingLeaveCount, loading]);

  const sortedSwapRequests = [...swapRequests].sort((a, b) => {
    const aTarget = ((a.target_status && a.target_status !== 'pending' ? a.target_status : a.status) || '').toLowerCase();
    const bTarget = ((b.target_status && b.target_status !== 'pending' ? b.target_status : b.status) || '').toLowerCase();
    const aMgmt = (a.management_status || a.status || 'pending').toLowerCase();
    const bMgmt = (b.management_status || b.status || 'pending').toLowerCase();

    const aNeedsAcc = (aTarget === 'accepted' || aTarget === 'setuju' || aTarget === 'approved') && aMgmt === 'pending';
    const bNeedsAcc = (bTarget === 'accepted' || bTarget === 'setuju' || bTarget === 'approved') && bMgmt === 'pending';

    if (aNeedsAcc && !bNeedsAcc) return -1;
    if (!aNeedsAcc && bNeedsAcc) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const sortedLeaveRequests = [...leaveRequests].sort((a, b) => {
    const aPending = a.status?.toLowerCase() === 'pending';
    const bPending = b.status?.toLowerCase() === 'pending';
    if (aPending && !bPending) return -1;
    if (!aPending && bPending) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const handleApproveSwap = async (swapId: number, status: 'approved' | 'rejected') => {
    try {
      const { error: primaryError } = await supabase
        .from('shift_swaps')
        .update({
          management_status: status,
          status: status === 'approved' ? 'Approved' : 'Rejected',
        })
        .eq('id', swapId);

      if (primaryError) {
        const { error: fallbackError } = await supabase
          .from('shift_swaps')
          .update({ status: status === 'approved' ? 'Approved' : 'Rejected' })
          .eq('id', swapId);
        if (fallbackError) throw fallbackError;
      }

      const swapItem = swapRequests.find((s) => s.id === swapId) as any;

      // Jika di-ACC, tukar jadwal di tabel schedules secara otomatis
      if (status === 'approved' && swapItem?.week_number && swapItem?.swap_date && swapItem?.requester_shift && swapItem?.target_shift) {
        await supabase
          .from('schedules')
          .update({ shift: swapItem.target_shift })
          .match({
            staff_id: swapItem.requester_staff_id,
            week_number: swapItem.week_number,
            day: swapItem.swap_date,
          });

        await supabase
          .from('schedules')
          .update({ shift: swapItem.requester_shift })
          .match({
            staff_id: swapItem.target_staff_id,
            week_number: swapItem.week_number,
            day: swapItem.swap_date,
          });
      }

      const requesterName = swapItem?.requester_staff_name || swapItem?.requester_name || swapItem?.requester_staff_id || '-';
      const targetName = swapItem?.target_staff_name || swapItem?.target_name || swapItem?.target_staff_id || '-';
      const jadwalText = swapItem?.week_number
        ? `Minggu ${swapItem.week_number} • ${swapItem.swap_date || swapItem.date || '-'}`
        : swapItem?.swap_date || swapItem?.date || '-';
      const shiftDetailText =
        swapItem?.requester_shift && swapItem?.target_shift
          ? `${swapItem.requester_shift} 🔄 ${swapItem.target_shift}`
          : undefined;

      // 1. Kirim Notifikasi ke Grup Operasional
      await sendTelegramAlert({
        title: status === 'approved' ? '✅ TUKAR SHIFT DI-ACC MANAGEMENT' : '❌ TUKAR SHIFT DITOLAK MANAGEMENT',
        actor: `${currentUser.name} (${currentUser.staff_id})`,
        details: {
          'Pemohon': requesterName,
          'Pengganti': targetName,
          'Jadwal': jadwalText,
          ...(shiftDetailText ? { 'Detail Shift': shiftDetailText } : {}),
        },
      });

      // 2. Kirim Notifikasi Personal ke Karyawan Pemohon & Karyawan Tujuan
      const targetIds = [swapItem?.requester_staff_id, swapItem?.target_staff_id].filter(Boolean);
      if (targetIds.length > 0) {
        const { data: staffRows } = await supabase
          .from('staff')
          .select('staff_id, telegram_chat_id')
          .in('staff_id', targetIds);

        for (const s of staffRows || []) {
          if (s.telegram_chat_id) {
            await sendTelegramAlert({
              title:
                status === 'approved'
                  ? '✅ TUKAR SHIFT ANDA DISETUJUI MANAGEMENT'
                  : '❌ TUKAR SHIFT ANDA DITOLAK MANAGEMENT',
              actor: `${currentUser.name} (${currentUser.staff_id})`,
              details: {
                'Pasangan Tukar': `${requesterName} ↔️ ${targetName}`,
                'Jadwal': jadwalText,
                ...(shiftDetailText ? { 'Detail Shift': shiftDetailText } : {}),
                'Keputusan Final':
                  status === 'approved'
                    ? 'Disetujui & Roster Kerja Telah Diperbarui'
                    : 'Ditolak oleh Management (Jadwal tetap seperti semula)',
              },
              targetChatId: s.telegram_chat_id,
            });
          }
        }
      }

      setSwapRequests((prev) =>
        prev.map((item) =>
          item.id === swapId
            ? { ...item, management_status: status, status: status === 'approved' ? 'Approved' : 'Rejected' }
            : item
        )
      );
      alert(status === 'approved' ? '✅ Tukar Shift Berhasil Di-ACC!' : '❌ Tukar Shift Ditolak!');
      fetchAnalyticsData();
    } catch (err: any) {
      alert(`Gagal memproses persetujuan: ${err.message}`);
    }
  };

  const handleApproveLeave = async (leaveItem: LeaveRequest, status: 'approved' | 'rejected') => {
    if (status === 'approved') {
      try {
        const { data: scheduleData } = await supabase.from('staff_schedules').select('*').gte('date', leaveItem.start_date).lte('date', leaveItem.end_date || leaveItem.start_date);
        const otherWorkingStaff = scheduleData?.filter((s) => s.staff_id !== leaveItem.staff_id) || [];
        if (otherWorkingStaff.length === 0) {
          const confirmAcc = window.confirm(
            `⚠️ PERINGATAN OPERASIONAL KOSONG!\n\nStaf ${leaveItem.staff_name} (${leaveItem.staff_id}) adalah SATU-SATUNYA staf yang dijadwalkan pada ${leaveItem.start_date}.\n\nJika pengajuan ini di-ACC, outlet/shift tersebut akan KOSONG tanpa penjaga.\n\nApakah Manajemen tetap yakin meng-ACC?`
          );
          if (!confirmAcc) return;
        }
      } catch (err) {
        console.warn('Gagal memvalidasi kuota jadwal staf:', err);
      }
    }

    const { error } = await supabase.from('leave_requests').update({ status }).eq('id', leaveItem.id);
    if (error) {
      alert(`Gagal memproses izin: ${error.message}`);
      return;
    }

    const dateRangeStr = `${leaveItem.start_date} s/d ${leaveItem.end_date || leaveItem.start_date}`;

    // 1. Kirim Notifikasi ke Grup Operasional
    await sendTelegramAlert({
      title:
        status === 'approved'
          ? `✅ PENGAJUAN ${leaveItem.leave_type.toUpperCase()} DI-ACC`
          : `❌ PENGAJUAN ${leaveItem.leave_type.toUpperCase()} DITOLAK`,
      actor: `${currentUser.name} (${currentUser.staff_id})`,
      details: {
        'Staf': `${leaveItem.staff_name} (${leaveItem.staff_id})`,
        'Jenis': leaveItem.leave_type,
        'Tanggal': dateRangeStr,
      },
    });

    // 2. Kirim Notifikasi Personal Langsung ke Karyawan Pengaju
    if (leaveItem.staff_id) {
      const { data: requesterProfile } = await supabase
        .from('staff')
        .select('telegram_chat_id')
        .eq('staff_id', leaveItem.staff_id)
        .single();

      if (requesterProfile?.telegram_chat_id) {
        await sendTelegramAlert({
          title:
            status === 'approved'
              ? `✅ PENGAJUAN ${leaveItem.leave_type.toUpperCase()} ANDA DISETUJUI`
              : `❌ PENGAJUAN ${leaveItem.leave_type.toUpperCase()} ANDA DITOLAK`,
          actor: `${currentUser.name} (${currentUser.staff_id})`,
          details: {
            'Jenis Pengajuan': leaveItem.leave_type,
            'Tanggal': dateRangeStr,
            'Alasan Anda': leaveItem.reason || '-',
            'Status':
              status === 'approved'
                ? 'Disetujui oleh Management'
                : 'Ditolak oleh Management (Silakan hubungi Management untuk info lanjut)',
          },
          targetChatId: requesterProfile.telegram_chat_id,
        });
      }
    }

    setLeaveRequests((prev) => prev.map((item) => (item.id === leaveItem.id ? { ...item, status } : item)));
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
        const { data: staffData } = await supabase.from('staff').select('annual_leave_quota').eq('staff_id', leaveItem.staff_id).single();
        const currentQuota = staffData?.annual_leave_quota ?? 12;
        await supabase.from('staff').update({ annual_leave_quota: Math.max(0, currentQuota - 1) }).eq('staff_id', leaveItem.staff_id);
      }
    }
    alert(status === 'approved' ? `✅ Permintaan ${leaveItem.leave_type} Di-ACC!` : '❌ Permintaan Ditolak!');
    fetchAnalyticsData();
  };

  const totalSopPct = sopStats.total > 0 ? Math.round((sopStats.completed / sopStats.total) * 100) : 0;
  const barSopPct = Math.round((sopStats.barCompleted / sopStats.barTotal) * 100);
  const kitchenSopPct = Math.round((sopStats.kitchenCompleted / sopStats.kitchenTotal) * 100);
  const floorSopPct = Math.round((sopStats.floorCompleted / sopStats.floorTotal) * 100);

  const formatFullDate = (rawDateStr?: string, createdAtStr?: string) => {
    if (!rawDateStr && !createdAtStr) return '-';
    if (rawDateStr && rawDateStr.match(/\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}/)) {
      try {
        const d = new Date(rawDateStr);
        if (!isNaN(d.getTime())) return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
      } catch {}
    }
    if (rawDateStr) return rawDateStr;
    if (createdAtStr) {
      try {
        const d = new Date(createdAtStr);
        if (!isNaN(d.getTime())) return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
      } catch { return createdAtStr; }
    }
    return '-';
  };

  const userRoleLower = (currentUser?.role || '').toLowerCase();
  const roleBadgeLabel = userRoleLower.includes('owner') 
    ? 'Owner Executive Suite' 
    : userRoleLower.includes('general_manager') 
    ? 'General Manager Suite' 
    : 'Management Control Panel';

  return (
    <div className="space-y-4 sm:space-y-6 text-left">
      <style>{`
        @keyframes fadeSlideUp { 0% { opacity: 0; transform: translateY(12px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes slideInFromLeft { 0% { opacity: 0; transform: translateX(-16px); } 100% { opacity: 1; transform: translateX(0); } }
        @keyframes slideInFromRight { 0% { opacity: 0; transform: translateX(16px); } 100% { opacity: 1; transform: translateX(0); } }
        .animate-section-fade { animation: fadeSlideUp 0.45s ease-out forwards; opacity: 0; }
        .animate-tab-left { animation: slideInFromLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-tab-right { animation: slideInFromRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>

      {/* HEADER EXECUTIVE DASHBOARD RESPONSIVE */}
      <div 
        className="animate-section-fade bg-gradient-to-r from-[#111111] via-neutral-900 to-neutral-800 text-white p-4 sm:p-6 md:p-8 rounded-3xl shadow-xl border border-neutral-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
        style={{ animationDelay: '0ms' }}
      >
        <div className="space-y-2 w-full md:w-auto">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[9px] sm:text-[10px] bg-[#d22027] text-white px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">
              {roleBadgeLabel}
            </span>
            <span className="text-[9px] sm:text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Realtime
            </span>
            {totalPendingApproval > 0 && (
              <span className="text-[9px] sm:text-[10px] bg-red-600 text-white font-black px-2 py-0.5 rounded-full animate-bounce">
                ⚠️ {totalPendingApproval} Butuh ACC
              </span>
            )}
          </div>
          <div>
            <h2 className="text-lg sm:text-2xl font-black tracking-tight text-white">Executive Analytics Hub 📊</h2>
            <p className="text-xs text-neutral-400 mt-0.5 max-w-xl leading-relaxed">
              Pusat persetujuan tukar shift/izin, pengawasan operasional, audit keamanan resep, dan kepatuhan SOP Rottherdams.
            </p>
          </div>
        </div>

        <button
          onClick={fetchAnalyticsData}
          className="w-full md:w-auto px-3.5 py-2 sm:py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-bold transition cursor-pointer border border-white/10 active:scale-95 flex items-center justify-center gap-1.5"
        >
          <span>🔄</span> Refresh Manual
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-xs text-neutral-400 animate-pulse">
          Menganalisis metrik operasional dan mengumpulkan log persetujuan dari Supabase...
        </div>
      ) : (
        <>
          <ApprovalCenter
            approvalTab={approvalTab}
            setApprovalTab={setApprovalTab}
            pendingSwapCount={pendingSwapCount}
            pendingLeaveCount={pendingLeaveCount}
            sortedSwapRequests={sortedSwapRequests}
            sortedLeaveRequests={sortedLeaveRequests}
            handleApproveSwap={handleApproveSwap}
            handleApproveLeave={handleApproveLeave}
            setSelectedImage={setSelectedImage}
            formatFullDate={formatFullDate}
          />

          <MetricsSummary
            onDutyCount={onDutyList.length}
            totalStaff={totalStaff}
            totalSopPct={totalSopPct}
            completedSop={sopStats.completed}
            totalSop={sopStats.total}
            totalWorkHours={totalWorkHours}
            screenshotAttemptsCount={screenshotAttemptsCount}
          />

          <SopComplianceMatrix
            sopStats={sopStats}
            totalSopPct={totalSopPct}
            barSopPct={barSopPct}
            kitchenSopPct={kitchenSopPct}
            floorSopPct={floorSopPct}
          />

          <div 
            className="animate-section-fade grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6"
            style={{ animationDelay: '400ms' }}
          >
            <SecurityAuditWidget securityLogs={securityLogs} />
            <OnDutyWidget onDutyList={onDutyList} />
          </div>

          <div 
            className="animate-section-fade bg-white rounded-3xl p-4 sm:p-6 border border-neutral-200 shadow-xs space-y-4"
            style={{ animationDelay: '500ms' }}
          >
            <div className="flex justify-between items-center pb-3 border-b border-neutral-100">
              <h3 className="font-black text-xs sm:text-sm text-[#111111]">📝 Catatan Serah Terima Shift Terbaru (Handover Log)</h3>
              <span className="text-[10px] sm:text-xs text-neutral-400">5 Feed Terakhir</span>
            </div>

            {handoverLogs.length === 0 ? (
              <p className="text-xs text-neutral-400 italic py-4">Belum ada catatan handover shift dari tim operasional.</p>
            ) : (
              <div className="space-y-2.5">
                {handoverLogs.map((log) => (
                  <div key={log.id} className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-[#111111]">{log.staff_name}</span>
                        <span className="text-[8px] bg-neutral-200 px-1.5 py-0.2 rounded-md font-bold uppercase">
                          {log.shift} Shift
                        </span>
                      </div>
                      <span className="text-[9px] font-mono text-neutral-400">
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

      {selectedImage && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white p-4 rounded-3xl max-w-lg w-full space-y-3 relative shadow-2xl border border-neutral-100 max-h-[90vh] overflow-y-auto">
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