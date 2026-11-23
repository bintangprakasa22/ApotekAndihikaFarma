import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const mod = require('./_server.cjs');

export default mod.default || mod;
