import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./test/unit/engine/resolve-ts-loader.mjs', pathToFileURL('./'));
