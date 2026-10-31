import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { editExistingPdf } from './pdfEditor';
import { validatePdfBytes } from './pdf';

// Helper to create a multi-page test PDF
async function createSamplePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page1 = doc.addPage([400, 400]);
  page1.drawText('Page 1 Content');
  const page2 = doc.addPage([400, 400]);
  page2.drawText('Page 2 Content');
  const page3 = doc.addPage([400, 400]);
  page3.drawText('Page 3 Content');
  return await doc.save();
}

test('editExistingPdf reorders, rotates, and deletes pages', async () => {
  const samplePdf = await createSamplePdf();

  // Keep page 2 and page 0 (delete page 1), rotate page 0 by 90 degrees
  const editedBytes = await editExistingPdf(samplePdf, {
    pageStates: [
      { originalIndex: 2, rotation: 0 },
      { originalIndex: 0, rotation: 90 }
    ],
    addPageNumbers: true,
    watermarkText: 'SAMPLE'
  });

  assert.ok(editedBytes instanceof Uint8Array);
  const validation = validatePdfBytes(editedBytes);
  assert.equal(validation.valid, true);

  // Check new page count
  const editedDoc = await PDFDocument.load(editedBytes);
  assert.equal(editedDoc.getPageCount(), 2);
  assert.equal(editedDoc.getPage(1).getRotation().angle, 90);
});

test('editExistingPdf rejects empty page list', async () => {
  const samplePdf = await createSamplePdf();
  await assert.rejects(async () => {
    await editExistingPdf(samplePdf, {
      pageStates: [
        { originalIndex: 0, rotation: 0, deleted: true }
      ]
    });
  }, /At least one page must be retained/);
});
