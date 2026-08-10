import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';

interface OverlayManagerProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  placement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';
  offset?: { x: number; y: number };
}

export function OverlayManager({ 
  children, 
  isOpen, 
  onClose, 
  anchorRef, 
  placement = 'bottom-start',
  offset = { x: 0, y: 4 }
}: OverlayManagerProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: -9999, left: -9999 });

  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      if (!anchorRef.current || !overlayRef.current) return;
      
      const anchorRect = anchorRef.current.getBoundingClientRect();
      const overlayRect = overlayRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let top = 0;
      let left = 0;

      // Vertical placement
      if (placement.startsWith('bottom')) {
        top = anchorRect.bottom + offset.y;
        // Flip to top if not enough space below
        if (top + overlayRect.height > viewportHeight) {
          top = anchorRect.top - overlayRect.height - offset.y;
        }
      } else {
        top = anchorRect.top - overlayRect.height - offset.y;
        // Flip to bottom if not enough space above
        if (top < 0) {
          top = anchorRect.bottom + offset.y;
        }
      }

      // Horizontal placement
      if (placement.endsWith('start')) {
        left = anchorRect.left + offset.x;
        // Shift if overflowing right
        if (left + overlayRect.width > viewportWidth) {
          left = Math.max(10, viewportWidth - overlayRect.width - 10);
        }
      } else {
        left = anchorRect.right - overlayRect.width + offset.x;
        // Shift if overflowing left
        if (left < 0) {
          left = Math.max(10, anchorRect.left + offset.x);
        }
      }

      setPosition({ top, left });
    };

    // Need a micro-delay for first render dimensions
    requestAnimationFrame(updatePosition);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, anchorRef, placement, offset.x, offset.y]);

  useEffect(() => {
    if (!isOpen) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (
        overlayRef.current && 
        !overlayRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) return null;

  return createPortal(
    <div 
      ref={overlayRef}
      className="fixed z-[9999]"
      style={{
        top: position.top,
        left: position.left,
        visibility: position.top === -9999 ? 'hidden' : 'visible'
      }}
    >
      {children}
    </div>,
    document.body
  );
}
