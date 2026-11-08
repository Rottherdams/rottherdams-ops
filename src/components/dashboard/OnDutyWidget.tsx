export interface OnDutyItem {
  id: number;
  staff_name: string;
  staff_id: string;
  role: string;
  shift: string;
  clock_in: string;
  avatar_url?: string;
}

interface OnDutyWidgetProps {
  onDutyList: OnDutyItem[];
}

export default function OnDutyWidget({ onDutyList }: OnDutyWidgetProps) {
  return (
    <div className="bg-white rounded-3xl p-6 border border-neutral-200 shadow-xs space-y-4">
      <div className="flex justify-between items-center pb-3 border-b border-neutral-100">
        <h3 className="font-black text-sm text-[#111111] flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
          Tim On-Duty Aktif ({onDutyList.length})
        </h3>
        <span className="text-[10px] text-neutral-400 font-mono">Shift Operasional</span>
      </div>

      {onDutyList.length === 0 ? (
        <div className="py-8 text-center text-xs text-neutral-400">
          Saat ini tidak ada staf yang sedang On-Duty / Clock In.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {onDutyList.map((staf) => (
            <div key={staf.id} className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200 flex items-center gap-3">
              {staf.avatar_url ? (
                <img
                  src={staf.avatar_url}
                  alt={staf.staff_name}
                  className="w-9 h-9 rounded-xl object-cover border border-neutral-200 shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-[#111111] text-[#ffffff] flex items-center justify-center text-xs font-black shrink-0">
                  {staf.staff_name.substring(0, 2).toUpperCase()}
                </div>
              )}
              <div className="overflow-hidden">
                <p className="font-extrabold text-xs text-[#111111] truncate">{staf.staff_name}</p>
                <p className="text-[10px] text-neutral-400 capitalize">
                  {staf.role?.replace(/_/g, ' ')} • {staf.shift} Shift
                </p>
                <p className="text-[9px] text-emerald-600 font-mono font-bold mt-0.5">
                  In: {new Date(staf.clock_in).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WITA
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}