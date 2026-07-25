import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import type { LatLng, TravelMode, Trip } from '@shared/types/trip';
import type { GeoSuggestion } from '@/infrastructure/geocoding/nominatim';
import { tripRepository } from '@/infrastructure/trip/HttpTripRepository';
import { flagEmoji } from '@/shared/lib/flag';
import { shortPlaceLabel } from '@/shared/lib/place';
import { AddressAutocomplete } from '@/presentation/components/AddressAutocomplete';
import { Modal } from '@/presentation/components/ui/Modal';
import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';
import { Field } from '@/presentation/components/ui/Field';
import { EmojiPicker } from './EmojiPicker';
import { TravelModePicker } from './TravelModePicker';

interface NewTripModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (trip: Trip) => void;
}

/**
 * Création d'un voyage : on demande le nom, la destination, un emoji (drapeau
 * du pays) et le mode de trajet aller/retour (avion, train ou non défini).
 */
export function NewTripModal({ open, onClose, onCreated }: NewTripModalProps) {
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [location, setLocation] = useState<LatLng | undefined>(undefined);
  const [emoji, setEmoji] = useState('');
  const [travelMode, setTravelMode] = useState<TravelMode>('plane');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setDestination('');
    setLocation(undefined);
    setEmoji('');
    setTravelMode('plane');
    setError(null);
  }, [open]);

  const handleSelect = (s: GeoSuggestion) => {
    const label = shortPlaceLabel(s.label);
    setDestination(label);
    setLocation(s.location);
    // Le drapeau du pays sert d'emoji par défaut — modifiable juste à côté.
    const flag = flagEmoji(s.countryCode);
    if (flag) setEmoji(flag);
    // Titre encore vide : la destination fait un intitulé correct par défaut.
    setTitle((current) => (current.trim() ? current : label));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const trip = await tripRepository.create({
        title: title.trim(),
        emoji: emoji.trim() || undefined,
        destination: destination.trim() || undefined,
        destinationLocation: location,
        travelMode,
        stages: [],
      });
      onCreated(trip);
    } catch {
      setError('La création a échoué. Réessayez.');
      setCreating(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} className="w-full max-w-md">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 className="text-lg font-semibold">Nouveau voyage</h2>
        <Button variant="ghost" size="icon" onClick={onClose} title="Fermer">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* min-h : laisse la place à la liste de suggestions (le corps est scrollable). */}
      <form onSubmit={submit} className="min-h-[380px] flex-1 space-y-4 overflow-y-auto p-5">
        <Field label="Destination">
          <AddressAutocomplete
            value={destination}
            placeholder="Japon, Lisbonne, Sicile…"
            onChange={(text) => {
              setDestination(text);
              setLocation(undefined);
            }}
            onSelect={handleSelect}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Sert à centrer la carte et à proposer le drapeau du pays.
          </p>
        </Field>

        <Field label="Nom du voyage">
          <div className="flex items-start gap-2">
            <EmojiPicker value={emoji} onChange={setEmoji} />
            <Input
              value={title}
              placeholder="Road trip en Sicile"
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
        </Field>

        <Field label="Trajet aller / retour">
          <TravelModePicker value={travelMode} onChange={setTravelMode} />
        </Field>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={creating}>
            Annuler
          </Button>
          <Button type="submit" disabled={!title.trim() || creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Créer le voyage
          </Button>
        </div>
      </form>
    </Modal>
  );
}
