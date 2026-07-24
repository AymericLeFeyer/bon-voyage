import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Compass, Loader2 } from 'lucide-react';
import { useAuth } from '@/presentation/auth/AuthProvider';
import { HttpError } from '@/infrastructure/http/httpClient';
import { BRAND } from '@/shared/constants/brand';
import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';
import { Field } from '@/presentation/components/ui/Field';
import { AvatarUpload } from '@/presentation/components/auth/AvatarUpload';
import { ThemeToggle } from '@/presentation/components/ThemeToggle';

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const isRegister = mode === 'register';
  const { user, loading, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location.state as { from?: string; email?: string } | null;
  const from = navState?.from ?? '/';

  const [email, setEmail] = useState(navState?.email ?? '');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [avatar, setAvatar] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to={from} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (isRegister) {
        await register({ email, password, name, country: country || undefined, avatar });
      } else {
        await login({ email, password });
      }
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Une erreur est survenue');
    } finally {
      setBusy(false);
    }
  };

  return (
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
          <p className="mt-1 text-sm text-muted-foreground">{BRAND.tagline}</p>
        </div>

        <form
          onSubmit={submit}
          className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm"
        >
          <h2 className="text-lg font-semibold">
            {isRegister ? 'Créer un compte' : 'Se connecter'}
          </h2>

          {isRegister && (
            <>
              <Field label="Photo de profil">
                <AvatarUpload name={name} value={avatar} onChange={setAvatar} />
              </Field>
              <Field label="Nom" htmlFor="name">
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Aymeric"
                  required
                />
              </Field>
            </>
          )}

          <Field label="Email" htmlFor="email">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.com"
              required
            />
          </Field>

          <Field label="Mot de passe" htmlFor="password">
            <Input
              id="password"
              type="password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </Field>

          {isRegister && (
            <Field label="Pays préféré (optionnel)" htmlFor="country">
              <Input
                id="country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Japon"
              />
            </Field>
          )}

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
              {error}
            </p>
          )}

          <Button type="submit" disabled={busy} className="w-full justify-center">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {isRegister ? 'Créer mon compte' : 'Se connecter'}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {isRegister ? (
              <>
                Déjà un compte ?{' '}
                <Link to="/login" className="font-medium text-primary hover:underline">
                  Se connecter
                </Link>
              </>
            ) : (
              <>
                Pas encore de compte ?{' '}
                <Link to="/register" className="font-medium text-primary hover:underline">
                  Créer un compte
                </Link>
              </>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
