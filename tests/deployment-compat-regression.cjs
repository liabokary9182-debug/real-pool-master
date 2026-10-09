const assert=require('node:assert/strict'),load=require('./load-game.cjs'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const legacy=load({roundRect:false});
legacy.window.__poolTest.openTestMatch('eight');
legacy.window.__poolTest.setSpinAim(.6,.5);
legacy.window.__poolTest.setMovingBalls([{n:0,x:30,y:25},{n:1,x:50,y:25,vx:20}]);
const publicClient=load({hostname:'liabokary9182-debug.github.io'});
assert.equal(publicClient.window.__poolTest,undefined,'public query exposes fixture controls');
const a=load(),b=load();a.window.__poolTest.setSpinAim(.7,.3);
const before=JSON.stringify(b.window.__poolTest.getBallStates());
a.window.__poolTest.setMovingBalls([{n:0,x:20,y:20,vx:40},{n:1,x:50,y:20}]);
assert.equal(JSON.stringify(b.window.__poolTest.getBallStates()),before,'sessions share game state');
class Audio{play(){return Promise.reject(Error('native playback denied'));}pause(){}}
const document={getElementById:()=>({addEventListener(){},classList:{contains:()=>false}}),addEventListener(){}};
const w={Audio,document,performance,console,setTimeout:()=>1,clearTimeout(){},addEventListener(){}};w.window=w;
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../audio.js'),'utf8'),w);
w.PoolAudio.play('rail',50);
setImmediate(()=>console.log(JSON.stringify({passed:true,legacyCanvasFallback:true,publicFixturesDisabled:true,independentSessions:true,deniedRailPlaybackHandled:true})));
