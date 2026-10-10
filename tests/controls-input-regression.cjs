const assert=require('node:assert/strict'),fs=require('node:fs'),load=require('./load-game.cjs');
const source=fs.readFileSync(process.argv[2]||require('node:path').join(__dirname,'../game.js'),'utf8');
let lockedSamples=0;
for(const rotated of [false,true]){
 const g=load({source,mobile:true}),w=g.window,t=w.__poolTest;
 if(rotated)g.ids.get('mobile-pool-preview').classList.add('is-landscape');
 const meter=g.ids.get('cueMeter'),ruler=g.ids.get('angleRuler');
 const e=(x,y,id=1)=>({pointerId:id,clientX:rotated?-y:x,clientY:rotated?x:y,preventDefault(){}});
 const read=()=>JSON.parse(w.render_game_to_text());
 t.setGuideBalls([{n:0,x:30,y:25},{n:1,x:48,y:26.4}],0,56,.9,.65);
 const before=JSON.stringify(t.getDisplayGuide());meter.handlers.pointerdown(e(0,0));
 for(const y of [8,30,80,150,230]){meter.handlers.pointermove(e(0,y));assert.equal(JSON.stringify(t.getDisplayGuide()),before,'left cue pull moved guide');lockedSamples++;}
 const power=read().power;assert(power>56);
 // A second pointer may not change either the aim or the active pull strength.
 g.canvas.handlers.pointerdown(e(500,300,2));g.canvas.handlers.pointermove(e(520,300,2));g.canvas.handlers.pointerup(e(520,300,2));
 ruler.handlers.pointerdown(e(100,0,2));ruler.handlers.pointermove(e(200,0,2));ruler.handlers.pointerup(e(200,0,2));
 meter.handlers.pointermove(e(0,30,2));assert.equal(read().power,power);assert.equal(read().aimDegrees,0);
 meter.handlers.pointercancel();assert.equal(read().power,56);assert.equal(JSON.stringify(t.getDisplayGuide()),before);assert.equal(g.ids.get('shootBtn').disabled,false);
 // Short pulls are reversible. Cancel also permits subsequent precision drags.
 meter.handlers.pointerdown(e(0,0));meter.handlers.pointermove(e(0,10));meter.handlers.pointerup(e(0,10));assert.equal(read().phase,'aim');assert.equal(read().power,56);
 ruler.handlers.pointerdown(e(100,0));ruler.handlers.pointerup(e(100.25,0));assert(Math.abs(parseFloat(g.ids.get('angleReadout').textContent)-.0005)<1e-6);
 t.setGuideBalls([{n:0,x:30,y:25},{n:1,x:48,y:26.4}],0,56,.9,.65);
 meter.handlers.pointerdown(e(0,0));meter.handlers.pointermove(e(0,170));const chosen=read().power;
 meter.handlers.pointerup(e(0,170));assert.equal(read().phase,'moving');assert.equal(read().power,chosen);w.advanceTime(100);assert(read().balls.find(b=>b.n===0).vx>0);
 // Once a stroke finishes/restarts, the frozen trial cannot leak into a new aim.
 t.setGuideBalls([{n:0,x:30,y:25},{n:1,x:52,y:25}],0,22);assert.equal(t.getDisplayGuide().power,22);
}
const raster=load({source:source.replace('window.__poolTest={','window.__poolTest={badge(n){return numberBadgePixels(n)},'),raster:true,mobile:true});
for(let n=1;n<=8;n++){
 const badge=raster.window.__poolTest.badge(n);let white=0;
 for(let i=0;i<badge.length;i+=4)if(badge[i]===255&&badge[i+1]===255&&badge[i+2]===255&&badge[i+3]===255)white++;
 assert(white>100,`ball ${n} numeral is not white`);
 for(const [x,y] of [[15,48],[81,48],[48,12],[48,87]])assert.equal(badge[(y*96+x)*4+3],0,`ball ${n} has a disc`);
}
assert(!fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8').includes('data-aim-feel'));
console.log(JSON.stringify({passed:true,lockedSamples,rotatedTouch:true,secondPointerIsolated:true,cancelAndShortPullRestore:true,powerStillControlsShot:true,whiteNumerals:8}));
