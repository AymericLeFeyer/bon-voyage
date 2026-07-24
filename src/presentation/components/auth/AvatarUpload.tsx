import { useRef, useState } from 'react';
import { Camera, Loader2, X } from 'lucide-react';
import { Avatar } from '@/presentation/components/ui/Avatar';
import { fileToResizedDataUrl } from '@/shared/lib/image';

interface AvatarUploadProps {
  name: string;
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
}

/** Sélecteur de photo de profil : upload → redimensionné → data URL base64. */
export function AvatarUpload({ name, value, onChange }: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await fileToResizedDataUrl(file));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <Avatar name={name || '?'} src={value} className="h-16 w-16 text-lg" />
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
        >
          <Camera className="h-3.5 w-3.5" /> {value ? 'Changer' : 'Ajouter une photo'}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-600"
          >
            <X className="h-3.5 w-3.5" /> Retirer
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void pick(e.target.files?.[0] ?? undefined)}
      />
    </div>
  );
}
