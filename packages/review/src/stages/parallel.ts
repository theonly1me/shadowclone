import { maximumParallelParts } from "../shards";

export async function inParallel<Item, Output>(options: {
  readonly items: readonly Item[];
  readonly work: (item: Item) => Promise<Output>;
}): Promise<readonly Output[]> {
  const results: Output[] = [];
  const queue = options.items.map((item, index) => ({ item, index }));
  const worker = async (): Promise<void> => {
    for (let entry = queue.shift(); entry !== undefined; entry = queue.shift()) {
      results[entry.index] = await options.work(entry.item);
    }
  };

  await Promise.all(Array.from({ length: Math.min(maximumParallelParts, queue.length) }, worker));

  return results;
}
