# Canton Application Marketplace

## Overview

A marketplace for discovering, distributing, installing, and licensing Daml applications on the Canton Network. Canton's privacy-first architecture means apps aren't globally discoverable by default — this marketplace solves discovery, distribution, and onboarding in a network where data visibility is scoped to involved parties.

---

## Canton Architecture Context

### Node Types

- **Participant Nodes (Validators):** Store contract data, execute Daml smart contract logic, and host parties. Each node maintains its own persistent state — there is no single global RPC endpoint. To access a party's data you must connect to the specific validator hosting that party.
- **Synchronizers (Sync Domains):** Route encrypted messages between participant nodes, provide consistent transaction ordering, and confirm commits. Cannot decrypt or inspect payloads. Can be centralized (high trust) or decentralized (BFT consensus).
- **Global Synchronizer:** The publicly available synchronizer operated under the Canton Foundation. Used for atomic cross-application and cross-domain settlement.

### Key Differences from EVM Chains

- Apps are not deployed to a global state machine. They are compiled into `.dar` files (Daml Archives) and uploaded to individual participant nodes.
- Data visibility is scoped to involved parties only. Third-party nodes don't see transactions they aren't party to.
- "Installing" an app involves DAR upload, party allocation, sync domain connection, and topology transactions — not a single deploy transaction.
- Atomic cross-domain transactions are native. Payment on one sync domain and license grant on another can settle as one operation.

---

## Architecture

### Layer 1 — Discovery (Public Registry)

A public on-chain registry on the Global Synchronizer where app providers list their applications.

**Registry Daml Template:**

```
template AppListing
  with
    marketplaceOperator : Party
    appProvider : Party
    appId : Text
    appName : Text
    version : Text
    darHash : Text             -- SHA-256 hash of the .dar file
    description : Text
    requiredPermissions : [Text]
    requiredSyncDomains : [Text]  -- sync domains the app needs
    pricingModel : PricingModel
    minNodeVersion : Text
    createdAt : Time
  where
    signatory marketplaceOperator, appProvider
    observer <all connected validators via public party>
```

**PricingModel Variant:**

```
data PricingModel
  = Free
  | OneTime { amount : Decimal, currency : Text }
  | Subscription { amount : Decimal, currency : Text, intervalDays : Int }
  | UsageBased { ratePerMarker : Decimal, currency : Text }
```

**Choices on AppListing:**

- `UpdateListing` — provider updates metadata, version, or pricing (provider-only)
- `DelistApp` — provider or marketplace operator removes listing
- `RequestInstall` — user exercises to begin the install flow, creates an `InstallRequest` contract

### Layer 2 — Distribution (DAR Package Delivery)

Canton has no native package registry. The marketplace must host and serve verified DAR files.

**Distribution Service:**

- Off-chain service (REST API) that stores DAR files keyed by `appId` and `version`
- On upload, computes SHA-256 hash and verifies it matches the on-chain `AppListing.darHash`
- Requesting nodes authenticate via their party identity
- Serves DAR over TLS with hash verification on the client side

**Distribution Flow:**

```
1. App provider uploads DAR to distribution service
2. Service computes hash, provider publishes AppListing with matching darHash
3. User's node requests DAR from service, receives file + hash
4. User's node verifies hash against on-chain AppListing.darHash
5. DAR uploaded to participant node via Admin API
```

### Layer 3 — Installation & Onboarding (Automated Provisioning)

Once the DAR is on the node, the marketplace orchestrates the remaining setup.

**InstallRequest Daml Template:**

```
template InstallRequest
  with
    user : Party
    appProvider : Party
    marketplaceOperator : Party
    appId : Text
    version : Text
    userNodeId : Text
    requestedAt : Time
  where
    signatory user
    observer appProvider, marketplaceOperator
```

**Provisioning Steps (triggered by app provider automation):**

```
1. Verify InstallRequest is valid (app exists, version matches, user has license)
2. User's node uploads the verified DAR via Admin API
3. Allocate parties for the app's workflows on the user's node
4. Connect user's node to the app's sync domain (if not Global Synchronizer)
5. Execute topology transactions to establish party-hosting relationships
6. Configure application permissions via the node's permissions manager
7. Create an `Installation` contract confirming success
```

**Installation Daml Template:**

```
template Installation
  with
    user : Party
    appProvider : Party
    appId : Text
    version : Text
    syncDomains : [Text]
    installedAt : Time
    licenseContractId : ContractId License
  where
    signatory user, appProvider
```

**Choices on Installation:**

- `Upgrade` — provider pushes new version, user accepts
- `Uninstall` — user removes app, archives related contracts, disconnects from app-specific sync domains
- `Repair` — re-run provisioning if state is inconsistent

### Layer 4 — Licensing & Payment (Atomic Settlement)

**License Daml Template:**

```
template License
  with
    user : Party
    appProvider : Party
    appId : Text
    pricingModel : PricingModel
    validFrom : Time
    validUntil : Optional Time   -- None for perpetual
    isActive : Bool
  where
    signatory user, appProvider
```

**Choices on License:**

- `Renew` — extend validity, trigger payment
- `Revoke` — provider revokes for terms violation
- `Cancel` — user cancels subscription

**Payment Flow:**

- Settlement in Canton Coin via the Global Synchronizer
- Atomic cross-domain transaction: payment on GS + license grant on marketplace sync domain settle as one operation
- For usage-based pricing: Canton activity markers track consumption, billing aggregated on a schedule

---

## Sync Domain Topology

```
┌─────────────────────────────────────────────────┐
│              Global Synchronizer                 │
│  (payment settlement, cross-app atomicity)       │
└────────┬──────────────┬──────────────┬──────────┘
         │              │              │
┌────────▼───────┐ ┌────▼────┐ ┌──────▼──────────┐
│  Marketplace   │ │  App A  │ │  App B          │
│  Sync Domain   │ │  Sync   │ │  (runs on GS    │
│  (registry,    │ │  Domain │ │   directly)     │
│   licensing,   │ │         │ │                 │
│   reviews)     │ │         │ │                 │
└────────────────┘ └─────────┘ └─────────────────┘
```

- **Marketplace Sync Domain:** Handles discovery, licensing, reviews, and install orchestration. Operated by marketplace consortium or neutral foundation.
- **App-Specific Sync Domains:** Some apps run on their own private sync domains for confidentiality. Others run directly on the Global Synchronizer for simplicity.
- **Global Synchronizer:** Bridges everything. Handles Canton Coin settlement and enables atomic transactions across domains.

---

## Edge Cases

### Discovery & Registry

| Edge Case | Handling |
|---|---|
| Provider lists app with a DAR hash that doesn't match any uploaded DAR | Distribution service rejects the upload. `AppListing` stays in `pending` state until a valid DAR is uploaded and hash-matched. Add a `ListingStatus` field: `Pending | Active | Suspended`. |
| Provider updates listing while users have active `InstallRequest` contracts | In-flight requests should reference a specific version. The update creates a new listing version — existing requests resolve against the version they were created for. |
| Malicious provider lists app with misleading metadata | Marketplace operator has `SuspendListing` choice. Add a `ReviewQueue` template for community flagging. Marketplace operator is a signatory on all listings and can archive. |
| Two providers list apps with the same name | `appId` is unique and provider-scoped (e.g., `provider-party-hash:app-name`). Display names can collide — surface provider identity prominently in UI. |
| Provider's party goes offline or validator shuts down | Listings persist on-chain but installs will fail. Add a heartbeat mechanism — provider automation periodically exercises a `Heartbeat` choice on their listings. Stale listings (no heartbeat for N days) get flagged as unavailable. |
| Global Synchronizer upgrade changes API compatibility | `minNodeVersion` field on `AppListing`. Install flow checks user's node version before proceeding. Registry can filter incompatible listings per-user. |

### Distribution

| Edge Case | Handling |
|---|---|
| DAR file corrupted during transfer | Client-side hash verification against on-chain `darHash`. Retry on mismatch. Distribution service should support chunked transfer with per-chunk checksums for large DARs. |
| Distribution service goes down | DAR files are immutable once published. Can be mirrored across multiple distribution nodes. Consider IPFS or similar content-addressed storage as a fallback — `darHash` already serves as a content address. |
| Provider uploads new DAR but doesn't update the on-chain listing | Distribution service only serves DARs that have a matching on-chain `AppListing` with status `Active`. Orphan DARs get garbage collected. |
| User's node is behind a firewall and can't reach distribution service | Support DAR export as a downloadable file for manual sideloading via Admin API. The on-chain hash still allows verification. |
| Malicious DAR that exploits Daml runtime | Daml's authorization model constrains what contracts can do — a malicious DAR can't access data outside its authorized parties. But it could waste resources. Add a sandboxed pre-install validation step that checks DAR structure, template signatures, and resource bounds before uploading to the live node. |

### Installation & Onboarding

| Edge Case | Handling |
|---|---|
| Install fails midway (DAR uploaded but sync domain connection fails) | `InstallRequest` tracks provisioning state as a checklist. Each step is idempotent. `Repair` choice re-runs from last successful step. Timeout after N hours archives the request and rolls back (remove DAR, deallocate parties). |
| User's node is already connected to the app's sync domain from a different app | Skip the sync domain connection step. Track sync domain connections in a `NodeState` contract per user to avoid redundant topology transactions. |
| App requires a sync domain that no longer exists | Install fails at the domain connection step. Surface error to user. App provider should update listing to reflect new sync domain or delist. |
| User's node doesn't have enough resources (RAM, storage) | Pre-install check queries node health via Admin API. If below minimums (6GB RAM, 4 CPU cores per Canton docs), reject with a clear error before any state changes. |
| Concurrent install requests for the same app from the same user | Deduplicate on `(user, appId)`. If an `InstallRequest` already exists and is in-progress, reject the duplicate. If a completed `Installation` exists, offer upgrade instead. |
| App upgrade requires DAR that is not backwards-compatible | Version the DAR packages. Upgrade choice on `Installation` checks compatibility. If breaking change, require uninstall + reinstall with data migration handled by app-specific migration contracts. |
| Party allocation conflicts with existing parties on the node | Namespace party IDs under the app (e.g., `app-id::user-party::role`). Check for collisions before allocation. |

### Licensing & Payment

| Edge Case | Handling |
|---|---|
| Payment succeeds but license contract creation fails | Atomic cross-domain transaction means both succeed or both fail. If using the Global Synchronizer for settlement, this is handled at the protocol level. If the marketplace sync domain is down, the entire transaction rolls back including payment. |
| Subscription expires while user is mid-transaction in the app | License expiry is checked at install/access time, not mid-transaction. Running workflows complete. New workflow submissions check license validity. Grace period (configurable by provider) before hard cutoff. |
| User disputes a charge | Add a `Dispute` template. User creates dispute, marketplace operator mediates. During dispute, license stays active (or enters `Suspended` state based on provider policy). Resolution is a choice exercised by the marketplace operator. |
| Canton Coin price volatility affects usage-based pricing | Pricing denominated in USD equivalent. Canton's mint-burn equilibrium mechanism aims to stabilize the CC/USD rate. For extra safety, lock in exchange rate at billing cycle start. |
| Provider changes pricing model on existing users | Price changes only apply to new licenses or at renewal. Active licenses honor their original terms until expiry. Enforce this in the Daml template — `pricingModel` is immutable on an active `License`, only set on creation or renewal. |
| Free app transitions to paid | Existing `Installation` contracts with `Free` licenses remain valid. Provider creates new `AppListing` version with updated pricing. Existing users keep access until they upgrade to the new version, at which point they're prompted for the new license. |

### Sync Domain Topology

| Edge Case | Handling |
|---|---|
| Marketplace sync domain goes down | Registry data persists on connected nodes. Users can't browse or create new installs. Existing installations continue functioning since apps run on their own domains. Recovery: marketplace domain operators restore from PostgreSQL backups. |
| App's private sync domain is unreachable | App functionality degrades but marketplace operations continue. `Installation` contract can track domain health status. Surface connectivity issues in the marketplace UI. |
| Cross-domain atomic transaction fails due to one domain being slow | Canton's protocol handles this — the transaction either commits on all involved domains or rolls back entirely. Timeouts are configurable at the sync domain level. If persistent, the marketplace flags the problematic domain. |
| Node operator wants to migrate from self-hosted to NaaS provider | Canton supports domain reassignment. User's parties and contracts can be transferred to the new node. The marketplace `Installation` contract needs a `MigrateNode` choice that updates the `userNodeId` reference. |

---

## Implementation Plan

### Phase 1 — Local Prototype (Sandbox)

**Goal:** Core registry, install flow, and licensing working on a local Canton sandbox.

**Tasks:**

- [ ] Set up Canton sandbox via `daml start` with Splice LocalNet
- [ ] Define Daml templates: `AppListing`, `InstallRequest`, `Installation`, `License`
- [ ] Define `PricingModel` data type and `ListingStatus` enum
- [ ] Implement choices: `RequestInstall`, `UpdateListing`, `DelistApp`, `Renew`, `Revoke`, `Cancel`
- [ ] Write Daml test scenarios covering the happy path for each workflow
- [ ] Build a basic Canton Console script that simulates: provider lists app → user requests install → license created → install completes
- [ ] Test with 3 participant nodes (marketplace operator, app provider, user)

**Deliverables:** Working Daml project with all core templates and passing test scenarios.

### Phase 2 — Distribution Service

**Goal:** Off-chain DAR hosting and verification service.

**Tasks:**

- [ ] Build REST API for DAR upload, download, and hash verification
- [ ] Implement hash computation (SHA-256) on upload, reject mismatches against on-chain listing
- [ ] Add authentication via Canton party identity (TLS client certs or JWT)
- [ ] Implement integrity verification on the download path
- [ ] Add garbage collection for orphan DARs (no matching on-chain listing)
- [ ] Write integration tests: upload DAR → publish listing → download DAR → verify hash

**Deliverables:** Distribution service with API docs, deployed alongside sandbox.

### Phase 3 — Provisioning Automation

**Goal:** Automated end-to-end install flow triggered by Daml contract choices.

**Tasks:**

- [ ] Build automation bot that watches for `InstallRequest` contracts on the app provider's node
- [ ] Implement provisioning steps: DAR download → hash verify → Admin API upload → party allocation → sync domain connection → topology transaction → permissions setup
- [ ] Make each step idempotent with state tracking on the `InstallRequest`
- [ ] Implement `Repair` choice that re-runs from last successful step
- [ ] Implement rollback on timeout (configurable, default 2 hours)
- [ ] Handle edge cases: concurrent requests, existing domain connections, resource checks
- [ ] Write integration tests for happy path and each failure mode

**Deliverables:** Automation bot with provisioning pipeline, integrated with sandbox.

### Phase 4 — Payment Integration

**Goal:** Atomic licensing and payment settlement via Canton Coin.

**Tasks:**

- [ ] Integrate Canton Coin transfer contracts
- [ ] Implement atomic cross-domain transaction: payment (Global Synchronizer) + license grant (marketplace domain)
- [ ] Implement subscription renewal automation
- [ ] Implement usage-based billing with activity marker aggregation
- [ ] Add `Dispute` template and mediation workflow
- [ ] Test payment failure rollback (ensure atomicity)
- [ ] Test subscription expiry grace period logic

**Deliverables:** End-to-end paid app installation with atomic settlement.

### Phase 5 — Frontend & DevNet Deployment

**Goal:** User-facing marketplace UI and deployment to Canton DevNet.

**Tasks:**

- [ ] Build frontend (web app) powered by Scan API / Ledger API for browsing listings
- [ ] Implement search, filtering (by category, pricing model, compatibility)
- [ ] Add provider dashboard: list apps, view installs, monitor revenue
- [ ] Add user dashboard: installed apps, active licenses, billing history
- [ ] Deploy marketplace sync domain to DevNet
- [ ] Deploy distribution service to DevNet infrastructure
- [ ] Run full end-to-end tests on DevNet with real validator nodes
- [ ] Apply for DevNet validator sponsorship if needed

**Deliverables:** Functional marketplace on DevNet with web UI.

### Phase 6 — TestNet & MainNet

**Goal:** Production deployment with GSF approval.

**Tasks:**

- [ ] Apply to GSF Tokenomics Committee for TestNet access (requires being within 2 weeks of production readiness)
- [ ] Run full regression on TestNet
- [ ] Apply for Featured Application status to earn activity marker rewards
- [ ] Submit MainNet request to Featured Applications and Validators committee
- [ ] Set up monitoring, alerting, and node health dashboards
- [ ] Document operator runbooks for marketplace sync domain maintenance
- [ ] Launch

**Deliverables:** Live marketplace on Canton MainNet.

---

## Open Questions

- Should the marketplace itself be permissionless (anyone can list) or curated (operator approval required)?
- How to handle app versioning and backwards compatibility at the DAR level — does the marketplace enforce semver?
- Should the distribution service use content-addressed storage (IPFS) as a decentralized fallback?
- What's the governance model for the marketplace sync domain — single operator, consortium, or DAO-like structure via Daml contracts?
- Can the marketplace earn Featured Application status and Canton Coin rewards through activity markers on installs and license renewals?
