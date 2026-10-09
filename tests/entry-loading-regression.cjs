const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function fixture(){
  const timers=[],ids={};for(const id of ['boot','bootProgress','bootPercent','bootTrack','skipBoot'])ids[id]={style:{},classes:new Set(),classList:{add(k){ids[id].classes.add(k)}},setAttribute(k,v){this[k]=v},addEventListener(k,v){this[k]=v},remove(){}};
  const photo={complete:false,addEventListener(k,v){this[k]=v}},w={document:{getElementById:id=>ids[id],querySelector:()=>photo},location:{reload(){w.reloaded=true}},setTimeout:(fn,ms)=>timers.push({fn,ms}),addEventListener(){}};w.window=w;
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../startup.js'),'utf8'),w);return {w,ids,photo,timers};
}
let f=fixture();f.w.PoolStartup.ready('game');assert.equal(f.ids.bootProgress.style.width,'33%');f.photo.load();assert.equal(f.ids.bootTrack['aria-valuenow'],'67');assert(!f.ids.boot.classes.has('done'));f.w.PoolStartup.ready('audio');f.timers.find(t=>t.ms===280).fn();assert(f.ids.boot.classes.has('done'));
f=fixture();f.w.PoolStartup.ready('game');f.timers.find(t=>t.ms===5000).fn();f.timers.find(t=>t.ms===280).fn();assert(f.ids.boot.classes.has('done'),'slow decorative resources blocked entry');
f=fixture();f.timers.find(t=>t.ms===5000).fn();assert.equal(f.ids.skipBoot.textContent,'重新加载');assert(!f.ids.boot.classes.has('done'));f.ids.skipBoot.click();assert(f.w.reloaded);
console.log(JSON.stringify({passed:true,realResourceProgress:true,slowResourceFallback:true,missingGameRetry:true}));
