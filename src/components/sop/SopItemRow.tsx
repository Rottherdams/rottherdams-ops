import React from 'react';

export interface SopItem {
  id: number;
  shift: string;
  task_name: string;
  category: string;
  is_completed: boolean;
  completed_by?: string | null;
  completed_at?: string | null;
  completed_by_avatar?: string | null;
}

interface SopItemRowProps {
  task: SopItem;
  index: number;
  isManagementOrOwner: boolean;
  onToggle: (id: number, currentStatus: boolean) => void;
  onDelete: (id: number, taskName: string, e: React.MouseEvent) => void;
}

export default function SopItemRow({
  task,
  index,
  isManagementOrOwner,
  onToggle,
  onDelete,
}: SopItemRowProps) {
  const isLockedForStaff = task.is_completed && !isManagementOrOwner;

  return (
    <div
      onClick={() => onToggle(task.id, task.is_completed)}
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
            onClick={e => onDelete(task.id, task.task_name, e)}
            className="p-1 text-neutral-300 hover:text-red-500 rounded-lg transition opacity-0 group-hover:opacity-100 cursor-pointer"
            title="Hapus SOP"
          >
            🗑️
          </button>
        )}
      </div>
    </div>
  );
}