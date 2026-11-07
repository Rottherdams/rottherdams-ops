import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface CurrentUser {
  name: string;
  role: string;
  staff_id: string;
  avatar_url?: string;
}

interface StaffInboxModalProps {
  currentUser: CurrentUser;
  isOpen: boolean;
  onClose: () => void;
  onUpdateSuccess?: () => void;
}

export default function StaffInboxModal({ currentUser, isOpen, onClose, onUpdateSuccess }: StaffInboxModalProps) {
  const [activeTab, setActiveTab] = useState<'incoming' | 'my_requests'>('incoming');
  const [incomingSwaps, setIncomingSwaps] = useState<any[]>([]);
  const [mySwaps, setMySwaps] = useState<any[]>([]);
  const [myLeaves, setMyLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchStaffInbox();

      // ⚡ Realtime Listener untuk Update Status Inbox
      const swapChannel = supabase
        .channel('public:shift_swaps_inbox')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'shift_swaps' },
          () => fetchStaffInbox()
        )
        .subscribe();

      const leaveChannel = supabase
        .channel('public:leave_requests_inbox')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'leave_requests' },
          () => fetchStaffInbox()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(swapChannel);
        supabase.removeChannel(leaveChannel);
      };
    }
  }, [isOpen]);

  const fetchStaffInbox = async () => {
    setLoading(true);
    try {
      // 1. Permintaan Tukar Shift Masuk
      const { data: incomingData } = await supabase
        .from('shift_swaps')
        .select('*')
        .eq('target_staff_id', currentUser.staff_id)
        .order('created_at', { ascending: false });

      // 2. Riwayat Tukar Shift Milik Sendiri
      const { data: mySwapData } = await supabase
        .from('shift_swaps')
        .select('*')
        .eq('requester_staff_id', currentUser.staff_id)
        .order('created_at', { ascending: false });

      // 3. Riwayat Izin / Cuti Milik Sendiri
      const { data: myLeaveData } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('staff_id', currentUser.staff_id)
        .order('created_at', { ascending: false });

      // Enrich Data Avatar
      const allStaffIds = Array.from(
        new Set([
          ...(incomingData || []).map((i: any) => i.requester_staff_id),
          ...(mySwapData || []).map((m: any) => m.target_staff_id),
        ].filter(Boolean))
      );

      let avatarMap: { [id: string]: string } = {};

      if (allStaffIds.length > 0) {
        const { data: staffProfiles } = await supabase
          .from('staff')
          .select('staff_id, avatar_url')
          .in('staff_id', allStaffIds);

        (staffProfiles || []).forEach((s: any) => {
          if (s.avatar_url) avatarMap[s.staff_id] = s.avatar_url;
        });
      }

      setIncomingSwaps(
        (incomingData || []).map((item: any) => ({
          ...item,
          requester_avatar: avatarMap[item.requester_staff_id],
        }))
      );

      setMySwaps(
        (mySwapData || []).map((item: any) => ({
          ...item,
          target_avatar: avatarMap[item.target_staff_id],
        }))
      );

      setMyLeaves(myLeaveData || []);
    } catch (err) {
      console.error('Error fetching staff inbox:', err);
    } finally {
      setLoading(false);
    }
  };

  // 🚀 Update target_status dan status sekaligus agar sinkron ke ManagementDashboard
  const handleRespondSwap = async (swapId: number, response: 'accepted' | 'rejected') => {
    try {
      const targetStatusVal = response === 'accepted' ? 'accepted' : 'rejected';
      const legacyStatusVal = response === 'accepted' ? 'Approved' : 'Rejected';

      const { error } = await supabase
        .from('shift_swaps')
        .update({ 
          target_status: targetStatusVal,
          status: legacyStatusVal
        })
        .eq('id', swapId);

      if (error) throw error;

      alert(response === 'accepted' ? '✅ Anda MENYETUJUI permohonan tukar shift ini. Menunggu ACC Management!' : '❌ Anda MENOLAK permohonan tukar shift ini.');

      setIncomingSwaps((prev) =>
        prev.map((item) => (item.id === swapId ? { ...item, target_status: targetStatusVal, status: legacyStatusVal } : item))
      );

      if (onUpdateSuccess) onUpdateSuccess();
    } catch (err: any) {
      alert('Gagal merespons: ' + err.message);
    }
  };

  if (!isOpen) return null;

  const pendingIncomingCount = incomingSwaps.filter((s) => s.target_status === 'pending' || s.target_status === 'Pending').length;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl border border-neutral-100 max-h-[85vh] flex flex-col text-left">
        {/* Header Modal */}
        <div className="flex justify-between items-center pb-3 border-b border-neutral-100">
          <div>
            <h3 className="font-black text-base text-[#111111] flex items-center gap-2">
              📬 Kotak Masuk & Status Pengajuan
            </h3>
            <p className="text-xs text-neutral-400">Kelola persetujuan tukar shift dan pantau status izin kamu.</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-500 font-bold text-xs flex items-center justify-center cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="bg-neutral-100 p-1 rounded-2xl flex gap-1 border border-neutral-200 shrink-0">
          <button
            onClick={() => setActiveTab('incoming')}
            className={`flex-1 py-2 text-xs font-extrabold rounded-xl transition cursor-pointer relative ${
              activeTab === 'incoming' ? 'bg-[#111111] text-white shadow-xs' : 'text-neutral-500 hover:text-black'
            }`}
          >
            📥 Permintaan Masuk
            {pendingIncomingCount > 0 && (
              <span className="ml-1.5 bg-[#d22027] text-white text-[9px] px-1.5 py-0.2 rounded-full font-black animate-pulse">
                {pendingIncomingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('my_requests')}
            className={`flex-1 py-2 text-xs font-extrabold rounded-xl transition cursor-pointer ${
              activeTab === 'my_requests' ? 'bg-[#d22027] text-white shadow-xs' : 'text-neutral-500 hover:text-black'
            }`}
          >
            📋 Status Pengajuan Saya
          </button>
        </div>

        {/* Content Section */}
        <div className="overflow-y-auto flex-1 pr-1 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-xs text-neutral-400 animate-pulse">Memuat data inbox...</div>
          ) : activeTab === 'incoming' ? (
            incomingSwaps.length === 0 ? (
              <p className="text-xs text-neutral-400 italic py-10 text-center">Tidak ada permintaan tukar shift masuk.</p>
            ) : (
              incomingSwaps.map((item) => {
                const targetStat = (item.target_status || '').toLowerCase();
                const isAccepted = targetStat === 'accepted' || targetStat === 'approved';
                const isRejected = targetStat === 'rejected';

                return (
                  <div key={item.id} className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-2.5">
                        {item.requester_avatar ? (
                          <img
                            src={item.requester_avatar}
                            alt={item.requester_staff_name}
                            className="w-8 h-8 rounded-full object-cover border border-neutral-200"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-neutral-200 text-neutral-700 flex items-center justify-center font-bold text-xs">
                            {(item.requester_staff_name || item.requester_name)?.[0] || '👤'}
                          </div>
                        )}
                        <div>
                          <p className="font-extrabold text-xs text-[#111111]">
                            {item.requester_staff_name || item.requester_name} <span className="text-neutral-400 font-normal">minta tukar shift</span>
                          </p>
                          <p className="text-[11px] font-bold text-[#d22027] mt-0.5">
                            📅 Jadwal: {item.swap_date || item.shift_date} ({item.requester_shift || item.shift_type})
                          </p>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black shrink-0 ${
                        isAccepted ? 'bg-emerald-100 text-emerald-700' : isRejected ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {isAccepted ? '🟢 Kamu Setujui' : isRejected ? '❌ Kamu Tolak' : '⏳ Butuh Responmu'}
                      </span>
                    </div>

                    {item.reason && (
                      <p className="text-xs text-neutral-600 bg-white p-2.5 rounded-xl border border-neutral-100 italic">
                        "{item.reason}"
                      </p>
                    )}

                    {!isAccepted && !isRejected && (
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleRespondSwap(item.id, 'accepted')}
                          className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition cursor-pointer active:scale-95"
                        >
                          ✅ Setujui & Teruskan ke Management
                        </button>
                        <button
                          onClick={() => handleRespondSwap(item.id, 'rejected')}
                          className="py-1.5 px-3 bg-red-100 hover:bg-red-200 text-red-700 font-bold rounded-xl text-xs transition cursor-pointer active:scale-95"
                        >
                          ❌ Tolak
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )
          ) : (
            <div className="space-y-4">
              {/* 1. Pengajuan Tukar Shift Saya */}
              <div>
                <h4 className="text-xs font-black text-neutral-700 uppercase tracking-wider mb-2">🔄 Tukar Shift Saya</h4>
                {mySwaps.length === 0 ? (
                  <p className="text-[11px] text-neutral-400 italic">Belum pernah mengajukan tukar shift.</p>
                ) : (
                  <div className="space-y-2">
                    {mySwaps.map((sw) => (
                      <div key={sw.id} className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200 text-xs flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          {sw.target_avatar ? (
                            <img
                              src={sw.target_avatar}
                              alt={sw.target_staff_name}
                              className="w-7 h-7 rounded-full object-cover border border-neutral-200"
                            />
                          ) : null}
                          <div>
                            <p className="font-bold text-[#111111]">Tukar dengan: {sw.target_staff_name}</p>
                            <p className="text-[10px] text-neutral-400">{sw.swap_date || sw.shift_date}</p>
                          </div>
                        </div>

                        <div className="text-right space-y-0.5">
                          <span className={`block px-2 py-0.5 rounded text-[9px] font-bold ${
                            (sw.target_status || '').toLowerCase().includes('accept') || (sw.status || '').toLowerCase() === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                          }`}>
                            Staf: {(sw.target_status || '').toLowerCase().includes('accept') || (sw.status || '').toLowerCase() === 'approved' ? 'Setuju' : 'Pending'}
                          </span>
                          <span className={`block px-2 py-0.5 rounded text-[9px] font-extrabold ${
                            sw.management_status === 'approved' ? 'bg-emerald-100 text-emerald-700' : sw.management_status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-neutral-200 text-neutral-700'
                          }`}>
                            ACC Mgmt: {sw.management_status?.toUpperCase() || 'PENDING'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Pengajuan Izin / Cuti Saya */}
              <div>
                <h4 className="text-xs font-black text-neutral-700 uppercase tracking-wider mb-2">📄 Izin / Cuti Saya</h4>
                {myLeaves.length === 0 ? (
                  <p className="text-[11px] text-neutral-400 italic">Belum pernah mengajukan izin.</p>
                ) : (
                  <div className="space-y-2">
                    {myLeaves.map((lv) => (
                      <div key={lv.id} className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200 text-xs flex justify-between items-center">
                        <div>
                          <span className="font-extrabold text-[#d22027]">{lv.leave_type}</span>
                          <p className="text-[10px] text-neutral-500">{lv.start_date} s/d {lv.end_date || lv.start_date}</p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                          lv.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : lv.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {lv.status === 'approved' ? '✅ Disetujui' : lv.status === 'rejected' ? '❌ Ditolak' : '⏳ Pending'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}