import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';

interface CurrentUser {
  staff_id: string;
  name: string;
  role: string;
  avatar_url?: string;
}

interface Announcement {
  id: number;
  title: string;
  content: string;
  priority: 'Normal' | 'Urgent';
  author_name: string;
  created_at: string;
  author_avatar?: string;
}

interface ReadAuditItem {
  staff_id: string;
  staff_name?: string;
  avatar_url?: string;
  read_at: string;
}

interface AnnouncementBannerProps {
  currentUser: CurrentUser;
}

export default function AnnouncementBanner({ currentUser }: AnnouncementBannerProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  // State Modal Buat Pengumuman Baru
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isClosingCreateModal, setIsClosingCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newPriority, setNewPriority] = useState<'Normal' | 'Urgent'>('Normal');
  const [submitting, setSubmitting] = useState(false);
  const [modalErrorMessage, setModalErrorMessage] = useState<string | null>(null);

  // State Modal Audit Staf yang Sudah Membaca
  const [auditAnnouncementId, setAuditAnnouncementId] = useState<number | null>(null);
  const [isClosingAuditModal, setIsClosingAuditModal] = useState(false);
  const [readAuditList, setReadAuditList] = useState<ReadAuditItem[]>([]);

  // 👑 Validasi Manajemen & Owner (Bisa Akses Fitur Audit & Broadcast)
  const rawRole = (currentUser?.role || '').toLowerCase();
  const isManagementOrOwner =
    rawRole.includes('management') ||
    rawRole.includes('owner') ||
    rawRole.includes('general_manager') ||
    rawRole.includes('spv') ||
    rawRole.includes('hrd') ||
    rawRole.includes('finance') ||
    currentUser.staff_id?.startsWith('MNG-') ||
    currentUser.staff_id?.startsWith('OWN-');

  useEffect(() => {
    fetchAnnouncementsAndAutoRead();

    // ⚡ SUBSCRIBER REALTIME SUPABASE UNTUK ANNOUNCEMENTS
    const announcementChannel = supabase
      .channel('public:announcements')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'announcements' },
        (payload) => {
          const newAnn = payload.new as Announcement;
          setAnnouncements((prev) => [newAnn, ...prev]);
          // Otomatis tandai dibaca jika ada pengumuman baru yang masuk saat user aktif
          if (currentUser?.staff_id) {
            autoMarkAsRead([newAnn.id]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(announcementChannel);
    };
  }, [currentUser]);

  // FUNGSI AMBIL DATA & AUTO-MARK READ UNTUK SELURUH PENGUMUMAN TERSEDIA
  const fetchAnnouncementsAndAutoRead = async () => {
    setLoading(true);

    // 1. Fetch pengumuman terbaru
    const { data: annData } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    let currentReadIds: number[] = [];

    // 2. Fetch log yang sudah dibaca oleh user saat ini
    if (currentUser?.staff_id) {
      const { data: readData } = await supabase
        .from('announcement_reads')
        .select('announcement_id')
        .eq('staff_id', currentUser.staff_id);

      if (readData) {
        currentReadIds = readData.map((item) => item.announcement_id);
      }
    }

    if (annData && annData.length > 0) {
      // Ambil avatar penulis dari tabel staff jika ada
      const authorNames = Array.from(new Set(annData.map((a: any) => a.author_name).filter(Boolean)));
      const { data: staffData } = await supabase
        .from('staff')
        .select('staff_name, first_name, avatar_url')
        .in('staff_name', authorNames);

      const avatarMap: { [name: string]: string } = {};
      (staffData || []).forEach((s: any) => {
        if (s.avatar_url) avatarMap[s.staff_name] = s.avatar_url;
      });

      const enriched = annData.map((item: any) => ({
        ...item,
        author_avatar: avatarMap[item.author_name] || undefined,
      }));

      setAnnouncements(enriched);

      // ⚡ 3. EKSEKUSI OTOMATIS: Cari pengumuman yang BELUM dibaca dan langsung catat ke DB
      if (currentUser?.staff_id) {
        const unreadIds = annData
          .map((a: any) => a.id)
          .filter((id: number) => !currentReadIds.includes(id));

        if (unreadIds.length > 0) {
          autoMarkAsRead(unreadIds);
        }
      }
    } else {
      setAnnouncements([]);
    }
    setLoading(false);
  };

  // HANDLER RECORD OTOMATIS KE SUPABASE
  const autoMarkAsRead = async (announcementIds: number[]) => {
    if (!currentUser?.staff_id || announcementIds.length === 0) return;

    const payload = announcementIds.map((id) => ({
      announcement_id: id,
      staff_id: currentUser.staff_id,
    }));

    await supabase.from('announcement_reads').insert(payload);
  };

  // Handler Tutup Modal Buat Pengumuman dengan Animasi Out
  const handleCloseCreateModal = () => {
    setIsClosingCreateModal(true);
    setTimeout(() => {
      setShowCreateModal(false);
      setIsClosingCreateModal(false);
      setModalErrorMessage(null);
    }, 250);
  };

  // Handler Buat Pengumuman Baru (Management & Owner)
  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    setSubmitting(true);
    setModalErrorMessage(null);

    const { error } = await supabase.from('announcements').insert([
      {
        title: newTitle.trim(),
        content: newContent.trim(),
        priority: newPriority,
        author_name: currentUser.name,
      },
    ]);

    setSubmitting(false);

    if (!error) {
      setNewTitle('');
      setNewContent('');
      setNewPriority('Normal');
      handleCloseCreateModal();
      fetchAnnouncementsAndAutoRead();
    } else {
      console.error('Error insert announcement:', error);
      setModalErrorMessage(error.message);
    }
  };

  // Handler Tutup Modal Audit dengan Animasi Out
  const handleCloseAuditModal = () => {
    setIsClosingAuditModal(true);
    setTimeout(() => {
      setAuditAnnouncementId(null);
      setIsClosingAuditModal(false);
    }, 250);
  };

  // Handler Lihat Audit Staf yang Sudah Membaca (Lengkap Foto & Nama)
  const handleOpenAuditModal = async (announcementId: number) => {
    setAuditAnnouncementId(announcementId);
    const { data } = await supabase
      .from('announcement_reads')
      .select('staff_id, read_at')
      .eq('announcement_id', announcementId)
      .order('read_at', { ascending: false });

    if (data && data.length > 0) {
      const staffIds = data.map((item: any) => item.staff_id);
      const { data: staffProfiles } = await supabase
        .from('staff')
        .select('staff_id, staff_name, first_name, last_name, avatar_url')
        .in('staff_id', staffIds);

      const staffMap: { [id: string]: { name: string; avatar?: string } } = {};
      (staffProfiles || []).forEach((s: any) => {
        const name = s.staff_name || `${s.first_name || ''} ${s.last_name || ''}`.trim() || s.staff_id;
        staffMap[s.staff_id] = { name, avatar: s.avatar_url };
      });

      const enrichedAudit = data.map((item: any) => ({
        ...item,
        staff_name: staffMap[item.staff_id]?.name || item.staff_id,
        avatar_url: staffMap[item.staff_id]?.avatar,
      }));

      setReadAuditList(enrichedAudit);
    } else {
      setReadAuditList([]);
    }
  };

  if (loading && announcements.length === 0) {
    if (!isManagementOrOwner) return null;
  }

  return (
    <div className="space-y-4 text-left">
      {/* 🌟 Keyframe Animasi Backdrop & Modal */}
      <style>{`
        @keyframes annBackdropIn { 0% { opacity: 0; } 100% { opacity: 1; } }
        @keyframes annBackdropOut { 0% { opacity: 1; } 100% { opacity: 0; } }
        @keyframes annModalIn {
          0% { opacity: 0; transform: scale(0.92) translateY(12px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes annModalOut {
          0% { opacity: 1; transform: scale(1) translateY(0); }
          100% { opacity: 0; transform: scale(0.95) translateY(8px); }
        }
        .ann-backdrop-in { animation: annBackdropIn 0.3s ease-out forwards; }
        .ann-backdrop-out { animation: annBackdropOut 0.25s ease-in forwards; }
        .ann-modal-in { animation: annModalIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .ann-modal-out { animation: annModalOut 0.25s ease-in forwards; }
      `}</style>

      {/* HEADER BAR & BUTTON BUAT PENGUMUMAN */}
      <div className="flex justify-between items-center pb-2 border-b border-neutral-200">
        <h3 className="font-black text-sm text-[#111111] flex items-center gap-2">
          <span>📢</span> Bulletin Board & Pengumuman Operasional
        </h3>
        {isManagementOrOwner && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1.5 bg-[#d22027] hover:bg-red-700 text-white rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 shadow-xs"
          >
            + Buat Pengumuman
          </button>
        )}
      </div>

      {/* FEED PENGUMUMAN REALTIME */}
      <div className="space-y-3">
        {announcements.length === 0 ? (
          <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 text-center text-xs text-neutral-400">
            Belum ada pengumuman operasional terbaru.
          </div>
        ) : (
          announcements.map((item) => {
            const isUrgent = item.priority === 'Urgent';

            return (
              <div
                key={item.id}
                className={`p-4 rounded-3xl border transition relative ${
                  isUrgent
                    ? 'bg-red-50/60 border-red-300 text-red-950'
                    : 'bg-white border-neutral-200 shadow-xs'
                }`}
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[9px] px-2.5 py-0.5 rounded-full font-black uppercase ${
                          isUrgent
                            ? 'bg-red-600 text-white animate-pulse'
                            : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                        }`}
                      >
                        {isUrgent ? '⚠️ URGENT BROADCAST' : '📢 INFO'}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {item.author_avatar ? (
                          <img
                            src={item.author_avatar}
                            alt={item.author_name}
                            className="w-4 h-4 rounded-full object-cover"
                          />
                        ) : null}
                        <span className="text-[10px] text-neutral-400 font-mono">
                          Oleh: <strong>{item.author_name}</strong> •{' '}
                          {new Date(item.created_at).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })} WITA
                        </span>
                      </div>
                    </div>

                    <h4 className="font-extrabold text-sm text-[#111111] mt-1">{item.title}</h4>
                    <p className="text-xs text-neutral-700 whitespace-pre-line leading-relaxed">
                      {item.content}
                    </p>
                  </div>

                  {/* AUDIT MANAGEMENT & OWNER / STATUS OTOMATIS READ */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      ✓ Sudah Dilihat
                    </span>

                    {isManagementOrOwner && (
                      <button
                        onClick={() => handleOpenAuditModal(item.id)}
                        className="text-[10px] text-neutral-500 hover:text-neutral-900 underline font-semibold cursor-pointer"
                      >
                        Audit Pembaca
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL BUAT PENGUMUMAN (PORTAL KE document.body) */}
      {showCreateModal && createPortal(
        <div className={`fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] ${
          isClosingCreateModal ? 'ann-backdrop-out' : 'ann-backdrop-in'
        }`}>
          <div className={`bg-white p-6 rounded-3xl max-w-md w-full space-y-4 relative shadow-2xl border border-neutral-100 my-auto text-left ${
            isClosingCreateModal ? 'ann-modal-out' : 'ann-modal-in'
          }`}>
            <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
              <h4 className="font-black text-sm text-[#111111]">📢 Buat Broadcast Pengumuman</h4>
              <button
                type="button"
                onClick={handleCloseCreateModal}
                className="w-7 h-7 bg-neutral-100 hover:bg-neutral-200 text-neutral-500 hover:text-black rounded-full font-bold text-xs cursor-pointer flex items-center justify-center transition active:scale-90"
              >
                ✕
              </button>
            </div>

            {modalErrorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-[11px] text-red-600 font-semibold space-y-1">
                <p className="font-bold">⚠️ Gagal Mengirim Pengumuman:</p>
                <p className="font-mono text-[10px] bg-white p-2 rounded-xl border border-red-100">{modalErrorMessage}</p>
              </div>
            )}

            <form onSubmit={handleCreateAnnouncement} className="space-y-3 text-xs">
              <div>
                <label className="font-bold block mb-1 text-neutral-700">Judul Pengumuman</label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Perubahan SOP Closing Bar..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-[#d22027]"
                />
              </div>

              <div>
                <label className="font-bold block mb-1 text-neutral-700">Tingkat Prioritas</label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as any)}
                  className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none cursor-pointer font-bold"
                >
                  <option value="Normal">Normal Broadcast</option>
                  <option value="Urgent">🔴 Urgent Broadcast (Wajib Segera)</option>
                </select>
              </div>

              <div>
                <label className="font-bold block mb-1 text-neutral-700">Isi Pesan Pengumuman</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Tuliskan instruksi atau pengumuman secara rinci di sini..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-[#d22027]"
                ></textarea>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCloseCreateModal}
                  className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-2 py-3 bg-[#d22027] hover:bg-red-700 text-white font-black rounded-xl transition cursor-pointer shadow-md disabled:opacity-50 active:scale-98"
                >
                  {submitting ? 'Mengirim...' : '🚀 Broadcast Pengumuman'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL AUDIT STATUS MEMBACA STAF (PORTAL KE document.body) */}
      {auditAnnouncementId && createPortal(
        <div className={`fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] ${
          isClosingAuditModal ? 'ann-backdrop-out' : 'ann-backdrop-in'
        }`}>
          <div className={`bg-white p-5 rounded-3xl max-w-sm w-full space-y-3 relative shadow-2xl border border-neutral-100 text-left my-auto ${
            isClosingAuditModal ? 'ann-modal-out' : 'ann-modal-in'
          }`}>
            <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
              <h4 className="font-black text-xs text-[#111111]">📋 Audit Staf yang Sudah Membaca</h4>
              <button
                type="button"
                onClick={handleCloseAuditModal}
                className="w-7 h-7 bg-neutral-100 hover:bg-neutral-200 text-neutral-500 hover:text-black rounded-full font-bold text-xs cursor-pointer flex items-center justify-center transition active:scale-90"
              >
                ✕
              </button>
            </div>

            {readAuditList.length === 0 ? (
              <p className="text-xs text-neutral-400 italic py-4 text-center">
                Belum ada staf yang melihat pengumuman ini.
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {readAuditList.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-neutral-50 rounded-2xl border border-neutral-200 flex justify-between items-center text-xs"
                  >
                    <div className="flex items-center gap-2">
                      {item.avatar_url ? (
                        <img
                          src={item.avatar_url}
                          alt={item.staff_name}
                          className="w-6 h-6 rounded-full object-cover border border-neutral-200"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-neutral-200 text-neutral-700 flex items-center justify-center font-bold text-[9px]">
                          {item.staff_name?.[0] || '👤'}
                        </div>
                      )}
                      <div>
                        <p className="font-extrabold text-[#111111] text-[11px]">{item.staff_name}</p>
                        <p className="text-[9px] text-neutral-400 font-mono">{item.staff_id}</p>
                      </div>
                    </div>

                    <span className="text-[10px] text-neutral-400 font-mono">
                      {new Date(item.read_at).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      WITA
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}