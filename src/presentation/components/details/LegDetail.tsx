import {
  ArrowRight,
  CalendarDays,
  CircleDot,
  Clock,
  Hash,
  MapPin,
  Route,
  Ruler,
  Wallet,
} from 'lucide-react';
import type { Stage } from '@shared/types/trip';
import { TRANSPORT_MODES } from '@/shared/constants/catalog';
import { formatLongDate } from '@/shared/lib/date';
import { formatAmount } from '@/shared/constants/currency';
import { DetailHeader, IconLine, NoteText } from './parts';

interface LegDetailProps {
  stage: Stage;
  nextStage?: Stage;
  onFocus?: () => void;
  onClose?: () => void;
}

/** Vue détail (lecture seule) d'un trajet entre deux étapes. */
export function LegDetail({ stage, nextStage, onFocus, onClose }: LegDetailProps) {
  const leg = stage.transportToNext;
  if (!leg) return null;
  const mode = TRANSPORT_MODES[leg.mode];

  return (
    <div className="flex min-h-0 flex-col">
      <DetailHeader
        onFocus={onFocus}
        onClose={onClose}
        title={
          <>
            <span className="text-lg">{mode.emoji}</span>
            <span className="truncate">{stage.name}</span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{nextStage?.name ?? '…'}</span>
          </>
        }
      />

      <div className="flex-1 space-y-2 overflow-y-auto p-4 scroll-thin">
        <IconLine icon={Route} title="Transport">{mode.label}</IconLine>
        <IconLine icon={CircleDot} title="Départ">{leg.from}</IconLine>
        <IconLine icon={MapPin} title="Arrivée">{leg.to}</IconLine>
        <IconLine icon={CalendarDays} title="Date">{formatLongDate(leg.date)}</IconLine>
        <IconLine icon={Clock} title="Horaires">
          {[leg.departureTime, leg.arrivalTime].filter(Boolean).join(' – ')}
        </IconLine>
        <IconLine icon={Ruler} title="Distance">
          {leg.distanceKm != null && `${leg.distanceKm} km`}
        </IconLine>
        <IconLine icon={Hash} title="Référence">{leg.reference}</IconLine>
        <IconLine icon={Wallet} title="Prix">
          {leg.price != null && formatAmount(leg.price, leg.currency)}
        </IconLine>
        <NoteText>{leg.notes}</NoteText>
      </div>
    </div>
  );
}
