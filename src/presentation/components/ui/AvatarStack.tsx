import type { PublicUser } from '@shared/types/user';
import { cn } from '@/shared/lib/cn';
import { Avatar } from './Avatar';

interface AvatarStackProps {
  users: PublicUser[];
  /** Au-delà, on affiche une pastille « +N ». */
  max?: number;
  className?: string;
}

/** Têtes des participants, légèrement superposées (liste des voyages). */
export function AvatarStack({ users, max = 4, className }: AvatarStackProps) {
  if (users.length === 0) return null;
  const shown = users.slice(0, max);
  const rest = users.length - shown.length;

  return (
    <div
      className={cn('flex -space-x-2', className)}
      title={users.map((u) => u.name).join(', ')}
    >
      {shown.map((u) => (
        <Avatar
          key={u.id}
          name={u.name}
          src={u.avatar}
          className="h-7 w-7 text-[10px] ring-2 ring-card"
        />
      ))}
      {rest > 0 && (
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-card">
          +{rest}
        </span>
      )}
    </div>
  );
}
