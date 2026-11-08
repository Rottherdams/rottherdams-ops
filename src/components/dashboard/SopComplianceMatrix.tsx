interface SopStats {
  total: number;
  completed: number;
  barCompleted: number;
  barTotal: number;
  kitchenCompleted: number;
  kitchenTotal: number;
  floorCompleted: number;
  floorTotal: number;
}

interface SopComplianceMatrixProps {
  sopStats: SopStats;
  totalSopPct: number;
  barSopPct: number;
  kitchenSopPct: number;
  floorSopPct: number;
}

export default function SopComplianceMatrix({
  sopStats,
  totalSopPct,
  barSopPct,
  kitchenSopPct,
  floorSopPct,
}: SopComplianceMatrixProps) {
  return (
    <div 
      className="animate-section-fade bg-white rounded-3xl p-6 md:p-8 border border-neutral-200 shadow-xs space-y-6"
      style={{ animationDelay: '300ms' }}
    >
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
            <span className="text-[#d22027] font-black">{floorSopPct}%</span>
          </div>
          <div className="w-full bg-neutral-200 rounded-full h-2.5 overflow-hidden">
            <div className="bg-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${floorSopPct}%` }}></div>
          </div>
          <p className="text-[10px] text-neutral-400">{sopStats.floorCompleted} dari {sopStats.floorTotal} tugas SOP selesai.</p>
        </div>
      </div>
    </div>
  );
}