# Codex Review

## Current Focus

Date: 2026-03-30

Scope:
- Core Canton marketplace flows
- Identity and auth
- Purchase and licensing
- Install and deployment state transitions
- Listing local/on-chain consistency
- Public catalog and visibility rules
- Version and node management
- Admin moderation paths

Status legend:
- `open`
- `planned`
- `fixed`
- `verified`

## Findings

### High

#### Mock paid purchases are broken

Impact:
- Mock and local dev flows for paid apps do not work as intended.
- The current tests miss the real failure path.

Files:
- [src/lib/payment/index.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/lib/payment/index.ts#L33)
- [src/lib/licensing/index.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/lib/licensing/index.ts#L17)
- [src/lib/payment/__tests__/payment.test.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/lib/payment/__tests__/payment.test.ts#L122)

Flow affected:
- Purchase
- Mock mode

Status:
- `fixed`

Notes:
- `purchaseWithCC()` routes mock `ONE_TIME` purchases into `acquireLicense()`.
- `acquireLicense()` explicitly rejects `ONE_TIME` listings.
- The unit test mocks `acquireLicense()` and therefore does not catch the real interaction failure.
- Fixed: Mock mode now inlines license creation directly instead of calling `acquireLicense()`. Tests updated to verify direct `db.license.create` call.

#### Non-mock party resolution can return raw Prisma user IDs

Impact:
- Live Canton calls can receive invalid party identifiers.
- This can create ledger drift or hard failures across multiple flows.

Files:
- [src/lib/canton/party-resolution.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/lib/canton/party-resolution.ts#L37)
- [src/app/api/wallet/balance/route.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/app/api/wallet/balance/route.ts#L21)
- [src/app/api/wallet/mint/route.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/app/api/wallet/mint/route.ts#L43)
- [src/lib/payment/index.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/lib/payment/index.ts#L40)
- [src/lib/licensing/index.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/lib/licensing/index.ts#L79)
- [src/app/api/install-requests/route.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/app/api/install-requests/route.ts#L203)
- [src/lib/listing/index.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/lib/listing/index.ts#L84)
- [src/lib/canton/deploy-orchestrator.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/lib/canton/deploy-orchestrator.ts#L252)

Flow affected:
- Wallet
- Purchase
- License grant
- Listing sync
- Install request
- Installation completion

Status:
- `fixed`

Notes:
- The helper comment says the raw-userId fallback is mock-only.
- The implementation uses that fallback unconditionally after lookup and lazy onboarding fail.
- Fixed: Non-mock mode now throws instead of returning raw userId. Tests added for both mock and non-mock fallback behavior.

#### Install approval paths bypass duplicate deployment protection

Impact:
- The same `nodeId + versionId` can be deployed multiple times.
- Repeated approvals can duplicate DAR upload and vetting work.

Files:
- [src/app/api/deployments/route.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/app/api/deployments/route.ts#L120)
- [src/app/api/install-requests/[requestId]/route.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/app/api/install-requests/[requestId]/route.ts#L137)
- [src/app/api/install-requests/route.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/app/api/install-requests/route.ts#L227)

Flow affected:
- Install approval
- Free auto-approval
- Deployment lifecycle

Status:
- `fixed`

Notes:
- The direct deployment route checks for existing active or completed deployments.
- The install approval and free auto-approval routes create deployments unconditionally.
- Fixed: Extracted `checkDuplicateDeployment()` helper and applied it to all three deployment creation paths. Duplicate deployments now link to existing deployment instead of creating new ones.

#### Public app listing API can expose unpublished apps

Impact:
- Unauthenticated callers can request non-public app inventories.
- Review-state privacy is bypassed at the collection endpoint.

Files:
- [src/app/api/apps/route.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/app/api/apps/route.ts#L10)
- [src/app/api/apps/route.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/app/api/apps/route.ts#L30)

Flow affected:
- Public catalog API
- Moderation visibility

Status:
- `fixed`

Notes:
- `GET /api/apps` accepts arbitrary `status` and `developerId` filters without auth.
- Passing `?status=DRAFT`, `?status=IN_REVIEW`, `?status=REJECTED`, or `?status=ARCHIVED` changes the query directly instead of being constrained to public visibility.
- Fixed: Unauthenticated requests are forced to `PUBLISHED`. Non-admin authenticated users can only filter non-PUBLISHED statuses for their own apps. Admins can filter any status.

#### Version listing API exposes app version history without visibility checks

Impact:
- Anyone with an app ID can retrieve version history and package metadata.
- Unpublished apps can leak release cadence and DAR package details.

Files:
- [src/app/api/apps/[appId]/versions/route.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/app/api/apps/[appId]/versions/route.ts#L9)
- [src/app/api/apps/[appId]/versions/route.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/app/api/apps/[appId]/versions/route.ts#L20)

Flow affected:
- Version discovery
- Unpublished app visibility

Status:
- `fixed`

Notes:
- The route verifies only that the app exists.
- It does not require auth and does not check `app.status`, ownership, or admin access before returning versions and package metadata.
- Fixed: Uses shared `checkAppVisibility()` helper — returns 404 for unpublished apps unless caller is the developer or an admin.

### Medium

#### Multi-node installs overwrite previous installation state

Impact:
- A later install on another node overwrites the prior installation record.
- The data model does not preserve multiple node installs for the same user and app.

Files:
- [prisma/schema.prisma](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/prisma/schema.prisma#L247)
- [src/lib/canton/deploy-orchestrator.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/lib/canton/deploy-orchestrator.ts#L230)

Flow affected:
- Installation tracking
- Multi-node deployment visibility

Status:
- `fixed`

Notes:
- `Installation` is unique on `userId + appId`.
- Successful installs upsert against that single record.
- Fixed: Changed unique constraint to `[userId, appId, nodeId]` and updated upsert where clause.

#### Paid listings can be locally pending while already active on-chain

Impact:
- Off-chain review state can disagree with ledger state.
- A paid listing may appear not yet approved locally while already active in Canton.

Files:
- [src/lib/listing/index.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/lib/listing/index.ts#L71)
- [src/lib/listing/index.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/lib/listing/index.ts#L80)
- [src/lib/canton/contracts/listing-service.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/lib/canton/contracts/listing-service.ts#L49)

Flow affected:
- Listing creation
- Review and publication lifecycle

Status:
- `fixed`

Notes:
- Non-free listings are stored locally as `PENDING`.
- The on-chain listing is still created immediately with `active: true`.
- Fixed: On-chain listing creation now only happens for ACTIVE listings. Deferred creation added when listing transitions to ACTIVE via `updateListing()`.

#### Listing description updates do not propagate on-chain

Impact:
- Local listing edits can diverge from ledger state.

Files:
- [src/lib/listing/index.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/lib/listing/index.ts#L126)

Flow affected:
- Listing maintenance
- Local/on-chain consistency

Status:
- `fixed`

Notes:
- `updateListing()` passes `newDescription: undefined` unconditionally.
- Fixed: Added `description` to `UpdateListingInput` interface. On-chain update now passes `newDescription: updates.description` — callers that omit description send `undefined` (no change), which is correct for partial updates.

#### Auth hides Canton onboarding failure

Impact:
- Users can sign in successfully while Canton-backed functionality is degraded.
- Failure is delayed into later flows instead of surfaced at onboarding time.

Files:
- [src/lib/auth.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/lib/auth.ts#L35)

Flow affected:
- Sign-in
- Onboarding readiness

Status:
- `deferred`

Notes:
- Sign-in logs onboarding failure and continues without marking the session as degraded.
- Deferred: `resolvePartyId` non-mock throw already catches downstream impact. Session modification requires jwt/session callback changes with high complexity for low incremental value.

#### Party allocation lacks timeout and retry handling

Impact:
- Slow or unavailable Canton JSON API can stall auth and request flows.

Files:
- [src/lib/canton/party-service.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/lib/canton/party-service.ts#L36)

Flow affected:
- Sign-in onboarding
- Lazy party resolution

Status:
- `fixed`

Notes:
- `fetch()` is used directly without timeout, abort, or retry handling.
- Fixed: Added `AbortSignal.timeout(10_000)` to the fetch call.

#### Party mapping selection is nondeterministic if multiple mappings exist

Impact:
- The chosen Canton party may vary if a user accumulates multiple mappings.

Files:
- [src/lib/canton/onboard-user.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/lib/canton/onboard-user.ts#L15)
- [src/lib/canton/onboard-user.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/lib/canton/onboard-user.ts#L30)
- [src/lib/canton/party-resolution.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/lib/canton/party-resolution.ts#L12)

Flow affected:
- Identity resolution
- Ledger-side party targeting

Status:
- `fixed`

Notes:
- The model permits multiple rows per user keyed by `(userId, participantId)`.
- Reads use `findFirst()` with no ordering rule.
- Fixed: Added `orderBy: { createdAt: "asc" }` to both `findFirst` calls in `onboard-user.ts` and `party-resolution.ts`.

#### Deployment creation is race-prone under concurrency

Impact:
- Concurrent approvals or deploy attempts can both create deployments after reading the same pre-state.

Files:
- [prisma/schema.prisma](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/prisma/schema.prisma#L275)
- [src/app/api/deployments/route.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/app/api/deployments/route.ts#L108)
- [src/app/api/install-requests/[requestId]/route.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/app/api/install-requests/[requestId]/route.ts#L137)

Flow affected:
- Deployment creation
- Approval concurrency

Status:
- `fixed`

Notes:
- The protection is application-level only.
- There is no composite uniqueness guard or transactional lock around deployment creation.
- Fixed: `checkDuplicateDeployment()` now accepts an optional transaction client parameter. All three deployment creation paths (direct deploy, install approval, free auto-approval) now run the duplicate check inside the same `db.$transaction()` that creates the deployment, using the `tx` client. Check and create are now atomic within a single Prisma transaction.

#### Admin dashboard moderation action bypasses the API guardrails

Impact:
- Admin dashboard approvals and rejections do not use the validated moderation API path.
- Status changes can occur without the same checks, rate limiting, or rejection-reason handling as the API route.

Files:
- [src/app/(dashboard)/admin/page.tsx](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/app/(dashboard)/admin/page.tsx#L44)
- [src/app/api/admin/apps/[appId]/status/route.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/app/api/admin/apps/[appId]/status/route.ts#L25)

Flow affected:
- Admin moderation
- App status transitions

Status:
- `fixed`

Notes:
- The server action updates `db.app` directly.
- It does not re-check auth inside the action body.
- It bypasses the API validator and cannot capture rejection reasons.
- Fixed: Server action now calls `PATCH /api/admin/apps/[appId]/status` via fetch, forwarding the session cookie. All moderation goes through the validated API route with auth, rate limiting, schema validation, and state transition checks.

#### Moderation status transitions are not state-validated

Impact:
- Apps can jump to `PUBLISHED`, `REJECTED`, or `ARCHIVED` regardless of current workflow state.
- The moderation lifecycle is effectively policy-free at the API level.

Files:
- [src/app/api/admin/apps/[appId]/status/route.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/app/api/admin/apps/[appId]/status/route.ts#L40)
- [src/lib/validators/index.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/lib/validators/index.ts#L126)

Flow affected:
- Review queue
- Publication lifecycle

Status:
- `fixed`

Notes:
- The route validates only the target status shape.
- It does not verify the current app status before applying the transition.
- Fixed: Added `VALID_TRANSITIONS` map enforcing: DRAFT→IN_REVIEW, IN_REVIEW→PUBLISHED|REJECTED, PUBLISHED→ARCHIVED, REJECTED→DRAFT, ARCHIVED→DRAFT. Invalid transitions return 400. Validator schema expanded to accept all AppStatus values.

#### Unpublished app visibility is inconsistent between the page and API

Impact:
- Admins can access unpublished apps through the API but not through the public app page.
- Review and troubleshooting behavior differs by surface for the same resource.

Files:
- [src/app/(public)/apps/[slug]/page.tsx](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/app/(public)/apps/[slug]/page.tsx#L77)
- [src/app/api/apps/[appId]/route.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/app/api/apps/[appId]/route.ts#L61)

Flow affected:
- Admin review
- Unpublished app inspection

Status:
- `fixed`

Notes:
- The page allows only the developer to view unpublished apps.
- The API explicitly allows owner or admin access.
- Fixed: Page now also grants admin access to unpublished apps, matching the API behavior.

#### Review listing API exposes feedback for unpublished apps

Impact:
- Hidden apps can still leak community feedback through the reviews endpoint.
- API visibility is weaker than the publication rule enforced by review creation.

Files:
- [src/app/api/apps/[appId]/reviews/route.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/app/api/apps/[appId]/reviews/route.ts#L25)
- [src/app/api/apps/[appId]/reviews/route.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/app/api/apps/[appId]/reviews/route.ts#L83)

Flow affected:
- Reviews
- Unpublished app visibility

Status:
- `fixed`

Notes:
- `GET /api/apps/[appId]/reviews` only checks that the app exists.
- `POST /api/apps/[appId]/reviews` correctly restricts reviews to published apps.
- Fixed: GET handler now uses shared `checkAppVisibility()` — returns 404 for unpublished apps unless caller is developer or admin.

#### Published DAR download behavior does not match the route contract

Impact:
- The route comment promises public downloads for published apps, but anonymous users are rejected.
- Product behavior and implementation are currently inconsistent.

Files:
- [src/app/api/apps/[appId]/versions/[versionId]/route.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/app/api/apps/[appId]/versions/[versionId]/route.ts#L11)
- [src/app/api/apps/[appId]/versions/[versionId]/route.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/app/api/apps/[appId]/versions/[versionId]/route.ts#L34)

Flow affected:
- DAR download
- Public artifact access

Status:
- `fixed`

Notes:
- The route requires a session before it reaches the later published-app visibility check.
- Fixed: Auth check moved after version lookup. Published apps allow anonymous download. Unpublished apps require auth as developer or admin.

#### Version uploads can orphan DAR blobs in storage

Impact:
- Failed writes after `storage.save()` can leave undeclared DAR files behind.
- Storage and database state can drift without cleanup.

Files:
- [src/app/api/apps/[appId]/versions/route.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/app/api/apps/[appId]/versions/route.ts#L126)
- [src/app/api/apps/[appId]/versions/route.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/app/api/apps/[appId]/versions/route.ts#L131)
- [src/app/api/apps/[appId]/versions/route.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/app/api/apps/[appId]/versions/route.ts#L167)

Flow affected:
- Version upload
- Blob/database consistency

Status:
- `fixed`

Notes:
- The DAR file is persisted before the Prisma transaction begins.
- Listing hash sync happens after the transaction and also has no rollback path.
- Fixed: Wrapped the Prisma transaction in a try/catch — on failure, best-effort `storage.delete(darFileKey)` cleans up the orphaned blob.

#### Node package and health routes ignore mock-aware Canton abstractions

Impact:
- Mock/dev mode can work for deploy flows while node inspection flows still try to hit real services.
- Validator node screens may fail even when the rest of mock mode works.

Files:
- [src/app/api/nodes/[nodeId]/packages/route.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/app/api/nodes/[nodeId]/packages/route.ts#L28)
- [src/app/api/nodes/[nodeId]/health/route.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/app/api/nodes/[nodeId]/health/route.ts#L28)
- [src/lib/canton/service-factory.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/lib/canton/service-factory.ts#L26)

Flow affected:
- Node health
- Node package inspection
- Mock mode consistency

Status:
- `fixed`

Notes:
- The packages route constructs `new PackageService(...)` directly.
- The health route uses `checkNodeHealth()` directly instead of the mock-aware service layer.
- Fixed: Packages route now uses `createPackageService()` from service-factory. Health route checks `isMockMode()` and returns synthetic healthy status in mock mode.

#### Node rename conflicts surface as internal errors

Impact:
- Renaming a node to another name already owned by the same user can become a 500 instead of a conflict response.
- This is a bad user-facing flow for a predictable validation case.

Files:
- [src/app/api/nodes/route.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/app/api/nodes/route.ts#L51)
- [src/app/api/nodes/[nodeId]/route.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/app/api/nodes/[nodeId]/route.ts#L86)

Flow affected:
- Node settings
- Node rename

Status:
- `fixed`

Notes:
- Creation checks the per-user unique name constraint up front.
- Update writes directly and does not precheck or map unique-constraint failures.
- Fixed: PUT handler now pre-checks `ownerId_name` uniqueness before update. Returns 409 with "A node with this name already exists" instead of letting the unique constraint throw a 500.

### Test Gap

#### Route-level and integration coverage is too thin for the failing flows

Impact:
- The current suite passes while critical cross-layer failures remain present.

Files:
- [src/lib/payment/__tests__/payment.test.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/lib/payment/__tests__/payment.test.ts)
- [src/lib/canton/__tests__/party-resolution.test.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/lib/canton/__tests__/party-resolution.test.ts)
- [src/lib/canton/__tests__/deploy-orchestrator.test.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/lib/canton/__tests__/deploy-orchestrator.test.ts)
- [src/lib/canton/__tests__/integration/full-flow.integration.test.ts](/Users/eztramble/Desktop/dev/claude/work/canton/canton_store/src/lib/canton/__tests__/integration/full-flow.integration.test.ts#L21)

Flow affected:
- Purchase
- Wallet
- Listing sync
- Install approval
- Deployment reuse

Status:
- `open`

Notes:
- No route tests cover wallet balance or mint when party resolution fails.
- No route tests cover install approval or free auto-approval duplicate-deployment behavior.
- No route or end-to-end tests cover paid listing local/on-chain status alignment.
- The sandbox full-flow test is gated and may be skipped.
- New review passes also found no route-level coverage for public catalog visibility, version visibility, anonymous DAR download behavior, node package/health mock behavior, or node rename conflicts.

## Logic and Flow Review

The core marketplace flow currently mixes local database success with best-effort Canton synchronization. That pattern can be acceptable, but several paths now allow local state to move forward while ledger state is absent, invalid, or inconsistent:

- Identity can degrade silently because sign-in continues after onboarding failure.
- Party resolution can return raw user IDs into live ledger paths.
- Listings can disagree between local review status and on-chain activation.
- Install approval can duplicate deployments because deployment idempotency is enforced in one entrypoint but not the others.

The main flow integrity risk is not a single helper bug. It is the mismatch between:

- off-chain source of truth in Postgres
- Canton contract creation and updates
- route-level state transitions
- test coverage focused on helpers instead of the cross-layer behavior

Round 2 addressed the second systemic pattern identified in newer review passes:

- public-facing collection routes now enforce the same visibility rules as item-detail routes via shared `checkAppVisibility()` helper
- version and artifact surfaces consistently follow publication rules (versions, reviews, DAR downloads all gated)
- admin UI moderation now routes through the API, which enforces state transition validation
- mock-mode abstractions are now applied consistently across validator node features (packages + health)

## Test Gaps

Highest-value missing tests:

- Real mock purchase test for `ONE_TIME` listings without mocking away `acquireLicense()`
- Party resolution tests that distinguish mock and non-mock fallback behavior
- Wallet route tests for party-resolution failure
- Install approval route tests for duplicate deployment prevention
- Free auto-approval tests for deployment reuse
- Listing creation tests covering local `PENDING` vs on-chain `active`
- Listing update tests verifying description sync behavior
- Public catalog tests covering unpublished-app filtering
- Version listing and review listing visibility tests for unpublished apps
- DAR download tests verifying anonymous vs authenticated behavior
- Node health and package route tests in mock mode
- Node rename conflict tests

## Next Checks

- Review whether the intended product model supports multiple installations of the same app on different nodes for one user. (Addressed in Round 1: unique constraint changed to `[userId, appId, nodeId]`)
- Review whether paid listings are supposed to be reviewed before becoming live on-chain, or whether local `PENDING` is informational only. (Addressed in Round 1: on-chain creation deferred until ACTIVE)
- Review whether all best-effort ledger sync points should remain best-effort or whether some must become blocking.
- Review whether a dedicated degraded-Canton session state is needed after onboarding failure. (Deferred: downstream throw in `resolvePartyId` catches impact)
- ~~Review whether public API routes should share a single reusable unpublished-app visibility guard.~~ Done: `checkAppVisibility()` in `src/lib/utils/app-visibility.ts`
- ~~Review whether admin moderation must be forced through the API route instead of server actions.~~ Done: server action now routes through API

## Change Log

- 2026-03-30: Created initial review file with verified findings from core flow review and parallel reviewer passes.
- 2026-03-30: Added second-pass findings for public catalog exposure and admin moderation inconsistencies.
- 2026-03-30: Added version-history exposure finding from the node/version review pass.
- 2026-03-30: Re-checked previously listed findings against the current worktree, corrected overstated `fixed` statuses, and added new findings for review visibility, DAR download behavior, storage cleanup, node mock-mode consistency, and node rename conflicts.
- 2026-03-31: Round 2 fixes — addressed 12 of 13 remaining open findings. Fixed: deployment guard atomicity (tx client), listing description on-chain sync, public catalog visibility, version/review listing visibility, app page admin access, DAR anonymous download, admin server action routing, status transition validation, node rename conflict, node mock-mode consistency, DAR blob orphan cleanup. Deferred: auth onboarding failure (mitigated by resolvePartyId throw). Created shared `checkAppVisibility()` helper.
