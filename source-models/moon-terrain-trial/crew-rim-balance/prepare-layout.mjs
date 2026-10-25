import fs from 'node:fs';import {terrainSampler} from './terrain-sampler.mjs';
const terrain=terrainSampler(),x=61.25,z=-3.85,metersPerUnit=25;
const seats=[{kind:'rei',x:x-.07,z,scale:.050},{kind:'shinji',x,z,scale:.05125},{kind:'asuka',x:x+.07,z,scale:.050}];
for(const seat of seats){seat.groundY=terrain.height(seat.x,seat.z);seat.seatedHeightMeters=seat.scale*2.31*metersPerUnit;}
const layout={metersPerUnit,scaleMeaning:'Art-directed compromise: human silhouettes enlarged about 2.5x over normal; terrain at a designed local scale',representativeCraterCrossSectionUnits:55,representativeCraterCrossSectionMeters:1375,center:[x,terrain.height(x,z),z],seatOffset:.0004,seats};
const config=JSON.parse(fs.readFileSync(new URL('./shot-config.json',import.meta.url)));config.crewLayout=layout;fs.writeFileSync(new URL('./shot-config.json',import.meta.url),JSON.stringify(config,null,2)+'\n');console.log(layout);
