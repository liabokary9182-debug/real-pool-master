const assert=require('node:assert/strict'),load=require('./load-game.cjs');
for(const rotated of [false,true]){
 const {window:w,ids}=load(),t=w.__poolTest;t.setGuideBalls([{n:0,x:30,y:25},{n:1,x:50,y:25}],0,70,0,.2);
 if(rotated)ids.get('mobile-pool-preview').classList.add('is-landscape');
 const ball=ids.get('spinEditorBall');ball.getBoundingClientRect=()=>rotated?{left:0,top:0,right:240,width:240,height:240}:{left:0,top:0,right:240,width:240,height:240};
 const event=(fx,fy)=>({pointerId:3,clientX:rotated?240*(1-fy):240*fx,clientY:rotated?240*fx:240*fy,preventDefault(){}});
 ids.get('spinPad').handlers.click();assert(!ids.get('spinOverlay').classList.contains('hidden'));
 ball.handlers.pointerdown(event(.68,.32));assert.deepEqual(JSON.parse(w.render_game_to_text()).spin,[.2,0],'unconfirmed draft changed the launch');
 t.fireTest();assert.equal(JSON.parse(w.render_game_to_text()).phase,'aim','background shot bypassed spin confirmation');
 assert.equal(parseFloat(ids.get('spinEditorDot').style.left),68,'marker does not follow the chosen contact point');
 ids.get('confirmSpin').handlers.click();assert.deepEqual(JSON.parse(w.render_game_to_text()).spin,[.5,.5]);assert(ids.get('spinOverlay').classList.contains('hidden'));
 ids.get('spinPad').handlers.click();ball.handlers.pointerdown(event(.14,.86));ids.get('closeSpinEditor').handlers.click();assert.deepEqual(JSON.parse(w.render_game_to_text()).spin,[.5,.5],'cancel applied the draft');
 ids.get('spinPad').handlers.click();ball.handlers.pointerdown(event(1,0));ids.get('confirmSpin').handlers.click();const selected=JSON.parse(w.render_game_to_text()).spin;assert(Math.hypot(...selected)<=1.01,'strong mixed English exceeded the safe limit');
 ids.get('spinPad').handlers.click();ids.get('spinEditorCenter').handlers.click();ids.get('confirmSpin').handlers.click();assert.deepEqual(JSON.parse(w.render_game_to_text()).spin,[0,0]);
}
console.log(JSON.stringify({passed:true,largeBall:true,confirmationRequired:true,cancelPreservesStroke:true,rotatedTouch:true,markerMatchesContact:true}));
