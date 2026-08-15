import React, { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import Portal from './Portal';

interface ImageLightboxProps {
  imageUrl: string;
  onClose: () => void;
}

const ImageLightbox: React.FC<ImageLightboxProps> = ({ imageUrl, onClose }) => {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
        onClick={onClose}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
        >
          <X size={24} className="text-white" />
        </button>

        <img
          src={imageUrl}
          alt="Slide full resolution"
          className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </Portal>
  );
};

export default ImageLightbox;
