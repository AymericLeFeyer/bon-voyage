import type { ReactNode } from 'react';
import {
  CalendarDays,
  ChevronRight,
  Clock,
  ExternalLink,
  KeyRound,
  Locate,
  MapPin,
  StickyNote,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { Accommodation, LatLng, Place } from '@shared/types/trip';
import { PLACE_CATEGORIES } from '@/shared/constants/catalog';
import { distanceLabel } from '@/shared/lib/geo';
import { formatLongDate, formatPlanned } from '@/shared/lib/date';
import { mapsSearchUrl } from '@/shared/lib/maps';
import { cn } from '@/shared/lib/cn';
import { formatAmount } from '@/shared/constants/currency';
import { Button } from '../ui/Button';

/** Bouton ouvrant Google Maps sur l'adresse/le nom (recherche, sans clé). */
export function MapsSearchButton({ query }: { query?: string }) {
  const q = query?.trim();
  if (!q) return null;
  return (
    <a
      href={mapsSearchUrl(q)}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-primary hover:bg-muted"
    >
      <MapPin className="h-3.5 w-3.5" /> Ouvrir dans Google Maps
    </a>
  );
}

/** Bouton « Focus » : recentre et zoome la carte sur l'élément. */
export function FocusButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon" title="Centrer sur la carte" onClick={onClick}>
      <Locate className="h-4 w-4 text-primary" />
    </Button>
  );
}

/** En-tête d'une vue détail dans la modale (titre + focus + fermeture). */
export function DetailHeader({
  title,
  onFocus,
  onClose,
}: {
  title: ReactNode;
  onFocus?: () => void;
  onClose?: () => void;
}) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
      <div className="flex min-w-0 items-center gap-2 font-semibold">{title}</div>
      <div className="flex shrink-0 items-center gap-1">
        {onFocus && <FocusButton onClick={onFocus} />}
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </header>
  );
}

/** Image d'illustration (lieu / étape) en lecture seule. `null` si absente. */
export function StageImage({ url, className }: { url?: string; className?: string }) {
  if (!url) return null;
  return (
    <img
      src={url}
      alt=""
      className={cn('h-44 w-full rounded-lg border border-border bg-muted object-cover', className)}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = 'none';
      }}
    />
  );
}

/** Badge du créneau prévu (jour + heure) d'un lieu. `null` si non planifié. */
export function PlannedBadge({ date, time }: { date?: string; time?: string }) {
  const label = formatPlanned(date, time);
  if (!label) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
      🕒 {label}
    </span>
  );
}

/** Badge mis en avant pour un lieu réservé (billet pris) — pour ne pas l'oublier. */
export function ReservedBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
      🎟️ Réservé
    </span>
  );
}

/** Formate un prix + devise pour l'affichage (défaut €). */
export function formatPrice(price?: number, currency?: string): string | null {
  if (price == null) return null;
  return formatAmount(price, currency);
}

/**
 * Bloc de texte libre (notes, description, modalités…) précédé d'une petite
 * icône, pour aérer les longs blocs en mode lecture. `null` si vide.
 */
export function NoteText({
  icon: Icon = StickyNote,
  children,
  className,
}: {
  icon?: LucideIcon;
  children?: ReactNode;
  className?: string;
}) {
  if (!children) return null;
  return (
    <div className={cn('flex gap-2 rounded-md border border-border p-2.5', className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

export function InfoLine({ label, children }: { label: string; children: ReactNode }) {
  if (!children) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 break-words">{children}</span>
    </div>
  );
}

/** Ligne d'info préfixée d'une petite icône (remplace le libellé texte). `null` si vide. */
export function IconLine({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  /** Info-bulle décrivant le champ (accessibilité). */
  title?: string;
  children: ReactNode;
}) {
  if (!children) return null;
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-label={title} />
      <span className="min-w-0 flex-1 break-words">{children}</span>
    </div>
  );
}

export function MapsLink({ url }: { url?: string }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-sm text-primary"
    >
      <ExternalLink className="h-3.5 w-3.5" /> Google Maps
    </a>
  );
}

/** Bloc hébergement en lecture seule (réutilisé modale + mobile). */
export function AccommodationBlock({ acc }: { acc: Accommodation }) {
  return (
    <div className="space-y-1 rounded-md bg-muted/50 p-2.5">
      <div className="text-sm font-medium">🛏️ {acc.name}</div>
      <IconLine icon={MapPin} title="Adresse">{acc.address}</IconLine>
      <IconLine icon={CalendarDays} title="Séjour">
        {[acc.checkInDate, acc.checkOutDate].filter(Boolean).map(formatLongDate).join(' → ')}
      </IconLine>
      <IconLine icon={Clock} title="Horaires">
        {[
          acc.arrivalTime && `arrivée ${acc.arrivalTime}`,
          acc.departureTime && `départ ${acc.departureTime}`,
        ]
          .filter(Boolean)
          .join(' · ')}
      </IconLine>
      <IconLine icon={Wallet} title="Prix">
        {acc.price != null && formatAmount(acc.price, acc.currency)}
      </IconLine>
      <NoteText icon={KeyRound}>{acc.modalities}</NoteText>
      <NoteText>{acc.notes}</NoteText>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <MapsSearchButton query={acc.address || acc.name} />
      </div>
    </div>
  );
}

/**
 * Ligne d'un lieu à visiter en lecture seule (réutilisée modale + mobile).
 * Si `onClick` est fourni, la ligne devient un bouton (ouvre la modale du lieu).
 */
export function PlaceLine({
  place,
  origin,
  selected,
  onClick,
}: {
  place: Place;
  /** Point de l'étape (hébergement) pour estimer la distance à vol d'oiseau. */
  origin?: LatLng | null;
  /** Lieu actuellement ouvert dans un tiroir enfant → surligné (bleu). */
  selected?: boolean;
  onClick?: () => void;
}) {
  const distance = distanceLabel(origin, place.location);
  const price = formatPrice(place.price, place.currency);
  const inner = (
    <>
      <div className="flex items-center gap-1.5">
        <span>{PLACE_CATEGORIES[place.category].emoji}</span>
        <span className={place.visited ? 'text-muted-foreground line-through' : ''}>
          {place.name}
        </span>
        {distance && (
          <span className="shrink-0 text-xs font-normal text-muted-foreground">· {distance}</span>
        )}
        {place.reserved && <ReservedBadge />}
        <PlannedBadge date={place.plannedDate} time={place.plannedTime} />
        {price && (
          <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
            {price}
          </span>
        )}
        {onClick && <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />}
      </div>
      {place.notes && <p className="mt-0.5 text-xs text-muted-foreground">{place.notes}</p>}
      {!onClick && <MapsLink url={place.googleMapsUrl} />}
    </>
  );

  const ring = selected
    ? 'border-primary bg-primary/5'
    : place.reserved
      ? 'border-amber-300 bg-amber-50/60 dark:border-amber-500/40 dark:bg-amber-500/5'
      : 'border-border';

  if (onClick) {
    return (
      <li>
        <button
          type="button"
          onClick={onClick}
          className={cn(
            'w-full rounded-md border p-2 text-left text-sm transition-colors',
            !selected && 'hover:bg-muted',
            ring,
          )}
        >
          {inner}
        </button>
      </li>
    );
  }

  return <li className={cn('rounded-md border p-2 text-sm', ring)}>{inner}</li>;
}
