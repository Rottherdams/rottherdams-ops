import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';

interface LogItem {
  id: number;
  category: string;
  title: string;
  description: string;
  shift: string;
  created_by: string;
  staff_id?: string;
  avatar_url?: string;
  role?: string;
  status: 'Pending' | 'Resolved';
  created_at: string;
}

interface HandoverLogProps {
  currentUser: { name: string; role: string; staff_id: string; avatar_url?: string } | null;
  onRequireLogin: () => void;
}

const STOCK_CATEGORIES = [
  {
    category: 'BEANS',
    items: ['Blend', 'Arabica'],
  },
  {
    category: 'SYRUP',
    items: ['Almond', 'Caramel', 'Vanilla', 'Hazelnut', 'Cheesecake', 'Butterscotch', 'Aren'],
  },
  {
    category: 'FRUIT SYRUP',
    items: ['Peach', 'Raspberry', 'Strawberry'],
  },
  {
    category: 'POWDER & LAINNYA',
    items: [
      'Matcha',
      'Lychee tea',
      'Lemon tea',
      'Peach tea',
      'Taro',
      'Coklat Pait',
      'Coklat biasa',
      'Regal',
      'Apple juice',
      'Lemon',
      'Creamer',
    ],
  },
];

const QUICK_EMPTY_ITEMS = [
  'Pembersih kaca',
  'Sabun cuci piring',
  'Tissue',
  'Cup Es',
  'Cup Hot',
  'Sedotan',
  'Plastik Takeaway',
];

// Helper aman agar karakter <, >, & tidak merusak format HTML Telegram
const escapeHtml = (str: string) =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export default function HandoverLog({ currentUser, onRequireLogin }: HandoverLogProps) {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState<boolean>(false);

  // Form State + Animasi In/Out Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isClosingModal, setIsClosingModal] = useState<boolean>(false);
  const [category, setCategory] = useState<string>('Stok & Inventaris');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [shift, setShift] = useState<string>('Morning Shift');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // State Klik-Klik Opsi Stok
  const [stockCounts, setStockCounts] = useState<Record<string, number>>({});
  const [emptyItems, setEmptyItems] = useState<string[]>([]);
  const [activeStockTab, setActiveStockTab] = useState<string>('ALL');

  useEffect(() => {
    fetchLogs();

    // 🔴 SUPABASE REALTIME SUBSCRIPTION
    const channel = supabase
      .channel('handover-logs-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'handover_logs' },
        () => {
          fetchLogs(true);
        }
      )
      .subscribe((status) => {
        setIsRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchLogs = async (silent = false) => {
    if (!silent) setIsLoading(true);

    const { data: logData, error } = await supabase
      .from('handover_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching handover logs:', error.message);
      if (!silent) setIsLoading(false);
      return;
    }

    if (logData && logData.length > 0) {
      const staffIds = Array.from(
        new Set(logData.map((l: any) => l.staff_id || l.created_by).filter(Boolean))
      );

      const { data: staffProfiles } = await supabase
        .from('staff')
        .select('staff_id, avatar_url, staff_name, first_name, role')
        .or(`staff_id.in.(${staffIds.join(',')}),staff_name.in.(${staffIds.join(',')})`);

      const profileMap: { [key: string]: { avatar?: string; role?: string } } = {};
      (staffProfiles || []).forEach((s: any) => {
        const info = { avatar: s.avatar_url, role: s.role };
        if (s.staff_id) profileMap[s.staff_id] = info;
        if (s.staff_name) profileMap[s.staff_name] = info;
      });

      const enrichedLogs = logData.map((item: any) => {
        const profile = profileMap[item.staff_id] || profileMap[item.created_by];
        return {
          ...item,
          avatar_url: profile?.avatar,
          role: profile?.role || item.role,
        };
      });

      setLogs(enrichedLogs);
    } else {
      setLogs([]);
    }

    if (!silent) setIsLoading(false);
  };

  // 📲 KIRIM NOTIFIKASI OTOMATIS KE TELEGRAM (Format HTML Aman)
  const sendTelegramNotification = async (payload: {
    category: string;
    title: string;
    description: string;
    shift: string;
    created_by: string;
  }) => {
    const botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
    const chatId = import.meta.env.VITE_TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) return;

    const message = [
      `🔔 <b>HANDOVER BARU - ROTTHERDAMS OPS</b>`,
      `━━━━━━━━━━━━━━━━━━`,
      `👤 <b>Oleh:</b> ${escapeHtml(payload.created_by)}`,
      `🕒 <b>Shift:</b> ${escapeHtml(payload.shift)}`,
      `📂 <b>Kategori:</b> ${escapeHtml(payload.category)}`,
      `📌 <b>Judul:</b> ${escapeHtml(payload.title)}`,
      payload.description
        ? `\n📋 <b>Detail Laporan:</b>\n<pre>${escapeHtml(payload.description)}</pre>`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        console.warn('Telegram API Warning:', errData);
      }
    } catch (err) {
      console.error('Gagal mengirim notifikasi Telegram:', err);
    }
  };

  const handleOpenModal = () => {
    if (!currentUser) {
      onRequireLogin();
      return;
    }
    setIsClosingModal(false);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsClosingModal(true);
    setTimeout(() => {
      setIsModalOpen(false);
      setIsClosingModal(false);
      setTitle('');
      setDescription('');
      setStockCounts({});
      setEmptyItems([]);
      setActiveStockTab('ALL');
    }, 200);
  };

  const handleUpdateCount = (item: string, delta: number) => {
    setStockCounts((prev) => {
      const current = prev[item];
      if (current === undefined) {
        return { ...prev, [item]: delta > 0 ? 1 : 0 };
      }
      const nextVal = current + delta;
      if (nextVal < 0) {
        const copy = { ...prev };
        delete copy[item];
        return copy;
      }
      return { ...prev, [item]: nextVal };
    });
  };

  const handleSetZero = (item: string) => {
    setStockCounts((prev) => {
      if (prev[item] === 0) {
        const copy = { ...prev };
        delete copy[item];
        return copy;
      }
      return { ...prev, [item]: 0 };
    });
  };

  const toggleEmptyItem = (item: string) => {
    setEmptyItems((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const buildFormattedReport = () => {
    const lines: string[] = [];

    STOCK_CATEGORIES.forEach((group) => {
      const groupLines: string[] = [];
      group.items.forEach((item) => {
        if (stockCounts[item] !== undefined) {
          groupLines.push(`${item} ${stockCounts[item]}`);
        }
      });

      if (groupLines.length > 0) {
        lines.push(`${group.category}\n${groupLines.join('\n')}`);
      }
    });

    if (emptyItems.length > 0) {
      lines.push(`HABIS\n${emptyItems.join('\n')}`);
    }

    if (description.trim()) {
      lines.push(`CATATAN TAMBAHAN\n${description.trim()}`);
    }

    return lines.join('\n\n');
  };

  const isStockCategory = category === 'Stok & Inventaris';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const finalDescription = isStockCategory ? buildFormattedReport() : description.trim();
    const zeroCount =
      Object.values(stockCounts).filter((v) => v === 0).length + emptyItems.length;
    const totalChecked = Object.keys(stockCounts).length + emptyItems.length;

    const finalTitle =
      title.trim() ||
      (isStockCategory
        ? `Update Stok Bar (${totalChecked} item dicek${
            zeroCount > 0 ? `, ${zeroCount} HABIS` : ''
          })`
        : '');

    if (!finalTitle) {
      alert(
        isStockCategory
          ? 'Pilih minimal 1 item stok atau isi judul ringkas!'
          : 'Judul ringkas wajib diisi!'
      );
      return;
    }

    setIsSubmitting(true);

    const creatorName = currentUser?.name || 'Staff On-Duty';
    const primaryPayload = {
      category,
      title: finalTitle,
      description: finalDescription,
      shift,
      created_by: creatorName,
      staff_id: currentUser?.staff_id || null,
      status: 'Pending',
    };

    let { error } = await supabase.from('handover_logs').insert([primaryPayload]);

    if (error && error.message.includes('staff_id')) {
      const fallbackPayload = {
        category,
        title: finalTitle,
        description: finalDescription,
        shift,
        created_by: creatorName,
        status: 'Pending',
      };
      const fallbackRes = await supabase.from('handover_logs').insert([fallbackPayload]);
      error = fallbackRes.error;
    }

    setIsSubmitting(false);

    if (!error) {
      sendTelegramNotification({
        category,
        title: finalTitle,
        description: finalDescription,
        shift,
        created_by: creatorName,
      });

      handleCloseModal();
      // Jika realtime belum tersambung, tetap refresh manual
      if (!isRealtimeConnected) {
        fetchLogs(true);
      }
    } else {
      alert('Gagal menyimpan catatan handover: ' + error.message);
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'Pending' ? 'Resolved' : 'Pending';
    const { error } = await supabase
      .from('handover_logs')
      .update({ status: newStatus })
      .eq('id', id);

    if (!error) {
      setLogs((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: newStatus as any } : item))
      );
    }
  };

  const handleCopyText = (item: LogItem) => {
    const textToCopy = item.description ? item.description : item.title;
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleShareWhatsApp = (item: LogItem) => {
    const text = `*HANDOVER - ${item.shift.toUpperCase()}*\nOleh: ${item.created_by}\n\n${
      item.description || item.title
    }`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const filteredLogs =
    filterCategory === 'All' ? logs : logs.filter((item) => item.category === filterCategory);

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'Stok & Inventaris':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Fasilitas & Mesin':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  const filteredStockCategories =
    activeStockTab === 'ALL'
      ? STOCK_CATEGORIES
      : STOCK_CATEGORIES.filter((c) => c.category === activeStockTab);

  return (
    <div className="space-y-5 text-left">
      <style>{`
        @keyframes handoverCardSlideUp {
          0% { opacity: 0; transform: translateY(14px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes modalOverlayIn { 0% { opacity: 0; } 100% { opacity: 1; } }
        @keyframes modalOverlayOut { 0% { opacity: 1; } 100% { opacity: 0; } }
        @keyframes modalBoxIn {
          0% { opacity: 0; transform: scale(0.92) translateY(10px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes modalBoxOut {
          0% { opacity: 1; transform: scale(1) translateY(0); }
          100% { opacity: 0; transform: scale(0.92) translateY(10px); }
        }
        .handover-card-fade { animation: handoverCardSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
        .modal-backdrop-in { animation: modalOverlayIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .modal-backdrop-out { animation: modalOverlayOut 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .modal-box-in { animation: modalBoxIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .modal-box-out { animation: modalBoxOut 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>

      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-50 p-4 sm:p-5 rounded-3xl border border-neutral-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-black text-[#111111]">
              Handover Log & Catatan Shift
            </h2>
            {isRealtimeConnected && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[9px] font-extrabold text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            Komunikasi harian stok habis, kendala alat, dan pesan penting antar shift.
          </p>
        </div>
        <button
          onClick={handleOpenModal}
          className="w-full sm:w-auto px-5 py-2.5 bg-[#d22027] hover:bg-[#b81b21] active:scale-95 text-white font-bold text-xs rounded-2xl shadow-md transition cursor-pointer flex items-center justify-center gap-2 shrink-0"
        >
          <span>➕</span> Buat Catatan
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {['All', 'Stok & Inventaris', 'Fasilitas & Mesin', 'Pesan Shift'].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              filterCategory === cat
                ? 'bg-[#111111] text-white shadow-xs'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* List Catatan */}
      {isLoading ? (
        <div className="text-center py-12 text-xs font-bold text-neutral-400 animate-pulse">
          Memuat catatan handover...
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-12 bg-neutral-50 rounded-3xl border border-dashed border-neutral-200">
          <p className="text-2xl mb-1">📝</p>
          <p className="text-xs font-bold text-neutral-600">Belum ada catatan handover.</p>
          <p className="text-[11px] text-neutral-400 mt-0.5">
            Klik "Buat Catatan" untuk menambah pesan baru.
          </p>
        </div>
      ) : (
        <div key={filterCategory} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredLogs.map((item, index) => (
            <div
              key={item.id}
              style={{ animationDelay: `${index * 60}ms` }}
              className={`handover-card-fade p-4 sm:p-5 rounded-3xl border transition duration-200 shadow-2xs relative flex flex-col justify-between ${
                item.status === 'Resolved'
                  ? 'bg-neutral-50/70 border-neutral-200 opacity-75'
                  : 'bg-white border-neutral-200 hover:border-neutral-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <span
                    className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg border ${getCategoryBadge(
                      item.category
                    )}`}
                  >
                    {item.category}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCopyText(item)}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-600 transition cursor-pointer"
                      title="Salin teks laporan"
                    >
                      {copiedId === item.id ? '✅ Tersalin' : '📋 Salin'}
                    </button>
                    <button
                      onClick={() => handleShareWhatsApp(item)}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition cursor-pointer"
                      title="Kirim langsung ke WhatsApp"
                    >
                      📲 WA
                    </button>
                    <span className="text-[10px] font-mono text-neutral-400">
                      {new Date(item.created_at).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                <h3
                  className={`font-black text-sm text-[#111111] mb-2 ${
                    item.status === 'Resolved' ? 'line-through text-neutral-400' : ''
                  }`}
                >
                  {item.title}
                </h3>

                {item.description && (
                  <div className="bg-neutral-50/90 border border-neutral-200/70 rounded-2xl p-3 mb-3 max-h-48 overflow-y-auto no-scrollbar">
                    <p className="text-xs text-neutral-700 leading-relaxed whitespace-pre-line font-medium">
                      {item.description}
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-3 mt-1 border-t border-neutral-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {item.avatar_url ? (
                    <img
                      src={item.avatar_url}
                      alt={item.created_by}
                      className="w-6 h-6 rounded-full object-cover border border-neutral-200 shrink-0"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-neutral-200 text-neutral-700 flex items-center justify-center font-bold text-[9px] shrink-0">
                      {item.created_by[0] || '👤'}
                    </div>
                  )}
                  <div className="text-[10px] text-neutral-500 truncate">
                    <span className="font-bold text-neutral-700">{item.created_by}</span>
                    {item.role && (
                      <span className="text-neutral-400 font-medium capitalize">
                        {' '}
                        ({item.role.replace(/_/g, ' ')})
                      </span>
                    )}
                    <span> • </span>
                    <span className="italic">{item.shift}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleToggleStatus(item.id, item.status)}
                  className={`px-3 py-1 rounded-xl text-[10px] font-bold transition cursor-pointer active:scale-95 shrink-0 ${
                    item.status === 'Resolved'
                      ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  {item.status === 'Resolved' ? '✓ Selesai' : '⏳ Tandai Selesai'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL HANDOVER */}
      {isModalOpen &&
        createPortal(
          <div
            onClick={handleCloseModal}
            className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 ${
              isClosingModal ? 'modal-backdrop-out' : 'modal-backdrop-in'
            }`}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className={`bg-white rounded-3xl p-4 sm:p-6 w-full max-w-lg shadow-2xl border border-neutral-100 relative text-left my-auto max-h-[90vh] overflow-y-auto no-scrollbar ${
                isClosingModal ? 'modal-box-out' : 'modal-box-in'
              }`}
            >
              <button
                onClick={handleCloseModal}
                className="absolute right-4 top-4 w-8 h-8 rounded-full bg-neutral-100 text-neutral-400 font-bold hover:bg-neutral-200 transition cursor-pointer flex items-center justify-center text-xs"
              >
                ✕
              </button>

              <h3 className="text-base sm:text-lg font-black text-[#111111] mb-0.5">
                Tambah Catatan Handover
              </h3>
              <p className="text-[11px] text-neutral-400 mb-4">
                {isStockCategory
                  ? 'Tap + / - untuk isi sisa stok, atau tap nama item untuk set 0 (Habis).'
                  : 'Catat mesin bermasalah atau instruksi penting antar shift.'}
              </p>

              <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-bold text-neutral-700 mb-1">Kategori:</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 font-bold text-neutral-800 focus:outline-none focus:border-[#d22027]"
                    >
                      <option value="Stok & Inventaris">📦 Stok & Inventaris Habis/Menipis</option>
                      <option value="Fasilitas & Mesin">🛠️ Fasilitas & Mesin Rusak</option>
                      <option value="Pesan Shift">📌 Pesan / Catatan Antar Shift</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-neutral-700 mb-1">
                      Shift Kerja Saat Ini:
                    </label>
                    <select
                      value={shift}
                      onChange={(e) => setShift(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 font-bold text-neutral-800 focus:outline-none focus:border-[#d22027]"
                    >
                      <option value="Morning Shift">☀️ Morning Shift</option>
                      <option value="Night Shift">🌙 Night Shift</option>
                    </select>
                  </div>
                </div>

                {isStockCategory ? (
                  <div className="space-y-3 bg-neutral-50/80 p-3 rounded-2xl border border-neutral-200/80">
                    <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                      {['ALL', 'BEANS', 'SYRUP', 'FRUIT SYRUP', 'POWDER & LAINNYA'].map((tab) => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setActiveStockTab(tab)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold whitespace-nowrap transition cursor-pointer ${
                            activeStockTab === tab
                              ? 'bg-[#111111] text-white'
                              : 'bg-white text-neutral-500 border border-neutral-200'
                          }`}
                        >
                          {tab === 'ALL' ? '✨ Semua' : tab}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-3 max-h-[260px] overflow-y-auto no-scrollbar pr-0.5">
                      {filteredStockCategories.map((group) => (
                        <div key={group.category} className="space-y-1.5">
                          <p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
                            {group.category}
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {group.items.map((item) => {
                              const count = stockCounts[item];
                              const isChecked = count !== undefined;
                              const isZero = count === 0;
                              const isLow = count === 1;

                              return (
                                <div
                                  key={item}
                                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl border transition ${
                                    isZero
                                      ? 'bg-red-50 border-red-300'
                                      : isLow
                                      ? 'bg-amber-50 border-amber-300'
                                      : isChecked
                                      ? 'bg-white border-neutral-300 shadow-2xs'
                                      : 'bg-white/60 border-neutral-200/70'
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleSetZero(item)}
                                    className="text-left flex-1 min-w-0 pr-1 cursor-pointer"
                                    title="Tap nama item untuk langsung set 0 (Habis)"
                                  >
                                    <span
                                      className={`text-xs font-bold block truncate ${
                                        isZero ? 'text-red-700' : 'text-neutral-800'
                                      }`}
                                    >
                                      {item}
                                    </span>
                                    {isZero && (
                                      <span className="text-[9px] font-black text-red-600 uppercase">
                                        Habis (0)
                                      </span>
                                    )}
                                  </button>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateCount(item, -1)}
                                      className="w-6 h-6 rounded-lg bg-neutral-100 hover:bg-neutral-200 active:scale-90 font-black text-neutral-700 flex items-center justify-center cursor-pointer"
                                    >
                                      -
                                    </button>
                                    <span
                                      className={`w-6 text-center font-mono font-black text-xs ${
                                        isZero
                                          ? 'text-red-600'
                                          : isChecked
                                          ? 'text-[#111111]'
                                          : 'text-neutral-300'
                                      }`}
                                    >
                                      {isChecked ? count : '-'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateCount(item, 1)}
                                      className="w-6 h-6 rounded-lg bg-[#111111] hover:bg-neutral-800 active:scale-90 font-black text-white flex items-center justify-center cursor-pointer"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}

                      <div className="space-y-1.5 pt-2 border-t border-neutral-200">
                        <p className="text-[10px] font-black uppercase tracking-wider text-red-500">
                          🚨 TANDAI BARANG HABIS (KLIK PILIH)
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {QUICK_EMPTY_ITEMS.map((item) => {
                            const active = emptyItems.includes(item);
                            return (
                              <button
                                key={item}
                                type="button"
                                onClick={() => toggleEmptyItem(item)}
                                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition cursor-pointer active:scale-95 ${
                                  active
                                    ? 'bg-red-600 text-white border-red-600 shadow-2xs'
                                    : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300'
                                }`}
                              >
                                {active ? `✕ ${item} (Habis)` : `+ ${item}`}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {(Object.keys(stockCounts).length > 0 || emptyItems.length > 0) && (
                      <div className="bg-white p-2.5 rounded-xl border border-neutral-200">
                        <span className="text-[9px] font-black uppercase text-neutral-400 block mb-1">
                          Preview Laporan Otomatis:
                        </span>
                        <pre className="text-[10px] font-mono text-neutral-700 whitespace-pre-wrap leading-snug max-h-24 overflow-y-auto no-scrollbar">
                          {buildFormattedReport()}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="block font-bold text-neutral-700 mb-1">Judul Ringkas:</label>
                    <input
                      type="text"
                      placeholder="Misal: Espresso grinder 2 bunyi / AC ruang depan"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 font-bold text-neutral-800 focus:outline-none focus:border-[#d22027]"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block font-bold text-neutral-700 mb-1">
                    {isStockCategory ? 'Catatan Tambahan (Opsional):' : 'Keterangan Detail (Opsional):'}
                  </label>
                  <textarea
                    rows={2}
                    placeholder={
                      isStockCategory
                        ? 'Catatan barang lain di luar daftar di atas...'
                        : 'Tambahkan rincian detail...'
                    }
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2 font-medium text-neutral-800 focus:outline-none focus:border-[#d22027]"
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl font-bold text-xs transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={
                      isSubmitting ||
                      (isStockCategory
                        ? Object.keys(stockCounts).length === 0 &&
                          emptyItems.length === 0 &&
                          !description.trim()
                        : !title.trim())
                    }
                    className="flex-1 py-2.5 bg-[#d22027] hover:bg-[#b81b21] disabled:opacity-50 text-white rounded-xl font-bold text-xs transition cursor-pointer shadow-md"
                  >
                    {isSubmitting ? 'Menyimpan...' : 'Simpan Catatan'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}