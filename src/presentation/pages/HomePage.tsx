import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Compass, Globe, Loader2, MailOpen, Plus, Trash2, Users, X } from 'lucide-react';
import type { TripSummary } from '@shared/types/trip';
import type { Invitation } from '@shared/types/user';
import { tripRepository } from '@/infrastructure/trip/HttpTripRepository';
import { membershipRepository } from '@/infrastructure/membership/HttpMembershipRepository';
import { BRAND } from '@/shared/constants/brand';
import { Button } from '@/presentation/components/ui/Button';
import { ThemeToggle } from '@/presentation/components/ThemeToggle';
import { UserMenu } from '@/presentation/components/UserMenu';

export function HomePage() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = () => {
    Promise.all([tripRepository.list(), membershipRepository.listInvitations()])
      .then(([t, inv]) => {
        setTrips(t);
        setInvitations(inv);
      })
      .catch(() => {
        setTrips([]);
        setInvitations([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const trip = await tripRepository.create();
      navigate(`/trip/${trip.id}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    await tripRepository.remove(id);
    setTrips((prev) => prev.filter((t) => t.id !== id));
  };

  const accept = async (tripId: string) => {
    await membershipRepository.acceptInvitation(tripId);
    setInvitations((prev) => prev.filter((i) => i.tripId !== tripId));
    load();
  };

  const decline = async (tripId: string) => {
    await membershipRepository.declineInvitation(tripId);
    setInvitations((prev) => prev.filter((i) => i.tripId !== tripId));
  };

  return (
    <div className="mx-auto min-h-full max-w-2xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Compass className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold">{BRAND.name}</h1>
            <p className="text-sm text-muted-foreground">{BRAND.tagline}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>

      {/* Invitations en attente */}
      {invitations.length > 0 && (
        <section className="mb-8 space-y-2">
          <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <MailOpen className="h-3.5 w-3.5" /> Invitations
          </h2>
          {invitations.map((inv) => (
            <div
              key={inv.tripId}
              className="flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{inv.tripTitle}</div>
                <div className="text-xs text-muted-foreground">
                  Invité par {inv.owner.name}
                </div>
              </div>
              <Button size="sm" onClick={() => void accept(inv.tripId)}>
                <Check className="h-3.5 w-3.5" /> Accepter
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void decline(inv.tripId)}>
                <X className="h-3.5 w-3.5" /> Refuser
              </Button>
            </div>
          ))}
        </section>
      )}

      <Button onClick={handleCreate} disabled={creating} className="mb-8">
        {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Nouveau voyage
      </Button>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </div>
      ) : trips.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Aucun voyage pour l'instant. Crée ton premier voyage !
        </p>
      ) : (
        <ul className="space-y-2">
          {trips.map((trip) => (
            <li
              key={trip.id}
              className="flex items-center gap-3 rounded-lg border border-border p-4 transition-colors hover:bg-muted"
            >
              <button
                className="min-w-0 flex-1 text-left"
                onClick={() => navigate(`/trip/${trip.id}`)}
              >
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{trip.title}</span>
                  {!trip.owned && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      <Users className="h-3 w-3" /> Partagé
                    </span>
                  )}
                  {trip.isPublic && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      <Globe className="h-3 w-3" /> Public
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {trip.stageCount} étape{trip.stageCount > 1 ? 's' : ''} · modifié le{' '}
                  {new Date(trip.updatedAt).toLocaleDateString('fr-FR')}
                </div>
              </button>
              {trip.owned && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-600"
                  onClick={() => handleDelete(trip.id)}
                  title="Supprimer"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
