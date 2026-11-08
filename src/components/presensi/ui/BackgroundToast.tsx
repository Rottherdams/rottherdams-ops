import type { ToastState } from '../../../lib/hooks/useBackgroundRotator';

interface BackgroundToastProps {
  toast: ToastState;
}

export default function BackgroundToast({ toast }: BackgroundToastProps) {
  if (!toast.show) return null;

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[10001] toast-in pointer-events-none">
      <div
        className={`px-4 py-2.5 rounded-2xl shadow-xl text-xs font-bold border backdrop-blur-md flex items-center gap-2 ${
          toast.type === 'success'
            ? 'bg-emerald-500/95 text-white border-emerald-400'
            : toast.type === 'error'
            ? 'bg-[#d22027]/95 text-white border-red-500'
            : 'bg-neutral-900/95 text-white border-neutral-700'
        }`}
      >
        <span>{toast.type === 'success' ? '✅' : toast.type === 'error' ? '⚠️' : 'ℹ️'}</span>
        <span>{toast.message}</span>
      </div>
    </div>
  );
}