import React from 'react';

interface AvatarCropModalProps {
  cropImageSrc: string | null;
  onClose: () => void;
  onCropAndUpload: () => void;
  uploadingImage: boolean;
  imageRef: React.RefObject<HTMLImageElement | null>;
  zoom: number;
  setZoom: (val: number) => void;
  pan: { x: number; y: number };
  setPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  isDragging: boolean;
  setIsDragging: (val: boolean) => void;
  dragStart: { x: number; y: number };
  setDragStart: (val: { x: number; y: number }) => void;
}

export default function AvatarCropModal({
  cropImageSrc,
  onClose,
  onCropAndUpload,
  uploadingImage,
  imageRef,
  zoom,
  setZoom,
  pan,
  setPan,
  isDragging,
  setIsDragging,
  dragStart,
  setDragStart,
}: AvatarCropModalProps) {
  if (!cropImageSrc) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-60 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-3xl p-5 space-y-4 text-center shadow-2xl">
        <div>
          <h4 className="text-sm font-black text-[#111111]">Sesuaikan & Crop Foto</h4>
          <p className="text-[11px] text-neutral-400">Geser atau zoom agar posisi foto pas di lingkaran</p>
        </div>

        {/* AREA CANVAS CROP LINGKARAN */}
        <div
          className="relative w-64 h-64 mx-auto rounded-full overflow-hidden border-4 border-[#d22027] bg-neutral-900 cursor-grab active:cursor-grabbing select-none flex items-center justify-center"
          onMouseDown={(e) => {
            setIsDragging(true);
            setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
          }}
          onMouseMove={(e) => {
            if (!isDragging) return;
            setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
          }}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => setIsDragging(false)}
          onTouchStart={(e) => {
            setIsDragging(true);
            setDragStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y });
          }}
          onTouchMove={(e) => {
            if (!isDragging) return;
            setPan({ x: e.touches[0].clientX - dragStart.x, y: e.touches[0].clientY - dragStart.y });
          }}
          onTouchEnd={() => setIsDragging(false)}
        >
          <img
            ref={imageRef}
            src={cropImageSrc}
            alt="Crop preview"
            className="max-w-none max-h-none pointer-events-none transition-transform duration-75"
            style={{
              height: '100%',
              width: 'auto',
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            }}
          />
        </div>

        {/* SLIDER ZOOM */}
        <div className="space-y-1 px-4">
          <div className="flex justify-between items-center text-[10px] font-bold text-neutral-500">
            <span>Zoom Out</span>
            <span>Zoom In</span>
          </div>
          <input
            type="range"
            min="0.2"
            max="3"
            step="0.05"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-full accent-[#d22027]"
          />
        </div>

        {/* ACTION BUTTONS CROP */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onCropAndUpload}
            disabled={uploadingImage}
            className="flex-1 py-2 bg-[#d22027] hover:bg-[#bb2026] text-white rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
          >
            {uploadingImage ? 'Mengunggah...' : 'Simpan Foto'}
          </button>
        </div>
      </div>
    </div>
  );
}