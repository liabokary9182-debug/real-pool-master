const fs=require('node:fs'),path=require('node:path');
const {createCanvas,loadImage,GlobalFonts}=require('@napi-rs/canvas');
const fontPath=process.env.POOL_PREVIEW_FONT;
if(fontPath)GlobalFonts.registerFromPath(fontPath,'Noto Sans SC');
const root=path.resolve(__dirname,'..'),out=path.resolve(root,'../preview-output');fs.mkdirSync(out,{recursive:true});
const load=require('../tests/load-game.cjs');
const src=fs.readFileSync(path.join(root,'game.js'),'utf8');
const injected=src.replace('window.__poolTest={',`window.__poolTest={
  fallImage(index,age){const p=POCKET_GEOMETRY[index];state.phase='moving';state.balls=[];state.pocketAnimations=[];state.stroke=null;
    const d=(p.well.x-p.mx)*p.nx+(p.well.y-p.my)*p.ny;
    const b=ball(1,p.well.x+p.nx*(p.fallFront-d+.001),p.well.y+p.ny*(p.fallFront-d+.001));
    Object.assign(b,{vx:p.nx*9,vy:p.ny*9,rollVx:p.nx*9,rollVy:p.ny*9});
    if(age===null)state.balls=[b];else{const a=makePocketFall(b,index);advancePocketFall(a,age);advanceBallOrientation(a.visual,age);state.pocketAnimations=[a];}
    previousPaint=null;render();return p;
  },`);
function text(g,s,x,y,size=18,color='#d9e4e5',weight=400){g.fillStyle=color;g.font=`${weight} ${size}px "Noto Sans SC",sans-serif`;g.fillText(s,x,y);}
function box(g,x,y,w,h,r=12,fill='#10212c',stroke=null){g.beginPath();g.roundRect(x,y,w,h,r);g.fillStyle=fill;g.fill();if(stroke){g.strokeStyle=stroke;g.lineWidth=1;g.stroke();}}
function button(g,label,x,y,w=100,h=44,primary=false){box(g,x,y,w,h,6,primary?'#d4bd8d':'#11212e',primary?null:'#3a4f5b');g.textAlign='center';text(g,label,x+w/2,y+h/2+6,15,primary?'#15202a':'#cfdee4',primary?600:400);g.textAlign='left';}
function sphere(g,n,x,y,r,color){const gr=g.createRadialGradient(x-r*.35,y-r*.45,1,x,y,r);gr.addColorStop(0,color);gr.addColorStop(.7,color);gr.addColorStop(1,'#0d141b');g.shadowColor='#0009';g.shadowBlur=16;g.shadowOffsetY=9;g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fillStyle=gr;g.fill();g.shadowBlur=0;g.shadowOffsetY=0;g.fillStyle='#ffffffcc';g.beginPath();g.ellipse(x-r*.28,y-r*.52,r*.28,r*.06,-.35,0,Math.PI*2);g.fill();g.textAlign='center';text(g,String(n),x,y+7,r*.72,'#fff',700);g.textAlign='left';}
async function main(){
 const photo=await loadImage(path.join(root,'assets/fuguang-arena.jpg'));
 const loading=createCanvas(1600,900),lg=loading.getContext('2d');lg.drawImage(photo,0,0,1600,900);
 let gr=lg.createLinearGradient(0,0,1600,0);gr.addColorStop(0,'#040b13fa');gr.addColorStop(.4,'#040b13c2');gr.addColorStop(.82,'#040b130d');lg.fillStyle=gr;lg.fillRect(0,0,1600,900);
 gr=lg.createLinearGradient(0,900,0,0);gr.addColorStop(0,'#040b13f5');gr.addColorStop(.5,'#040b1300');lg.fillStyle=gr;lg.fillRect(0,0,1600,900);
 text(lg,'光域台球 / FUGUANG',112,72,15,'#aeb7b7');text(lg,'浮光竞技馆',1360,72,15,'#aeb7b7');
 text(lg,'球台准备中',112,219,16,'#c6af83');text(lg,'灯亮了。',112,308,66,'#f4f1e8',600);text(lg,'下一杆，你来。',112,402,66,'#f4f1e8',600);text(lg,'摆好球，留一个安静的开局。',112,460,20,'#9ca8ac');
 text(lg,'正在整理赛场画面',112,665,17,'#cbd2d1');lg.strokeStyle='#acb5a438';lg.beginPath();lg.moveTo(112,698);lg.lineTo(784,698);lg.stroke();lg.strokeStyle='#d5bb89';lg.lineWidth=2;lg.beginPath();lg.moveTo(112,698);lg.lineTo(662,698);lg.stroke();
 // Same small rocket retained in the implemented progress line.
 lg.fillStyle='#d6e9e8';lg.beginPath();lg.moveTo(650,683);lg.quadraticCurveTo(677,672,696,690);lg.quadraticCurveTo(677,706,650,698);lg.closePath();lg.fill();lg.fillStyle='#0c3241';lg.beginPath();lg.arc(670,690,5,0,Math.PI*2);lg.fill();
 text(lg,'启航进度',112,758,17,'#8d9a9d');text(lg,'82%',200,760,32,'#e0c795');button(lg,'继续等待',660,723,125,45);text(lg,'音乐与背景加载不会阻止你进入赛场',112,805,13,'#7c8b93');
 sphere(lg,1,1115,661,34,'#e4b443');sphere(lg,9,1181,638,34,'#ddc486');sphere(lg,8,1247,661,34,'#3b4651');lg.strokeStyle='#d8b984';lg.lineWidth=5;lg.beginPath();lg.moveTo(1085,725);lg.lineTo(1360,685);lg.stroke();
 for(let i=0;i<3;i++){const x=916+i*155;lg.strokeStyle=i<2?'#baa273':'#60707855';lg.lineWidth=1;lg.beginPath();lg.moveTo(x,773);lg.lineTo(x+135,773);lg.stroke();text(lg,['01 摆好球','02 灯光就位','03 准备开局'][i],x,802,15,i<2?'#c7ae7b':'#778c93');}
 fs.writeFileSync(path.join(out,'01-loading-design.png'),loading.toBuffer('image/png'));
 const g=load({source:injected,raster:true,mobile:true,dpr:3}),t=g.window.__poolTest;
 t.setGuideBalls([{n:0,x:29,y:29},{n:1,x:52,y:28},{n:2,x:75,y:12},{n:3,x:68,y:39},{n:8,x:80,y:25},{n:9,x:86,y:34},{n:10,x:60,y:14}],-.042,56);
 const table=g.canvas;fs.writeFileSync(path.join(out,'engine-table.png'),table.toBuffer('image/png'));
 function playScreen(width,height,phone=false){const c=createCanvas(width,height),q=c.getContext('2d');q.fillStyle='#07111b';q.fillRect(0,0,width,height);const unit=width/1600;q.scale(unit,unit);const h=height/unit;
  text(q,'光域台球',30,37,21,'#f0e9dc',600);text(q,'浮光竞技馆',142,37,11,'#8eaaa9');button(q,'返回',1300,15,74,34);button(q,'全屏',1386,15,74,34);button(q,'规则',1472,15,90,34);
  box(q,111,65,1353,48,8,'#0d1e2a');text(q,'玩家 1 · 全色球',140,97,18,'#a9e0e4');text(q,'0',375,97,23,'#e4c694',600);q.textAlign='center';text(q,'八球 · 双人同屏',777,86,15,'#e4e8df');text(q,'轮到玩家 1',777,103,11,'#85a3b0');q.textAlign='left';text(q,'玩家 2 · 花色球',1172,97,18,'#8dabb4');text(q,'0',1415,97,23,'#e4c694',600);
  const tableX=104,tableY=120,tableW=1360,tableH=tableW*790/1400;q.drawImage(table,tableX,tableY,tableW,tableH);
  box(q,26,124,64,tableH-10,10,'#0b1a25','#2a454f');q.strokeStyle='#2d505f';q.lineWidth=8;q.beginPath();q.moveTo(59,156);q.lineTo(59,tableY+tableH-76);q.stroke();q.strokeStyle='#cbb17c';q.lineWidth=8;q.beginPath();q.moveTo(59,tableY+tableH-76);q.lineTo(59,tableY+tableH-76-(tableH-110)*.56);q.stroke();text(q,'56%',39,tableY+tableH-43,16,'#eed49b');text(q,'下拉',40,tableY+tableH-17,12,'#7ba5ae');
  const x=1480;box(q,x,122,94,74,8,'#0d1d2a','#314b58');q.textAlign='center';text(q,'击球点',x+47,145,12,'#9cb8c2');sphere(q,0,x+47,172,14,'#f7f1e5');q.textAlign='left';button(q,'击球',x,214,94,56,true);button(q,'摆白球',x,285,94,46);button(q,'音乐',x,346,94,46);button(q,'训练',x,407,94,46);
  text(q,'拖动瞄准 · 拉动左侧球杆出杆',116,tableY+tableH+23,12,'#80a3b2');
  const rulerY=tableY+tableH+43;box(q,375,rulerY,820,49,5,'#0b1c28','#2e4956');q.strokeStyle='#668a98';q.lineWidth=1;for(let i=0;i<70;i++){const xx=388+i*11.5;q.beginPath();q.moveTo(xx,rulerY+8);q.lineTo(xx,rulerY+(i%5===0?27:17));q.stroke();}q.fillStyle='#dcc591';q.fillRect(783,rulerY+3,2,29);q.textAlign='center';text(q,'精调  -2.4064°',785,rulerY+42,11,'#b5d3dc');q.textAlign='left';
  return c;
 }
 const desktop=playScreen(1800,1080);fs.writeFileSync(path.join(out,'02-table-layout.png'),desktop.toBuffer('image/png'));
 const phone=playScreen(1600,960,true);fs.writeFileSync(path.join(out,'03-landscape-layout.png'),phone.toBuffer('image/png'));
 const strip=createCanvas(1600,610),sc=strip.getContext('2d');sc.fillStyle='#07121d';sc.fillRect(0,0,1600,610);text(sc,'球越过袋沿，然后下坠。',48,64,30,'#f0e9dc',600);text(sc,'六个袋口共用同一套几何；下面是上中袋的引擎连续帧。',48,98,16,'#8fa9b4');
 const ages=[null,0,.055,.095,.15,.22];
 for(let i=0;i<ages.length;i++){const p=t.fallImage(1,ages[i]),ratio=t.getRenderInfo().ratio;box(sc,35+i*260,133,250,352,8,'#102536');sc.save();sc.beginPath();sc.roundRect(35+i*260,133,250,352,8);sc.clip();sc.drawImage(table,(60+p.well.x*12.8-58)*ratio,(75+p.well.y*12.8-48)*ratio,116*ratio,164*ratio,35+i*260,133,250,352);sc.restore();text(sc,ages[i]===null?'进入前':`${Math.round(ages[i]*1000)} ms`,48+i*260,520,17,'#dcc591');text(sc,['台布支撑','袋沿交接','保持入袋速度','袋沿遮挡','重力下坠','进入袋底'][i],48+i*260,552,15,'#9bb5be');}
 fs.writeFileSync(path.join(out,'04-pocket-frames.png'),strip.toBuffer('image/png'));
 fs.mkdirSync(path.join(out,'fall-animation'),{recursive:true});for(let i=0;i<48;i++){const age=i<8?null:(i-8)/70;const p=t.fallImage(1,age),ratio=t.getRenderInfo().ratio;const c=createCanvas(464,540),cx=c.getContext('2d');cx.fillStyle='#061019';cx.fillRect(0,0,464,540);cx.drawImage(table,(60+p.well.x*12.8-58)*ratio,(75+p.well.y*12.8-42)*ratio,116*ratio,126*ratio,0,0,464,504);text(cx,'光域台球 · 引擎入袋动画',40,528,16,'#b6cfda');fs.writeFileSync(path.join(out,'fall-animation',String(i).padStart(3,'0')+'.png'),c.toBuffer('image/png'));}
 const sheet=createCanvas(1600,1400),sh=sheet.getContext('2d');sh.fillStyle='#040c13';sh.fillRect(0,0,1600,1400);text(sh,'光域台球 / 优化预览',44,55,28,'#f2eadc',600);text(sh,'未部署 · 加载页与操作布局为效果图；球桌与入袋帧来自游戏引擎。',44,88,14,'#8daab7');sh.drawImage(loading,32,118,760,427.5);sh.drawImage(desktop,808,118,760,456);sh.drawImage(strip,32,610,1536,585.6);text(sh,'这一版：更细的拖动 / 高刷新率插值 / 高清缓冲 / 袋沿遮挡 / 分球位音效',44,1290,20,'#c3d4d7');text(sh,'照片看外观；实际帧率、触控手感和声音仍需手机试玩。',44,1330,17,'#93abb6');
 fs.writeFileSync(path.join(out,'pool-preview-overview.png'),sheet.toBuffer('image/png'));
 console.log(JSON.stringify({out,images:6,animationFrames:48,table:t.getRenderInfo()}));
}
main().catch(e=>{console.error(e);process.exitCode=1});
