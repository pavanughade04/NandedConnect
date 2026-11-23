# NandedConnect PostgreSQL Physical Schema Design Proposal

**Status:** Documentation-only physical design proposal; not executable SQL, a migration, or implementation approval.

**Compatibility target:** PostgreSQL 18.

**Decision baseline:** Approved D1–D34. Every physical structure below is a `CANDIDATE` unless explicitly labelled `APPROVED REQUIREMENT`. An `OPEN` item is not silently decided by this proposal.

## 1. Design boundary and conventions

This proposal translates the canonical [DATABASE_DESIGN.md](./DATABASE_DESIGN.md), [SCHEMA_RELATIONSHIP_MATRIX.md](./SCHEMA_RELATIONSHIP_MATRIX.md), [ARCHITECTURE_DECISIONS.md](./ARCHITECTURE_DECISIONS.md), [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md), and [PRODUCT_REQUIREMENTS.md](./PRODUCT_REQUIREMENTS.md) into an implementation-oriented candidate schema. D28 authorizes this documentation-only schema-readiness proposal; it does not authorize implementation.

It does not authorize SQL, migrations, database connections, database objects, roles, extensions, deployment, or production use. Security review, legal/privacy review, testing, operational validation, and production readiness remain incomplete.

### Candidate conventions

- Candidate identifiers use PostgreSQL `uuid`; timestamps use `timestamptz` in UTC.
- Candidate monetary, geographic, text-search, and JSON representations remain subject to detailed design and testing.
- Sensitive tokens, OTP values, passwords, and private object URLs are never stored in plaintext.
- Foreign keys should use restrictive behavior by default where deletion could erase audit, moderation, ownership, or legal history. Exact `ON DELETE` behavior is identified as `OPEN` where the source documents do not decide it.
- Partial unique indexes, exclusion constraints, triggers, generated columns, and deferrable constraints are candidate mechanisms only.

### Approved security boundary

The database is behind the Express backend. Browsers do not receive database credentials or direct database access. Protected operations use a transaction-local, server-validated identity context on the same connection as protected queries, followed by commit or rollback before pool release. Missing or invalid context denies access.

The runtime application database role must not own ANY database tables and must not have `BYPASSRLS`. It must use least-privilege grants and must not bypass application authorization or selective RLS. Exact role names, grants, policy definitions, and pooler compatibility remain `OPEN`.

## 2. Identity, authentication, and authorization tables

### 2.1 `users`

**Purpose:** Authenticated customers, business owners, managers, administrators, and other authenticated actors.

**Candidate columns:**

| Column | Candidate type | Requirements |
|---|---|---|
| `id` | `uuid` | Primary key. |
| `email_normalized` | `citext` or normalized `text` | Required and unique; exact normalization choice is `OPEN`. |
| `password_hash` | `text` | Required for password accounts; Argon2id output only. |
| `status` | controlled `text`/enum | Candidate values include pending, active, suspended, deletion_requested, deleted. |
| `email_verified_at` | `timestamptz` | Nullable. |
| `deletion_requested_at`, `deleted_at` | `timestamptz` | Nullable lifecycle timestamps. |
| `created_at`, `updated_at` | `timestamptz` | Required audit timestamps. |

**Candidate constraints and indexes:** primary key; unique normalized email; status check; indexes on status and deletion state. No plaintext password or recovery answer.

**Relationships:** one user may have one `user_profiles` row, many roles, authenticated sessions, inquiries, messages, reviews, reports, audit records, and governance actions.

**Deletion:** Restrict physical deletion while dependent audit, ownership, moderation, or legal records exist. Use the approved account-deletion/anonymization workflow. Exact data-class behavior is `OPEN`.

### 2.2 `user_profiles`, `roles`, and `user_roles`

- `user_profiles.user_id` is a candidate primary-key foreign key to `users.id`; profile personal data is separated from authentication data.
- `roles` has a candidate `id` primary key and unique stable role code.
- `user_roles` has candidate composite primary key (`user_id`, `role_id`) and foreign keys to `users` and `roles`, plus `assigned_by` to `users` and assignment/revocation timestamps.
- Candidate checks prevent invalid self-assignment of privileged roles; application authorization and restricted privileges remain mandatory.
- Public registration must not grant administrator roles. Exact role hierarchy and multi-role conflict rules are `OPEN`.

### 2.3 Authenticated sessions and verification tokens

`sessions`, `password_reset_tokens`, and `email_verification_tokens` each use a candidate UUID primary key, a user foreign key, a unique one-way `token_hash`, creation/expiry timestamps, and used or revoked state as appropriate.

Candidate indexes cover token hashes and expiry for lookup and cleanup. Raw tokens exist only in the delivery flow. Single-use reset and verification behavior is required. Cookie names, CSRF/origin controls, device metadata, and cleanup periods are `OPEN` technical details.

## 3. Businesses, ownership, membership, and assignments

### 3.1 Directory and ownership tables

Candidate tables are `categories`, `localities`, `businesses`, `business_contacts`, `business_locations`, `business_hours`, `business_services`, `business_owners`, `ownership_claims`, and `business_submissions`.

- `businesses` has a UUID primary key, unique slug, normalized name, category/locality foreign keys, workflow status, publication timestamps, and optional deletion timestamp.
- Contacts, locations, hours, and services each reference one business. Candidate unique constraints cover one active primary contact, one active primary location, one business/day hours row, and active service-name uniqueness.
- `business_owners` references one business and one user, stores relationship and lifecycle status, and has a candidate partial unique index allowing at most one active `primary_owner` per business.
- `ownership_claims` references a business, claimant, reviewer, and verification request as applicable; status and decision timestamps preserve an auditable ownership process.
- `business_submissions` references the submitting user and optionally a business for edits; public writes remain disabled until launch approval.

**APPROVED D29 entity separation:** `business_owners`, `business_memberships`, and `inquiry_assignments` remain separate entities. The ownership-transfer workflow, conflict handling, and physical column details remain `OPEN`.

### 3.2 `business_memberships`

**Approved requirement:** Business-specific membership authorization is required for managers and other authorized members. Managers have limited business-specific permissions and cannot add/remove managers, transfer ownership, delete businesses, change owner security settings, or approve business verification.

**Candidate columns:** `id uuid`, `business_id uuid`, `user_id uuid`, role, status, invited/accepted/revoked timestamps, and audit actor references.

**Candidate relationships and constraints:** foreign keys to `businesses` and `users`; candidate unique active membership per user/business/role; status checks; indexes by business, user, and active status.

**Deletion:** Revocation is preferred to physical deletion where history is needed. Exact archival and anonymization behavior is `OPEN`.

### 3.3 `inquiry_assignments`

**APPROVED D29 requirement:** This remains a separate entity from both `business_owners` and `business_memberships`.

**Candidate columns:** `id uuid`, `manager_user_id uuid`, `business_id uuid`, `inquiry_id uuid`, status, assigned/revoked timestamps, assigning actor, and audit metadata.

**Candidate foreign keys:** manager to `users`, business to `businesses`, inquiry to `inquiries`. A candidate cross-record invariant requires `inquiry.business_id = inquiry_assignments.business_id`; a simple foreign key alone may not enforce this.

**Candidate constraints and indexes:** unique active manager/business/inquiry assignment; status checks; indexes by manager, business, inquiry, and active state. Candidate processing should require both active business membership and active inquiry assignment.

**Security:** Application authorization and selective RLS require business authorization plus inquiry assignment. Managers cannot expand their own assignment scope.

**OPEN:** Multiple managers per inquiry, maximum counts, assignment lifecycle, conflict/transfer rules, physical cross-record enforcement, and exact RLS policies. Technical recommendation: preserve assignment history and make active-assignment uniqueness enforceable, subject to approval of lifecycle semantics.

**PROPOSED TECHNICAL DESIGN:** Require `business_memberships(business_id, user_id, status)` to be active before an assignment is created or used. Enforce inquiry/business matching with `FOREIGN KEY (inquiry_id, business_id) REFERENCES inquiries (id, business_id)`. Use `UNIQUE (inquiry_id, manager_user_id) WHERE status = 'active'` to prevent duplicate active assignments while preserving revoked history. Assignment writes must lock the inquiry and relevant membership rows, and must record the assigning actor and timestamps.

**OPEN — OWNER APPROVAL:** Whether an inquiry may have multiple active managers, manager count limits, reassignment/conflict rules, and assignment status vocabulary remain product-owner decisions.

## 4. Guest identities, OTP, and inquiry sessions

### 4.1 `guest_identities`

**Approved requirements:** A reusable guest identity is keyed by a normalized phone identifier. Guest contact data is encrypted at application level, with encryption key/version metadata. Full contact access is restricted to the authorized business owner and assigned managers for that business’s inquiries, and sensitive access is audit-logged.

**Candidate columns:** `id uuid`, normalized phone lookup key, encrypted contact fields, encryption key/version metadata, verification status/timestamps, lifecycle state, and created/updated timestamps.

**Candidate constraints and indexes:** unique normalized phone identity; indexes on lifecycle and verification state. The exact normalization, encryption envelope, key-management integration, and identity merge/split behavior are `OPEN`.

### 4.2 `guest_otp_challenges`

**Candidate columns:** `id uuid`, `guest_identity_id uuid`, secure `otp_hash`, created/expiry timestamps, attempt count, resend timestamps/counting metadata, cooldown timestamp, verification timestamp/status, consumed timestamp, and expired/consumed state.

**Candidate foreign key:** `guest_identity_id` references `guest_identities.id`.

**Approved D22 constraints:** OTP validity is 5 minutes; maximum 5 incorrect attempts; resend cooldown is 60 seconds; maximum 5 resends per hour per phone number; OTP plaintext is never stored; a successfully verified challenge cannot be reused.

**PROPOSED TECHNICAL DESIGN:** Use `status text NOT NULL` with the values `pending`, `verified`, `consumed`, `expired`, and `locked`; `otp_hash bytea NOT NULL` containing a 32-byte application-generated hash; `created_at timestamptz NOT NULL`; `expires_at timestamptz NOT NULL`; `attempt_count smallint NOT NULL DEFAULT 0`; `max_attempts smallint NOT NULL DEFAULT 5`; `last_resend_at timestamptz`; `resend_count smallint NOT NULL DEFAULT 0`; `resend_window_started_at timestamptz`; `cooldown_until timestamptz`; `verified_at`, `consumed_at`, and `updated_at` nullable timestamps. Add checks `expires_at > created_at`, `attempt_count BETWEEN 0 AND 5`, `resend_count BETWEEN 0 AND 5`, and lifecycle checks requiring `verified_at` for `verified/consumed` and `consumed_at` for `consumed`. The service rejects verification at `now() >= expires_at`, after five incorrect attempts, or when status is not `pending`; successful verification changes the row to `verified` and consumes it in the same transaction that creates the session.

Use a partial unique index on `(guest_identity_id) WHERE status = 'pending'` so only one challenge is active per phone identity. Store the five-resends-per-hour counter on locked guest-identity rate-limit state (or an explicitly approved equivalent), not only on the challenge, because a new challenge must not reset the phone limit. OTP plaintext is never persisted or logged.

**OPEN — VALIDATION:** Hash construction, constant-time comparison, delivery failure handling, clock-skew tolerance, abuse-control storage, and concurrent resend/verify tests require security review and testing. **OPEN — OWNER APPROVAL:** Any change to the approved 5-minute, five-attempt, 60-second, or five-per-hour limits requires product-owner approval.

### 4.3 `guest_inquiry_sessions`

**Candidate columns:** `id uuid`, `guest_identity_id uuid`, `inquiry_id uuid`, opaque token hash, created/last-used timestamps, inactivity and absolute expiry timestamps, revoked timestamp/reason, successor/generation metadata, idempotency metadata, and audit references.

**Approved relationships:** Every session references exactly one reusable guest identity and exactly one inquiry. Each session is scoped to one inquiry. One guest identity and one inquiry may have many session records. Fresh OTP verification creates a new session; expired sessions remain invalid.

**Approved session rules:** 30-minute inactivity timeout, 24-hour absolute lifetime, cryptographically random opaque tokens, Secure/HttpOnly/SameSite cookie delivery, no localStorage, hash-only persistence, immediate revocation, and no cross-inquiry authorization.

**PROPOSED TECHNICAL DESIGN:** Store `token_hash bytea NOT NULL` as the SHA-256 digest of a cryptographically random 32-byte opaque token; never store the raw token. Store `token_version bigint NOT NULL DEFAULT 0`, `revoked_at`, `revocation_reason`, `created_at`, `last_used_at`, `inactivity_expires_at`, `absolute_expires_at`, and durable idempotency state. Require `absolute_expires_at > created_at`, `inactivity_expires_at <= absolute_expires_at`, and `token_version >= 0`. A valid session has `revoked_at IS NULL`, `now() < absolute_expires_at`, and `now() < inactivity_expires_at`; revocation sets `revoked_at` immediately and never clears it.

Use these candidate keys to enforce scope: `inquiries` has `UNIQUE (id, guest_identity_id)` and `UNIQUE (id, business_id)`; `guest_inquiry_sessions` has `UNIQUE (id, inquiry_id)` and `UNIQUE (id, guest_identity_id)`; and the session has ordinary foreign keys plus `FOREIGN KEY (inquiry_id, guest_identity_id) REFERENCES inquiries (id, guest_identity_id)`. Because both session columns are `NOT NULL`, a guest session cannot point at a customer inquiry or another guest's inquiry. `token_hash` is unique. A separate token-history table is not introduced, preserving the approved mutable-row direction.

**Indexes:** token hash, guest identity/inquiry, active authorization state, expiry, and revocation timestamps.

**Deletion:** Expiry and revocation do not delete the identity, inquiry, or session history. Inquiry deletion processes sessions under the approved deletion and retention workflow. Exact cleanup/archival is `OPEN`.

## 5. Inquiries and inquiry messages

### 5.1 `inquiries`

**Candidate columns:** `id uuid`, `business_id uuid`, nullable `customer_user_id uuid`, nullable `guest_identity_id uuid`, subject/body or encrypted contact-related fields as approved, status, last-activity timestamp, created/updated/deleted timestamps, and audit metadata.

**APPROVED D30 database invariant:** Exactly one ownership identity is present: authenticated customer OR guest identity. Neither both nor neither is valid. This must be a mandatory PostgreSQL database-level invariant plus an authorized backend-controlled write path.

**PROPOSED TECHNICAL DESIGN:** Use `CHECK ((customer_user_id IS NOT NULL) <> (guest_identity_id IS NOT NULL))`. Add ordinary foreign keys to `users` and `guest_identities`, plus `UNIQUE (id, guest_identity_id)` and `UNIQUE (id, business_id)` to support composite scope checks. The XOR is database-enforced independently of the backend write path. The authorized backend path still performs authorization, guest verification, D23 context setup, audit, and deletion-workflow checks.

The guest identity is immutable for an inquiry in the initial design. Conversion to an authenticated customer, administrative/background writes, exact error mapping, and verified-guest state representation remain product/authorization decisions.

**Indexes:** business/status/activity; customer/status; guest/status/activity; candidate active/non-deleted partial indexes.

**Authorization:** Customer reads/writes require the authenticated customer identity. Guest access requires an OTP-verified, active inquiry session. Owners and managers require business membership and inquiry assignment as applicable. RLS must deny missing or mismatched identity context.

### 5.2 `inquiry_messages`

**Candidate columns:** `id uuid`, `inquiry_id uuid`, nullable `sender_user_id uuid`, nullable `sender_guest_session_id uuid`, message body, created timestamp, idempotency key, read timestamp/state, deleted/redacted markers, and audit metadata.

**APPROVED D31 database invariant:** Exactly one sender identity is present: authenticated user OR guest inquiry session. This must be a mandatory database-level invariant plus an authorized backend-controlled write path.

**PROPOSED TECHNICAL DESIGN:** Use `CHECK ((sender_user_id IS NOT NULL) <> (sender_guest_session_id IS NOT NULL))`. Add foreign keys to `inquiries`, `users`, and `guest_inquiry_sessions`, plus `FOREIGN KEY (sender_guest_session_id, inquiry_id) REFERENCES guest_inquiry_sessions (id, inquiry_id)`. The composite foreign key rejects a guest session from another inquiry. The backend-controlled write path still performs authorization and D23 context checks.

**PROPOSED TECHNICAL DESIGN:** Scope client idempotency as `guest_session_id + idempotency_key` for guest messages and `authenticated_user_id + inquiry_id + idempotency_key` for authenticated messages. A candidate `message_idempotency` table stores the scope, request fingerprint, resulting `message_id`, response metadata, and `created_at`, with a unique index on the scope and key. A retry with the same fingerprint returns the original result; reuse with a different fingerprint is rejected. This table is not token-generation history.

**Authorization:** Authenticated users must be authorized for the inquiry. Guest senders must have an active, non-revoked session for the same inquiry. Owners and assigned managers may respond only in their authorized scope. System-generated events are not stored as human-authored messages.

**Indexes:** inquiry/created time, sender references, guest session, and idempotency key. Candidate deterministic ordering key remains subject to detailed design.

**Deletion:** Inquiry deletion processes messages and personal contact information under legal holds and mandatory-retention exceptions. Revoking a session must not rewrite historical sender attribution.

## 6. Guest token rotation and revocation

**APPROVED D30/D31 physical direction:** Use a mutable `guest_inquiry_sessions` row with token generation/version state and durable idempotency state. A separate token-generation history table is not required by this approved direction.

**Approved behavior:** After every successfully processed guest message, rotate the guest access token. The message acceptance and token successor update must be atomic. Concurrent requests, retries, duplicate submissions, idempotency, prevention of multiple valid successors, expiry, and immediate revocation must be handled. System events and notifications never rotate guest tokens.

The mutable session row must support the current token hash, generation/version, one-successor enforcement, and durable idempotency result. Message insertion, token rotation, and idempotency-result persistence must occur atomically and be retry-safe.

**PROPOSED TECHNICAL DESIGN:** For a guest message, begin `READ COMMITTED`, lock the session row with `SELECT ... FOR UPDATE`, and re-check token hash, `revoked_at`, both expiries, and the request's inquiry after the lock. Insert or claim the scoped idempotency record, insert the message, update the same session row with a newly generated token hash and `token_version = token_version + 1`, and persist the response token only to the delivery path; commit all changes together. The unique idempotency key makes a retry return the original message and successor response without another insert or rotation. A different request cannot create a second successor while the row lock is held. A failed message transaction rolls back both message and rotation.

The token presented by a concurrent request that loses the lock is rejected if it is the prior hash after a successful rotation. A request already committed with the same idempotency key is replayed safely. Revocation takes the same row lock; if it commits first, the message is rejected, and if message processing commits first, revocation immediately invalidates the new token. This deterministic race outcome must be covered by integration tests.

**OPEN — VALIDATION:** The lock/isolation behavior, hash comparison, transaction-pool safety, idempotency replay response, deadlock retry, and revocation race require concurrency and security testing. **OPEN — OWNER APPROVAL:** Idempotency retention, duplicate-key error behavior, and whether a fresh OTP revokes other active sessions are product/operational choices. The proposed `READ COMMITTED` plus row lock is the implementation starting point; serializable isolation is not required unless testing exposes a cross-row anomaly.

**Approved D27 requirement:** Sensitive guest-session revocation actions must be audit-logged. Revocation is transactionally persisted and subsequent requests using the revoked token must be rejected before protected message access.

## 7. Deletion requests, legal holds, and retention

### 7.1 `deletion_requests`

**APPROVED physical direction; candidate columns:** `id uuid`, request type, explicit requester user or guest identity reference, explicit target account or inquiry reference, required OTP verification status/time, status, request-level legal-hold and mandatory-retention-exception metadata, submitted/verified/processing/completed timestamps, rejection reason, audit actor, and correlation identifiers.

**Approved lifecycle:** Separate request entity with statuses `Pending`, `Verified`, `Processing`, `Completed`, and `Rejected`. Guest inquiry deletion requires fresh OTP verification. Inquiry deletion includes associated messages and personal contact information, subject to documented legal holds and mandatory retention requirements. Guest retention is 24 months after last activity, with earlier verified deletion subject to those exceptions.

**Candidate constraints:** requester XOR; target XOR; status transition validation; candidate unique active request per requester/target scope; indexes by requester, target, status, and processing time.

**OPEN:** Exact column names/types, guest/account requester combinations, duplicate active request behavior, hard deletion versus anonymization per data class, and exact cascade/restrict/archive behavior. Request-level legal-hold metadata is approved; the detailed hold evaluation workflow and any future separate hold registry remain open. Product-owner approval is required before changing retention or deletion semantics.

### 7.2 Deletion dependencies

**PROPOSED TECHNICAL DESIGN:** Candidate foreign keys from messages, sessions, assignments, events, notifications, reports, media, verification records, and audit/security references use `ON DELETE RESTRICT` (or nullable `SET NULL` only where preserving the record without the actor is explicitly acceptable). Do not use broad `ON DELETE CASCADE`. A deletion worker locks the `deletion_requests` row and target root, re-checks legal hold and mandatory-retention status, verifies the request state and required OTP, processes dependent records in an idempotent dependency order, records each result, and marks the request `Completed` only after all permitted work commits. It re-checks holds before each destructive batch and stops safely if a hold appears.

Guest inquiry data is retained for 24 months after last activity; a verified earlier request may proceed only for data not covered by a legal hold or mandatory retention. Account data is targeted for deletion within 30 days after a verified request, subject to the same exceptions. Physical deletion versus anonymization for each data class, legal-hold authority, owner approval, and the exact dependent-record treatment are not inferred here.

**OPEN — OWNER APPROVAL:** Hard deletion versus anonymization, legal-hold evaluation/override authority, retention exceptions, and exact `ON DELETE` actions require product-owner and qualified legal/privacy approval.

**OPEN — VALIDATION:** The workflow requires idempotency, rollback, hold-race, backup, restore, and orphan-record testing before implementation.

## 8. Verification and private evidence

### `verification_requests`

Candidate columns include `id uuid`, business/requester foreign keys, verification type/status, phone-OTP verified timestamp, manual reviewer, decision reason, submitted/reviewed timestamps, and audit metadata.

### `verification_documents`

Candidate columns include `id uuid`, verification request foreign key, uploader foreign key, private object-storage key, checksum, MIME type, byte size, evidence type, creation/deletion timestamps, and lifecycle status.

Private evidence files remain in private object storage; PostgreSQL stores protected metadata/reference only. No public URL or unrestricted access is permitted. Reviewer authorization, retention, deletion, object-key lifecycle, and storage-provider details remain `OPEN`.

## 9. Reviews, moderation, reports, and media

### Reviews and reports

Candidate `reviews` has UUID primary key, customer and business foreign keys, rating check 1–5, body/display snapshot, moderation status, moderation fields, and timestamps. Candidate uniqueness prevents more than one review per customer/business while retaining edit history.

`review_reports` references one review and one reporting user, with reason/status/resolution/timestamps and candidate unique (`review_id`, `reporter_user_id`).

Generic `reports` references a reporting user and targets a business, review, or inquiry. Candidate target representation may use separate nullable target foreign keys with a target XOR check or a reviewed typed-resource model. The relationship between generic `reports` and `review_reports` is `OPEN`; no subtype or replacement is silently selected.

Reports create auditable moderation work. Exact status vocabulary, duplicate behavior, RLS, retention, and deletion behavior remain `OPEN` where not approved.

**PROPOSED TECHNICAL DESIGN:** Use explicit nullable target columns on `reports` (`business_id`, `review_id`, `inquiry_id`) with `CHECK (num_nonnulls(business_id, review_id, inquiry_id) = 1)`, ordinary foreign keys, and a scoped duplicate-prevention key for an active report. Keep `review_reports` as the review-specific record until the relationship to generic `reports` is approved; do not silently merge or duplicate moderation history.

**OPEN — OWNER APPROVAL:** Report taxonomy, duplicate-report behavior, moderation visibility, retention, and the relationship between `reports` and `review_reports` need product-owner approval. **OPEN — VALIDATION:** RLS and moderation authorization require security testing.

### `business_media`

Candidate columns: `id uuid`, `business_id uuid`, private object-storage key, checksum, MIME type, byte size, lifecycle state, created/updated/deleted timestamps, uploader, and audit metadata.

Candidate foreign key: `business_media.business_id` references `businesses.id`. Candidate indexes cover business/lifecycle and storage key uniqueness. Actual files remain private object-storage objects; no public media URLs or unrestricted access. Deletion and retention linkage are `OPEN`; no cascade is proposed as approved behavior.

**PROPOSED TECHNICAL DESIGN:** Make `object_key text NOT NULL UNIQUE`, `checksum bytea NOT NULL`, `mime_type text NOT NULL`, `byte_size bigint NOT NULL CHECK (byte_size > 0)`, and `lifecycle_state text NOT NULL`; keep uploader and timestamps as foreign-keyed audit metadata. Access is through an authorized, short-lived object-storage retrieval flow; PostgreSQL never stores a public URL. The database row is not marked deleted until object-storage deletion succeeds or an approved legal-retention exception is recorded.

**OPEN — OWNER APPROVAL:** Allowed media types, size limits, retention, replacement behavior, and deletion failure policy remain open. **OPEN — VALIDATION:** Object authorization, checksum/type validation, and private-storage lifecycle require security and operational testing.

## 10. System events and notifications

### 10.1 `system_events`

**Approved D32/D33 behavior:** `system_events` are durable canonical workflow/domain records separate from human-authored `inquiry_messages`. Status, assignment, reminder, and important account events belong here and/or in notifications. One event may create zero, one, or many notifications. System events do not rotate guest tokens.

**Candidate columns:** `id uuid`, event type, optional `inquiry_id`, optional business/account/resource references, payload minimized for privacy, occurred/created timestamps, actor/job identity, correlation/idempotency key, visibility state, and audit metadata.

Candidate foreign keys may reference inquiries and other approved resources. Exact event-resource model, taxonomy, visibility, ordering, retention, and timeline display are `OPEN`.

**PROPOSED TECHNICAL DESIGN:** Use `event_type text NOT NULL`, `occurred_at timestamptz NOT NULL`, `created_at timestamptz NOT NULL`, `correlation_id uuid NOT NULL`, and an idempotency key scoped to the originating workflow. Keep payloads minimized and redacted. Insert the canonical event and its in-app notifications in one transaction; retries use a unique event idempotency key. System events never populate `inquiry_messages` and never rotate guest tokens.

**OPEN — OWNER APPROVAL:** Event taxonomy, guest/customer visibility, timeline presentation, retention, and whether any event is user-visible remain product decisions. **OPEN — VALIDATION:** Idempotent retries and payload-redaction tests are required.

### 10.2 `notifications`

**Approved D26/D33/D34 behavior:** Notifications are recipient-specific in-app delivery/read-state records and remain separate from messages and system events. Inquiry messages may generate notifications. Email delivery is not an approved MVP requirement. One event may produce zero, one, or many notification records.

**APPROVED physical direction; candidate columns:** `id uuid`, `system_event_id`, optional source message reference, nullable authenticated recipient user reference, nullable guest recipient identity reference, explicit inquiry/resource scope for guest notifications, notification type, read state/timestamp, delivery state/timestamp, created timestamp, and idempotency key. Exactly one recipient reference is required. Global guest notifications remain disabled.

**PROPOSED TECHNICAL DESIGN:** Use `CHECK ((recipient_user_id IS NOT NULL) <> (recipient_guest_identity_id IS NOT NULL))`. Use nullable `inquiry_id` for user notifications, but require `inquiry_id IS NOT NULL` when `recipient_guest_identity_id IS NOT NULL` with `CHECK (recipient_guest_identity_id IS NULL OR inquiry_id IS NOT NULL)`. Add `FOREIGN KEY (inquiry_id, recipient_guest_identity_id) REFERENCES inquiries (id, guest_identity_id)`; this rejects a guest notification scoped to another guest's inquiry. Keep `read_at` on the notification row, never on the session. Add a unique event-recipient/resource idempotency key; retries with the same fingerprint return the existing notification.

**D34 authorization:** Guest identity is durable notification ownership, never authorization by itself. At read time, an active, non-revoked `guest_inquiry_session` must match both the guest identity and requested inquiry. Expired or revoked sessions deny access. Fresh OTP creates a new session that can access eligible notifications for that same guest/inquiry without reassigning history. Cross-inquiry reads must be denied.

**Indexes:** recipient/inquiry/read state/created time, delivery state, event idempotency key, and candidate inquiry-scoped authorization lookup. Exact index design is `OPEN`.

**Deletion:** Session expiry/revocation does not delete notifications or reset read state. Inquiry and guest-identity deletion must process notifications under retention, legal holds, and mandatory-retention exceptions. Exact anonymization/deletion behavior is `OPEN`.

**OPEN:** Recipient/resource key, RLS policies, event visibility, delivery-state values, ordering, retry behavior, background-job privileges, outbox/queue use, and whether system events appear in a conversation timeline. Global guest notifications are disabled by the approved design; enabling them would require a new product decision.

## 11. Launch approvals and feature flags

### `feature_flags`

Candidate columns: `id uuid`, unique key/environment, enabled value, rollout metadata, updated-by user, timestamps, and launch-control scope. Independent public-access, registration, submissions, reviews, inquiries, and indexing controls default off in private staging.

### `feature_flag_changes`

**APPROVED relationship direction; candidate columns:** `id uuid`, `feature_flag_id`, authorized actor, old/new values or configuration references, reason, timestamp, launch approval reference, and audit metadata. Approved changes are linked to their `launch_approvals` record and preserve actor, timestamp, and previous/new configuration references. Candidate foreign keys reference `feature_flags`, `users`, and `launch_approvals`.

### `launch_approvals`

Candidate columns: `id uuid`, authorized approver identity, timestamp, environment, launch scope, approved feature flags, previous/new configuration references, rollback reference, approval status, and audit history.

**Approved D25 boundary:** Public launch remains disabled without explicit product-owner approval.

**OPEN:** Exact snapshot format, approval-to-flag cardinality, change authorization workflow, rollback semantics, status transitions, uniqueness, indexes, RLS, and retention. The separate entities and approval linkage are approved; no further physical approval workflow is selected here.

**PROPOSED TECHNICAL DESIGN:** Store immutable `feature_flag_changes` rows with `old_config jsonb NOT NULL`, `new_config jsonb NOT NULL`, `changed_by uuid NOT NULL`, `changed_at timestamptz NOT NULL`, and `launch_approval_id uuid` where launch-scoped. Store `launch_approvals.approved_flags jsonb NOT NULL`, environment/scope, approver, status, and rollback reference. Apply a flag change and its history row in one transaction; never update history in place. Use `UNIQUE (environment, key)` for current flags and an index on `(feature_flag_id, changed_at DESC)` for audit/revert lookup.

**OPEN — OWNER APPROVAL:** Snapshot schema, approver authority, approval-to-flag cardinality, rollback semantics, and status transitions require product-owner approval. **OPEN — VALIDATION:** RLS, immutable history, and launch-gate bypass tests require security testing.

## 12. Audit and security records

### `audit_logs`

Candidate columns: `id uuid`, actor user or job identity, action, resource type/id, request/correlation ID, redacted before/after metadata, created timestamp, and retention classification. Append-only behavior for application roles is a technical recommendation.

Audit logging is required for sensitive contact access, token/session revocation, ownership/assignment changes, deletion workflows, moderation, launch approvals, and authorization/security events. Exact actor representation for guests and system jobs is `OPEN`.

### `security_events`

Candidate columns: `id uuid`, optional user, event type/severity, minimized or hashed network metadata, user-agent summary, redacted metadata, occurrence timestamp, and retention classification. It covers authentication failures, OTP abuse, revocation, authorization failures, rate limits, and suspicious activity. Exact retention and access policy remain subject to the canonical retention policy and security review.

## 13. Cross-cutting constraints and indexes

**PROPOSED TECHNICAL DESIGN — mandatory integrity constraints:**

- `inquiries`: `CHECK ((customer_user_id IS NOT NULL) <> (guest_identity_id IS NOT NULL))`; `UNIQUE (id, guest_identity_id)`; `UNIQUE (id, business_id)`.
- `inquiry_messages`: `CHECK ((sender_user_id IS NOT NULL) <> (sender_guest_session_id IS NOT NULL))`; composite guest-session/inquiry foreign key; `idempotency_key text NOT NULL` for the applicable sender scope.
- `guest_inquiry_sessions`: `token_hash bytea NOT NULL UNIQUE`; `guest_identity_id uuid NOT NULL`; `inquiry_id uuid NOT NULL`; timestamp ordering checks; `token_version bigint NOT NULL CHECK (token_version >= 0)`; revocation is terminal.
- `notifications`: `CHECK ((recipient_user_id IS NOT NULL) <> (recipient_guest_identity_id IS NOT NULL))`; `CHECK (recipient_guest_identity_id IS NULL OR inquiry_id IS NOT NULL)`; composite guest identity/inquiry foreign key.
- `deletion_requests`: requester XOR and target XOR checks; required status/timestamp checks; no completion while a hold or mandatory-retention exception applies.
- Active memberships, active assignments, one active primary owner, one pending OTP challenge per guest identity, and message/event-recipient idempotency keys use partial unique indexes.

The following are candidate baseline constraints where they do not change approved product behavior:

- Every table has a stable UUID primary key.
- Foreign keys protect identity, ownership, inquiry, business, sender, event, notification, moderation, and governance relationships.
- D30 inquiry-owner XOR is a mandatory database-level invariant plus backend authorization.
- D31 message-sender XOR is a mandatory database-level invariant plus backend authorization.
- Guest sessions require exactly one guest identity and one inquiry; messages require a matching session/inquiry relationship.
- Token hashes are unique; raw tokens and OTP values are never stored.
- OTP lifecycle, state, attempts, cooldown, and expiry checks are enforced through candidate constraints and authorized transaction logic.
- Active membership/assignment uniqueness and one active primary owner are candidate uniqueness rules.
- Deletion requester/target XOR and status transition checks are candidate rules.
- Notification recipient XOR and guest identity/inquiry scope are candidate rules.
- Ratings, statuses, day-of-week values, non-negative display orders, and timestamp ordering use candidate checks.

**PROPOSED TECHNICAL DESIGN — query-justified indexes:** Create indexes for every non-primary foreign-key child column used for parent deletion or authorization: `inquiries(business_id, status, last_activity_at)`, `inquiries(customer_user_id, status)`, `inquiries(guest_identity_id, status, last_activity_at)`, `inquiry_messages(inquiry_id, created_at, id)`, `inquiry_messages(sender_user_id)`, `inquiry_messages(sender_guest_session_id)`, `guest_inquiry_sessions(token_hash)`, `guest_inquiry_sessions(guest_identity_id, inquiry_id)`, `guest_inquiry_sessions(inquiry_id, revoked_at, absolute_expires_at)`, `business_memberships(business_id, user_id, status)`, `inquiry_assignments(inquiry_id, manager_user_id, status)`, `inquiry_assignments(manager_user_id, business_id, status)`, `deletion_requests(target_account_id, status)` and `deletion_requests(target_inquiry_id, status)`, `system_events(inquiry_id, occurred_at)`, `notifications(recipient_user_id, read_at, created_at)`, `notifications(recipient_guest_identity_id, inquiry_id, read_at, created_at)`, `review_reports(review_id, status)`, `business_media(business_id, lifecycle_state, created_at)`, and `feature_flags(environment, key)`.

Use partial unique indexes for active membership/assignment/primary-owner rows, pending OTP rows, and idempotency scopes. Use the normalized phone lookup key only for identity lookup and rate limiting; do not index encrypted contact payloads. Do not add speculative indexes, partitioning, or search indexes until query plans and representative data volumes justify them.

**OPEN — VALIDATION:** Exact predicates, selectivity, query plans, retention-job indexes, and concurrency behavior of partial uniqueness require performance and migration testing.

## 14. RLS, roles, and transaction behavior

### Approved D23 operating model

1. The backend validates the caller, guest session, inquiry scope, business membership, assignment, or administrative privilege.
2. It obtains one pooled connection and begins a transaction.
3. It sets the server-validated identity and authorization scope in transaction-local context using the approved mechanism (`SET LOCAL` or equivalent transaction-local `set_config`).
4. Protected reads and writes use that same connection and transaction.
5. Application authorization and selective RLS both enforce high-risk boundaries.
6. The transaction commits or rolls back before the connection returns to the pool.
7. Missing, malformed, stale, revoked, or invalid identity context denies access.

**PROPOSED TECHNICAL DESIGN:** Separate ownership and runtime privileges into candidate roles: `nanded_owner` owns tables and policies; `nanded_migrator` is used only by migrations; `nanded_app` is the pooled `LOGIN`, `NOBYPASSRLS` runtime role with DML only on approved API tables and no ownership or `CREATE`; `nanded_worker` has only the event/notification/deletion-job privileges needed by a controlled worker identity; and `nanded_readonly` is a restricted operational/reporting role with no access to protected payloads. The exact names and grant lists are deployment details, but table ownership separation and no `BYPASSRLS` are mandatory.

### Candidate RLS coverage

High-risk candidate RLS tables include inquiries, inquiry messages, guest sessions, guest contact data, verification evidence, notifications, deletion requests, assignments, reports, launch controls, audit logs, and security events. `users`, roles, and public directory rows may remain non-RLS only where grants and server authorization are sufficient; that choice needs review.

**PROPOSED TECHNICAL DESIGN:** Set transaction-local values such as `nanded.user_id`, `nanded.guest_identity_id`, `nanded.inquiry_ids`/scope, `nanded.business_ids`/scope, and `nanded.is_admin` only after server validation, using `set_config(name, value, true)`. Policies use `current_setting(name, true)` and deny when missing, malformed, stale, or inconsistent; no policy treats a guest identity alone as authorization. The backend must begin, set context, query, and commit/rollback on one connection, and reset/release it only after completion. Pool configuration must use transaction pooling compatibility or session pinning that cannot leak context.

**OPEN — VALIDATION:** Exact policy predicates, role grants, context schema, pooler behavior, background-job identity, admin break-glass controls, and policy tests require security review and adversarial testing. This proposal makes no security-certification claim.

Exact policy predicates, role grants, pooler transaction behavior, background-job identity, administrator support access, and policy test cases remain `OPEN`.

## 15. Transaction and concurrency requirements

**PROPOSED TECHNICAL DESIGN:** Candidate transactions are required for:

- Ownership validation and inquiry creation/update.
- OTP consumption and guest-session creation.
- Message insertion and guest-token rotation.
- Immediate session revocation.
- Membership and inquiry-assignment changes.
- Deletion-request state transitions and destructive processing.
- Canonical event and in-app notification creation.
- Launch approval and feature-flag changes.

Token rotation requires one-successor enforcement, retry idempotency, duplicate-submission prevention, and the deterministic revocation race described in Section 6. Use row locks under `READ COMMITTED` for the session and idempotency row; retry serialization/deadlock failures with bounded jitter, but never retry a rejected/expired/revoked token as if it were valid. Message insertion, token replacement, `token_version` increment, idempotency result, and any in-app notification write either all commit or all roll back. The database unique constraints are the final duplicate defense; application pre-checks are not sufficient. Deletion jobs re-check legal holds before completion. Notification creation is idempotent and retry-safe.

**OPEN — VALIDATION:** Event ordering, background-job privileges, exact retry limits, isolation escalation, and queue/outbox behavior require load, failure-injection, and security testing.

## 16. Implementation-readiness assessment

The seven newly approved design directions are incorporated. The following implementation work remains before table creation or protected backend operation:

The exact D30/D31 XOR checks, notification recipient XOR, guest-scope composite foreign keys, OTP lifecycle checks, row-lock protocol, and candidate indexes are now specified as `PROPOSED TECHNICAL DESIGN` above. They remain subject to engineering review and the validation gates below; they are not product or legal approvals.

- **Exact constraints:** Finalize the D30 and D31 XOR expressions, guest-session/inquiry cross-table enforcement, OTP lifecycle checks, token generation/idempotency uniqueness, deletion requester/target XOR, notification recipient XOR, and launch-approval linkage constraints.
- **Cross-table integrity:** Specify how inquiry business, assignment business, membership status, guest session ownership, message inquiry scope, and guest notification scope are enforced without relying on a simple foreign key where it is insufficient.
- **Transactions and locking:** Define the transaction and lock/isolation behavior for message insertion plus mutable-session token rotation/idempotency, revocation races, OTP consumption, deletion processing, notification retries, and feature-flag changes.
- **RLS and roles:** Define selective RLS policies, transaction-local context values, least-privilege grants, pooler behavior, background-job identity, and policy tests. The runtime role must not own ANY database tables and must not have `BYPASSRLS`.
- **Indexes and concurrency testing:** Finalize active-state partial indexes, scope/recipient lookup indexes, idempotency indexes, and concurrency tests for duplicate requests, retries, revocation races, and one-successor enforcement.
- **Remaining product-owner approvals:** Manager limits and assignment rules, deletion/anonymization semantics and hold evaluation, notification visibility/resource behavior, event timeline visibility, launch snapshot/rollback workflow, and any change to the disabled global-guest-notification rule.

These are implementation specifications and approval gates, not unresolved changes to D1–D34.

## 17. Unresolved decisions register

The following items remain explicitly `OPEN` and are not resolved by this proposal:

1. Exact table/column names where the canonical documents describe only conceptual entities.
2. Guest phone normalization, encryption/key-management design, and identity merge/split policy.
3. Ownership mutability, guest-to-customer conversion, and administrative/background inquiry writes.
4. Exact composite or equivalent database enforcement for session-owner/inquiry-owner and message-session/inquiry matching.
5. OTP replacement uniqueness and rate-limit storage.
6. Multiple guest sessions, session cleanup, and whether fresh verification revokes prior sessions.
7. Token rotation locks/isolation, idempotency scope, generation uniqueness expression, and in-flight revocation outcome.
8. Manager limits, multiple assignments, assignment lifecycle, and transfer/conflict rules; the three core entities remain separate as approved.
9. Deletion requester/target column details, duplicate active requests, hard deletion versus anonymization, legal-hold evaluation workflow, and dependent-record behavior; request-level hold metadata is approved.
10. Review-report relationship to generic reports.
11. Media lifecycle, object-storage deletion, retention, and authorization details.
12. Event taxonomy, resource references, notification resource-key representation, visibility, delivery/read states, ordering, and timeline presentation; global guest notifications remain disabled.
13. Launch-approval snapshot format, flag/change cardinality, rollback workflow, and public-launch authorization mechanics; approval linkage is approved.
14. Exact PostgreSQL roles, grants, RLS policies, transaction-local context implementation, pooler compatibility, and background-job privileges.
15. Index predicates, partitioning, retention jobs, outbox/queue use, and operational testing.

Technical recommendations in this document require engineering review. Items affecting product behavior, retention, privacy, launch authority, notification visibility, or legal holds require product-owner and appropriate legal/privacy approval before implementation. **OPEN — VALIDATION** applies to security, concurrency, RLS, pooler, performance, migration, retention, backup/restore, and object-storage testing. **OPEN — OWNER APPROVAL** applies to manager limits, deletion/anonymization and holds, notification/event visibility, launch workflow, and any change to approved D1–D34 behavior.

## 18. Readiness boundary

This proposal is ready for detailed human schema review. It is not tested, production-ready, a security certification, a legal approval, or authorization to create database objects. No SQL, migration, database connection, PostgreSQL change, application implementation, package installation, deployment, commit, or push is performed by this document.
