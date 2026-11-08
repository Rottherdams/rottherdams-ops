import { useState, useEffect } from 'react';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // 1. Cek apakah pengguna pernah menutup prompt sebelumnya di HP ini
    const hasSeenPrompt = localStorage.getItem('pwa_prompt_dismissed');
    
    // 2. Cek apakah aplikasi sudah berjalan dalam mode PWA (standalone)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;

    if (isStandalone || hasSeenPrompt) return;

    // 3. Deteksi jika pengguna memakai iOS (iPhone/iPad)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    if (isIosDevice) {
      setShowPrompt(true);
    }

    // 4. Tangkap event install prompt native di Android/Chrome
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User menyetujui instalasi PWA Rottherdams');
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
    localStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  const handleClose = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-5 left-4 right-4 md:left-auto md:right-5 md:max-w-sm bg-[#111111]/95 backdrop-blur-md text-white p-4 rounded-3xl shadow-2xl border border-neutral-800 z-50 transition-all animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#d22027] rounded-2xl flex items-center justify-center font-black text-base text-white shadow-md shrink-0">
            R
          </div>
          <div className="text-left">
            <h4 className="font-extrabold text-xs text-white">Instal Rottherdams Ops</h4>
            <p className="text-[10px] text-neutral-400">Akses cepat seperti aplikasi native di HP</p>
          </div>
        </div>
        <button
          onClick={handleClose}
          className="w-6 h-6 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white text-xs font-bold transition cursor-pointer flex items-center justify-center"
        >
          ✕
        </button>
      </div>

      {isIOS ? (
        /* Petunjuk khusus pengguna iPhone (iOS) */
        <div className="mt-3 pt-2.5 border-t border-neutral-800 text-[11px] text-neutral-300 space-y-1.5 text-left">
          <p className="font-bold text-[#d22027] flex items-center gap-1">
            📱 Cara pasang di iOS (iPhone/iPad):
          </p>
          <p className="leading-snug">
            1. Tekan tombol <strong className="text-white font-bold">Share (Ikon Panah Berbagi)</strong> di Safari.
          </p>
          <p className="leading-snug">
            2. Geser menu & pilih <strong className="text-white font-bold">"Tambah ke Layar Utama" (Add to Home Screen)</strong>.
          </p>
        </div>
      ) : (
        /* Tombol otomatis pengguna Android/Chrome */
        <div className="flex gap-2 mt-3 pt-2 border-t border-neutral-800/80">
          <button
            onClick={handleClose}
            className="flex-1 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Nanti Saja
          </button>
          <button
            onClick={handleInstallClick}
            className="flex-1 py-2 bg-[#d22027] hover:bg-[#b81b21] text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-md active:scale-95"
          >
            Instal Sekarang
          </button>
        </div>
      )}
    </div>
  );
}