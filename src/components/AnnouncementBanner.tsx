import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface CurrentUser {
  staff_id: string;
  name: string;
  role: string;
}

interface Announcement {
  id: number;
  title: string;
  content: string;
  priority: 'Normal' | 'Urgent';
  author_name: string;
  created_at: string;
}

interface AnnouncementBannerProps {
  currentUser: CurrentUser;
}

export default function AnnouncementBanner({ currentUser }: AnnouncementBannerProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [readAnnouncementIds, setReadAnnouncementIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  // State Modal Buat Pengumuman Baru
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newPriority, setNewPriority] = useState<'Normal' | 'Urgent'>('Normal');
  const [submitting, setSubmitting] = useState(false);

  // State Modal Audit Staf yang Sudah Membaca
  const [auditAnnouncementId, setAuditAnnouncementId] = useState<number | null>(null);
  const [readAuditList, setReadAuditList] = useState<{ staff_id: string; read_at: string }[]>([]);

  const rawRole = (currentUser?.role || '').toLowerCase();
  const isManagementOrOwner =
    rawRole.includes('management') ||
    rawRole.includes('owner') ||
    currentUser.staff_id?.startsWith('MNG-') ||
    currentUser.staff_id?.startsWith('OWN-');

  useEffect(() => {
    fetchAnnouncements();
    fetchReadLogs();

    // ⚡ 1. SUBSCRIBER REALTIME SUPABASE UNTUK ANNOUNCEMENTS
    const announcementChannel = supabase
      .channel('public:announcements')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'announcements' },
        (payload) => {
          // Tambahkan pengumuman baru langsung ke paling atas state
          const newAnn = payload.new as Announcement;
          setAnnouncements((prev) => [newAnn, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(announcementChannel);
    };
  }, [currentUser]);

  const fetchAnnouncements = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (data) setAnnouncements(data);
    setLoading(false);
  };

  const fetchReadLogs = async () => {
    if (!currentUser?.staff_id) return;
    const { data } = await supabase
      .from('announcement_reads')
      .select('announcement_id')
      .eq('staff_id', currentUser.staff_id);

    if (data) {
      setReadAnnouncementIds(data.map((item) => item.announcement_id));
    }
  };

  // Handler Tandai Sudah Membaca
  const handleMarkAsRead = async (announcementId: number) => {
    const { error } = await supabase.from('announcement_reads').insert([
      {
        announcement_id: announcementId,
        staff_id: currentUser.staff_id,
      },
    ]);

    if (!error) {
      setReadAnnouncementIds((prev) => [...prev, announcementId]);
    }
  };

  // Handler Buat Pengumuman Baru (Management)
  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    setSubmitting(true);
    const { error } = await supabase.from('announcements').insert([
      {
        title: newTitle,
        content: newContent,
        priority: newPriority,
        author_name: currentUser.name,
      },
    ]);

    setSubmitting(false);
    if (!error) {
      setNewTitle('');
      setNewContent('');
      setNewPriority('Normal');
      setShowCreateModal(false);
    } else {
      alert('Gagal membuat pengumuman: ' + error.message);
    }
  };

  // Handler Lihat Audit Staf yang Sudah Membaca
  const handleOpenAuditModal = async (announcementId: number) => {
    setAuditAnnouncementId(announcementId);
    const { data } = await supabase
      .from('announcement_reads')
      .select('staff_id, read_at')
      .eq('announcement_id', announcementId)
      .order('read_at', { ascending: false });

    if (data) setReadAuditList(data);
  };

  if (loading && announcements.length === 0) {
    if (!isManagementOrOwner) return null;
  }

  return (
    <div className="space-y-4 text-left">
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
            const isRead = readAnnouncementIds.includes(item.id);
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

                    <h4 className="font-extrabold text-sm text-[#111111] mt-1">{item.title}</h4>
                    <p className="text-xs text-neutral-700 whitespace-pre-line leading-relaxed">
                      {item.content}
                    </p>
                  </div>

                  {/* TOMBOL AKSI STAF & AUDIT MANAGEMENT */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {isRead ? (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                        ✓ Sudah Dibaca
                      </span>
                    ) : (
                      <button
                        onClick={() => handleMarkAsRead(item.id)}
                        className="px-3 py-1 bg-[#111111] hover:bg-neutral-800 text-white rounded-xl text-[11px] font-bold shadow-xs transition cursor-pointer"
                      >
                        👁️ Tandai Dibaca
                      </button>
                    )}

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

      {/* MODAL BUAT PENGUMUMAN */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-3xl max-w-md w-full space-y-4 relative shadow-2xl border border-neutral-100">
            <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
              <h4 className="font-black text-sm text-[#111111]">📢 Buat Broadcast Pengumuman</h4>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-neutral-400 hover:text-black font-bold text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

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

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-[#d22027] hover:bg-red-700 text-white font-black rounded-xl transition cursor-pointer shadow-md disabled:opacity-50"
              >
                {submitting ? 'Mengirim...' : '🚀 Broadcast Pengumuman'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL AUDIT STATUS MEMBACA STAF */}
      {auditAnnouncementId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white p-5 rounded-3xl max-w-sm w-full space-y-3 relative shadow-2xl border border-neutral-100">
            <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
              <h4 className="font-black text-xs text-[#111111]">📋 Staf yang Sudah Membaca</h4>
              <button
                onClick={() => setAuditAnnouncementId(null)}
                className="text-neutral-400 hover:text-black font-bold text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            {readAuditList.length === 0 ? (
              <p className="text-xs text-neutral-400 italic py-4 text-center">
                Belum ada staf yang menandai pengumuman ini sebagai dibaca.
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {readAuditList.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-200 flex justify-between items-center text-xs"
                  >
                    <span className="font-mono font-bold text-[#111111]">{item.staff_id}</span>
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
        </div>
      )}
    </div>
  );
}