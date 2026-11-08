import type { CurrentUser } from '../App';

interface HeaderNavbarProps {
  currentUser: CurrentUser | null;
  activeNav: string;
  isManagementOrOwner: boolean | null;
  onNavChange: (nav: any) => void;
  onOpenLogin: () => void;
  onToggleUserMenu: () => void;
  isUserMenuOpen: boolean;
  isClosingUserMenu: boolean;
  onOpenEditProfile: () => void;
  onLogout: () => void;
  onOpenAvatarPreview: () => void;
}

export default function HeaderNavbar({
  currentUser,
  activeNav,
  isManagementOrOwner,
  onNavChange,
  onOpenLogin,
  onToggleUserMenu,
  isUserMenuOpen,
  isClosingUserMenu,
  onOpenEditProfile,
  onLogout,
  onOpenAvatarPreview
}: HeaderNavbarProps) {
  const formatDisplayRole = (role?: string, staffId?: string): string => {
    const r = (role || '').toLowerCase();
    const id = (staffId || '').toUpperCase();

    if (r.includes('owner') || id.startsWith('OWN-')) {
      return 'OWNER';
    }
    if (
      r.includes('management') || 
      r.includes('general_manager') ||
      r.includes('spv') ||
      r.includes('hrd') ||
      r.includes('finance') ||
      id.startsWith('MNG-')
    ) {
      return (role || '').replace(/_/g, ' ').toUpperCase();
    }
    return (role || '').replace(/_/g, ' ').toUpperCase();
  };

  return (
    <header className="bg-[#d22027] text-white w-full sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 md:h-20 gap-4">
          
          <div className="flex items-center gap-3 shrink-0 cursor-pointer" onClick={() => onNavChange('home')}>
            <img src="/logo.svg" alt="Rottherdams Logo" className="h-7 md:h-8 w-auto object-contain" />
            <span className="text-[9px] bg-black/25 text-white border border-white/20 px-2 py-0.5 rounded-full font-bold tracking-wider">
              Ops
            </span>
          </div>

          <nav className="hidden lg:flex items-center gap-2 bg-black/15 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => onNavChange('home')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeNav === 'home' ? 'bg-white text-[#d22027] shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              Home
            </button>

            {currentUser && (
              <>
                <button
                  onClick={() => onNavChange('presensi')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    activeNav === 'presensi' ? 'bg-[#white] bg-white text-[#d22027] shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  Presensi
                </button>

                <div className="relative group py-1">
                  <button className="px-3 py-1.5 text-xs font-bold text-white/80 group-hover:text-white flex items-center gap-1">
                    Operasional ▾
                  </button>
                  <div className="absolute top-full left-0 hidden group-hover:flex flex-col bg-white text-[#111111] rounded-2xl shadow-xl border border-neutral-100 p-2 min-w-[160px] z-50 animate-dropdown-down">
                    <button onClick={() => onNavChange('sop')} className="px-3 py-2 text-left rounded-xl hover:bg-neutral-100 text-xs font-bold transition">📋 SOP Checklist</button>
                    <button onClick={() => onNavChange('resep')} className="px-3 py-2 text-left rounded-xl hover:bg-neutral-100 text-xs font-bold transition">☕ Buku Resep</button>
                    <button onClick={() => onNavChange('handover')} className="px-3 py-2 text-left rounded-xl hover:bg-neutral-100 text-xs font-bold transition">📝 Handover Log</button>
                  </div>
                </div>
              </>
            )}

            <button
              onClick={() => onNavChange('jadwal')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeNav === 'jadwal' ? 'bg-white text-[#d22027] shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              Jadwal Staf
            </button>

            {isManagementOrOwner && (
              <div className="relative group py-1">
                <button className="px-3 py-1.5 text-xs font-bold text-white/80 group-hover:text-white flex items-center gap-1">
                  Management ▾
                </button>
                <div className="absolute top-full left-0 hidden group-hover:flex flex-col bg-white text-[#111111] rounded-2xl shadow-xl border border-neutral-100 p-2 min-w-[160px] z-50 animate-dropdown-down">
                  <button onClick={() => onNavChange('dashboard')} className="px-3 py-2 text-left rounded-xl hover:bg-neutral-100 text-xs font-bold transition">📊 Analytics</button>
                  <button onClick={() => onNavChange('karyawan')} className="px-3 py-2 text-left rounded-xl hover:bg-neutral-100 text-xs font-bold transition">👥 Daftar Staf</button>
                </div>
              </div>
            )}
          </nav>

          <div className="relative shrink-0">
            {currentUser ? (
              <div className="flex items-center gap-2">
                {/* Tombol Utama Profil: Mengklik area ini di HP / Desktop akan membuka User Menu */}
                <button 
                  onClick={onToggleUserMenu}
                  className="flex items-center gap-2.5 cursor-pointer hover:opacity-90 transition p-1 rounded-full md:rounded-xl hover:bg-black/10 active:scale-95"
                >
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-bold leading-none">{currentUser.name}</p>
                    <p className="text-[10px] text-white/80 mt-0.5 uppercase tracking-wider font-bold">
                      {formatDisplayRole(currentUser.role, currentUser.staff_id)}
                    </p>
                  </div>

                  {currentUser.avatar_url ? (
                    <img
                      src={currentUser.avatar_url}
                      alt={currentUser.name}
                      className="w-8 h-8 rounded-full object-cover border border-white/40 shadow-inner hover:scale-105 transition transform pointer-events-none"
                    />
                  ) : (
                    <div 
                      className="w-8 h-8 rounded-full bg-white/20 border border-white/40 flex items-center justify-center text-xs font-black shadow-inner pointer-events-none"
                    >
                      {currentUser.name.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenLogin}
                className="px-4 py-2 bg-white text-[#d22027] rounded-xl text-xs font-black shadow-md cursor-pointer hover:bg-neutral-100 transition flex items-center gap-1.5 active:scale-95"
              >
                🔑 Login Staf
              </button>
            )}

            {/* Menu Dropdown Profil & Logout */}
            {isUserMenuOpen && currentUser && (
              <div
                className={`absolute right-0 mt-2 w-56 bg-white text-[#111111] rounded-2xl shadow-2xl border border-neutral-100 py-2 z-50 ${
                  isClosingUserMenu ? 'user-dropdown-out' : 'user-dropdown-in'
                }`}
              >
                <div 
                  onClick={() => {
                    onOpenAvatarPreview();
                  }}
                  className="px-4 py-2.5 border-b border-neutral-100 flex items-center gap-3 hover:bg-neutral-50 transition cursor-pointer group"
                >
                  {currentUser.avatar_url ? (
                    <img
                      src={currentUser.avatar_url}
                      alt={currentUser.name}
                      className="w-9 h-9 rounded-full object-cover border border-neutral-200 shrink-0 group-hover:scale-105 transition"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-neutral-100 text-neutral-700 flex items-center justify-center text-xs font-black shrink-0">
                      {currentUser.name.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-[#111111] truncate">{currentUser.name}</p>
                    <p className="text-[10px] text-neutral-400 font-mono uppercase truncate mt-0.5">
                      {currentUser.staff_id} • {formatDisplayRole(currentUser.role, currentUser.staff_id)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={onOpenEditProfile}
                  className="w-full text-left px-4 py-2.5 text-xs text-neutral-700 hover:bg-neutral-50 flex items-center gap-2 transition cursor-pointer font-bold mt-1"
                >
                  ⚙️ Edit Profil & PIN
                </button>

                <button 
                  onClick={onLogout}
                  className="w-full text-left px-4 py-2.5 text-xs text-[#d22027] hover:bg-red-50 flex items-center gap-2 transition cursor-pointer font-bold border-t border-neutral-100 mt-1"
                >
                  🚪 Keluar (Logout)
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}