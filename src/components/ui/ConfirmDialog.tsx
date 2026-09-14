import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ShieldCheck, X } from 'lucide-react';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'neutral';
  /** Allow the sheet to be dismissed while a long-running, safe operation continues. */
  dismissibleWhileSubmitting?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

/**
 * The shared destructive-action dialog. The parent owns open/close state so a
 * dismissed dialog cannot accidentally resume an operation on a later render.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  dismissibleWhileSubmitting = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const confirmingRef = useRef(false);
  const isSubmittingRef = useRef(false);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) {
      confirmingRef.current = false;
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      return;
    }

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (!isSubmittingRef.current || dismissibleWhileSubmitting) onCancel();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
      ));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    cancelButtonRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      previouslyFocused?.focus();
    };
  }, [dismissibleWhileSubmitting, onCancel, open]);

  if (!open) return null;

  const handleConfirm = async () => {
    if (confirmingRef.current) return;
    confirmingRef.current = true;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      await onConfirm();
    } catch (error) {
      confirmingRef.current = false;
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      console.error('[Panvas] Confirmation action failed:', error);
      return;
    }
    confirmingRef.current = false;
    isSubmittingRef.current = false;
    setIsSubmitting(false);
  };

  return (
    <div
      className="panvas-layer-modal fixed inset-0 flex items-center justify-center p-4 max-[599px]:p-2"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget && !isSubmitting) onCancel();
      }}
    >
      <section
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="panvas-confirm-dialog-title"
        aria-describedby="panvas-confirm-dialog-description"
        className="panvas-dialog relative max-h-[calc(100dvh-1rem)] w-full max-w-md overflow-y-auto p-5"
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting && !dismissibleWhileSubmitting}
          aria-label="Close dialog"
          className="absolute right-3.5 top-3.5 flex h-7 w-7 items-center justify-center rounded-md text-panvas-text-tertiary transition-colors hover:bg-panvas-bg-hover hover:text-panvas-text-primary focus-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X size={15} aria-hidden="true" />
        </button>
        <div className="flex items-start gap-3 pr-7">
          <div className={tone === 'neutral'
            ? 'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-panvas-accent-blue/25 bg-panvas-accent-blue/10 text-panvas-accent-blue'
            : 'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-panvas-accent-rose/25 bg-panvas-accent-rose/10 text-panvas-accent-rose'}>
            {tone === 'neutral' ? <ShieldCheck size={17} aria-hidden="true" /> : <AlertTriangle size={17} aria-hidden="true" />}
          </div>
          <div>
            <h2 id="panvas-confirm-dialog-title" className="text-sm font-semibold text-panvas-text-primary">{title}</h2>
            <p id="panvas-confirm-dialog-description" className="mt-1.5 text-xs leading-5 text-panvas-text-secondary">{description}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            disabled={isSubmitting && !dismissibleWhileSubmitting}
            className="h-8 rounded-md px-3 text-xs font-medium text-panvas-text-secondary transition-colors hover:bg-panvas-bg-hover hover:text-panvas-text-primary focus-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={isSubmitting}
            className={tone === 'neutral'
              ? 'h-8 rounded-md bg-panvas-accent-blue px-3 text-xs font-medium text-white transition-opacity hover:opacity-90 focus-ring disabled:cursor-not-allowed disabled:opacity-50'
              : 'h-8 rounded-md bg-panvas-accent-rose px-3 text-xs font-medium text-white transition-opacity hover:opacity-90 focus-ring disabled:cursor-not-allowed disabled:opacity-50'}
          >
            {isSubmitting ? 'Working…' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
