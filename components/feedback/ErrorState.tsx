export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-danger/30 bg-danger/10 p-5 text-danger">
      {message}
    </div>
  );
}
