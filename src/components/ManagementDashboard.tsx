import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface CurrentUser {
  name: string;
  role: 'management' | 'kasir' | 'bar' | 'dapur' | 'owner';
  staff_id: string;
}

interface ManagementDashboardProps {
  currentUser: CurrentUser;
}

export default function ManagementDashboard({ currentUser }: ManagementDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [totalStaff, setTotalStaff] = useState(0);
  const [onDutyCount, setOnDutyCount] = useState(0);
  const [sopStats, setSopStats] = useState({ completed: 0, total: 0 });
  const [handoverCount, setHandoverCount] = useState(0);

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    setLoading(true);

    try {
      // 1. Hitung Total Staf Aktif
      const { count: staffCount } = await supabase
        .from('staff')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Aktif');

      // 2. Hitung Staf On Duty Hari Ini
      const { count: attendanceCount } = await supabase
        .from('attendances')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'On Duty');

      // 3. Hitung Penyelesaian SOP Harian
      const { data: sopData } = await supabase
        .from('sop_checklists')
        .select('is_completed');

      // 4. Hitung Total Catatan Handover Log
      const { count: logCount } = await supabase
        .from('handover_logs')
        .select('*', { count: 'exact', head: true });

      setTotalStaff(staffCount || 0);
      setOnDutyCount(attendanceCount || 0);
      if (sopData) {
        setSopStats({
          completed: sopData.filter(item => item.is_completed).length,
          total: sopData.length,
        });
      }
      setHandoverCount(logCount || 0);
    } catch (err) {
      console.error('Error fetching dashboard analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const sopPercentage = sopStats.total > 0 
    ? Math.round((sopStats.completed / sopStats.total) * 100) 
    : 0;

  return (
    <div className="space-y-6 text-left">
      {/* Header Dashboard */}
      <div className="bg-gradient-to-r from-[#111111] to-neutral-800 text-white p-6 rounded-3xl shadow-xl border border-neutral-800 flex justify-between items-center">
        <div>
          <span className="text-[10px] bg-[#d22027] text-white px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
            {currentUser.role === 'owner' ? 'Owner Executive View' : 'Management View'}
          </span>
          <h2 className="text-xl font-black mt-2">Executive Analytics Hub 📊</h2>
          <p className="text-xs text-neutral-400 mt-1">
            Ringkasan performa tim, kepatuhan SOP, dan log operasional Rottherdams.
          </p>
        </div>
        <button
          onClick={fetchAnalyticsData}
          className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition cursor-pointer border border-white/10 active:scale-95"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Ringkasan Metric Cards */}
      {loading ? (
        <div className="py-12 text-center text-xs text-neutral-400 animate-pulse">
          Menganalisis data operasional dari database...
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Card 1: Staf On Duty */}
          <div className="bg-white p-5 rounded-3xl border border-neutral-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">👥</span>
              <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-md">
                Real-time
              </span>
            </div>
            <p className="text-2xl font-black text-[#111111]">
              {onDutyCount} <span className="text-xs font-normal text-neutral-400">/ {totalStaff} Staf</span>
            </p>
            <p className="text-[11px] font-bold text-neutral-500 mt-1">Sedang On-Duty</p>
          </div>

          {/* Card 2: Kepatuhan SOP */}
          <div className="bg-white p-5 rounded-3xl border border-neutral-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">📋</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                sopPercentage >= 80 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
              }`}>
                {sopPercentage}%
              </span>
            </div>
            <p className="text-2xl font-black text-[#111111]">
              {sopStats.completed} <span className="text-xs font-normal text-neutral-400">/ {sopStats.total} SOP</span>
            </p>
            <p className="text-[11px] font-bold text-neutral-500 mt-1">Tugas SOP Selesai</p>
          </div>

          {/* Card 3: Handover Log */}
          <div className="bg-white p-5 rounded-3xl border border-neutral-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">📝</span>
              <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md">
                Total
              </span>
            </div>
            <p className="text-2xl font-black text-[#111111]">{handoverCount}</p>
            <p className="text-[11px] font-bold text-neutral-500 mt-1">Catatan Handover Log</p>
          </div>

          {/* Card 4: Status Operasional */}
          <div className="bg-white p-5 rounded-3xl border border-neutral-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">🏬</span>
              <span className="text-[10px] font-bold bg-red-50 text-[#d22027] px-2 py-0.5 rounded-md">
                Rottherdams
              </span>
            </div>
            <p className="text-lg font-black text-[#111111]">Operational OK</p>
            <p className="text-[11px] font-bold text-emerald-600 mt-1">🟢 All Systems Normal</p>
          </div>
        </div>
      )}

      {/* Progress Bar SOP */}
      <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-extrabold text-sm text-[#111111]">Tingkat Penyelesaian SOP Operasional Harian</h3>
          <span className="text-xs font-bold text-[#d22027]">{sopPercentage}% Completed</span>
        </div>
        <div className="w-full bg-neutral-100 rounded-full h-3.5 overflow-hidden p-0.5 border border-neutral-200">
          <div
            className="bg-[#d22027] h-full rounded-full transition-all duration-500"
            style={{ width: `${sopPercentage}%` }}
          ></div>
        </div>
        <p className="text-[11px] text-neutral-400 mt-2">
          {sopStats.completed} dari {sopStats.total} item SOP telah ditandai selesai.
        </p>
      </div>
    </div>
  );
}