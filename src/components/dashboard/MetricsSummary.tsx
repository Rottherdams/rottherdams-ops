interface MetricsSummaryProps {
  onDutyCount: number;
  totalStaff: number;
  totalSopPct: number;
  completedSop: number;
  totalSop: number;
  totalWorkHours: number;
  screenshotAttemptsCount: number;
}

export default function MetricsSummary({
  onDutyCount,
  totalStaff,
  totalSopPct,
  completedSop,
  totalSop,
  totalWorkHours,
  screenshotAttemptsCount,
}: MetricsSummaryProps) {
  return (
    <div 
      className="animate-section-fade grid grid-cols-2 md:grid-cols-4 gap-4"
      style={{ animationDelay: '200ms' }}
    >
      <div className="bg-white p-5 rounded-3xl border border-neutral-200 shadow-xs hover:border-neutral-300 transition">
        <div className="flex items-center justify-between mb-2">
          <span className="text-2xl">👥</span>
          <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-md">
            Active Now
          </span>
        </div>
        <p className="text-2xl font-black text-[#111111]">
          {onDutyCount} <span className="text-xs font-normal text-neutral-400">/ {totalStaff} Staf</span>
        </p>
        <p className="text-[11px] font-bold text-neutral-500 mt-1">Staf On-Duty FOH & BOH</p>
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
          {completedSop} <span className="text-xs font-normal text-neutral-400">/ {totalSop} Task</span>
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
  );
}