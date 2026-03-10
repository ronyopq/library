export const diceCoefficient = (aRaw?: string | null, bRaw?: string | null): number => {
  const a = (aRaw ?? "").toLocaleLowerCase().trim();
  const b = (bRaw ?? "").toLocaleLowerCase().trim();

  if (!a || !b) return 0;
  if (a === b) return 1;

  const buildBigrams = (value: string) => {
    const output: string[] = [];
    for (let i = 0; i < value.length - 1; i += 1) {
      output.push(value.slice(i, i + 2));
    }
    return output;
  };

  const aPairs = buildBigrams(a);
  const bPairs = buildBigrams(b);

  const pairMap = new Map<string, number>();
  for (const pair of aPairs) {
    pairMap.set(pair, (pairMap.get(pair) ?? 0) + 1);
  }

  let overlap = 0;
  for (const pair of bPairs) {
    const count = pairMap.get(pair) ?? 0;
    if (count > 0) {
      pairMap.set(pair, count - 1);
      overlap += 1;
    }
  }

  return (2 * overlap) / (aPairs.length + bPairs.length);
};