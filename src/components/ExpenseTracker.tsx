import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { sendTelegramAlert, sendStaffDirectTelegram } from '../lib/telegram';

interface CurrentUser {
  name: string;
  role: string;
  staff_id: string;
  avatar_url?: string;
}

interface ExpenseItem {
  id: number;
  staff_id: string;
  staff_name: string;
  division: string;
  item_name: string;
  category: string;
  amount: number;
  expense_date: string;
  notes?: string;
  receipt_url?: string;
  status: 'pending' | 'verified' | 'rejected';
  verified_by?: string;
  created_at: string;
}

interface ExpenseTrackerProps {
  currentUser: CurrentUser | null;
}

const DIVISIONS = ['Bar', 'Kitchen', 'Floor / Kasir', 'Management / Umum'] as const;
const CATEGORIES = [
  'Bahan Baku / Fresh',
  'Es Batu & Gas',
  'Packaging & Supplies',
  'Kebersihan & Perlengkapan',
  'Maintenance / Perbaikan',
  'Lain-lain',
];

function detectDefaultDivision(role?: string): string {
  const r = (role || '').toLowerCase();
  if (r.includes('bar')) return 'Bar';
  if (r.includes('kitchen') || r.includes('dapur') || r.includes('chef') || r.includes('cook')) {
    return 'Kitchen';
  }
  if (r.includes('kasir') || r.includes('cashier') || r.includes('server') || r.includes('floor')) {
    return 'Floor / Kasir';
  }
  return 'Management / Umum';
}

// Kompresi gambar nota otomatis agar ringan & cepat di-upload
async function compressReceiptImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) return file;
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxDim = 1280;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => resolve(blob || file),
        'image/jpeg',
        0.78
      );
    };
    img.onerror = () => resolve(file);
    img.src = url;
  });
}

export default function ExpenseTracker({ currentUser }: ExpenseTrackerProps) {
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Filter state
  const [filterDivision, setFilterDivision] = useState<string>('ALL');
  const [filterMonth, setFilterMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [division, setDivision] = useState<string>(() => detectDefaultDivision(currentUser?.role));
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [amountInput, setAmountInput] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Preview Nota Modal
  const [selectedReceiptUrl, setSelectedReceiptUrl] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const rawRole = (currentUser?.role || '').toLowerCase();
  const isVerifier =
    rawRole.includes('management') ||
    rawRole.includes('owner') ||
    rawRole.includes('general_manager') ||
    rawRole.includes('finance') ||
    rawRole.includes('spv') ||
    (currentUser?.staff_id || '').toUpperCase().startsWith('MNG-') ||
    (currentUser?.staff_id || '').toUpperCase().startsWith('OWN-');

  useEffect(() => {
    setDivision(detectDefaultDivision(currentUser?.role));
  }, [currentUser]);

  useEffect(() => {
    fetchExpenses();

    const channel = supabase
      .channel('operational_expenses_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'operational_expenses' }, () => {
        fetchExpenses();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filterMonth]);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('operational_expenses')
        .select('*')
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (filterMonth) {
        const [year, month] = filterMonth.split('-').map(Number);
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        query = query.gte('expense_date', startDate).lte('expense_date', endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      setExpenses((data as ExpenseItem[]) || []);
    } catch (err) {
      console.error('Gagal memuat data pengeluaran:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatRupiah = (num: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(num || 0);

  const handleAmountChange = (val: string) => {
    const digitsOnly = val.replace(/\D/g, '');
    if (!digitsOnly) {
      setAmountInput('');
      return;
    }
    setAmountInput(Number(digitsOnly).toLocaleString('id-ID'));
  };

  const parsedAmount = Number(amountInput.replace(/\./g, '')) || 0;

  const handleSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFormError('');
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setFormError('Ukuran file nota terlalu besar (maksimal 10 MB).');
      return;
    }

    setReceiptFile(file);
    if (file.type.startsWith('image/')) {
      setReceiptPreview(URL.createObjectURL(file));
    } else {
      setReceiptPreview(null);
    }
  };

  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setFormError('');

    if (!itemName.trim()) {
      setFormError('Nama barang / keperluan belanja wajib diisi.');
      return;
    }
    if (parsedAmount <= 0) {
      setFormError('Nominal harga belanja harus lebih dari Rp 0.');
      return;
    }
    if (!receiptFile) {
      setFormError('Silakan scan / upload foto nota belanja terlebih dahulu!');
      return;
    }

    setSubmitting(true);
    try {
      const processedBlob = await compressReceiptImage(receiptFile);
      const ext = receiptFile.type === 'application/pdf' ? 'pdf' : 'jpg';
      const filePath = `receipts/${Date.now()}_${currentUser.staff_id}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('expense-receipts')
        .upload(filePath, processedBlob, {
          contentType: receiptFile.type === 'application/pdf' ? 'application/pdf' : 'image/jpeg',
        });

      if (uploadError) throw new Error(`Gagal upload nota: ${uploadError.message}`);

      const { data: publicUrlData } = supabase.storage
        .from('expense-receipts')
        .getPublicUrl(filePath);

      const receiptUrl = publicUrlData.publicUrl;

      const { error: insertError } = await supabase.from('operational_expenses').insert([
        {
          staff_id: currentUser.staff_id,
          staff_name: currentUser.name,
          division,
          item_name: itemName.trim(),
          category,
          amount: parsedAmount,
          expense_date: expenseDate,
          notes: notes.trim() || null,
          receipt_url: receiptUrl,
          status: 'pending',
        },
      ]);

      if (insertError) throw new Error(insertError.message);

      // Kirim notifikasi ke Grup Telegram Operasional beserta link foto nota
      await sendTelegramAlert({
        title: '🧾 LAPORAN PENGELUARAN BELANJA BARU',
        actor: `${currentUser.name} (${currentUser.staff_id})`,
        details: {
          'Divisi': division.toUpperCase(),
          'Belanja': itemName.trim(),
          'Kategori': category,
          'Total Harga': formatRupiah(parsedAmount),
          'Tanggal': expenseDate,
          ...(notes.trim() ? { 'Catatan': notes.trim() } : {}),
          'Status': 'Menunggu Verifikasi Finance / Management',
        },
        photoUrl: receiptUrl,
      });

      // Reset form
      setItemName('');
      setAmountInput('');
      setNotes('');
      setReceiptFile(null);
      setReceiptPreview(null);
      setIsFormOpen(false);
      setToastMsg({
        type: 'success',
        text: `✅ Pengeluaran "${itemName.trim()}" (${formatRupiah(parsedAmount)}) berhasil dicatat!`,
      });
      fetchExpenses();
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan data pengeluaran.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyExpense = async (item: ExpenseItem, newStatus: 'verified' | 'rejected') => {
    if (!currentUser) return;
    try {
      const { error } = await supabase
        .from('operational_expenses')
        .update({
          status: newStatus,
          verified_by: `${currentUser.name} (${currentUser.staff_id})`,
        })
        .eq('id', item.id);

      if (error) throw error;

      // Kirim notifikasi DM pribadi ke staf yang mengajukan belanja
      await sendStaffDirectTelegram(item.staff_id, {
        title:
          newStatus === 'verified'
            ? '✅ NOTA BELANJA ANDA DIVERIFIKASI'
            : '❌ NOTA BELANJA ANDA DITOLAK',
        actor: `${currentUser.name} (${currentUser.staff_id})`,
        details: {
          'Divisi': item.division,
          'Item Belanja': item.item_name,
          'Nominal': formatRupiah(Number(item.amount)),
          'Tanggal': item.expense_date,
          'Status':
            newStatus === 'verified'
              ? 'Valid & Disetujui Finance/Management'
              : 'Ditolak (Silakan cek kembali nota/nominal)',
        },
      });

      setToastMsg({
        type: 'success',
        text:
          newStatus === 'verified'
            ? `✅ Pengeluaran "${item.item_name}" telah diverifikasi!`
            : `❌ Pengeluaran "${item.item_name}" ditolak.`,
      });
      fetchExpenses();
    } catch (err: any) {
      setToastMsg({ type: 'error', text: 'Gagal memperbarui status: ' + err.message });
    }
  };

  // Hitung total per divisi (tidak menghitung yang rejected)
  const validExpenses = expenses.filter((e) => e.status !== 'rejected');
  const totalAll = validExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const divisionTotals = DIVISIONS.reduce((acc, div) => {
    acc[div] = validExpenses
      .filter((e) => e.division === div)
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);
    return acc;
  }, {} as Record<string, number>);

  const filteredExpenses =
    filterDivision === 'ALL'
      ? expenses
      : expenses.filter((e) => e.division === filterDivision);

  return (
    <div className="space-y-5 text-left">
      {/* HEADER */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-neutral-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-[#d22027]">
            Operational Petty Cash & Purchasing
          </span>
          <h2 className="text-lg sm:text-xl font-black text-[#111111] mt-0.5">
            🧾 Tracking Pengeluaran & Scan Nota
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Catat pembelian harian per divisi lengkap dengan foto/scan bukti nota resmi.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setFormError('');
            setIsFormOpen(true);
          }}
          className="w-full sm:w-auto px-4 py-2.5 bg-[#d22027] hover:bg-[#b51a20] text-white rounded-2xl text-xs font-extrabold shadow-md transition cursor-pointer active:scale-95 flex items-center justify-center gap-2"
        >
          <span>📸</span> + Catat Belanja & Scan Nota
        </button>
      </div>

      {toastMsg && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-bold border flex justify-between items-center ${
            toastMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}
        >
          <span>{toastMsg.text}</span>
          <button
            onClick={() => setToastMsg(null)}
            className="text-xs font-black opacity-60 hover:opacity-100 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* RINGKASAN PENGELUARAN PER DIVISI */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="col-span-2 lg:col-span-1 bg-[#111111] text-white p-4 rounded-3xl shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
            Total Semua Divisi
          </span>
          <p className="text-base sm:text-lg font-black mt-1 text-white">{formatRupiah(totalAll)}</p>
          <span className="text-[10px] text-emerald-400 font-semibold mt-1">
            {validExpenses.length} Transaksi Valid
          </span>
        </div>

        {DIVISIONS.map((div) => (
          <div
            key={div}
            onClick={() => setFilterDivision(filterDivision === div ? 'ALL' : div)}
            className={`p-4 rounded-3xl border transition cursor-pointer ${
              filterDivision === div
                ? 'bg-red-50/70 border-[#d22027] shadow-xs'
                : 'bg-white border-neutral-200 hover:border-neutral-300'
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-neutral-500">
                {div}
              </span>
              {filterDivision === div && (
                <span className="text-[9px] bg-[#d22027] text-white px-1.5 py-0.5 rounded-full font-bold">
                  Filter Aktif
                </span>
              )}
            </div>
            <p className="text-sm sm:text-base font-black text-[#111111] mt-1.5">
              {formatRupiah(divisionTotals[div] || 0)}
            </p>
            <span className="text-[10px] text-neutral-400 mt-0.5 block">
              {validExpenses.filter((e) => e.division === div).length} nota belanja
            </span>
          </div>
        ))}
      </div>

      {/* FILTER BAR & TABEL RIWAYAT PENGELUARAN */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-neutral-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-neutral-100">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setFilterDivision('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                filterDivision === 'ALL'
                  ? 'bg-[#111111] text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              Semua Divisi
            </button>
            {DIVISIONS.map((div) => (
              <button
                key={div}
                onClick={() => setFilterDivision(div)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  filterDivision === div
                    ? 'bg-[#d22027] text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {div}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-[11px] font-bold text-neutral-500 shrink-0">Periode:</label>
            <input
              type="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full sm:w-auto px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-[#111111]"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-neutral-400 animate-pulse">
            Memuat catatan belanja & bukti nota...
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <p className="text-xs text-neutral-400 italic">
              Belum ada catatan pengeluaran pada filter ini.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredExpenses.map((item) => (
              <div
                key={item.id}
                className="p-3.5 sm:p-4 rounded-2xl bg-neutral-50 border border-neutral-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-[#111111] text-white">
                      {item.division}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-neutral-200 text-neutral-700">
                      {item.category}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                        item.status === 'verified'
                          ? 'bg-emerald-100 text-emerald-700'
                          : item.status === 'rejected'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {item.status === 'verified'
                        ? '✅ Terverifikasi'
                        : item.status === 'rejected'
                        ? '❌ Ditolak'
                        : '⏳ Pending Cek'}
                    </span>
                  </div>

                  <h4 className="text-sm font-black text-[#111111]">{item.item_name}</h4>

                  <p className="text-[11px] text-neutral-500">
                    📅 {item.expense_date} • Oleh <b>{item.staff_name}</b> ({item.staff_id})
                    {item.notes ? ` • "${item.notes}"` : ''}
                  </p>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-200">
                  <p className="text-sm sm:text-base font-black text-[#d22027]">
                    {formatRupiah(Number(item.amount))}
                  </p>

                  <div className="flex items-center gap-1.5">
                    {item.receipt_url && (
                      <button
                        type="button"
                        onClick={() => setSelectedReceiptUrl(item.receipt_url || null)}
                        className="px-2.5 py-1.5 bg-white hover:bg-neutral-100 text-[#111111] border border-neutral-300 rounded-xl text-[11px] font-bold transition cursor-pointer"
                      >
                        🧾 Lihat Nota
                      </button>
                    )}

                    {isVerifier && item.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleVerifyExpense(item, 'verified')}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold transition cursor-pointer"
                        >
                          ✓ ACC
                        </button>
                        <button
                          type="button"
                          onClick={() => handleVerifyExpense(item, 'rejected')}
                          className="px-2.5 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-[11px] font-bold transition cursor-pointer"
                        >
                          ✕
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL INPUT PENGELUARAN & SCAN NOTA */}
      {isFormOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-neutral-100 max-h-[92vh] overflow-y-auto space-y-4 text-left">
              <div className="flex justify-between items-center pb-3 border-b border-neutral-100">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#d22027]">
                    Input Belanja Operasional
                  </span>
                  <h3 className="text-base font-black text-[#111111]">
                    🧾 Catat Pengeluaran & Scan Nota
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-500 font-bold text-xs flex items-center justify-center cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {formError && (
                <div className="p-2.5 rounded-2xl bg-red-50 border border-red-200 text-xs font-bold text-red-600">
                  ⚠️ {formError}
                </div>
              )}

              <form onSubmit={handleSubmitExpense} className="space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-bold text-neutral-700 mb-1">Divisi:</label>
                    <select
                      value={division}
                      onChange={(e) => setDivision(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-bold text-[#111111]"
                    >
                      {DIVISIONS.map((div) => (
                        <option key={div} value={div}>
                          {div}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-neutral-700 mb-1">Tanggal Belanja:</label>
                    <input
                      type="date"
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-medium text-[#111111]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-neutral-700 mb-1">
                    Belanja Apa? (Nama Barang / Keperluan):
                  </label>
                  <input
                    type="text"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="Contoh: Es Batu Kristal 10 Bal / Ayam Fillet 5 Kg"
                    required
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl font-bold text-[#111111] focus:outline-none focus:border-[#d22027]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-bold text-neutral-700 mb-1">Kategori:</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl font-bold text-[#111111]"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-neutral-700 mb-1">
                      Total Harga (Rp):
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-neutral-400">
                        Rp
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={amountInput}
                        onChange={(e) => handleAmountChange(e.target.value)}
                        placeholder="0"
                        required
                        className="w-full pl-9 pr-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl font-black text-[#d22027] focus:outline-none focus:border-[#d22027]"
                      />
                    </div>
                  </div>
                </div>

                {/* SCAN KAMERA / UPLOAD NOTA */}
                <div className="space-y-2">
                  <label className="block font-bold text-neutral-700">
                    Scan Kamera / Upload Foto Nota (Wajib):
                  </label>

                  {/* Hidden input untuk kamera langsung HP */}
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleSelectFile}
                    className="hidden"
                  />

                  {/* Hidden input untuk galeri / file PDF */}
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleSelectFile}
                    className="hidden"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="py-2.5 px-3 bg-[#111111] hover:bg-black text-white rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition"
                    >
                      <span>📷</span> Scan Kamera Nota
                    </button>

                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="py-2.5 px-3 bg-neutral-100 hover:bg-neutral-200 text-[#111111] border border-neutral-300 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition"
                    >
                      <span>🖼️</span> Upload dari Galeri
                    </button>
                  </div>

                  {receiptFile && (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
                      <div className="flex justify-between items-center text-[11px] font-bold text-emerald-800">
                        <span className="truncate">✅ {receiptFile.name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setReceiptFile(null);
                            setReceiptPreview(null);
                          }}
                          className="text-red-600 font-black ml-2 cursor-pointer"
                        >
                          Hapus
                        </button>
                      </div>
                      {receiptPreview && (
                        <img
                          src={receiptPreview}
                          alt="Preview Nota"
                          className="w-full max-h-44 object-contain rounded-xl bg-white border border-emerald-100"
                        />
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-neutral-700 mb-1">
                    Catatan Tambahan (Opsional):
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Misal: Beli di Pasar Lama / Toko Mitra..."
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-[#d22027]"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    disabled={submitting}
                    className="flex-1 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 font-bold rounded-xl cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-2.5 bg-[#d22027] hover:bg-[#b51a20] text-white font-extrabold rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? 'Mengunggah Nota...' : '🚀 Simpan Pengeluaran'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* MODAL PREVIEW FOTO NOTA */}
      {selectedReceiptUrl &&
        createPortal(
          <div
            onClick={() => setSelectedReceiptUrl(null)}
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white p-4 rounded-3xl max-w-lg w-full space-y-3 shadow-2xl border border-neutral-100"
            >
              <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
                <h4 className="font-black text-xs text-[#111111]">🧾 Bukti Nota Belanja</h4>
                <div className="flex items-center gap-3">
                  <a
                    href={selectedReceiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-bold text-[#d22027] hover:underline"
                  >
                    ↗ Buka Full
                  </a>
                  <button
                    onClick={() => setSelectedReceiptUrl(null)}
                    className="text-neutral-400 hover:text-black font-bold text-xs cursor-pointer"
                  >
                    ✕ Tutup
                  </button>
                </div>
              </div>

              {selectedReceiptUrl.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={selectedReceiptUrl}
                  title="Nota PDF"
                  className="w-full h-96 rounded-2xl border border-neutral-200"
                />
              ) : (
                <img
                  src={selectedReceiptUrl}
                  alt="Foto Nota Belanja"
                  className="w-full h-auto max-h-[75vh] object-contain rounded-2xl bg-neutral-50"
                />
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}