import { load, suite } from '../testkit.mjs';
import { conformance } from './conformance.mjs';

const { createMemoryStore } = await load('data/memory.ts');
const { DEMO } = await load('data/seed.ts');

const t = suite('The store contract');
await conformance(() => createMemoryStore(JSON.parse(JSON.stringify(DEMO))), 'in memory', t);
t.done();
