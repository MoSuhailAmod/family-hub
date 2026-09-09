# Spending V2 design reference

This document captures the approved visual/interaction direction for the Spending V2 redesign described in [ADR-001](../../adr/ADR-001-spending-v2-agent-ingestion.md).

The generated planning mockups from the design discussion are represented here as implementation references so future tasks can work from a stable source in the repository. These are directional product designs, not pixel-perfect acceptance screenshots.

## 1. Data flow

```mermaid
flowchart LR
    U[Household uploads cumulative\nHousehold Spending Budget.md\nto ChatGPT]
    A[ChatGPT validates and extracts\nall eligible periods]
    S[Structured Spending snapshot\nperiods + category totals +\ntransactions + provenance]
    R[Family Hub Spending\nreconciliation boundary]
    C{Compare each source period\nwith PostgreSQL}
    N[Insert new period]
    H[Update changed historical period]
    K[Skip unchanged period]
    P[Insert or refresh partial period]
    DB[(PostgreSQL\nperiods / categories /\ntransactions / provenance)]
    UI[Spending UI\nreads only from database]

    U --> A --> S --> R --> C
    C --> N --> DB
    C --> H --> DB
    C --> K --> DB
    C --> P --> DB
    DB --> UI
```

**Key rule:** Markdown is an ingestion artifact, not a runtime dependency.

## 2. User flow

```mermaid
flowchart TD
    A[Once or twice a month:\nuser provides latest cumulative Markdown to ChatGPT]
    B[ChatGPT validates structure and extracts all periods]
    C[ChatGPT submits normalized snapshot to Family Hub]
    D[Family Hub reconciles database]
    E{Any material historical changes?}
    F[Insert/refresh safe changes]
    G[Surface discrepancy/impact summary to user]
    H[Return reconciliation result:\nunchanged / updated / new / partial]
    I[Day-to-day:\nuser opens Family Hub Spending]
    J[Dashboard loads latest completed period from DB]
    K[Optional partial-period banner]
    L[Browse history, categories, trends, transactions]

    A --> B --> C --> D --> E
    E -- No special review required --> F --> H
    E -- Review useful --> G --> F
    H --> I --> J
    J --> K
    J --> L
```

### Intended conversational result

```text
Spending import complete.

7 periods processed
5 unchanged
1 historical period updated
1 new completed period added
1 current partial period refreshed
```

## 3. Database direction

The exact migration must be based on the existing Spending schema rather than recreating tables unnecessarily. The approved target concepts are:

```mermaid
erDiagram
    SPENDING_IMPORT_DOCUMENTS ||--o{ SPENDING_PERIODS : supplies
    SPENDING_IMPORT_DOCUMENTS ||--o{ SPENDING_RECONCILIATION_LOG : records
    SPENDING_PERIODS ||--o{ SPENDING_PERIOD_CATEGORIES : contains
    SPENDING_CATEGORIES ||--o{ SPENDING_PERIOD_CATEGORIES : classifies
    SPENDING_PERIODS ||--o{ SPENDING_TRANSACTIONS : contains
    SPENDING_CATEGORIES ||--o{ SPENDING_TRANSACTIONS : classifies
    SPENDING_PERIODS ||--o{ SPENDING_RECONCILIATION_LOG : affected

    SPENDING_IMPORT_DOCUMENTS {
      uuid id PK
      string producer
      string document_id
      string revision
      string content_sha256
      timestamp imported_at
      string imported_by
      int raw_period_count
    }

    SPENDING_PERIODS {
      uuid id PK
      string source_period_key UK
      date start_date
      date end_date
      string currency
      decimal total_amount
      string status "partial|completed"
      uuid import_document_id FK
    }

    SPENDING_CATEGORIES {
      uuid id PK
      string source_category_key UK
      string name
      int sort_order
    }

    SPENDING_PERIOD_CATEGORIES {
      uuid id PK
      uuid period_id FK
      uuid category_id FK
      decimal total_amount
    }

    SPENDING_TRANSACTIONS {
      uuid id PK
      uuid period_id FK
      uuid category_id FK
      string source_transaction_key
      date transaction_date
      string description
      decimal amount
      string line_type
      int display_order
    }

    SPENDING_RECONCILIATION_LOG {
      uuid id PK
      uuid import_document_id FK
      uuid period_id FK
      string action "insert|update|unchanged|partial-refresh|completed-from-partial"
      string summary
    }
```

### Integrity direction

- One logical record per source period.
- Stable source-period identity based on source dates/keys.
- Deterministic transaction identity within a period.
- Changed-period replacement is atomic.
- Historical source classification is preserved.
- New categories require no schema migration.

## 4. Spending dashboard mockup direction

The approved UI direction is a **database-first dashboard with no normal upload box**.

### Mobile layout

```text
┌─────────────────────────────────────┐
│ HOUSEHOLD FINANCES                  │
│ Spending                            │
│ Track and understand household      │
│ spending                            │
├─────────────────────────────────────┤
│ August 2026              Completed  │
│ R57,409.87                          │
│ Total household spend               │
│ Last synced today via agent import  │
├───────────┬───────────┬─────────────┤
│ Categories│Transactions│ vs July    │
│    14     │    122    │   +1.1%     │
├─────────────────────────────────────┤
│ Spending by category                │
│                                     │
│            ◜████◝                   │
│          ██      ██                 │
│         ██  TOTAL  ██               │
│          ██      ██                 │
│            ◟████◞                   │
│                                     │
│ Groceries                 R10,803   │
│ Savings & Investments      R7,331   │
│ Municipal / Utilities      R5,506   │
│ Sahar Academics            R5,920   │
│ Home Loan / Bond           R3,811   │
├─────────────────────────────────────┤
│ Current period available            │
│ 28 Aug – 27 Sep     PARTIAL         │
│ View current spending →             │
├─────────────────────────────────────┤
│ Spending history                    │
│   ▂ ▅ ▃ ▆ ▅ █                       │
│  Mar Apr May Jun Jul Aug            │
├─────────────────────────────────────┤
│ Recent transactions                 │
│ Checkers                  -R583.42  │
│ Shell                   -R1,200.00  │
│ ...                                 │
└─────────────────────────────────────┘
```

### UI principles

- No Markdown/JSON upload control in the normal Spending page.
- Latest completed period is the default view.
- A current partial period is visible but clearly labeled as incomplete.
- Category cards/charts are dynamic; no fixed category list in code.
- Period totals and category totals come from authoritative stored source values.
- Historical trend visualizations use DB data, not source-document parsing.
- Transaction drill-down is easy to reach from categories and recent activity.
- Import freshness may appear as subtle provenance such as `Last synced via agent import`.
- Mobile and desktop follow existing Family Hub visual language: light background, rounded cards, dark navy headings, restrained blue accent, bottom/mobile navigation patterns.

## 5. Implementation boundary

```text
ChatGPT
   │ structured snapshot
   ▼
Family Hub API / MCP adapter
   │
   ▼
Shared Spending reconciliation service
   │
   ▼
Spending data/persistence layer
   │
   ▼
PostgreSQL
   ▲
   │ read APIs
   │
Spending UI
```

No presentation layer or agent adapter may bypass the shared Spending domain/service layer for persistence.

## 6. Legacy implementation

The original Spending issues and merged code remain part of repository history for traceability. V2 tasks may remove the legacy in-page ingestion code where it conflicts with this design while retaining useful schema, service, API, query, and UI foundations.
