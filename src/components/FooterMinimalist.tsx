declare const __APP_COMMIT_COUNT__: string;
declare const __APP_COMMIT_SHA__: string;

interface FooterMinimalistProps {
  isHostOnline: boolean;
  isDbOnline: boolean;
}

export default function FooterMinimalist({ isHostOnline, isDbOnline }: FooterMinimalistProps) {
  // 🌟 KALKULASI VERSI DINAMIS BERDASARKAN TOTAL COMMIT GIT SAAT BUILD
  const rawCount = typeof __APP_COMMIT_COUNT__ !== 'undefined' ? __APP_COMMIT_COUNT__ : '125';
  const deployCount = parseInt(rawCount, 10) || 125;
  const computedVersion = (deployCount / 100).toFixed(2);

  const commitSha =
    (typeof __APP_COMMIT_SHA__ !== 'undefined' && __APP_COMMIT_SHA__) ||
    import.meta.env.CF_PAGES_COMMIT_SHA?.substring(0, 7) ||
    '';

  const appVersion = commitSha ? `${computedVersion} (${commitSha})` : computedVersion;

  return (
    <footer className="mt-12 border-t border-neutral-200/80 bg-neutral-50/80 py-6 px-6 text-left">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        
        {/* Section 1: Branding & Versi Dinamis Otomatis */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-black text-sm tracking-wider uppercase text-[#d22027]">ROTTHERDAMS</span>
            <span className="text-[9px] bg-[#d22027]/10 text-[#d22027] border border-[#d22027]/20 px-2 py-0.5 rounded-full font-bold">
              Ops v{appVersion}
            </span>
          </div>
          <p className="text-[11px] text-neutral-400">
            Your daily dose of caffeine & good vibes at Rottherdams Coffee.
          </p>
        </div>

        {/* Section 2: Status Indicator (Server & DB) + Link Sosial */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-neutral-600">
          
          <div className="flex items-center gap-2.5 bg-white px-3 py-1 rounded-full border border-neutral-200 text-[11px]">
            <span className="flex items-center gap-1.5" title={isHostOnline ? "Server Online" : "Server Offline"}>
              <span className={`w-2 h-2 rounded-full ${isHostOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
              <span>Server</span>
            </span>
            <span className="text-neutral-300">•</span>
            <span className="flex items-center gap-1.5" title={isDbOnline ? "Database Online" : "Database Offline"}>
              <span className={`w-2 h-2 rounded-full ${isDbOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
              <span>DB</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://instagram.com/rottherdams"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 font-bold hover:text-[#d22027] transition group"
            >
              <svg className="w-3.5 h-3.5 fill-[#d22027] transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
              @rottherdams
            </a>

            <span className="text-neutral-300">•</span>

            <a
              href="https://www.google.com/maps/place/Rottherdams+Coffee/@-1.900938,116.1877179,17z"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 font-bold hover:text-[#d22027] transition group"
            >
              <svg className="w-3.5 h-3.5 fill-[#d22027] transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
              Tanah Grogot
            </a>
          </div>
        </div>
      </div>

      {/* Section 3: Copyright */}
      <div className="max-w-4xl mx-auto pt-4 mt-4 border-t border-neutral-200/50 flex flex-col sm:flex-row justify-between items-center text-[10px] text-neutral-400 gap-1.5">
        <p>© 2026 Rottherdams Operations Hub. Internal System.</p>
        <p className="font-mono">Jam Ops: 09.00 - 23.00 WITA</p>
      </div>
    </footer>
  );
}