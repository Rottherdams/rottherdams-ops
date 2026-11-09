import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import HeaderNavbar from './components/HeaderNavbar';
import FooterMinimalist from './components/FooterMinimalist';
import SopChecklist from './components/SopChecklist';
import JadwalStaf from './components/JadwalStaf';
import DaftarKaryawan from './components/DaftarKaryawan';
import LoginModal from './components/LoginModal';
import HandoverLog from './components/HandoverLog';
import ClockInModal from './components/ClockInModal';
import ClockOutModal from './components/ClockOutModal';
import BukuResep from './components/BukuResep';
import EditProfileModal from './components/EditProfileModal';
import ManagementDashboard from './components/ManagementDashboard';
import RekapPresensi from './components/RekapPresensi';
import AnnouncementBanner from './components/AnnouncementBanner';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import BackgroundManager from './components/presensi/BackgroundManager';
import BackgroundRotator from './components/presensi/BackgroundRotator';
import { supabase } from './lib/supabase';
import { recordLoginLog } from './lib/security';
import { 
  useIdleLogout, 
  checkIsIdleExpired, 
  updateLastActivityTimestamp, 
  clearLastActivityTimestamp 
} from './lib/hooks/useIdleLogout';

export interface CurrentUser {
  name: string;
  role: string;
  staff_id: string;
  avatar_url?: string;
  status?: string;
}

interface OnDutyStaff {
  id: number;
  staff_name: string;
  staff_id: string;
  role: string;
  shift: string;
  clock_in: string;
  avatar_url?: string;
}

export default function App() {
  const currentHour = new Date().getHours();
  const defaultShift = currentHour < 15 ? 'morning' : 'night';

  const [activeTab, setActiveTab] = useState<'morning' | 'night'>(defaultShift);
  const [activeNav, setActiveNav] = useState<'home' | 'sop' | 'resep' | 'jadwal' | 'karyawan' | 'handover' | 'dashboard' | 'presensi'>('home');
  const [isPageFading, setIsPageFading] = useState<boolean>(false);

  // State background presensi
  const [presenceBgList, setPresenceBgList] = useState<string[]>([]);
  const [presenceBgBlur, setPresenceBgBlur] = useState<number>(4);
  const [presenceBgOverlay, setPresenceBgOverlay] = useState<number>(80);
  const [isPresenceRandom, setIsPresenceRandom] = useState<boolean>(false);
  const [isBgManagerOpen, setIsBgManagerOpen] = useState<boolean>(false);

  // Status koneksi server & database
  const [isHostOnline, setIsHostOnline] = useState<boolean>(navigator.onLine);
  const [isDbOnline, setIsDbOnline] = useState<boolean>(true);

  // Modals & Menu State
  const [isAvatarPreviewOpen, setIsAvatarPreviewOpen] = useState<boolean>(false);
  const [isClosingAvatarPreview, setIsClosingAvatarPreview] = useState<boolean>(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isClosingUserMenu, setIsClosingUserMenu] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false); 
  const [isClosingMoreMenu, setIsClosingMoreMenu] = useState(false); // 🌟 State Transisi Tutup Menu Mobile
  const [isEditProfileOpen, setIsEditProfileOpen] = useState<boolean>(false);

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState<boolean>(false);
  const [isClockInOpen, setIsClockInOpen] = useState<boolean>(false);
  const [showClockOutModal, setShowClockOutModal] = useState<boolean>(false); 
  const [onDutyList, setOnDutyList] = useState<OnDutyStaff[]>([]);
  const [isClockingOut, setIsClockingOut] = useState<boolean>(false);

  // Monitoring Host Online
  useEffect(() => {
    const handleOnline = () => setIsHostOnline(true);
    const handleOffline = () => setIsHostOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Monitoring Database Online
  useEffect(() => {
    const checkDbHealth = async () => {
      try {
        const { error } = await supabase
          .from('system_settings')
          .select('key')
          .limit(1);

        if (!error) {
          setIsDbOnline(true);
        } else {
          setIsDbOnline(navigator.onLine);
        }
      } catch {
        setIsDbOnline(false);
      }
    };

    checkDbHealth();
    const interval = setInterval(checkDbHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  // Sync System Settings
  useEffect(() => {
    fetchPresenceBg();
    fetchPresenceSettings();
    const bgChannel = supabase
      .channel('system_settings_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_settings' }, () => {
        fetchPresenceBg();
        fetchPresenceSettings();
      })
      .subscribe();
    return () => { supabase.removeChannel(bgChannel); };
  }, []);

  const fetchPresenceBg = async () => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'presence_bg_url')
        .maybeSingle();

      if (data?.value) {
        let rawStr = String(data.value).trim();
        
        if (rawStr.startsWith('"') && rawStr.endsWith('"')) {
          rawStr = rawStr.slice(1, -1);
        }

        try {
          const parsed = JSON.parse(rawStr);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const cleanArray = parsed
              .map((u) => String(u).trim())
              .filter((u) => u.startsWith('http://') || u.startsWith('https://'));
            setPresenceBgList(cleanArray);
            return;
          } else if (typeof parsed === 'string' && parsed.startsWith('http')) {
            setPresenceBgList([parsed]);
            return;
          }
        } catch {
          if (rawStr.startsWith('http://') || rawStr.startsWith('https://')) {
            setPresenceBgList([rawStr]);
            return;
          } else {
            const matchUrl = rawStr.match(/https?:\/\/[^\s"']+/g);
            if (matchUrl && matchUrl.length > 0) {
              setPresenceBgList(matchUrl);
              return;
            }
          }
        }
      }
      setPresenceBgList([]);
    } catch (err) {
      console.error('Error reading presence bg from DB:', err);
      setPresenceBgList([]);
    }
  };

  const fetchPresenceSettings = async () => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['presence_bg_blur', 'presence_bg_overlay', 'presence_bg_random']);

      if (data) {
        data.forEach((row: any) => {
          if (row.key === 'presence_bg_blur') setPresenceBgBlur(Number(row.value) || 4);
          if (row.key === 'presence_bg_overlay') setPresenceBgOverlay(Number(row.value) || 80);
          if (row.key === 'presence_bg_random') setIsPresenceRandom(row.value === 'true' || row.value === true);
        });
      }
    } catch (err) {
      console.error('Error fetching visual slider settings:', err);
    }
  };

  const handleCloseAvatarPreview = () => {
    setIsClosingAvatarPreview(true);
    setTimeout(() => {
      setIsAvatarPreviewOpen(false);
      setIsClosingAvatarPreview(false);
    }, 180);
  };

  const handleCloseUserMenu = () => {
    setIsClosingUserMenu(true);
    setTimeout(() => {
      setIsUserMenuOpen(false);
      setIsClosingUserMenu(false);
    }, 150);
  };

  const handleToggleUserMenu = () => {
    if (isUserMenuOpen) {
      handleCloseUserMenu();
    } else {
      setIsClosingUserMenu(false);
      setIsUserMenuOpen(true);
    }
  };

  // 🌟 Penutupan Menu Mobile "Lainnya" Dengan Animasi Out Smooth
  const handleCloseMoreMenu = () => {
    setIsClosingMoreMenu(true);
    setTimeout(() => {
      setIsMoreMenuOpen(false);
      setIsClosingMoreMenu(false);
    }, 200);
  };

  const handleNavChange = (newNav: typeof activeNav) => {
    if (newNav === activeNav) return;
    setIsPageFading(true);
    setTimeout(() => {
      setActiveNav(newNav);
      setIsPageFading(false);
    }, 150);
  };

  const formatDisplayRole = (role?: string, staffId?: string): string => {
    const r = (role || '').toLowerCase();
    const id = (staffId || '').toUpperCase();
    if (r.includes('owner') || id.startsWith('OWN-')) return 'OWNER';
    return (role || '').replace(/_/g, ' ').toUpperCase();
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('rottherdams_user');
    if (savedUser) {
      if (checkIsIdleExpired()) {
        localStorage.removeItem('rottherdams_user');
        clearLastActivityTimestamp();
        setCurrentUser(null);
        alert('⚠️ Sesi Anda telah berakhir karena tidak ada aktivitas selama 5 menit.');
      } else {
        try {
          const parsedUser: CurrentUser = JSON.parse(savedUser);
          setCurrentUser(parsedUser);
          updateLastActivityTimestamp();
          if (parsedUser.staff_id) fetchUserProfile(parsedUser.staff_id, parsedUser);
        } catch (e) {
          console.error('Error parsing user session:', e);
        }
      }
    }
    fetchOnDutyStaff();
  }, []);

  useIdleLogout((reason) => {
    alert('⚠️ Sesi Anda telah berakhir karena tidak ada aktivitas selama 5 menit.');
    handleLogout(reason);
  }, Boolean(currentUser));

  const fetchUserProfile = async (staffId: string, localUser: CurrentUser) => {
    try {
      const { data, error } = await supabase.from('staff').select('*').eq('staff_id', staffId).single();
      if (!error && data) {
        const updatedUser: CurrentUser = {
          ...localUser,
          name: data.staff_name || data.name || localUser.name,
          avatar_url: data.avatar_url || '',
          role: data.role || localUser.role,
        };
        setCurrentUser(updatedUser);
        localStorage.setItem('rottherdams_user', JSON.stringify(updatedUser));
      }
    } catch (err) {
      console.error('Error syncing user profile:', err);
    }
  };

  const fetchOnDutyStaff = async () => {
    const { data } = await supabase
      .from('attendances')
      .select('id, staff_id, staff_name, role, shift, clock_in')
      .eq('status', 'On Duty')
      .order('clock_in', { ascending: false });

    if (data) {
      const staffIds = data.map(d => d.staff_id);
      let avatarMap: { [id: string]: string } = {};
      if (staffIds.length > 0) {
        const { data: staffProfiles } = await supabase.from('staff').select('staff_id, avatar_url').in('staff_id', staffIds);
        (staffProfiles || []).forEach((s: any) => { if (s.avatar_url) avatarMap[s.staff_id] = s.avatar_url; });
      }
      setOnDutyList(data.map(d => ({ ...d, avatar_url: avatarMap[d.staff_id] })));
    }
  };

  const handleLogout = async (actionType: 'LOGOUT' | 'AUTO_LOGOUT_IDLE' = 'LOGOUT') => {
    if (currentUser) {
      try { await recordLoginLog(currentUser, actionType); } catch (err) { console.warn('Gagal mencatat log logout:', err); }
    }
    localStorage.removeItem('rottherdams_user');
    clearLastActivityTimestamp();
    setCurrentUser(null);
    handleNavChange('home');
    handleCloseUserMenu();
    handleCloseMoreMenu();
  };

  const rawRole = (currentUser?.role || '').toLowerCase();
  const isManagementOrOwner = currentUser && (
    rawRole.includes('management') || 
    rawRole.includes('owner') ||
    rawRole.includes('general_manager') ||
    rawRole.includes('spv') ||
    rawRole.includes('hrd') ||
    rawRole.includes('finance') ||
    currentUser.staff_id?.startsWith('MNG-') ||
    currentUser.staff_id?.startsWith('OWN-')
  );

  const activeUserAttendance = currentUser ? onDutyList.find(item => item.staff_id === currentUser.staff_id) : null;

  const handleConfirmClockOut = async () => {
    if (!activeUserAttendance) return;
    setIsClockingOut(true);
    const { error } = await supabase
      .from('attendances')
      .update({ clock_out: new Date().toISOString(), status: 'Completed' })
      .eq('id', activeUserAttendance.id);

    setIsClockingOut(false);
    if (!error) {
      setShowClockOutModal(false);
      fetchOnDutyStaff();
    } else {
      alert('Gagal melakukan Clock Out: ' + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#ffffff] text-[#111111] font-sans antialiased flex flex-col justify-between pb-20 md:pb-0 selection:bg-[#d22027] selection:text-white">
      <style>{`
        @keyframes menuDropdownIn { 0% { opacity: 0; transform: scale(0.95) translateY(-8px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes menuDropdownOut { 0% { opacity: 1; transform: scale(1) translateY(0); } 100% { opacity: 0; transform: scale(0.95) translateY(-8px); } }
        @keyframes avatarModalIn { 0% { opacity: 0; transform: scale(0.85); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes avatarModalOut { 0% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(0.85); } }
        .user-dropdown-in { animation: menuDropdownIn 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .user-dropdown-out { animation: menuDropdownOut 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .avatar-modal-in { animation: avatarModalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .avatar-modal-out { animation: avatarModalOut 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>

      <div>
        <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} onLoginSuccess={(user: any) => { setCurrentUser(user); localStorage.setItem('rottherdams_user', JSON.stringify(user)); updateLastActivityTimestamp(); setIsLoginOpen(false); }} />
        <ClockInModal isOpen={isClockInOpen} onClose={() => setIsClockInOpen(false)} currentUser={currentUser as any} activeShift={activeTab} onSuccess={fetchOnDutyStaff} />
        <ClockOutModal isOpen={showClockOutModal} onClose={() => setShowClockOutModal(false)} onConfirm={handleConfirmClockOut} staffName={currentUser?.name} clockInTime={activeUserAttendance?.clock_in ? new Date(activeUserAttendance.clock_in).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : undefined} isLoading={isClockingOut} />
        
        {currentUser && (
          <EditProfileModal 
            isOpen={isEditProfileOpen} 
            onClose={() => setIsEditProfileOpen(false)} 
            currentUser={currentUser as any} 
            onUpdateSuccess={(updatedUser: any) => { 
              setCurrentUser(updatedUser); 
              localStorage.setItem('rottherdams_user', JSON.stringify(updatedUser)); 
            }} 
            onOpenAvatarPreview={() => setIsAvatarPreviewOpen(true)}
          />
        )}

        <BackgroundManager
          isOpen={isBgManagerOpen}
          onClose={() => setIsBgManagerOpen(false)}
          onUpdateSuccess={(urls) => setPresenceBgList(urls)}
        />

        <HeaderNavbar
          currentUser={currentUser}
          activeNav={activeNav}
          isManagementOrOwner={isManagementOrOwner}
          onNavChange={handleNavChange}
          onOpenLogin={() => setIsLoginOpen(true)}
          onToggleUserMenu={handleToggleUserMenu}
          isUserMenuOpen={isUserMenuOpen}
          isClosingUserMenu={isClosingUserMenu}
          onOpenEditProfile={() => { handleCloseUserMenu(); setIsEditProfileOpen(true); }}
          onLogout={() => handleLogout('LOGOUT')}
          onOpenAvatarPreview={() => setIsAvatarPreviewOpen(true)}
        />

        <main className="max-w-md md:max-w-4xl mx-auto px-5 py-6 md:py-10">
          <section className="mb-6 md:mb-8 border-b border-neutral-100 pb-5 md:pb-6 text-left">
            <p className="text-[11px] md:text-xs font-bold uppercase tracking-widest text-[#d22027] mb-1">System Management</p>
            <h1 className="text-2xl md:text-3xl font-black text-[#111111] tracking-tight leading-tight">Daily Operational Hub.</h1>
            <p className="text-xs md:text-sm text-neutral-500 mt-1.5 leading-relaxed">Presensi, checklist SOP harian, dan serah terima shift dalam satu genggaman.</p>
          </section>

          <div className={`transition-all duration-300 ease-in-out transform ${isPageFading ? 'opacity-0 scale-[0.99] translate-y-1' : 'opacity-100 scale-100 translate-y-0'}`}>
            {activeNav === 'dashboard' && isManagementOrOwner ? (
              <ManagementDashboard currentUser={currentUser as any} />
            ) : activeNav === 'presensi' && currentUser ? (
              <RekapPresensi currentUser={currentUser as any} />
            ) : activeNav === 'handover' && currentUser ? (
              <HandoverLog currentUser={currentUser as any} onRequireLogin={() => setIsLoginOpen(true)} />
            ) : activeNav === 'karyawan' && isManagementOrOwner ? (
              <DaftarKaryawan />
            ) : activeNav === 'jadwal' ? (
              <JadwalStaf userRole={(currentUser?.role as any) || 'bar'} currentUser={currentUser as any} />
            ) : activeNav === 'resep' && currentUser ? (
              <BukuResep currentUser={currentUser as any} />
            ) : activeNav === 'sop' && currentUser ? (
              <SopChecklist isFullView={true} currentUser={currentUser as any} />
            ) : (
              <div>
                {isManagementOrOwner && (
                  <div className="relative bg-neutral-100 p-1.5 rounded-2xl border border-neutral-200 flex mb-6 shadow-inner max-w-md mx-auto md:mx-0 select-none">
                    <div className={`absolute top-1.5 bottom-1.5 w-[calc(50%-0.375rem)] bg-[#111111] rounded-xl shadow-md transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${activeTab === 'night' ? 'translate-x-[calc(100%+0.375rem)]' : 'translate-x-0'}`} />
                    <button onClick={() => setActiveTab('morning')} className={`relative z-10 flex-1 py-2.5 text-xs font-extrabold rounded-xl transition-colors duration-300 cursor-pointer flex items-center justify-center gap-1.5 ${activeTab === 'morning' ? 'text-white' : 'text-neutral-500 hover:text-neutral-900'}`}>
                      <span>☀️</span> Morning Shift
                    </button>
                    <button onClick={() => setActiveTab('night')} className={`relative z-10 flex-1 py-2.5 text-xs font-extrabold rounded-xl transition-colors duration-300 cursor-pointer flex items-center justify-center gap-1.5 ${activeTab === 'night' ? 'text-white' : 'text-neutral-500 hover:text-neutral-900'}`}>
                      <span>🌙</span> Night Shift
                    </button>
                  </div>
                )}

                <div className="mb-6 rounded-3xl text-left overflow-hidden border border-neutral-200/80 shadow-xl">
                  <BackgroundRotator 
                    images={presenceBgList} 
                    intervalMs={7000}
                    blurLevel={presenceBgBlur}
                    overlayOpacity={presenceBgOverlay}
                    isRandom={isPresenceRandom}
                  >
                    <div className="relative p-6 md:p-8 min-h-[220px] flex flex-col justify-between">
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent pointer-events-none" />

                      <div className="relative z-10 flex justify-between items-center mb-4 flex-wrap gap-2">
                        <span className="text-[10px] md:text-xs font-black text-white bg-white/20 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/30 shadow-xs flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]"></span>
                          🕒 09.00 - 23.00 WITA
                        </span>

                        <div className="flex items-center gap-2">
                          {isManagementOrOwner && (
                            <button
                              onClick={() => setIsBgManagerOpen(true)}
                              className="text-[10px] bg-black/40 hover:bg-black/60 text-white font-bold px-3 py-1.5 rounded-full border border-white/20 backdrop-blur-md transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                            >
                              <span>🖼️</span> Kelola Rotator Background ({presenceBgList.length})
                            </button>
                          )}

                          {currentUser && (
                            onDutyList.length > 0 ? (
                              <span className="flex items-center gap-1.5 text-[10px] md:text-xs text-emerald-400 font-bold bg-black/40 px-3 py-1.5 rounded-full border border-emerald-500/30 backdrop-blur-md">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                                Bar Active
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-[10px] md:text-xs text-neutral-300 font-medium bg-black/40 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-md">
                                <span className="w-2 h-2 rounded-full bg-neutral-400"></span>
                                Shift Closed
                              </span>
                            )
                          )}
                        </div>
                      </div>

                      <div className="relative z-10 mb-6">
                        <h2 className="text-xl md:text-2xl font-black mb-1 tracking-tight text-white drop-shadow-md">We're Open Everyday</h2>
                        <p className="text-xs md:text-sm text-neutral-200 leading-relaxed drop-shadow-xs max-w-lg">Your daily dose of caffeine & good vibes at Rottherdams Coffee Social House.</p>
                      </div>

                      <div className="relative z-10">
                        {currentUser ? (
                          activeUserAttendance ? (
                            <button 
                              onClick={() => setShowClockOutModal(true)} 
                              disabled={isClockingOut} 
                              className="w-full md:w-auto md:px-8 py-3.5 bg-[#d22027]/75 hover:bg-[#d22027]/90 text-white font-extrabold text-xs md:text-sm rounded-2xl shadow-xl hover:shadow-red-500/30 backdrop-blur-md border border-white/25 transition duration-200 cursor-pointer active:scale-95 flex items-center justify-center gap-2"
                            >
                              {isClockingOut ? 'Memproses...' : '🚪 Selesai Shift / Clock Out'}
                            </button>
                          ) : (
                            <button 
                              onClick={() => setIsClockInOpen(true)} 
                              className="w-full md:w-auto md:px-8 py-3.5 bg-[#d22027]/75 hover:bg-[#d22027]/90 text-white font-bold text-xs md:text-sm rounded-2xl shadow-xl hover:shadow-red-500/30 backdrop-blur-md border border-white/25 transition duration-200 cursor-pointer active:scale-95 flex items-center justify-center gap-2"
                            >
                              <span>✅</span> Clock In Presensi Now
                            </button>
                          )
                        ) : (
                          <button 
                            onClick={() => setIsLoginOpen(true)} 
                            className="w-full md:w-auto md:px-8 py-3.5 bg-[#d22027]/75 hover:bg-[#d22027]/90 text-white font-bold text-xs md:text-sm rounded-2xl shadow-xl hover:shadow-red-500/30 backdrop-blur-md border border-white/25 transition duration-200 cursor-pointer active:scale-95 flex items-center justify-center gap-2"
                          >
                            <span>🔑</span> Login Staf untuk Presensi
                          </button>
                        )}
                      </div>
                    </div>
                  </BackgroundRotator>
                </div>

                {currentUser && <div className="mb-8"><AnnouncementBanner currentUser={currentUser as any} /></div>}

                {onDutyList.length > 0 && (
                  <div className="bg-neutral-50 rounded-3xl p-5 border border-neutral-200 mb-8 text-left">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-black text-[#111111] uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Tim On-Duty Saat Ini ({onDutyList.length})
                      </h3>
                      <button onClick={fetchOnDutyStaff} className="text-[10px] font-bold text-neutral-400 hover:text-neutral-700 transition cursor-pointer">🔄 Refresh</button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                      {onDutyList.map(staf => (
                        <div key={staf.id} className="bg-white p-3 rounded-2xl border border-neutral-200 shadow-2xs flex items-center gap-2.5">
                          {staf.avatar_url ? (
                            <img src={staf.avatar_url} alt={staf.staff_name} className="w-7 h-7 rounded-full object-cover border border-neutral-200 shrink-0" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-neutral-200 text-neutral-700 flex items-center justify-center font-bold text-[10px] shrink-0">{staf.staff_name[0]}</div>
                          )}
                          <div>
                            <p className="text-xs font-black text-[#111111] leading-tight">{staf.staff_name}</p>
                            <p className="text-[10px] text-neutral-400 capitalize">{staf.role?.replace(/_/g, ' ')} • {staf.shift}</p>
                            <p className="text-[9px] font-mono text-emerald-600 font-bold mt-0.5">In: {new Date(staf.clock_in).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WITA</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {currentUser && <SopChecklist activeShift={activeTab} currentUser={currentUser as any} />}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 md:gap-5 mt-8 text-left">
                  {currentUser && (
                    <>
                      <div onClick={() => handleNavChange('presensi')} className="p-5 rounded-2xl bg-white border border-neutral-200 hover:border-[#d22027] hover:shadow-md active:scale-98 transition cursor-pointer group">
                        <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-lg mb-3 group-hover:bg-[#d22027] group-hover:text-white transition">📍</div>
                        <h3 className="font-bold text-xs md:text-sm text-[#111111] mb-0.5">Riwayat Presensi</h3>
                        <p className="text-[10px] md:text-xs text-neutral-400">Jam masuk & keluar</p>
                      </div>

                      <div onClick={() => handleNavChange('sop')} className="p-5 rounded-2xl bg-white border border-neutral-200 hover:border-[#d22027] hover:shadow-md active:scale-98 transition cursor-pointer group">
                        <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-lg mb-3 group-hover:bg-[#d22027] group-hover:text-white transition">📋</div>
                        <h3 className="font-bold text-xs md:text-sm text-[#111111] mb-0.5">SOP Checklist</h3>
                        <p className="text-[10px] md:text-xs text-neutral-400">Tugas harian shift</p>
                      </div>

                      <div onClick={() => handleNavChange('resep')} className="p-5 rounded-2xl bg-white border border-neutral-200 hover:border-[#d22027] hover:shadow-md active:scale-98 transition cursor-pointer group">
                        <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-lg mb-3 group-hover:bg-[#d22027] group-hover:text-white transition">☕</div>
                        <h3 className="font-bold text-xs md:text-sm text-[#111111] mb-0.5">Buku Resep</h3>
                        <p className="text-[10px] md:text-xs text-neutral-400">Gramasi & resep kopi</p>
                      </div>

                      <div onClick={() => handleNavChange('handover')} className="p-5 rounded-2xl bg-white border border-neutral-200 hover:border-[#d22027] hover:shadow-md active:scale-98 transition cursor-pointer group">
                        <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-lg mb-3 group-hover:bg-[#d22027] group-hover:text-white transition">📝</div>
                        <h3 className="font-bold text-xs md:text-sm text-[#111111] mb-0.5">Handover Log</h3>
                        <p className="text-[10px] md:text-xs text-neutral-400">Catatan antar shift</p>
                      </div>
                    </>
                  )}

                  <div onClick={() => handleNavChange('jadwal')} className={`p-5 rounded-2xl bg-white border border-neutral-200 hover:border-[#d22027] hover:shadow-md active:scale-98 transition cursor-pointer group ${!currentUser ? 'col-span-2 md:col-span-4' : ''}`}>
                    <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-lg mb-3 group-hover:bg-[#d22027] group-hover:text-white transition">📅</div>
                    <h3 className="font-bold text-xs md:text-sm text-[#111111] mb-0.5">Jadwal Staf</h3>
                    <p className="text-[10px] md:text-xs text-neutral-400">Roster 2 shift</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      <FooterMinimalist isHostOnline={isHostOnline} isDbOnline={isDbOnline} />

      {/* Mobile Bottom Bar Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-neutral-200 px-4 py-2 z-40 shadow-2xl">
        <div className="max-w-md mx-auto flex justify-around items-center">
          <button onClick={() => handleNavChange('home')} className={`flex flex-col items-center gap-0.5 cursor-pointer transition ${activeNav === 'home' ? 'text-[#d22027]' : 'text-neutral-400 hover:text-neutral-700'}`}>
            <span className="text-lg leading-none">🏠</span>
            <span className="text-[10px] font-bold">Home</span>
          </button>
          {currentUser && (
            <>
              <button onClick={() => handleNavChange('presensi')} className={`flex flex-col items-center gap-0.5 cursor-pointer transition ${activeNav === 'presensi' ? 'text-[#d22027]' : 'text-neutral-400 hover:text-neutral-700'}`}>
                <span className="text-lg leading-none">📍</span>
                <span className="text-[10px] font-bold">Presensi</span>
              </button>
              <button onClick={() => handleNavChange('sop')} className={`flex flex-col items-center gap-0.5 cursor-pointer transition ${activeNav === 'sop' ? 'text-[#d22027]' : 'text-neutral-400 hover:text-neutral-700'}`}>
                <span className="text-lg leading-none">📋</span>
                <span className="text-[10px] font-bold">SOP</span>
              </button>
              <button onClick={() => handleNavChange('resep')} className={`flex flex-col items-center gap-0.5 cursor-pointer transition ${activeNav === 'resep' ? 'text-[#d22027]' : 'text-neutral-400 hover:text-neutral-700'}`}>
                <span className="text-lg leading-none">☕</span>
                <span className="text-[10px] font-bold">Resep</span>
              </button>
            </>
          )}
          <button onClick={() => setIsMoreMenuOpen(true)} className={`flex flex-col items-center gap-0.5 cursor-pointer transition ${['jadwal', 'dashboard', 'karyawan', 'handover'].includes(activeNav) ? 'text-[#d22027]' : 'text-neutral-400 hover:text-neutral-700'}`}>
            <span className="text-lg leading-none">⚡</span>
            <span className="text-[10px] font-bold">Lainnya</span>
          </button>
        </div>
      </nav>

      {/* 🌟 Mobile Drawer Menu "Lainnya" Dengan Animasi In & Out & Tampilan Bersih */}
      {isMoreMenuOpen && (
        <div 
          onClick={handleCloseMoreMenu}
          className={`md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end transition-opacity duration-200 ${
            isClosingMoreMenu ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className={`w-full bg-white rounded-t-3xl p-6 space-y-4 border-t border-neutral-100 shadow-2xl transition-transform duration-200 ${
              isClosingMoreMenu ? 'translate-y-full' : 'translate-y-0'
            }`}
          >
            <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
              <h3 className="font-extrabold text-sm text-[#111111]">Menu & Fitur Lainnya</h3>
              <button 
                onClick={handleCloseMoreMenu} 
                className="w-7 h-7 bg-neutral-100 text-neutral-500 rounded-full font-bold flex items-center justify-center text-xs cursor-pointer active:scale-90 transition-transform"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2 text-left">
              <button 
                onClick={() => { handleNavChange('jadwal'); handleCloseMoreMenu(); }} 
                className="p-3 bg-neutral-50 hover:bg-neutral-100 rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 active:scale-95 transition-all border border-neutral-100 cursor-pointer"
              >
                <span className="text-2xl">📅</span>
                <span className="text-[11px] font-bold text-neutral-800">Jadwal Staf</span>
              </button>

              {currentUser && (
                <button 
                  onClick={() => { handleNavChange('handover'); handleCloseMoreMenu(); }} 
                  className="p-3 bg-neutral-50 hover:bg-neutral-100 rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 active:scale-95 transition-all border border-neutral-100 cursor-pointer"
                >
                  <span className="text-2xl">📝</span>
                  <span className="text-[11px] font-bold text-neutral-800">Handover Log</span>
                </button>
              )}

              {isManagementOrOwner && (
                <>
                  <button 
                    onClick={() => { handleNavChange('dashboard'); handleCloseMoreMenu(); }} 
                    className="p-3 bg-neutral-50 hover:bg-neutral-100 rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 active:scale-95 transition-all border border-neutral-100 cursor-pointer"
                  >
                    <span className="text-2xl">📊</span>
                    <span className="text-[11px] font-bold text-neutral-800">Analytics</span>
                  </button>
                  <button 
                    onClick={() => { handleNavChange('karyawan'); handleCloseMoreMenu(); }} 
                    className="p-3 bg-neutral-50 hover:bg-neutral-100 rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 active:scale-95 transition-all border border-neutral-100 cursor-pointer"
                  >
                    <span className="text-2xl">👥</span>
                    <span className="text-[11px] font-bold text-neutral-800">Daftar Staf</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pop-up Preview Foto Profil */}
      {isAvatarPreviewOpen && currentUser && createPortal(
        <div onClick={handleCloseAvatarPreview} className={`fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 transition-opacity duration-200 cursor-pointer ${isClosingAvatarPreview ? 'opacity-0' : 'opacity-100'}`}>
          <div onClick={e => e.stopPropagation()} className={`bg-white rounded-3xl p-6 w-full max-w-xs text-center shadow-2xl border border-neutral-100 relative space-y-4 ${isClosingAvatarPreview ? 'avatar-modal-out' : 'avatar-modal-in'}`}>
            <button onClick={handleCloseAvatarPreview} className="absolute right-4 top-4 w-7 h-7 rounded-full bg-neutral-100 text-neutral-400 font-bold hover:bg-neutral-200 transition cursor-pointer flex items-center justify-center text-xs">✕</button>
            <div className="pt-2">
              <h3 className="text-base font-black text-[#111111] leading-tight">{currentUser.name}</h3>
              <p className="text-[11px] text-neutral-400 font-mono uppercase mt-0.5">{currentUser.staff_id} • {formatDisplayRole(currentUser.role, currentUser.staff_id)}</p>
            </div>
            <div className="relative w-44 h-44 mx-auto rounded-full overflow-hidden border-4 border-[#d22027] shadow-xl">
              {currentUser.avatar_url ? (
                <img src={currentUser.avatar_url} alt={currentUser.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-neutral-200 text-neutral-700 flex items-center justify-center font-black text-4xl">{currentUser.name.substring(0, 2).toUpperCase()}</div>
              )}
            </div>
            <div className="pt-2 flex gap-2">
              <button onClick={() => { handleCloseAvatarPreview(); setIsEditProfileOpen(true); }} className="w-full py-2.5 bg-[#d22027] hover:bg-[#b81b21] text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-md">⚙️ Ubah Foto / Profil</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <PWAInstallPrompt />
    </div>
  );
}