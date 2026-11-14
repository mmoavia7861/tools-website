# RankNova document conversion service

PDF → DOCX uses pdf2docx (text-based PDFs only); DOCX → PDF uses headless LibreOffice.

## Local
```sh
docker build -t ranknova-converter .
docker run --rm -p 8080:8080 -e ALLOWED_ORIGINS=https://mmoavia7861.github.io ranknova-converter
```

## Production deployment prerequisites
Deploy to a container host with memory and CPU limits, HTTPS, request body limit (15 MB), concurrency limits, rate limiting, malware screening, network egress restrictions, and abuse protection. **Do not publicly expose this endpoint without a gateway-level rate limiter**; CORS does not prevent direct API abuse. Limit accepted ZIP decompression sizes for DOCX, use sandboxing and consider antivirus scanning before accepting untrusted documents. Configure VITE_CONVERTER_API_URL to the HTTPS origin when building the frontend. GitHub Pages alone cannot run this service. Do not enable the UI until the backend is tested and operational.

Documents are processed in temporary directories and deleted after request completion. Infrastructure logs and gateway policies require a separate privacy review. Avoid promising perfect layout fidelity or OCR.
