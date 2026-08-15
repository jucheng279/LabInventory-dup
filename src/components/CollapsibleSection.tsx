import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  defaultOpen = true,
  headerRight,
  children,
  className = '',
  contentClassName = '',
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (contentRef.current) {
      const resizeObserver = new ResizeObserver(() => {
        if (contentRef.current) {
          setContentHeight(contentRef.current.offsetHeight);
        }
      });
      resizeObserver.observe(contentRef.current);
      return () => resizeObserver.disconnect();
    }
  }, []);

  return (
    <div className={`bg-white rounded-2xl border border-gray-200 overflow-hidden ${className}`} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors flex-shrink-0"
      >
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <div className="flex items-center gap-2">
          {headerRight && (
            <div onClick={(e) => e.stopPropagation()}>
              {headerRight}
            </div>
          )}
          <ChevronDown
            className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>
      <div
        className="transition-all duration-200 ease-in-out overflow-hidden"
        style={{
          maxHeight: isOpen ? (contentHeight || 9999) : 0,
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div
          ref={contentRef}
          data-collapsible-content
          className={`px-6 pb-6 ${contentClassName}`}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default CollapsibleSection;
