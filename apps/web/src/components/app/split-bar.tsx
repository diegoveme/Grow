/** The signature Raíz 70/30 split visualization. */
export function SplitBar({
  spendableBps,
  className = "",
}: {
  spendableBps: number;
  className?: string;
}) {
  const spend = Math.round(spendableBps / 100);
  const grow = 100 - spend;
  return (
    <div className={className}>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-[1px]">
        <div className="bg-agua transition-all" style={{ flex: spendableBps }} />
        <div className="bg-oro transition-all" style={{ flex: 10000 - spendableBps }} />
      </div>
      <div className="mt-2.5 flex justify-between text-xs">
        <span className="flex items-center gap-1.5 text-agua">
          <span className="h-2 w-2 rounded-full bg-agua" /> Spendable · {spend}%
        </span>
        <span className="flex items-center gap-1.5 text-oro">
          <span className="h-2 w-2 rounded-full bg-oro" /> Growing · {grow}%
        </span>
      </div>
    </div>
  );
}
