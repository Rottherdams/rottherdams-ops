import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface ClockInModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: { name: string; role: string; staff_id: string; avatar_url?: string } | null;
  activeShift: 'morning' | 'night';
  onSuccess: () => void;
}

// 📍 Koordinat Presisi Rottherdams Coffee (Google Maps)
const KAFE_LAT = -1.900938; 
const KAFE_LNG = 116.1877179; 
const MAX_RADIUS_METERS = 75; // Maksimal jarak presensi 75 meter dari kafe

export default function ClockInModal({
  isOpen,
  onClose,
  currentUser,
  activeShift,
  onSuccess,
}: ClockInModalProps) {
  const [activeAttendance, setActiveAttendance] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(true);

  // State GPS, Metadata Audit & Kamera
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [ipAddress, setIpAddress] = useState<string>('');
  const [distance, setDistance] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string>('');
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);

  // Deteksi lingkungan Dev (Localhost)
  const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const currentShiftLabel = activeShift === 'morning' ? 'Morning Shift' : 'Night Shift';

  useEffect(() => {
    if (isOpen && currentUser) {
      checkCurrentAttendance();
      getLocation();
      fetchIpAddress();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, currentUser]);

  // Ambil IP Address publik untuk Audit Trail Metadata
  const fetchIpAddress = async () => {
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      const data = await res.json();
      if (data?.ip) setIpAddress(data.ip);
    } catch (e) {
      console.warn('Gagal mengambil IP address:', e);
    }
  };

  const checkCurrentAttendance = async () => {
    if (!currentUser) return;
    setIsChecking(true);

    const { data } = await supabase
      .from('attendances')
      .select('*')
      .eq('staff_id', currentUser.staff_id)
      .eq('status', 'On Duty')
      .order('created_at', { ascending: false })
      .maybeSingle();

    setActiveAttendance(data);
    setIsChecking(false);

    if (!data) {
      startCamera();
    }
  };

  // 📍 1. Fungsi Ambil Lokasi GPS & Deteksi Fake GPS
  const getLocation = () => {
    setLocationError('');
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        position => {
          const coords = position.coords;
          const accuracy = coords.accuracy;
          setGpsAccuracy(Math.round(accuracy));

          // ⚠️ A. Deteksi Flag 'mocked' dari Android Webview
          const isMock = (position as any).isMock || (coords as any).isMocked;
          if (isMock) {
            setLocationError('⚠️ Penggunaan Fake GPS / Lokasi Palsu terdeteksi! Harap matikan aplikasi pengubah lokasi.');
            return;
          }

          // ⚠️ B. Deteksi Akurasi Terlalu Sempurna (< 2 meter) Ciri Khas Fake GPS
          if (!isLocalhost && accuracy < 2.0) {
            setLocationError('⚠️ Indikasi Fake GPS terdeteksi (Akurasi tidak wajar). Harap gunakan GPS asli HP.');
            return;
          }

          const lat = coords.latitude;
          const lng = coords.longitude;
          setLocation({ lat, lng });

          // Hitung jarak Haversine ke lokasi Kafe (dalam meter)
          const dist = calculateDistance(lat, lng, KAFE_LAT, KAFE_LNG);
          setDistance(Math.round(dist));
        },
        () => {
          setLocationError('Gagal mengambil lokasi GPS. Pastikan izin lokasi aktif.');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setLocationError('Browser Anda tidak mendukung fitur Geolocation.');
    }
  };

  // Rumus Jarak Haversine (Meters)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Radius bumi dalam meter
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // 📸 2. Fungsi Kontrol Kamera Selfie dengan Fallback
  const startCamera = async () => {
    setCameraError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Browser ini tidak mendukung akses kamera.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 640 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
        setIsCameraActive(true);
      }
    } catch (err: any) {
      console.warn('Gagal dengan constraint ideal, mencoba fallback dasar:', err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });

        streamRef.current = fallbackStream;

        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          await videoRef.current.play().catch(() => {});
          setIsCameraActive(true);
        }
      } catch (fallbackErr) {
        console.error('Kamera tetap gagal diakses:', fallbackErr);
        setCameraError('Gagal membuka kamera. Berikan izin kamera pada browser HP Anda.');
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const takeSelfie = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const width = video.videoWidth || 300;
    const height = video.videoHeight || 300;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, width, height);

      canvas.toBlob(
        blob => {
          if (blob) {
            setPhotoBlob(blob);
            setPhotoPreview(URL.createObjectURL(blob));
            stopCamera();
          }
        },
        'image/jpeg',
        0.85
      );
    }
  };

  const retakeSelfie = () => {
    setPhotoBlob(null);
    setPhotoPreview(null);
    startCamera();
  };

  if (!isOpen) return null;

  // ☁️ 3. Proses Clock In + Upload Foto Selfie & Audit Metadata
  const handleClockIn = async () => {
    if (!currentUser) return;
    if (!photoBlob) {
      alert('Silakan ambil foto selfie terlebih dahulu!');
      return;
    }

    setIsLoading(true);

    try {
      // Ambil nama profil resmi dari Supabase staff
      const { data: staffData } = await supabase
        .from('staff')
        .select('first_name, last_name, staff_name')
        .eq('staff_id', currentUser.staff_id)
        .single();

      const staffDisplayName = staffData?.staff_name || 
        (staffData?.first_name ? `${staffData.first_name} ${staffData.last_name || ''}`.trim() : currentUser.name);

      // A. Upload Foto ke Supabase Storage
      const fileName = `${currentUser.staff_id}_${Date.now()}.jpg`;
      const { data: storageData, error: storageError } = await supabase.storage
        .from('attendance-photos')
        .upload(fileName, photoBlob, { contentType: 'image/jpeg' });

      let photo_url = '';
      if (!storageError && storageData) {
        const { data: publicUrlData } = supabase.storage
          .from('attendance-photos')
          .getPublicUrl(fileName);
        photo_url = publicUrlData.publicUrl;
      }

      // B. Hitung Status Kecurangan / Fake GPS Sebelum Simpan
      const isOutsideRadius = !isLocalhost && distance !== null && distance > MAX_RADIUS_METERS;
      const isFakeGpsDetected = !!locationError && locationError.includes('Fake GPS');
      const isFakeGpsFlag = isOutsideRadius || isFakeGpsDetected;

      // C. Simpan Presensi + Metadata Audit Trail + Status Fake GPS ke Database
      const { error } = await supabase.from('attendances').insert([
        {
          staff_id: currentUser.staff_id,
          staff_name: staffDisplayName,
          role: currentUser.role,
          shift: currentShiftLabel,
          latitude: location?.lat || null,
          longitude: location?.lng || null,
          photo_url,
          status: 'On Duty',
          is_fake_gps: isFakeGpsFlag, // 🚨 SIMPAN SINYAL FAKE GPS UNTUK AUDIT TIM
          gps_accuracy: gpsAccuracy,
          ip_address: ipAddress || 'Unknown',
          device_info: navigator.userAgent,
        },
      ]);

      setIsLoading(false);

      if (!error) {
        onSuccess();
        onClose();
      } else {
        alert('Gagal Melakukan Clock In: ' + error.message);
      }
    } catch (err: any) {
      setIsLoading(false);
      alert('Terjadi kesalahan: ' + err.message);
    }
  };

  const handleClockOut = async () => {
    if (!activeAttendance) return;
    setIsLoading(true);

    const { error } = await supabase
      .from('attendances')
      .update({
        clock_out: new Date().toISOString(),
        status: 'Completed',
      })
      .eq('id', activeAttendance.id);

    setIsLoading(false);

    if (!error) {
      onSuccess();
      onClose();
    } else {
      alert('Gagal Melakukan Clock Out: ' + error.message);
    }
  };

  // Validasi radius & Fake GPS untuk UI Modal
  const isOutsideRadius = !isLocalhost && distance !== null && distance > MAX_RADIUS_METERS;
  const isFakeGpsDetected = !!locationError && locationError.includes('Fake GPS');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-neutral-100 text-left relative animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={() => {
            stopCamera();
            onClose();
          }}
          className="absolute right-4 top-4 w-8 h-8 rounded-full bg-neutral-100 text-neutral-400 font-bold hover:bg-neutral-200 transition cursor-pointer flex items-center justify-center text-xs"
        >
          ✕
        </button>

        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-neutral-100">
          <div className="w-10 h-10 bg-red-50 text-[#d22027] rounded-2xl flex items-center justify-center text-lg font-bold shrink-0">
            📸
          </div>
          <div>
            <h2 className="text-base font-black text-[#111111]">Presensi GPS & Selfie</h2>
            <p className="text-[11px] text-neutral-400">{currentShiftLabel}</p>
          </div>
        </div>

        {isChecking ? (
          <p className="text-xs font-bold text-neutral-400 py-6 text-center animate-pulse">
            Memeriksa status presensi...
          </p>
        ) : activeAttendance ? (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-emerald-900">
              <p className="text-[10px] uppercase font-extrabold tracking-wider text-emerald-600 mb-1">
                Status: On Duty Active
              </p>
              <p className="text-xs font-bold">{currentUser?.name}</p>
              <p className="text-[11px] text-emerald-700 mt-1">
                Clock In: {new Date(activeAttendance.clock_in).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WITA
              </p>
            </div>

            <button
              onClick={handleClockOut}
              disabled={isLoading}
              className="w-full py-3.5 bg-neutral-900 hover:bg-black text-white font-bold text-xs rounded-2xl shadow-md transition cursor-pointer active:scale-95"
            >
              {isLoading ? 'Memproses...' : '🚪 Clock Out (Selesai Shift)'}
            </button>
          </div>
        ) : (
          <div className="space-y-3.5">
            {/* Status GPS Lokasi */}
            <div className={`p-3 rounded-2xl text-xs border ${
              isOutsideRadius || isFakeGpsDetected
                ? 'bg-red-50 border-red-200 text-red-700' 
                : distance !== null 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}>
              <div className="flex items-center justify-between font-bold">
                <span>📍 Lokasi GPS Kafe:</span>
                <span>{distance !== null ? `${distance} Meter` : 'Mendeteksi...'}</span>
              </div>

              {gpsAccuracy !== null && (
                <div className="text-[10px] text-neutral-500 mt-0.5">
                  Akurasi Sensor: ±{gpsAccuracy}m
                </div>
              )}
              
              {isLocalhost && (
                <p className="text-[10px] font-bold mt-1 text-amber-600">
                  🛠️ Mode Testing (Localhost): Radius GPS di-bypass.
                </p>
              )}

              {isOutsideRadius && (
                <p className="text-[10px] font-bold mt-1 text-red-600">
                  ⚠️ Kamu berada di luar radius lokasi kafe (Maks {MAX_RADIUS_METERS}m)!
                </p>
              )}
              {locationError && (
                <p className="text-[10px] font-bold mt-1 text-red-600 leading-tight">{locationError}</p>
              )}
            </div>

            {/* Kamera & Preview Selfie */}
            <div className="relative w-full h-48 bg-black rounded-2xl overflow-hidden flex items-center justify-center border border-neutral-200">
              {photoPreview ? (
                <img src={photoPreview} alt="Selfie Preview" className="w-full h-full object-cover" />
              ) : cameraError ? (
                <div className="p-4 text-center text-xs text-red-400 font-bold">
                  ⚠️ {cameraError}
                </div>
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
              )}

              {!photoPreview && isCameraActive && (
                <button
                  type="button"
                  onClick={takeSelfie}
                  className="absolute bottom-3 px-4 py-1.5 bg-white text-[#111111] font-black text-xs rounded-full shadow-lg hover:bg-neutral-100 active:scale-95 transition cursor-pointer z-10"
                >
                  📸 Ambil Foto Selfie
                </button>
              )}

              {photoPreview && (
                <button
                  type="button"
                  onClick={retakeSelfie}
                  className="absolute bottom-3 px-3 py-1 bg-black/60 text-white font-bold text-[10px] rounded-full backdrop-blur-md hover:bg-black transition cursor-pointer z-10"
                >
                  🔄 Ulang Foto
                </button>
              )}
            </div>

            <button
              onClick={handleClockIn}
              disabled={isLoading || !photoBlob || isOutsideRadius || isFakeGpsDetected}
              className="w-full py-3.5 bg-[#d22027] hover:bg-[#b81b21] disabled:opacity-40 text-white font-bold text-xs rounded-2xl shadow-md transition cursor-pointer active:scale-95"
            >
              {isLoading ? 'Mengunggah & Menyimpan...' : '✅ Clock In Presensi Sekarang'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}