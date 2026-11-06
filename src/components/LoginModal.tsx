import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { recordLoginLog } from '../lib/security';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: { name: string; role: 'management' | 'kasir' | 'bar' | 'dapur'; staff_id: string }) => void;
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

  // Listener untuk mengetik PIN langsung lewat Keyboard PC / Laptop
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(e.key)) {
        if (pin.length < 4) {
          setPin(prev => prev + e.key);
          setErrorMsg('');
        }
      } else if (e.key === 'Backspace') {
        setPin(prev => prev.slice(0, -1));
        setErrorMsg('');
      } else if (e.key === 'Enter') {
        if (pin.length === 4 && username.trim()) {
          handleLogin();
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
    if (!username.trim()) {
      setErrorMsg('Masukkan username terlebih dahulu!');
      return;
    }
    if (pin.length !== 4) {
      setErrorMsg('PIN harus 4 digit!');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    // Query ke Supabase mencocokkan Nama/Username (Case-Insensitive)
    const { data, error } = await supabase
      .from('staff')
      .select('staff_id, staff_name, role, pin, status')
      .ilike('staff_name', username.trim())
      .single();

    if (error || !data) {
      setIsLoading(false);
      setErrorMsg('Username tidak ditemukan!');
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
      const isManagementRole = 
        data.role.toLowerCase().includes('management') || 
        data.role.toLowerCase().includes('manager') || 
        data.role.toLowerCase().includes('owner') ||
        data.staff_id.startsWith('OWN-') ||
        data.staff_id.startsWith('MNG-');

      const mappedRole = isManagementRole 
        ? 'management' 
        : (data.role.toLowerCase() as any) || 'bar';

      const userSession = {
        name: data.staff_name,
        role: mappedRole,
        staff_id: data.staff_id,
      };

      // 🔐 REKAM LOG LOGIN KE SUPABASE (IP, GPS, DEVICE INFO)
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md md:max-w-xl shadow-2xl border border-neutral-100 animate-in fade-in zoom-in-95 duration-200 relative">
        <button
          onClick={onClose}
          type="button"
          className="absolute right-4 top-4 w-8 h-8 rounded-full bg-neutral-100 text-neutral-400 font-bold hover:bg-neutral-200 transition cursor-pointer flex items-center justify-center text-xs z-10"
        >
          ✕
        </button>

        {/* Header Modal */}
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-neutral-100 text-left">
          <div className="w-12 h-12 bg-[#d22027]/10 text-[#d22027] rounded-2xl flex items-center justify-center font-bold text-xl shrink-0">
            🔐
          </div>
          <div>
            <h2 className="text-xl font-black text-[#111111]">Masuk Sistem Staf</h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Masukkan Username dan 4 Digit PIN Anda
            </p>
          </div>
        </div>

        {/* Container Utama: Grid 2 Kolom untuk Desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          
          {/* Kolom Kiri: Input Username & Indikator PIN */}
          <div className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                Username / Nama Staf:
              </label>
              <input
                type="text"
                placeholder="Misal: Iqbal, Gilang, Renal"
                value={username}
                onChange={e => {
                  setUsername(e.target.value);
                  setErrorMsg('');
                }}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 font-bold text-xs md:text-sm text-neutral-800 focus:outline-none focus:border-[#d22027] focus:bg-white transition"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-2">
                Digit PIN:
              </label>
              {/* Indikator PIN */}
              <div className="flex items-center justify-start gap-3 bg-neutral-50 p-3 rounded-2xl border border-neutral-200">
                {[0, 1, 2, 3].map(i => (
                  <div
                    key={i}
                    className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                      pin.length > i
                        ? 'bg-[#d22027] border-[#d22027] scale-110'
                        : 'bg-white border-neutral-300'
                    }`}
                  />
                ))}
              </div>
            </div>

            {errorMsg && (
              <p className="text-xs font-bold text-red-500 animate-bounce">
                {errorMsg}
              </p>
            )}

            <p className="hidden md:block text-[11px] text-neutral-400 italic">
              💡 Buka di PC? Kamu bisa langsung mengetik angka & tekan <span className="font-bold text-neutral-700">Enter</span> di Keyboard!
            </p>
          </div>

          {/* Kolom Kanan: Keypad Numpad */}
          <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleKeyPress(num)}
                  className="h-11 rounded-xl bg-white text-[#111111] border border-neutral-200 font-extrabold text-base hover:bg-neutral-100 active:scale-95 transition cursor-pointer shadow-2xs"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={handleDelete}
                className="h-11 rounded-xl bg-red-50 text-red-600 font-bold text-xs border border-red-100 hover:bg-red-100 active:scale-95 transition cursor-pointer flex items-center justify-center shadow-2xs"
              >
                ⌫
              </button>
              <button
                type="button"
                onClick={() => handleKeyPress('0')}
                className="h-11 rounded-xl bg-white text-[#111111] border border-neutral-200 font-extrabold text-base hover:bg-neutral-100 active:scale-95 transition cursor-pointer shadow-2xs"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => handleLogin()}
                disabled={isLoading || pin.length !== 4 || !username.trim()}
                className="h-11 rounded-xl bg-[#d22027] text-white font-bold text-xs hover:bg-[#b81b21] disabled:opacity-40 active:scale-95 transition cursor-pointer flex items-center justify-center shadow-md"
              >
                {isLoading ? '...' : 'OK'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}