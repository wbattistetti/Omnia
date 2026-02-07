import { X } from 'lucide-react';

type ToastProps = {
  message: string;
  onClose: () => void;
};

export function Toast({ message, onClose }: ToastProps) {
  return (
    <div className="fixed top-4 right-4 bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 max-w-md z-50 animate-slide-in">
      <p className="text-sm flex-1">{message}</p>
      <button onClick={onClose} className="flex-shrink-0 hover:bg-blue-700 rounded p-1">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
