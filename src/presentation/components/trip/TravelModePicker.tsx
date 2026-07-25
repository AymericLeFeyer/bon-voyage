import type { TravelMode } from '@shared/types/trip';
import { TRAVEL_MODE_OPTIONS } from '@/shared/constants/travel';
import { cn } from '@/shared/lib/cn';

interface TravelModePickerProps {
  value: TravelMode;
  onChange: (mode: TravelMode) => void;
}

/**
 * Choix du trajet aller/retour du voyage : avion, train, ou non défini.
 * « Non défini » masque complètement les entrées aller/retour dans l'app.
 */
export function TravelModePicker({ value, onChange }: TravelModePickerProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {TRAVEL_MODE_OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={cn(
              'flex flex-col items-center gap-0.5 rounded-lg border px-2 py-2.5 text-center transition-colors',
              active ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted',
            )}
          >
            <span className="text-lg leading-none">{option.emoji}</span>
            <span className="text-sm font-medium">{option.label}</span>
            <span className="text-[11px] leading-tight text-muted-foreground">{option.hint}</span>
          </button>
        );
      })}
    </div>
  );
}
