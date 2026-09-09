export async function runPool(items, concurrency, inspect) {
  let cursor = 0;
  let stopped = false;
  const worker = async () => {
    while (!stopped && cursor < items.length) {
      const index = cursor++;
      const result = await inspect(items[index], index);
      if (result === 'stop') stopped = true;
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return { stopped, scheduled: cursor };
}

export function serializeWrites(write) {
  let pending = Promise.resolve();
  return snapshot => {
    pending = pending.then(() => write(snapshot));
    return pending;
  };
}
