import { useState, useEffect } from 'react';
import SopChecklist from './components/SopChecklist';
import JadwalStaf from './components/JadwalStaf';
import DaftarKaryawan from './components/DaftarKaryawan';
import LoginModal from './components/LoginModal';
import HandoverLog from './components/HandoverLog';
import ClockInModal from './components/ClockInModal';
import BukuResep from './components/BukuResep';
import EditProfileModal from './components/EditProfileModal';
import ManagementDashboard from './components/ManagementDashboard';
import RekapPresensi from './components/RekapPresensi';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import { supabase } from './lib/supabase';

export interface CurrentUser {
  name: string;
  role: string;
  staff_id: string;
  status?: string; // Menambahkan properti status untuk deteksi staf Resign
}

interface OnDutyStaff {
  id: number;
  staff_name: string;
  staff_id: string;
  role: string;
  shift: string;
  clock_in: string;
}

export default function App() {
  const currentHour = new Date().getHours();
  const defaultShift = currentHour < 15 ? 'morning' : 'night';

  const [activeTab, setActiveTab] = useState<'morning' | 'night'>(defaultShift);
  const [activeNav, setActiveNav] = useState<'home' | 'sop' | 'resep' | 'jadwal' | 'karyawan' | 'handover' | 'dashboard' | 'presensi'>('home');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  
  // State Modal Edit Profil
  const [isEditProfileOpen, setIsEditProfileOpen] = useState<boolean>(false);

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState<boolean>(false);

  const [isClockInOpen, setIsClockInOpen] = useState<boolean>(false);
  const [onDutyList, setOnDutyList] = useState<OnDutyStaff[]>([]);
  const [isClockingOut, setIsClockingOut] = useState<boolean>(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('rottherdams_user');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
        console.error('Error parsing user session:', e);
      }
    }
    fetchOnDutyStaff();
  }, []);

  const fetchOnDutyStaff = async () => {
    const { data } = await supabase
      .from('attendances')
      .select('id, staff_id, staff_name, role, shift, clock_in')
      .eq('status', 'On Duty')
      .order('clock_in', { ascending: false });

    if (data) {
      setOnDutyList(data);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('rottherdams_user');
    setCurrentUser(null);
    setActiveNav('home');
    setIsUserMenuOpen(false);
  };

  const isManagementOrOwner = currentUser && (
    currentUser.role?.toLowerCase().includes('management') || 
    currentUser.role?.toLowerCase().includes('owner')
  );

  const activeUserAttendance = currentUser 
    ? onDutyList.find(item => item.staff_id === currentUser.staff_id)
    : null;

  const handleDirectClockOut = async () => {
    if (!activeUserAttendance) return;

    if (!confirm('Apakah kamu yakin ingin menyelesaikan shift (Clock Out) sekarang?')) {
      return;
    }

    setIsClockingOut(true);

    const { error } = await supabase
      .from('attendances')
      .update({
        clock_out: new Date().toISOString(),
        status: 'Completed',
      })
      .eq('id', activeUserAttendance.id);

    setIsClockingOut(false);

    if (!error) {
      fetchOnDutyStaff();
    } else {
      alert('Gagal melakukan Clock Out: ' + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#ffffff] text-[#111111] font-sans antialiased pb-24 md:pb-12 selection:bg-[#d22027] selection:text-white">
      {/* Modal Login PIN */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          localStorage.setItem('rottherdams_user', JSON.stringify(user));
          setIsLoginOpen(false);
        }}
      />

      {/* Modal Clock In Presensi */}
      <ClockInModal
        isOpen={isClockInOpen}
        onClose={() => setIsClockInOpen(false)}
        currentUser={currentUser}
        activeShift={activeTab}
        onSuccess={fetchOnDutyStaff}
      />

      {/* Modal Edit Profil & PIN Staf */}
      {currentUser && (
        <EditProfileModal
          isOpen={isEditProfileOpen}
          onClose={() => setIsEditProfileOpen(false)}
          currentUser={currentUser}
          onUpdateSuccess={(updatedUser) => {
            setCurrentUser(updatedUser);
            localStorage.setItem('rottherdams_user', JSON.stringify(updatedUser));
          }}
        />
      )}

      {/* Top Navbar Header */}
      <header className="bg-[#d22027] text-white w-full sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 md:h-20 gap-4">
            
            <div className="flex items-center gap-3 shrink-0">
              <img 
                src="/logo.svg" 
                alt="Rottherdams Logo" 
                className="h-7 md:h-8 w-auto object-contain"
              />
              <span className="text-[9px] bg-black/25 text-white border border-white/20 px-2 py-0.5 rounded-full font-bold tracking-wider uppercase">
                OPS
              </span>
            </div>

            {/* Desktop Navbar Clean without scrollbar */}
            <nav className="hidden lg:flex items-center gap-1 bg-black/15 p-1 rounded-xl border border-white/10 [ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                onClick={() => setActiveNav('home')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  activeNav === 'home'
                    ? 'bg-white text-[#d22027] shadow-sm'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                Home
              </button>

              {currentUser && (
                <>
                  <button
                    onClick={() => setActiveNav('presensi')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                      activeNav === 'presensi'
                        ? 'bg-white text-[#d22027] shadow-sm'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    Presensi
                  </button>

                  <button
                    onClick={() => setActiveNav('sop')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                      activeNav === 'sop'
                        ? 'bg-white text-[#d22027] shadow-sm'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    SOP Checklist
                  </button>

                  <button
                    onClick={() => setActiveNav('resep')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                      activeNav === 'resep'
                        ? 'bg-white text-[#d22027] shadow-sm'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    Buku Resep
                  </button>

                  <button
                    onClick={() => setActiveNav('handover')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                      activeNav === 'handover'
                        ? 'bg-white text-[#d22027] shadow-sm'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    Handover Log
                  </button>
                </>
              )}

              <button
                onClick={() => setActiveNav('jadwal')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  activeNav === 'jadwal'
                    ? 'bg-white text-[#d22027] shadow-sm'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                Jadwal Staf
              </button>

              {isManagementOrOwner && (
                <>
                  <button
                    onClick={() => setActiveNav('dashboard')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                      activeNav === 'dashboard'
                        ? 'bg-white text-[#d22027] shadow-sm'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    Analytics
                  </button>

                  <button
                    onClick={() => setActiveNav('karyawan')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                      activeNav === 'karyawan'
                        ? 'bg-white text-[#d22027] shadow-sm'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    Daftar Staf
                  </button>
                </>
              )}
            </nav>

            <div className="relative shrink-0">
              {currentUser ? (
                <button 
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2.5 cursor-pointer hover:opacity-90 transition p-1 rounded-full md:rounded-xl hover:bg-black/10"
                >
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-bold leading-none">{currentUser.name}</p>
                    <p className="text-[10px] text-white/80 mt-0.5 uppercase tracking-wider">{currentUser.role}</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white/20 border border-white/40 flex items-center justify-center text-xs font-black shadow-inner">
                    {currentUser.name.substring(0, 2).toUpperCase()}
                  </div>
                </button>
              ) : (
                <button
                  onClick={() => setIsLoginOpen(true)}
                  className="px-4 py-2 bg-white text-[#d22027] rounded-xl text-xs font-black shadow-md cursor-pointer hover:bg-neutral-100 transition flex items-center gap-1.5 active:scale-95"
                >
                  🔑 Login Staf
                </button>
              )}

              {/* Dropdown Menu User */}
              {isUserMenuOpen && currentUser && (
                <div className="absolute right-0 mt-2 w-56 bg-white text-[#111111] rounded-2xl shadow-2xl border border-neutral-100 py-2 z-50">
                  <div className="px-4 py-2 border-b border-neutral-100">
                    <p className="text-xs font-bold">{currentUser.name}</p>
                    <p className="text-[10px] text-neutral-400 font-mono uppercase mt-0.5">
                      {currentUser.staff_id} • {currentUser.role}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setIsEditProfileOpen(true);
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-neutral-700 hover:bg-neutral-50 flex items-center gap-2 transition cursor-pointer font-bold mt-1"
                  >
                    ⚙️ Edit Profil & PIN
                  </button>

                  <button 
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-xs text-[#d22027] hover:bg-red-50 flex items-center gap-2 transition cursor-pointer font-bold border-t border-neutral-100 mt-1"
                  >
                    🚪 Keluar (Logout)
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-md md:max-w-4xl mx-auto px-5 py-6 md:py-10">
        <section className="mb-6 md:mb-8 border-b border-neutral-100 pb-5 md:pb-6 text-left">
          <p className="text-[11px] md:text-xs font-bold uppercase tracking-widest text-[#d22027] mb-1">
            System Management
          </p>
          <h1 className="text-2xl md:text-3xl font-black text-[#111111] tracking-tight leading-tight">
            Daily Operational Hub.
          </h1>
          <p className="text-xs md:text-sm text-neutral-500 mt-1.5 leading-relaxed">
            Presensi, checklist SOP harian, dan serah terima shift dalam satu genggaman.
          </p>
        </section>

        {activeNav === 'dashboard' && isManagementOrOwner ? (
          <ManagementDashboard currentUser={currentUser!} />
        ) : activeNav === 'presensi' && currentUser ? (
          <RekapPresensi currentUser={currentUser} />
        ) : activeNav === 'handover' && currentUser ? (
          <HandoverLog 
            currentUser={currentUser} 
            onRequireLogin={() => setIsLoginOpen(true)} 
          />
        ) : activeNav === 'karyawan' && isManagementOrOwner ? (
          <DaftarKaryawan />
        ) : activeNav === 'jadwal' ? (
          <JadwalStaf userRole={currentUser?.role || 'bar'} currentUser={currentUser} />
        ) : activeNav === 'resep' && currentUser ? (
          <BukuResep currentUser={currentUser} />
        ) : activeNav === 'sop' && currentUser ? (
          <SopChecklist isFullView={true} currentUser={currentUser} />
        ) : (
          <div>
            {isManagementOrOwner && (
              <div className="bg-neutral-100 p-1.5 rounded-2xl border border-neutral-200 flex mb-6 shadow-inner max-w-md mx-auto md:mx-0">
                <button
                  onClick={() => setActiveTab('morning')}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                    activeTab === 'morning'
                      ? 'bg-[#111111] text-white shadow-md'
                      : 'text-neutral-500 hover:text-[#111111]'
                  }`}
                >
                  ☀️ Morning Shift
                </button>
                <button
                  onClick={() => setActiveTab('night')}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                    activeTab === 'night'
                      ? 'bg-[#111111] text-white shadow-md'
                      : 'text-neutral-500 hover:text-[#111111]'
                  }`}
                >
                  🌙 Night Shift
                </button>
              </div>
            )}

            <div className="bg-[#111111] text-white rounded-3xl p-6 md:p-8 mb-8 relative overflow-hidden shadow-xl border border-neutral-800 text-left">
              <div className="absolute -right-8 -bottom-8 w-44 h-44 bg-[#d22027] rounded-full blur-3xl opacity-40"></div>

              <div className="relative z-10">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[10px] md:text-xs font-black text-[#d22027] bg-white px-3.5 py-1 rounded-full border border-white/40 shadow-[0_0_12px_rgba(255,255,255,0.35)] flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#d22027] animate-pulse shadow-[0_0_6px_#d22027]"></span>
                    🕒 09.00 - 23.00 WITA
                  </span>

                  {currentUser && (
                    onDutyList.length > 0 ? (
                      <span className="flex items-center gap-1.5 text-[10px] md:text-xs text-emerald-400 font-bold">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                        Bar Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-[10px] md:text-xs text-neutral-400 font-medium">
                        <span className="w-2 h-2 rounded-full bg-neutral-500"></span>
                        Shift Closed
                      </span>
                    )
                  )}
                </div>

                <h2 className="text-lg md:text-xl font-black mb-1 tracking-tight">
                  We're Open Everyday
                </h2>
                <p className="text-xs md:text-sm text-neutral-400 mb-6 leading-relaxed">
                  Your daily dose of caffeine & good vibes at Rottherdams Coffee Social House.
                </p>

                {currentUser ? (
                  activeUserAttendance ? (
                    <button 
                      onClick={handleDirectClockOut}
                      disabled={isClockingOut}
                      className="w-full md:w-auto md:px-8 py-3.5 bg-white hover:bg-neutral-100 text-[#d22027] font-extrabold text-xs md:text-sm rounded-xl shadow-lg transition cursor-pointer active:scale-95"
                    >
                      {isClockingOut ? 'Memproses...' : '🚪 Selesai Shift / Clock Out'}
                    </button>
                  ) : (
                    <button 
                      onClick={() => setIsClockInOpen(true)}
                      className="w-full md:w-auto md:px-8 py-3.5 bg-[#d22027] hover:bg-[#bb2026] text-white font-bold text-xs md:text-sm rounded-xl shadow-lg transition cursor-pointer active:scale-95"
                    >
                      ✅ Clock In Presensi Now
                    </button>
                  )
                ) : (
                  <button 
                    onClick={() => setIsLoginOpen(true)}
                    className="w-full md:w-auto md:px-8 py-3.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs md:text-sm rounded-xl border border-white/20 backdrop-blur-md transition cursor-pointer active:scale-95"
                  >
                    🔑 Login Staf untuk Presensi
                  </button>
                )}
              </div>
            </div>

            {onDutyList.length > 0 && (
              <div className="bg-neutral-50 rounded-3xl p-5 border border-neutral-200 mb-8 text-left">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-black text-[#111111] uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Tim On-Duty Saat Ini ({onDutyList.length})
                  </h3>
                  <button 
                    onClick={fetchOnDutyStaff}
                    className="text-[10px] font-bold text-neutral-400 hover:text-neutral-700 transition cursor-pointer"
                  >
                    🔄 Refresh
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                  {onDutyList.map(staf => (
                    <div key={staf.id} className="bg-white p-3 rounded-2xl border border-neutral-200 shadow-2xs">
                      <p className="text-xs font-black text-[#111111]">{staf.staff_name}</p>
                      <p className="text-[10px] text-neutral-400 capitalize">
                        {staf.role} • {staf.shift}
                      </p>
                      <p className="text-[9px] font-mono text-emerald-600 font-bold mt-1">
                        In: {new Date(staf.clock_in).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WITA
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {currentUser && <SopChecklist activeShift={activeTab} currentUser={currentUser} />}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 md:gap-5 mt-8 text-left">
              {currentUser && (
                <>
                  <div 
                    onClick={() => setActiveNav('presensi')}
                    className="p-5 rounded-2xl bg-white border border-neutral-200 hover:border-[#d22027] hover:shadow-md active:scale-98 transition cursor-pointer group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-lg mb-3 group-hover:bg-[#d22027] group-hover:text-white transition">
                      📍
                    </div>
                    <h3 className="font-bold text-xs md:text-sm text-[#111111] mb-0.5">Riwayat Presensi</h3>
                    <p className="text-[10px] md:text-xs text-neutral-400">Jam masuk & keluar</p>
                  </div>

                  <div 
                    onClick={() => setActiveNav('sop')}
                    className="p-5 rounded-2xl bg-white border border-neutral-200 hover:border-[#d22027] hover:shadow-md active:scale-98 transition cursor-pointer group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-lg mb-3 group-hover:bg-[#d22027] group-hover:text-white transition">
                      📋
                    </div>
                    <h3 className="font-bold text-xs md:text-sm text-[#111111] mb-0.5">SOP Checklist</h3>
                    <p className="text-[10px] md:text-xs text-neutral-400">Tugas harian shift</p>
                  </div>

                  <div 
                    onClick={() => setActiveNav('resep')}
                    className="p-5 rounded-2xl bg-white border border-neutral-200 hover:border-[#d22027] hover:shadow-md active:scale-98 transition cursor-pointer group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-lg mb-3 group-hover:bg-[#d22027] group-hover:text-white transition">
                      ☕
                    </div>
                    <h3 className="font-bold text-xs md:text-sm text-[#111111] mb-0.5">Buku Resep</h3>
                    <p className="text-[10px] md:text-xs text-neutral-400">Gramasi & resep kopi</p>
                  </div>

                  <div 
                    onClick={() => setActiveNav('handover')}
                    className="p-5 rounded-2xl bg-white border border-neutral-200 hover:border-[#d22027] hover:shadow-md active:scale-98 transition cursor-pointer group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-lg mb-3 group-hover:bg-[#d22027] group-hover:text-white transition">
                      📝
                    </div>
                    <h3 className="font-bold text-xs md:text-sm text-[#111111] mb-0.5">Handover Log</h3>
                    <p className="text-[10px] md:text-xs text-neutral-400">Catatan antar shift</p>
                  </div>
                </>
              )}

              <div 
                onClick={() => setActiveNav('jadwal')}
                className={`p-5 rounded-2xl bg-white border border-neutral-200 hover:border-[#d22027] hover:shadow-md active:scale-98 transition cursor-pointer group ${
                  !currentUser ? 'col-span-2 md:col-span-4' : ''
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-lg mb-3 group-hover:bg-[#d22027] group-hover:text-white transition">
                  📅
                </div>
                <h3 className="font-bold text-xs md:text-sm text-[#111111] mb-0.5">Jadwal Staf</h3>
                <p className="text-[10px] md:text-xs text-neutral-400">Roster 2 shift</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-neutral-200 px-4 py-2 z-50 shadow-2xl">
        <div className="max-w-md mx-auto flex justify-around items-center">
          <button
            onClick={() => setActiveNav('home')}
            className={`flex flex-col items-center gap-1 cursor-pointer transition ${
              activeNav === 'home' ? 'text-[#d22027]' : 'text-neutral-400 hover:text-neutral-700'
            }`}
          >
            <span className="text-lg leading-none">🏠</span>
            <span className="text-[10px] font-bold">Home</span>
          </button>

          {currentUser && (
            <>
              <button
                onClick={() => setActiveNav('presensi')}
                className={`flex flex-col items-center gap-1 cursor-pointer transition ${
                  activeNav === 'presensi' ? 'text-[#d22027]' : 'text-neutral-400 hover:text-neutral-700'
                }`}
              >
                <span className="text-lg leading-none">📍</span>
                <span className="text-[10px] font-bold">Presensi</span>
              </button>

              <button
                onClick={() => setActiveNav('sop')}
                className={`flex flex-col items-center gap-1 cursor-pointer transition ${
                  activeNav === 'sop' ? 'text-[#d22027]' : 'text-neutral-400 hover:text-neutral-700'
                }`}
              >
                <span className="text-lg leading-none">📋</span>
                <span className="text-[10px] font-bold">SOP</span>
              </button>

              <button
                onClick={() => setActiveNav('resep')}
                className={`flex flex-col items-center gap-1 cursor-pointer transition ${
                  activeNav === 'resep' ? 'text-[#d22027]' : 'text-neutral-400 hover:text-neutral-700'
                }`}
              >
                <span className="text-lg leading-none">☕</span>
                <span className="text-[10px] font-bold">Resep</span>
              </button>
            </>
          )}

          <button
            onClick={() => setActiveNav('jadwal')}
            className={`flex flex-col items-center gap-1 cursor-pointer transition ${
              activeNav === 'jadwal' ? 'text-[#d22027]' : 'text-neutral-400 hover:text-neutral-700'
            }`}
          >
            <span className="text-lg leading-none">📅</span>
            <span className="text-[10px] font-bold">Jadwal</span>
          </button>

          {isManagementOrOwner && (
            <>
              <button
                onClick={() => setActiveNav('dashboard')}
                className={`flex flex-col items-center gap-1 cursor-pointer transition ${
                  activeNav === 'dashboard' ? 'text-[#d22027]' : 'text-neutral-400 hover:text-neutral-700'
                }`}
              >
                <span className="text-lg leading-none">📊</span>
                <span className="text-[10px] font-bold">Analytics</span>
              </button>

              <button
                onClick={() => setActiveNav('karyawan')}
                className={`flex flex-col items-center gap-1 cursor-pointer transition ${
                  activeNav === 'karyawan' ? 'text-[#d22027]' : 'text-neutral-400 hover:text-neutral-700'
                }`}
              >
                <span className="text-lg leading-none">👤</span>
                <span className="text-[10px] font-bold">Staf</span>
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Pop-up Prompt Install PWA */}
      <PWAInstallPrompt />
    </div>
  );
}