import { useEffect } from 'react';
import { useStore } from '../store/useStore';

export function Toast() {
  const { toast, hideToast } = useStore();

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(hideToast, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast, hideToast]);

  if (!toast) return null;

  const isSuccess = toast.type === 'success';

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
      <div
        className={`achievement-toast px-4 py-3 flex items-center gap-3 ${
          isSuccess ? 'border-quest-complete' : 'border-red-500'
        }`}
        style={{
          borderColor: isSuccess ? '#4CAF50' : '#EF4444',
          boxShadow: isSuccess
            ? '0 0 20px rgba(76, 175, 80, 0.4)'
            : '0 0 20px rgba(239, 68, 68, 0.4)',
        }}
      >
        {/* Icon */}
        <span className="text-2xl">
          {isSuccess ? '✨' : '⚠️'}
        </span>

        {/* Message */}
        <span className="font-readable text-lg text-beige">{toast.message}</span>

        {/* Close button */}
        <button
          onClick={hideToast}
          className="ml-2 text-beige/60 hover:text-beige transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
