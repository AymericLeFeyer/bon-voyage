import type { Flight } from '@shared/types/trip';
import type { FlightSide } from '@/domain/trip/services/tripMutations';
import type { TravelCopy } from '@/shared/constants/travel';
import { formatLongDate } from '@/shared/lib/date';
import { DetailHeader, InfoLine, NoteText } from './parts';

interface FlightDetailProps {
  side: FlightSide;
  flight: Flight;
  /** Libellés du mode de trajet du voyage (avion ou train). */
  copy: TravelCopy;
  onFocus?: () => void;
  onClose?: () => void;
}

/** Vue détail (lecture seule) d'un trajet aller/retour. */
export function FlightDetail({ side, flight, copy, onFocus, onClose }: FlightDetailProps) {
  return (
    <div className="flex min-h-0 flex-col">
      <DetailHeader title={<span>{copy.title[side]}</span>} onFocus={onFocus} onClose={onClose} />

      <div className="flex-1 space-y-3 overflow-y-auto p-4 scroll-thin">
        <div className="space-y-1">
          <InfoLine label={copy.hubShort}>{flight.airport}</InfoLine>
          <InfoLine label="Date">{formatLongDate(flight.date)}</InfoLine>
        </div>

        {flight.legs.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">{copy.segmentsTitle}</h3>
            {flight.legs.map((leg, index) => (
              <div key={leg.id} className="rounded-lg border border-border p-2.5 text-sm">
                <div className="font-medium">
                  {leg.flightNumber || `Segment ${index + 1}`}
                </div>
                {(leg.from || leg.to) && (
                  <div className="text-muted-foreground">
                    {[leg.from, leg.to].filter(Boolean).join(' → ')}
                  </div>
                )}
                {(leg.departureTime || leg.arrivalTime) && (
                  <div className="text-muted-foreground">
                    {[leg.departureTime, leg.arrivalTime].filter(Boolean).join(' – ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <InfoLine label="Prix">
          {flight.price != null && `${flight.price}${flight.currency ?? '€'}`}
        </InfoLine>
        <NoteText>{flight.notes}</NoteText>
      </div>
    </div>
  );
}
