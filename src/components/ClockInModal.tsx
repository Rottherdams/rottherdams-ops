import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { sendTelegramAlert } from '../lib/telegram';

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

  // State Animasi Exit Modal Utama
  const [isClosing, setIsClosing] = useState<boolean>(false);

  // State Sub-Modal Konfirmasi Clock Out Beranimasi
  const [showClockOutConfirm, setShowClockOutConfirm] = useState<boolean>(false);
  const [isClosingClockOutModal, setIsClosingClockOutModal] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);

  const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const currentShiftLabel = activeShift === 'morning' ? 'Morning Shift' : 'Night Shift';

  useEffect(() => {
    if (isOpen && currentUser) {
      setIsClosing(false);
      setShowClockOutConfirm(false);
      setIsClosingClockOutModal(false);
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

  const handleAnimatedClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      stopCamera();
      onClose();
      setIsClosing(false);
    }, 250);
  };

  const handleCloseClockOutConfirm = () => {
    setIsClosingClockOutModal(true);
    setTimeout(() => {
      setShowClockOutConfirm(false);
      setIsClosingClockOutModal(false);
    }, 250);
  };

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

  const getLocation = () => {
    setLocationError('');
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        position => {
          const coords = position.coords;
          const accuracy = coords.accuracy;
          setGpsAccuracy(Math.round(accuracy));

          const isMock = (position as any).isMock || (coords as any).isMocked;
          if (isMock) {
            setLocationError('⚠️ Penggunaan Fake GPS / Lokasi Palsu terdeteksi! Harap matikan aplikasi pengubah lokasi.');
            return;
          }

          if (!isLocalhost && accuracy < 2.0) {
            setLocationError('⚠️ Indikasi Fake GPS terdeteksi (Akurasi tidak wajar). Harap gunakan GPS asli HP.');
            return;
          }

          const lat = coords.latitude;
          const lng = coords.longitude;
          setLocation({ lat, lng });

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

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
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

  // ☁️ 3. Proses Clock In + Upload Foto Selfie & Kirim Telegram
  const handleClockIn = async () => {
    if (!currentUser) return;
    if (!photoBlob) {
      alert('Silakan ambil foto selfie terlebih dahulu!');
      return;
    }

    setIsLoading(true);

    try {
      const { data: staffData } = await supabase
        .from('staff')
        .select('first_name, last_name, staff_name')
        .eq('staff_id', currentUser.staff_id)
        .single();

      const staffDisplayName = staffData?.staff_name || 
        (staffData?.first_name ? `${staffData.first_name} ${staffData.last_name || ''}`.trim() : currentUser.name);

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

      const isOutsideRadius = !isLocalhost && distance !== null && distance > MAX_RADIUS_METERS;
      const isFakeGpsDetected = !!locationError && locationError.includes('Fake GPS');
      const isFakeGpsFlag = isOutsideRadius || isFakeGpsDetected;

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
          is_fake_gps: isFakeGpsFlag,
          gps_accuracy: gpsAccuracy,
          ip_address: ipAddress || 'Unknown',
          device_info: navigator.userAgent,
        },
      ]);

      setIsLoading(false);

      if (!error) {
        const waktuSekarang = new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        });

        sendTelegramAlert({
          title: isFakeGpsFlag
            ? '🚨 PRESENSI MASUK (PERINGATAN GPS)'
            : '🟢 PRESENSI MASUK (CLOCK IN)',
          actor: `${staffDisplayName} (${currentUser.staff_id})`,
          details: {
            'Divisi': currentUser.role.replace(/_/g, ' ').toUpperCase(),
            'Shift': currentShiftLabel,
            'Waktu Masuk': `${waktuSekarang} WITA`,
            'Jarak dari Kafe': distance !== null ? `${distance} Meter` : 'Tidak terdeteksi',
            'Status GPS': isFakeGpsFlag ? '⚠️ Indikasi Fake GPS / Luar Radius' : '✅ Valid (Real GPS)',
          },
          mapUrl: location ? `https://www.google.com/maps?q=${location.lat},${location.lng}` : undefined,
          photoUrl: photo_url || undefined,
        });

        setIsClosing(true);
        setTimeout(() => {
          stopCamera();
          onSuccess();
          onClose();
          setIsClosing(false);
        }, 250);
      } else {
        alert('Gagal Melakukan Clock In: ' + error.message);
      }
    } catch (err: any) {
      setIsLoading(false);
      alert('Terjadi kesalahan: ' + err.message);
    }
  };

  // 🚪 4. Proses Clock Out Eksekusi Database + Kirim Telegram
  const handleClockOutSubmit = async () => {
    if (!activeAttendance) return;
    setIsLoading(true);

    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from('attendances')
      .update({
        clock_out: nowIso,
        status: 'Completed',
      })
      .eq('id', activeAttendance.id);

    setIsLoading(false);

    if (!error) {
      const startMs = new Date(activeAttendance.clock_in).getTime();
      const endMs = new Date(nowIso).getTime();
      const diffHours = Math.max(0, (endMs - startMs) / (1000 * 60 * 60)).toFixed(2);
      const jamMasuk = new Date(activeAttendance.clock_in).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const jamPulang = new Date(nowIso).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      });

      sendTelegramAlert({
        title: '🔴 PRESENSI PULANG (CLOCK OUT)',
        actor: `${activeAttendance.staff_name || currentUser?.name} (${activeAttendance.staff_id || currentUser?.staff_id})`,
        details: {
          'Divisi': (activeAttendance.role || currentUser?.role || '').replace(/_/g, ' ').toUpperCase(),
          'Shift': activeAttendance.shift || currentShiftLabel,
          'Jam Masuk': `${jamMasuk} WITA`,
          'Jam Pulang': `${jamPulang} WITA`,
          'Total Durasi': `${diffHours} Jam`,
        },
      });

      setIsClosingClockOutModal(true);
      setTimeout(() => {
        setShowClockOutConfirm(false);
        setIsClosingClockOutModal(false);
        setIsClosing(true);
        setTimeout(() => {
          onSuccess();
          onClose();
          setIsClosing(false);
        }, 250);
      }, 250);
    } else {
      alert('Gagal Melakukan Clock Out: ' + error.message);
    }
  };

  const isOutsideRadius = !isLocalhost && distance !== null && distance > MAX_RADIUS_METERS;
  const isFakeGpsDetected = !!locationError && locationError.includes('Fake GPS');

  return createPortal(
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 ${
        isClosing ? 'animate-backdrop-out' : 'animate-backdrop-in'
      }`}
    >
      <style>{`
        @keyframes clockInBackdropIn { 0% { opacity: 0; } 100% { opacity: 1; } }
        @keyframes clockInBackdropOut { 0% { opacity: 1; } 100% { opacity: 0; } }
        @keyframes clockInModalIn {
          0% { opacity: 0; transform: scale(0.92) translateY(16px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes clockInModalOut {
          0% { opacity: 1; transform: scale(1) translateY(0); }
          100% { opacity: 0; transform: scale(0.95) translateY(10px); }
        }
        .animate-backdrop-in { animation: clockInBackdropIn 0.3s ease-out forwards; }
        .animate-backdrop-out { animation: clockInBackdropOut 0.25s ease-in forwards; }
        .animate-modal-in { animation: clockInModalIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-modal-out { animation: clockInModalOut 0.25s ease-in forwards; }
      `}</style>

      <div
        className={`bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-neutral-100 text-left relative my-auto ${
          isClosing ? 'animate-modal-out' : 'animate-modal-in'
        }`}
      >
        <button
          type="button"
          onClick={handleAnimatedClose}
          className="absolute right-4 top-4 w-8 h-8 rounded-full bg-neutral-100 text-neutral-400 font-bold hover:bg-neutral-200 transition cursor-pointer flex items-center justify-center text-xs active:scale-90"
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
              <p className="text-[10px] font-bold text-neutral-500 uppercase mt-0.5">
                Divisi: {currentUser?.role?.replace(/_/g, ' ')}
              </p>
              <p className="text-[11px] text-emerald-700 mt-1">
                Clock In: {new Date(activeAttendance.clock_in).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WITA
              </p>
            </div>

            <button
              onClick={() => setShowClockOutConfirm(true)}
              disabled={isLoading}
              className="w-full py-3.5 bg-neutral-900 hover:bg-black text-white font-bold text-xs rounded-2xl shadow-md transition cursor-pointer active:scale-95"
            >
              🚪 Clock Out (Selesai Shift)
            </button>
          </div>
        ) : (
          <div className="space-y-3.5">
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

            <div className="relative w-full h-48 bg-black rounded-2xl overflow-hidden flex items-center justify-center border border-neutral-200 shadow-inner">
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

      {showClockOutConfirm && createPortal(
        <div
          className={`fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 ${
            isClosingClockOutModal ? 'animate-backdrop-out' : 'animate-backdrop-in'
          }`}
        >
          <div
            className={`bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-neutral-100 text-left relative my-auto ${
              isClosingClockOutModal ? 'animate-modal-out' : 'animate-modal-in'
            }`}
          >
            <button
              type="button"
              onClick={handleCloseClockOutConfirm}
              disabled={isLoading}
              className="absolute right-4 top-4 w-8 h-8 rounded-full bg-neutral-100 text-neutral-400 font-bold hover:bg-neutral-200 transition cursor-pointer flex items-center justify-center text-xs active:scale-90"
            >
              ✕
            </button>

            <div className="flex flex-col items-center text-center space-y-2 pt-2 pb-1">
              <div className="w-14 h-14 bg-red-50 text-[#d22027] rounded-3xl flex items-center justify-center text-2xl font-black shadow-inner border border-red-100">
                🚪
              </div>
              <h3 className="text-base font-black text-[#111111]">Konfirmasi Selesai Shift</h3>
              <p className="text-xs text-neutral-500 font-medium">
                Apakah kamu yakin ingin menyelesaikan shift (<strong className="text-neutral-800">Clock Out</strong>) sekarang?
              </p>
            </div>

            {activeAttendance && (
              <div className="my-4 p-3 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs space-y-1">
                <div className="flex justify-between items-center text-neutral-600">
                  <span>Nama Staf:</span>
                  <span className="font-extrabold text-[#111111]">{currentUser?.name}</span>
                </div>
                <div className="flex justify-between items-center text-neutral-600">
                  <span>Jam Clock In:</span>
                  <span className="font-mono font-bold text-emerald-600">
                    {new Date(activeAttendance.clock_in).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WITA
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleCloseClockOutConfirm}
                disabled={isLoading}
                className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs rounded-2xl transition cursor-pointer active:scale-95"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleClockOutSubmit}
                disabled={isLoading}
                className="flex-1 py-3 bg-[#d22027] hover:bg-red-700 text-white font-black text-xs rounded-2xl shadow-md transition cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {isLoading ? 'Memproses...' : 'Ya, Selesai Shift'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>,
    document.body
  );
}