import React, { useState, useRef, useEffect } from 'react';
import { PDFDocument, PDFTextField } from 'pdf-lib';
import {
  FileText,
  UploadCloud,
  Download,
  RotateCw,
  Trash2,
  Copy,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Sliders,
  Hash,
  Stamp,
  Sparkles,
  Type,
  PenTool,
  Move,
  Maximize2,
  Plus,
  Calendar,
  Check
} from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { AdSlot } from '../components/AdSlot';
import { formatBytes, validatePdfBytes } from '../utils/pdf';
import { editExistingPdf, type PageEditState } from '../utils/pdfEditor';
import {
  type NormalizedElement,
  createDefaultTextElement,
  createSignatureElement,
  reorderArray
} from '../utils/pdfEditorUtils';
import { renderPdfPageToDataUrl, getPdfPageTextHits, type PdfTextHit } from '../utils/pdfRenderer';
import { SignatureModal } from '../components/SignatureModal';

interface NativeTextField {
  name: string;
  originalValue: string;
}

interface PageDisplayItem {
  id: string;
  originalIndex: number;
  originalRotation: number;
  rotation: number;
  width: number;
  height: number;
  thumbnailUrl?: string;
}

export const PDFEditorView: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sourcePdfBytes, setSourcePdfBytes] = useState<Uint8Array | null>(null);
  const [pages, setPages] = useState<PageDisplayItem[]>([]);
  const [focusedPreview, setFocusedPreview] = useState<string | null>(null);
  const [focusedLoading, setFocusedLoading] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(100);
  const [replaceMode, setReplaceMode] = useState(false);
  const [textHits, setTextHits] = useState<PdfTextHit[]>([]);
  const [nativeTextFields, setNativeTextFields] = useState<NativeTextField[]>([]);
  const [nativeFieldChanges, setNativeFieldChanges] = useState<Record<string, string>>({});
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const inlineEditorRef = useRef<HTMLTextAreaElement | null>(null);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);

  // Annotations (Words, Signatures, Stamps) per page
  const [annotations, setAnnotations] = useState<NormalizedElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  // Signature modal state
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [isStampMenuOpen, setIsStampMenuOpen] = useState(false);
  const thumbnailRequestRef = useRef(0);

  // Document-level options
  const [addPageNumbers, setAddPageNumbers] = useState(false);
  const [pageNumberPosition, setPageNumberPosition] = useState<'bottom-center' | 'bottom-right' | 'top-right'>('bottom-center');
  const [watermarkText, setWatermarkText] = useState('');
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.2);
  const [outputFileName, setOutputFileName] = useState('ranknova-edited-document');

  // Processing & Export
  const [isProcessing, setIsProcessing] = useState(false);
  const [editedPdfBytes, setEditedPdfBytes] = useState<Uint8Array | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active page preview canvas / container ref for drag drop
  const pageContainerRef = useRef<HTMLDivElement | null>(null);
  const pageSurfaceRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  // Dragging state for elements
  const [isDraggingElement, setIsDraggingElement] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Load and render page thumbnails when file or rotation changes
  const renderThumbnails = async (bytes: Uint8Array, pageItems: PageDisplayItem[]) => {
    const requestId = ++thumbnailRequestRef.current;
    const updated = pageItems.map(p => ({ ...p }));
    for (let i = 0; i < updated.length; i++) {
      if (requestId !== thumbnailRequestRef.current) return;
      try {
        const url = await renderPdfPageToDataUrl(bytes, updated[i].originalIndex, {
          scale: 0.32,
          rotation: (updated[i].originalRotation + updated[i].rotation) % 360
        });
        updated[i].thumbnailUrl = url;
      } catch (e) {
        console.warn('Thumbnail render issue', e);
        setErrorMessage('Some PDF page previews could not be rendered. Your original PDF has not been modified.');
      }
    }
    if (requestId === thumbnailRequestRef.current) {
      setPages(current => current.map(p => updated.find(item => item.id === p.id) || p));
    }
  };

  // The focused page needs its own full-resolution render, not an enlarged thumbnail.
  useEffect(() => {
    const page = pages[activePageIndex];
    let cancelled = false;
    setFocusedPreview(null);
    if (!sourcePdfBytes || !page) { setFocusedLoading(false); return; }
    setFocusedLoading(true);
    const targetScale = Math.min(2.5, Math.sqrt(9000000 / (page.width * page.height)));
    renderPdfPageToDataUrl(sourcePdfBytes, page.originalIndex, {
      scale: targetScale,
      rotation: (page.originalRotation + page.rotation) % 360
    }).then(url => {
      if (!cancelled) setFocusedPreview(url);
    }).catch(() => {
      if (!cancelled) setErrorMessage('Full-resolution PDF preview could not be rendered. The original PDF has not been changed.');
    }).finally(() => {
      if (!cancelled) setFocusedLoading(false);
    });
    return () => { cancelled = true; };
  }, [sourcePdfBytes, activePageIndex, pages[activePageIndex]?.id, pages[activePageIndex]?.rotation]);

  // Detected text is for visible cover-and-replace only, not underlying PDF changes.
  useEffect(() => {
    const page = pages[activePageIndex];
    let cancelled = false;
    setTextHits([]);
    if (!replaceMode || !sourcePdfBytes || !page || (page.originalRotation + page.rotation) % 360 !== 0) return;
    getPdfPageTextHits(sourcePdfBytes, page.originalIndex).then(hits => {
      if (!cancelled) setTextHits(hits);
    }).catch(() => {
      if (!cancelled) setErrorMessage('Text positions could not be detected in this PDF.');
    });
    return () => { cancelled = true; };
  }, [replaceMode, sourcePdfBytes, activePageIndex, pages[activePageIndex]?.id, pages[activePageIndex]?.rotation]);

  const handleFileSelect = async (file: File) => {
    ++thumbnailRequestRef.current;
    setSelectedFile(null);
    setSourcePdfBytes(null);
    setPages([]);
    setErrorMessage(null);
    setEditedPdfBytes(null);
    setAnnotations([]);
    setFocusedPreview(null);
    setSelectedElementId(null);
    setInlineEditingId(null);
    setReplaceMode(false);
    setNativeTextFields([]);
    setNativeFieldChanges({});

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Please select a valid PDF file with a .pdf extension.');
      return;
    }

    try {
      const buffer = new Uint8Array(await file.arrayBuffer());
      const validation = validatePdfBytes(buffer);

      if (!validation.valid) {
        setErrorMessage(validation.error || 'Invalid PDF file.');
        return;
      }

      const doc = await PDFDocument.load(buffer, { ignoreEncryption: false });
      if (doc.isEncrypted) {
        setErrorMessage('Password-protected or encrypted PDFs cannot be edited without credentials.');
        return;
      }

      const formTextFields = doc.getForm().getFields()
        .filter((field): field is PDFTextField => field instanceof PDFTextField)
        .slice(0, 80)
        .map(field => ({ name: field.getName(), originalValue: field.getText() || '' }));
      setNativeTextFields(formTextFields);

      const pageCount = doc.getPageCount();
      const pageItems: PageDisplayItem[] = [];

      for (let i = 0; i < pageCount; i++) {
        const page = doc.getPage(i);
        const { width, height } = page.getSize();
        pageItems.push({
          id: `page-${i}-${Date.now()}`,
          originalIndex: i,
          originalRotation: page.getRotation().angle,
          rotation: 0,
          width: Math.round(width),
          height: Math.round(height)
        });
      }

      setSelectedFile(file);
      setSourcePdfBytes(buffer);
      setPages(pageItems);
      setActivePageIndex(0);
      setOutputFileName(file.name.replace(/\.pdf$/i, '-edited'));

      // Asynchronously render thumbnails
      renderThumbnails(buffer, pageItems);
    } catch {
      setErrorMessage('Could not decode or parse the selected PDF file.');
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Rotate Page
  const rotatePage = (index: number) => {
    const updated = pages.map((p, i) =>
      i === index ? { ...p, rotation: (p.rotation + 90) % 360 } : p
    );
    setPages(updated);
    setEditedPdfBytes(null);
    if (sourcePdfBytes) {
      renderThumbnails(sourcePdfBytes, updated);
    }
  };

  const rotateAllPages = () => {
    const updated = pages.map((p) => ({ ...p, rotation: (p.rotation + 90) % 360 }));
    setPages(updated);
    setEditedPdfBytes(null);
    if (sourcePdfBytes) {
      renderThumbnails(sourcePdfBytes, updated);
    }
  };

  const resetAllRotations = () => {
    const updated = pages.map((p) => ({ ...p, rotation: 0 }));
    setPages(updated);
    setEditedPdfBytes(null);
    if (sourcePdfBytes) {
      renderThumbnails(sourcePdfBytes, updated);
    }
  };

  // Reorder Pages
  const movePage = (fromIndex: number, direction: 'left' | 'right') => {
    const toIndex = direction === 'left' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= pages.length) return;

    const updated = reorderArray(pages, fromIndex, toIndex);
    setPages(updated);
    setActivePageIndex(toIndex);
    setEditedPdfBytes(null);

    // Update annotation page references to follow the moved page
    setAnnotations((prev) =>
      prev.map((ann) => {
        if (ann.pageIndex === fromIndex) {
          return { ...ann, pageIndex: toIndex };
        } else if (ann.pageIndex === toIndex) {
          return { ...ann, pageIndex: fromIndex };
        }
        return ann;
      })
    );
  };

  // Duplicate Page
  const duplicatePage = (index: number) => {
    const target = pages[index];
    const duplicated: PageDisplayItem = {
      id: `page-dup-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      originalIndex: target.originalIndex,
      originalRotation: target.originalRotation,
      rotation: target.rotation,
      width: target.width,
      height: target.height,
      thumbnailUrl: target.thumbnailUrl
    };
    const updated = [...pages];
    updated.splice(index + 1, 0, duplicated);
    setAnnotations(prev => prev.flatMap(ann => {
      if (ann.pageIndex === index) return [ann, { ...ann, id: ann.id + '-copy-' + duplicated.id, pageIndex: index + 1 }];
      return [{ ...ann, pageIndex: ann.pageIndex > index ? ann.pageIndex + 1 : ann.pageIndex }];
    }));
    setPages(updated);
    setEditedPdfBytes(null);
  };

  // Delete Page
  const deletePage = (index: number) => {
    if (pages.length <= 1) {
      setErrorMessage('A PDF document must have at least one page.');
      return;
    }
    const updated = pages.filter((_, i) => i !== index);
    setPages(updated);
    // Remove annotations for deleted page and shift higher indices
    setAnnotations((prev) =>
      prev
        .filter((ann) => ann.pageIndex !== index)
        .map((ann) => (ann.pageIndex > index ? { ...ann, pageIndex: ann.pageIndex - 1 } : ann))
    );
    setActivePageIndex(current => current > index ? current - 1 : Math.min(current, updated.length - 1));
    setEditedPdfBytes(null);
  };

  // ----------------------------------------------------
  // ANNOTATION TOOLS (Text, Signature, Stamps)
  // ----------------------------------------------------
  const handleAddText = () => {
    const newText = createDefaultTextElement(activePageIndex, 'Type text here...', 0.3, 0.4);
    setAnnotations((prev) => [...prev, newText]);
    setSelectedElementId(newText.id);
    setEditedPdfBytes(null);
  };

  const handleApplySignature = (imageDataUrl: string) => {
    const newSig = createSignatureElement(activePageIndex, imageDataUrl, 0.4, 0.65, 0.32, 0.12);
    setAnnotations((prev) => [...prev, newSig]);
    setSelectedElementId(newSig.id);
    setEditedPdfBytes(null);
  };

  const visuallyReplaceText = (hit: PdfTextHit) => {
    const page = pages[activePageIndex];
    if (!page || (page.originalRotation + page.rotation) % 360 !== 0) return;
    const cover: NormalizedElement = {
      id: `cover-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'whiteout', pageIndex: activePageIndex,
      x: hit.x, y: hit.y, width: hit.width, height: hit.height,
      color: '#FFFFFF'
    };
    const editable = createDefaultTextElement(activePageIndex, hit.text, hit.x, hit.y);
    editable.width = Math.max(hit.width, 0.08);
    editable.height = Math.max(hit.height, 0.03);
    editable.fontSize = Math.max(8, Math.min(36, Math.round(hit.height * page.height * 0.85)));
    editable.fontFamily = 'Helvetica';
    setAnnotations(prev => [...prev, cover, editable]);
    setSelectedElementId(editable.id);
    setInlineEditingId(editable.id);
    setReplaceMode(false);
    setEditedPdfBytes(null);
  };

  const addMarkup = (type: 'highlight' | 'whiteout' | 'rectangle') => {
    const next: NormalizedElement = {
      id: `mark-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      pageIndex: activePageIndex, type,
      x: 0.15, y: 0.3, width: 0.35, height: 0.08,
      color: type === 'rectangle' ? '#EF4444' : '#FACC15',
      opacity: type === 'highlight' ? 0.28 : 1
    };
    setAnnotations(prev => [...prev, next]);
    setSelectedElementId(next.id);
    setEditedPdfBytes(null);
  };

  const handleAddImage = async (file: File) => {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024 || file.size === 0) {
      setErrorMessage('Choose a PNG, JPEG or WebP image up to 5 MB.');
      return;
    }
    setErrorMessage(null);
    const pageIndex = activePageIndex;
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('This image could not be opened.'));
        image.src = url;
      });
      if (image.naturalWidth * image.naturalHeight > 16000000) {
        throw new Error('Image is too large. Try one under 16 megapixels.');
      }
      const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Could not process image in this browser.');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL('image/png');
      const next: NormalizedElement = {
        id: `image-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'image', pageIndex, x: 0.24, y: 0.25,
        width: 0.38, height: Math.min(0.45, Math.max(0.08, 0.38 * canvas.height / canvas.width)),
        imageDataUrl: data
      };
      setAnnotations(prev => [...prev, next]);
      setSelectedElementId(next.id);
      setEditedPdfBytes(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Image could not be loaded.');
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const handleAddStamp = (type: 'APPROVED' | 'CONFIDENTIAL' | 'REJECTED' | 'DATE') => {
    let text: string = type;
    let color = '#15803D'; // Green
    let bg = '#DCFCE7';

    if (type === 'CONFIDENTIAL') {
      color = '#B45309'; // Amber
      bg = '#FEF3C7';
    } else if (type === 'REJECTED') {
      color = '#B91C1C'; // Red
      bg = '#FEE2E2';
    } else if (type === 'DATE') {
      text = new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      color = '#1D4ED8';
      bg = '#DBEAFE';
    }

    const newStamp: NormalizedElement = {
      id: `stamp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'text',
      pageIndex: activePageIndex,
      x: 0.35,
      y: 0.2,
      width: 0.3,
      height: 0.06,
      text,
      fontSize: 18,
      fontFamily: 'HelveticaBold',
      color,
      backgroundColor: bg
    };

    setIsStampMenuOpen(false);
    setAnnotations((prev) => [...prev, newStamp]);
    setSelectedElementId(newStamp.id);
    setEditedPdfBytes(null);
  };

  const updateSelectedElement = (updates: Partial<NormalizedElement>) => {
    if (!selectedElementId) return;
    setAnnotations((prev) =>
      prev.map((ann) => (ann.id === selectedElementId ? { ...ann, ...updates } : ann))
    );
    setEditedPdfBytes(null);
  };

  const deleteSelectedElement = () => {
    if (!selectedElementId) return;
    setAnnotations((prev) => prev.filter((ann) => ann.id !== selectedElementId));
    setSelectedElementId(null);
    setInlineEditingId(null);
    setEditedPdfBytes(null);
  };

  // Dragging logic for elements on page overlay
  const handleElementMouseDown = (
    e: React.PointerEvent,
    element: NormalizedElement
  ) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelectedElementId(element.id);
    setIsDraggingElement(true);

    if (pageSurfaceRef.current) {
      const rect = pageSurfaceRef.current.getBoundingClientRect();
      const clickXNorm = (e.clientX - rect.left) / rect.width;
      const clickYNorm = (e.clientY - rect.top) / rect.height;
      setDragOffset({
        x: clickXNorm - element.x,
        y: clickYNorm - element.y
      });
    }
  };

  const handleContainerMouseMove = (e: React.PointerEvent) => {
    if (!isDraggingElement || !selectedElementId || !pageSurfaceRef.current) return;

    const rect = pageSurfaceRef.current.getBoundingClientRect();
    const currXNorm = (e.clientX - rect.left) / rect.width;
    const currYNorm = (e.clientY - rect.top) / rect.height;

    let newX = currXNorm - dragOffset.x;
    let newY = currYNorm - dragOffset.y;

    // Clamp within 0 and 1
    newX = Math.max(0, Math.min(0.85, newX));
    newY = Math.max(0, Math.min(0.9, newY));

    updateSelectedElement({ x: newX, y: newY });
  };

  const handleContainerMouseUp = () => {
    setIsDraggingElement(false);
  };

  // Export PDF
  const handleExportEditedPdf = async () => {
    if (!sourcePdfBytes || pages.length === 0) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setEditedPdfBytes(null);

    try {
      const pageStates: PageEditState[] = pages.map((p) => ({
        originalIndex: p.originalIndex,
        rotation: p.rotation
      }));

      const resultBytes = await editExistingPdf(sourcePdfBytes, {
        pageStates,
        annotations,
        watermarkText,
        watermarkOpacity,
        addPageNumbers,
        pageNumberPosition,
        textFieldUpdates: nativeFieldChanges
      });

      setEditedPdfBytes(resultBytes);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to apply PDF edits.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!editedPdfBytes) return;

    const blob = new Blob([editedPdfBytes as unknown as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${outputFileName.trim() || 'edited-document'}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  const handleReset = () => {
    ++thumbnailRequestRef.current;
    setIsStampMenuOpen(false);
    setNativeTextFields([]);
    setNativeFieldChanges({});
    setReplaceMode(false);
    setInlineEditingId(null);
    setSelectedFile(null);
    setSourcePdfBytes(null);
    setPages([]);
    setAnnotations([]);
    setSelectedElementId(null);
    setEditedPdfBytes(null);
    setErrorMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    if (inlineEditingId) {
      inlineEditorRef.current?.focus();
      inlineEditorRef.current?.select();
    }
  }, [inlineEditingId]);

  const activePage = pages[activePageIndex];
  const activePageAnnotations = annotations.filter((ann) => ann.pageIndex === activePageIndex);
  const selectedElement = annotations.find((ann) => ann.id === selectedElementId);

  return (
    <>
      <SEOHead
        title="Free PDF Editor Online — Edit Pages, Add Words & Signatures | RankNova"
        description="Edit PDF files online for free. Rearrange pages, rotate pages, add words, text boxes, and digital signatures directly on your documents with 100% on-device privacy."
        canonicalPath="/edit-pdf"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'RankNova PDF Editor',
          applicationCategory: 'UtilityApplication',
          operatingSystem: 'Any',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
        }}
      />

      <div className="py-8 bg-[#F8FAFC]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-8">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-200/80 mb-3">
              <FileText className="h-3.5 w-3.5" />
              <span>Full Page Management • Add Words &amp; Signatures • 100% On-Device Privacy</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Free PDF Editor &amp; Signer
            </h1>
            <p className="mt-2 text-sm sm:text-base text-slate-600">
              Edit PDF pages, rotate, reorder, add words, stamp calligraphy signatures, and place stamps.
              Processed entirely on your device with zero cloud uploads.
            </p>
          </div>

          {!selectedFile ? (
            /* Upload Zone */
            <div className="max-w-3xl mx-auto">
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center hover:border-blue-500 hover:bg-blue-50/20 transition group bg-white shadow-xs"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                />
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 group-hover:scale-105 transition">
                  <UploadCloud className="h-8 w-8" />
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-900">
                  Select or drag &amp; drop your PDF to edit
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Supports standard unencrypted PDF documents up to 25 MB. Files stay in your browser.
                </p>
              </div>

              {errorMessage && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>
          ) : (
            /* Editor Studio Workspace */
            <div className="space-y-6">
              {errorMessage && (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
                  {errorMessage}
                </div>
              )}
              {/* Top Document Summary & Global Toolbar */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shrink-0">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 truncate max-w-xs sm:max-w-md">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {pages.length} Pages • Editing Page {activePageIndex + 1} of {pages.length}
                    </p>
                  </div>
                </div>

                {/* Primary Tools on Current Page */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddText}
                    className="flex items-center gap-1.5 rounded-xl bg-blue-50 border border-blue-200 px-3.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 transition shadow-2xs"
                  >
                    <Type className="h-4 w-4 text-blue-600" />
                    <span>Add Words / Text</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsSignatureModalOpen(true)}
                    className="flex items-center gap-1.5 rounded-xl bg-purple-50 border border-purple-200 px-3.5 py-2 text-xs font-bold text-purple-700 hover:bg-purple-100 transition shadow-2xs"
                  >
                    <PenTool className="h-4 w-4 text-purple-600" />
                    <span>Add Signature</span>
                  </button>

                  <div className="relative group">
                    <button
                      type="button"
                      aria-expanded={isStampMenuOpen}
                      aria-haspopup="menu"
                      onClick={() => setIsStampMenuOpen(open => !open)}
                      className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      <Stamp className="h-3.5 w-3.5 text-slate-600" />
                      <span>Add Stamp</span>
                    </button>
                    <div className={`absolute right-0 top-full mt-1 ${isStampMenuOpen ? "flex" : "hidden"} flex-col bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 z-30 w-44`}>
                      <button
                        type="button"
                        onClick={() => handleAddStamp('APPROVED')}
                        className="px-3 py-1.5 text-xs text-left font-semibold text-emerald-700 hover:bg-emerald-50 rounded-lg flex items-center justify-between"
                      >
                        <span>APPROVED</span>
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddStamp('CONFIDENTIAL')}
                        className="px-3 py-1.5 text-xs text-left font-semibold text-amber-700 hover:bg-amber-50 rounded-lg"
                      >
                        CONFIDENTIAL
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddStamp('REJECTED')}
                        className="px-3 py-1.5 text-xs text-left font-semibold text-red-700 hover:bg-red-50 rounded-lg"
                      >
                        REJECTED
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddStamp('DATE')}
                        className="px-3 py-1.5 text-xs text-left font-semibold text-blue-700 hover:bg-blue-50 rounded-lg flex items-center justify-between"
                      >
                        <span>Today&apos;s Date</span>
                        <Calendar className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => rotatePage(activePageIndex)}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                    title="Rotate Current Page 90°"
                  >
                    <RotateCw className="h-3.5 w-3.5 text-blue-600" />
                    <span>Rotate Page</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleReset}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
                  >
                    Close PDF
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3">
                <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) void handleAddImage(file);
                  e.target.value = '';
                }} />
                <button type="button" onClick={() => imageInputRef.current?.click()} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-blue-50">+ Add Image / Logo</button>
                <button type="button" onClick={() => addMarkup('highlight')} className="rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs font-semibold text-yellow-900">Highlight</button>
                <button type="button" onClick={() => addMarkup('rectangle')} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold">Rectangle</button>
                <button type="button" onClick={() => addMarkup('whiteout')} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold">Cover Text (Visual)</button>
                <button type="button" onClick={() => setReplaceMode(value => !value)} aria-pressed={replaceMode} className={replaceMode ? "rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white" : "rounded-lg border border-blue-300 px-3 py-2 text-xs font-semibold text-blue-700"}>Select Text to Replace (Visual)</button>
                {replaceMode && <p role="status" className="basis-full text-xs font-semibold text-blue-700">{(pages[activePageIndex]?.originalRotation + pages[activePageIndex]?.rotation) % 360 !== 0 ? 'Reset page rotation before selecting existing text.' : textHits.length ? 'Select one of the outlined text fragments on the page.' : 'No selectable text detected yet. Scanned PDFs need OCR.'}</p>}
                <p className="basis-full text-[11px] text-slate-500">To visually replace words: add a white cover over the old text, then choose Add Words / Text. This is not secure redaction: original underlying PDF content may remain extractable.</p>
              </div>

              {/* Main Two-Column Layout: Left Thumbnails + Focused Interactive Page, Right Inspector & Export */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Center / Left 8 Cols */}
                <div className="lg:col-span-8 space-y-4">
                  {/* Selected Element Floating Inspector */}
                  {selectedElement && (
                    <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-3 flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1">
                          {selectedElement.type === 'text' ? (
                            <>
                              <Type className="h-3.5 w-3.5 text-blue-600" />
                              <span>Edit Words:</span>
                            </>
                          ) : (
                            <>
                              <PenTool className="h-3.5 w-3.5 text-purple-600" />
                              <span>{selectedElement.type === 'image' ? 'Image:' : selectedElement.type === 'signature' ? 'Signature:' : 'Markup:'}</span>
                            </>
                          )}
                        </span>

                        {selectedElement.type === 'text' && (
                          <div className="flex flex-col gap-1">
                            <label htmlFor="selected-pdf-text" className="text-[11px] font-semibold text-slate-600">Replacement text</label>
                            <textarea
                              id="selected-pdf-text"
                              rows={2}
                              maxLength={2000}
                              value={selectedElement.text || ''}
                              onChange={(e) => updateSelectedElement({ text: e.target.value })}
                              className="rounded-lg border border-slate-300 px-2.5 py-1 text-sm text-slate-900 w-52 sm:w-72 focus:outline-blue-500"
                              placeholder="Type replacement text..."
                            />
                            <button type="button" onClick={() => setInlineEditingId(selectedElement.id)}
                              className="text-left text-xs font-semibold text-blue-700 hover:underline">
                              Edit directly on PDF page
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {selectedElement.type === 'text' && (
                          <>
                            {/* Font size */}
                            <label className="text-xs text-slate-700 flex items-center gap-1">
                              Size
                              <input type="number" min={6} max={72} step={1}
                                value={selectedElement.fontSize || 16}
                                onChange={e => updateSelectedElement({ fontSize: Math.max(6, Math.min(72, Number(e.target.value) || 6)) })}
                                className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700"
                                aria-label="Text font size" />
                            </label>
                            <label className="text-xs text-slate-700 flex items-center gap-1">
                              Font
                              <select value={selectedElement.fontFamily || 'Helvetica'}
                                onChange={e => updateSelectedElement({ fontFamily: e.target.value as NormalizedElement['fontFamily'] })}
                                className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700">
                                <option value="Helvetica">Sans serif</option>
                                <option value="HelveticaBold">Bold</option>
                                <option value="TimesRoman">Serif</option>
                                <option value="Courier">Monospace</option>
                              </select>
                            </label>

                            {/* Color */}
                            <input
                              type="color"
                              value={selectedElement.color || '#0F172A'}
                              onChange={(e) => updateSelectedElement({ color: e.target.value })}
                              className="h-7 w-7 rounded border border-slate-200 cursor-pointer p-0.5"
                              title="Text Color"
                            />

                            {/* Highlight */}
                            <select
                              value={selectedElement.backgroundColor || 'transparent'}
                              onChange={(e) => updateSelectedElement({ backgroundColor: e.target.value })}
                              className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700"
                              title="Background Highlight"
                            >
                              <option value="transparent">No Highlight</option>
                              <option value="#FEF08A">Yellow</option>
                              <option value="#DBEAFE">Blue</option>
                              <option value="#DCFCE7">Green</option>
                              <option value="#FFFFFF">White</option>
                            </select>
                          </>
                        )}

                        {selectedElement.type !== 'text' && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">Width:</span>
                            <input
                              type="range"
                              min={0.15}
                              max={0.6}
                              step={0.02}
                              value={selectedElement.width}
                              onChange={(e) => updateSelectedElement({ width: parseFloat(e.target.value) })}
                              className="w-24 accent-purple-600"
                            />
                            <span className="text-xs text-slate-500">Height:</span>
                            <input type="range" min={0.03} max={0.6} step={0.01} value={selectedElement.height}
                              onChange={e => updateSelectedElement({ height: parseFloat(e.target.value) })}
                              className="w-20 accent-purple-600" aria-label="Element height" />
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={deleteSelectedElement}
                          className="p-1 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 transition"
                          title="Delete Element"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between rounded-xl bg-white border border-slate-200 p-3 gap-3">
                    <span className="text-xs font-semibold text-slate-700">Sharp PDF preview</span>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setPreviewZoom(v => Math.max(60, v - 20))} className="rounded border px-2 py-1 text-xs" aria-label="Zoom out">−</button>
                      <span className="text-xs tabular-nums">{previewZoom}%</span>
                      <button type="button" onClick={() => setPreviewZoom(v => Math.min(160, v + 20))} className="rounded border px-2 py-1 text-xs" aria-label="Zoom in">+</button>
                    </div>
                  </div>
                  {/* Focused Page Interactive Viewport */}
                  <div
                    ref={pageContainerRef}
                    onPointerMove={handleContainerMouseMove}
                    onPointerUp={handleContainerMouseUp}
                    onPointerCancel={handleContainerMouseUp}
                    onClick={() => setSelectedElementId(null)}
                    className="relative w-full rounded-2xl border-2 border-slate-300 bg-slate-100 shadow-inner min-h-[520px] flex items-center justify-center p-4 overflow-auto select-none"
                  >
                    {activePage && (
                      <div
                        ref={pageSurfaceRef}
                        className="relative bg-white shadow-xl rounded-lg overflow-hidden"
                        style={{
                          width: '100%',
                          maxWidth: `${Math.round(560 * previewZoom / 100)}px`,
                          aspectRatio: (activePage.originalRotation + activePage.rotation) % 180 === 0
                            ? `${activePage.width} / ${activePage.height}`
                            : `${activePage.height} / ${activePage.width}`
                        }}
                      >
                        {/* Rendered Background of PDF Page */}
                        {focusedPreview ? (
                          <img
                            src={focusedPreview}
                            alt={`High-resolution preview of page ${activePageIndex + 1}`}
                            className="w-full h-full object-contain pointer-events-none"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-white">
                            <FileText className="h-16 w-16 text-slate-300 mb-2" />
                            <p className="text-sm font-semibold text-slate-600">
                              Page {activePageIndex + 1}
                            </p>
                            <p className="text-xs text-slate-400">
                              {activePage.width} × {activePage.height} pts
                            </p>
                          </div>
                        )}

                        {replaceMode && (activePage.originalRotation + activePage.rotation) % 360 === 0 && textHits.map((hit, index) => (
                          <button key={index} type="button"
                            onClick={event => { event.stopPropagation(); visuallyReplaceText(hit); }}
                            title={'Visually replace: ' + hit.text.slice(0, 80)}
                            aria-label={'Visually replace: ' + hit.text.slice(0, 60)}
                            className="absolute z-10 cursor-text border border-blue-500 bg-blue-200/20 hover:bg-blue-300/40"
                            style={{ left: (hit.x * 100) + '%', top: (hit.y * 100) + '%',
                              width: (hit.width * 100) + '%', height: (hit.height * 100) + '%' }}
                          />
                        ))}
                        {/* Interactive Annotations Overlay on Page */}
                        {activePageAnnotations.map((element) => {
                          const isSelected = selectedElementId === element.id;
                          return (
                            <div
                              key={element.id}
                              onPointerDown={(e) => { if (inlineEditingId !== element.id) handleElementMouseDown(e, element); }}
                              onDoubleClick={e => { e.stopPropagation(); if (element.type === 'text') setInlineEditingId(element.id); }}
                              onClick={e => e.stopPropagation()}
                              className={`absolute cursor-move touch-none transition-shadow rounded-sm ${
                                isSelected
                                  ? 'ring-2 ring-blue-500 ring-offset-1 shadow-md'
                                  : 'hover:ring-1 hover:ring-blue-400'
                              }`}
                              style={{
                                left: `${element.x * 100}%`,
                                top: `${element.y * 100}%`,
                                width: `${element.width * 100}%`,
                                height: element.type === 'text' ? undefined : `${element.height * 100}%`,
                                minHeight: element.type === 'text' ? '24px' : undefined
                              }}
                            >
                              {element.type === 'text' && (inlineEditingId === element.id ? (
                                <div onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}
                                  className="relative z-20 w-full min-w-[180px]">
                                  <textarea ref={inlineEditorRef} autoFocus rows={3} maxLength={2000}
                                    value={element.text || ''}
                                    onChange={e => updateSelectedElement({ text: e.target.value })}
                                    onKeyDown={e => {
                                      if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
                                        e.stopPropagation();
                                        setInlineEditingId(null);
                                      }
                                    }}
                                    aria-label="Edit PDF replacement text"
                                    className="w-full min-h-[72px] rounded border-2 border-blue-600 bg-white p-2 text-slate-900 shadow-lg"
                                    style={{ fontSize: '14px', fontFamily: 'sans-serif' }} />
                                  <button type="button" onClick={e => { e.stopPropagation(); setInlineEditingId(null); }}
                                    className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white shadow">Done</button>
                                </div>
                              ) : (
                                <div
                                  className="px-2 py-0.5 rounded font-sans leading-tight whitespace-pre-wrap select-none"
                                  style={{
                                    fontSize: `${element.fontSize || 16}px`,
                                    color: element.color || '#000000',
                                    backgroundColor: element.backgroundColor || 'transparent',
                                    fontFamily:
                                      element.fontFamily === 'TimesRoman'
                                        ? 'Georgia, serif'
                                        : element.fontFamily === 'Courier'
                                        ? 'monospace'
                                        : 'sans-serif',
                                    fontWeight: element.fontFamily === 'HelveticaBold' ? 'bold' : 'normal'
                                  }}
                                >
                                  {element.text || 'Text'}
                                </div>
                              ))}

                              {(element.type === 'signature' || element.type === 'image') && element.imageDataUrl && (
                                <img
                                  src={element.imageDataUrl}
                                  alt="Signature"
                                  className="w-full h-auto object-contain pointer-events-none select-none drop-shadow-2xs"
                                />
                              )}

                              {(element.type === 'highlight' || element.type === 'whiteout' || element.type === 'rectangle') && (
                                <div className="h-full w-full" style={{
                                  backgroundColor: element.type === 'highlight' ? 'rgba(250, 204, 21, .28)' : element.type === 'whiteout' ? '#fff' : 'transparent',
                                  border: element.type === 'rectangle' ? `2px solid ${element.color || '#ef4444'}` : element.type === 'whiteout' ? '1px dashed #94a3b8' : 'none'
                                }} />
                              )}
                              {isSelected && (
                                <div className="absolute -top-3 -right-3 flex items-center gap-1 bg-white border border-slate-200 rounded-full shadow-xs px-1.5 py-0.5 text-[10px] text-slate-500 font-semibold pointer-events-none">
                                  <Move className="h-2.5 w-2.5 text-blue-600" />
                                  <span>Drag to position</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Horizontal Thumbnail Page Navigator Strip */}
                  <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <span>Document Pages ({pages.length})</span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        Click to select page • Use arrows to reorder
                      </span>
                    </div>

                    <div className="flex items-center gap-3 overflow-x-auto pb-2 pt-1 scrollbar-thin">
                      {pages.map((p, idx) => {
                        const isActive = idx === activePageIndex;
                        return (
                          <div
                            key={p.id}
                            className={`flex-shrink-0 w-28 rounded-xl border-2 p-1.5 transition text-center flex flex-col justify-between ${
                              isActive
                                ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                                : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setActivePageIndex(idx)}
                              className="w-full h-28 rounded bg-white border border-slate-200 flex items-center justify-center overflow-hidden mb-1.5 relative group"
                            >
                              {p.thumbnailUrl ? (
                                <img
                                  src={p.thumbnailUrl}
                                  alt={`Page ${idx + 1}`}
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <FileText className="h-8 w-8 text-slate-300" />
                              )}
                              <span className="absolute bottom-1 right-1 bg-slate-900/80 text-white text-[10px] px-1.5 py-0.2 rounded font-mono">
                                p.{idx + 1}
                              </span>
                            </button>

                            {/* Page Controls */}
                            <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[10px]">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => movePage(idx, 'left')}
                                className="p-0.5 rounded text-slate-500 hover:text-slate-800 disabled:opacity-20"
                                title="Move Earlier"
                              >
                                <ArrowLeft className="h-3 w-3" />
                              </button>

                              <button
                                type="button"
                                onClick={() => rotatePage(idx)}
                                className="p-0.5 rounded text-blue-600 hover:bg-blue-100"
                                title="Rotate 90°"
                              >
                                <RotateCw className="h-3 w-3" />
                              </button>

                              <button
                                type="button"
                                onClick={() => duplicatePage(idx)}
                                className="p-0.5 rounded text-slate-600 hover:bg-slate-200"
                                title="Duplicate"
                              >
                                <Copy className="h-3 w-3" />
                              </button>

                              <button
                                type="button"
                                onClick={() => deletePage(idx)}
                                className="p-0.5 rounded text-red-500 hover:bg-red-50"
                                title="Delete"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>

                              <button
                                type="button"
                                disabled={idx === pages.length - 1}
                                onClick={() => movePage(idx, 'right')}
                                className="p-0.5 rounded text-slate-500 hover:text-slate-800 disabled:opacity-20"
                                title="Move Later"
                              >
                                <ArrowRight className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right 4 Cols: Document Annotations & Final Export */}
                <div className="lg:col-span-4 space-y-5">
                  <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                      <Sliders className="h-4 w-4 text-blue-600" />
                      <span>Document Options</span>
                    </h3>

                    {/* Page Numbers */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                        <input
                          type="checkbox"
                          checked={addPageNumbers}
                          onChange={(e) => {
                            setAddPageNumbers(e.target.checked);
                            setEditedPdfBytes(null);
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <Hash className="h-3.5 w-3.5 text-blue-600" />
                        <span>Stamp Page Numbers</span>
                      </label>

                      {addPageNumbers && (
                        <div className="pl-5 pt-1">
                          <label htmlFor="num-pos" className="block text-[11px] text-slate-500 mb-1">
                            Number Position
                          </label>
                          <select
                            id="num-pos"
                            value={pageNumberPosition}
                            onChange={(e) => {
                              setPageNumberPosition(e.target.value as any);
                              setEditedPdfBytes(null);
                            }}
                            className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800"
                          >
                            <option value="bottom-center">Bottom Center (e.g. &quot;1 / 4&quot;)</option>
                            <option value="bottom-right">Bottom Right Corner</option>
                            <option value="top-right">Top Right Header</option>
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Text Watermark */}
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <label htmlFor="edit-watermark" className="block text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        <Stamp className="h-3.5 w-3.5 text-purple-600" />
                        <span>Document Watermark</span>
                      </label>
                      <input
                        id="edit-watermark"
                        type="text"
                        value={watermarkText}
                        onChange={(e) => {
                          setWatermarkText(e.target.value);
                          setEditedPdfBytes(null);
                        }}
                        placeholder="e.g. CONFIDENTIAL, DRAFT"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                      {watermarkText.trim() !== '' && (
                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                          <span>Opacity: {Math.round(watermarkOpacity * 100)}%</span>
                          <input
                            type="range"
                            min={0.1}
                            max={0.6}
                            step={0.05}
                            value={watermarkOpacity}
                            onChange={(e) => {
                              setWatermarkOpacity(parseFloat(e.target.value));
                              setEditedPdfBytes(null);
                            }}
                            className="w-24 accent-blue-600"
                          />
                        </div>
                      )}
                    </div>

                    {/* Global Page Sequence Operations */}
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        Batch Page Controls
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={rotateAllPages}
                          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition flex items-center justify-center gap-1"
                        >
                          <RotateCw className="h-3 w-3 text-blue-600" />
                          <span>Rotate All 90°</span>
                        </button>
                        <button
                          type="button"
                          onClick={resetAllRotations}
                          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition flex items-center justify-center gap-1"
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>Reset Rotations</span>
                        </button>
                      </div>
                    </div>

                    {/* Output Filename */}
                    <div>
                      <label htmlFor="edit-fname" className="block text-xs font-medium text-slate-700 mb-1">
                        Export Filename
                      </label>
                      <div className="flex items-center">
                        <input
                          id="edit-fname"
                          type="text"
                          value={outputFileName}
                          onChange={(e) => setOutputFileName(e.target.value)}
                          className="w-full rounded-l-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                        <span className="rounded-r-xl border border-l-0 border-slate-300 bg-slate-100 px-3 py-2 text-xs font-mono text-slate-500">
                          .pdf
                        </span>
                      </div>
                    </div>

                    {/* Apply & Export Action */}
                    <button
                      type="button"
                      disabled={isProcessing || pages.length === 0}
                      onClick={handleExportEditedPdf}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 px-6 font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50 transition"
                    >
                      {isProcessing ? (
                        <>
                          <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Baking Text &amp; Signatures into PDF...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          <span>Save &amp; Export PDF ({pages.length} Pages)</span>
                        </>
                      )}
                    </button>

                    {/* Download Ready Box */}
                    {editedPdfBytes && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-3 animate-in fade-in">
                        <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          <span>Edited PDF Ready for Download!</span>
                        </div>
                        <p className="text-xs text-emerald-700">
                          Export Size: <strong>{formatBytes(editedPdfBytes.byteLength)}</strong>
                        </p>
                        <button
                          type="button"
                          onClick={handleDownload}
                          className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 px-4 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition"
                        >
                          <Download className="h-4 w-4" />
                          <span>Download {outputFileName || 'edited-document'}.pdf</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Privacy Badge */}
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-emerald-900 flex items-start gap-3">
                    <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Private On-Device PDF Processing</p>
                      <p className="mt-0.5 text-emerald-800">
                        Words, calligraphy signatures, page rotations, and stamps are rendered directly in browser memory. No confidential document data is ever stored on external servers.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Reserved Compliant Ad */}
          <div className="mt-12">
            <AdSlot slotId="pdf-editor-bottom" format="horizontal" />
          </div>

          {/* Educational Guide */}
          <div className="mt-16 bg-white rounded-2xl border border-slate-200/90 p-8 sm:p-12 space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                How to Edit PDF Pages, Add Words, and Sign Documents
              </h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                RankNova gives you desktop-grade PDF editing without pricey subscription software.
                Rearrange pages, rotate upside-down scans, add words or dates, and sign contracts with 100% on-device privacy.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Add Words &amp; Annotations</h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Place custom text anywhere on any page. Adjust font family, font size, text color, and background highlight with drag-and-drop ease.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Draw or Type Signatures</h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Sign electronically using your mouse or finger, choose from elegant cursive handwriting styles, or upload your own signature image.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Reorder &amp; Rotate Pages</h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Reorganize pages using intuitive sequence controls, delete unneeded sheets, and rotate individual slides without losing vector quality.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Signature Studio Modal */}
      <SignatureModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        onApplySignature={handleApplySignature}
      />
    </>
  );
};
