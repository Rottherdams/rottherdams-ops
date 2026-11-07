import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface CurrentUser {
  name: string;
  role: string;
  staff_id: string;
  status?: string;
  avatar_url?: string;
}

interface RecipeItem {
  id: number;
  name: string;
  category: string;
  grammage: string;
  temperature: string;
  extraction_time: string;
}

interface BukuResepProps {
  currentUser?: CurrentUser | null;
}

export default function BukuResep({ currentUser }: BukuResepProps) {
  const [recipes, setRecipes] = useState<RecipeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'Beverage' | 'Food' | 'Pastry'>('All');

  // State Keamanan: Press & Hold ID
  const [unlockedRecipeId, setUnlockedRecipeId] = useState<number | null>(null);
  const [screenshotWarning, setScreenshotWarning] = useState(false);

  // State Pop-Up Peringatan Kerahasiaan
  const [showWarningModal, setShowWarningModal] = useState(true);

  // State Modal Tambah Resep
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'Beverage' | 'Food' | 'Pastry'>('Beverage');
  const [grammage, setGrammage] = useState('');
  const [temperature, setTemperature] = useState('');
  const [extractionTime, setExtractionTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Ref untuk timer auto-blur 15 detik
  const autoBlurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Normalisasi role & status
  const rawRole = (currentUser?.role || '').toLowerCase();
  const rawStatus = (currentUser?.status || '').toLowerCase();

  const isResign = rawStatus.includes('resign');
  const isManagementOrOwner = rawRole.includes('management') || rawRole.includes('owner');
  const isBar = rawRole.includes('bar');
  const isDapur = rawRole.includes('dapur') || rawRole.includes('kitchen');
  const isKasir = rawRole.includes('kasir') || rawRole.includes('cashier');

  const formattedDate = new Date().toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  useEffect(() => {
    fetchRecipes();
  }, []);

  // 🛡️ 1. DETEKSI SCREENSHOT & VISIBILITY / BLUR CHANGE (LOG SECURITY)
  useEffect(() => {
    if (!currentUser) return;

    const logSecurityViolation = async (type: string) => {
      try {
        await supabase.from('security_audit_logs').insert([
          {
            staff_id: currentUser.staff_id,
            staff_name: currentUser.name,
            role: currentUser.role,
            action_type: `SCREENSHOT_ATTEMPT_${type}`,
            target_recipe: unlockedRecipeId ? `Resep ID: ${unlockedRecipeId}` : 'Halaman Buku Resep',
            device_info: navigator.userAgent,
          },
        ]);
      } catch (err) {
        console.error('Gagal mencatat log pelanggaran screenshot:', err);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'PrintScreen' ||
        (e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4' || e.key === '5')) ||
        (e.ctrlKey && e.key === 'p')
      ) {
        setScreenshotWarning(true);
        logSecurityViolation('KEYBOARD_SHORTCUT');
        setTimeout(() => setScreenshotWarning(false), 4000);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && unlockedRecipeId) {
        logSecurityViolation('TAB_SWITCH_WHILE_UNLOCKED');
        setUnlockedRecipeId(null);
      }
    };

    const handleWindowBlur = () => {
      if (unlockedRecipeId) {
        logSecurityViolation('MOBILE_APP_SWITCH');
        setUnlockedRecipeId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [currentUser, unlockedRecipeId]);

  const fetchRecipes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.error('Error fetching recipes:', error.message);
    } else if (data) {
      setRecipes(data);
    }
    setLoading(false);
  };

  // 📖 2. MEKANISME PRESS & HOLD (TEKAN & TAHAN UNTUK BUKU RESEP)
  const handlePressStart = async (item: RecipeItem) => {
    setUnlockedRecipeId(item.id);

    // Set auto-blur 15 detik jika ditahan terlalu lama
    if (autoBlurTimerRef.current) clearTimeout(autoBlurTimerRef.current);
    autoBlurTimerRef.current = setTimeout(() => {
      setUnlockedRecipeId(null);
    }, 15000);

    // Rekam Log Audit Pembacaan Resep
    if (currentUser) {
      try {
        await supabase.from('security_audit_logs').insert([
          {
            staff_id: currentUser.staff_id,
            staff_name: currentUser.name,
            role: currentUser.role,
            action_type: 'READ_RECIPE',
            target_recipe: item.name,
            device_info: navigator.userAgent,
          },
        ]);
      } catch (err) {
        console.warn('Gagal mencatat log pembacaan resep:', err);
      }
    }
  };

  const handlePressEnd = () => {
    if (autoBlurTimerRef.current) clearTimeout(autoBlurTimerRef.current);
    setUnlockedRecipeId(null); // Langsung Blur seketika saat jari terlepas dari layar HP
  };

  const handleAddRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    const { error } = await supabase.from('recipes').insert([
      {
        name: name.trim(),
        category: category,
        grammage: grammage.trim(),
        temperature: temperature.trim() || '-',
        extraction_time: extractionTime.trim() || '-',
      },
    ]);

    setIsSubmitting(false);

    if (error) {
      alert('Gagal menambahkan resep: ' + error.message);
    } else {
      setName('');
      setGrammage('');
      setTemperature('');
      setExtractionTime('');
      setIsAddModalOpen(false);
      fetchRecipes();
    }
  };

  const handleDeleteRecipe = async (e: React.MouseEvent, id: number, recipeName: string) => {
    e.stopPropagation();
    if (!confirm(`Apakah Anda yakin ingin menghapus resep "${recipeName}"?`)) return;

    const { error } = await supabase
      .from('recipes')
      .delete()
      .eq('id', id);

    if (error) {
      alert('Gagal menghapus resep: ' + error.message);
    } else {
      fetchRecipes();
    }
  };

  // FILTER STRICT PER DIVISI
  const getAllowedRecipes = () => {
    if (isBar && !isManagementOrOwner) {
      return recipes.filter(r => (r.category || '').toLowerCase() === 'beverage');
    }
    if (isDapur && !isManagementOrOwner) {
      return recipes.filter(r => {
        const cat = (r.category || '').toLowerCase();
        return cat === 'food' || cat === 'pastry';
      });
    }
    return recipes;
  };

  const roleAllowedRecipes = getAllowedRecipes();

  const filteredRecipes = (isBar && !isManagementOrOwner)
    ? roleAllowedRecipes
    : (selectedCategory === 'All'
        ? roleAllowedRecipes
        : roleAllowedRecipes.filter(r => (r.category || 'Beverage').toLowerCase() === selectedCategory.toLowerCase()));

  // AKSES DIBLOKIR UNTUK STAF RESIGN ATAU DIVISI KASIR
  if (isResign || (isKasir && !isManagementOrOwner && !isBar && !isDapur)) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-neutral-200 shadow-sm text-center">
        <div className="text-4xl mb-3">🔒</div>
        <h2 className="text-base font-extrabold text-[#111111] mb-1">Akses Buku Resep Dibatasi</h2>
        <p className="text-xs text-neutral-500 max-w-md mx-auto">
          {isResign
            ? 'Akun Anda berstatus Resign. Akses ke dokumen dan rahasia resep perusahaan telah dinonaktifkan.'
            : 'Divisi Kasir tidak diizinkan mengakses buku resep dan standar gramasi. Resep hanya dapat diakses oleh tim Bar, Kitchen, dan Management.'}
        </p>
      </div>
    );
  }

  return (
    <div 
      className="bg-white rounded-3xl p-6 border border-neutral-200 shadow-sm text-left space-y-6 relative select-none"
      onCopy={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* 🌊 DYNAMIC WATERMARK MELAYANG DI LAYAR */}
      {currentUser && (
        <div className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between p-6 opacity-[0.06] rotate-[-15deg] overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex justify-around text-xs md:text-sm font-black tracking-widest text-black whitespace-nowrap">
              <span>{currentUser.name} ({currentUser.staff_id})</span>
              <span>ROTTHERDAMS CONFIDENTIAL</span>
              <span>{formattedDate} WITA</span>
            </div>
          ))}
        </div>
      )}

      {/* ⚠️ NOTIFIKASI DETEKSI SCREENSHOT */}
      {screenshotWarning && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-6 py-3 rounded-2xl shadow-2xl font-bold text-xs flex items-center gap-2 animate-bounce">
          <span>⚠️ TERDETEKSI INDIKASI SCREENSHOT!</span>
          <span className="text-[10px] opacity-80">Aktivitas ini telah dicatat ke log audit keamanan.</span>
        </div>
      )}
      
      {/* POP-UP MODAL PERINGATAN KERAHASIAAN DOKUMEN */}
      {showWarningModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f0f0f] border-2 border-red-600 rounded-3xl p-6 max-w-lg w-full text-white shadow-2xl relative text-left">
            <div className="flex items-center gap-2 mb-3 bg-red-600 text-white font-black text-xs sm:text-sm px-3.5 py-1.5 rounded-xl w-fit uppercase tracking-wider">
              <span>⚠️</span> PERINGATAN KERAHASIAAN DOKUMEN <span>⚠️</span>
            </div>

            <h3 className="text-sm sm:text-base font-black text-red-400 mb-2 leading-snug">
              DILARANG MENGAMBIL FOTO, MENYEBARKAN, ATAU MEMBAGIKAN ISI BUKU RESEP INI KEPADA PIHAK LUAR!
            </h3>

            <p className="text-xs font-bold text-neutral-200 mb-4 uppercase tracking-wide">
              SELURUH DATA GRAMASI DAN STANDAR RESEP DI APLIKASI INI ADALAH ASET RAHASIA DAGANG ROTTHERDAMS.
            </p>

            <div className="bg-neutral-900/90 rounded-2xl p-4 border border-neutral-800 space-y-2 text-xs text-neutral-300 mb-5">
              <p className="font-bold text-red-400 uppercase text-[11px]">SANKSI PIDANA & HUKUMAN:</p>

              <ul className="list-disc list-inside space-y-2 leading-relaxed text-[11px]">
                <li>
                  <strong className="text-white">UU No. 30 Tahun 2000 (Rahasia Dagang) Pasal 13 & 17:</strong> Membocorkan resep/rahasia bisnis diancam pidana penjara paling lama <strong className="text-red-400">2 TAHUN</strong> dan/atau denda hingga <strong className="text-red-400">Rp300.000.000,-</strong>.
                </li>
                <li>
                  <strong className="text-white">UU No. 1 Tahun 2024 (ITE) Pasal 32 & 48:</strong> Menyebarkan, memfoto, atau mendistribusikan data digital perusahaan tanpa hak diancam pidana penjara paling lama <strong className="text-red-400">8 TAHUN</strong> dan/atau denda hingga <strong className="text-red-400">Rp2.000.000.000,- (2 Miliar Rupiah)</strong>.
                </li>
                <li>
                  <strong className="text-white">Sanksi Perusahaan:</strong> Pemutusan Hubungan Kerja (PHK) seketika tanpa pesangon serta tuntutan ganti rugi perdata atas kerugian bisnis.
                </li>
              </ul>
            </div>

            <p className="text-[10px] italic text-neutral-400 mb-5">
              * Aktivitas dan jejak akses akun Anda di dalam sistem ini dipantau oleh manajemen.
            </p>

            <button
              onClick={() => setShowWarningModal(false)}
              className="w-full py-3.5 bg-[#d22027] hover:bg-[#bb2026] active:scale-95 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg transition cursor-pointer text-center"
            >
              Saya Mengerti & Setuju
            </button>
          </div>
        </div>
      )}

      {/* BANNER PERINGATAN KERAHASIAAN DOKUMEN HEADER */}
      <div className="bg-[#0f0f0f] border-2 border-red-600/80 rounded-2xl p-4 sm:p-5 text-white shadow-md">
        <div className="flex items-center gap-2 mb-2 bg-red-600 text-white font-black text-xs sm:text-sm px-3 py-1 rounded-lg w-fit uppercase tracking-wider">
          <span>⚠️</span> PERINGATAN KERAHASIAAN DOKUMEN <span>⚠️</span>
        </div>

        <p className="text-xs sm:text-sm font-extrabold text-red-400 mb-2 leading-snug">
          DILARANG MENGAMBIL FOTO, MENYEBARKAN, ATAU MEMBAGIKAN ISI BUKU RESEP INI KEPADA PIHAK LUAR!
        </p>

        <p className="text-[11px] sm:text-xs font-bold text-neutral-200 mb-3 uppercase tracking-wide">
          SELURUH DATA GRAMASI DAN STANDAR RESEP DI APLIKASI INI ADALAH ASET RAHASIA DAGANG ROTTHERDAMS.
        </p>

        <div className="bg-neutral-900/90 rounded-xl p-3 border border-neutral-800 space-y-2 text-[10px] sm:text-[11px] text-neutral-300">
          <p className="font-bold text-red-400 uppercase">SANKSI PIDANA & HUKUMAN:</p>

          <ul className="list-disc list-inside space-y-1.5 leading-relaxed">
            <li>
              <strong className="text-white">UU No. 30 Tahun 2000 (Rahasia Dagang) Pasal 13 & 17:</strong> Membocorkan resep/rahasia bisnis diancam pidana penjara paling lama <strong className="text-red-400">2 TAHUN</strong> dan/atau denda hingga <strong className="text-red-400">Rp300.000.000,-</strong>.
            </li>
            <li>
              <strong className="text-white">UU No. 1 Tahun 2024 (ITE) Pasal 32 & 48:</strong> Menyebarkan, memfoto, atau mendistribusikan data digital perusahaan tanpa hak diancam pidana penjara paling lama <strong className="text-red-400">8 TAHUN</strong> dan/atau denda hingga <strong className="text-red-400">Rp2.000.000.000,- (2 Miliar Rupiah)</strong>.
            </li>
            <li>
              <strong className="text-white">Sanksi Perusahaan:</strong> Pemutusan Hubungan Kerja (PHK) seketika tanpa pesangon serta tuntutan ganti rugi perdata atas kerugian bisnis.
            </li>
          </ul>
        </div>

        <p className="text-[10px] italic text-neutral-400 mt-2.5">
          * Aktivitas dan jejak akses akun Anda di dalam sistem ini dipantau oleh manajemen.
        </p>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-neutral-100">
        <div>
          <h2 className="text-lg font-black text-[#111111]">📖 Buku Resep & Standar Gramasi</h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            {isBar && !isManagementOrOwner && 'Daftar resep standar khusus divisi Bar (Beverage).'}
            {isDapur && !isManagementOrOwner && 'Daftar resep standar khusus divisi Kitchen (Food & Pastry).'}
            {isManagementOrOwner && 'Panduan porsi bahan dan standar penyajian Bar & Kitchen Rottherdams.'}
          </p>
        </div>

        {isManagementOrOwner && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-3.5 py-1.5 bg-[#111111] hover:bg-neutral-800 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-sm"
          >
            <span>➕</span> Tambah Resep
          </button>
        )}
      </div>

      {/* Filter Kategori Button */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {((isBar && !isManagementOrOwner)
          ? (['Beverage'] as const)
          : (isDapur && !isManagementOrOwner)
          ? (['All', 'Food', 'Pastry'] as const)
          : (['All', 'Beverage', 'Food', 'Pastry'] as const)
        ).map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              ((isBar && !isManagementOrOwner) || selectedCategory === cat)
                ? 'bg-[#d22027] text-white shadow-sm'
                : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-800'
            }`}
          >
            {cat === 'All' ? '✨ Semua Resep' : cat === 'Beverage' ? '☕ Minuman (Beverage)' : cat === 'Food' ? '🍳 Makanan (Food)' : '🥐 Pastry & Snack'}
          </button>
        ))}
      </div>

      {/* List Card Resep dengan Fitur Press & Hold */}
      {loading ? (
        <div className="py-8 text-center text-xs text-neutral-400 animate-pulse">
          Memuat resep dari database...
        </div>
      ) : filteredRecipes.length === 0 ? (
        <div className="py-8 text-center text-xs text-neutral-400">
          Belum ada resep untuk kategori ini.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRecipes.map(item => {
            const isUnlocked = unlockedRecipeId === item.id;

            return (
              <div 
                key={item.id} 
                onMouseDown={() => handlePressStart(item)}
                onMouseUp={handlePressEnd}
                onMouseLeave={handlePressEnd}
                onTouchStart={() => handlePressStart(item)}
                onTouchEnd={handlePressEnd}
                onTouchCancel={handlePressEnd}
                className={`p-4 rounded-2xl bg-neutral-50 border relative transition duration-200 cursor-pointer overflow-hidden select-none touch-callout-none ${
                  isUnlocked 
                    ? 'border-[#d22027] shadow-md ring-2 ring-red-500/10' 
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-sm text-[#111111]">{item.name}</h3>
                    <span className="text-[9px] font-bold px-2 py-0.5 bg-neutral-200 text-neutral-600 rounded-md uppercase">
                      {item.category || 'Beverage'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition ${
                      isUnlocked ? 'bg-red-100 text-[#d22027]' : 'bg-neutral-200 text-neutral-600'
                    }`}>
                      {isUnlocked ? '🔓 Hold View' : '🔒 Tahan Layar'}
                    </span>

                    {isManagementOrOwner && (
                      <button
                        onClick={(e) => handleDeleteRecipe(e, item.id, item.name)}
                        className="text-neutral-400 hover:text-red-500 transition text-xs p-1 cursor-pointer z-10"
                        title="Hapus Resep"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>

                {/* RINCIAN GRAMASI (EFEK BLUR PRESS-TO-REVEAL) */}
                <div className={`space-y-1 text-xs transition-all duration-300 relative ${
                  isUnlocked ? 'filter-none opacity-100' : 'blur-md opacity-30 select-none pointer-events-none'
                }`}>
                  <p><span className="font-semibold text-neutral-400">Gramasi / Komposisi:</span> <strong className="text-neutral-900">{item.grammage}</strong></p>
                  <p><span className="font-semibold text-neutral-400">Suhu / Metode:</span> <strong className="text-neutral-900">{item.temperature}</strong></p>
                  <p><span className="font-semibold text-neutral-400">Waktu / Ekstraksi:</span> <strong className="text-neutral-900">{item.extraction_time}</strong></p>
                </div>

                {/* PETUNJUK OVERLAY PRESS & HOLD */}
                {!isUnlocked && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/20 backdrop-blur-[1px]">
                    <span className="bg-[#111111] text-white text-[10px] font-extrabold px-3 py-1.5 rounded-full shadow-md animate-pulse">
                      👇 Tekan & Tahan Layar Untuk Membuka
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Pop-Up Tambah Resep */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-neutral-100 text-left">
            <h3 className="text-base font-black text-[#111111] mb-1">Tambah Resep Baru</h3>
            <p className="text-xs text-neutral-400 mb-4">Masukkan resep baru untuk divisi Bar atau Kitchen.</p>

            <form onSubmit={handleAddRecipe} className="space-y-3.5">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-neutral-600 mb-1">Nama Menu</label>
                  <input
                    type="text"
                    required
                    placeholder="Misal: French Fries BBQ"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:outline-none focus:border-[#d22027]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-600 mb-1">Kategori</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as any)}
                    className="w-full px-2 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:outline-none focus:border-[#d22027]"
                  >
                    <option value="Beverage">Minuman</option>
                    <option value="Food">Makanan</option>
                    <option value="Pastry">Pastry</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-600 mb-1">Gramasi & Komposisi Bahan</label>
                <textarea
                  required
                  rows={2}
                  placeholder={category === 'Food' ? "Misal: Kentang 150g + Saus BBQ 30g + Garam 2g" : "Misal: Espresso 18g + Milk 150ml"}
                  value={grammage}
                  onChange={e => setGrammage(e.target.value)}
                  className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:outline-none focus:border-[#d22027]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-600 mb-1">Suhu / Metode</label>
                  <input
                    type="text"
                    placeholder={category === 'Food' ? "Misal: Goreng 180°C" : "Misal: 65°C / Cold"}
                    value={temperature}
                    onChange={e => setTemperature(e.target.value)}
                    className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:outline-none focus:border-[#d22027]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-600 mb-1">Waktu Penyajian</label>
                  <input
                    type="text"
                    placeholder={category === 'Food' ? "Misal: 5–7 menit" : "Misal: 25-30s / Foam"}
                    value={extractionTime}
                    onChange={e => setExtractionTime(e.target.value)}
                    className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:outline-none focus:border-[#d22027]"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-[#d22027] hover:bg-[#bb2026] text-white rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Simpan...' : 'Simpan Resep'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}