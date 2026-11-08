import { useState } from 'react';
import { createPortal } from 'react-dom';

interface ClockOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  staffName?: string;
  clockInTime?: string;
  isLoading?: boolean;
}

export default function ClockOutModal({
  isOpen,
  onClose,
  onConfirm,
  staffName,
  clockInTime,
  isLoading = false,
}: ClockOutModalProps) {
  const [isClosing, setIsClosing] = useState(false);

  if (!isOpen) return null;

  const handleAnimatedClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 250);
  };

  const handleConfirm = async () => {
    setIsClosing(true);
    setTimeout(async () => {
      await onConfirm();
      setIsClosing(false);
    }, 250);
  };

  return createPortal(
    <div
      className={`fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 ${
        isClosing ? 'animate-backdrop-out' : 'animate-backdrop-in'
      }`}
    >
      {/* 🌟 Keyframe Animasi Backdrop & Modal */}
      <style>{`
        @keyframes clockOutBackdropIn { 0% { opacity: 0; } 100% { opacity: 1; } }
        @keyframes clockOutBackdropOut { 0% { opacity: 1; } 100% { opacity: 0; } }
        @keyframes clockOutModalIn {
          0% { opacity: 0; transform: scale(0.92) translateY(16px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes clockOutModalOut {
          0% { opacity: 1; transform: scale(1) translateY(0); }
          100% { opacity: 0; transform: scale(0.95) translateY(10px); }
        }
        .animate-backdrop-in { animation: clockOutBackdropIn 0.3s ease-out forwards; }
        .animate-backdrop-out { animation: clockOutBackdropOut 0.25s ease-in forwards; }
        .animate-modal-in { animation: clockOutModalIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-modal-out { animation: clockOutModalOut 0.25s ease-in forwards; }
      `}</style>

      <div
        className={`bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-neutral-100 text-left relative my-auto ${
          isClosing ? 'animate-modal-out' : 'animate-modal-in'
        }`}
      >
        {/* TOMBOL X */}
        <button
          type="button"
          onClick={handleAnimatedClose}
          disabled={isLoading}
          className="absolute right-4 top-4 w-8 h-8 rounded-full bg-neutral-100 text-neutral-400 font-bold hover:bg-neutral-200 transition cursor-pointer flex items-center justify-center text-xs active:scale-90"
        >
          ✕
        </button>

        {/* HEADER ICON & TITLE */}
        <div className="flex flex-col items-center text-center space-y-2 pt-2 pb-1">
          <div className="w-14 h-14 bg-red-50 text-[#d22027] rounded-3xl flex items-center justify-center text-2xl font-black shadow-inner border border-red-100">
            🚪
          </div>
          <h3 className="text-base font-black text-[#111111]">Konfirmasi Selesai Shift</h3>
          <p className="text-xs text-neutral-500 font-medium">
            Apakah kamu yakin ingin menyelesaikan shift (<strong className="text-neutral-800">Clock Out</strong>) sekarang?
          </p>
        </div>

        {/* DETAIL INFO STAF & WAKTU */}
        {(staffName || clockInTime) && (
          <div className="my-4 p-3 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs space-y-1">
            {staffName && (
              <div className="flex justify-between items-center text-neutral-600">
                <span>Nama Staf:</span>
                <span className="font-extrabold text-[#111111]">{staffName}</span>
              </div>
            )}
            {clockInTime && (
              <div className="flex justify-between items-center text-neutral-600">
                <span>Jam Clock In:</span>
                <span className="font-mono font-bold text-emerald-600">{clockInTime} WITA</span>
              </div>
            )}
          </div>
        )}

        {/* TOMBOL AKSI */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={handleAnimatedClose}
            disabled={isLoading}
            className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs rounded-2xl transition cursor-pointer active:scale-95"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
            className="flex-1 py-3 bg-[#d22027] hover:bg-red-700 text-white font-black text-xs rounded-2xl shadow-md transition cursor-pointer active:scale-95 disabled:opacity-50"
          >
            {isLoading ? 'Memproses...' : 'Ya, Selesai Shift'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}