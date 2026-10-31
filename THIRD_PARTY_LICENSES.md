# Third-Party Notices & Dependency Licenses

RankNova adheres to strict commercial license compliance. Below is an audit of core production dependencies, runtime libraries, and AI model adapters.

## Core Libraries

| Package | Version | License | Primary Purpose |
|---|---|---|---|
| `qrcode` | ^1.5.4 | MIT | Client-side QR matrix generation |
| `pdf-lib` | ^1.17.9 | MIT | PDF object stream and dictionary optimization |
| `@google/genai` | ^2.4.0 | Apache 2.0 | Google Gemini Multi-model AI integration |
| `firebase` | ^11.x | Apache 2.0 | Authentication & Firestore client SDK |
| `express` | ^4.21.2 | MIT | Server HTTP runtime & API routing |
| `lucide-react` | ^0.546.0 | ISC | User interface icon set |
| `motion` | ^12.23.24 | MIT | Accessible microanimations |
| `tailwindcss` | ^4.3.3 | MIT | Utility CSS design framework |
| `react` & `react-dom` | ^19.0.1 | MIT | Client-side rendering framework |

## AI Background Removal Provider Licensing Considerations

RankNova adopts an adaptable provider architecture to ensure strict commercial licensing clarity:

1. **Remove.bg API (Default Option A):**
   - Commercial SaaS API.
   - Operated under Remove.bg commercial Terms of Service.
   - Eliminates model weight licensing ambiguity.

2. **Self-Hosted RMBG / Open-Source Models (Option B):**
   - Note: Wrappers such as `rembg` (MIT) do not guarantee that bundled model weights share the same license.
   - For example, BRIA RMBG 2.0 requires a commercial license agreement for commercial deployment.
   - IMG.LY is licensed under AGPL unless an enterprise license is purchased.
   - RankNova strictly requires explicit provider configuration (`REMOVE_BG_API_KEY`) and defaults to a transparent unconfigured status rather than violating terms.
