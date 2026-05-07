const stats = [
  ["Media", "8.4"],
  ["Plataforma favorita", "PC"],
  ["Género favorito", "RPG"],
  ["Racha", "18 días"]
];

export function UserStats() {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      {stats.map(([label, value]) => (
        <div key={label} className="surface-card rounded-2xl p-5">
          <p className="text-sm text-muted">{label}</p>
          <p className="mt-2 text-2xl font-black">{value}</p>
        </div>
      ))}
    </div>
  );
}
