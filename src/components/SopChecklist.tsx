import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';

interface CurrentUser {
  name: string;
  role: string;
  staff_id: string;
  avatar_url?: string;
}

interface SopItem {
  id: number;
  shift: string;
  task_name: string;
  category: string;
  is_completed: boolean;
  completed_by?: string | null;
  completed_at?: string | null;
  completed_by_avatar?: string | null;
}

interface SopChecklistProps {
  activeShift?: 'morning' | 'night' | string;
  isFullView?: boolean;
  currentUser?: CurrentUser | null;
}

export default function SopChecklist({ activeShift = 'morning', isFullView = false, currentUser }: SopChecklistProps) {
  const [tasks, setTasks] = useState<SopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // State animasi switching antar shift
  const [isSwitchingShift, setIsSwitchingShift] = useState(false);

  // State Modal Tambah SOP + Animasi In/Out
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isClosingModal, setIsClosingModal] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [newCategory, setNewCategory] = useState('Bar');
  const [newShift, setNewShift] = useState<'morning' | 'night'>('morning');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  const currentShift = activeShift.toLowerCase().includes('night') ? 'night' : 'morning';

  useEffect(() => {
    // Picu animasi transisi fade saat perpindahan shift
    setIsSwitchingShift(true);
    const timer = setTimeout(() => {
      fetchSopTasks();
      setIsSwitchingShift(false);
    }, 120);

    // INTEGRASI REALTIME SUPABASE
    const sopChannel = supabase
      .channel('sop_realtime_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sop_checklists' },
        () => {
          fetchSopTasks();
        }
      )
      .subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(sopChannel);
    };
  }, [currentShift, isFullView]);

  const fetchSopTasks = async () => {
    setLoading(true);
    setErrorMessage(null);

    let query = supabase.from('sop_checklists').select('*').order('id', { ascending: true });

    if (!isFullView) {
      query = query.eq('shift', currentShift);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching SOP:', error);
      setErrorMessage(error.message);
    } else if (data) {
      const todayStr = new Date().toDateString();

      const completedNames = Array.from(new Set(data.map(item => item.completed_by).filter(Boolean)));
      let avatarMap: { [name: string]: string } = {};

      if (completedNames.length > 0) {
        const { data: staffData } = await supabase
          .from('staff')
          .select('staff_name, first_name, avatar_url')
          .in('staff_name', completedNames);

        (staffData || []).forEach((s: any) => {
          if (s.avatar_url) avatarMap[s.staff_name] = s.avatar_url;
        });
      }

      const formattedTasks: SopItem[] = data.map(item => {
        const isToday = item.completed_at && new Date(item.completed_at).toDateString() === todayStr;
        const completedName = isToday ? item.completed_by : null;

        return {
          ...item,
          is_completed: isToday ? Boolean(item.is_completed) : false,
          completed_by: completedName,
          completed_at: isToday ? item.completed_at : null,
          completed_by_avatar: completedName ? avatarMap[completedName] : undefined,
        };
      });

      setTasks(formattedTasks);
    }
    setLoading(false);
  };

  const toggleTask = async (id: number, currentStatus: boolean) => {
    if (currentStatus && !isManagementOrOwner) {
      alert('🔒 SOP yang sudah diselesaikan tidak dapat dibatalkan oleh Staf. Harap hubungi Management atau Owner.');
      return;
    }

    const nextStatus = !currentStatus;
    const actorName = currentUser?.name || 'Staf On-Duty';
    const actorAvatar = currentUser?.avatar_url;

    setTasks(prev =>
      prev.map(t => (t.id === id ? {
        ...t,
        is_completed: nextStatus,
        completed_by: nextStatus ? actorName : null,
        completed_by_avatar: nextStatus ? actorAvatar : null,
      } : t))
    );

    const { error } = await supabase
      .from('sop_checklists')
      .update({
        is_completed: nextStatus,
        completed_by: nextStatus ? actorName : null,
        completed_at: nextStatus ? new Date().toISOString() : null,
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating task:', error.message);
      fetchSopTasks();
    }
  };

  // 🌟 FUNGSI PENUTUP MODAL DENGAN ANIMASI OUT
  const handleCloseModal = () => {
    setIsClosingModal(true);
    setTimeout(() => {
      setIsAddModalOpen(false);
      setIsClosingModal(false);
      setNewTaskName('');
    }, 200); // Sesuai durasi animasi out CSS (200ms)
  };

  const handleOpenModal = () => {
    setIsClosingModal(false);
    setIsAddModalOpen(true);
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskName.trim()) return;

    setIsSubmitting(true);
    const { error } = await supabase.from('sop_checklists').insert([
      {
        task_name: newTaskName.trim(),
        category: newCategory,
        shift: newShift,
        is_completed: false,
      },
    ]);

    setIsSubmitting(false);

    if (error) {
      alert('Gagal menambahkan SOP: ' + error.message);
    } else {
      handleCloseModal();
      fetchSopTasks();
    }
  };

  const handleDeleteTask = async (id: number, taskName: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm(`Apakah Anda yakin ingin menghapus SOP "${taskName}"?`)) return;

    const { error } = await supabase
      .from('sop_checklists')
      .delete()
      .eq('id', id);

    if (error) {
      alert('Gagal menghapus SOP: ' + error.message);
    } else {
      fetchSopTasks();
    }
  };

  const morningTasks = tasks.filter(t => (t.shift || '').toLowerCase().includes('morning'));
  const nightTasks = tasks.filter(t => (t.shift || '').toLowerCase().includes('night'));

  const renderTaskList = (taskList: SopItem[], titleLabel?: string) => (
    <div className="space-y-2.5">
      {titleLabel && (
        <div className="pt-2 pb-1">
          <span className="text-xs font-black tracking-wider uppercase text-neutral-400 bg-neutral-100 px-3 py-1 rounded-lg">
            {titleLabel}
          </span>
        </div>
      )}
      {taskList.map((task, index) => {
        const isLockedForStaff = task.is_completed && !isManagementOrOwner;

        return (
          <div
            key={task.id}
            onClick={() => toggleTask(task.id, task.is_completed)}
            style={{ animationDelay: `${index * 45}ms` }}
            className={`sop-item-fade p-3.5 rounded-2xl border transition duration-200 flex items-center justify-between gap-3 group ${
              isLockedForStaff
                ? 'cursor-not-allowed bg-neutral-50/80 border-neutral-200 opacity-80'
                : 'cursor-pointer ' + (task.is_completed ? 'bg-neutral-50 border-neutral-200' : 'bg-white border-neutral-200 hover:border-[#d22027]')
            }`}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <input
                type="checkbox"
                checked={task.is_completed}
                disabled={isLockedForStaff}
                onChange={() => {}}
                className={`w-4 h-4 accent-[#d22027] rounded shrink-0 ${
                  isLockedForStaff ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                }`}
              />
              <div className="min-w-0">
                <p
                  className={`text-xs font-bold truncate transition-all duration-300 ${
                    task.is_completed ? 'line-through text-neutral-400' : 'text-[#111111]'
                  }`}
                >
                  {task.task_name}
                </p>
                <p className="text-[10px] text-neutral-400 flex items-center gap-1.5 flex-wrap mt-0.5">
                  <span className="font-bold text-neutral-600">{task.category?.replace(/_/g, ' ')}</span>
                  <span>•</span>
                  <span className="uppercase font-medium">{task.shift}</span>
                  {task.completed_by && (
                    <span className="text-emerald-600 font-semibold flex items-center gap-1 ml-1">
                      • Oleh: 
                      {task.completed_by_avatar ? (
                        <img
                          src={task.completed_by_avatar}
                          alt={task.completed_by}
                          className="w-3.5 h-3.5 rounded-full object-cover inline-block"
                        />
                      ) : null}
                      <strong>{task.completed_by}</strong>
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {task.is_completed && (
                <span className="text-[9px] bg-emerald-50 text-emerald-600 font-semibold px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1">
                  Selesai {isLockedForStaff && <span title="Terkunci untuk staf biasa">🔒</span>}
                </span>
              )}

              {isManagementOrOwner && (
                <button
                  onClick={e => handleDeleteTask(task.id, task.task_name, e)}
                  className="p-1 text-neutral-300 hover:text-red-500 rounded-lg transition opacity-0 group-hover:opacity-100 cursor-pointer"
                  title="Hapus SOP"
                >
                  🗑️
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="bg-white rounded-3xl p-5 border border-neutral-200 shadow-sm mb-8 text-left relative">
      {/* 🌟 KEYFRAMES ANIMASI IN & OUT MODAL TERPISAH */}
      <style>{`
        @keyframes sopItemSlideUp {
          0% {
            opacity: 0;
            transform: translateY(12px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes modalOverlayIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes modalOverlayOut {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes modalBoxIn {
          0% {
            opacity: 0;
            transform: scale(0.92) translateY(10px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        @keyframes modalBoxOut {
          0% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
          100% {
            opacity: 0;
            transform: scale(0.92) translateY(10px);
          }
        }

        .sop-item-fade {
          animation: sopItemSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }
        .modal-backdrop-in {
          animation: modalOverlayIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .modal-backdrop-out {
          animation: modalOverlayOut 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .modal-box-in {
          animation: modalBoxIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .modal-box-out {
          animation: modalBoxOut 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 pb-3 border-b border-neutral-100">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[#111111]">
              {isFullView
                ? 'Semua Master Checklist SOP'
                : `Checklist SOP ${currentShift === 'morning' ? 'Opening' : 'Closing'}`}
            </h2>
            <span className="text-[10px] bg-red-50 text-[#d22027] font-bold px-2.5 py-0.5 rounded-full border border-red-100 uppercase transition-all duration-300">
              {isFullView ? 'All Shifts' : currentShift}
            </span>
            <span className="text-[9px] bg-emerald-50 text-emerald-600 font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
              ● Realtime Sync
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 mt-0.5">
            {tasks.filter(t => t.is_completed).length} dari {tasks.length} tugas terselesaikan
          </p>
        </div>

        {isManagementOrOwner && (
          <button
            onClick={handleOpenModal}
            className="px-3.5 py-1.5 bg-[#111111] hover:bg-neutral-800 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-sm"
          >
            <span>➕</span> Tambah SOP
          </button>
        )}
      </div>

      <div className={`transition-all duration-200 ease-out ${isSwitchingShift ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'}`}>
        {loading ? (
          <div className="py-8 text-center text-xs text-neutral-400 animate-pulse">
            Memuat tugas SOP dari database...
          </div>
        ) : errorMessage ? (
          <div className="py-8 text-center text-xs text-red-500 font-bold">
            ⚠️ Gagal memuat data: {errorMessage}
          </div>
        ) : tasks.length === 0 ? (
          <div className="py-8 text-center text-xs text-neutral-400">
            Belum ada daftar SOP untuk shift ini.
          </div>
        ) : isFullView ? (
          <div className="space-y-6">
            {morningTasks.length > 0 && renderTaskList(morningTasks, '☀️ Morning Shift (Opening)')}
            {nightTasks.length > 0 && renderTaskList(nightTasks, '🌙 Night Shift (Closing)')}
          </div>
        ) : (
          renderTaskList(tasks)
        )}
      </div>

      {/* 🌟 MODAL TAMBAH SOP DENGAN ANIMASI IN & OUT LENGKAP */}
      {isAddModalOpen && createPortal(
        <div
          onClick={handleCloseModal}
          className={`fixed inset-0 bg-black/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 ${
            isClosingModal ? 'modal-backdrop-out' : 'modal-backdrop-in'
          }`}
        >
          <div
            onClick={e => e.stopPropagation()}
            className={`bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-neutral-100 text-left my-auto ${
              isClosingModal ? 'modal-box-out' : 'modal-box-in'
            }`}
          >
            <h3 className="text-base font-black text-[#111111] mb-1">Tambah Tugas SOP Baru</h3>
            <p className="text-xs text-neutral-400 mb-4">Masukkan tugas operasional baru untuk tim.</p>

            <form onSubmit={handleAddTask} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-neutral-600 mb-1">Nama Tugas SOP</label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Clean & Descale Grinder"
                  value={newTaskName}
                  onChange={e => setNewTaskName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:outline-none focus:border-[#d22027]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-600 mb-1">Kategori / Divisi</label>
                  <select
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:outline-none focus:border-[#d22027] cursor-pointer"
                  >
                    <option value="Bar">Barista / Bar</option>
                    <option value="Kasir">Cashier / Floor</option>
                    <option value="Kitchen">Kitchen / Cook</option>
                    <option value="General">General / Operasional</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-600 mb-1">Shift Target</label>
                  <select
                    value={newShift}
                    onChange={e => setNewShift(e.target.value as 'morning' | 'night')}
                    className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:outline-none focus:border-[#d22027] cursor-pointer"
                  >
                    <option value="morning">Morning (Opening)</option>
                    <option value="night">Night (Closing)</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-[#d22027] hover:bg-[#bb2026] text-white rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Simpan...' : 'Simpan SOP'}
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