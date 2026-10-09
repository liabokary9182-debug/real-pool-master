const assert=require('node:assert/strict');
const loadGame=require('./load-game.cjs');
const state=w=>JSON.parse(w.render_game_to_text());
function controls(game){
  return {id:id=>game.ids.get(id).handlers.click(),data:(key,value)=>game.elements.find(e=>e.dataset[key]===value).handlers.click()};
}
for(const mode of ['ai','local','practice']){
  const g=loadGame(),w=g.window,c=controls(g);c.id('startBtn');c.data('flowMode',mode);c.data('flowRules','nine');
  if(mode==='ai')c.data('flowDifficulty','easy');
  if(mode==='practice')c.data('practice','pocket');
  assert.equal(state(w).phase,'aim');
  w.__poolTest.fireTest();assert.equal(state(w).phase,'moving');c.id('backBtn');
  const after=state(w);assert.equal(after.phase,'menu');assert.equal(after.aiThinking,false);assert.deepEqual(after.matchScores,[0,0]);
  assert(after.balls.every(b=>!b.vx&&!b.vy),'returned game kept running');
  const page=mode==='practice'?'practiceOverlay':mode==='ai'?'setupDifficulty':'setupRules';
  assert(!g.ids.get(page).classList.contains('hidden'),`${mode}: incorrect previous page`);
  if(mode==='practice'){
    c.id('backPractice');c.data('setupBack','mode');c.data('flowMode','ai');c.data('flowRules','eight');c.data('flowDifficulty','normal');
    assert.equal(state(w).opponent,'ai','practice leaked local opponent into new AI game');
  }
}
for(const kind of ['Eight','Nine']){
  const g=loadGame(),w=g.window,c=controls(g);c.id('startBtn');c.data('flowMode','local');c.data('flowRules',kind.toLowerCase());
  w.__poolTest['set'+kind+'Final']();w.__poolTest.fireTest();w.advanceTime(15000);
  let s=state(w);assert.equal(s.phase,'gameover');assert.equal(s.scores[0],kind==='Eight'?8:9);assert.deepEqual(s.matchScores,[1,0]);
  assert(!g.ids.get('resultOverlay').classList.contains('hidden'));assert.equal(g.ids.get('resultWins0').textContent,1);
  const oldSeed=s.rackSeed;c.id('resultReplay');s=state(w);assert.equal(s.phase,'aim');assert.equal(s.opponent,'local');assert.equal(s.returnPage,'rules');assert.deepEqual(s.scores,[0,0]);assert.deepEqual(s.matchScores,[1,0]);assert.notEqual(s.rackSeed,oldSeed);
  w.__poolTest['set'+kind+'Final']();w.__poolTest.fireTest();w.advanceTime(15000);assert.deepEqual(state(w).matchScores,[2,0]);
  w.advanceTime(2000);assert.deepEqual(state(w).matchScores,[2,0],'winner counted twice');
  c.id('resultHome');assert.deepEqual(state(w).matchScores,[0,0]);assert(!g.ids.get('startOverlay').classList.contains('hidden'));
}
const g=loadGame();g.window.__poolTest.setEightFinal(false);g.window.__poolTest.fireTest();g.window.advanceTime(15000);
assert.equal(state(g.window).winner,1);assert.deepEqual(state(g.window).matchScores,[0,1]);assert.deepEqual(state(g.window).scores,[0,0]);
console.log(JSON.stringify({passed:true,returnPaths:3,winningRules:2,rematchSeries:true,prematureEightLoss:true}));
