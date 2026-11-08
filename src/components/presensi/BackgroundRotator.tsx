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
  blurLevel = 4,
  overlayOpacity = 80,
  isRandom = false,
  children,
}: BackgroundRotatorProps) {
  const activeMediaList = images;

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

  // Inisialisasi Media Pertama (Foto / Video): Langsung diacak secara instan begitu data Supabase siap
  useEffect(() => {
    if (activeMediaList && activeMediaList.length > 0) {
      if (isRandom && activeMediaList.length > 1) {
        const randomIndex = Math.floor(Math.random() * activeMediaList.length);
        setCurrentIndex(randomIndex);
      } else if (currentIndex === null) {
        setCurrentIndex(0);
      }
    }
  }, [activeMediaList, isRandom]);

  const activeIndex = currentIndex ?? 0;
  const currentMedia = activeMediaList[activeIndex];
  const isCurrentVideo = isVideoUrl(currentMedia);

  const goToNextMedia = () => {
    if (activeMediaList.length <= 1) return;

    let upcomingIndex: number;

    if (isRandom) {
      // Pilih indeks acak foto/video yang berbeda dari media saat ini
      upcomingIndex = Math.floor(Math.random() * activeMediaList.length);
      if (upcomingIndex === activeIndex) {
        upcomingIndex = (activeIndex + 1) % activeMediaList.length;
      }
    } else {
      // Urutan linier normal
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

  // Handler saat Video selesai diputar (Video Ended Event)
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
    <div className="relative w-full h-full overflow-hidden rounded-3xl select-none">
      <style>{`
        @keyframes kenBurnsZoom {
          0% { transform: scale(1) translate(0%, 0%); }
          50% { transform: scale(1.08) translate(-1%, -1%); }
          100% { transform: scale(1.15) translate(0.5%, -0.5%); }
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
          style={{ filter: `blur(${blurLevel}px)` }}
        />
      ) : (
        <div
          key={`img-${activeIndex}`}
          className="absolute inset-0 bg-cover bg-center animate-ken-burns pointer-events-none"
          style={{ 
            backgroundImage: `url('${currentMedia}')`,
            filter: `blur(${blurLevel}px)`
          }}
        />
      )}

      {/* LAYER 2: INCOMING MEDIA (TRANSISI CROSSFADE SAMA UNTUK FOTO & VIDEO) */}
      {activeMediaList.length > 1 && (
        isVideoUrl(activeMediaList[nextIndex]) ? (
          <video
            key={`next-video-${nextIndex}`}
            src={activeMediaList[nextIndex]}
            muted
            playsInline
            className={`absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-[1200ms] cubic-bezier(0.4, 0, 0.2, 1) ${
              isTransitioning ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ filter: `blur(${blurLevel}px)` }}
          />
        ) : (
          <div
            key={`next-img-${nextIndex}`}
            className={`absolute inset-0 bg-cover bg-center animate-ken-burns pointer-events-none transition-opacity duration-[1200ms] cubic-bezier(0.4, 0, 0.2, 1) ${
              isTransitioning ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ 
              backgroundImage: `url('${activeMediaList[nextIndex]}')`,
              filter: `blur(${blurLevel}px)`
            }}
          />
        )
      )}

      <div 
        className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none transition-opacity duration-300"
        style={{ opacity: overlayOpacity / 100 }}
      />
      
      <div className="absolute -right-12 -bottom-12 w-56 h-56 bg-[#d22027] rounded-full blur-2xl opacity-25 pointer-events-none" />

      <div className="relative z-10 w-full h-full">{children}</div>
    </div>
  );
}