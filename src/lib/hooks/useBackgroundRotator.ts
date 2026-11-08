import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export interface ToastState {
  show: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
}

export function useBackgroundRotator(isOpen?: boolean, onUpdateSuccess?: (urls: string[]) => void) {
  const [backgroundUrls, setBackgroundUrls] = useState<string[]>([]);
  const [blurLevel, setBlurLevel] = useState<number>(4); // default 4px
  const [overlayOpacity, setOverlayOpacity] = useState<number>(80); // default 80%
  const [isRandom, setIsRandom] = useState<boolean>(false); // default false
  
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState>({ show: false, message: '', type: 'info' });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 3000);
  };

  useEffect(() => {
    // Membaca data jika modal terbuka (isOpen === true) atau jika digunakan langsung di layar utama (isOpen === undefined)
    if (isOpen === undefined || isOpen) {
      fetchBackgrounds();
      fetchSettings();
    }
  }, [isOpen]);

  const fetchBackgrounds = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('system_settings').select('*');
      if (data && data.length > 0) {
        const row = data.find((d: any) => String(d.key).trim().includes('presence_bg_url'));
        if (row && row.value) {
          let rawVal: any = row.value;
          if (typeof rawVal === 'string') {
            try { rawVal = JSON.parse(rawVal); } catch {
              rawVal = rawVal.trim().replace(/^"(.*)"$/, '$1');
              try { rawVal = JSON.parse(rawVal); } catch {}
            }
          }
          if (Array.isArray(rawVal)) {
            const cleanUrls = rawVal
              .map((item) => String(item).trim())
              .filter((item) => item.startsWith('http://') || item.startsWith('https://'));
            setBackgroundUrls(cleanUrls);
          } else if (typeof rawVal === 'string' && rawVal.startsWith('http')) {
            setBackgroundUrls([rawVal]);
          }
        }
      }
    } catch (err) {
      console.error('Error membaca database presensi:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['presence_bg_blur', 'presence_bg_overlay', 'presence_bg_random']);

      if (data) {
        data.forEach((row: any) => {
          if (row.key === 'presence_bg_blur') setBlurLevel(Number(row.value) || 4);
          if (row.key === 'presence_bg_overlay') setOverlayOpacity(Number(row.value) || 80);
          if (row.key === 'presence_bg_random') setIsRandom(row.value === 'true' || row.value === true);
        });
      }
    } catch (err) {
      console.error('Error reading settings:', err);
    }
  };

  const saveSettingsToDb = async (newBlur: number, newOverlay: number, newIsRandom?: boolean) => {
    setSubmitting(true);
    const targetRandom = newIsRandom !== undefined ? newIsRandom : isRandom;

    const { error } = await supabase.from('system_settings').upsert([
      { key: 'presence_bg_blur', value: String(newBlur), updated_at: new Date().toISOString() },
      { key: 'presence_bg_overlay', value: String(newOverlay), updated_at: new Date().toISOString() },
      { key: 'presence_bg_random', value: String(targetRandom), updated_at: new Date().toISOString() }
    ]);

    setSubmitting(false);

    if (error) {
      showToast('Gagal menyimpan pengaturan: ' + error.message, 'error');
    } else {
      showToast('Pengaturan efek & rotasi visual berhasil disimpan!', 'success');
    }
  };

  const saveToSupabase = async (urls: string[]) => {
    setSubmitting(true);
    const jsonValue = JSON.stringify(urls);

    const { error } = await supabase.from('system_settings').upsert({
      key: 'presence_bg_url',
      value: jsonValue,
      updated_at: new Date().toISOString(),
    });

    setSubmitting(false);

    if (error) {
      showToast('Gagal memperbarui background presensi: ' + error.message, 'error');
    } else {
      setBackgroundUrls(urls);
      if (onUpdateSuccess) onUpdateSuccess(urls);
    }
  };

  const handleAddUrl = async (urlToAdd: string, callbackReset: () => void) => {
    const cleanUrl = urlToAdd.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      showToast('Format URL tidak valid!', 'error');
      return;
    }
    if (backgroundUrls.includes(cleanUrl)) {
      showToast('Link URL ini sudah ada di galeri!', 'info');
      return;
    }
    const updated = [cleanUrl, ...backgroundUrls];
    await saveToSupabase(updated);
    callbackReset();
    showToast('Link media (Foto/Video) berhasil ditambahkan!', 'success');
  };

  const executeDeleteUrl = async (urlToDelete: string) => {
    const updated = backgroundUrls.filter((u) => u !== urlToDelete);
    await saveToSupabase(updated);
    showToast('Media berhasil dihapus dari rotator.', 'success');
  };

  return {
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
  };
}