import fs from 'node:fs';
import assert from 'node:assert/strict';
import {ACTIONS} from '../src/model.js';
const m=JSON.parse(fs.readFileSync(new URL('../assets/animations/manifest.json',import.meta.url)));
assert.deepEqual(Object.keys(m.states).sort(),Object.keys(ACTIONS).sort());
for(const[name,s]of Object.entries(m.states)){
  const b=fs.readFileSync(new URL('../assets/animations/'+s.file,import.meta.url));
  assert.equal(b.toString('hex',0,8),'89504e470d0a1a0a');assert.equal(b.readUInt32BE(16),m.cellWidth*s.frames);assert.equal(b.readUInt32BE(20),m.cellHeight);
  assert.equal(s.frames,4);assert.equal(s.durations.length,s.frames);assert(s.durations.every(n=>Number.isFinite(n)&&n>0));
  console.log('OK',name,s.frames+' frames',b.length+' bytes');
}
console.log('All renderer assets and manifest entries are consistent.');
