const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
const sheets=['style.css','revamp.css','future.css','mobile.css','refinement.css','equipment.css','arena-theme.css','landscape.css','flight.css'];
fs.writeFileSync(path.join(root,'site.css'),sheets.map(name=>`/* ${name} */\n${read(name)}`).join('\n'));
let html=read('index.html');
html=html.replace(/<!-- CRITICAL_STYLE_START -->[\s\S]*?<!-- CRITICAL_STYLE_END -->/,`<!-- CRITICAL_STYLE_START -->\n  <style>${read('landscape.css')}\n${read('flight.css')}</style>\n  <!-- CRITICAL_STYLE_END -->`);
html=html.replace(/<!-- STARTUP_SCRIPT_START -->[\s\S]*?<!-- STARTUP_SCRIPT_END -->/,`<!-- STARTUP_SCRIPT_START -->\n  <script>${read('landscape.js')}\n${read('startup.js')}</script>\n  <!-- STARTUP_SCRIPT_END -->`);
fs.writeFileSync(path.join(root,'index.html'),html);
console.log('Built one stylesheet and inline critical startup.');
