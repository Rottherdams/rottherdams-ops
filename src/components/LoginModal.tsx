import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { recordLoginLog } from '../lib/security';

interface UserSession {
  name: string;
  role: string;
  staff_id: string;
  avatar_url?: string;
}

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: UserSession) => void;
}

export default function LoginModal({ isOpen, onClose, onLoginSuccess }: LoginModalProps) {
  const [username, setUsername] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setUsername('');
      setPin('');
      setErrorMsg('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (pin.length === 4 && username.trim()) {
          handleLogin();
        }
        return;
      }

      const activeEl = document.activeElement;
      const isInputFocused = activeEl && activeEl.tagName === 'INPUT';

      if (!isInputFocused) {
        if (['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(e.key)) {
          if (pin.length < 4) {
            setPin(prev => prev + e.key);
            setErrorMsg('');
          }
        } else if (e.key === 'Backspace') {
          setPin(prev => prev.slice(0, -1));
          setErrorMsg('');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, pin, username]);

  if (!isOpen) return null;

  const handleKeyPress = (num: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + num);
      setErrorMsg('');
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setErrorMsg('');
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const queryTerm = username.trim();

    if (!queryTerm) {
      setErrorMsg('Masukkan username atau ID Staf terlebih dahulu!');
      return;
    }
    if (pin.length !== 4) {
      setErrorMsg('PIN harus 4 digit!');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    const { data, error } = await supabase
      .from('staff')
      .select('staff_id, staff_name, first_name, last_name, avatar_url, role, pin, status')
      .or(`staff_name.ilike.${queryTerm},first_name.ilike.${queryTerm},last_name.ilike.${queryTerm},staff_id.ilike.${queryTerm}`)
      .maybeSingle();

    if (error || !data) {
      setIsLoading(false);
      setErrorMsg('Username atau ID Staf tidak ditemukan!');
      setPin('');
      return;
    }

    if (data.status === 'Resign') {
      setIsLoading(false);
      setErrorMsg('Akun staf ini sudah tidak aktif.');
      setPin('');
      return;
    }

    const correctPin = data.pin || '1234';

    if (pin === correctPin) {
      const displayName = data.staff_name || 
        (data.first_name ? `${data.first_name} ${data.last_name || ''}`.trim() : data.staff_id);

      const userSession: UserSession = {
        name: displayName,
        role: data.role ? data.role.toLowerCase() : 'bar',
        staff_id: data.staff_id,
        avatar_url: data.avatar_url || undefined,
      };

      try {
        await recordLoginLog(userSession);
      } catch (logErr) {
        console.warn('Gagal mencatat log login:', logErr);
      }

      setIsLoading(false);
      localStorage.setItem('rottherdams_user', JSON.stringify(userSession));
      onLoginSuccess(userSession);
    } else {
      setIsLoading(false);
      setErrorMsg('PIN Salah! Silakan coba lagi.');
      setPin('');
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 overscroll-none">
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none !important;
        }
        .no-scrollbar {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }
      `}</style>

      <div className="bg-white rounded-t-3xl sm:rounded-3xl p-5 sm:p-7 w-full max-w-md md:max-w-xl shadow-2xl border border-neutral-100 animate-in fade-in slide-in-from-bottom-6 sm:zoom-in-95 duration-300 relative max-h-[85vh] overflow-y-auto no-scrollbar">
        <button
          onClick={onClose}
          type="button"
          className="absolute right-4 top-4 w-8 h-8 rounded-full bg-neutral-100 text-neutral-400 font-bold hover:bg-neutral-200 active:scale-90 transition cursor-pointer flex items-center justify-center text-xs z-10"
        >
          ✕
        </button>

        {/* Header Modal */}
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-neutral-100 text-left pr-8">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-[#d22027]/10 text-[#d22027] rounded-xl flex items-center justify-center font-bold text-lg md:text-xl shrink-0">
            🔐
          </div>
          <div>
            <h2 className="text-base md:text-xl font-black text-[#111111] leading-tight">Masuk Sistem Staf</h2>
            <p className="text-[11px] md:text-xs text-neutral-400 mt-0.5">
              Masukkan Username / ID Staf & 4 Digit PIN
            </p>
          </div>
        </div>

        {/* Form & PIN Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 items-center">
          
          <div className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                Username / ID Staf:
              </label>
              <input
                type="text"
                placeholder="Misal: Yusuf, Rico, STF-001"
                value={username}
                onChange={e => {
                  setUsername(e.target.value);
                  setErrorMsg('');
                }}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 font-bold text-xs md:text-sm text-neutral-800 focus:outline-none focus:border-[#d22027] focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-2">
                Digit PIN:
              </label>
              {/* 🌟 DIGIT PIN GAYA M-BANKING (LEBIH BESAR & TEGAS) */}
              <div className="flex items-center justify-center gap-3 bg-neutral-50 p-3.5 rounded-2xl border border-neutral-200">
                {[0, 1, 2, 3].map(i => (
                  <div
                    key={i}
                    className={`w-6 h-6 rounded-full border-3 transition-all duration-200 flex items-center justify-center ${
                      pin.length > i
                        ? 'bg-[#d22027] border-[#d22027] scale-110 shadow-md shadow-red-500/20'
                        : 'bg-white border-neutral-300'
                    }`}
                  >
                    {pin.length > i && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                ))}
              </div>
            </div>

            {errorMsg && (
              <p className="text-xs font-bold text-red-500 animate-bounce leading-tight">
                {errorMsg}
              </p>
            )}

            <p className="hidden md:block text-[11px] text-neutral-400 italic">
              💡 Buka di PC? Kamu bisa langsung mengetik angka & tekan <span className="font-bold text-neutral-700">Enter</span>.
            </p>
          </div>

          {/* Keypad Numpad */}
          <div className="bg-neutral-50 p-3 rounded-2xl border border-neutral-100">
            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleKeyPress(num)}
                  className="h-11 md:h-12 rounded-xl bg-white text-[#111111] border border-neutral-200 font-black text-base hover:bg-neutral-100 active:scale-95 transition cursor-pointer shadow-2xs"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={handleDelete}
                className="h-11 md:h-12 rounded-xl bg-red-50 text-red-600 font-bold text-xs border border-red-100 hover:bg-red-100 active:scale-95 transition cursor-pointer flex items-center justify-center shadow-2xs"
              >
                ⌫
              </button>
              <button
                type="button"
                onClick={() => handleKeyPress('0')}
                className="h-11 md:h-12 rounded-xl bg-white text-[#111111] border border-neutral-200 font-black text-base hover:bg-neutral-100 active:scale-95 transition cursor-pointer shadow-2xs"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => handleLogin()}
                disabled={isLoading || pin.length !== 4 || !username.trim()}
                className="h-11 md:h-12 rounded-xl bg-[#d22027] text-white font-extrabold text-xs hover:bg-[#b81b21] disabled:opacity-40 active:scale-95 transition cursor-pointer flex items-center justify-center shadow-md"
              >
                {isLoading ? '...' : 'OK'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>,
    document.body
  );
}