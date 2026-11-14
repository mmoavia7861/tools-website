import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { Document, Packer, Paragraph } from 'docx';
import { chromium } from 'playwright';

const server = spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4175','--strictPort'],{
  stdio:['ignore','pipe','pipe']
});
let log='';
server.stdout.on('data', chunk=>log+=String(chunk));
server.stderr.on('data', chunk=>log+=String(chunk));
const base='http://127.0.0.1:4175/ToolCresta/';
let browser;
try {
  let ready=false;
  for(let n=0;n<60;n++){
    try { const r=await fetch(base+'pdf-to-word/'); if(r.ok){ready=true;break;} }catch{}
    await new Promise(resolve=>setTimeout(resolve,400));
  }
  assert.ok(ready,'Preview did not start: '+log);
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  const page1=pdf.addPage([595,842]);
  page1.drawText('ToolCresta PDF to Word conversion smoke test',{x:50,y:760,size:16,font});
  const pdfBytes=Buffer.from(await pdf.save());

  const docx = new Document({sections:[{children:[new Paragraph('ToolCresta Word to PDF conversion smoke test')]}]});
  const docxBytes=Buffer.from(await Packer.toBuffer(docx));
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({acceptDownloads:true,viewport:{width:1320,height:900}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const testCase of [
    {route:'pdf-to-word',name:'test.pdf',mime:'application/pdf',input:pdfBytes,ext:'.docx',header:'PK'},
    {route:'word-to-pdf',name:'test.docx',mime:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',input:docxBytes,ext:'.pdf',header:'%PDF-'}
  ]) {
    await page.goto(base+testCase.route+'/',{waitUntil:'domcontentloaded'});
    await page.locator('#document-upload').setInputFiles({
      name:testCase.name,mimeType:testCase.mime,buffer:testCase.input
    });
    assert.equal(await page.getByLabel('Adobe PDF Services cloud conversion').isDisabled(),true,
      'Adobe cloud option must not be enabled without API and Turnstile variables');
    const downloadWait=page.waitForEvent('download',{timeout:20000});
    await page.getByRole('button',{name:'Convert in browser & download'}).click();
    const download=await downloadWait;
    assert.ok(download.suggestedFilename().endsWith(testCase.ext));
    const output=readFileSync(await download.path());
    assert.equal(output.toString('latin1',0,testCase.header.length),testCase.header);
    assert.ok(output.length>500);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: PDF-to-Word and Word-to-PDF browser fallback remained functional; Adobe button unavailable without secure backend.');
} finally {
  if(browser) await browser.close();
  server.kill('SIGTERM');
}
