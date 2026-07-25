import { useEffect, useState, type FormEvent } from 'react';
import { Copy, Globe, Loader2, Lock, MailCheck, Trash2, UserPlus, X } from 'lucide-react';
import type { Trip, TripAccess } from '@shared/types/trip';
import type { TripMembers } from '@shared/types/user';
import { membershipRepository } from '@/infrastructure/membership/HttpMembershipRepository';
import { HttpError } from '@/infrastructure/http/httpClient';
import { patchTrip } from '@/domain/trip/services/tripMutations';
import { shortPlaceLabel } from '@/shared/lib/place';
import { flagEmoji } from '@/shared/lib/flag';
import { resolveTravelMode } from '@/shared/constants/travel';
import { AddressAutocomplete } from '@/presentation/components/AddressAutocomplete';
import { Modal } from '@/presentation/components/ui/Modal';
import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';
import { Field } from '@/presentation/components/ui/Field';
import { Avatar } from '@/presentation/components/ui/Avatar';
import { EmojiPicker } from './EmojiPicker';
import { TravelModePicker } from './TravelModePicker';

interface TripSettingsModalProps {
  open: boolean;
  onClose: () => void;
  trip: Trip;
  access: TripAccess;
  onSetPublic: (isPublic: boolean) => Promise<void>;
  /** Édition du contenu (titre/emoji/destination) → autosave. */
  mutate: (updater: (trip: Trip) => Trip) => void;
  /** Suppression du voyage (propriétaire uniquement). */
  onDelete: () => void;
}

/** Réglages d'un voyage : identité, visibilité publique, participants, suppression. */
export function TripSettingsModal({
  open,
  onClose,
  trip,
  access,
  onSetPublic,
  mutate,
  onDelete,
}: TripSettingsModalProps) {
  const tripId = trip.id;
  const isPublic = trip.isPublic;
  const isOwner = access === 'owner';
  const canEdit = isOwner || access === 'editor';
  const [members, setMembers] = useState<TripMembers | null>(null);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [togglingPublic, setTogglingPublic] = useState(false);
  const [lastInvite, setLastInvite] = useState<{ url: string; emailSent: boolean } | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLastInvite(null);
    membershipRepository.getMembers(tripId).then(setMembers).catch(() => setMembers(null));
  }, [open, tripId]);

  const invite = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    setInviting(true);
    try {
      const res = await membershipRepository.invite(tripId, email.trim());
      setMembers(res.members);
      setLastInvite({ url: res.inviteUrl, emailSent: res.emailSent });
      setEmail('');
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Invitation impossible');
    } finally {
      setInviting(false);
    }
  };

  const removeMember = async (userId: string) => {
    await membershipRepository.removeMember(tripId, userId);
    setMembers((m) => (m ? { ...m, members: m.members.filter((u) => u.id !== userId) } : m));
  };

  const cancelInvite = async (inviteEmail: string) => {
    await membershipRepository.cancelInvite(tripId, inviteEmail);
    setMembers((m) =>
      m ? { ...m, pendingInvites: m.pendingInvites.filter((x) => x !== inviteEmail) } : m,
    );
  };

  const togglePublic = async () => {
    setTogglingPublic(true);
    try {
      await onSetPublic(!isPublic);
    } finally {
      setTogglingPublic(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} className="w-full max-w-lg">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 className="text-lg font-semibold">Paramètres du voyage</h2>
        <Button variant="ghost" size="icon" onClick={onClose} title="Fermer">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-5">
        {/* Identité du voyage : nom, emoji, destination */}
        {canEdit && (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Le voyage</h3>

            <Field label="Nom du voyage">
              <div className="flex items-start gap-2">
                <EmojiPicker
                  value={trip.emoji ?? ''}
                  onChange={(emoji) => mutate((t) => patchTrip(t, { emoji: emoji || undefined }))}
                />
                <Input
                  value={trip.title}
                  placeholder="Road trip en Sicile"
                  onChange={(e) => mutate((t) => patchTrip(t, { title: e.target.value }))}
                />
              </div>
            </Field>

            <Field label="Destination">
              <AddressAutocomplete
                value={trip.destination ?? ''}
                placeholder="Japon, Lisbonne, Sicile…"
                onChange={(text) =>
                  mutate((t) =>
                    patchTrip(t, { destination: text || undefined, destinationLocation: undefined }),
                  )
                }
                onSelect={(s) => {
                  const flag = flagEmoji(s.countryCode);
                  mutate((t) =>
                    patchTrip(t, {
                      destination: shortPlaceLabel(s.label),
                      destinationLocation: s.location,
                      // On ne remplace l'emoji que s'il n'a pas été choisi à la main.
                      emoji: t.emoji ?? flag,
                    }),
                  );
                }}
              />
            </Field>

            <Field label="Trajet aller / retour">
              <TravelModePicker
                value={resolveTravelMode(trip)}
                onChange={(travelMode) => mutate((t) => patchTrip(t, { travelMode }))}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                « Non défini » masque les entrées aller / retour du voyage.
              </p>
            </Field>
          </section>
        )}

        {/* Visibilité */}
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Visibilité</h3>
          <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
            <div className="flex items-start gap-2.5">
              {isPublic ? (
                <Globe className="mt-0.5 h-5 w-5 text-primary" />
              ) : (
                <Lock className="mt-0.5 h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <div className="text-sm font-medium">{isPublic ? 'Public' : 'Privé'}</div>
                <p className="text-xs text-muted-foreground">
                  {isPublic
                    ? 'Toute personne avec le lien peut consulter la vue affichage (sans les infos confidentielles).'
                    : 'Seuls les membres invités peuvent voir ce voyage.'}
                </p>
              </div>
            </div>
            {isOwner && (
              <Button variant="secondary" size="sm" onClick={togglePublic} disabled={togglingPublic}>
                {togglingPublic && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {isPublic ? 'Rendre privé' : 'Rendre public'}
              </Button>
            )}
          </div>
          {isPublic && (
            <button
              onClick={() => void navigator.clipboard?.writeText(window.location.href)}
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <Copy className="h-3 w-3" /> Copier le lien public
            </button>
          )}
        </section>

        {/* Participants */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Participants</h3>

          <form onSubmit={invite} className="flex gap-2">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemple.com"
            />
            <Button type="submit" disabled={inviting} className="shrink-0">
              {inviting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              Inviter
            </Button>
          </form>
          {error && <p className="text-xs text-red-600">{error}</p>}

          {/* Confirmation d'invitation : email envoyé ou lien à partager (mode console) */}
          {lastInvite && (
            <div className="space-y-1.5 rounded-lg border border-primary/40 bg-primary/5 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                <MailCheck className="h-3.5 w-3.5" />
                {lastInvite.emailSent ? 'Invitation envoyée par email.' : 'Invitation créée.'}
              </div>
              <p className="text-xs text-muted-foreground">
                {lastInvite.emailSent
                  ? 'Vous pouvez aussi partager ce lien directement :'
                  : "L'envoi d'email n'est pas configuré — partagez ce lien à la personne invitée :"}
              </p>
              <div className="flex items-center gap-2">
                <Input readOnly value={lastInvite.url} className="text-xs" />
                <Button
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  onClick={() => void navigator.clipboard?.writeText(lastInvite.url)}
                >
                  <Copy className="h-3.5 w-3.5" /> Copier
                </Button>
              </div>
            </div>
          )}

          <ul className="space-y-1.5">
            {members?.owner && (
              <li className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2">
                <Avatar name={members.owner.name} src={members.owner.avatar} className="h-8 w-8" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{members.owner.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {members.owner.email}
                  </div>
                </div>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  Propriétaire
                </span>
              </li>
            )}

            {members?.members.map((u) => (
              <li
                key={u.id}
                className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2"
              >
                <Avatar name={u.name} src={u.avatar} className="h-8 w-8" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{u.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  Membre
                </span>
                {isOwner && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-600"
                    onClick={() => void removeMember(u.id)}
                    title="Retirer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}

            {members?.pendingInvites.map((inviteEmail) => (
              <li
                key={inviteEmail}
                className="flex items-center gap-2.5 rounded-lg border border-dashed border-border px-3 py-2"
              >
                <Avatar name={inviteEmail} className="h-8 w-8" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-muted-foreground">{inviteEmail}</div>
                </div>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                  En attente
                </span>
                {isOwner && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-600"
                    onClick={() => void cancelInvite(inviteEmail)}
                    title="Annuler l'invitation"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}

            {members && members.members.length === 0 && members.pendingInvites.length === 0 && (
              <li className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                Aucun participant invité pour l'instant.
              </li>
            )}
          </ul>
        </section>

        {/* Suppression (propriétaire) — confirmation dans un second temps. */}
        {isOwner && (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-red-600">Zone de danger</h3>
            <div className="flex items-start justify-between gap-4 rounded-lg border border-red-500/40 p-3">
              <div>
                <div className="text-sm font-medium">Supprimer ce voyage</div>
                <p className="text-xs text-muted-foreground">
                  Définitif : étapes, lieux, budget et accès des participants sont perdus.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="shrink-0 text-red-600"
                onClick={onDelete}
              >
                <Trash2 className="h-3.5 w-3.5" /> Supprimer
              </Button>
            </div>
          </section>
        )}
      </div>
    </Modal>
  );
}
