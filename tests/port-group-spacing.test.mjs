import test from 'node:test';
import assert from 'node:assert/strict';
import {faceplates} from '../src/web/imports/faceplates.mjs';
import {deviceFaceplate} from '../src/web/diagram/faceplate.mjs';

test('6000/6100 48-port models and family retain four twelve-port blocks',()=>{
 const profiles=faceplates.filter(p=>(['6000','6100'].includes(p.family)||p.familyOnly&&p.title.includes('6000/6100'))&&p.sockets?.length===52);
 assert.ok(profiles.length>5);
 for(const p of profiles){const panel=deviceFaceplate({model:p.models[0]});
  const x=n=>panel.ports[String(n)][0],pitch=x(3)-x(1);
  for(const start of [1,13,25,37])for(let n=start;n<start+10;n+=2)assert.ok(Math.abs(x(n+2)-x(n)-pitch)<1e-9);
  for(const [a,b] of [[11,13],[23,25],[35,37]])assert.ok(x(b)-x(a)>pitch*1.25,p.models[0]);
  for(let n=1;n<=48;n+=2){assert.equal(x(n),x(n+1));assert.ok(panel.ports[n][1]<panel.ports[n+1][1]);}
  assert.ok(x(52)<x(1));assert.ok(x(48)<.92);
 }
});
test('6200F retains separate twelve-port groups and right optical/management banks',()=>{
 const panel=deviceFaceplate({model:'JL727A'}),x=n=>panel.ports[String(n)][0],pitch=x(3)-x(1);
 for(const [a,b] of [[11,13],[23,25],[35,37]])assert.ok(x(b)-x(a)>pitch*1.25);
 assert.ok(x(48)<x(49));assert.ok(x(52)<panel.ports.mgmt[0]);
});
