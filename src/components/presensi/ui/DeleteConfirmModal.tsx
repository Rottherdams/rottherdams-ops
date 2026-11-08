import { useState } from 'react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeleteConfirmModal({ isOpen, onClose, onConfirm }: DeleteConfirmModalProps) {
  const [isClosing, setIsClosing] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 180);
  };

  const handleConfirm = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onConfirm();
    }, 180);
  };

  return (
    <div
      onClick={handleClose}
      className={`fixed inset-0 z-[10000] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer transition-opacity duration-200 ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white rounded-3xl p-6 max-w-xs w-full text-center shadow-2xl border border-neutral-100 space-y-4 cursor-default ${
          isClosing ? 'confirm-card-out' : 'confirm-card-in'
        }`}
      >
        <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#d22027] text-2xl flex items-center justify-center mx-auto shadow-inner">
          🗑️
        </div>
        <div>
          <h4 className="text-base font-black text-[#111111]">Hapus Foto Ini?</h4>
          <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
            Foto akan dihapus permanen dari galeri rotator presensi.
          </p>
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleClose}
            className="flex-1 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs rounded-xl transition cursor-pointer active:scale-95"
          >
            Batal
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2.5 bg-[#d22027] hover:bg-[#b0181e] text-white font-bold text-xs rounded-xl transition cursor-pointer active:scale-95 shadow-md"
          >
            Ya, Hapus
          </button>
        </div>
      </div>
    </div>
  );
}