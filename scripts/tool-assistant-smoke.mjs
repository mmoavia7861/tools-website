import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4179','--strictPort'],{stdio:['ignore','pipe','pipe']});
let log='';
server.stdout.on('data',chunk=>{log+=String(chunk);});
server.stderr.on('data',chunk=>{log+=String(chunk);});
const base='http://127.0.0.1:4179/RankNova/';
let browser;
try {
  let ready=false;
  for(let i=0;i<60;i++) {
    try {const res=await fetch(base+'admin/');if(res.ok){ready=true;break;}} catch {}
    await new Promise(resolve=>setTimeout(resolve,400));
  }
  assert.ok(ready,'Admin entrypoint did not start: '+log);
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const desktop=await browser.newPage({viewport:{width:1366,height:900}});
  await desktop.goto(base+'admin/');
  assert.ok((await desktop.title()).includes('Admin'));
  await desktop.getByRole('button',{name:'Sign in with Google'}).waitFor();
  await desktop.getByRole('button',{name:'Open ToolCresta assistant'}).click();
  await desktop.getByRole('dialog',{name:'ToolCresta card and PDF assistant'}).waitFor();
  await desktop.getByLabel('Ask about cards or PDF tools').fill('PDF ko Word mein convert karo');
  await desktop.getByRole('button',{name:'Ask Guide'}).click();
  await desktop.getByRole('button',{name:'PDF to Word kholein'}).click();
  assert.ok(desktop.url().includes('/RankNova/pdf-to-word/'),'Desktop assistant tool navigation failed');

  const mobileContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const mobile=await mobileContext.newPage();
  await mobile.goto(base);
  await mobile.getByRole('button',{name:'Open ToolCresta assistant'}).click();
  await mobile.getByRole('button',{name:'Wedding card design ideas'}).click();
  await mobile.getByRole('button',{name:'Wedding card banayein'}).click();
  assert.ok(mobile.url().includes('/RankNova/wedding-card-maker/'),'Mobile assistant card navigation failed');
  const prompt=await mobile.locator('#ai-card-prompt').inputValue();
  assert.match(prompt,/Couple: \[both names\]/,'Guide prompt did not reach card maker');
  assert.equal(await mobile.getByRole('button',{name:'Open ToolCresta assistant'}).count(),1);
  await mobileContext.close();
  console.log('PASS: admin direct entrypoint, desktop PDF guide, mobile wedding card prompt handoff.');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
