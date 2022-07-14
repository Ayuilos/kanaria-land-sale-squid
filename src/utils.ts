interface ConcurrentFetchConfig<D, M, R> {
  fetcher: (data: D) => Promise<M>;
  data: D[];
  dataResolver?: (data: M) => R | M;
  limit?: number;
}

export async function concurrentFetch<D, M, R>({
  fetcher,
  data,
  dataResolver = (_data) => _data,
  limit = 20,
}: ConcurrentFetchConfig<D, M, R>): Promise<(M | R)[]> {
  let pointer = 0;
  const queue = [];
  const result = [];

  while (true) {
    const nextPos = pointer + limit;

    if (nextPos < data.length) {
      queue.push(data.slice(pointer, nextPos));
      pointer = nextPos;
    } else {
      queue.push(data.slice(pointer, data.length));
      break;
    }
  }

  for (const group of queue) {
    const res = (
      await Promise.all(
        group.map(async (item) => {
          return fetcher(item);
        })
      )
    ).map((_data) => dataResolver(_data));
    result.push(res);
  }

  return result.flat();
}
