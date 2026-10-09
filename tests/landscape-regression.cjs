const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const code = fs.readFileSync(path.join(__dirname, '../landscape.js'), 'utf8');
function fixture({phone=true,type='portrait-primary',angle=0,width=390,height=844}={}) {
  const events=new Map(),cancelled=[],classes=new Set(),properties={};
  const surface={inert:true,attributes:{'aria-hidden':'true'},removeAttribute(name){delete this.attributes[name];}};
  const root={clientWidth:width,style:{setProperty:(key,value)=>properties[key]=value},classList:{contains:key=>classes.has(key),remove:key=>classes.delete(key),toggle(key,on){on?classes.add(key):classes.delete(key);}},querySelector:s=>s==='.mobile-game-surface'?surface:{offsetHeight:28}};
  const orientation={type,addEventListener(){}};
  const window={orientation:angle,innerWidth:width,innerHeight:height,screen:{width:390,height:844,orientation},matchMedia:()=>({matches:phone,addEventListener(){}}),addEventListener(name,fn){if(!events.has(name))events.set(name,[]);events.get(name).push(fn);}};
  const document={getElementById:id=>id==='mobile-pool-preview'?root:id==='previewTopbar'?null:{dispatchEvent:e=>cancelled.push([id,e.type])}};
  vm.runInNewContext(code,{window,document,navigator:{userAgent:phone?'iPhone':'desktop',maxTouchPoints:phone?5:0},Event:class Event{constructor(type){this.type=type;}}});
  return {window,root,surface,classes,properties,cancelled,events,resize(width,height){root.clientWidth=window.innerWidth=width;window.innerHeight=height;for(const fn of events.get('resize'))fn();}};
}
// A locked in-app browser opens immediately with a rotated landscape surface.
const locked=fixture();
assert.equal(locked.surface.inert,false);assert(!('aria-hidden' in locked.surface.attributes));
assert(locked.classes.has('phone-landscape'));assert(locked.classes.has('is-landscape'));
assert.equal(locked.properties['--landscape-width'],'844px');assert.equal(locked.properties['--landscape-height'],'390px');
assert.equal(locked.cancelled.length,4);assert(locked.cancelled.some(([id,event])=>id==='spinEditorBall'&&event==='pointercancel'));
assert(!locked.events.has('keydown'));assert(!locked.events.has('pointerdown'));assert(!locked.events.has('click'));
// Actual viewport rotation must work even when all device-orientation APIs stay stale.
locked.resize(844,390);
assert(locked.classes.has('phone-landscape'));assert(!locked.classes.has('is-landscape'));
assert.equal(locked.surface.inert,false);assert.equal(locked.properties['--phone-height'],'390px');
assert.equal(locked.cancelled.length,8);
locked.resize(390,844);assert(locked.classes.has('is-landscape'));assert.equal(locked.surface.inert,false);
// Neither stale landscape APIs nor a small landscape phone may hide the game.
const conflicting=fixture({type:'landscape-primary',angle:90});assert(conflicting.classes.has('is-landscape'));
const small=fixture({width:667,height:375});assert(!small.classes.has('is-landscape'));assert.equal(small.surface.inert,false);
const desktop=fixture({phone:false});assert(!desktop.classes.has('phone-landscape'));assert.equal(desktop.surface.inert,false);
const index=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
assert(!index.includes('landscapeGate'));assert(!index.includes('请将手机横过来'));
assert(index.includes(fs.readFileSync(path.join(__dirname,'../landscape.js'),'utf8').trim()),'inline landscape startup was not rebuilt');
const css=fs.readFileSync(path.join(__dirname,'../landscape.css'),'utf8');
assert(css.includes('rotate(90deg)'));assert(!css.includes('visibility:hidden'));assert(!css.includes('pointer-events:none'));
// Exercise the real game's touch handlers after CSS rotation, not a copied mapping.
const g=require('./load-game.cjs')(),w=g.window,t=w.__poolTest,read=()=>JSON.parse(w.render_game_to_text());
g.ids.get('mobile-pool-preview').classList.add('is-landscape');
t.setGuideBalls([{n:0,x:50,y:25},{n:1,x:80,y:40}],0,56);
g.canvas.getBoundingClientRect=()=>({left:20,top:30,right:415,width:395,height:700});
const point={pointerId:1,clientX:415-(75+40*12.8)/2,clientY:30+(60+80*12.8)/2,preventDefault(){}};
g.canvas.handlers.pointerdown(point);assert.equal(read().aimDegrees,0);g.canvas.handlers.pointerup(point);assert.equal(read().aimDegrees,26.57);
t.setGuideBalls([{n:0,x:30,y:25},{n:1,x:52,y:25}],0,56);
const ruler=g.ids.get('angleRuler'),event=(x,y)=>({pointerId:7,clientX:x,clientY:y,preventDefault(){}});
ruler.handlers.pointerdown(event(10,100));ruler.handlers.pointermove(event(10,200));ruler.handlers.pointerup(event(10,200));assert.equal(read().aimDegrees,.1);
t.setGuideBalls([{n:0,x:50,y:25},{n:1,x:80,y:40}],0,56);
const meter=g.ids.get('cueMeter');meter.handlers.pointerdown(event(400,0));meter.handlers.pointermove(event(260,0));const power=read().power;
meter.handlers.pointerup(event(260,0));w.advanceTime(100);assert.equal(read().power,power);assert(read().balls.find(b=>b.n===0).vx>0);
console.log(JSON.stringify({passed:true,directEntry:true,lockedViewportRotated:true,staleOrientationIgnored:true,rotatedAimRulerAndPull:true,desktopUnaffected:true}));
