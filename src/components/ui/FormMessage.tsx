export function FormError({ children }: { children: string }) {
  return <p className="text-caption text-negative">{children}</p>;
}

export function FormInfo({ children }: { children: string }) {
  return <p className="text-caption text-positive">{children}</p>;
}
