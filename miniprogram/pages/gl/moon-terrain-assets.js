import {TERRAIN_MANIFEST} from './moon-terrain-manifest.js';

const callFS=(fs,name,args)=>new Promise((resolve,reject)=>fs[name]({...args,success:resolve,fail:reject}));

// No startup prefetch: the voyage explicitly owns one instance after audio starts.
export class MoonTerrainAssets {
  constructor() { this.generation=0; this.tasks=new Set(); this.stats={downloads:0,cacheHits:0,bytes:0}; }
  cancel() { ++this.generation; for(const task of this.tasks)try{task.abort();}catch(_){} this.tasks.clear(); }
  async load() {
    const generation=this.generation,fs=wx.getFileSystemManager();
    const current=()=>generation===this.generation;
    const directory=wx.env.USER_DATA_PATH+'/moon-terrain/'+TERRAIN_MANIFEST.version;
    const paths={};
    try{await callFS(fs,'mkdir',{dirPath:directory,recursive:true});}catch(error){try{fs.accessSync(directory);}catch(_){throw error;}}
    const valid=async(file,path)=>{try{const info=await callFS(fs,'getFileInfo',{filePath:path,digestAlgorithm:'md5'});return info.size===file.bytes&&info.digest===file.md5;}catch(_){return false;}};
    const missing=[];
    for(const file of TERRAIN_MANIFEST.files){
      if(!current())throw Error('Terrain load cancelled');
      const path=directory+'/'+file.name;
      if(await valid(file,path)){paths[file.name]=path;++this.stats.cacheHits;}else missing.push(file);
    }
    if(missing.length){
      const urls=await wx.cloud.getTempFileURL({fileList:missing.map(file=>TERRAIN_MANIFEST.cloudRoot+file.name)});
      if(!current())throw Error('Terrain load cancelled');
      const urlMap=new Map((urls.fileList||[]).map(item=>[item.fileID,item]));let next=0;
      const worker=async()=>{while(next<missing.length){
        const file=missing[next++];if(!current())throw Error('Terrain load cancelled');
        const item=urlMap.get(TERRAIN_MANIFEST.cloudRoot+file.name);
        if(!item?.tempFileURL||Number(item.status||0)!==0)throw Error('Terrain resource unavailable: '+file.name);
        const temp=await new Promise((resolve,reject)=>{
          let task,settled=false;
          const timer=setTimeout(()=>{try{task?.abort();}catch(_){}finish(Error('Terrain download timeout'));},45000);
          const finish=(error,path)=>{if(settled)return;settled=true;clearTimeout(timer);this.tasks.delete(task);error?reject(error):resolve(path);};
          const success=r=>r.statusCode===200&&r.tempFilePath?finish(null,r.tempFilePath):finish(Error('Terrain HTTP '+r.statusCode));
          task=wx.downloadFile({url:item.tempFileURL,success,fail:error=>{
            // Cloud storage also has a native route when a device rejects a temporary CDN domain.
            if(current()&&/domain|合法域名/i.test(String(error?.errMsg||error?.message||''))&&wx.cloud.downloadFile){
              this.tasks.delete(task);
              try{task=wx.cloud.downloadFile({fileID:TERRAIN_MANIFEST.cloudRoot+file.name,success,fail:failure=>finish(failure)});this.tasks.add(task);}catch(failure){finish(failure);}
            }else finish(error);
          }});
          this.tasks.add(task);
        });
        if(!current())throw Error('Terrain load cancelled');
        if(!await valid(file,temp))throw Error('Terrain checksum failed: '+file.name);
        const target=directory+'/'+file.name,partial=target+'.part';
        await callFS(fs,'copyFile',{srcPath:temp,destPath:partial});
        if(!current()){try{fs.unlinkSync(partial);}catch(_){}throw Error('Terrain load cancelled');}
        await callFS(fs,'rename',{oldPath:partial,newPath:target});paths[file.name]=target;
        ++this.stats.downloads;this.stats.bytes+=file.bytes;
      }};
      // Settle both workers before cleanup; a failed sibling cannot leave a live task behind.
      const result=await Promise.allSettled([worker(),worker()]);
      const failure=result.find(value=>value.status==='rejected');if(failure)throw failure.reason;
    }
    if(!current())throw Error('Terrain load cancelled');
    await callFS(fs,'writeFile',{filePath:directory+'/complete.json',data:JSON.stringify({version:TERRAIN_MANIFEST.version}),encoding:'utf8'});
    // Only this feature's previous content versions are eligible for eviction.
    try{const parent=wx.env.USER_DATA_PATH+'/moon-terrain';const dirs=fs.readdirSync(parent);for(const name of dirs)if(/^[a-f0-9]{16}$/.test(name)&&name!==TERRAIN_MANIFEST.version)fs.rmdirSync(parent+'/'+name,true);}catch(_){}
    return paths;
  }
}
