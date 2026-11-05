import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface CurrentUser {
  name: string;
  role: 'management' | 'kasir' | 'bar' | 'dapur' | 'owner';
  staff_id: string;
}

interface RecipeItem {
  id: number;
  name: string;
  category: string;
  grammage: string;
  temperature: string;
  extraction_time: string;
}

interface BukuResepProps {
  currentUser?: CurrentUser | null;
}

export default function BukuResep({ currentUser }: BukuResepProps) {
  const [recipes, setRecipes] = useState<RecipeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'Beverage' | 'Food' | 'Pastry'>('All');

  // State Modal Tambah Resep
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'Beverage' | 'Food' | 'Pastry'>('Beverage');
  const [grammage, setGrammage] = useState('');
  const [temperature, setTemperature] = useState('');
  const [extractionTime, setExtractionTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isManagementOrOwner = currentUser && (currentUser.role === 'management' || currentUser.role === 'owner');

  useEffect(() => {
    fetchRecipes();
  }, []);

  const fetchRecipes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.error('Error fetching recipes:', error.message);
    } else if (data) {
      setRecipes(data);
    }
    setLoading(false);
  };

  const handleAddRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    const { error } = await supabase.from('recipes').insert([
      {
        name: name.trim(),
        category: category,
        grammage: grammage.trim(),
        temperature: temperature.trim() || '-',
        extraction_time: extractionTime.trim() || '-',
      },
    ]);

    setIsSubmitting(false);

    if (error) {
      alert('Gagal menambahkan resep: ' + error.message);
    } else {
      setName('');
      setGrammage('');
      setTemperature('');
      setExtractionTime('');
      setIsAddModalOpen(false);
      fetchRecipes();
    }
  };

  const handleDeleteRecipe = async (id: number, recipeName: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus resep "${recipeName}"?`)) return;

    const { error } = await supabase
      .from('recipes')
      .delete()
      .eq('id', id);

    if (error) {
      alert('Gagal menghapus resep: ' + error.message);
    } else {
      fetchRecipes();
    }
  };

  const filteredRecipes = selectedCategory === 'All'
    ? recipes
    : recipes.filter(r => (r.category || 'Beverage').toLowerCase() === selectedCategory.toLowerCase());

  return (
    <div className="bg-white rounded-3xl p-6 border border-neutral-200 shadow-sm text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 pb-4 border-b border-neutral-100">
        <div>
          <h2 className="text-lg font-black text-[#111111]">📖 Buku Resep & Standar Gramasi</h2>
          <p className="text-xs text-neutral-400 mt-0.5">Panduan porsi bahan dan standar penyajian Bar & Kitchen Rottherdams.</p>
        </div>

        {isManagementOrOwner && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-3.5 py-1.5 bg-[#111111] hover:bg-neutral-800 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-sm"
          >
            <span>➕</span> Tambah Resep
          </button>
        )}
      </div>

      {/* Filter Kategori (All / Beverage / Food / Pastry) */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {(['All', 'Beverage', 'Food', 'Pastry'] as const).map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              selectedCategory === cat
                ? 'bg-[#d22027] text-white shadow-sm'
                : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-800'
            }`}
          >
            {cat === 'All' ? '✨ Semua Resep' : cat === 'Beverage' ? '☕ Minuman (Beverage)' : cat === 'Food' ? '🍳 Makanan (Food)' : '🥐 Pastry & Snack'}
          </button>
        ))}
      </div>

      {/* List Card Resep */}
      {loading ? (
        <div className="py-8 text-center text-xs text-neutral-400 animate-pulse">
          Memuat resep dari database...
        </div>
      ) : filteredRecipes.length === 0 ? (
        <div className="py-8 text-center text-xs text-neutral-400">
          Belum ada resep untuk kategori ini.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRecipes.map(item => (
            <div key={item.id} className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 relative group">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-sm text-[#111111]">{item.name}</h3>
                  <span className="text-[9px] font-bold px-2 py-0.5 bg-neutral-200 text-neutral-600 rounded-md uppercase">
                    {item.category || 'Beverage'}
                  </span>
                </div>

                {isManagementOrOwner && (
                  <button
                    onClick={() => handleDeleteRecipe(item.id, item.name)}
                    className="text-neutral-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100 text-xs p-1 cursor-pointer"
                    title="Hapus Resep"
                  >
                    🗑️
                  </button>
                )}
              </div>

              <div className="space-y-1 text-xs text-neutral-600">
                <p><span className="font-semibold text-neutral-400">Gramasi / Komposisi:</span> {item.grammage}</p>
                <p><span className="font-semibold text-neutral-400">Suhu / Metode:</span> {item.temperature}</p>
                <p><span className="font-semibold text-neutral-400">Waktu / Ekstraksi:</span> {item.extraction_time}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Pop-Up Tambah Resep */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-neutral-100 text-left">
            <h3 className="text-base font-black text-[#111111] mb-1">Tambah Resep Baru</h3>
            <p className="text-xs text-neutral-400 mb-4">Masukkan resep baru untuk divisi Bar atau Kitchen.</p>

            <form onSubmit={handleAddRecipe} className="space-y-3.5">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-neutral-600 mb-1">Nama Menu</label>
                  <input
                    type="text"
                    required
                    placeholder="Misal: French Fries BBQ"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:outline-none focus:border-[#d22027]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-600 mb-1">Kategori</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as any)}
                    className="w-full px-2 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:outline-none focus:border-[#d22027]"
                  >
                    <option value="Beverage">Minuman</option>
                    <option value="Food">Makanan</option>
                    <option value="Pastry">Pastry</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-600 mb-1">Gramasi & Komposisi Bahan</label>
                <textarea
                  required
                  rows={2}
                  placeholder={category === 'Food' ? "Misal: Kentang 150g + Saus BBQ 30g + Garam 2g" : "Misal: Espresso 18g + Milk 150ml"}
                  value={grammage}
                  onChange={e => setGrammage(e.target.value)}
                  className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:outline-none focus:border-[#d22027]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-600 mb-1">Suhu / Metode</label>
                  <input
                    type="text"
                    placeholder={category === 'Food' ? "Misal: Goreng 180°C" : "Misal: 65°C / Cold"}
                    value={temperature}
                    onChange={e => setTemperature(e.target.value)}
                    className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:outline-none focus:border-[#d22027]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-600 mb-1">Waktu Penyajian</label>
                  <input
                    type="text"
                    placeholder={category === 'Food' ? "Misal: 5–7 menit" : "Misal: 25-30s / Foam"}
                    value={extractionTime}
                    onChange={e => setExtractionTime(e.target.value)}
                    className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:outline-none focus:border-[#d22027]"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-[#d22027] hover:bg-[#bb2026] text-white rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Simpan...' : 'Simpan Resep'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}