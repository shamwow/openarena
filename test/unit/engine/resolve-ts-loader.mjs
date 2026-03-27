import { access } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const EXTENSIONS = ['.ts', '.tsx', '.mts', '.js', '.mjs'];

async function exists(pathname) {
  try {
    await access(pathname);
    return true;
  } catch {
    return false;
  }
}

export async function resolve(specifier, context, defaultResolve) {
  try {
    return await defaultResolve(specifier, context, defaultResolve);
  } catch (error) {
    if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
      throw error;
    }

    const parentURL = context.parentURL ?? pathToFileURL(`${process.cwd()}/`).href;
    const baseURL = new URL(specifier, parentURL);

    if (extname(baseURL.pathname)) {
      throw error;
    }

    const basePath = fileURLToPath(baseURL);
    const candidates = [
      ...EXTENSIONS.map(ext => `${basePath}${ext}`),
      ...EXTENSIONS.map(ext => join(basePath, `index${ext}`)),
    ];

    for (const candidate of candidates) {
      if (await exists(candidate)) {
        return {
          url: pathToFileURL(candidate).href,
          shortCircuit: true,
        };
      }
    }

    throw error;
  }
}
