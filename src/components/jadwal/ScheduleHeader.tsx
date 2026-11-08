interface CurrentUser {
  name: string;
  role: string;
  staff_id: string;
  avatar_url?: string;
}

interface ScheduleHeaderProps {
  currentUser?: CurrentUser | null;
  isManagement: boolean;
  pendingInboxCount: number;
  selectedWeek: number;
  currentWeekNow: number;
  weeks: number[];
  onWeekChange: (week: number) => void;
  onOpenInbox: () => void;
  onOpenLeaveModal: () => void;
  onOpenSwapModal: () => void;
  onOpenEditModal: () => void;
}

export default function ScheduleHeader({
  currentUser,
  isManagement,
  pendingInboxCount,
  selectedWeek,
  currentWeekNow,
  weeks,
  onWeekChange,
  onOpenInbox,
  onOpenLeaveModal,
  onOpenSwapModal,
  onOpenEditModal,
}: ScheduleHeaderProps) {
  const selectedWeekIndex = weeks.indexOf(selectedWeek);

  return (
    <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6 pb-4 border-b border-neutral-100 text-left">
      <div>
        <span className="text-[10px] uppercase font-bold text-[#d22027] tracking-widest">
          ROSTER KERJA KARYAWAN
        </span>
        <h2 className="text-xl font-bold text-[#111111] mt-0.5">
          Jadwal Operasional Rottherdams
        </h2>
        <p className="text-xs text-neutral-400 mt-0.5">
          Shift 1 (09.00 - 17.00) | Shift 2 (15.00 - 23.00)
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {currentUser && (
          <>
            <button
              onClick={onOpenInbox}
              className="px-3.5 py-1.5 bg-[#111111] hover:bg-black text-white rounded-2xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs relative"
            >
              <span>🔔</span> Inbox & Status
              {pendingInboxCount > 0 && (
                <span className="bg-[#d22027] text-white text-[9px] px-1.5 py-0.2 rounded-full font-black animate-bounce">
                  {pendingInboxCount}
                </span>
              )}
            </button>

            <button
              onClick={onOpenLeaveModal}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <span>📩</span> Ajukan Izin / Cuti
            </button>

            <button
              onClick={onOpenSwapModal}
              className="px-3.5 py-1.5 bg-white text-[#111111] border border-neutral-300 rounded-2xl text-xs font-bold hover:bg-neutral-100 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <span>🔄</span> Tukar Shift
            </button>
          </>
        )}

        {isManagement && (
          <button
            onClick={onOpenEditModal}
            className="px-3.5 py-1.5 bg-[#111111] text-white rounded-2xl text-xs font-bold hover:bg-neutral-800 transition cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <span>✏️</span> Edit Roster
          </button>
        )}

        <div className="flex items-center gap-2 bg-neutral-100 p-1 rounded-2xl border border-neutral-200">
          <span className="text-[10px] font-bold text-neutral-400 pl-2 hidden sm:inline">Minggu:</span>
          
          <div className="relative flex items-center gap-1">
            <div
              className="absolute top-0 bottom-0 bg-[#d22027] rounded-xl transition-all duration-300 ease-out shadow-xs"
              style={{
                width: '36px',
                transform: `translateX(${selectedWeekIndex * 40}px)`,
              }}
            />

            {weeks.map(w => {
              const isCurrent = currentWeekNow === w;
              const isActive = selectedWeek === w;
              return (
                <button
                  key={w}
                  onClick={() => onWeekChange(w)}
                  className={`relative z-10 w-[36px] py-1.5 rounded-xl text-xs font-extrabold transition-colors duration-200 cursor-pointer text-center ${
                    isActive
                      ? 'text-white'
                      : 'text-neutral-600 hover:text-[#111111]'
                  }`}
                >
                  M{w}
                  {isCurrent && (
                    <span
                      className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                        isActive ? 'bg-amber-300 animate-pulse' : 'bg-[#d22027]'
                      }`}
                      title="Minggu Saat Ini"
                    ></span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}