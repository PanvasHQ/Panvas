# FEATURES.md — Reference Feature List

Compiled from GoodNotes, Notability, and OneNote (as of 2026). Use this to decide what to build first vs. later for your app. Grouped by category, with which app(s) do it well noted.

---

## Ink & Handwriting
- **Scribble to erase** (GoodNotes) — scratch out a word/line with the pen and it's deleted, no tool switch needed.
- **Circle/lasso to select** (GoodNotes) — draw a circle around content and it auto-converts into a selection you can move, resize, or delete.
- **Multiple eraser modes** — precision erase, whole-stroke erase, and an eraser that only removes highlighter/tape without touching underlying ink (GoodNotes).
- **Handwriting reflow / "Smart Ink"** (GoodNotes) — edit handwriting like typed text: drag to resize, auto-reflow line wrapping, straighten lines, cut/paste handwritten strokes.
- **Handwriting-to-text search** — search finds words even inside your handwriting, not just typed text (all three apps to varying degrees).
- **Math equation recognition** — handwritten equations get converted/solved (GoodNotes).
- **Pressure-sensitive pen styles** — multiple brush/pen types simulating real media (fountain pen, brush pen, etc.) (GoodNotes, Notability).
- **Ruler / shape tools** — draw straight lines, perfect circles/shapes from rough strokes (GoodNotes).

## Organization
- **Notebook shelf/library view** — visual thumbnail grid of notebooks, not just a file list (GoodNotes).
- **Notebook → Section → Page hierarchy** — deep nested structure (OneNote's core model; Notability uses Subject → Note).
- **Multi-level outline / table of contents** — jump to any section within a long document (GoodNotes).
- **Tabs for multiple open documents** — switch between notes without losing your place, each stays open in the background (GoodNotes).
- **Tags** — label notes by type/topic for cross-notebook filtering (OneNote).
- **Trash & recovery** — deleted pages/notebooks/folders are recoverable, not gone instantly (GoodNotes).

## Multimedia & Input
- **Audio recording synced to notes** — record a lecture/meeting; tap any word later and it jumps to that exact moment in the audio (Notability's signature feature; GoodNotes has added a version too).
- **Freeform canvas placement** — click/type/draw anywhere on an infinite page, not constrained to a linear top-down flow (OneNote's core differentiator).
- **Import & annotate PDFs, images, slides** — markup directly on top of imported documents (all three).
- **Insert content blocks via slash-command** — paragraphs, headings, tables, to-dos, code blocks, math, images, video (GoodNotes' newer "text document" mode, Notion-style).
- **Embed images/video directly on a page** (OneNote, GoodNotes).

## AI-assisted features (increasingly standard as of 2026)
- **Auto-generated summaries** from handwritten/typed/audio notes ("Smart Notes" in Notability).
- **Real-time transcription of recorded audio**, searchable afterward (Notability).
- **Chat with your notes** — ask questions about a note/PDF/recording and get answers grounded in that content (Notability).
- **Convert chat/AI output directly into a note or diagram** (GoodNotes' ChatGPT import feature).

## Templates & Customization
- **Marketplace for templates, planners, stickers, covers** — from official and third-party creators (GoodNotes).
- **Custom folder/notebook colors and icons** (GoodNotes).
- **Custom fonts** installable for typed text (GoodNotes).
- **Interactive exam practice templates** — fillable practice tests inside the app (GoodNotes Marketplace).

## Cross-platform & Sync
- **Real-time sync across devices** — start on one device, continue on another mid-note (GoodNotes, OneNote via cloud).
- **Cross-platform parity** — GoodNotes and OneNote both run on iOS, Android, Windows, Mac, and web, though feature parity between platforms is often uneven (a good gap for you to close).
- **Multiple windows / split view** — two notebooks open side by side, each independently usable (GoodNotes, Notability).
- **Presentation mode** — show a note full-screen, clean of UI chrome, for teaching/presenting (GoodNotes).

## Small but well-loved details
- **Hover preview** — see a stroke preview before committing ink, useful with a stylus (GoodNotes).
- **Sticky notes** that float above the page content (GoodNotes).
- **Time Keeper** — an on-canvas timer widget, popular for exam practice (GoodNotes).
- **Quick undo/redo gestures** (two/three-finger tap, not just a button).
- **Board limits** — optional constraint to keep an "infinite canvas" from sprawling uncontrollably (GoodNotes).

---

## Note on "free notes"
I wasn't 100% sure which app you meant here — if you meant **Apple Freeform** (the whiteboard-style app), its standout traits are: infinite zoomable canvas, freely placeable sticky notes/shapes/media, and real-time multi-user collaboration on the same board. Let me know if that's the one and I'll fold its specifics in — otherwise this covers Notability under the "scribble to erase"-style gesture set already listed above (that gesture is actually a GoodNotes feature, worth double-checking which app you originally saw it in).

## Status & build priority for V1
1. ✅ **Core ink engine + scribble-to-erase + lasso select + Draw-to-Shape** (Complete)
2. ✅ **Notebook/section/page hierarchy + shelf/library view** (Complete)

3. ✅ **PDF import + in-place vector annotation + page ops + export/print** (Complete)
4. ✅ **Canvas ↔ Notebook hierarchy interoperability + Voice Notes + Draw-to-Shape** (Complete)
5. 🟡 **Handwriting → editable text conversion final UX** (Next: selection toolbar trigger, baseline/layout polish)
6. 🟡 **Provider-neutral Cloud Sync (Google Drive Electron + browser/PWA implemented and automated-tested; runtime retest/verification pending; OneDrive not implemented)** (Final major V1 feature)
7. 🔴 **Security, stability, release hardening, and desktop/browser packaging** (Final V1 gate)

## V2 / Future features
- **V2**: Time Keeper study timer widget, General/scanned PDF OCR, Audio-to-ink synchronization, Audio transcription, Advanced handwriting math → LaTeX, Smart handwriting reflow, Template Marketplace & sharing, optional Canvas diagram copy/transfer into notebook pages.
- **FUTURE / V3**: Ground-truth AI note assistant, Multiplayer real-time collaboration, Professional art engine, Native mobile app store binaries, Plugin/extension runtime.

---

# Planned — Panvas AI & Subscription Architecture

STATUS: PLANNED / NOT IMPLEMENTED

> **Scope Note**: This section represents architecture and product planning only. It does not reflect implemented production code, active database schemas, live backend services, or payment provider integrations. Treat current source code as the primary authority.

---

## 1. Product Principle

Panvas Core remains completely free and local-first.

The primary paid tier is dedicated strictly to optional AI functionality, as hosted AI operations incur ongoing API consumption and backend infrastructure costs. Normal Panvas functionality must continue working completely unimpeded without an AI subscription.

Core features that remain permanently free and operational without AI or subscriptions:
- Local-first notebooks, sections, and pages
- Vector handwriting and inking engine
- PDF viewing, annotation, page manipulation, and export
- Freeform canvas (Excalidraw integration)
- Rich text editing (TipTap, Markdown, KaTeX LaTeX)
- Notebook organization, shelf/library views, recents, favorites, and trash recovery
- Local deterministic search
- Exporting and printing capabilities
- Normal notebook features, audio notes, and templates

AI is strictly additive and must never be a prerequisite to using Panvas.

---

## 2. Panvas AI Product Model

Three distinct access modes govern AI capabilities:

### A. Panvas AI Trial
Every new user receives a hosted evaluation allotment:
- **Allowance**: Exactly 2 hosted AI queries/actions total across the account/client.
- **Constraint Guard**: Requests are strictly bounded—not unlimited. Each request enforces maximum input size, token budget, file/page limits, and reasonable image/vision dimensions.
- **Paywall Transition**: Once both trial queries are consumed, Panvas presents a subscription/paywall prompt.
- **Non-blocking**: Panvas Core remains completely unlocked and functional after trial exhaustion.

### B. Panvas AI Subscription
Subscribed users receive an extended hosted AI allowance:
- **Pricing & Limits**: Exact pricing, monthly token allowance, and usage limits are **TBD** (to be determined based on commercial viability and provider agreements; no numbers are assumed or fabricated at this stage).
- **Potential Paid Capabilities (Planned Ideas)**:
  - Summarize current page
  - Summarize section
  - Summarize entire notebook
  - Summarize workspace
  - Ask questions about a notebook
  - Ask questions across an entire workspace
  - PDF Q&A and document intelligence
  - Handwriting understanding and semantic interpretation
  - OCR / visual diagram and note understanding
  - Semantic search and AI-assisted search ranking
  - Explain selected content or formula
  - Simplify, rewrite, expand, or format selected content
  - Generate structured study notes
  - Generate flashcards
  - Generate interactive quizzes
  - Extract key points and action items
  - Extract tasks and deadlines
  - Voice-note transcription and summarization (where supported)
  - Cross-notebook retrieval
  - Optional model selection
  - Future AI-assisted organization, categorization, and tagging

### C. BYOK — Bring Your Own Key
Advanced users may optionally supply their own supported AI provider API key:
- **Direct Consumption**: User AI requests bypass Panvas-hosted quotas and route using the user's personal credentials.
- **Quota Preservation**: Hosted Panvas AI trial/subscription allowances are not consumed when BYOK is active.
- **Billing Ownership**: The user is billed directly by their chosen provider under their personal account.
- **Supported Providers**: Google Gemini and additional legitimate commercial providers added later.
- **Integrity Rule**: No reliance on unofficial, scraped, or reverse-engineered free endpoints with ambiguous terms of service.

---

## 3. High-Level AI Flow

```text
User invokes AI action
        ↓
Does the user have BYOK enabled?
        ↓
YES ──→ Route through BYOK provider configuration
        → Use user's provider credential
        → Return response to client

NO
↓
Is Panvas AI trial or subscription entitlement available?
↓
YES ──→ Request Panvas backend service
        → Authenticate user
        → Check quota & entitlement
        → Check per-user & global rate limits
        → Validate request payload & bounds
        → Call hosted AI provider
        → Return response to client

NO
↓
Display modal:
"Continue with Panvas AI"
Options:
  [ Subscribe to Panvas AI ]
  [ Add your own API key (BYOK) ]
(Panvas Core remains completely usable in the background)
```

---

## 4. Hosted AI Backend

Panvas-owned API credentials must **NEVER** be packaged or exposed inside:
- The client browser JavaScript bundle
- The Electron renderer process
- Public environment variables (`VITE_*`)
- Stored notebook or workspace files

Hosted provider keys reside solely within secure server-side infrastructure on the Panvas backend.

### Request Flow
1. **Panvas client** initiates an authenticated HTTPS request to the Panvas backend proxy.
2. **Panvas backend** authenticates the user session and validates their active entitlement.
3. **Entitlement & Rate Limiter** validates quota availability and throttles request frequency.
4. **Context Preparer** validates payload schema, token bounds, and sanitizes input.
5. **AI Provider Gateway** calls the designated upstream provider API over secure channels.
6. **AI Provider** executes inference on its commercial cloud infrastructure (never on personal machines).
7. **Panvas backend** records minimal accounting metadata and streams/returns the response to the Panvas client.

---

## 5. Provider / Key Pool Architecture

The backend architecture is conceptually designed around a provider pool rather than static, hardcoded credentials:
- Supports multiple server-side credentials and multi-provider redundancy (e.g., Gemini Credential Pool A/B/C, plus future secondary providers).
- Avoids rigid assumptions around specific key counts.

### Provider-Pool Conceptual Metadata
- `provider`: Upstream provider identifier (e.g., `google-gemini`)
- `model`: Specific model deployment target
- `enabled`: Administrative toggle
- `healthState`: Live health classification (`healthy`, `degraded`, `failing`)
- `quotaState`: Utilization against upstream tier limits
- `temporaryCooldown`: Timestamp until which a throttled credential is withheld
- `requestCount`: Cumulative requests dispatched
- `tokenUsage`: Aggregated input/output token count
- `estimatedCost`: Estimated cumulative expenditure
- `failureState`: Error counter and last failure reason

### Routing & Compliance
- Requests select an active, healthy, non-cooldown credential matching the required model capability.
- Temporary rate-limit errors trigger cooldown markers and allow failover to another eligible credential *where permitted*.
- **Compliance Mandate**: Key rotation must strictly adhere to commercial provider terms of service and acceptable use policies. It must never be used to circumvent quotas, abuse free tiers, or evade provider-enforced account restrictions.

---

## 6. Notebook Context & Scope-Aware RAG

Panvas will **never** transmit an entire notebook or workspace on every prompt. Context preparation follows strict scope boundaries:

### Scope Granularity
- **"Summarize this page"**: Only the active page's text, handwriting transcripts, and relevant media.
- **"Summarize this section"**: Only pages belonging to the active section.
- **"Ask this notebook"**: Selective retrieval of top-k relevant chunks indexed from the notebook.
- **"Ask workspace"**: Selective retrieval of relevant chunks across the indexed workspace scope.

### Retrieval-Augmented Generation (RAG) Architecture
```text
Content (Pages/PDFs/Notes)
        ↓
Local Text Extraction & Normalization
        ↓
Chunking (Semantic / Paragraph bounds)
        ↓
Indexing (Embeddings / Hybrid vector index)
        ↓
User Query ──→ Retrieval Filter (Score & Rank)
        ↓
AI Provider Prompt:
[ System Instruction ] + [ Retrieved Relevant Chunks Only ] + [ User Query ]
```

### Architectural Benefits
- **Cost Reduction**: Drastically minimizes input token volume.
- **Lower Latency**: Accelerates time-to-first-token.
- **Privacy Minimization**: Exposes only query-relevant excerpts rather than full notebooks.
- **Precision**: Prevents hallucination by grounding inference directly in retrieved context.

---

## 7. Local-First AI Principle

Panvas is and remains local-first:
- All extraction, parsing, and context scoping occur on-device prior to network transmission.
- The application will **never** silently or automatically upload background workspace data simply because an AI setting is enabled.
- Every AI invocation is driven by an explicit, deliberate user interaction (e.g., clicking "Summarize", submitting a chat prompt, triggering conversion).
- **Guiding Principle**: *"AI is optional. Only the content required for the active AI action is sent to the selected AI provider."* (Provisional wording subject to final legal Terms & Privacy Policy).

---

## 8. Text Extraction, OCR, and Handwriting Flow

Pre-existing machine-readable content is prioritized before initiating vision or OCR calls:

1. **Rich Text (TipTap / Markdown / KaTeX)**: Transmit extracted clean text directly.
2. **Vector/Embedded PDF**: Extract embedded PDF digital text streams locally via PDF.js.
3. **Recognized Handwriting**: Utilize existing local handwriting recognition transcripts (e.g., WinRT OCR on Windows) wherever already available.
4. **Cloud Vision / Multimodal OCR**: Visual assets (raster handwriting, scanned PDF pages, diagrams, screenshots) are dispatched to multimodal AI vision endpoints *only* when the user explicitly requests an operation on non-text content that cannot be resolved locally.

---

## 9. AI Privacy Boundaries

Future Privacy Policy documentation must clearly articulate:
- What data remains entirely on-device vs. what leaves the client.
- The exact scope of content selected for each AI operation.
- What data flows through the Panvas backend proxy vs. directly to the provider (in BYOK mode).
- Identity of third-party model providers involved in processing.
- Server-side logging, diagnostics, and retention parameters once established.
- Handling of visual assets (rendered page frames or raw images).
- Whether search embeddings are indexed locally or remotely.

**Documentation Standard**: Panvas makes **no unsubstantiated claims** regarding zero-retention, zero-training, end-to-end encryption, or zero-knowledge processing until explicit, audited agreements and architectures are executed with upstream enterprise providers.

---

## 10. Rate Limiting and Abuse Prevention

Server-side protections for hosted AI:
- **Per-User Limits**: Configurable caps on requests per minute, concurrent operations, and high-compute workloads.
- **Global Ingress Limits**: System-wide throttle to safeguard provider quotas, server bandwidth, and operating costs.
- **Trial Safeguards**: Hard stop at exactly 2 hosted actions per user.
- **Subscription Caps**: Monthly recurring token and request limits (TBD).
- **Request Boundaries**: Rigid server-side limits on maximum input tokens, maximum response tokens, maximum pages per batch, image resolution/byte size, and chunk retrieval counts.

---

## 11. Usage & Cost Accounting

The backend proxy records minimal structured telemetry for auditability:
- User / Account Identifier
- Request Category (e.g., `summarize-page`, `notebook-qa`)
- Provider & Model Identifier (e.g., `gemini-1.5-flash`)
- Input Tokens & Output Tokens
- Estimated Cost (calculated in micro-units)
- Timestamp & Latency Duration
- Execution Status (Success / Error Code)
- Cache Hit Status (Cached / Fresh Call)

**Data Hygiene**: Telemetry logs must **never** store user API keys, authorization tokens, payment credentials, or raw notebook content.

---

## 12. Safe Caching & Performance Architecture

Deterministic requests may leverage caching where idempotent:
- **Cache Key Derivation**: `hash(normalized source content) + operationType + modelVersion + sanitizedOptions`
- **Invalidation**: Any modification to the underlying page content alters the content hash, instantly invalidating stale caches.
- **Multi-Tenant Isolation**: Caches containing user data or generated text are strictly partitioned by `userId`/`workspaceId`. Cross-user or unauthenticated cache sharing is forbidden to prevent content leakage.

---

## 13. Conversational Memory Management

Notebook chat interfaces must avoid unbounded context accumulation:
- Enforce a rolling window over recent conversation history.
- Apply summarization strategies on older turns to compress token consumption.
- Keep conversational history distinct from retrieved notebook context chunks.
- **Request Payload Structure**:
  ```text
  [ Concise System Persona ]
  + [ Compressed / Sliding Window Chat History ]
  + [ Retrieved Notebook Context Chunks ]
  + [ Current User Question ]
  ```

---

## 14. AI Failure Behavior & Fault Tolerance

If an AI request encounters an error or network drop:
- Local document integrity is completely untouched; unsaved page edits remain secure.
- Panvas Core functions continue operating without interruption.
- The UI surfaces actionable, sanitized error states with clear retry options.
- **Handled Error Scenarios**: Offline / no network, monthly quota exhausted, provider rate-limited, provider service outage, payload exceeds size threshold, subscription required, or invalid BYOK credentials.
- Internal stack traces, raw provider exceptions, and server-side connection strings are never exposed to the client.

---

## 15. Billing Architecture Principle

Billing logic is decoupled from product feature implementations. Feature code does not directly reference Stripe, Razorpay, or payment SDKs:

```text
Payment Processor (Razorpay / Stripe)
        ↓ Webhooks / Verification
Subscription State (Database)
        ↓
Entitlement Service (Domain API)
        ↓
AI Feature Gates & Limits
```

### Conceptual Entitlement Contract
```ts
interface PanvasAIEntitlement {
  active: boolean;
  plan: 'free_trial' | 'pro_monthly' | 'pro_annual' | 'byok';
  trialRemaining: number;
  monthlyAllowanceTokens: number;
  currentUsageTokens: number;
  renewsAt: string | null;
}
```

---

## 16. Payment Providers

### Regional Coverage Strategy
- **India**: Razorpay (primary support for domestic payment rails).
- **International**: Razorpay International Card support and/or Stripe (determined by merchant onboarding feasibility and international currency acceptance).

### Provider-Independent Abstraction
```ts
interface BillingProvider {
  createCheckoutSession(planId: string, customerId: string): Promise<CheckoutSession>;
  createSubscription(planId: string, customerId: string): Promise<SubscriptionRecord>;
  cancelSubscription(subscriptionId: string): Promise<boolean>;
  getSubscriptionStatus(subscriptionId: string): Promise<SubscriptionStatus>;
  validateWebhookSignature(payload: string, signature: string): boolean;
  handleWebhookEvent(event: WebhookEvent): Promise<void>;
}
```
Concrete adapters (`RazorpayBillingProvider`, `StripeBillingProvider`) will be implemented when billing infrastructure is built.

---

## 17. India — Razorpay Integration Plan

- **Payment Methods**: UPI, UPI Autopay (recurring e-mandates where supported), domestic debit/credit cards, and net banking.
- **Security Boundary**: All card and sensitive banking inputs are captured solely within Razorpay's hosted checkout UI. Panvas servers and clients never handle or store raw card numbers, CVVs, or bank credentials.
- **Subscription Lifecycle**:
  1. Client requests checkout initiation.
  2. Panvas backend generates a verified subscription order with Razorpay.
  3. Client opens Razorpay Modal Checkout.
  4. User authorizes payment or recurring mandate.
  5. Backend receives and cryptographically validates the Razorpay webhook (`payment.captured` / `subscription.authenticated`).
  6. Backend updates subscription state and activates the user's entitlement.
  7. *Rule*: Entitlements are never granted based solely on unverified client-side completion callbacks.

---

## 18. International Payments Architecture

- International customers will subscribe through Razorpay's international payment processing or Stripe.
- Receiving international payments does **not** require the developer to possess an international debit or ATM card.
- International settlements are converted and disbursed directly into the registered Indian commercial bank account by the payment processor, subject to standard KYC onboarding, export/tax compliance, and gateway approval.
- Final provider selection will be established during formal business entity onboarding.

---

## 19. Developer Payment Configuration Context

- **Current Capabilities**: Indian bank account, Indian UPI, domestic ATM/debit card.
- The system design explicitly avoids any architectural requirement for foreign bank accounts or personal international cards to receive global payments.
- Real settlement and currency conversion are managed entirely by the licensed payment aggregator.

---

## 20. Webhooks & Subscription Lifecycle

The backend subscription engine is driven entirely by verified server-to-server webhook events:
- `subscription.created`
- `subscription.authenticated`
- `subscription.activated`
- `subscription.charged` / `payment.captured`
- `payment.failed`
- `subscription.paused`
- `subscription.cancelled`
- `subscription.expired` / `refund.processed`

### Webhook Processing Requirements
- Cryptographic HMAC signature validation on all incoming webhooks.
- Idempotency handling via event ID deduplication.
- Replay attack mitigation with timestamp tolerance verification.
- Transactional state updates preventing duplicate entitlement allocations.

---

## 21. Entitlements Abstraction

Separating billing records from product entitlements ensures architectural resilience:
- Switching payment processors requires zero changes to core AI feature gates.
- Facilitates custom entitlements (e.g., student discounts, promotional trials, manual team grants, or BYOK exemptions).
- Cleanly isolates billing metadata from application-level authorization.

---

## 22. User Experience & Paywall Flow

1. **Active Trial**:
   - Header badge indicates trial status: `"Panvas AI · 2 trial queries remaining"`.
2. **Trial Exhaustion**:
   - When trial queries reach zero, an informative modal appears:
     ```text
     ┌────────────────────────────────────────────────────────┐
     │                Continue with Panvas AI                 │
     │                                                        │
     │  You have used your 2 free hosted AI actions.          │
     │                                                        │
     │  [ Subscribe to Panvas AI ]                            │
     │  [ Use Your Own API Key (BYOK) ]                       │
     │                                                        │
     │  (Cancel returns to normal note editing without AI)    │
     └────────────────────────────────────────────────────────┘
     ```
3. **Settings Management**:
   - Account settings will present: Current Plan, Renewal Date, Monthly Usage Meter, Manage Subscription link, and BYOK Key Configuration.
   - Non-AI features are never locked or gated behind paywalls.

---

## 23. Premium AI Features Catalog (Planned Ideas)

*The following capabilities represent conceptual product ideas for future consideration, not immediate release commitments:*
- Page, section, notebook, and workspace summarization
- Natural-language Q&A against notes and referenced PDFs
- Visual diagram, chart, and handwritten note interpretation
- Semantic similarity search and contextual note linking
- AI-generated study outlines, flashcards, and quizzes
- Concept explanation and text rewriting (concise, academic, simplified)
- Automated extraction of tasks, dates, formulas, and action items
- Audio note speech-to-text transcription and meeting summaries
- Context-aware workspace organization and tagging suggestions

---

## 24. BYOK Security & Credential Storage

User-provided API keys must be handled with strict isolation:
- **Desktop (Electron)**: Keys must be secured via native operating system credential stores (e.g., Chromium `safeStorage` / Windows DPAPI).
- **Web / PWA**: Must undergo formal security review prior to implementation; keys must never be stored in plaintext unencrypted browser storage where accessible to third-party scripts.
- **Absolute Boundary**: BYOK keys must **never** be synchronized into notebook files, exported canvases, git repositories, cloud workspace records, client telemetry, or backend error logs.

---

## 25. Server Security Architecture

Future backend implementation must incorporate:
- Authenticated JWT/session validation on all proxy routes.
- Schema validation with strict payload size caps.
- Distributed rate limiting and abuse detection.
- Encrypted secrets management for hosted provider credentials.
- Enforced HTTPS/TLS 1.3 encryption for all data in transit.
- Controlled upstream timeouts with bounded exponential backoff retries.
- Sanitized public error responses with internal telemetry masking.
- HMAC webhook signature verification.

---

## 26. Conceptual Server Data Models

*Conceptual entities for future database design; no migrations or tables are to be generated at this time:*
- `User`: Account record, email, status, timestamps.
- `Subscription`: Provider identifier, external subscription ID, plan type, status, billing cycle period.
- `Entitlement`: Feature flags, hosted AI quota limits, remaining trial units.
- `AIUsage`: Aggregated usage logs, token consumption, billing period counters.
- `AIRequestMetadata`: Audit logs of request categories, model identifiers, token volumes (content omitted).
- `BillingEvent`: Raw idempotency ledger of received and verified webhooks.
- `ProviderCredential`: Backend pool configurations, model capabilities, health status.

---

## 27. Implementation Rollout Phases

```text
Phase 1: AI Foundations
  ├── AI UI triggers & action dialogs
  ├── Standardized client request & response contracts
  ├── BYOK prototype (local execution with user-provided key)
  ├── Single-page and selection summarization
  └── Local context extraction pipeline

Phase 2: Hosted Panvas AI Proxy
  ├── Backend secure AI gateway
  ├── User authentication & session handling
  ├── 2-query trial allotment enforcement
  ├── Basic usage accounting & token tracking
  └── Provider pool routing (Gemini)

Phase 3: Domestic Subscription Billing (India)
  ├── Entitlement domain service
  ├── Razorpay checkout integration
  ├── Verified webhook handler & subscription state machine
  └── In-app subscription management UX

Phase 4: International Billing Expansion
  ├── Gateway evaluation (Razorpay International vs. Stripe)
  ├── Multi-currency support & international checkout
  └── Tax and merchant compliance onboarding

Phase 5: Advanced Intelligence & RAG
  ├── Local workspace text indexing & semantic chunking
  ├── Multi-page & cross-notebook Q&A
  ├── Multimodal diagram & visual note understanding
  └── Advanced study tooling (flashcards, quizzes, structured outlines)
```

---

## 28. Open Product & Technical Decisions

The following items are intentionally unresolved and require future business and architectural decisions:
- Commercial subscription pricing (monthly/annual price points).
- Specific token quotas allocated per billing cycle.
- Target Gemini models (e.g., Flash vs. Pro tiers for specific query types).
- Maximum token boundaries for the 2 free trial actions.
- Policy on whether BYOK capabilities remain permanently free or require a base platform tier.
- Architectural decision on whether RAG embeddings are generated locally on-device or via server embedding models.
- Production backend stack and database hosting provider.
- Identity and authentication provider for web/desktop account sessions.
- Invalidation and storage architecture for response caching.
- Server-side data retention and privacy policies for hosted AI proxy requests.
- Selection of international payment aggregator (Razorpay International vs. Stripe).
- Formal refund and subscription cancellation terms.
- Commercial API terms of service compliance review.

---

## 29. Implementation Handoff Note for Future Autonomous Agents

> **Notice for Future Agents (Astra / GPT-5.6 Sol / Claude)**:
> This document defines the conceptual product architecture for Panvas AI and its monetization model.
> **Current source code is the ultimate authority.** Before implementing any item outlined in this roadmap:
> 1. Thoroughly inspect the existing Panvas codebase (`src/`, `electron/`, `tests/`) to understand the current state of the drawing engine, text managers, repositories, and sync adapters.
> 2. Do not build speculative backend microservices or fabricate API endpoints.
> 3. Verify that all existing unit, integration, and UI regression tests continue passing (`npm test`, `npm run typecheck`, `npm run build`) before and after introducing new subsystems.
> 4. Adhere strictly to the phased rollout and preserve Panvas's local-first architecture.
