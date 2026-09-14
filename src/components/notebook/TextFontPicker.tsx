import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { createPortal } from 'react-dom';
import {
  PANVAS_TEXT_FONT_FAMILIES,
  TEXT_FONT_GROUPS,
  UI_FONT_FAMILY,
  fontLabel,
  fontOptionStyle,
  loadTextFont,
  type FontAvailability,
} from './textFonts';

export function TextFontPicker({ value, onChange, ariaLabel = 'Text font', className = '' }: {
  value: string;
  onChange: (font: string) => void;
  ariaLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [availability, setAvailability] = useState<Record<string, FontAvailability>>(() =>
    Object.fromEntries(PANVAS_TEXT_FONT_FAMILIES.map(font => [font, 'loading'])),
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const current = value || 'Inter, sans-serif';

  useEffect(() => {
    let active = true;
    PANVAS_TEXT_FONT_FAMILIES.forEach(font => {
      void loadTextFont(font).then(state => { if (active) setAvailability(previous => ({ ...previous, [font]: state })); });
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (rect) setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - 248)), top: Math.max(12, Math.min(rect.bottom + 6, window.innerHeight - 300)) });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node) && !listRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => { document.removeEventListener('pointerdown', close); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open]);

  // Keep the catalog stable while faces load. Filtering failed faces reduced
  // an offline/error state to a misleading three-font list.
  const visibleFonts = useMemo(() => [...PANVAS_TEXT_FONT_FAMILIES], []);
  const focusOption = (index: number) => optionRefs.current[Math.max(0, Math.min(visibleFonts.length - 1, index))]?.focus();
  const openAndFocus = (direction: 1 | -1) => {
    setOpen(true);
    requestAnimationFrame(() => focusOption(direction > 0 ? 0 : visibleFonts.length - 1));
  };
  const currentAvailability = availability[current] ?? 'unavailable';

  return <div ref={rootRef} className={`relative min-w-0 ${className}`} style={{ fontFamily: UI_FONT_FAMILY }} data-notebook-navigation-ignore="true">
    <button
      type="button"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-label={ariaLabel}
      onMouseDown={event => event.preventDefault()}
      onClick={() => setOpen(previous => !previous)}
      onKeyDown={event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          openAndFocus(event.key === 'ArrowDown' ? 1 : -1);
        }
      }}
      className="flex h-8 w-full items-center justify-between gap-2 rounded-md border border-panvas-border-default bg-panvas-bg-primary px-2.5 text-left text-xs text-panvas-text-primary hover:bg-panvas-bg-hover focus-ring"
      style={{ fontFamily: UI_FONT_FAMILY }}
    >
      <span className="min-w-0 truncate">
        <span style={fontOptionStyle(current, currentAvailability)}>{fontLabel(current)}</span>
        {currentAvailability !== 'loaded' && <span className="ml-1 text-[9px] text-panvas-text-tertiary">{currentAvailability === 'loading' ? 'loading' : 'unavailable'}</span>}
      </span>
      <ChevronDown size={13} className={`shrink-0 text-panvas-text-tertiary transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && createPortal(<div ref={listRef} role="listbox" aria-label={ariaLabel} onMouseDown={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()} className="panvas-overlay panvas-layer-system fixed max-h-72 w-[236px] overflow-y-auto rounded-lg border border-panvas-border-strong bg-panvas-bg-primary p-1.5 shadow-xl" style={{ ...position, fontFamily: UI_FONT_FAMILY }}>
      {TEXT_FONT_GROUPS.map(group => {
        const fonts = group.fonts.filter(font => visibleFonts.includes(font));
        if (fonts.length === 0) return null;
        return <div key={group.label} className="mb-1 last:mb-0">
          <div className="px-2 pb-1 pt-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-panvas-text-tertiary" style={{ fontFamily: group.fontFamily }}>{group.label}</div>
          {fonts.map(font => {
            const flatIndex = visibleFonts.indexOf(font);
            const selected = current === font;
            const state = availability[font] ?? 'loading';
            return <button
              ref={node => { optionRefs.current[flatIndex] = node; }}
              key={font}
              type="button"
              role="option"
              aria-selected={selected}
              aria-disabled={state !== 'loaded'}
              onMouseDown={event => event.preventDefault()}
              onClick={() => {
                if (state !== 'loaded') return;
                onChange(font === 'Inter, sans-serif' ? '' : font);
                setOpen(false);
              }}
              onKeyDown={event => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault();
                  focusOption(flatIndex + (event.key === 'ArrowDown' ? 1 : -1));
                } else if (event.key === 'Home' || event.key === 'End') {
                  event.preventDefault();
                  focusOption(event.key === 'Home' ? 0 : visibleFonts.length - 1);
                } else if (event.key === 'Escape') {
                  event.preventDefault();
                  setOpen(false);
                }
              }}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors focus-ring ${selected ? 'bg-panvas-accent-blue/10 text-panvas-accent-blue' : 'text-panvas-text-primary hover:bg-panvas-bg-hover'} ${state !== 'loaded' ? state === 'loading' ? 'cursor-wait opacity-60' : 'cursor-not-allowed opacity-60' : ''}`}
              style={{ fontFamily: UI_FONT_FAMILY }}
            >
              <span className="w-4 shrink-0">{selected && <Check size={13} />}</span>
              <span className="truncate text-[15px] leading-5" style={fontOptionStyle(font, state)}>{fontLabel(font)}</span>
              {state === 'loading' && <span className="ml-auto text-[9px] text-panvas-text-tertiary" style={{ fontFamily: UI_FONT_FAMILY }}>Loading</span>}
              {state === 'unavailable' && <span className="ml-auto text-[9px] text-panvas-text-tertiary" style={{ fontFamily: UI_FONT_FAMILY }}>Unavailable</span>}
            </button>;
          })}
        </div>;
      })}
    </div>, document.body)}
  </div>;
}
