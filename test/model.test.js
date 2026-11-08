import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSettings,constrainPosition,frameAt,walkStep} from '../src/model.js';
test('corrupt saved settings cannot break geometry or timers',()=>{
  assert.equal(normalizeSettings(null).size,240);
  const s=normalizeSettings({size:Infinity,interval:-2,roam:'false',sound:true});
  assert.equal(s.size,240);assert.equal(s.interval,5);assert.equal(s.roam,true);assert.equal(s.sound,true);
});
test('drag and resize keep full pet inside the stage',()=>{
  assert.deepEqual(constrainPosition(-100,Infinity,800,600,240),{x:0,y:0});
  assert.deepEqual(constrainPosition(900,700,800,600,240),{x:560,y:340});
  assert.deepEqual(constrainPosition(5,5,100,100,240),{x:0,y:0});
});
test('frame timing respects a brief blink, wraps without blank frames',()=>{
  const ds=[1500,350,110,800];assert.equal(frameAt(1499,ds),0);assert.equal(frameAt(1850,ds),2);assert.equal(frameAt(1960,ds),3);assert.equal(frameAt(2760,ds),0);
});
test('walking reflects at either edge and caps delayed frame deltas',()=>{
  assert.deepEqual(walkStep(99,1,.05,100,0,100),{x:100,direction:-1});
  assert.deepEqual(walkStep(1,-1,.05,100,0,100),{x:0,direction:1});
  assert.equal(walkStep(50,1,10,100,0,100).x,55);
});
