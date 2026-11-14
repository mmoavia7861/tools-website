"""Isolated document conversion API. Deploy behind an authenticated rate-limiting gateway."""
import asyncio
import os
import tempfile
from pathlib import Path
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pdf2docx import Converter

app = FastAPI(docs_url=None, redoc_url=None)
allowed = [x.strip() for x in os.getenv("ALLOWED_ORIGINS", "").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=allowed, allow_methods=["POST"], allow_headers=["Content-Type"])
MAX_SIZE = 15 * 1024 * 1024

@app.get("/health")
async def health():
    return {"status": "ok"}

def convert_document(source: Path, output: Path, mode: str, workdir: str):
    if mode == "pdf-to-word":
        converter = Converter(str(source))
        try:
            converter.convert(str(output), start=0, end=None)
        finally:
            converter.close()
    else:
        import subprocess
        result = subprocess.run(
            ["libreoffice", "-env:UserInstallation=file://" + workdir + "/lo-profile",
             "--headless", "--convert-to", "pdf:writer_pdf_Export",
             "--outdir", workdir, str(source)],
            capture_output=True, timeout=65, check=False
        )
        if result.returncode != 0 or not output.exists():
            raise RuntimeError("Document conversion failed")

@app.post("/api/convert/{mode}")
async def convert(mode: str, file: UploadFile = File(...)):
    if mode not in ("pdf-to-word", "word-to-pdf"):
        raise HTTPException(404, "Unknown conversion type")
    extension = ".pdf" if mode == "pdf-to-word" else ".docx"
    if not (file.filename or "").lower().endswith(extension):
        raise HTTPException(400, "Unsupported file type")
    content = await file.read(MAX_SIZE + 1)
    await file.close()
    if not content or len(content) > MAX_SIZE:
        raise HTTPException(413, "File must be between 1 byte and 15 MB")
    if mode == "pdf-to-word" and not content.startswith(b"%PDF-"):
        raise HTTPException(400, "Invalid PDF file")
    if mode == "word-to-pdf" and not content.startswith(b"PK\\x03\\x04"):
        raise HTTPException(400, "Invalid DOCX file")
    with tempfile.TemporaryDirectory(prefix="ranknova-") as folder:
        source = Path(folder) / ("input" + extension)
        target = Path(folder) / ("input" + (".docx" if mode == "pdf-to-word" else ".pdf"))
        source.write_bytes(content)
        try:
            await asyncio.wait_for(
                asyncio.to_thread(convert_document, source, target, mode, folder), timeout=75
            )
            if not target.is_file() or target.stat().st_size == 0:
                raise ValueError("No converted file generated")
            data = target.read_bytes()
        except (ValueError, RuntimeError, TimeoutError, Exception) as exc:
            # Never return converter stack traces or document contents.
            raise HTTPException(422, "Could not convert this document. Check that it is not corrupted or encrypted.") from None
    mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document" if mode == "pdf-to-word" else "application/pdf"
    return Response(content=data, media_type=mime, headers={
        "Content-Disposition": 'attachment; filename="converted' + (".docx" if mode == "pdf-to-word" else ".pdf") + '"',
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
    })
