import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, X } from 'lucide-react';

export interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'warning';
  onClose: () => void;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose, duration = 3000 }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));

    const timer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(onClose, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(onClose, 300);
  };

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border backdrop-blur-sm transition-all duration-300 ${
        isVisible && !isLeaving
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-2'
      } ${
        type === 'success'
          ? 'bg-white/95 border-emerald-200 text-emerald-800'
          : type === 'warning'
          ? 'bg-white/95 border-amber-200 text-amber-800'
          : 'bg-white/95 border-red-200 text-red-800'
      }`}
    >
      {type === 'success' ? (
        <CheckCircle size={20} className="text-emerald-500 flex-shrink-0" />
      ) : type === 'warning' ? (
        <AlertTriangle size={20} className="text-amber-500 flex-shrink-0" />
      ) : (
        <XCircle size={20} className="text-red-500 flex-shrink-0" />
      )}
      <span className="text-sm font-medium">{message}</span>
      <button
        onClick={handleClose}
        className={`p-1 rounded-md transition-colors ${
          type === 'success' ? 'hover:bg-emerald-100' : type === 'warning' ? 'hover:bg-amber-100' : 'hover:bg-red-100'
        }`}
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default Toast;
