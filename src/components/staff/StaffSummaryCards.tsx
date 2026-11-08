interface StaffSummaryCardsProps {
  animatedTotal: number;
  animatedActive: number;
  animatedResign: number;
  showCard2: boolean;
  showCard3: boolean;
}

export default function StaffSummaryCards({
  animatedTotal,
  animatedActive,
  animatedResign,
  showCard2,
  showCard3,
}: StaffSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-left">
      {/* Card 1: Total Karyawan */}
      <div className="bg-white p-5 rounded-3xl border border-neutral-100 shadow-sm animate-card-pop">
        <span className="text-2xl">👥</span>
        <p className="text-2xl font-black text-[#111111] mt-1 font-mono">{animatedTotal}</p>
        <p className="text-xs font-bold text-neutral-400">Total Karyawan</p>
      </div>

      {/* Card 2: Status Aktif */}
      {showCard2 && (
        <div className="bg-white p-5 rounded-3xl border border-neutral-100 shadow-sm animate-card-pop">
          <span className="text-2xl">🟢</span>
          <p className="text-2xl font-black text-emerald-600 mt-1 font-mono">{animatedActive}</p>
          <p className="text-xs font-bold text-neutral-400">Status Aktif</p>
        </div>
      )}

      {/* Card 3: Resign / Non-Aktif */}
      {showCard3 && (
        <div className="bg-white p-5 rounded-3xl border border-neutral-100 shadow-sm col-span-2 sm:col-span-1 animate-card-pop">
          <span className="text-2xl">🔴</span>
          <p className="text-2xl font-black text-red-600 mt-1 font-mono">{animatedResign}</p>
          <p className="text-xs font-bold text-neutral-400">Resign / Non-Aktif</p>
        </div>
      )}
    </div>
  );
}