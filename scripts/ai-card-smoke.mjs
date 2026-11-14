import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { PDFDocument } from 'pdf-lib';
import { chromium } from 'playwright';

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4174', '--strictPort'], {
  stdio: ['ignore', 'pipe', 'pipe']
});
let logs = '';
server.stdout.on('data', data=>{logs+=String(data)});
server.stderr.on('data', data=>{logs+=String(data)});
const base='http://127.0.0.1:4174/RankNova/';
let browser;
try {
  let ok=false;
  for(let i=0;i<60;i++){
    try{const response=await fetch(base+'ai-card-generator/');if(response.ok){ok=true;break;}}catch{}
    await new Promise(resolve=>setTimeout(resolve,400));
  }
  assert.ok(ok,'Preview not ready: '+logs);
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({acceptDownloads:true,viewport:{width:1366,height:960}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  for(const kind of [
    {tab:'Visiting Card',path:'ai-card-generator',headline:'Aisha Khan'},
    {tab:'Wedding Card',path:'wedding-card-maker',headline:'Ali & Ayesha'},
    {tab:'Birthday Card',path:'birthday-card-maker',headline:'Sara'},
  ]){
    await page.goto(base+kind.path+'/',{waitUntil:'domcontentloaded'});
    await page.getByRole('heading',{name:'AI Card Generator & Invitation Maker'}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Generate with Gemini'}).isDisabled(),true,'Gemini unavailable without configured secret');
    await page.getByRole('button',{name:'Create Free Template'}).click();
    await page.getByText('Local template created from recognized details.',{exact:false}).waitFor();
    const canvas=page.getByRole('img',{name:'Preview of your editable card'});
    await canvas.waitFor();
    assert.ok(await canvas.evaluate(el=>el.width>500&&el.height>500));
    // Canvas preview has real pixel content; check primary headline recognized in editable state.
    const fieldLabel=kind.path==='ai-card-generator'?'Full name':kind.path==='wedding-card-maker'?'Couple names':'Birthday person';
    assert.equal(await page.getByLabel(fieldLabel).inputValue(),kind.headline);
    const dlPromise=page.waitForEvent('download',{timeout:10000});
    await page.getByRole('button',{name:'PDF',exact:true}).click();
    const dl=await dlPromise;assert.match(dl.suggestedFilename(),/\.pdf$/);
    const bytes=readFileSync(await dl.path());
    assert.equal(bytes.toString('ascii',0,5),'%PDF-');
    const pdf=await PDFDocument.load(bytes);
    assert.equal(pdf.getPageCount(),1);
    assert.ok(bytes.byteLength>1500);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: visiting, wedding, birthday prompt templates and actual PDF downloads in Chromium');
} finally {
  if(browser)await browser.close();
  server.kill('SIGTERM');
}
