export interface ShiftSwapRequest {
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

export interface LeaveRequest {
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

interface ApprovalCenterProps {
  approvalTab: 'swap' | 'leave';
  setApprovalTab: (tab: 'swap' | 'leave') => void;
  pendingSwapCount: number;
  pendingLeaveCount: number;
  sortedSwapRequests: ShiftSwapRequest[];
  sortedLeaveRequests: LeaveRequest[];
  handleApproveSwap: (swapId: number, status: 'approved' | 'rejected') => void;
  handleApproveLeave: (leaveItem: LeaveRequest, status: 'approved' | 'rejected') => void;
  setSelectedImage: (url: string | null) => void;
  formatFullDate: (rawDateStr?: string, createdAtStr?: string) => string;
}

export default function ApprovalCenter({
  approvalTab,
  setApprovalTab,
  pendingSwapCount,
  pendingLeaveCount,
  sortedSwapRequests,
  sortedLeaveRequests,
  handleApproveSwap,
  handleApproveLeave,
  setSelectedImage,
  formatFullDate,
}: ApprovalCenterProps) {
  return (
    <div 
      className="animate-section-fade bg-white rounded-3xl p-5 md:p-6 border-2 border-[#d22027]/20 shadow-md space-y-4 text-left"
      style={{ animationDelay: '100ms' }}
    >
      <style>{`
        .no-scrollbar::-webkit-scrollbar,
        .scrollbar-none::-webkit-scrollbar {
          display: none !important;
          width: 0px !important;
          height: 0px !important;
        }
        .no-scrollbar,
        .scrollbar-none {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }
      `}</style>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-neutral-100">
        <div>
          <h3 className="font-black text-base text-[#111111] flex items-center gap-2">
            <span>🛎️</span> Pusat Persetujuan Operasional (Approval Center)
          </h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Setujui atau tolak permintaan Tukar Shift & Izin/Cuti dari staf operasional.
          </p>
        </div>

        <div className="relative bg-neutral-100 p-1 rounded-2xl flex border border-neutral-200 w-full sm:w-auto">
          <div
            className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-xl transition-all duration-300 ease-out shadow-sm ${
              approvalTab === 'swap'
                ? 'left-1 bg-[#111111]'
                : 'left-[calc(50%+2px)] bg-[#d22027]'
            }`}
          />

          <button
            onClick={() => setApprovalTab('swap')}
            className={`relative z-10 flex-1 px-3.5 py-1.5 text-xs font-extrabold rounded-xl transition-colors duration-200 cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
              approvalTab === 'swap' ? 'text-white' : 'text-neutral-500 hover:text-black'
            }`}
          >
            🔄 Tukar Shift ({pendingSwapCount})
          </button>

          <button
            onClick={() => setApprovalTab('leave')}
            className={`relative z-10 flex-1 px-3.5 py-1.5 text-xs font-extrabold rounded-xl transition-colors duration-200 cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
              approvalTab === 'leave' ? 'text-white' : 'text-neutral-500 hover:text-black'
            }`}
          >
            📄 Izin & Cuti ({pendingLeaveCount})
          </button>
        </div>
      </div>

      <div key={approvalTab} className={approvalTab === 'swap' ? 'animate-tab-left' : 'animate-tab-right'}>
        {approvalTab === 'swap' && (
          <div>
            {sortedSwapRequests.length === 0 ? (
              <p className="text-xs text-neutral-400 italic py-6 text-center">Belum ada pengajuan tukar shift.</p>
            ) : (
              <div>
                {/* 🌟 MOBILE CARD VIEW TUKAR SHIFT */}
                <div className="block md:hidden space-y-3">
                  {sortedSwapRequests.map((item) => {
                    const requesterName = item.requester_staff_name || item.requester_name || 'Staf';
                    const requesterId = item.requester_staff_id || item.requester_id || '-';
                    const targetName = item.target_staff_name || '-';
                    const targetId = item.target_staff_id || '-';

                    const rawSwapDate = item.swap_date || item.shift_date || item.date;
                    const formattedDateDisplay = formatFullDate(rawSwapDate, item.created_at);
                    const shiftInfo = item.requester_shift || item.shift_type || 'Shift';

                    const targetStatusRaw = (item.target_status && item.target_status !== 'pending' ? item.target_status : item.status) || '';
                    const targetStatusLower = targetStatusRaw.toLowerCase();

                    const isAcceptedByStaff = targetStatusLower === 'accepted' || targetStatusLower === 'setuju' || targetStatusLower === 'approved';
                    const isRejectedByStaff = targetStatusLower === 'rejected' || targetStatusLower === 'tolak';

                    const mgmtStatus = (item.management_status || item.status || 'pending').toLowerCase();
                    const isMgmtApproved = mgmtStatus === 'approved';
                    const isMgmtRejected = mgmtStatus === 'rejected';

                    const isNeedsMgmtAction = isAcceptedByStaff && !isMgmtApproved && !isMgmtRejected;

                    return (
                      <div key={item.id} className={`p-4 rounded-2xl border text-xs space-y-3 ${isNeedsMgmtAction ? 'bg-amber-50/80 border-amber-300' : 'bg-neutral-50 border-neutral-200'}`}>
                        <div className="flex justify-between items-start pb-2 border-b border-neutral-200">
                          <div>
                            <span className="text-[10px] font-bold text-neutral-400 block">PEMOHON ➔ PENGGANTI</span>
                            <p className="font-extrabold text-[#111111]">{requesterName} <span className="text-neutral-400 font-normal">({requesterId})</span></p>
                            <p className="text-[#d22027] font-bold mt-0.5">➔ {targetName} <span className="text-neutral-400 font-normal">({targetId})</span></p>
                          </div>
                          
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            isAcceptedByStaff ? 'bg-emerald-100 text-emerald-700' : isRejectedByStaff ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {isAcceptedByStaff ? '🟢 Staf Setuju' : isRejectedByStaff ? '❌ Staf Menolak' : '⏳ Menunggu Staf'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <span className="text-neutral-400 font-bold block">TANGGAL & SHIFT:</span>
                            <span className="font-bold text-neutral-800">{formattedDateDisplay}</span>
                            <span className="block text-[10px] text-[#d22027] font-extrabold uppercase">{shiftInfo}</span>
                          </div>
                          <div>
                            <span className="text-neutral-400 font-bold block">ALASAN:</span>
                            <p className="text-neutral-700 line-clamp-2">{item.reason || '-'}</p>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-neutral-200/60 flex justify-end">
                          {isRejectedByStaff ? (
                            <span className="text-[10px] font-bold text-neutral-400 italic">Batal (Ditolak Staf)</span>
                          ) : isAcceptedByStaff && !isMgmtApproved && !isMgmtRejected ? (
                            <div className="flex gap-2 w-full">
                              <button
                                onClick={() => handleApproveSwap(item.id, 'approved')}
                                className="flex-1 py-1.5 bg-emerald-600 text-white rounded-xl font-bold text-xs shadow-xs"
                              >
                                ✅ ACC Management
                              </button>
                              <button
                                onClick={() => handleApproveSwap(item.id, 'rejected')}
                                className="flex-1 py-1.5 bg-red-600 text-white rounded-xl font-bold text-xs shadow-xs"
                              >
                                ❌ Tolak
                              </button>
                            </div>
                          ) : (
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                              isMgmtApproved ? 'bg-emerald-100 text-emerald-700' : isMgmtRejected ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {isMgmtApproved ? '✅ Management Approved' : isMgmtRejected ? '❌ Management Rejected' : '⏳ Menunggu Staf'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* TABLE STANDAR UNTUK DESKTOP */}
                <div className="hidden md:block overflow-auto no-scrollbar scrollbar-none max-h-[340px] rounded-2xl border border-neutral-200/80">
                  <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                    <thead className="sticky top-0 bg-neutral-100 text-neutral-700 font-bold border-b border-neutral-200 z-10">
                      <tr>
                        <th className="p-3">Pemohon</th>
                        <th className="p-3">Pengganti</th>
                        <th className="p-3">Tanggal & Shift</th>
                        <th className="p-3">Alasan</th>
                        <th className="p-3">Status Pengganti</th>
                        <th className="p-3 text-center">ACC Management</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {sortedSwapRequests.map((item) => {
                        const requesterName = item.requester_staff_name || item.requester_name || 'Staf';
                        const requesterId = item.requester_staff_id || item.requester_id || '-';
                        const targetName = item.target_staff_name || '-';
                        const targetId = item.target_staff_id || '-';

                        const rawSwapDate = item.swap_date || item.shift_date || item.date;
                        const formattedDateDisplay = formatFullDate(rawSwapDate, item.created_at);
                        const shiftInfo = item.requester_shift || item.shift_type || 'Shift';

                        const targetStatusRaw = (item.target_status && item.target_status !== 'pending' ? item.target_status : item.status) || '';
                        const targetStatusLower = targetStatusRaw.toLowerCase();

                        const isAcceptedByStaff = targetStatusLower === 'accepted' || targetStatusLower === 'setuju' || targetStatusLower === 'approved';
                        const isRejectedByStaff = targetStatusLower === 'rejected' || targetStatusLower === 'tolak';

                        const mgmtStatus = (item.management_status || item.status || 'pending').toLowerCase();
                        const isMgmtApproved = mgmtStatus === 'approved';
                        const isMgmtRejected = mgmtStatus === 'rejected';

                        const isNeedsMgmtAction = isAcceptedByStaff && !isMgmtApproved && !isMgmtRejected;

                        return (
                          <tr key={item.id} className={`transition ${isNeedsMgmtAction ? 'bg-amber-50/70 font-semibold' : 'hover:bg-neutral-50'}`}>
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
              </div>
            )}
          </div>
        )}

        {approvalTab === 'leave' && (
          <div>
            {sortedLeaveRequests.length === 0 ? (
              <p className="text-xs text-neutral-400 italic py-6 text-center">Belum ada pengajuan izin atau sakit.</p>
            ) : (
              <div>
                {/* 🌟 MOBILE CARD VIEW IZIN & CUTI */}
                <div className="block md:hidden space-y-3">
                  {sortedLeaveRequests.map((item) => {
                    const isPending = item.status?.toLowerCase() === 'pending';

                    return (
                      <div key={item.id} className={`p-4 rounded-2xl border text-xs space-y-3 ${isPending ? 'bg-amber-50/80 border-amber-300' : 'bg-neutral-50 border-neutral-200'}`}>
                        <div className="flex justify-between items-start pb-2 border-b border-neutral-200">
                          <div>
                            <p className="font-extrabold text-[#111111]">{item.staff_name}</p>
                            <p className="text-[10px] text-neutral-400 font-mono">{item.staff_id}</p>
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                            item.leave_type === 'Sakit' 
                              ? 'bg-blue-50 text-blue-600 border border-blue-200' 
                              : item.leave_type === 'Cuti'
                              ? 'bg-purple-50 text-purple-600 border border-purple-200'
                              : 'bg-amber-50 text-amber-600 border border-amber-200'
                          }`}>
                            {item.leave_type}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <span className="text-neutral-400 font-bold block">TANGGAL:</span>
                            <span className="font-bold text-neutral-800">{item.start_date} s/d {item.end_date || item.start_date}</span>
                          </div>
                          <div>
                            <span className="text-neutral-400 font-bold block">DOKUMEN BUKTI:</span>
                            {item.attachment_url ? (
                              <button
                                onClick={() => setSelectedImage(item.attachment_url || null)}
                                className="px-2 py-0.5 bg-neutral-200 text-neutral-700 rounded-lg text-[10px] font-bold"
                              >
                                🖼️ Lihat Surat
                              </button>
                            ) : (
                              <span className="text-neutral-400 text-[10px] italic">Tidak Ada</span>
                            )}
                          </div>
                        </div>

                        <div>
                          <span className="text-neutral-400 font-bold block">ALASAN / CATATAN:</span>
                          <p className="text-neutral-700">{item.reason || '-'}</p>
                        </div>

                        <div className="pt-2 border-t border-neutral-200/60 flex justify-end">
                          {isPending ? (
                            <div className="flex gap-2 w-full">
                              <button
                                onClick={() => handleApproveLeave(item, 'approved')}
                                className="flex-1 py-1.5 bg-emerald-600 text-white rounded-xl font-bold text-xs shadow-xs"
                              >
                                ✅ ACC
                              </button>
                              <button
                                onClick={() => handleApproveLeave(item, 'rejected')}
                                className="flex-1 py-1.5 bg-red-600 text-white rounded-xl font-bold text-xs shadow-xs"
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
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* TABLE STANDAR UNTUK DESKTOP */}
                <div className="hidden md:block overflow-auto no-scrollbar scrollbar-none max-h-[340px] rounded-2xl border border-neutral-200/80">
                  <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                    <thead className="sticky top-0 bg-neutral-100 text-neutral-700 font-bold border-b border-neutral-200 z-10">
                      <tr>
                        <th className="p-3">Nama Staf</th>
                        <th className="p-3">Tipe Izin</th>
                        <th className="p-3">Tanggal Mulai - Selesai</th>
                        <th className="p-3">Alasan / Catatan</th>
                        <th className="p-3 text-center">Bukti Dokumen</th>
                        <th className="p-3 text-center">Aksi ACC Management</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {sortedLeaveRequests.map((item) => {
                        const isPending = item.status?.toLowerCase() === 'pending';

                        return (
                          <tr key={item.id} className={`transition ${isPending ? 'bg-amber-50/70 font-semibold' : 'hover:bg-neutral-50'}`}>
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
                              {isPending ? (
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
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}