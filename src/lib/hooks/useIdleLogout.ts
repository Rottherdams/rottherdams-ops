import { useEffect, useRef } from 'react';

const TIMEOUT_MS = 5 * 60 * 1000; // 5 Menit Idle Timeout
const LAST_ACTIVITY_KEY = 'rottherdams_last_activity';

// 🛡️ Helper mengecek apakah sesi sudah terlewati > 5 menit waktu nyata
export const checkIsIdleExpired = (): boolean => {
  const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
  if (!lastActivity) return false;

  const timePassed = Date.now() - parseInt(lastActivity, 10);
  return timePassed > TIMEOUT_MS;
};

// ⏱️ Helper memperbarui timestamp aktivitas terbaru di localStorage
export const updateLastActivityTimestamp = () => {
  localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
};

// 🧹 Helper membersihkan timestamp saat logout
export const clearLastActivityTimestamp = () => {
  localStorage.removeItem(LAST_ACTIVITY_KEY);
};

export function useIdleLogout(onLogout: (reason: 'AUTO_LOGOUT_IDLE') => void, isLoggedIn: boolean) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isLoggedIn) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    const handleUserActivity = () => {
      // 1. Cek apakah waktu idle sudah kadaluarsa saat aplikasi di-resume
      if (checkIsIdleExpired()) {
        clearLastActivityTimestamp();
        onLogout('AUTO_LOGOUT_IDLE');
        return;
      }

      // 2. Jika belum kadaluarsa, perbarui timestamp di localStorage
      updateLastActivityTimestamp();

      // 3. Reset timer di memori
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        clearLastActivityTimestamp();
        onLogout('AUTO_LOGOUT_IDLE');
      }, TIMEOUT_MS);
    };

    // Event listener pendeteksi interaksi staf di Desktop & Mobile
    const events = [
      'mousemove',
      'keydown',
      'click',
      'scroll',
      'touchstart',
      'pointerdown',
    ];

    events.forEach((event) => window.addEventListener(event, handleUserActivity, { passive: true }));
    
    // 🌟 Event khusus saat tab HP/Browser aktif kembali dari background (Focus / Visibility)
    window.addEventListener('focus', handleUserActivity);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleUserActivity();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Jalankan pengecekan pertama kali saat hook dimuat
    handleUserActivity();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((event) => window.removeEventListener(event, handleUserActivity));
      window.removeEventListener('focus', handleUserActivity);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLoggedIn, onLogout]);
}