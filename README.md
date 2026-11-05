# Inkloom AI (Inkoom AI) — Frontend & AI Backend Integration Guide

**Inkloom AI** is a premium, production-grade AI Advertising Compliance and Brand Governance SaaS platform. The application empowers marketing and compliance teams to enforce brand guidelines, detect visual and textual violations, verify advertising claims, and generate actionable remediation recommendations before campaigns go live.

---

## 🚀 Deployment Architecture

```
┌─────────────────────────────────┐                 ┌──────────────────────────────────────┐
│   Vercel Production Frontend   │                 │   External AI Backend (Your Host)    │
│   https://inkoom-ai.shubhamos.com│ ── (HTTPS) ───▶ │   https://inkoom-model.shubhamos.com │
│   [Next.js 15 + TypeScript]     │                 │   [Cloudflare Tunnel + FastAPI]      │
└─────────────────────────────────┘                 └──────────────────┬───────────────────┘
                                                                       │
                                                            ┌──────────▼──────────┐
                                                            │   Ollama / LLM /    │
                                                            │   Vision AI Engine  │
                                                            └─────────────────────┘
```

- **Frontend URL:** `https://inkoom-ai.shubhamos.com`
- **Backend Tunnel URL:** `https://inkoom-model.shubhamos.com`
- **Frontend Stack:** Next.js 15 (App Router), React 18, TypeScript, Tailwind CSS, Lucide React, Framer Motion

---

## 🛠️ Quick Start

### 1. Installation

```bash
cd inkloom-ai
npm install --legacy-peer-deps
```

### 2. Environment Configuration

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

`.env.local` contents:

```env
# AI Backend URL (FastAPI through Cloudflare Tunnel)
NEXT_PUBLIC_AI_API_URL=https://inkoom-model.shubhamos.com

# Set to true to force offline client-side mock data:
NEXT_PUBLIC_USE_MOCK=false
```

> **Note on Fallback Resilience:** When `NEXT_PUBLIC_USE_MOCK=false`, the frontend sends live requests to your Cloudflare Tunnel. If the backend is temporarily offline or starting up, the frontend automatically falls back to local simulation so the user is never blocked, displaying a connection status pill in **Settings**.

### 3. Running the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### 4. Production Build

```bash
npm run build
npm run start
```

---

## 📡 API Integration Contract Specification

All communication with the AI backend is centralised in [`src/lib/api.ts`](src/lib/api.ts).

### 1. Health Check
Checks backend and tunnel availability.

- **Method:** `GET`
- **Path:** `/api/v1/health`
- **Response `200 OK`:**
  ```json
  {
    "status": "ok",
    "version": "1.0.0",
    "ollama": "connected"
  }
  ```

---

### 2. User Onboarding
Registers new user session and company profile.

- **Method:** `POST`
- **Path:** `/api/v1/onboarding`
- **Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "name": "Shubham",
    "company_name": "Acme Inc.",
    "industry": "Technology",
    "website": "https://example.com"
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "user_id": "usr_948201",
    "message": "User onboarding profile saved successfully"
  }
  ```

---

### 3. Brand Brain Setup & Knowledge Ingestion
Ingests brand guidelines text, advertising policies, and uploaded rule documents (`.txt`, `.pdf`, `.docx`).

- **Method:** `POST`
- **Path:** `/api/v1/brand-brain`
- **Content-Type:** `multipart/form-data`
- **Form Fields:**
  - `company_name`: string (required)
  - `industry`: string (optional)
  - `website`: string (optional)
  - `guidelines_text`: string (raw guidelines entered in editor)
  - `files_meta`: JSON string of uploaded documents metadata
  - `files`: File[] (binary attachments)
- **Response `200 OK`:**
  ```json
  {
    "job_id": "bb_job_1730825000",
    "status": "completed",
    "rules_parsed": 12,
    "message": "Brand Brain knowledge base indexed successfully"
  }
  ```

---

### 4. Submit Advertisement for Analysis
Queues an advertisement image for AI compliance scanning. Enforces **only one active analysis** per authenticated user/company.

- **Method:** `POST`
- **Path:** `/api/v1/analysis`
- **Content-Type:** `multipart/form-data`
- **Form Fields:**
  - `image`: File (JPG, JPEG, PNG, or WEBP image binary)
  - `company_name`: string
  - `user_name`: string
- **Response `200 OK` or `202 Accepted`:**
  ```json
  {
    "analysis_id": "analysis_001",
    "status": "queued",
    "message": "Advertisement queued for analysis"
  }
  ```

---

### 5. Polling Analysis Job Status
Polled by [`ScanningExperience.tsx`](src/components/scanner/ScanningExperience.tsx) every ~1.5–2 seconds.

- **Method:** `GET`
- **Path:** `/api/v1/analysis/{analysis_id}/status`
- **Parameters:** `analysis_id` (string)
- **Response `200 OK` (In Progress):**
  ```json
  {
    "analysis_id": "analysis_001",
    "status": "processing",
    "progress": 65,
    "stage": "Detecting brand violations",
    "message": "Comparing extracted claims against Brand Brain regulations"
  }
  ```
- **Response `200 OK` (Completed):**
  ```json
  {
    "analysis_id": "analysis_001",
    "status": "completed",
    "progress": 100,
    "stage": "Complete",
    "result": {
      "id": "analysis_001",
      "advertisementName": "Summer Launch Banner",
      "imageUrl": "https://storage.provider.com/ads/summer.jpg",
      "companyName": "Acme Inc.",
      "complianceScore": 74,
      "complianceLevel": "needs_revision",
      "status": "completed",
      "analysedAt": "2026-11-05T16:30:00Z",
      "summary": "Moderate compliance. Identified unapproved claim and CTA colour deviation.",
      "violations": [],
      "recommendations": [],
      "passedChecks": []
    }
  }
  ```
- **Statuses Handled:** `queued`, `processing`, `completed`, `failed`, `cancelled`

---

### 6. Full Analysis Compliance Report
Retrieves the complete structured report.

- **Method:** `GET`
- **Path:** `/api/v1/analysis/{analysis_id}`
- **Response `200 OK`:**
  ```json
  {
    "id": "analysis_001",
    "advertisementName": "Summer Campaign Ad",
    "imageUrl": "data:image/png;base64,...",
    "companyName": "Acme Inc.",
    "complianceScore": 74,
    "complianceLevel": "needs_revision",
    "status": "completed",
    "analysedAt": "2026-11-05T16:30:00Z",
    "summary": "Advertisement exhibits brand colour violations and unapproved performance claims.",
    "violations": [
      {
        "id": "v_001",
        "title": "Incorrect Primary Brand Colour",
        "severity": "critical",
        "explanation": "CTA button uses #E74C3C (red) instead of approved primary blue (#2563EB).",
        "relevantRule": "Brand colours must strictly adhere to the defined primary palette.",
        "ruleId": "BR-COL-001",
        "evidence": "CTA button at bottom-center displays #E74C3C.",
        "suggestedCorrection": "Update CTA background to approved primary blue (#2563EB).",
        "boundingBox": {
          "x": 0.1,
          "y": 0.75,
          "width": 0.8,
          "height": 0.15,
          "label": "Incorrect CTA colour"
        }
      }
    ],
    "recommendations": [
      {
        "id": "rec_001",
        "what": "Replace CTA button colour with approved primary blue",
        "why": "Colour consistency reinforces brand recognition across touchpoints.",
        "how": "Change fill to #2563EB.",
        "priority": "high"
      }
    ],
    "passedChecks": [
      "Brand typeface (Inter) used correctly",
      "Image resolution meets minimum 300 DPI requirement",
      "No prohibited competitor marks detected"
    ]
  }
  ```

---

### 7. Analysis History
- **Method:** `GET`
- **Path:** `/api/v1/analysis/history`
- **Response `200 OK`:** Array of `AnalysisHistoryItem` records.

---

### 8. Brand Brain Rules Management
- **Method:** `GET` / `PUT`
- **Paths:**
  - `GET /api/v1/brand-brain`: Full Brand Brain summary
  - `GET /api/v1/brand-brain/rules`: List of active rules
  - `PUT /api/v1/brand-brain/rules`: Update rules list and raw guidelines text

---

## 🔒 Security & CORS Configuration (FastAPI)

To allow the Vercel frontend (`https://inkoom-ai.shubhamos.com`) to communicate through your Cloudflare Tunnel (`https://inkoom-model.shubhamos.com`), configure FastAPI's `CORSMiddleware`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Inkloom AI Model Backend")

origins = [
    "https://inkoom-ai.shubhamos.com",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/v1/health")
async def health_check():
    return {"status": "ok", "backend": "FastAPI + Ollama"}
```

---

## 🧪 Testing the Complete User Journey

1. **First-time Onboarding (`/onboarding`):**
   - **Step 1:** Enter your full name (validates min 2 characters).
   - **Step 2:** Provide company name, industry, and optional website.
   - **Step 3:** Paste company brand guidelines into the text editor, upload `.txt`/`.pdf`/`.docx` files, and check the authorization checkbox.
   - **Step 4:** View the 5-stage animated building sequence with circular progress indicator.
2. **Dashboard (`/dashboard`):**
   - Review personalized greeting, 4 high-level stat cards, quick-analyse drawer, Brand Brain active status, and recent scans.
3. **Advertisement Upload & Scanning (`/analysis`):**
   - Drag and drop or browse for an advertisement creative (`JPG`, `PNG`, `WEBP`).
   - Click **Analyse Advertisement**.
   - Watch the animated scanning screen: subtle grid overlay, vertical laser scan line with glow, viewfinder corner brackets, and progressive stage indicators.
4. **Analysis Compliance Report:**
   - View circular compliance score ring (color-coded for Excellent, Needs Improvement, Needs Revision, or Non-Compliant).
   - Inspect visual bounding boxes highlighting issues directly on the uploaded ad.
   - Expand and collapse detailed violation cards with rule IDs, evidence, and remediation steps.
   - Download the full text audit report via **Download Report**.
5. **History (`/history`):**
   - Search by ad name, filter by compliance tier, and sort by date or score.
   - Click **View Report** to reopen any historical report.
6. **Brand Brain (`/brand-brain`):**
   - View categorized rules (Logo, Typography, Colour Palette, Messaging, Advertising Claims, Restricted Content, Legal Compliance).
   - Add new rules with the modal dialog, toggle active states, or delete rules with confirmation.
7. **Settings (`/settings`):**
   - Test the live ping to `https://inkoom-model.shubhamos.com`.
   - Toggle between **Real Backend** and **Mock Data** mode.
   - Sign out cleanly to reset the workspace session.

---

## 📁 Source Code Structure

```
inkloom-ai/
├── src/
│   ├── app/
│   │   ├── analysis/page.tsx       # Single active analysis controller + persistent preview
│   │   ├── brand-brain/page.tsx    # Brand Brain management page
│   │   ├── dashboard/page.tsx      # Main executive dashboard
│   │   ├── history/page.tsx        # Searchable analysis history & deep-link report view
│   │   ├── onboarding/page.tsx     # 4-stage onboarding controller
│   │   ├── settings/page.tsx       # Workspace & API connection settings
│   │   ├── globals.css             # Tailwind base & custom design tokens
│   │   ├── layout.tsx              # Root HTML & typography layout
│   │   └── page.tsx                # Auto-redirect controller
│   ├── components/
│   │   ├── brand-brain/            # AddRuleModal, RuleCard, BrandBrainContent
│   │   ├── dashboard/              # DashboardContent, StatCard, SettingsContent
│   │   ├── history/                # HistoryList with search, filters, sort
│   │   ├── layout/                 # Sidebar, MobileNav drawer, DashboardLayout
│   │   ├── onboarding/             # StepPersonal, StepCompany, StepBrandBrain, StepBuilding
│   │   ├── reports/                # AnalysisReport with bounding boxes, score ring & export
│   │   ├── scanner/                # ScanningExperience, ScanningImage laser animation
│   │   ├── ui/                     # ScoreRing, ConfirmDialog, Toast, EmptyState, Spinner
│   │   └── upload/                 # AdvertisementUpload with drag-drop validation
│   ├── lib/
│   │   ├── api.ts                  # Central API service layer (v1 endpoints + resilience)
│   │   ├── mock-data.ts            # Realistic demonstration datasets
│   │   ├── session.ts              # Session persistence & active job tracker
│   │   └── validation.ts           # Input, file type & size validators
│   └── types/
│       ├── analysis.ts             # Compliance score, violation, recommendation types
│       ├── brand-rules.ts          # Rule categories and Brand Brain models
│       ├── company.ts              # Company profile and dashboard stats
│       └── user.ts                 # User profile and onboarding state
├── public/                         # Static assets
├── .env.example                    # Environment variable template
├── .env.local                      # Local active configuration
├── package.json                    # Project dependencies
├── tailwind.config.js              # Theme configuration
└── tsconfig.json                   # TypeScript configuration
```

---

## ⚡ Vercel Deployment Configuration (ercel.json)

The project includes a ready-to-deploy [ercel.json](vercel.json) configuration:

`json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "installCommand": "npm install --legacy-peer-deps",
  "env": {
    "NEXT_PUBLIC_AI_API_URL": "https://inkoom-model.shubhamos.com",
    "NEXT_PUBLIC_USE_MOCK": "false"
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Credentials", "value": "true" },
        { "key": "Access-Control-Allow-Origin", "value": "https://inkoom-ai.shubhamos.com" },
        { "key": "Access-Control-Allow-Methods", "value": "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
        { "key": "Access-Control-Allow-Headers", "value": "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-API-Key" }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/api/proxy/v1/:path*",
      "destination": "https://inkoom-model.shubhamos.com/api/v1/:path*"
    }
  ]
}
`

### Deploying to Vercel

`ash
# Using Vercel CLI:
npm i -g vercel
vercel --prod
`
Or connect your GitHub repository directly to Vercel with root directory set to inkloom-ai.