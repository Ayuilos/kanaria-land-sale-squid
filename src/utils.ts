import { EvmLogEvent } from "@subsquid/substrate-processor";
import { EvmEvent } from "./abi/rmrk";

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
  limit = 8,
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

// There is a problem, that typings do not match what is currently returned, so we have to check log property
export function getArgs(
  ev:
    | EvmLogEvent
    | (Omit<EvmLogEvent, "args"> & { args: { log: EvmLogEvent["args"] } })
): any {
  if ("log" in ev.args) {
    return ev.args.log;
  }

  return ev.args;
}

export function getTopic(ev: EvmLogEvent): string {
  return getArgs(ev).topics[0];
}
