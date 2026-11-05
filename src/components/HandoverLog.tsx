import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface LogItem {
  id: number;
  category: string;
  title: string;
  description: string;
  shift: string;
  created_by: string;
  status: 'Pending' | 'Resolved';
  created_at: string;
}

interface HandoverLogProps {
  currentUser: { name: string; role: string; staff_id: string } | null;
  onRequireLogin: () => void;
}

export default function HandoverLog({ currentUser, onRequireLogin }: HandoverLogProps) {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filterCategory, setFilterCategory] = useState<string>('All');

  // Form State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [category, setCategory] = useState<string>('Stok & Inventaris');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [shift, setShift] = useState<string>('Morning Shift');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('handover_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setLogs(data);
    }
    setIsLoading(false);
  };

  const handleOpenModal = () => {
    if (!currentUser) {
      onRequireLogin();
      return;
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    const { error } = await supabase.from('handover_logs').insert([
      {
        category,
        title: title.trim(),
        description: description.trim(),
        shift,
        created_by: currentUser?.name || 'Staff On-Duty',
        status: 'Pending',
      },
    ]);

    setIsSubmitting(false);

    if (!error) {
      setTitle('');
      setDescription('');
      setIsModalOpen(false);
      fetchLogs();
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
      setLogs(prev =>
        prev.map(item => (item.id === id ? { ...item, status: newStatus as any } : item))
      );
    }
  };

  const filteredLogs = filterCategory === 'All'
    ? logs
    : logs.filter(item => item.category === filterCategory);

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

  return (
    <div className="space-y-6 text-left">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-50 p-5 rounded-3xl border border-neutral-200">
        <div>
          <h2 className="text-lg font-black text-[#111111]">Handover Log & Catatan Shift</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Komunikasi harian stok habis, kendala alat, dan pesan penting antar shift.
          </p>
        </div>
        <button
          onClick={handleOpenModal}
          className="px-5 py-2.5 bg-[#d22027] hover:bg-[#b81b21] active:scale-95 text-white font-bold text-xs rounded-2xl shadow-md transition cursor-pointer flex items-center justify-center gap-2 shrink-0"
        >
          <span>➕</span> Buat Catatan
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {['All', 'Stok & Inventaris', 'Fasilitas & Mesin', 'Pesan Shift'].map(cat => (
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
          <p className="text-[11px] text-neutral-400 mt-0.5">Klik "Buat Catatan" untuk menambah pesan baru.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredLogs.map(item => (
            <div
              key={item.id}
              className={`p-5 rounded-3xl border transition shadow-2xs relative flex flex-col justify-between ${
                item.status === 'Resolved'
                  ? 'bg-neutral-50/70 border-neutral-200 opacity-75'
                  : 'bg-white border-neutral-200 hover:border-neutral-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg border ${getCategoryBadge(item.category)}`}>
                    {item.category}
                  </span>
                  <span className="text-[10px] font-mono text-neutral-400">
                    {new Date(item.created_at).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <h3 className={`font-black text-sm text-[#111111] mb-1 ${item.status === 'Resolved' ? 'line-through text-neutral-400' : ''}`}>
                  {item.title}
                </h3>
                {item.description && (
                  <p className="text-xs text-neutral-600 leading-relaxed mb-3">
                    {item.description}
                  </p>
                )}
              </div>

              <div className="pt-3 mt-2 border-t border-neutral-100 flex items-center justify-between">
                <div className="text-[10px] text-neutral-500">
                  <span className="font-bold text-neutral-700">{item.created_by}</span> • <span className="italic">{item.shift}</span>
                </div>

                <button
                  onClick={() => handleToggleStatus(item.id, item.status)}
                  className={`px-3 py-1 rounded-xl text-[10px] font-bold transition cursor-pointer ${
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

      {/* Modal Buat Catatan Handover */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-neutral-100 animate-in fade-in zoom-in-95 duration-200 relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute right-4 top-4 w-8 h-8 rounded-full bg-neutral-100 text-neutral-400 font-bold hover:bg-neutral-200 transition cursor-pointer flex items-center justify-center text-xs"
            >
              ✕
            </button>

            <h3 className="text-lg font-black text-[#111111] mb-1">Tambah Catatan Handover</h3>
            <p className="text-xs text-neutral-400 mb-5">
              Catat bahan habis, mesin bermasalah, atau instruksi antar shift.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">Kategori:</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 font-bold text-xs text-neutral-800 focus:outline-none focus:border-[#d22027]"
                >
                  <option value="Stok & Inventaris">📦 Stok & Inventaris Habis/Menipis</option>
                  <option value="Fasilitas & Mesin">🛠️ Fasilitas & Mesin Rusak</option>
                  <option value="Pesan Shift">📌 Pesan / Catatan Antar Shift</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">Shift Kerja Saat Ini:</label>
                <select
                  value={shift}
                  onChange={e => setShift(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 font-bold text-xs text-neutral-800 focus:outline-none focus:border-[#d22027]"
                >
                  <option value="Morning Shift">☀️ Morning Shift</option>
                  <option value="Night Shift">🌙 Night Shift</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">Judul Ringkas:</label>
                <input
                  type="text"
                  placeholder="Misal: Susu UHT sisa 2 kotak / Espresso grinder 2 bunyi"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 font-bold text-xs text-neutral-800 focus:outline-none focus:border-[#d22027]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">Keterangan Detail (Opsional):</label>
                <textarea
                  rows={3}
                  placeholder="Tambahkan rincian detail..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 font-medium text-xs text-neutral-800 focus:outline-none focus:border-[#d22027]"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl font-bold text-xs transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !title.trim()}
                  className="flex-1 py-3 bg-[#d22027] hover:bg-[#b81b21] disabled:opacity-50 text-white rounded-xl font-bold text-xs transition cursor-pointer shadow-md"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Catatan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}