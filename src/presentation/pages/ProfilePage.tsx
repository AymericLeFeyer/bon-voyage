import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { useAuth } from '@/presentation/auth/AuthProvider';
import { HttpError } from '@/infrastructure/http/httpClient';
import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';
import { Field } from '@/presentation/components/ui/Field';
import { AvatarUpload } from '@/presentation/components/auth/AvatarUpload';

export function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [country, setCountry] = useState(user?.country ?? '');
  const [avatar, setAvatar] = useState<string | undefined>(user?.avatar);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!user) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      await updateProfile({
        name,
        country,
        avatar,
        password: password ? password : undefined,
      });
      setPassword('');
      setSaved(true);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Une erreur est survenue');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto min-h-full max-w-lg px-6 py-12">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Retour
      </Link>

      <h1 className="mb-6 text-2xl font-bold">Mon profil</h1>

      <form
        onSubmit={submit}
        className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm"
      >
        <Field label="Photo de profil">
          <AvatarUpload name={name} value={avatar} onChange={setAvatar} />
        </Field>

        <Field label="Nom" htmlFor="name">
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>

        <Field label="Email">
          <Input value={user.email} disabled />
        </Field>

        <Field label="Pays préféré" htmlFor="country">
          <Input
            id="country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Japon"
          />
        </Field>

        <Field label="Nouveau mot de passe (optionnel)" htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Laisser vide pour ne pas changer"
          />
        </Field>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
          {saved && (
            <span className="inline-flex items-center gap-1 text-sm text-green-600">
              <Check className="h-4 w-4" /> Enregistré
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
