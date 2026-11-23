# NandedConnect Schema Relationship and Constraint Matrix

**Phase:** Phase 1 — PostgreSQL relationship and constraint design
**Status:** Conceptual design only; not executable SQL, a migration, or implementation approval
**Compatibility target:** PostgreSQL 18
**Decision baseline:** Approved D1–D34

## 1. Purpose and design boundaries

This document translates the approved D1–D34 architecture decisions into a conceptual relationship and constraint matrix. It does not define final SQL, migrations, PostgreSQL roles, RLS policies, indexes, triggers, or operational procedures.

**D28 scope:** The approved schema-readiness addendum covers conceptual ERD synchronization, D23 database role/RLS security corrections, missing entity relationships, and schema-critical constraints. It authorizes documentation-only work and does not authorize SQL, migrations, database changes, or deployment.

**D1–D20 coverage:** The earlier decisions are inherited from the canonical [DATABASE_DESIGN.md](./DATABASE_DESIGN.md), [ARCHITECTURE_DECISIONS.md](./ARCHITECTURE_DECISIONS.md), [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md), and [PRODUCT_REQUIREMENTS.md](./PRODUCT_REQUIREMENTS.md). This matrix focuses on the requested relationship and constraint areas; it does not independently enumerate every D1–D20 relationship.

The following distinctions apply throughout:

- **APPROVED** means required by the product or architecture decisions.
- **CANDIDATE** means a possible schema-level expression of an approved requirement; it is not approved implementation.
- **OPEN** means the product owner or engineering design process must decide it before implementation.
- **AUTHORIZATION** means trusted backend checks, transaction-local identity context, and selective RLS; a structural database constraint does not replace authorization.

The database design remains conceptual. No item below authorizes SQL execution, migration, database changes, or production use.

## 2. Cross-cutting approved rules

### APPROVED

- PostgreSQL is the system of record for canonical relationships.
- Use UUID identifiers and UTC timestamps.
- Use foreign keys for ownership and engagement relationships.
- Use restrictive deletion behavior by default where deletion could erase audit, moderation, ownership, or legal history.
- Protected backend operations use transactions with server-validated transaction-local identity context.
- Protected queries use the same connection and transaction, followed by commit or rollback before pool return.
- Missing or invalid identity context denies access.
- The runtime application database role must not own ANY database tables and must not have BYPASSRLS.
- Application authorization and selective PostgreSQL RLS both enforce high-risk access boundaries.
- Audit and security operations must not expose secrets or unnecessary personal data.
- Guest inquiry retention is 24 months after last activity, with earlier verified deletion subject to legal holds and mandatory-retention exceptions.
- System events and notifications remain separate from human-authored `inquiry_messages` and do not rotate guest tokens.
- Inquiry messages may generate in-app notifications, while `inquiry_messages`, `system_events`, and `notifications` remain separate entities. Exact event-triggering and delivery mechanics remain OPEN where not already approved.

References: [DATABASE_DESIGN.md](./DATABASE_DESIGN.md), sections 6, 8, 13; [ARCHITECTURE_DECISIONS.md](./ARCHITECTURE_DECISIONS.md), D23, D27, D28, D32, D33, and D34.

## 3. Matrix A — Inquiry ownership XOR

### Entities involved

- `inquiries`
- `users` as authenticated customers
- `guest_identities`
- `businesses`
- `audit_logs`

### APPROVED relationship and cardinality

- Each inquiry has exactly one ownership identity:
  - one authenticated customer, **or**
  - one verified guest identity.
- An inquiry must never have both ownership references or neither reference.
- One authenticated customer may own many inquiries.
- One reusable guest identity may own many inquiries.
- One business may receive many inquiries.

### CANDIDATE foreign keys and constraints

- `inquiries.business_id` references `businesses`.
- `inquiries.customer_user_id` references `users`.
- `inquiries.guest_identity_id` references `guest_identities`.
- Candidate database-level XOR CHECK: exactly one of `customer_user_id` and `guest_identity_id` is non-null.
- Candidate status check: a guest-owned inquiry must reference an identity eligible for verified guest access.
- Candidate customer check: a guest-owned inquiry must not also contain an authenticated customer reference.

These are candidate expressions of D30, not final SQL decisions.

### Referential deletion behavior

- Restrict deletion that would silently erase an inquiry or its audit history.
- Account deletion should use the approved deletion/anonymization workflow.
- Guest identity deletion must account for all associated inquiries, notifications, OTP history, and legal holds.
- Inquiry deletion must process associated messages, personal contact information, sessions, events, and notifications according to retention policy.

### Candidate uniqueness, CHECK, and index requirements

- CHECK for ownership XOR.
- Index customer-owned inquiries by customer identity and activity/status.
- Index guest-owned inquiries by guest identity and activity/status.
- Index inquiry business ownership for owner, manager, and moderation access.
- Optional partial indexes for active/non-deleted inquiries are candidates only.

### AUTHORIZATION and RLS

- The backend must validate the caller before creating or changing ownership.
- Guest ownership requires approved OTP verification and inquiry-session scope.
- Customer ownership requires authenticated customer authorization.
- The D23 transaction-local identity context must be set before protected reads/writes.
- RLS must prevent a user, guest, manager, or administrator from accessing inquiries outside its authorized scope.

### Concurrency and transaction requirements

- Ownership validation and inquiry write must occur in one authorized transaction.
- Ownership changes, if allowed, must not temporarily create both or neither owner.
- Concurrent ownership changes must be serialized or rejected consistently.
- Audit records must be written for approved ownership transitions.

### OPEN technical decisions

- Exact CHECK expression and null semantics.
- Whether ownership may change after inquiry creation.
- Whether guest-to-customer conversion is supported.
- How verified guest state is represented.
- Administrative and background write paths.
- Error mapping for database constraint failures.
- Concurrency isolation and test coverage.

## 4. Matrix B — Guest identities, OTP challenges, and inquiry sessions

### Entities involved

- `guest_identities`
- `guest_otp_challenges`
- `guest_inquiry_sessions`
- `inquiries`
- `inquiry_messages`
- `notifications`
- `audit_logs`

### APPROVED relationship and cardinality

- One reusable guest identity may have many OTP challenges.
- One reusable guest identity may own many inquiries.
- One reusable guest identity may have many inquiry sessions.
- Every guest inquiry session belongs to exactly one guest identity and exactly one inquiry.
- Every guest session is scoped to one inquiry and cannot authorize another inquiry.
- Sessions expire after 30 minutes of inactivity or 24 hours absolutely.
- Fresh OTP verification creates a new session after expiry; expired sessions are not revived.
- OTP validity is 5 minutes.
- Maximum incorrect OTP attempts are 5.
- Resend cooldown is 60 seconds.
- Maximum OTP resends are 5 per hour per phone number.
- OTP values must never be stored in plaintext; only a secure OTP hash may be persisted.

### CANDIDATE foreign keys and constraints

- `guest_otp_challenges.guest_identity_id` references `guest_identities`.
- `guest_inquiry_sessions.guest_identity_id` references `guest_identities`.
- `guest_inquiry_sessions.inquiry_id` references `inquiries`.
- Candidate consistency rule: the session guest identity must equal the guest identity owning the inquiry.
- OTP challenge state must support pending, verified, consumed, and expired outcomes.
- Successful OTP challenges must be single-use.
- Session token hashes must be unique and plaintext tokens must never be stored.

### Referential deletion behavior

- Expiring or revoking a session must not delete the guest identity or inquiry.
- Deleting a guest inquiry must process its sessions and messages under the deletion workflow.
- Guest identity deletion must account for all inquiries and notifications owned by that identity.
- OTP challenge history may require minimization or retention for abuse/audit purposes; exact behavior is OPEN.

### Candidate uniqueness, CHECK, and index requirements

- Unique normalized guest identity key for the reusable phone identity.
- Unique token hash for guest sessions.
- Index OTP challenges by guest identity, lifecycle state, and expiry.
- Index sessions by guest identity and inquiry.
- Index active/revoked/expiry state for authorization checks.
- Candidate checks ensure inactivity expiry does not exceed absolute expiry and timestamps are valid.

### AUTHORIZATION and RLS

- OTP verification must be performed through an authorized backend path.
- Session reads must require the presented token to match a stored hash and the requested inquiry scope.
- Revoked or expired sessions must be denied immediately.
- RLS must use the transaction-local guest identity and inquiry scope; guest identity alone must not grant cross-inquiry access.

### Concurrency and transaction requirements

- OTP consumption and session creation must be atomic for successful verification.
- Concurrent OTP verification attempts must not create conflicting active session state.
- Revocation and authorization checks must use a transactionally consistent session state.
- Session creation after fresh verification must not reactivate an expired session.

### OPEN technical decisions

- Whether multiple active sessions for one guest/inquiry are permitted.
- Exact OTP replacement and challenge uniqueness rules.
- Session cleanup periods.
- Whether fresh verification invalidates all prior sessions or only expired sessions.
- Exact session-generation and revocation representation.

## 5. Matrix C — Inquiry message sender XOR

### Entities involved

- `inquiry_messages`
- `inquiries`
- `users`
- `guest_inquiry_sessions`
- `audit_logs`
- `guest_inquiry_sessions` token-rotation state

### APPROVED relationship and cardinality

- Each message has exactly one sender identity:
  - authenticated user, **or**
  - guest inquiry session.
- A message must not have both sender references or neither reference.
- One inquiry may contain many messages.
- One authenticated user may send many messages.
- One guest inquiry session may send many messages.
- A guest session may send only to its scoped inquiry.

### CANDIDATE foreign keys and constraints

- `inquiry_messages.inquiry_id` references `inquiries`.
- `inquiry_messages.sender_user_id` references `users`.
- `inquiry_messages.sender_guest_session_id` references `guest_inquiry_sessions`.
- Candidate sender XOR CHECK requires exactly one sender reference.
- Candidate cross-record invariant requires a guest session’s inquiry to equal the message inquiry.
- Candidate idempotency uniqueness prevents one client submission from creating multiple accepted messages.

The XOR and cross-record matching rules are separate invariants.

### Referential deletion behavior

- Inquiry deletion processes associated messages under the approved deletion and retention workflow.
- User deletion must preserve minimum required audit/moderation history while anonymizing personal content where required.
- Session revocation must not silently alter historical message attribution.
- Guest message deletion must account for contact information and legal holds.

### Candidate uniqueness, CHECK, and index requirements

- Sender XOR CHECK.
- Unique idempotency key within its approved scope.
- Index messages by inquiry and creation time.
- Index guest-session sender references for authorization and audit review.
- Index authenticated sender references where customer history is required.
- Candidate ordering key or timestamp is needed for deterministic inquiry timelines.

### AUTHORIZATION and RLS

- Authenticated senders must be authorized for the inquiry.
- Guest senders must have an active session for the same inquiry and guest identity.
- Business owners and assigned managers may reply only within their authorized business/inquiry scope.
- D23 identity context must be established on the same connection as message and token operations.
- System events are not human-authored messages and do not use this sender XOR.

### Concurrency and transaction requirements

- Message acceptance and guest-token rotation must be atomic.
- Concurrent requests using one guest token must produce at most one accepted result for the same idempotency key.
- Retries after a lost response must return or reproduce the original result without duplicating the message.
- Revocation racing with message processing must have a defined transaction outcome.

### OPEN technical decisions

- Exact sender column representation.
- Composite or equivalent enforcement of guest-session/inquiry matching.
- Idempotency-key scope and retention.
- Whether failed message attempts rotate tokens.
- Retry response semantics.
- RLS policies and concurrency test plan.

## 6. Matrix D — Business memberships, manager permissions, and inquiry assignments

### Entities involved

- `users`
- `businesses`
- `business_owners`
- `business_memberships`
- `inquiry_assignments`
- `inquiries`
- `audit_logs`

### APPROVED relationship and cardinality

- A business has at most one active primary owner.
- Managers receive limited, business-specific, assignment-based access.
- Managers may view permitted business fields and view/respond only to assigned inquiries.
- Business membership authorization and inquiry-specific assignment are both required.
- D29 requires a separate conceptual `inquiry_assignments` relationship linking manager users, businesses, and inquiries.

### CANDIDATE foreign keys and constraints

- `business_memberships.user_id` references `users`.
- `business_memberships.business_id` references `businesses`.
- `inquiry_assignments.manager_user_id` references `users`.
- `inquiry_assignments.business_id` references `businesses`.
- `inquiry_assignments.inquiry_id` references `inquiries`.
- Candidate consistency rule: assignment business equals inquiry business.
- Candidate active-membership rule: the manager must have an active authorized membership for the assignment business.
- Candidate uniqueness rule: one active assignment per manager/business/inquiry combination.

### Referential deletion behavior

- Revoking membership must not erase inquiry or audit history.
- Revoking membership should invalidate or close dependent active assignments according to an OPEN lifecycle policy.
- Business deletion must preserve required audit history.
- Inquiry deletion must remove or anonymize assignment records under the deletion workflow.

### Candidate uniqueness, CHECK, and index requirements

- At most one active primary owner per business.
- Unique active membership for a user/business/role combination.
- Unique active manager/inquiry assignment.
- Index assignments by manager, business, and inquiry.
- Candidate status checks prevent assignments to suspended or revoked memberships.

### AUTHORIZATION and RLS

- Managers cannot add/remove managers, transfer ownership, delete businesses, change owner security settings, or approve verification.
- Assignment creation and revocation require owner/admin authorization and audit logging.
- RLS must require both business authorization and inquiry assignment.
- Managers must not expand their own scope through direct database writes.

### Concurrency and transaction requirements

- Membership changes and assignment changes must be transactionally coordinated.
- Concurrent assignment creation must not create duplicate active assignments.
- Ownership transfer must not leave conflicting active owner/manager authority.
- Assignment revocation racing with an inquiry read or reply must have a defined outcome.

### OPEN technical decisions

- Whether `business_memberships` remains separate from `business_owners`.
- Maximum managers per business and per inquiry.
- Whether multiple managers may be assigned to one inquiry.
- Assignment lifecycle and historical retention.
- Conflict and ownership-transfer rules.
- Exact RLS policy and index design.

## 7. Matrix E — Deletion requests and target records

### Entities involved

- `deletion_requests`
- `users`
- `guest_identities`
- `inquiries`
- `inquiry_messages`
- `guest_inquiry_sessions`
- `system_events`
- `notifications`
- `audit_logs`

### APPROVED relationship and cardinality

- `deletion_requests` is separate from the resource being deleted.
- A requester may be an authenticated customer or guest identity.
- A request may target an account or an inquiry.
- Guest inquiry deletion requires fresh OTP verification.
- Inquiry deletion covers associated messages and personal contact information, subject to legal holds and mandatory-retention requirements.
- Approved statuses are `Pending`, `Verified`, `Processing`, `Completed`, and `Rejected`.

### CANDIDATE foreign keys and constraints

- Candidate requester references: `requester_user_id` or `requester_guest_identity_id`.
- Candidate target references: `target_user_id` or `target_inquiry_id`.
- Requester references require XOR.
- Target references require XOR.
- A guest requester targeting an inquiry must own or be authorized for that inquiry.
- OTP verification state/time is required where the request type requires fresh verification.
- Status transitions must be controlled and auditable.

### Referential deletion behavior

- Deletion requests must not be silently removed when the target is processed.
- Inquiry deletion must process messages, sessions, events, notifications, contact data, assignments, and audit exceptions according to retention policy.
- Security and audit records may be minimized, anonymized, or retained under legal/mandatory exceptions.
- Legal holds must block or alter destructive processing.

### Candidate uniqueness, CHECK, and index requirements

- CHECK requester XOR.
- CHECK target XOR.
- Index requests by target, requester, status, and processing time.
- Candidate uniqueness prevents duplicate active requests for the same requester and target.
- Candidate state-transition checks prevent invalid status reversals.

### AUTHORIZATION and RLS

- Only the requester or an authorized administrator/workflow may access request details.
- Guest requests require fresh OTP verification.
- Legal-hold and mandatory-retention decisions require restricted administrative authorization.
- Deletion processing must use D23 transactions and audit events.

### Concurrency and transaction requirements

- Duplicate active requests must be handled atomically.
- Legal holds added during processing must be respected before destructive completion.
- Deletion processing must be idempotent and safe to retry.
- Foreign-key dependencies must be evaluated before physical deletion or anonymization.

### OPEN technical decisions

- Exact account-target representation.
- Hard deletion versus anonymization by data class.
- Duplicate active request behavior: reject, coalesce, or link.
- Legal-hold representation and evaluation workflow.
- Event/notification treatment during inquiry deletion.
- Exact cascade, restrict, and archival behavior.

## 8. Matrix F — Guest token rotation, revocation, and concurrency

### Entities involved

- `guest_inquiry_sessions`
- `inquiry_messages`
- `inquiries`
- `guest_identities`
- `audit_logs`
- `security_events`

### APPROVED relationship and cardinality

- Guest tokens are cryptographically random opaque values.
- Only token hashes are stored.
- Tokens are delivered through Secure, HttpOnly, SameSite cookies.
- Token rotation occurs after every successfully processed guest message.
- A session may have at most one valid successor for each accepted rotation.
- Revocation immediately invalidates the token before expiry.
- Sensitive guest-session revocation actions must be audit-logged.
- System events and notifications do not rotate guest tokens.

### CANDIDATE foreign keys and constraints

- Token state belongs to exactly one inquiry session.
- Candidate unique token-hash constraint.
- Candidate one-valid-successor constraint or generation invariant.
- Candidate idempotency uniqueness for accepted message operations.
- Candidate state checks reject expired, revoked, or superseded tokens.

### Referential deletion behavior

- Revocation changes token state but does not delete the session history.
- Inquiry deletion processes session and token metadata under the deletion workflow.
- Audit/security records retain only the minimum required information and must not store raw tokens.

### Candidate uniqueness, CHECK, and index requirements

- Unique token hashes.
- Index active, revoked, expiry, and session identifiers.
- Unique idempotency key in the approved operation scope.
- Candidate generation/sequence uniqueness for successors.
- Candidate checks ensure expiry and revocation state are consistent.

### AUTHORIZATION and RLS

- Token hash lookup and session authorization occur through the authorized backend path.
- Guest identity and inquiry scope must be derived from the active session.
- D23 identity context must be set on the same connection as message acceptance and token rotation.
- Revoked tokens must fail before any protected message read or write.

### Concurrency and transaction requirements

- Message acceptance and successor-token creation/update must be atomic.
- Concurrent requests with the same token must not create multiple accepted successors.
- Retries must be idempotent.
- Revocation racing with message processing must have a defined serialization outcome.
- Rollback must leave both message and token state unchanged.

### OPEN technical decisions

- Mutable session row versus token-generation history.
- Exact successor enforcement mechanism.
- Idempotency-key scope, storage period, and retry response.
- Whether rejected messages rotate tokens.
- Revocation behavior for in-flight transactions.
- Exact RLS and lock/isolation strategy.

## 9. Matrix G — System events, notifications, and D34 guest authorization

### Entities involved

- `system_events`
- `notifications`
- `inquiries`
- `users`
- `guest_identities`
- `guest_inquiry_sessions`
- `inquiry_messages`
- `audit_logs`
- `deletion_requests`

### APPROVED relationship and cardinality

- `system_events` are durable canonical workflow/domain records.
- `notifications` are recipient-specific delivery/read-state records.
- One system event may produce zero, one, or many notifications.
- Both remain separate from human-authored `inquiry_messages`.
- System events and notifications do not rotate guest tokens.
- Guest identity is the durable guest recipient identity.
- Each inquiry-related guest notification has explicit inquiry/resource scope.
- An active guest inquiry session is temporary read authorization, not notification ownership.
- Expired or revoked sessions deny access.
- Fresh OTP creates a new session that may access eligible notifications for the same guest identity and inquiry.
- Read/unread state belongs to the notification record, not the session.

### CANDIDATE foreign keys and constraints

- `system_events.inquiry_id` may reference `inquiries` when the event is inquiry-scoped.
- `notifications.system_event_id` references `system_events`.
- Authenticated notifications may reference `users`.
- Guest notifications reference `guest_identities` plus explicit `inquiry_id`.
- Candidate notification-recipient XOR distinguishes authenticated-user and guest-identity recipients.
- Candidate guest-notification rule requires `guest_identity_id` and `inquiry_id` together.
- Candidate event-to-notification idempotency key prevents duplicate recipient notifications for one event.

These are candidate structures only. A generic recipient abstraction remains OPEN if required by future channels.

### Referential deletion behavior

- Session expiry or revocation must not delete notifications.
- Notification history must not be reassigned to a new session.
- Inquiry deletion processes inquiry-scoped system events and notifications under retention and legal-hold rules.
- Guest identity deletion must account for all associated inquiry-scoped notifications.
- Audit/security records may require minimization or retention under approved exceptions.

### Candidate uniqueness, CHECK, and index requirements

- Unique event identifier.
- Unique event-to-recipient idempotency key for notification creation.
- Candidate recipient XOR between authenticated user and guest identity.
- Candidate requirement that guest notification scope includes inquiry/resource identity.
- Index notifications by recipient, inquiry/resource, read state, creation time, and delivery state.
- Index system events by inquiry, event type, creation time, and processing state if used.

### AUTHORIZATION and RLS

- Guest identity alone must never authorize cross-inquiry notification reads.
- A read must validate the active guest session, guest identity, and requested inquiry together.
- Authenticated users may read only their authorized notifications and resources.
- Owners and assigned managers require business and inquiry authorization.
- Background jobs require restricted job authorization and D23 transaction-local context.
- RLS policies must deny access when identity context is missing or invalid.

### Concurrency and transaction requirements

- Domain state changes and their durable system event should be coordinated transactionally where required.
- Notification creation must be idempotent and retry-safe.
- Multiple recipients must produce distinct recipient records without duplicating the canonical event.
- Notification read-state updates must not depend on a guest session identifier.
- Event and notification ordering requirements must be defined before implementation.

### OPEN technical decisions

- Event taxonomy and canonical event fields.
- Exact notification recipient/resource key.
- Whether global guest notifications are allowed.
- Guest notification read path after session expiry or revocation.
- Delivery and read-state values.
- Event visibility by guest, customer, owner, manager, and administrator role.
- Event ordering and timeline visibility.
- Deletion, anonymization, retention, and legal-hold behavior.
- Background-job privileges and idempotency.
- Whether a separate outbox/queue is needed for future asynchronous or external delivery.
- Whether a future system sender may appear in the conversation timeline.

## 10. Matrix H — Launch approvals and feature flags (D25)

### Entities and supported relationships

- `launch_approvals`
- `feature_flags`
- `feature_flag_changes`
- `users` as authorized approvers or change actors

The canonical database design represents `users` approving `launch_approvals`, `feature_flags` having `feature_flag_changes`, `users` authorizing `feature_flag_changes`, and `launch_approvals` authorizing `feature_flag_changes`. Public launch remains disabled without explicit product-owner approval.

### APPROVED requirements

- `launch_approvals` is a separate auditable entity.
- Approval records include approver identity, timestamp, environment, launch scope, approved feature flags, previous/new configuration references, rollback reference, approval status, and audit history.
- `feature_flag_changes` records the feature-flag change history needed for approval traceability.

### OPEN

- Exact cardinalities, foreign keys, configuration-snapshot representation, linkage between an approval and individual flags or changes, status transitions, uniqueness, indexes, retention, rollback workflow, and RLS details remain OPEN.

## 11. Matrix I — Reports and business media (D26)

### Entities and supported relationships

- `reports` — generic abuse reports filed by users and targeting businesses, reviews, or inquiries.
- `review_reports` — existing review-specific reports related to reviews and reporting users.
- `business_media` — business-owned media metadata and private object-storage references.
- `businesses`, `reviews`, `inquiries`, and `users` are the supported related entities in the canonical ERD.

### APPROVED requirements

- Reports support moderation status, resolution, and audit timestamps.
- `review_reports` has review and reporter relationships; whether it remains separate from or is linked to generic `reports` is OPEN in the canonical design.
- Each `business_media` record belongs conceptually to a business and stores metadata/private storage references; actual files remain in private object storage.
- Public media URLs and unrestricted media access are prohibited.

### OPEN

- Exact generic target representation, relationship between `reports` and `review_reports`, cardinalities, foreign keys, constraints, indexes, authorization/RLS, retention, and media deletion lifecycle remain OPEN.
- No cascade or deletion behavior is inferred here because the canonical sources do not approve one.

## 12. Cross-area dependency map

| Dependency | Required relationship or invariant | Status |
|---|---|---|
| Inquiry ↔ owner | Exactly one authenticated customer or guest identity | APPROVED; enforcement details OPEN |
| Guest identity ↔ OTP | One reusable identity has many single-use OTP challenges | APPROVED; lifecycle constraints OPEN |
| Guest identity ↔ session ↔ inquiry | Every session references exactly one identity and inquiry | APPROVED; exact consistency enforcement OPEN |
| Inquiry ↔ message sender | Message sender XOR plus inquiry authorization | APPROVED; representation and cross-record checks OPEN |
| Business membership ↔ assignment | Manager must be authorized for the business and assigned to the inquiry | APPROVED conceptually; physical model OPEN |
| Inquiry ↔ deletion request | Inquiry target and requester must be authorized | APPROVED; target model and duplicate behavior OPEN |
| Message ↔ token rotation | Accepted guest message and token successor update atomically | APPROVED; concurrency design OPEN |
| System event ↔ notification | One durable event may produce many recipient records | APPROVED; event/recipient keys OPEN |
| Guest identity ↔ notification ↔ session | Durable recipient is identity plus inquiry scope; session authorizes reads temporarily | APPROVED; RLS and lifecycle details OPEN |

## 13. PostgreSQL 18 design considerations

### APPROVED direction

- Use standard PostgreSQL foreign keys, unique constraints, CHECK constraints, indexes, transactions, and selective RLS as appropriate to the approved architecture.
- Keep the runtime application role separate from table ownership and prohibit `BYPASSRLS`.
- Use transaction-local identity context for protected operations.
- Prefer typed canonical relationship columns for identity, ownership, inquiry, and sender data.

### OPEN

- Exact PostgreSQL 18 extension inventory and permissions.
- Exact constraint expressions and partial-index predicates.
- Exact RLS policy definitions and pooler compatibility.
- Locking/isolation strategy for token rotation and deletion jobs.
- Trigger or procedure use for invariants that cannot be expressed by simple constraints.
- Physical partitioning, archival, and retention-job design.

## 14. Implementation readiness boundary

This matrix is ready to inform detailed schema review. It does not authorize table creation, SQL, migration, role, extension, RLS, or database changes.

The unresolved items above must be resolved or explicitly accepted by the product owner and engineering lead before implementation. Security review, legal review, testing, operational readiness, and production readiness remain incomplete.
