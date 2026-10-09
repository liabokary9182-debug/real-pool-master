const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path'),os=require('node:os');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.POOL_CHROMIUM});
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/?test');
 await page.waitForFunction(()=>window.__poolTest);
 await page.evaluate(()=>{document.getElementById('boot').remove();advanceTime(0)});
 const fixtures=[];
 for(const y of [25,26,27.3])for(const spinX of [-.85,0,.85])fixtures.push({name:`cut-${y}-spin-${spinX}`,balls:[{n:0,x:30,y:25},{n:1,x:52,y}],power:70,spinX});
 for(const spinY of [-.85,0,.85])fixtures.push({name:`straight-spinY-${spinY}`,balls:[{n:0,x:40,y:25},{n:1,x:55,y:25}],power:70,spinY});
 fixtures.push({name:'weak-unreachable',balls:[{n:0,x:30,y:25},{n:1,x:70,y:25}],power:5});
 fixtures.push({name:'nearest-obstruction',balls:[{n:0,x:30,y:25},{n:1,x:70,y:25},{n:2,x:46,y:25}],power:56});
 fixtures.push({name:'middle-pocket',balls:[{n:0,x:50,y:22},{n:1,x:50,y:8}],power:56,aim:-Math.PI/2});
 fixtures.push({name:'corner-pocket',balls:[{n:0,x:24,y:12},{n:1,x:12,y:6}],power:56,aim:Math.atan2(-6,-12)});
 fixtures.push({name:'one-rail-kick',balls:[{n:0,x:25,y:25},{n:1,x:55,y:10}],power:80,aim:-172*Math.PI/180,expectedRails:1});
 fixtures.push({name:'two-rail-kick',balls:[{n:0,x:20,y:25},{n:1,x:70,y:15}],power:80,aim:-177.5*Math.PI/180,expectedRails:2});
 for(const fixture of fixtures){
   const result=await page.evaluate(f=>{
     const t=__poolTest;t.setGuideBalls(f.balls,f.aim||0,f.power,f.spinY||0,f.spinX||0);
     const before=render_game_to_text(),g=t.getDisplayGuide(),unchanged=before===render_game_to_text();
     t.fireTest();for(let i=0;i<5400;i++){advanceTime(1000/180);if(t.getShotSummary().firstHit!==null||JSON.parse(render_game_to_text()).phase!=='moving')break;}
     return {g,unchanged,actual:t.getShotSummary().firstHit};
   },fixture);
   assert(result.unchanged,`${fixture.name}: preview mutated live state`);
   if(fixture.expectedRails)assert.equal(result.actual,1,`${fixture.name}: live cushion route changed`);
   else assert.equal(result.g.targetNumber,result.actual,`${fixture.name}: first contact mismatch`);
   assert.equal(result.g.straight,true,`${fixture.name}: guide not marked straight`);
   for(const path of [result.g.shotPath,result.g.cuePath,result.g.targetPath])assert(path.length<=1200,`${fixture.name}: short guide contains too many samples`);
   if(fixture.expectedRails){assert.equal(result.g.railCount,fixture.expectedRails,`${fixture.name}: missing internal cushion prediction`);assert.equal(result.g.targetNumber,null);}
   if(result.g.targetNumber!==null){
     const end=result.g.shotPath.at(-1),o=result.g.objectCenter,r=1.125*1.05*1.05;
     assert(Math.abs(Math.hypot(end.x-o.x,end.y-o.y)-2*r)<1e-7,`${fixture.name}: incorrect ghost-ball contact`);
   }
 }
 // Each pocket retains the falling sphere after 180ms and clears it once.
 for(let pocket=0;pocket<6;pocket++){
   const result=await page.evaluate(p=>{
     __poolTest.pocketRollingTest(p,0,12);advanceTime(0);
     let a=[];for(let i=0;i<180;i++){advanceTime(1000/180);a=__poolTest.getFallAnimations();if(a.length)break;}
     const first=a[0],events=__poolTest.getShotSummary().pocketed;advanceTime(180);const middle=__poolTest.getFallAnimations()[0];advanceTime(500);
     return {first,middle,remaining:__poolTest.getFallAnimations().length,events};
   },pocket);
   assert(result.first,`pocket ${pocket}: missing falling ball`);
   assert(result.middle,`pocket ${pocket}: fall ended too soon`);
   assert.equal(result.first.pocket,pocket);assert.equal(result.remaining,0);
   assert.equal(result.events.filter(e=>e.n===1).length,1,`pocket ${pocket}: double score`);
 }
 await page.evaluate(()=>__poolTest.setGuideBalls([{n:0,x:50,y:25},{n:1,x:65,y:27}],0,56));
 await page.screenshot({path:path.join(os.tmpdir(),'pool-desktop-review.png')});
 const cue=await page.evaluate(()=>({background:getComputedStyle(document.getElementById('cueStick')).backgroundImage,power:getComputedStyle(document.getElementById('cuePower')).height}));
 assert(cue.background.startsWith('url("data:image/png;'),'cue texture missing');
 await page.setViewportSize({width:844,height:390});await page.waitForTimeout(200);
 await page.screenshot({path:path.join(os.tmpdir(),'pool-mobile-review.png')});
 const bounds=await page.locator('#cueMeter').boundingBox();
 assert(bounds.x<65 && bounds.height>200,'left cue lane layout changed');
 const powerHeights=[];
 for(const power of [5,56,100]){await page.evaluate(p=>__poolTest.setGuideBalls([{n:0,x:50,y:25},{n:1,x:65,y:27}],0,p),power);await page.waitForTimeout(100);powerHeights.push(await page.locator('#cuePower').evaluate(el=>el.getBoundingClientRect().height));}
 assert(powerHeights[0]<powerHeights[1]&&powerHeights[1]<powerHeights[2],'power bar does not follow full range');
 assert.deepEqual(errors,[],'browser runtime errors');
 console.log(JSON.stringify({passed:true,guideFixtures:fixtures.length,pocketFixtures:6,powerHeights,errors}));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
