import { supabase } from './supabase';

export const recordLoginLog = async (
  user: { staff_id: string; name: string; role: string },
  actionType: 'LOGIN' | 'LOGOUT' | 'AUTO_LOGOUT_IDLE' = 'LOGIN'
) => {
  try {
    let ipAddress = 'Unknown';
    let locationCity = 'Unknown';
    let latitude: number | null = null;
    let longitude: number | null = null;
    let gpsAccuracy: number | null = null;

    // 1. Ambil IP Address & Kota dari API
    try {
      const ipRes = await fetch('https://ipapi.co/json/');
      if (ipRes.ok) {
        const ipData = await ipRes.json();
        ipAddress = ipData.ip || 'Unknown';
        locationCity = `${ipData.city || ''}, ${ipData.region || ''}`.trim() || 'Unknown';
      }
    } catch (e) {
      console.warn('Gagal mengambil IP/Lokasi:', e);
    }

    // 2. Ambil Koordinat Presisi GPS
    if ('geolocation' in navigator) {
      await new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            latitude = pos.coords.latitude;
            longitude = pos.coords.longitude;
            gpsAccuracy = Math.round(pos.coords.accuracy);
            resolve();
          },
          () => resolve(), // Tetap lanjut jika GPS ditolak
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
      });
    }

    // 3. Simpan Ke Supabase (Merekam LOGIN, LOGOUT, atau AUTO_LOGOUT_IDLE)
    await supabase.from('login_logs').insert([
      {
        staff_id: user.staff_id,
        staff_name: user.name,
        role: user.role,
        action_type: actionType, // 📝 Kolom aksi baru
        ip_address: ipAddress,
        location_city: locationCity,
        latitude,
        longitude,
        gps_accuracy: gpsAccuracy,
        device_info: navigator.userAgent,
      },
    ]);
  } catch (err) {
    console.error('Gagal rekam login/logout log:', err);
  }
};