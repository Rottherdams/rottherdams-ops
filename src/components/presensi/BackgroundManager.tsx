import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useBackgroundRotator } from '../../lib/hooks/useBackgroundRotator';
import DeleteConfirmModal from './ui/DeleteConfirmModal';
import BackgroundToast from './ui/BackgroundToast';

interface BackgroundManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdateSuccess?: (urls: string[]) => void;
}

export default function BackgroundManager({ isOpen, onClose, onUpdateSuccess }: BackgroundManagerProps) {
  const {
    backgroundUrls,
    blurLevel,
    setBlurLevel,
    overlayOpacity,
    setOverlayOpacity,
    isRandom,
    setIsRandom,
    loading,
    submitting,
    toast,
    fetchBackgrounds,
    handleAddUrl,
    executeDeleteUrl,
    saveSettingsToDb,
    saveToSupabase,
  } = useBackgroundRotator(isOpen, onUpdateSuccess);

  const [newImageUrl, setNewImageUrl] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const [deleteTargetUrl, setDeleteTargetUrl] = useState<string | null>(null);

  // Helper presisi mendeteksi Video MP4 vs Foto JPG/PNG
  const isVideoUrl = (url?: string): boolean => {
    if (!url) return false;
    
    const filenameMatch = url.match(/filename=([^&]+)/i);
    if (filenameMatch && filenameMatch[1]) {
      const fn = decodeURIComponent(filenameMatch[1]).toLowerCase();
      if (fn.endsWith('.mp4') || fn.endsWith('.webm') || fn.endsWith('.mov') || fn.endsWith('.m4v')) return true;
      if (fn.endsWith('.jpg') || fn.endsWith('.jpeg') || fn.endsWith('.png') || fn.endsWith('.webp')) return false;
    }

    const mainPath = url.split('?')[0].toLowerCase();
    return (
      mainPath.endsWith('.mp4') ||
      mainPath.endsWith('.webm') ||
      mainPath.endsWith('.mov') ||
      mainPath.endsWith('.m4v')
    );
  };

  // Fungsi mengacak susunan array media galeri
  const handleShuffleUrls = async () => {
    if (backgroundUrls.length <= 1) return;
    const shuffled = [...backgroundUrls].sort(() => Math.random() - 0.5);
    await saveToSupabase(shuffled);
  };

  const handleAnimatedClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 180);
  };

  const onSubmitUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newImageUrl.trim()) return;
    handleAddUrl(newImageUrl.trim(), () => setNewImageUrl(''));
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      onClick={handleAnimatedClose}
      className={`fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity duration-200 cursor-pointer ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <style>{`
        @keyframes popupModalIn { 0% { opacity: 0; transform: scale(0.95) translateY(6px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes popupModalOut { 0% { opacity: 1; transform: scale(1) translateY(0); } 100% { opacity: 0; transform: scale(0.95) translateY(6px); } }
        .popup-card-in { animation: popupModalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .popup-card-out { animation: popupModalOut 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <BackgroundToast toast={toast} />

      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white border border-neutral-100 text-[#111111] rounded-3xl max-w-xl w-full p-6 shadow-2xl flex flex-col max-h-[90vh] text-left cursor-default relative overflow-y-auto no-scrollbar ${
          isClosing ? 'popup-card-out' : 'popup-card-in'
        }`}
      >
        {/* Header Modal */}
        <div className="flex justify-between items-center pb-4 border-b border-neutral-100">
          <div>
            <span className="text-[10px] uppercase font-extrabold text-[#d22027] tracking-wider">Management Visual Presensi</span>
            <h3 className="text-lg font-black text-[#111111]">🖼️ Kelola Rotator Background Presensi</h3>
          </div>
          <button onClick={handleAnimatedClose} className="w-8 h-8 rounded-full bg-neutral-100 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200 flex items-center justify-center font-bold text-xs transition cursor-pointer active:scale-90">
            ✕
          </button>
        </div>

        {/* Form Tambah Link */}
        <form onSubmit={onSubmitUrl} className="py-4 border-b border-neutral-100 space-y-2">
          <p className="text-xs font-bold text-neutral-700">Tambah Link Media (Direct Foto / Video MP4 URL)</p>
          <div className="flex gap-2">
            <input
              type="url"
              required
              placeholder="https://... (.jpg, .png, .mp4)"
              value={newImageUrl}
              onChange={(e) => setNewImageUrl(e.target.value)}
              className="flex-1 px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-[#111111] focus:outline-none focus:border-[#d22027] focus:bg-white transition placeholder:text-neutral-400"
            />
            <button type="submit" disabled={submitting} className="px-4 py-2.5 bg-[#d22027] hover:bg-[#b0181e] text-white text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50 whitespace-nowrap active:scale-95 shadow-sm">
              {submitting ? 'Simpan...' : '➕ Tambah Link'}
            </button>
          </div>
        </form>

        {/* Galeri Horizontal View */}
        <div className="py-4 space-y-3 border-b border-neutral-100">
          <div className="flex justify-between items-center">
            <p className="text-xs font-bold text-neutral-500">Daftar Media Aktif Dalam Rotator ({backgroundUrls.length})</p>
            <div className="flex items-center gap-2">
              <button 
                type="button" 
                onClick={handleShuffleUrls} 
                disabled={backgroundUrls.length <= 1 || submitting} 
                className="text-[10px] text-neutral-600 hover:text-[#d22027] font-bold cursor-pointer transition flex items-center gap-1 bg-neutral-100 hover:bg-neutral-200 px-2.5 py-1 rounded-lg border border-neutral-200/60 disabled:opacity-50"
              >
                🎲 Acak Urutan
              </button>
              <button 
                type="button" 
                onClick={fetchBackgrounds} 
                className="text-[10px] text-neutral-400 hover:text-[#d22027] font-bold cursor-pointer transition flex items-center gap-1"
              >
                🔄 Refresh Data
              </button>
            </div>
          </div>

          <div className="min-h-[140px] flex items-center">
            {loading ? (
              <div className="w-full h-[140px] flex flex-col items-center justify-center gap-2 border border-dashed border-neutral-200 bg-neutral-50/50 rounded-2xl">
                <div className="w-5 h-5 border-2 border-[#d22027] border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-bold text-neutral-400 animate-pulse">Membaca galeri media...</p>
              </div>
            ) : backgroundUrls.length === 0 ? (
              <div className="w-full h-[140px] flex items-center justify-center border border-dashed border-neutral-200 bg-neutral-50/50 rounded-2xl">
                <p className="text-xs text-neutral-400 font-medium">Belum ada media di galeri. Silakan masukkan link URL foto/video!</p>
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto no-scrollbar w-full py-1.5 px-0.5 scroll-smooth">
                {backgroundUrls.map((url, idx) => {
                  const isVid = isVideoUrl(url);
                  return (
                    <div key={idx} className="relative group rounded-2xl overflow-hidden border border-neutral-200 bg-neutral-900 aspect-video w-[180px] sm:w-[200px] shrink-0 shadow-xs">
                      {isVid ? (
                        <>
                          <video
                            src={url}
                            muted
                            playsInline
                            className="w-full h-full object-cover transition transform group-hover:scale-105 opacity-90 pointer-events-none"
                          />
                          <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-white text-[9px] font-bold flex items-center gap-1 pointer-events-none z-10 border border-white/10">
                            🎬 Video MP4
                          </span>
                        </>
                      ) : (
                        <img src={url} alt={`BG ${idx + 1}`} className="w-full h-full object-cover transition transform group-hover:scale-105" />
                      )}

                      <button onClick={() => setDeleteTargetUrl(url)} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-600/90 hover:bg-red-700 text-white flex items-center justify-center text-xs shadow-md backdrop-blur-xs transition active:scale-90 z-20 cursor-pointer" title="Hapus Media">
                        🗑️
                      </button>
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition pointer-events-none" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* CONTROL SLIDERS & CHECKBOX RANDOM OPTION */}
        <div className="pt-4 space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs font-extrabold text-[#111111] uppercase tracking-wider">🎛️ Pengaturan Efek & Rotasi Visual</p>
            <button
              onClick={() => saveSettingsToDb(blurLevel, overlayOpacity, isRandom)}
              disabled={submitting}
              className="px-3 py-1.5 bg-[#d22027] hover:bg-[#b0181e] text-white text-[11px] font-bold rounded-lg transition active:scale-95 cursor-pointer disabled:opacity-50 shadow-xs"
            >
              {submitting ? 'Simpan...' : 'Simpan Efek'}
            </button>
          </div>

          {/* OPSI CHECKBOX RANDOMIZE */}
          <div className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200/80 flex items-center justify-between">
            <div className="space-y-0.5">
              <label htmlFor="checkbox-random-bg" className="text-xs font-bold text-neutral-800 flex items-center gap-1.5 cursor-pointer select-none">
                <span>🎲 Putar Acak (Randomized)</span>
              </label>
              <p className="text-[10px] text-neutral-500 font-medium">Acak otomatis media awal & urutan putar tiap kali web dibuka/direfresh.</p>
            </div>
            <input
              id="checkbox-random-bg"
              type="checkbox"
              checked={isRandom}
              onChange={(e) => setIsRandom(e.target.checked)}
              className="w-4 h-4 accent-[#d22027] cursor-pointer rounded"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-neutral-50 p-4 rounded-2xl border border-neutral-200/60">
            {/* Slider 1: Blur Level */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-neutral-700">
                <span>Keburaman (Blur):</span>
                <span className="text-[#d22027] font-mono">{blurLevel}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="16"
                step="1"
                value={blurLevel}
                onChange={(e) => setBlurLevel(Number(e.target.value))}
                className="w-full accent-[#d22027] cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-neutral-400 font-medium">
                <span>0px (Jernih)</span>
                <span>16px (Buram)</span>
              </div>
            </div>

            {/* Slider 2: Overlay Black Gradient */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-neutral-700">
                <span>Kepekatan Gradasi Hitam:</span>
                <span className="text-[#d22027] font-mono">{overlayOpacity}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={overlayOpacity}
                onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                className="w-full accent-[#d22027] cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-neutral-400 font-medium">
                <span>10% (Tipis)</span>
                <span>100% (Pekat)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <DeleteConfirmModal
        isOpen={Boolean(deleteTargetUrl)}
        onClose={() => setDeleteTargetUrl(null)}
        onConfirm={() => {
          if (deleteTargetUrl) executeDeleteUrl(deleteTargetUrl);
          setDeleteTargetUrl(null);
        }}
      />
    </div>,
    document.body
  );
}