import { ReactNode } from 'react';
import Portal from './Portal';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface ModalFrameProps {
  children: ReactNode;
  onClose: () => void;
  maxWidth?: string;
  allowOverflow?: boolean;
}

export default function ModalFrame({ children, onClose, maxWidth = 'max-w-md', allowOverflow = false }: ModalFrameProps) {
  useEscapeKey(onClose);

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
          onClick={onClose}
        />
        <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${maxWidth} ${allowOverflow ? 'max-h-[90vh] flex flex-col overflow-hidden' : 'overflow-hidden'} animate-scale-in`}>
          {children}
        </div>
      </div>
    </Portal>
  );
}
