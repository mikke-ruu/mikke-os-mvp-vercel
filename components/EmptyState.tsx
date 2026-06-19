export function EmptyState({
  title,
  body
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[#e8e1da] bg-white px-5 py-8 text-center">
      <p className="font-bold text-[#25211f]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[#79716b]">{body}</p>
    </div>
  );
}
