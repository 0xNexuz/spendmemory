import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const path = resolve('.local', 'data.json');
let queue = Promise.resolve();

export async function readStore() {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT') return { proposals: [] };
    throw error;
  }
}

export function updateStore(change) {
  const task = queue.then(async () => {
    const store = await readStore();
    const result = await change(store);
    await mkdir(dirname(path), { recursive: true });
    const temp = `${path}.tmp`;
    await writeFile(temp, JSON.stringify(store, null, 2), { mode: 0o600 });
    await rename(temp, path);
    return result;
  });
  queue = task.catch(() => {});
  return task;
}
