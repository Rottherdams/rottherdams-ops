import { useEffect, useRef } from 'react';

const TIMEOUT_MS = 5 * 60 * 1000; // 5 Menit Idle Timeout

export function useIdleLogout(onLogout: () => void, isLoggedIn: boolean) {
  // ✅ Menggunakan ReturnType<typeof setTimeout> agar ramah browser & Vite TypeScript
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
    if (!isLoggedIn) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    // Event listener pendeteksi interaksi staf di Desktop & Mobile
    const events = [
      'mousemove',
      'keydown',
      'click',
      'scroll',
      'touchstart',
      'pointerdown',
      'focus',
      'visibilitychange',
    ];

    const handleUserActivity = () => {
      resetTimer();
    };

    events.forEach((event) => window.addEventListener(event, handleUserActivity, { passive: true }));
    resetTimer(); // Jalankan timer awal

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((event) => window.removeEventListener(event, handleUserActivity));
    };
  }, [isLoggedIn]);
}