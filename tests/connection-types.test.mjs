import test from 'node:test';
import assert from 'node:assert/strict';
import {cableTypes,linkSpeeds,customConnectionValue,connectionChoices,connectionValue,cleanConnectionDetails,connectionMediaInfo} from '../src/web/connection-types.mjs';

test('cable and speed presets retain legacy fields and provide distinct media families and custom values',()=>{
 const media=new Set(cableTypes.map(([value])=>value)),speeds=new Set(linkSpeeds.map(([value])=>value));
 for(const value of ['unknown','copper','fiber','MMF','SMF','SR','LR','ER','ZR','DAC','passive DAC','active DAC','AOC','AEC','coax','serial',customConnectionValue])assert.ok(media.has(value),value);
 for(const value of ['','10 Mbps','100 Mbps','1 Gbps','2.5 Gbps','5 Gbps','10 Gbps','25 Gbps','40 Gbps','50 Gbps','100 Gbps','200 Gbps','400 Gbps','800 Gbps',customConnectionValue])assert.ok(speeds.has(value),value);
 assert.equal(media.size,cableTypes.length);assert.equal(speeds.size,linkSpeeds.length);assert.equal(connectionValue(cableTypes,null),'unknown');assert.equal(connectionValue(linkSpeeds,null),'');
});

test('unknown imported descriptions and nonstandard speed labels remain selectable without recasing or unit conversion',()=>{
 const media='Vendor TwinAx Rev. B',speed='2500Mb/s full duplex';
 for(const [catalog,current] of [[cableTypes,media],[linkSpeeds,speed],[cableTypes,'sr'],[linkSpeeds,10000000000]]){
  const choices=connectionChoices(catalog,current),chosen=connectionValue(catalog,current);assert.equal(chosen,String(current));assert.equal(choices.filter(([value])=>value===chosen).length,1);assert.ok(choices.findIndex(([value])=>value===chosen)<choices.findIndex(([value])=>value===customConnectionValue));assert.equal(choices.length,catalog.length+1);
 }
 assert.equal(connectionChoices(cableTypes,'SR').length,cableTypes.length);assert.equal(connectionChoices(linkSpeeds,'').length,linkSpeeds.length);assert.deepEqual(cleanConnectionDetails({media,speed}),{media,speed});
 const mutable=connectionChoices(cableTypes,media);mutable[0][1]='Changed label';assert.equal(cableTypes[0][1],'Unspecified');
});

test('custom selections save the actual text and allow independent media and speed choices',()=>{
 assert.deepEqual(cleanConnectionDetails({media:customConnectionValue,mediaCustom:'  Proprietary optical assembly  ',speed:customConnectionValue,speedCustom:'  12.5 Gbps  '}),{media:'Proprietary optical assembly',speed:'12.5 Gbps'});
 assert.deepEqual(cleanConnectionDetails({media:'copper',speed:'800 Gbps'}),{media:'copper',speed:'800 Gbps'});assert.deepEqual(cleanConnectionDetails({media:'AOC',speed:'10 Mbps'}),{media:'AOC',speed:'10 Mbps'});assert.deepEqual(cleanConnectionDetails(),{media:'unknown',speed:''});assert.deepEqual(cleanConnectionDetails({media:'fiber',speed:10000000000}),{media:'fiber',speed:'10000000000'});
});

test('editable connection fields reject empty custom placeholders, multiline values and unbounded text',()=>{
 assert.throws(()=>cleanConnectionDetails({media:customConnectionValue,mediaCustom:'  '}),/custom cable type/);assert.throws(()=>cleanConnectionDetails({media:'SR',speed:customConnectionValue,speedCustom:''}),/custom link speed/);
 for(const input of [{media:'fiber\nSR'},{media:'DAC\u0000'},{speed:'10\tGbps'},{speed:'10 Gbps\u0085'}])assert.throws(()=>cleanConnectionDetails(input),/one line/);
 assert.throws(()=>cleanConnectionDetails({media:'x'.repeat(161)}),/160 characters/);assert.throws(()=>cleanConnectionDetails({speed:'x'.repeat(81)}),/80 characters/);assert.throws(()=>cleanConnectionDetails({media:[]}),/valid cable type/);assert.throws(()=>cleanConnectionDetails({speed:Infinity}),/valid link speed/);
 assert.deepEqual(cleanConnectionDetails({media:'x'.repeat(160),speed:'x'.repeat(80)}),{media:'x'.repeat(160),speed:'x'.repeat(80)});
});

test('media descriptions keep distinct legend types without guessing reach or new optical form factors',()=>{
 for(const [media,name] of [['AOC','AOC'],['active optical cable','AOC'],['AEC','AEC'],['active electrical cable','AEC'],['active DAC','Active DAC'],['DAC passive','Passive DAC'],['DAC','DAC'],['100GBASE-ER4','ER fiber'],['ZR','ZR fiber'],['100GBASE-SR4','SR fiber'],['10GBASE-LR','LR fiber'],['MMF','Multimode fiber'],['single-mode fiber','Single-mode fiber'],['fiber','Fiber, reach unspecified'],['coaxial copper','Coaxial'],['RS-232 serial RJ45','Serial']])assert.equal(connectionMediaInfo(media).name,name,media);
 for(const media of ['AOC','AEC','ER','ZR','MMF','SMF']){assert.equal(connectionMediaInfo(media).plug,undefined);assert.equal(connectionMediaInfo(media).slot,undefined);}
 assert.deepEqual(connectionMediaInfo('SR'),{name:'SR fiber',color:'#FF0000',plug:'SFP',slot:'sr'});assert.equal(connectionMediaInfo('copper',true).name,'AP copper');assert.equal(connectionMediaInfo('copper',false).name,'Copper');
 for(const media of [null,'','unknown','Unspecified','n/a'])assert.equal(connectionMediaInfo(media).name,'Media unspecified');assert.deepEqual(connectionMediaInfo('Proprietary assembly rev B'),{name:'Proprietary assembly rev B',color:'#707A83'});
});
