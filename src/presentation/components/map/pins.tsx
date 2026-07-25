/** Gros marqueur d'une étape (là où l'on dort) : emoji si défini, sinon le numéro. */
export function StagePin({
  order,
  color,
  emoji,
  selected,
}: {
  order: number;
  color: string;
  emoji?: string;
  selected: boolean;
}) {
  return (
    <div className="marker-stage__wrap">
      <div
        className="marker-stage__pin"
        style={{
          background: color,
          boxShadow: selected
            ? '0 0 0 4px rgba(59,130,246,0.35),0 2px 6px rgba(0,0,0,0.35)'
            : undefined,
        }}
      >
        {emoji ? <span className="marker-stage__emoji">{emoji}</span> : order}
      </div>
      {/* Quand un emoji occupe le rond, on garde l'ordre dans un badge. */}
      {emoji && (
        <span className="marker-stage__badge" style={{ background: color }}>
          {order}
        </span>
      )}
    </div>
  );
}

/** Petit marqueur d'un lieu satellite : emoji de sa catégorie dans une pastille. */
export function PlacePin({
  color,
  emoji,
  visited,
  selected,
}: {
  color: string;
  emoji: string;
  visited: boolean;
  selected: boolean;
}) {
  return (
    <div
      className="marker-place__emoji"
      style={{
        borderColor: color,
        opacity: visited ? 0.5 : 1,
        boxShadow: selected ? '0 0 0 3px rgba(59,130,246,0.45)' : undefined,
        transform: selected ? 'scale(1.2)' : undefined,
      }}
    >
      {emoji}
    </div>
  );
}

/** Marqueur du point d'entrée/sortie (aéroport ou gare), au bout du voyage. */
export function FlightPin({ emoji, selected }: { emoji: string; selected: boolean }) {
  return (
    <div
      className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-white text-base shadow-md"
      style={{ boxShadow: selected ? '0 0 0 3px rgba(59,130,246,0.45)' : undefined }}
    >
      {emoji}
    </div>
  );
}

/** Pastille du moyen de transport, au milieu d'une jambe de trajet. */
export function LegPin({ emoji, selected }: { emoji: string; selected: boolean }) {
  return (
    <div
      className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-white text-sm shadow-md"
      style={{ boxShadow: selected ? '0 0 0 3px rgba(59,130,246,0.45)' : undefined }}
    >
      {emoji}
    </div>
  );
}
