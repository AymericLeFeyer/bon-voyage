import { useEffect, useRef, useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { Input } from '@/presentation/components/ui/Input';

/** Emojis proposés quand aucun drapeau n'a été déduit de la destination. */
const TRIP_EMOJIS = ['🌍', '✈️', '🏝️', '⛰️', '🗺️', '🎒', '🚗', '🚆'];

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
  className?: string;
}

/**
 * Petit bouton emoji du voyage : affiche l'emoji courant, ouvre une palette de
 * suggestions + un champ libre (l'emoji par défaut est le drapeau du pays).
 */
export function EmojiPicker({ value, onChange, className }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  return (
    <div ref={ref} className={cn('relative shrink-0', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Emoji du voyage"
        className="flex h-9 w-11 items-center justify-center rounded-md border border-border text-lg transition-colors hover:bg-muted"
      >
        {value || '🌍'}
      </button>

      {open && (
        <div className="absolute left-0 z-[1300] mt-1 w-56 space-y-2 rounded-md border border-border bg-card p-2 shadow-lg">
          <div className="flex flex-wrap gap-1">
            {TRIP_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-md border text-lg transition-colors hover:bg-muted',
                  value === emoji ? 'border-primary bg-primary/5' : 'border-border',
                )}
                onClick={() => {
                  onChange(emoji);
                  setOpen(false);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
          <Input
            value={value}
            maxLength={4}
            placeholder="Ou collez un emoji"
            className="text-center text-lg"
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
