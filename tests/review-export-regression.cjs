const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path'),load=require('./load-game.cjs');
const html=fs.readFileSync(path.join(__dirname,'../../fuguang-orbit-review.html'),'utf8'),scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]);assert.equal(scripts.length,1);new vm.Script(scripts[0]);
const serialized=scripts[0].match(/frame.srcdoc=("[\s\S]*");\s*$/)[1],app=JSON.parse(serialized);
assert(!/<script[^>]+src=/.test(app),'export still needs remote code');assert(!/src="\.\//.test(app),'export still needs local assets');
for(const s of app.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(s[1]);
const game=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8'),bridge=fs.readFileSync(path.join(__dirname,'../scripts/review-bridge.js'),'utf8');
const source='var parent={postMessage(){}};window.addEventListener=()=>{};\n'+game.replace(/\}\)\(\);\s*$/,()=>bridge+'\nwindow.__reviewShow=showReviewPage;})();');
const {window:w,ids}=load({source});ids.get('boot').isConnected=true;
const visible=['boot','startOverlay','menuOverlay','menuOverlay','menuOverlay',null,'spinOverlay','practiceOverlay',null,'resultOverlay'];
for(let i=0;i<10;i++){w.__reviewShow(i);if(visible[i]&&i)assert(!ids.get(visible[i]).classList.contains('hidden'),'page '+i+' hidden');}
assert.equal(ids.get('resultWins0').textContent,2);assert.equal(ids.get('resultWins1').textContent,1);
console.log(JSON.stringify({passed:true,pages:10,selfContained:true,compiledScripts:true,reviewNavigation:true}));
