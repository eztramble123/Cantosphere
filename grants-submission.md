# Cantosphere — A Marketplace for the Canton Network

## Project Summary

Cantosphere is an open-source marketplace that lets Canton Network validators discover, purchase, and deploy Daml applications directly to their nodes — with on-chain licensing and payment built in.

Think of it as an app store for Canton: developers publish Daml apps, validators browse and one-click deploy them, and the entire licensing and payment flow is settled atomically on-ledger. The payment layer currently uses a lightweight CC token stand-in, architected for a straightforward swap to Splice Amulet (Canton Coin) once integrated.

---

## Problem

Canton Network validators who want to run Daml applications face several friction points today:

1. **Discovery** — There is no central place to find production-ready Daml apps. Validators resort to GitHub searches, Discord threads, and word of mouth.
2. **Deployment complexity** — Installing a DAR on a Canton node requires manual gRPC calls, package vetting, and dependency management. This is error-prone and undocumented for most operators.
3. **No payment rails for app licensing** — Canton Coin exists via Splice, but there's no application-layer workflow that connects token transfer to software license grants. Developers have no turnkey way to sell Daml apps to validators.
4. **License enforcement** — Even when apps are "paid," there is no way to atomically tie payment to license grant. Off-chain payment + off-chain license creation is inherently racy.

## Solution

Cantosphere addresses all four:

| Problem | Solution |
|---------|----------|
| Discovery | Searchable marketplace with categories, tags, reviews, and pricing filters |
| Deployment | 5-step automated pipeline: validate DAR, check dependencies, upload via gRPC, vet packages, verify — with real-time progress UI and automatic retries |
| Payment | On-ledger token transfer (currently a lightweight CC stand-in, designed for direct Splice Amulet swap). Transfer, Split, and Merge choices — payment exercised on-ledger. |
| License enforcement | The `Purchase` choice on `AppListing` atomically transfers CC from buyer to provider AND creates a `License` contract in a single Daml transaction. If the buyer doesn't have enough CC, nothing happens. |

---

## Architecture

```
                      ┌──────────────────────────────────┐
                      │        Cantosphere Frontend       │
                      │   Next.js 16 · React 19 · shadcn  │
                      └──────────────┬───────────────────┘
                                     │
                      ┌──────────────▼───────────────────┐
                      │          33 API Routes            │
                      │   Auth · Apps · Listings · Wallet  │
                      │   Licenses · Deployments · Admin   │
                      └────────┬─────────────┬───────────┘
                               │             │
               ┌───────────────▼──┐   ┌──────▼───────────┐
               │   PostgreSQL     │   │  Canton Node      │
               │   (Prisma 7)    │   │                   │
               │                 │   │  gRPC Admin API   │
               │  20 models      │   │  (DAR upload,     │
               │  Users, Apps,   │   │   vetting,        │
               │  Listings,      │   │   health checks)  │
               │  Licenses,      │   │                   │
               │  Deployments    │   │  JSON Ledger API  │
               │                 │   │  (contracts,      │
               └─────────────────┘   │   choices,        │
                                     │   queries)        │
                                     └───────────────────┘

                      ┌──────────────────────────────────┐
                      │       Daml Smart Contracts        │
                      │                                   │
                      │  CantonCoin    — token stand-in    │
                      │  AppListing    — marketplace entry │
                      │  License       — usage rights      │
                      │  InstallRequest — deploy workflow  │
                      │  Installation  — deployment record │
                      └──────────────────────────────────┘
```

### Dual Canton Integration

Cantosphere connects to Canton nodes through two complementary APIs:

- **gRPC Admin API** — Used for package management: uploading DARs, vetting packages on synchronizers, listing deployed packages, and health checks. This is the operational layer.
- **JSON Ledger API V2** — Used for smart contract operations: creating contracts, exercising choices, querying active contracts. This is the transactional layer.

Both have full mock implementations for development without a running Canton node.

---

## Key Features

### For Validators
- **Browse & search** a curated marketplace of Daml applications
- **One-click deploy** — automated 5-step pipeline handles DAR validation, upload, vetting, and verification
- **Real-time deployment tracking** — each step is persisted and streamed to the UI
- **Node management** — register multiple Canton nodes, monitor health
- **License dashboard** — view active licenses, expiry, usage limits

### For Developers
- **Publish apps** with versioned DAR releases, changelogs, and rich descriptions
- **Flexible pricing** — FREE, ONE_TIME (CC payment), SUBSCRIPTION, USAGE_BASED
- **On-chain revenue** — ONE_TIME listings are paid atomically on-ledger (Splice Amulet integration planned)
- **Install request workflow** — approve or auto-approve deployment requests
- **Provider heartbeat** — signal listing liveness

### For the Ecosystem
- **On-chain licensing** — License contracts live on the Canton ledger alongside the apps they govern
- **Atomic payments** — The `Purchase` Daml choice transfers CC and creates a License in one transaction
- **Party identity bridge** — Maps Web2 OAuth identities (Google/GitHub) to Canton party IDs
- **Admin review workflow** — Apps go through DRAFT → IN_REVIEW → PUBLISHED lifecycle

---

## On-Chain Payment: How It Works

The payment system currently uses a lightweight Daml fungible token (CC) that mirrors the interface of Splice Amulet — Transfer, Split, Merge. This stand-in was built so the full atomic purchase flow could be developed and tested end-to-end now, with a clean swap path to real Canton Coin via Splice once integrated. The token interface is intentionally minimal so the migration is a contract swap, not an architecture change.

```
1. Developer lists app with ONE_TIME pricing (e.g., 50 CC)
2. Validator clicks "Purchase"
3. Backend queries validator's CC balance on-ledger
4. Backend finds a coin with sufficient balance
5. Exercises the Purchase choice on the AppListing contract:
   a. Fetches the buyer's CantonCoin contract
   b. Splits the coin if overpaying (returns change)
   c. Transfers exact payment amount to provider
   d. Creates a License contract
   — All in a single atomic Daml transaction —
6. Backend creates a Postgres License record with paymentRef = "cc:<contractId>"
```

If the buyer doesn't have enough CC, the transaction fails and nothing changes. There is no window for inconsistent state between payment and license creation — this is Daml's core value proposition applied to software licensing.

The `Purchase` choice is **nonconsuming** on the `AppListing`, meaning the listing stays active for other buyers. The buyer's authority (as coin owner and Purchase controller) and the provider's authority (as AppListing signatory) are both present in the transaction context, enabling the Transfer without additional authorization steps.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS v4, shadcn/ui |
| Backend | Next.js API Routes (33 endpoints) |
| Database | PostgreSQL, Prisma 7 ORM (20 models) |
| Auth | Auth.js v5 (Google + GitHub OAuth), JWT sessions |
| Smart Contracts | Daml SDK 3.3.0 (2 modules, 5 templates) |
| Canton Node | digitalasset/canton-open-source 3.3.0 |
| Canton Admin API | @grpc/grpc-js (DAR upload, vetting, health) |
| Canton Ledger API | HTTP JSON API V2 (contracts, choices) |
| Testing | Vitest (104 unit tests + integration suite) |
| CI/CD | GitHub Actions (lint, typecheck, test, integration with Canton sandbox) |

---

## Codebase Metrics

| Metric | Value |
|--------|-------|
| TypeScript source | ~17,500 lines |
| Daml smart contracts | ~250 lines (2 modules, 5 templates) |
| API endpoints | 33 |
| Frontend pages | 24 |
| React components | 49 |
| Database models | 20 |
| Database migrations | 6 |
| Unit tests | 104 (11 test files) |
| Integration tests | 2 test suites (against real Canton sandbox) |

---

## Current Status

Cantosphere is a **working prototype** with the full vertical slice implemented:

- Validators can browse, purchase (with CC), and deploy Daml apps
- Developers can publish apps with pricing and manage install requests
- Admins can review and approve submitted apps
- The deployment pipeline uploads DARs to real Canton nodes via gRPC
- Marketplace contracts (listings, licenses, payments) execute on the Canton ledger
- CI runs unit tests on every push and integration tests against a Canton sandbox on merge to main

### What's Built
- Complete marketplace UI (browse, search, detail pages, dashboards)
- Role-based authentication and authorization (Validator / Developer / Admin)
- 5-step DAR deployment orchestrator with retry logic
- On-chain marketplace contracts (AppListing, License, InstallRequest, Installation)
- Atomic on-chain payment system (stand-in token, Splice Amulet-ready architecture)
- Wallet API (balance query, admin mint for dev/testing)
- Full mock mode for development without Canton infrastructure
- Docker Compose setup for local Canton sandbox
- CI/CD pipeline with Canton integration tests

### What's Next
- **Splice Amulet integration** — Swap the stand-in CC token for real Canton Coin via the Splice Amulet APIs, enabling actual value transfer between validators and developers on the Global Synchronizer
- **SUBSCRIPTION billing** — Recurring on-chain payments with renewal choices
- **Multi-node deployment** — Deploy to multiple validator nodes in parallel
- **DAR dependency resolution** — Automatically deploy dependent packages
- **App analytics** — Install counts, revenue tracking, usage metrics for developers
- **Decentralized app review** — Move the review/approval workflow on-chain

---

## Team

Solo developer building at the intersection of Canton Network infrastructure and developer tooling.

---

## Grant Request

### What the grant would fund
1. **Splice Amulet integration** — Swap the stand-in CC token for real Canton Coin via the Splice Amulet APIs. The `Purchase` choice, `PaymentContractService`, and wallet API are already built — the work is connecting them to the actual Amulet contracts on the Global Synchronizer instead of our local token template.
2. **Production hardening** — Error recovery, observability, rate limiting refinement, and security audit
3. **Documentation & developer onboarding** — Guides for publishing apps, deploying to Canton nodes, and integrating with the marketplace API
4. **Community deployment** — Host a public instance for the Canton developer community to use

### Why this matters for Canton
The Canton Network's value grows with the number of useful applications running on it. Right now, there's no frictionless way for a validator to find, pay for, and deploy a Daml app. Cantosphere removes that friction entirely — and by settling payments on-ledger with real Canton Coin (once Splice is integrated), it creates the first end-to-end use case for Amulet outside of synchronizer fees: **paying for software with the network's native token**.

Every Canton application that gets deployed through Cantosphere is another node running production Daml workloads, another developer earning revenue from the ecosystem, and another demonstration that Canton's privacy and composability guarantees work in practice.

---

## Links

- **Repository**: [GitHub — canton-store](https://github.com/your-username/canton-store)
- **Demo**: Available on request
- **Contact**: your-email@example.com

---

*Built with Daml SDK 3.3.0 on Canton Open Source 3.3.0*
