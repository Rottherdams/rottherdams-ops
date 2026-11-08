import { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ImagePreviewModalProps {
  isOpen: boolean;
  imageUrl: string | null;
  title?: string;
  onClose: () => void;
}

export default function ImagePreviewModal({
  isOpen,
  imageUrl,
  title = 'Pratinjau Gambar',
  onClose,
}: ImagePreviewModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !imageUrl) return null;

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="relative max-w-4xl w-full bg-[#111111] rounded-3xl overflow-hidden border border-neutral-800 shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header Modal */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-neutral-800 bg-[#161616]">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span>🔍</span> {title}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold flex items-center justify-center text-xs transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Konten Gambar */}
        <div className="p-4 flex items-center justify-center overflow-auto flex-1 bg-black/40">
          <img
            src={imageUrl}
            alt={title}
            className="max-h-[75vh] w-auto object-contain rounded-xl shadow-lg"
          />
        </div>
      </div>
    </div>,
    document.body
  );
}