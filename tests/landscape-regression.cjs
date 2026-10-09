const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const code = fs.readFileSync(require('node:path').join(__dirname, '../landscape.js'), 'utf8');
function fixture({phone=true, type='portrait-primary', angle, width=1024, height=640, screenWidth=390, screenHeight=844, inline=false}={}) {
  const events = new Map(), orientationEvents = new Map(), cancelled=[];
  const classes = new Set(inline ? ['inline-preview'] : []), properties={};
  const surface={setAttribute(name,value){this[name]=value;}};
  const gate={hidden:true};
  const root={clientWidth:width,contains:el=>el===surface,style:{setProperty:(key,value)=>properties[key]=value},classList:{contains:key=>classes.has(key),remove:key=>classes.delete(key),toggle(key,on){on?classes.add(key):classes.delete(key);}},querySelector:s=>s==='.mobile-game-surface'?surface:{offsetHeight:28}};
  const orientation={type,addEventListener:(name,fn)=>orientationEvents.set(name,fn)};
  const window={innerWidth:width,innerHeight:height,screen:{width:screenWidth,height:screenHeight,orientation},matchMedia:()=>({matches:phone,addEventListener(){}}),addEventListener(name,fn){if(!events.has(name))events.set(name,[]);events.get(name).push(fn);}};
  if(angle!==undefined)window.orientation=angle;
  const document={getElementById:id=>id==='mobile-pool-preview'?root:id==='landscapeGate'?gate:id==='previewTopbar'?null:{dispatchEvent:e=>cancelled.push([id,e.type])}};
  vm.runInNewContext(code,{window,document,navigator:{userAgent:phone?'iPhone':'desktop',maxTouchPoints:phone?5:0},Event:class Event{constructor(type){this.type=type;}}});
  return {window,root,surface,gate,classes,properties,cancelled,events,orientationEvents,rotate(type,angle){orientation.type=type;if(angle!==undefined)window.orientation=angle;for(const fn of events.get('orientationchange'))fn();}};
}
// A wide inline frame must never unlock a physically portrait phone.
const ios=fixture({angle:0,inline:true});
assert.equal(ios.gate.hidden,false);assert.equal(ios.surface.inert,true);
assert.equal(ios.surface['aria-hidden'],'true');assert.equal(ios.cancelled.length,3);
let stopped=0;
for(const fn of ios.events.get('keydown'))fn({type:'keydown',key:' ',preventDefault(){stopped++;},stopImmediatePropagation(){stopped++;}});
assert.equal(stopped,2);
ios.rotate('landscape-primary',90);
assert.equal(ios.gate.hidden,true);assert.equal(ios.surface.inert,false);
assert.equal(ios.classes.has('phone-landscape'),true);assert.equal(ios.classes.has('is-landscape'),false);
assert.equal(ios.properties['--phone-height'],'390px');
ios.rotate('portrait-primary',0);assert.equal(ios.gate.hidden,false);
assert.equal(ios.cancelled.length,6);
// Android and a small iPhone in landscape use one horizontal control row.
const android=fixture({type:'landscape-secondary',width:667,height:375,screenWidth:667,screenHeight:375});
assert.equal(android.gate.hidden,true);assert.equal(android.classes.has('is-compact'),true);
android.rotate('portrait-primary');assert.equal(android.surface.inert,true);
// Missing orientation APIs fall back to physical screen, never the embedded frame.
const fallback=fixture({type:undefined});
fallback.window.screen.orientation.type='';fallback.rotate('');assert.equal(fallback.gate.hidden,false);
const desktop=fixture({phone:false,type:'portrait-primary',width:390,height:844});
assert.equal(desktop.gate.hidden,true);assert.equal(desktop.surface.inert,false);
assert.equal(desktop.classes.has('phone-landscape'),false);
const index=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
assert(!index.includes('id="landscapeBtn"'));
assert(index.indexOf('./landscape.js')<index.indexOf('./game.js'));
console.log(JSON.stringify({passed:true,physicalOrientation:true,iosAndAndroid:true,portraitInputBlocked:true,gestureCancelled:true,desktopUnaffected:true}));
