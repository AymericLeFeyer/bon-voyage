import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, Compass, Loader2, X } from 'lucide-react';
import type { InviteInfo } from '@shared/types/user';
import { useAuth } from '@/presentation/auth/AuthProvider';
import { membershipRepository } from '@/infrastructure/membership/HttpMembershipRepository';
import { HttpError } from '@/infrastructure/http/httpClient';
import { BRAND } from '@/shared/constants/brand';
import { Button } from '@/presentation/components/ui/Button';
import { Avatar } from '@/presentation/components/ui/Avatar';
import { ThemeToggle } from '@/presentation/components/ThemeToggle';

/** Page d'atterrissage d'un lien d'invitation par email : /invite/:token. */
export function InvitePage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    membershipRepository
      .getInvite(token)
      .then((i) => active && setInfo(i))
      .catch((err: unknown) =>
        active && setError(err instanceof HttpError ? err.message : 'Invitation introuvable'),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [token]);

  const accept = async () => {
    setBusy(true);
    try {
      const { tripId } = await membershipRepository.acceptInvite(token);
      navigate(`/trip/${tripId}`);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Impossible d’accepter l’invitation');
      setBusy(false);
    }
  };

  const decline = async () => {
    setBusy(true);
    try {
      await membershipRepository.declineInvite(token);
    } finally {
      navigate('/');
    }
  };

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="relative flex min-h-full items-center justify-center px-6 py-12">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Compass className="h-6 w-6" />
          </span>
          <h1 className="text-2xl font-bold">{BRAND.name}</h1>
        </div>
        {children}
      </div>
    </div>
  );

  if (loading || authLoading) {
    return (
      <Shell>
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Chargement…
        </div>
      </Shell>
    );
  }

  if (error || !info) {
    return (
      <Shell>
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <p className="font-medium">Invitation indisponible</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {error ?? 'Ce lien ne correspond à aucune invitation.'}
          </p>
          <Button className="mt-4 w-full justify-center" onClick={() => navigate('/')}>
            Aller à l'accueil
          </Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="space-y-4 rounded-xl border border-border bg-card p-6 text-center shadow-sm">
        <div className="flex flex-col items-center gap-2">
          <Avatar name={info.owner.name} src={info.owner.avatar} className="h-12 w-12 text-base" />
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{info.owner.name}</span> vous invite à
            rejoindre
          </p>
          <p className="text-lg font-bold">« {info.tripTitle} »</p>
        </div>

        {user ? (
          <div className="flex gap-2">
            <Button className="flex-1 justify-center" onClick={accept} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Accepter
            </Button>
            <Button
              variant="secondary"
              className="flex-1 justify-center"
              onClick={decline}
              disabled={busy}
            >
              <X className="h-4 w-4" /> Refuser
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Connectez-vous ou créez un compte pour rejoindre ce voyage.
            </p>
            <Button
              className="w-full justify-center"
              onClick={() =>
                navigate('/register', {
                  state: { from: `/invite/${token}`, email: info.email },
                })
              }
            >
              Créer un compte
            </Button>
            <Button
              variant="secondary"
              className="w-full justify-center"
              onClick={() =>
                navigate('/login', { state: { from: `/invite/${token}`, email: info.email } })
              }
            >
              J'ai déjà un compte
            </Button>
          </div>
        )}
      </div>
    </Shell>
  );
}
