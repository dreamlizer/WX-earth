import fs from 'node:fs';import {terrainSampler} from './terrain-sampler.mjs';
const terrain=terrainSampler(),x=34,z=37.75,metersPerUnit=25;
const seats=[{kind:'rei',x:x-.035,z,scale:.020},{kind:'shinji',x,z:z-.002,scale:.0205},{kind:'asuka',x:x+.035,z,scale:.020}];
for(const seat of seats){seat.groundY=terrain.height(seat.x,seat.z);seat.seatedHeightMeters=seat.scale*2.31*metersPerUnit;}
const layout={metersPerUnit,scaleMeaning:'Designed local scale, not a measured lunar site or full planetary simulation',representativeCraterCrossSectionUnits:55,representativeCraterCrossSectionMeters:1375,center:[x,terrain.height(x,z),z],seatOffset:.0004,seats};
const config=JSON.parse(fs.readFileSync(new URL('./shot-config.json',import.meta.url)));config.crewLayout=layout;fs.writeFileSync(new URL('./shot-config.json',import.meta.url),JSON.stringify(config,null,2)+'\n');console.log(layout);
