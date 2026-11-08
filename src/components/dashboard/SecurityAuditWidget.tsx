export interface SecurityAuditLog {
  id: number;
  staff_name: string;
  staff_id: string;
  role: string;
  action_type: string;
  target_recipe?: string;
  created_at: string;
}

interface SecurityAuditWidgetProps {
  securityLogs: SecurityAuditLog[];
}

export default function SecurityAuditWidget({ securityLogs }: SecurityAuditWidgetProps) {
  return (
    <div className="bg-[#111111] text-white rounded-3xl p-6 shadow-xl border border-neutral-800 space-y-4">
      <div className="flex justify-between items-center pb-3 border-b border-neutral-800">
        <h3 className="font-black text-sm text-white flex items-center gap-2">
          <span className="text-[#d22027]">🛡️</span> Live Security Audit Log (Resep & Akses)
        </h3>
        <span className="text-[9px] bg-red-500/20 text-red-400 border border-red-500/30 px-2.5 py-0.5 rounded-full font-bold">
          Protected
        </span>
      </div>

      {securityLogs.length === 0 ? (
        <p className="text-xs text-neutral-500 italic py-4">Belum ada catatan pelanggaran keamanan.</p>
      ) : (
        <div className="space-y-2.5">
          {securityLogs.map((log) => {
            const isScreenshot = log.action_type.includes('SCREENSHOT');
            return (
              <div
                key={log.id}
                className={`p-3 rounded-2xl border text-xs flex justify-between items-center transition ${
                  isScreenshot
                    ? 'bg-red-950/40 border-red-800/60 text-red-200'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-300'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-[#ffffff]">{log.staff_name}</span>
                    <span className="text-[9px] px-1.5 py-0.2 bg-white/10 rounded font-mono text-neutral-400">
                      {log.staff_id}
                    </span>
                    {log.role && (
                      <span className="text-[9px] text-neutral-400 capitalize">
                        ({log.role.replace(/_/g, ' ')})
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] mt-0.5 opacity-80">
                    {isScreenshot ? '⚠️ Intip / Percobaan Screenshot Resep' : '📖 Menampilkan Gramasi Resep'}{' '}
                    • <strong className="text-[#ffffff]">{log.target_recipe || 'Dokumen Resep'}</strong>
                  </p>
                </div>
                <span className="text-[9px] font-mono text-neutral-500 whitespace-nowrap ml-2">
                  {new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WITA
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}