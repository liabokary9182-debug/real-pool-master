const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
module.exports=function loadGame({raster=false}={}){
  let native=null;if(raster)native=require('@napi-rs/canvas');
  const noop=()=>{};
  function element(){
    const classes=new Set(),handlers={},styles={};
    return {handlers,styles,style:{setProperty:(k,v)=>styles[k]=v},classList:{add:(k)=>classes.add(k),remove:(k)=>classes.delete(k),contains:(k)=>classes.has(k),toggle:(k,on)=>on?classes.add(k):classes.delete(k)},focus:noop,setAttribute:noop,addEventListener:(k,f)=>handlers[k]=f,querySelector:()=>element(),clientHeight:350,clientWidth:1440,getBoundingClientRect:()=>({left:0,top:0,right:1400,width:1400,height:790}),remove:noop,setPointerCapture:noop,hasPointerCapture:()=>false};
  }
  const mockContext=new Proxy({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4)}),createLinearGradient:()=>({addColorStop:noop}),createRadialGradient:()=>({addColorStop:noop})},{get:(t,k)=>k in t?t[k]:noop,set:(t,k,v)=>{t[k]=v;return true}});
  function canvas(){return Object.assign(native?native.createCanvas(1,1):{width:1,height:1,getContext:()=>mockContext,toDataURL:()=>''},element());}
  const ids=new Map(),main=canvas(),parsed=[];ids.set('game',main);
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  for(const match of html.matchAll(/<[a-z][a-z0-9-]*\b([^>]*?)>/gi)){
    const attributes={};for(const a of match[1].matchAll(/([\w-]+)="([^"]*)"/g))attributes[a[1]]=a[2];
    const e=attributes.id==='game'?main:element();e.attributes=attributes;e.dataset={};
    for(const [key,value] of Object.entries(attributes))if(key.startsWith('data-'))e.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=value;
    for(const c of (attributes.class||'').split(/\s+/).filter(Boolean))e.classList.add(c);
    if(attributes.id)ids.set(attributes.id,e);parsed.push(e);
  }
  const document={getElementById:id=>{if(!ids.has(id))ids.set(id,element());return ids.get(id)},createElement:type=>type==='canvas'?canvas():element(),querySelectorAll:selector=>{const a=selector.match(/^\[([\w-]+)\]$/);return a?parsed.filter(e=>a[1] in e.attributes):[];},addEventListener:noop,body:ids.get('mobile-pool-preview')};
  class ReferenceImage{
    set src(v){if(!native)return;native.loadImage(path.join(__dirname,'..',v)).then(image=>{Object.assign(this,{width:image.width,height:image.height});this.image=image;this.onload?.();}).catch(e=>{throw e});}
  }
  // Native drawImage requires a native Image, so load it with the same onload contract.
  const ImageClass=native?class extends native.Image{set src(v){queueMicrotask(()=>{super.src=fs.readFileSync(path.join(__dirname,'..',v));});}get src(){return super.src;}}:ReferenceImage;
  const sandbox={document,Image:ImageClass,location:{search:'?test'},URLSearchParams,performance,crypto:require('node:crypto').webcrypto,setTimeout:noop,requestAnimationFrame:noop,console,Uint8ClampedArray,Uint32Array};
  sandbox.window=sandbox;sandbox.devicePixelRatio=1;sandbox.matchMedia=()=>({matches:false});
  vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(__dirname,'../game.js'),'utf8'),sandbox);
  return {window:sandbox,canvas:main,ids,elements:parsed};
};
