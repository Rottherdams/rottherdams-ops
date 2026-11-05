import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface ClockInModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: { name: string; role: string; staff_id: string } | null;
  activeShift: 'morning' | 'night';
  onSuccess: () => void;
}

// 📍 Koordinat Presisi Rottherdams Coffee (Google Maps)
const KAFE_LAT = -1.900938; 
const KAFE_LNG = 116.1877179; 
const MAX_RADIUS_METERS = 100; // Maksimal jarak presensi 100 meter dari kafe

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

  // State GPS & Kamera
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string>('');
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);

  // Deteksi lingkungan Dev (Localhost)
  const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const currentShiftLabel = activeShift === 'morning' ? 'Morning Shift' : 'Night Shift';

  useEffect(() => {
    if (isOpen && currentUser) {
      checkCurrentAttendance();
      getLocation();
    } else {
      stopCamera();
    }
  }, [isOpen, currentUser]);

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

  // 📍 1. Fungsi Ambil Lokasi GPS & Hitung Jarak
  const getLocation = () => {
    setLocationError('');
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        position => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setLocation({ lat, lng });

          // Hitung jarak Haversine ke lokasi Kafe (dalam meter)
          const dist = calculateDistance(lat, lng, KAFE_LAT, KAFE_LNG);
          setDistance(Math.round(dist));
        },
        () => {
          setLocationError('Gagal mengambil lokasi GPS. Pastikan izin lokasi aktif.');
        },
        { enableHighAccuracy: true }
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

  // 📸 2. Fungsi Kontrol Kamera Selfie
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 300, height: 300 },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      }
    } catch (err) {
      console.error('Kamera gagal diakses:', err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      setIsCameraActive(false);
    }
  };

  const takeSelfie = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, 300, 300);
      canvas.toBlob(blob => {
        if (blob) {
          setPhotoBlob(blob);
          setPhotoPreview(URL.createObjectURL(blob));
          stopCamera();
        }
      }, 'image/jpeg');
    }
  };

  const retakeSelfie = () => {
    setPhotoBlob(null);
    setPhotoPreview(null);
    startCamera();
  };

  if (!isOpen) return null;

  // ☁️ 3. Proses Clock In + Upload Foto Selfie
  const handleClockIn = async () => {
    if (!currentUser) return;
    if (!photoBlob) {
      alert('Silakan ambil foto selfie terlebih dahulu!');
      return;
    }

    setIsLoading(true);

    try {
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

      // B. Simpan Presensi ke Database
      const { error } = await supabase.from('attendances').insert([
        {
          staff_id: currentUser.staff_id,
          staff_name: currentUser.name,
          role: currentUser.role,
          shift: currentShiftLabel,
          latitude: location?.lat || null,
          longitude: location?.lng || null,
          photo_url,
          status: 'On Duty',
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

  // Validasi radius (Diabaikan jika berada di mode Localhost)
  const isOutsideRadius = !isLocalhost && distance !== null && distance > MAX_RADIUS_METERS;

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
                Clock In: {new Date(activeAttendance.clock_in).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
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
              isOutsideRadius 
                ? 'bg-red-50 border-red-200 text-red-700' 
                : distance !== null 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}>
              <div className="flex items-center justify-between font-bold">
                <span>📍 Lokasi GPS Kafe:</span>
                <span>{distance !== null ? `${distance} Meter` : 'Mendeteksi...'}</span>
              </div>
              
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
                <p className="text-[10px] font-bold mt-1 text-red-500">{locationError}</p>
              )}
            </div>

            {/* Kamera & Preview Selfie */}
            <div className="relative w-full h-48 bg-black rounded-2xl overflow-hidden flex items-center justify-center border border-neutral-200">
              {photoPreview ? (
                <img src={photoPreview} alt="Selfie Preview" className="w-full h-full object-cover" />
              ) : (
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover transform -scale-x-100" />
              )}

              {!photoPreview && isCameraActive && (
                <button
                  type="button"
                  onClick={takeSelfie}
                  className="absolute bottom-3 px-4 py-1.5 bg-white text-[#111111] font-black text-xs rounded-full shadow-lg hover:bg-neutral-100 active:scale-95 transition cursor-pointer"
                >
                  📸 Ambil Foto Selfie
                </button>
              )}

              {photoPreview && (
                <button
                  type="button"
                  onClick={retakeSelfie}
                  className="absolute bottom-3 px-3 py-1 bg-black/60 text-white font-bold text-[10px] rounded-full backdrop-blur-md hover:bg-black transition cursor-pointer"
                >
                  🔄 Ulang Foto
                </button>
              )}
            </div>

            <button
              onClick={handleClockIn}
              disabled={isLoading || !photoBlob || isOutsideRadius}
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