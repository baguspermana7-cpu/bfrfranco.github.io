// ts-resolve-hook.mjs — Node ESM resolve hook: a relative import with no extension (TypeScript source style,
// `import { x } from './rz-engine'`) resolves to the `.ts` / `.tsx` file when one exists, so Node 24's type
// stripping can run dcmoc TypeScript modules in a gate without a bundler. Registered by the tests that need it.
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) && context.parentURL && context.parentURL.startsWith('file:')) {
    const base = pathResolve(dirname(fileURLToPath(context.parentURL)), specifier);
    for (const ext of ['.ts', '.tsx', '/index.ts']) if (existsSync(base + ext)) return next(pathToFileURL(base + ext).href, context);
  }
  return next(specifier, context);
}
