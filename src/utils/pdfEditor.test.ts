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

test('editExistingPdf embeds visual markup and text on rotated pages', async () => {
  const samplePdf = await createSamplePdf();
  const annotations = [
    { id: 'words', type: 'text' as const, pageIndex: 0, x: 0.12, y: 0.15, width: 0.4, height: 0.08, text: 'Edited Words', fontSize: 14, color: '#000000' },
    { id: 'highlight', type: 'highlight' as const, pageIndex: 0, x: 0.1, y: 0.3, width: 0.5, height: 0.06, color: '#FACC15', opacity: 0.3 },
    { id: 'rectangle', type: 'rectangle' as const, pageIndex: 0, x: 0.3, y: 0.45, width: 0.35, height: 0.15, color: '#EF4444' },
    { id: 'cover', type: 'whiteout' as const, pageIndex: 0, x: 0.2, y: 0.62, width: 0.25, height: 0.1 }
  ];
  for (const rotation of [0, 90, 180, 270]) {
    const result = await editExistingPdf(samplePdf, {
      pageStates: [{ originalIndex: 1, rotation }],
      annotations
    });
    const parsed = await PDFDocument.load(result);
    assert.equal(parsed.getPageCount(), 1);
    assert.equal(parsed.getPage(0).getRotation().angle, rotation);
    assert.ok(result.byteLength > 0);
  }
});
