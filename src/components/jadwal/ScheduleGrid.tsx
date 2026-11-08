export interface StaffSummary {
  staff_id: string;
  staff_name: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  role: string;
  status: string;
  shifts: { [day: string]: string };
  restWarnings: { [day: string]: boolean };
  hasAnyRestWarning: boolean;
  total_shift: number;
  total_shift_1: number;
  total_shift_2: number;
  total_off: number;
}

interface CurrentUser {
  name: string;
  role: string;
  staff_id: string;
  avatar_url?: string;
}

interface ScheduleGridProps {
  staffSummaries: StaffSummary[];
  days: string[];
  dateLabels: { [day: string]: string };
  currentSelectedWeekDates: string[];
  selectedDay: string;
  selectedWeek: number;
  animKey: number;
  isManagement: boolean;
  currentUser?: CurrentUser | null;
  onDayChange: (day: string) => void;
  isSameDate: (dateString: string) => boolean;
}

export default function ScheduleGrid({
  staffSummaries,
  days,
  dateLabels,
  currentSelectedWeekDates,
  selectedDay,
  selectedWeek,
  animKey,
  isManagement,
  currentUser,
  onDayChange,
  isSameDate,
}: ScheduleGridProps) {
  const selectedDayIndex = days.indexOf(selectedDay);

  return (
    <div className="text-left relative">
      {/* 🌟 CSS GLOBAL MENYEMBUNYIKAN SCROLLBAR HORIZONTAL & VERTIKAL */}
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

      {/* Sliding Tab Hari Mobile (Disembunyikan Scrollbar-nya) */}
      <div className="md:hidden relative flex gap-1 overflow-x-auto pb-3 no-scrollbar scrollbar-none mb-3 border-b border-neutral-100">
        <div
          className="absolute top-0 h-[32px] bg-[#111111] rounded-xl transition-all duration-300 ease-out"
          style={{
            width: '90px',
            transform: `translateX(${selectedDayIndex * 94}px)`,
          }}
        />

        {days.map((day, idx) => {
          const isToday = isSameDate(currentSelectedWeekDates[idx]);
          const isActive = selectedDay === day;

          return (
            <button
              key={day}
              onClick={() => onDayChange(day)}
              className={`relative z-10 min-w-[90px] py-1.5 rounded-xl text-xs font-bold transition-colors duration-200 cursor-pointer whitespace-nowrap text-center ${
                isActive
                  ? 'text-white'
                  : 'text-neutral-500 hover:text-black'
              }`}
            >
              {day} {dateLabels[day] && `(${dateLabels[day]})`}
              {isToday && (
                <span
                  className={`ml-1 inline-block w-1.5 h-1.5 rounded-full ${
                    isActive ? 'bg-amber-300 animate-pulse' : 'bg-[#d22027]'
                  }`}
                  title="Hari Ini"
                ></span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tabel Desktop (Disembunyikan Scrollbar Horizontal & Vertikal) */}
      <div key={`anim-${animKey}`} className="hidden md:block overflow-auto no-scrollbar scrollbar-none rounded-2xl max-h-[70vh]">
        <table className="w-full text-left text-xs border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-[#111111] text-white sticky top-0 z-20">
              <th className="p-3 font-bold rounded-tl-xl animate-col-fade" style={{ animationDelay: '0ms' }}>
                Nama Staf
              </th>

              {isManagement && (
                <th className="p-3 font-bold animate-col-fade" style={{ animationDelay: '70ms' }}>
                  ID
                </th>
              )}
              <th className="p-3 font-bold animate-col-fade" style={{ animationDelay: '140ms' }}>
                Divisi
              </th>

              {days.map((day, idx) => {
                const isTodayHeader = isSameDate(currentSelectedWeekDates[idx]);
                const delayMs = 210 + idx * 70;

                return (
                  <th
                    key={day}
                    className="p-3 text-center font-bold animate-col-fade"
                    style={{ animationDelay: `${delayMs}ms` }}
                  >
                    <div>{day}</div>
                    <div className="text-[10px] font-normal opacity-80 mt-0.5">
                      {dateLabels[day] || ''} {isTodayHeader && ' (Hari Ini)'}
                    </div>
                  </th>
                );
              })}
              
              <th
                className={`p-3 text-center bg-neutral-800 font-bold animate-col-fade ${!isManagement ? 'rounded-tr-xl' : ''}`}
                style={{ animationDelay: '700ms' }}
              >
                Tot. Shift
              </th>

              {isManagement && (
                <>
                  <th className="p-3 text-center bg-blue-900/60 font-bold animate-col-fade" style={{ animationDelay: '770ms' }}>
                    Shift 1
                  </th>
                  <th className="p-3 text-center bg-amber-900/60 font-bold animate-col-fade" style={{ animationDelay: '840ms' }}>
                    Shift 2
                  </th>
                  <th className="p-3 text-center bg-red-900/60 rounded-tr-xl font-bold animate-col-fade" style={{ animationDelay: '910ms' }}>
                    OFF
                  </th>
                </>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-neutral-100">
            {staffSummaries.map(staff => {
              const isLoggedUser = currentUser && (
                currentUser.staff_id === staff.staff_id ||
                currentUser.name.toLowerCase() === staff.staff_name.toLowerCase()
              );

              return (
                <tr
                  key={staff.staff_id}
                  className={`transition ${
                    isLoggedUser
                      ? 'bg-red-50/80 border-l-4 border-l-[#d22027]'
                      : 'hover:bg-neutral-50'
                  }`}
                >
                  <td className="p-3 font-bold text-[#111111] animate-col-fade" style={{ animationDelay: '0ms' }}>
                    <div className="flex items-center gap-2">
                      {staff.avatar_url ? (
                        <img
                          src={staff.avatar_url}
                          alt={staff.staff_name}
                          className="w-6 h-6 rounded-full object-cover border border-neutral-200 shrink-0"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-neutral-200 text-neutral-600 flex items-center justify-center font-bold text-[9px] shrink-0">
                          {staff.first_name?.[0] || staff.staff_name[0]}
                        </div>
                      )}

                      <div className="flex flex-col">
                        <span className="flex items-center gap-1.5">
                          {staff.staff_name}
                          {isLoggedUser && (
                            <span className="bg-[#d22027] text-white text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase">
                              Anda
                            </span>
                          )}
                        </span>

                        {isManagement && staff.hasAnyRestWarning && (
                          <span
                            className="mt-0.5 text-[9px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-semibold w-max"
                            title="Terdeteksi jadwal Shift 2 (Malam) disambung Shift 1 (Pagi)"
                          >
                            ⚠️ Rest Time &lt; 8 Jam
                          </span>
                        )}

                        {isManagement && staff.status && staff.status !== 'Aktif' && (
                          <span className="mt-0.5 inline-block px-1.5 py-0.5 text-[9px] rounded font-semibold bg-amber-100 text-amber-700 w-max">
                            {staff.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {isManagement && (
                    <td className="p-3 font-mono font-bold text-neutral-400 animate-col-fade" style={{ animationDelay: '70ms' }}>
                      {staff.staff_id}
                    </td>
                  )}
                  <td className="p-3 text-neutral-500 capitalize animate-col-fade" style={{ animationDelay: '140ms' }}>
                    {staff.role?.replace(/_/g, ' ')}
                  </td>
                  
                  {days.map((day, idx) => {
                    const shift = staff.shifts[day] || 'OFF';
                    const isRestWarning = isManagement && staff.restWarnings[day];
                    const delayMs = 210 + idx * 70;

                    return (
                      <td key={day} className="p-3 text-center animate-col-fade" style={{ animationDelay: `${delayMs}ms` }}>
                        <span
                          className={`px-2 py-1 rounded-md font-bold text-[10px] inline-block min-w-[54px] transition-colors ${
                            isRestWarning
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : shift === 'Shift 1' || shift === 'S1'
                              ? 'bg-blue-50 text-blue-600 border border-blue-100'
                              : shift === 'Shift 2' || shift === 'S2'
                              ? 'bg-amber-50 text-amber-700 border border-amber-100'
                              : 'bg-red-50 text-red-500 border border-red-100'
                          }`}
                          title={isRestWarning ? 'Waktu istirahat kurang dari 8 jam' : undefined}
                        >
                          {shift}
                          {isRestWarning && <span className="ml-1 text-[9px]">⚠️</span>}
                        </span>
                      </td>
                    );
                  })}

                  <td className="p-3 text-center font-black bg-neutral-50/80 text-[#111111] animate-col-fade" style={{ animationDelay: '700ms' }}>
                    {staff.total_shift}
                  </td>

                  {isManagement && (
                    <>
                      <td className="p-3 text-center font-bold text-blue-600 bg-blue-50/40 animate-col-fade" style={{ animationDelay: '770ms' }}>
                        {staff.total_shift_1}
                      </td>
                      <td className="p-3 text-center font-bold text-amber-700 bg-amber-50/40 animate-col-fade" style={{ animationDelay: '840ms' }}>
                        {staff.total_shift_2}
                      </td>
                      <td className="p-3 text-center font-bold text-red-500 bg-red-50/40 animate-col-fade" style={{ animationDelay: '910ms' }}>
                        {staff.total_off}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Tampilan Mobile */}
      <div key={`mob-${animKey}`} className="md:hidden space-y-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-bold text-neutral-400">
            Jadwal Hari {selectedDay} {dateLabels[selectedDay] && `(${dateLabels[selectedDay]})`} (Minggu {selectedWeek})
          </span>
        </div>

        {staffSummaries.map((staff, idx) => {
          const shiftToday = staff.shifts[selectedDay] || 'OFF';
          const isRestWarningToday = isManagement && staff.restWarnings[selectedDay];
          const isLoggedUser = currentUser && (
            currentUser.staff_id === staff.staff_id ||
            currentUser.name.toLowerCase() === staff.staff_name.toLowerCase()
          );

          return (
            <div
              key={staff.staff_id}
              style={{ animationDelay: `${idx * 60}ms` }}
              className={`p-3.5 rounded-2xl border flex justify-between items-center animate-col-fade ${
                isLoggedUser
                  ? 'bg-red-50/90 border-[#d22027]'
                  : 'bg-neutral-50 border-neutral-200'
              }`}
            >
              <div className="flex items-center gap-3">
                {staff.avatar_url ? (
                  <img
                    src={staff.avatar_url}
                    alt={staff.staff_name}
                    className="w-9 h-9 rounded-full object-cover border border-neutral-200 shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-neutral-200 text-neutral-700 flex items-center justify-center font-bold text-xs shrink-0">
                    {staff.first_name?.[0] || staff.staff_name[0]}
                  </div>
                )}

                <div>
                  <h3 className="font-bold text-xs text-[#111111] flex items-center gap-1.5">
                    {staff.staff_name}
                    {isLoggedUser && (
                      <span className="bg-[#d22027] text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase">
                        Anda
                      </span>
                    )}
                  </h3>
                  <p className="text-[10px] text-neutral-400 capitalize">{staff.role?.replace(/_/g, ' ')}</p>

                  {isRestWarningToday && (
                    <span className="mt-1 inline-block text-[9px] bg-amber-100 text-amber-800 border border-amber-300 font-bold px-2 py-0.5 rounded-full">
                      ⚠️ Rest Time &lt; 8 Jam
                    </span>
                  )}
                </div>
              </div>

              <span
                className={`px-3 py-1 rounded-xl font-bold text-xs ${
                  isRestWarningToday
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : shiftToday === 'Shift 1' || shiftToday === 'S1'
                    ? 'bg-blue-100 text-blue-700'
                    : shiftToday === 'Shift 2' || shiftToday === 'S2'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-red-100 text-red-600'
                }`}
              >
                {shiftToday}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}