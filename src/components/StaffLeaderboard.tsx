import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface StaffMember {
  id?: number;
  staff_id: string;
  name?: string;
  staff_name?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  role: string;
  points?: number;
  status?: string;
}

interface AttendanceRecord {
  staff_id: string;
  status: string;
}

interface SopRecord {
  completed_by: string;
  status: string;
}

export default function StaffLeaderboard() {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [sopLogs, setSopLogs] = useState<SopRecord[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isLoaderFadingOut, setIsLoaderFadingOut] = useState(false);
  const [visibleCount, setVisibleCount] = useState<number>(0);

  useEffect(() => {
    fetchLeaderboardData();
  }, []);

  const fetchLeaderboardData = async () => {
    setLoading(true);
    setIsLoaderFadingOut(false);
    setVisibleCount(0);

    const { data: staffData } = await supabase
      .from('staff')
      .select('staff_id, staff_name, first_name, last_name, avatar_url, role, points, status')
      .order('points', { ascending: false });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { data: attData } = await supabase
      .from('attendances')
      .select('staff_id, status')
      .gte('clock_in', startOfMonth);

    const { data: sopData } = await supabase
      .from('sop_checklists')
      .select('completed_by, status')
      .gte('created_at', startOfMonth);

    let countStaff = 0;

    if (staffData) {
      const filteredStaff = staffData.filter(staf => {
        const roleLower = String(staf.role || '').toLowerCase().trim();
        const idUpper = String(staf.staff_id || '').toUpperCase().trim();
        const nameLower = String(staf.staff_name || staf.first_name || '').toLowerCase().trim();

        const isManagementOrExecutive = 
          roleLower.includes('management') || 
          roleLower.includes('mng') || 
          roleLower.includes('general_manager') ||
          roleLower.includes('spv') ||
          roleLower.includes('hrd') ||
          roleLower.includes('finance') ||
          idUpper.startsWith('MNG') ||
          nameLower.includes('renal');

        const isOwner = 
          roleLower.includes('owner') || 
          roleLower.includes('own') || 
          idUpper.startsWith('OWN');

        return !isManagementOrExecutive && !isOwner && staf.status !== 'Resign';
      });

      setStaffList(filteredStaff);
      countStaff = filteredStaff.length;
    }

    if (attData) setAttendances(attData);
    if (sopData) setSopLogs(sopData);

    setTimeout(() => {
      setIsLoaderFadingOut(true);

      setTimeout(() => {
        setLoading(false);

        if (countStaff > 0) {
          let current = 0;
          const interval = setInterval(() => {
            current += 1;
            setVisibleCount(current);
            if (current >= countStaff) {
              clearInterval(interval);
            }
          }, 120);
        }
      }, 300);
    }, 400);
  };

  const calculateCalculatedPoints = (staf: StaffMember) => {
    const basePoints = staf.points || 100;
    const displayName = staf.staff_name || 
      (staf.first_name ? `${staf.first_name} ${staf.last_name || ''}`.trim() : staf.name || staf.staff_id);

    const myAttendances = attendances.filter(a => a.staff_id === staf.staff_id);
    const totalHadir = myAttendances.filter(a =>
      ['On Duty', 'Completed', 'Hadir', 'Selesai'].includes(a.status)
    ).length;
    const totalAlpha = myAttendances.filter(a => a.status === 'Alpha').length;

    const totalSopDone = sopLogs.filter(
      s => s.completed_by === displayName || s.completed_by === staf.staff_id
    ).length;

    const finalPoints = Math.max(0, basePoints + totalHadir * 5 + totalSopDone * 2 - totalAlpha * 15);

    return {
      displayName,
      finalPoints,
      totalHadir,
      totalAlpha,
      totalSopDone,
    };
  };

  const rankedStaff = staffList
    .map(staf => ({
      ...staf,
      stats: calculateCalculatedPoints(staf),
    }))
    .sort((a, b) => b.stats.finalPoints - a.stats.finalPoints);

  return (
    <div className="bg-white rounded-3xl p-5 md:p-6 border border-neutral-200 shadow-sm text-left space-y-5">
      <div className="flex justify-between items-center pb-3.5 border-b border-neutral-100">
        <div>
          <h2 className="text-base md:text-lg font-black text-[#111111] flex items-center gap-2">
            🏆 Leaderboard & Gamification Staf
          </h2>
          <p className="text-[11px] md:text-xs text-neutral-400 mt-0.5">
            Peringkat kedisiplinan dan kontribusi tim lapangan Rottherdams bulan ini.
          </p>
        </div>
        <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full font-bold">
          Roster Season
        </span>
      </div>

      {loading ? (
        <div
          className={`py-10 flex flex-col items-center justify-center gap-3 transition-all duration-300 ease-in-out transform ${
            isLoaderFadingOut ? 'opacity-0 scale-95 -translate-y-2' : 'opacity-100 scale-100 translate-y-0'
          }`}
        >
          <div className="w-6 h-6 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold text-neutral-500 animate-pulse">
            Menghitung perolehan poin tim...
          </p>
        </div>
      ) : rankedStaff.length === 0 ? (
        <div className="py-8 text-center text-xs text-neutral-400">
          Belum ada data aktivitas staf lapangan bulan ini.
        </div>
      ) : (
        <div className="space-y-3">
          {rankedStaff.slice(0, visibleCount).map((staf, rankIdx) => {
            const rank = rankIdx + 1;
            const isTop1 = rank === 1;
            const isTop2 = rank === 2;
            const isTop3 = rank === 3;

            return (
              <div
                key={staf.staff_id}
                className={`p-3.5 md:p-4 rounded-2xl border transition-all duration-500 ease-out flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transform animate-in fade-in slide-in-from-bottom-4 ${
                  isTop1
                    ? 'bg-amber-50/70 border-amber-300 shadow-xs'
                    : isTop2
                    ? 'bg-slate-50 border-slate-300'
                    : isTop3
                    ? 'bg-orange-50/50 border-orange-200'
                    : 'bg-white border-neutral-200'
                }`}
              >
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div
                    className={`w-9 h-9 md:w-10 md:h-10 rounded-2xl flex items-center justify-center font-black text-xs md:text-sm shrink-0 ${
                      isTop1
                        ? 'bg-amber-400 text-white shadow-md'
                        : isTop2
                        ? 'bg-slate-300 text-slate-800'
                        : isTop3
                        ? 'bg-amber-700 text-white'
                        : 'bg-neutral-100 text-neutral-500'
                    }`}
                  >
                    {isTop1 ? '🥇' : isTop2 ? '🥈' : isTop3 ? '🥉' : `#${rank}`}
                  </div>

                  {staf.avatar_url ? (
                    <img
                      src={staf.avatar_url}
                      alt={staf.stats.displayName}
                      className="w-9 h-9 md:w-10 md:h-10 rounded-full object-cover border-2 border-white shadow-xs shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-neutral-200 text-neutral-700 flex items-center justify-center font-bold text-xs shrink-0">
                      {staf.first_name?.[0] || staf.stats.displayName[0]}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="font-extrabold text-xs md:text-sm text-[#111111] truncate">
                        {staf.stats.displayName}
                      </h4>
                      
                      <span className="text-[8px] md:text-[9px] px-1.5 py-0.5 bg-neutral-100 text-neutral-600 rounded-md uppercase font-mono border border-neutral-200 capitalize shrink-0">
                        {staf.role?.replace(/_/g, ' ')}
                      </span>

                      {isTop1 && (
                        <span className="text-[8px] md:text-[9px] bg-amber-500 text-white font-black px-1.5 py-0.5 rounded-full shrink-0">
                          🏆 SOP Master
                        </span>
                      )}
                      {staf.stats.totalAlpha === 0 && (
                        <span className="text-[8px] md:text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full border border-emerald-200 shrink-0">
                          🛡️ Perfect Attendance
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2.5 text-[9px] md:text-[10px] text-neutral-500 mt-0.5 font-mono">
                      <span>🟢 Hadir: <strong>{staf.stats.totalHadir}d</strong></span>
                      <span>📋 SOP Done: <strong>{staf.stats.totalSopDone}x</strong></span>
                      {staf.stats.totalAlpha > 0 && (
                        <span className="text-red-500">🔴 Alpha: <strong>{staf.stats.totalAlpha}d</strong></span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right self-end sm:self-center shrink-0">
                  <span className="text-[10px] text-neutral-400 font-bold block">Total Performa</span>
                  <span className="text-base md:text-lg font-black text-[#d22027] font-mono">
                    {staf.stats.finalPoints} <span className="text-xs text-neutral-500">Pts</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}