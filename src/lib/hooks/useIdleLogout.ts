import { useEffect, useRef } from 'react';

const TIMEOUT_MS = 1 * 60 * 1000; // 15 Menit

export function useIdleLogout(onLogout: () => void, isLoggedIn: boolean) {
  // ✅ Menggunakan ReturnType<typeof setTimeout> agar ramah browser/Vite TypeScript
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (isLoggedIn) {
      timerRef.current = setTimeout(() => {
        alert('⚠️ Sesi Anda telah berakhir karena tidak ada aktivitas selama 5 menit.');
        onLogout();
      }, TIMEOUT_MS);
    }
  };

  useEffect(() => {
    if (!isLoggedIn) return;

    // Event listener pendeteksi interaksi staf
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];

    events.forEach((event) => window.addEventListener(event, resetTimer));
    resetTimer(); // Jalankan timer awal

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [isLoggedIn]);
}