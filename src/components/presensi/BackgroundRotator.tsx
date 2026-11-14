import React, { useState, useEffect, useRef } from 'react';

interface BackgroundRotatorProps {
  images: string[];          // Array URL (media campuran: foto .jpg/.png ATAU video .mp4)
  intervalMs?: number;       // Durasi default untuk FOTO (default: 7000ms)
  blurLevel?: number;        // Level keburaman
  overlayOpacity?: number;   // Kepekatan overlay hitam
  isRandom?: boolean;        // Opsi acak urutan & media awal
  children?: React.ReactNode; 
}

export default function BackgroundRotator({
  images,
  intervalMs = 7000,
  blurLevel = 2,
  overlayOpacity = 70,
  isRandom = false,
  children,
}: BackgroundRotatorProps) {
  const activeMediaList = (images || []).filter(Boolean);

  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [nextIndex, setNextIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

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

  // Inisialisasi Media Pertama (Foto / Video)
  useEffect(() => {
    if (activeMediaList.length > 0) {
      if (isRandom && activeMediaList.length > 1 && currentIndex === null) {
        const randomIndex = Math.floor(Math.random() * activeMediaList.length);
        setCurrentIndex(randomIndex);
      } else if (currentIndex === null || currentIndex >= activeMediaList.length) {
        setCurrentIndex(0);
      }
    }
  }, [activeMediaList.length, isRandom]);

  const activeIndex = currentIndex ?? 0;
  const currentMedia = activeMediaList[activeIndex];
  const isCurrentVideo = isVideoUrl(currentMedia);

  const goToNextMedia = () => {
    if (activeMediaList.length <= 1) return;

    let upcomingIndex: number;

    if (isRandom) {
      upcomingIndex = Math.floor(Math.random() * activeMediaList.length);
      if (upcomingIndex === activeIndex) {
        upcomingIndex = (activeIndex + 1) % activeMediaList.length;
      }
    } else {
      upcomingIndex = (activeIndex + 1) % activeMediaList.length;
    }

    setNextIndex(upcomingIndex);
    setIsTransitioning(true);

    setTimeout(() => {
      setCurrentIndex(upcomingIndex);
      setIsTransitioning(false);
    }, 1200);
  };

  // Timer Rotasi Otomatis (Hanya untuk Foto)
  useEffect(() => {
    if (activeMediaList.length <= 1 || isCurrentVideo || currentIndex === null) return;

    const timer = setTimeout(() => {
      goToNextMedia();
    }, intervalMs);

    return () => clearTimeout(timer);
  }, [currentIndex, activeMediaList.length, intervalMs, isCurrentVideo, isRandom]);

  // Handler saat Video selesai diputar
  const handleVideoEnded = () => {
    if (activeMediaList.length > 1) {
      goToNextMedia();
    } else if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  };

  if (activeMediaList.length === 0 || currentIndex === null) {
    return (
      <div className="relative w-full h-full overflow-hidden rounded-3xl bg-neutral-900 border border-neutral-800 text-left">
        <div className="relative z-10 w-full h-full">{children}</div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden rounded-3xl bg-neutral-900 select-none">
      <style>{`
        @keyframes kenBurnsZoom {
          0% { transform: scale(1) translate(0%, 0%); }
          50% { transform: scale(1.06) translate(-1%, -1%); }
          100% { transform: scale(1.12) translate(0.5%, -0.5%); }
        }
        .animate-ken-burns {
          animation: kenBurnsZoom 14s ease-out infinite alternate;
          will-change: transform;
        }
      `}</style>

      {/* LAYER 1: BASE MEDIA (FOTO ATAU VIDEO) */}
      {isCurrentVideo ? (
        <video
          ref={videoRef}
          key={`video-${activeIndex}`}
          src={currentMedia}
          autoPlay
          muted
          playsInline
          onEnded={handleVideoEnded}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={blurLevel > 0 ? { filter: `blur(${blurLevel}px)` } : undefined}
        />
      ) : (
        <img
          key={`img-${activeIndex}`}
          src={currentMedia}
          alt="Background Operasional"
          loading="eager"
          onError={() => {
            if (activeMediaList.length > 1) goToNextMedia();
          }}
          className="absolute inset-0 w-full h-full object-cover object-center animate-ken-burns pointer-events-none"
          style={blurLevel > 0 ? { filter: `blur(${blurLevel}px)` } : undefined}
        />
      )}

      {/* LAYER 2: INCOMING MEDIA (TRANSISI CROSSFADE) */}
      {activeMediaList.length > 1 && (
        isVideoUrl(activeMediaList[nextIndex]) ? (
          <video
            key={`next-video-${nextIndex}`}
            src={activeMediaList[nextIndex]}
            muted
            playsInline
            className={`absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-[1200ms] ease-in-out ${
              isTransitioning ? 'opacity-100' : 'opacity-0'
            }`}
            style={blurLevel > 0 ? { filter: `blur(${blurLevel}px)` } : undefined}
          />
        ) : (
          <img
            key={`next-img-${nextIndex}`}
            src={activeMediaList[nextIndex]}
            alt=""
            className={`absolute inset-0 w-full h-full object-cover object-center animate-ken-burns pointer-events-none transition-opacity duration-[1200ms] ease-in-out ${
              isTransitioning ? 'opacity-100' : 'opacity-0'
            }`}
            style={blurLevel > 0 ? { filter: `blur(${blurLevel}px)` } : undefined}
          />
        )
      )}

      {/* OVERLAY GRADIENT (Menjaga keterbacaan teks tanpa menutupi gambar sepenuhnya) */}
      <div 
        className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-black/15 pointer-events-none transition-opacity duration-300"
        style={{ opacity: Math.min(overlayOpacity, 85) / 100 }}
      />
      
      <div className="absolute -right-12 -bottom-12 w-56 h-56 bg-[#d22027] rounded-full blur-2xl opacity-25 pointer-events-none" />

      <div className="relative z-10 w-full h-full">{children}</div>
    </div>
  );
}