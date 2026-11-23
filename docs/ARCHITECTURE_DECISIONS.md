# NandedConnect Architecture Decision Review

**Related documents:** [Product Requirements](./PRODUCT_REQUIREMENTS.md), [System Architecture](./SYSTEM_ARCHITECTURE.md), [Database Design](./DATABASE_DESIGN.md)  
**Scope:** Decisions required before backend implementation and PostgreSQL schema finalization  
**Strategy:** Build and test completely in private staging; launch only after explicit product-owner approval

## Decision summary

| Topic | Approved direction | Remaining approval/status |
| --- | --- | --- |
| Authentication | Custom Node.js + Express.js + PostgreSQL authentication; secure sessions; Argon2id; one account with multiple roles | Approved; implementation details remain |
| Data retention | Approved provisional periods for accounts, inquiries, logs, audit logs, and backups | Guest inquiry retention approved; other periods remain provisional and legal review remains |
| Search | PostgreSQL Full-Text Search plus `pg_trgm` | Approved; tuning remains |
| Verification evidence | Phone OTP plus manual admin review with appropriate supporting evidence | Approved; evidence implementation remains |
| Business ownership | One primary owner initially, with future manager support; claims/transfers verified and admin-approved | Approved; detailed permissions remain |
| Reviews and ratings | Authenticated; public display name; one review per customer/business; edit/report/moderation support | Approved; policy details remain |
| Customer inquiries | Inquiry form plus direct WhatsApp/call, restricted access, and spam protection | Approved; notification details remain |
| Hosting | Render Static Site, Render Free Node.js, Neon PostgreSQL, Cloudflare Access; ₹0–₹500/month initial target | Approved target; free-tier/provider limits remain |
| Backup and disaster recovery | Daily independent encrypted backups; 30-day retention; target RPO 24h/RTO 8h; restore testing | Approved target; implementation/testing remains |
| D11 Search configuration | PostgreSQL simple text-search configuration plus `pg_trgm`; multilingual testing required | Approved; corpus and ranking validation remain |
| D12 UUID and extensions | UUIDv4 via `gen_random_uuid()`; minimum necessary extensions only | Approved; extension/provider validation remains |
| D13 OTP delivery | Provider-independent OTP adapter; mock OTP only in private staging | Approved; provider and operational limits remain |
| D14 Verification evidence | Private object storage; PostgreSQL stores metadata only | Approved; storage/key policy remains |
| D15 Inquiry access | Authenticated customers or OTP-verified guests; controlled owner access | Approved; guest abuse controls remain |
| D16 Manager permissions | Limited manager permissions; primary owner retains control | Approved; exact permission matrix remains |
| D17 Database authorization | Application authorization plus selective PostgreSQL RLS | Approved; connection/RLS implementation remains |
| D18 Hosting cost posture | Free-tier first; upgrade when necessary | Approved; quotas and upgrade triggers remain |
| D19 Legal gate | Qualified legal/privacy review mandatory before public launch | Approved gate; review is not complete |
| D20 Recovery ownership | Product Owner responsible for initial backup and recovery operations | Approved responsibility; runbook and succession remain |
| D21 Deletion requests | Separate deletion-request workflow for guest and authenticated-customer requests | Approved; detailed workflow implementation remains |
| D22 Guest OTP challenges | Separate hashed, expiring, single-use OTP challenge lifecycle | Approved; provider integration remains |
| D23 RLS security | Transaction-local identity context, selective RLS, restricted runtime DB role | Approved; security review and pooler testing remain |
| D24 Limited manager permissions | Business-specific, assignment-based scoped manager access | Approved; maximum count and conflict/transfer rules remain |
| D25 Launch approval audit | Separate auditable launch approval and rollback record | Approved; record format and operational workflow remain |
| D26 Notifications, reports, and media | In-app notifications, moderated abuse reports, private media metadata/storage references | Approved; delivery/storage implementation remains |
| D27 Immediate guest-token revocation | Transactionally persisted immediate revocation with audit logging | Approved; implementation/testing remains |
| D28 Schema-readiness addendum | Conceptual ERD synchronization, D23 role/RLS corrections, missing relationships, and schema-critical constraints | Approved for documentation-only work; no SQL, migrations, database changes, or deployment |
| D29 Inquiry assignments | Separate conceptual assignment relationship linking managers, businesses, and inquiries | Approved conceptually; cardinality, limits, lifecycle, physical implementation, constraints, indexes, and RLS remain open |
| D30 Inquiry ownership XOR | Exactly one authenticated customer or guest identity, enforced by database invariant and authorized backend write path | Approved; exact constraint, mutability, verification, write paths, concurrency, error mapping, and tests remain open |
| D31 Message sender XOR | Exactly one authenticated user or guest inquiry session, enforced by database invariant and authorized backend write path | Approved; sender representation, cross-record validation, retries, concurrency, revocation races, RLS, and tests remain open |
| D32 System events separate from inquiry messages | Human-authored messages remain separate from system events and notifications; system activity does not rotate guest tokens | Approved; event taxonomy, visibility, retention, ordering, audit, and job details remain open |
| D33 Separate system events and notifications | Durable canonical system events plus recipient-specific notifications; one event may produce zero, one, or many notifications | Approved; recipient model, delivery states, idempotency, ordering, RLS, jobs, retention, and outbox details remain open |
| D34 Hybrid guest notification identity and authorization | Reusable guest identity is durable recipient identity; inquiry scope is explicit; active guest session is temporary read authorization | Approved; global notifications, recipient/resource key, RLS, visibility, delivery, deletion, legal holds, and idempotency remain open |

All recommendations below are appropriate for a small startup with a limited initial budget. They avoid premature distributed systems while leaving clear upgrade paths.

## Approved decision record

The product owner has approved decisions D1–D34. The option discussions below are retained as rationale and alternatives considered; they are no longer open product choices. Implementation details, provider validation, legal review, testing, and launch approval remain open where stated.

1. **Custom authentication:** Use Node.js, Express.js, and PostgreSQL. One account can hold multiple roles. Use secure server-managed PostgreSQL sessions, secure cookies, Argon2id password hashing, and restricted administrator permissions.
2. **Retention:** Retain active accounts while active; target deletion of deleted-account personal data within 30 days of a verified request; guest inquiries 24 months after last activity, with earlier complete deletion after fresh OTP verification of a guest request. Documented legal holds and mandatory retention requirements are exceptions; security logs 90 days; administrator audit logs 12 months; backups 30 days. Guest inquiry retention is approved; legal/privacy review and automated enforcement remain incomplete.
3. **Search:** Use PostgreSQL Full-Text Search with `pg_trgm`.
4. **Hybrid verification:** Use phone OTP plus manual administrator review of business details and appropriate supporting evidence. Do not require GST or Aadhaar universally.
5. **Ownership:** Use one primary business owner initially, with future manager support. Claims and transfers require verification and administrator approval.
6. **Reviews:** Require authentication, show a public display name, allow one review per customer per business, support editing/reporting/moderation, and make no unsupported verified-purchase claims.
7. **Inquiries:** Provide two-way inquiry messaging for authenticated customers or OTP-verified guests plus direct WhatsApp/call actions where valid, with owner/assigned-manager access restrictions, reusable guest identity, inquiry-scoped sessions, contact privacy, audit logging, rate limits, and spam protection.
8. **Private hosting:** Use Render Static Site, Render Free Node.js backend, Neon PostgreSQL, and Cloudflare Access, targeting ₹0–₹500/month initially. Document and verify free-tier limitations.
9. **Recovery:** Use daily independent encrypted backups retained for 30 days, target RPO 24 hours and RTO 8 hours, and require restore testing.
10. **Launch control:** Require explicit product-owner approval and feature flags. Do not launch publicly or enable public writes without approval.

11. **Search configuration:** Use PostgreSQL's simple text-search configuration with `pg_trgm`, and test multilingual Nanded search terms before production use. This avoids an unnecessary search service; the consequence is that corpus, ranking, normalization, and Marathi/Hinglish behavior must be measured. Security impact is bounded API queries and approved-record filtering; database impact is a maintained `tsvector`, GIN index, and trigram indexes.
12. **UUID and extensions:** Use UUIDv4 generated with `gen_random_uuid()` and enable only the minimum required PostgreSQL extensions. This provides non-sequential public identifiers without a separate ID service; migrations must verify extension availability and permissions. Security impact is reduced identifier enumeration risk, not authorization; database impact is UUID PK/FK consistency and an explicit extension inventory.
13. **OTP architecture:** Implement a provider-independent OTP adapter and use a mock OTP only in private staging. This prevents accidental real messages during testing; production provider selection, delivery limits, and cost remain validation items. Store only hashed/ephemeral verification material and attempt metadata; never persist raw OTPs.
14. **Verification evidence:** Store evidence in private object storage and store only metadata, checksums, and protected object keys in PostgreSQL. This limits database bloat but creates a separate storage and backup dependency. Security requires private access, encryption, malware/file validation, short-lived authorized retrieval, and no public URLs.
15. **Inquiry access:** Support authenticated customers and OTP-verified guests, with reusable guest identity but separate inquiry-scoped sessions, restricted owner/assigned-manager access, two-way messaging, contact privacy, audit logging, rate limits, spam controls, and direct call/WhatsApp actions where valid. This preserves low-friction discovery while requiring abuse-resistant identity proof. Database impact includes nullable customer identity, reusable verified-guest metadata, inquiry sessions, rate-limit/security events, access audit events, and retention controls.

### Approved guest inquiry addendum

These decisions extend D1, D2, D7, D13, D15, and D19. They are approved product decisions and do not replace or weaken D1–D20:

1. Guest identity is reusable after successful OTP verification.
2. Every inquiry has a separate inquiry-scoped guest access session.
3. Guest sessions expire after 30 minutes of inactivity and absolutely after 24 hours.
4. Fresh OTP verification is required after expiry and creates a new inquiry-scoped session; previous expired sessions remain invalid.
5. OTP validity is 5 minutes, with a maximum of 5 incorrect attempts.
6. OTP resend cooldown is 60 seconds, with a maximum of 5 resends per hour per phone number.
7. OTP values must never be stored in plaintext.
8. Guest contact information is encrypted at the application level.
9. Full guest contact access is restricted to the authorized business owner and assigned managers for their business inquiries.
10. Every sensitive guest-contact access is audit-logged.
11. OTP-verified guests and authenticated business owners/assigned managers have two-way messaging.
12. Guest access tokens are cryptographically random opaque tokens; only token hashes are stored in PostgreSQL.
13. Guest access uses Secure, HttpOnly, SameSite cookies and never localStorage.
14. The guest access token rotates after every successfully processed message.
15. Token rotation must address concurrent requests, retries, idempotency, atomic message/token updates, and prevention of multiple valid successor tokens. The technical design and testing remain unresolved.
16. Complete guest inquiry deletion after fresh OTP verification includes associated messages and personal contact information, subject to documented legal holds and mandatory retention requirements.
17. Guest inquiry retention is 24 months after last activity, with earlier complete deletion after a verified guest request and documented legal-hold exceptions. Automated enforcement is not yet implemented.
16. **Manager permissions:** Allow limited managers to perform scoped operational work while the primary owner retains ownership, transfer, verification, and permission control. Security requires server-side resource authorization and audit logs; database impact is a role-bearing business membership with one active primary owner and scoped permission fields.
17. **Database authorization:** Use application authorization as the primary policy layer and selective PostgreSQL Row-Level Security for high-risk tables. This balances maintainability with defense in depth; connection-pool identity and policy testing remain technical work. Database roles, RLS policies, foreign keys, and status predicates must not be bypassable by public API paths.
18. **Hosting cost posture:** Start with the approved low-cost private staging stack and free tiers where suitable, then upgrade when measured limits, reliability, security, or recovery requirements require it. This controls early spend but accepts quota and reliability limits. Database impact includes pooling, migration discipline, backup independence, extension verification, and an upgrade/exit plan.
19. **Legal/privacy gate:** A qualified legal/privacy review is mandatory before public launch. This is a release gate, not a claim that legal compliance is complete. It affects retention, deletion, consent, terms, reviews, inquiries, OTP, evidence, and communications schema/policy decisions.
20. **Recovery ownership:** The Product Owner is responsible for initial backup and recovery operations. Engineering must document and test the runbook and define succession before launch. Database impact includes backup metadata, restore evidence, access separation, and measured RPO/RTO; responsibility does not mean restore testing is complete.

21. **Deletion requests:** Create a separate `deletion_requests` entity for guest or authenticated-customer requests. Record request ID/type, requester identity, related inquiry/account, OTP verification status/time where required, status (`Pending`, `Verified`, `Processing`, `Completed`, `Rejected`), legal holds, mandatory-retention exceptions, processing timestamps, and audit information.
22. **Guest OTP challenges:** Create a separate `guest_otp_challenges` entity referencing reusable guest identity. Store only a secure OTP hash; enforce five-minute validity, five incorrect attempts, 60-second resend cooldown, five resends per hour per phone number, verification status/time, consumed/expired states, and single-use successful verification.
23. **RLS security:** Protected backend operations use transactions with server-validated identity in transaction-local context via `SET LOCAL` or `set_config(..., true)`. Protected queries use the same connection and transaction, followed by commit/rollback before pool return. Missing/invalid context denies access. The runtime application database role must not own ANY database tables and must not have BYPASSRLS. It must use least-privilege grants and must not bypass application authorization or selective RLS. Security review and pooler compatibility testing remain pending.
24. **Limited manager permissions:** Managers may view business profiles, edit permitted fields, and view/respond only to assigned inquiries. They cannot add/remove managers, transfer ownership, delete businesses, change owner security settings, or approve business verification. Access is business-specific and assignment-based; maximum manager count and detailed conflict/transfer rules remain unresolved.
25. **Launch approval audit:** Create a separate `launch_approvals` entity recording approval ID, authorized approver, timestamp, environment, launch scope, approved feature flags, previous/new configuration references, rollback reference, approval status, and audit history. Public launch remains disabled without explicit product-owner approval.
26. **Notifications, reports, and media:** Provide in-app notifications for inquiry messages, status updates, and important account events; abuse reports for businesses, reviews, and inquiries with admin moderation status; and business media metadata/storage references in PostgreSQL. Actual files remain in private object storage with no public media URLs or unrestricted access.
27. **Immediate guest-token revocation:** Revoking an inquiry-scoped guest session immediately invalidates its token before expiry. Revocation is transactionally persisted, later requests using the token are rejected, and sensitive revocation actions are audit-logged.

D26's approved MVP notification scope is in-app notifications. The earlier optional email-notification option remains non-approved alternative analysis and is not an MVP requirement.

28. **D28 — Schema-readiness addendum:** Approve conceptual ERD synchronization, D23 database role/RLS security corrections, missing entity relationships, and schema-critical constraints. Preserve D1–D27 without modification. This authorizes documentation-only schema-readiness work, not SQL, migrations, database changes, or deployment.

29. **D29 — Inquiry assignments:** Use a separate conceptual `inquiry_assignments` entity or relationship linking manager users, businesses, and inquiries for assignment-based manager access. Business membership authorization and inquiry-specific assignment are both required conceptually. Cardinality, multiple-manager rules, limits, lifecycle, physical implementation, constraints, indexes, and RLS details remain OPEN.
30. **D30 — Inquiry ownership XOR:** Require exactly one inquiry ownership identity: authenticated customer OR guest identity. Enforce the XOR invariant at the PostgreSQL database level and require an authorized backend-controlled write path for authorization, OTP verification, inquiry-session scope, D23 transaction-local identity context, audit, and deletion workflows. The exact CHECK expression, ownership mutability, guest verification state, administrator/background write paths, concurrency, error mapping, and tests remain OPEN.
31. **D31 — Message sender XOR:** Require exactly one message sender identity: authenticated user OR guest inquiry session. Enforce the XOR invariant at the PostgreSQL database level and require an authorized backend-controlled write path handling inquiry authorization, guest-session-to-inquiry matching, D23 transaction-local identity context/RLS, token rotation, idempotency, and audit/retention workflows. System-generated events remain separate from human-authored inquiry messages under D32. Sender representation, exact constraints, cross-record validation, retries, concurrency, revocation races, RLS, and tests remain OPEN.
32. **D32 — System events separate from inquiry messages:** Keep system-generated workflow events and notifications separate from `inquiry_messages` by default. `inquiry_messages` contains human-authored authenticated-user and guest-session communication. Workflow/status/assignment changes, reminders, and important account events belong in separate system events and/or in-app notifications. System events do not trigger guest-token rotation. A future system sender inside the conversation timeline requires separate approval. Event taxonomy, visibility, retention, read state, ordering, audit, and background-job details remain OPEN.
33. **D33 — Separate system events and notifications:** Use separate durable `system_events` and recipient-specific `notifications`. `system_events` are canonical workflow/domain event records; `notifications` represent recipient-specific delivery and read state. One event may create zero, one, or multiple notifications. Both remain separate from `inquiry_messages`, and neither system events nor notifications rotate guest tokens. MVP may use transactional event and in-app notification writes with idempotent creation and retry-safe processing. A separate outbox/queue is not mandatory now but future asynchronous/external delivery must remain outbox-compatible. Event taxonomy, fields, recipient model, guest scope, read/delivery states, idempotency, ordering, RLS, background-job privileges, retention, and timeline visibility remain OPEN.
34. **D34 — Hybrid guest notification identity and authorization:** Use reusable `guest_identity` as the durable guest recipient identity. Each inquiry-related guest notification must have explicit inquiry/resource scope. An active inquiry-scoped `guest_inquiry_session` is temporary authorization context at read time, not the durable notification owner. Guest identity alone must never authorize cross-inquiry notification access. Session expiry does not delete notifications; fresh OTP verification creates a new inquiry-scoped session that can access eligible notifications for the same guest identity and inquiry. Revoked sessions cannot authorize notification access. Read/unread state belongs to the recipient-specific notification record, not the access session; rotation/revocation must not reset read state or reassign notification history. Global guest notifications, the exact recipient/resource key, RLS policies, event visibility, delivery states, deletion/retention, legal holds, and idempotency details remain OPEN.

### D11–D20 options considered

The original sections above retain the detailed alternatives for D1–D10. The following records the alternatives considered for the ten later decisions so that the complete decision set has an explicit option trail.

| Decision | Practical options considered | Approved option and rationale | Status |
|---|---|---|---|
| D11 Search configuration | PostgreSQL simple search plus trigram; richer language dictionaries; external search service | Simple configuration plus `pg_trgm`, with multilingual testing. Lowest operational complexity and sufficient starting scale; tuning is required before launch. | Approved; validation open |
| D12 UUID/extensions | Sequential integers; UUIDv4 from `gen_random_uuid()`; application-generated IDs or broader extension set | UUIDv4 via `gen_random_uuid()` with minimum extensions. Avoids predictable public identifiers without unnecessary platform complexity. | Approved; provider/extension validation open |
| D13 OTP | Vendor-specific OTP calls; provider-neutral adapter; mock-only OTP | Provider-neutral adapter with mock OTP in private staging. Preserves portability and prevents accidental staging messages. | Approved; production provider open |
| D14 Evidence | Store files in PostgreSQL; private object storage; collect no evidence | Private object storage with PostgreSQL metadata only. Keeps database lean while enabling controlled evidence access and retention. | Approved; storage/key validation open |
| D15 Inquiries | Authenticated users only; authenticated users plus OTP-verified guests; anonymous public form | Authenticated users or OTP-verified guests, with restricted owner access and rate limits. Balances accessibility and abuse resistance. | Approved; guest workflow details open |
| D16 Managers | Owner-only; unrestricted team accounts; limited scoped managers | Limited scoped managers while the primary owner retains control. Supports day-to-day operations without weakening ownership and transfer authority. | Approved; permission matrix open |
| D17 Authorization | API-only; RLS for every table; application authorization plus selective RLS | Application authorization plus selective RLS for high-risk data. Provides defense in depth without imposing universal RLS complexity. | Approved; policy/connection design open |
| D18 Hosting cost posture | Paid managed services immediately; free-tier first; self-managed VPS | Free-tier first, upgrade when measured needs require it. Minimizes early cost while acknowledging quotas, sleep, reliability, and support limits. | Approved; provider facts/open triggers remain |
| D19 Legal gate | Launch with generic terms; informal review; qualified legal/privacy review before launch | Qualified review is mandatory before public launch. Prevents technical completion from being mistaken for legal readiness. | Approved gate; review incomplete |
| D20 Recovery ownership | Engineering-owned operations; provider-only responsibility; Product Owner initially responsible | Product Owner owns initial backup/recovery operations, with engineering runbooks and succession required before launch. Establishes clear early accountability. | Approved; drills/runbook incomplete |

Frontend hiding and `noindex` are not security controls. Staging access and APIs must be protected independently. Legal review, measured recovery performance, provider capability verification, and production readiness are not complete.

## Build-first, launch-later guardrails

Every decision must be implemented first in private staging. Until the product owner approves launch:

- Staging requires an allowlist, VPN, identity-aware proxy, or equivalent access control.
- Public registration, real business submissions, inquiries, reviews, and public writes remain disabled.
- Demo/test data is clearly labeled and isolated from production data.
- Staging sends no accidental real email or notification.
- `noindex` headers and a restrictive `robots.txt` prevent search indexing.
- Launch feature flags remain disabled by default.
- Product-owner approval is required before public access or public write workflows are enabled.

## 1. Authentication

### Actual decision required

Choose how users authenticate, how sessions are stored and revoked, how password recovery works, and how staging testers are admitted without enabling public registration.

### Option A — PostgreSQL-backed server sessions with secure cookies — recommended

Use Express session middleware with a PostgreSQL session store. Send only an opaque session identifier in an HttpOnly, Secure, SameSite cookie. Add email verification and expiring, single-use password-reset tokens when those features are enabled.

**Advantages**

- Simple mental model for a small Express application.
- Immediate server-side logout and session revocation.
- No access-token refresh logic in the browser.
- Works well with server-side RBAC and private staging.
- Uses the existing PostgreSQL investment.

**Disadvantages**

- Requires session cleanup and expiry jobs.
- Database reads occur during authenticated requests.
- Horizontal scaling needs a shared session store, which PostgreSQL provides but must be monitored.

**Security and cost**

Secure cookies, CSRF protection, rate limiting, password hashing, and session expiry are mandatory. Initial infrastructure cost is low because no separate cache is required.

**Database effect**

Add `sessions` with hashed session identifiers, user reference, expiry, created/last-used timestamps, IP/device metadata policy, and revocation state. Add `password_reset_tokens` and `email_verification_tokens` with hashed, expiring values.

### Option B — Short-lived access tokens plus rotating refresh tokens

Use short-lived access tokens and store refresh tokens server-side or in secure cookies.

**Advantages**

- Suitable for multiple clients or future mobile applications.
- API authorization can be independently scaled.

**Disadvantages**

- More complex refresh, revocation, rotation, and replay detection.
- Easy to implement insecurely in a browser.
- More operational and testing overhead for the MVP.

**Security and cost**

Requires careful refresh-token storage, rotation, theft detection, and CSRF/XSS analysis. Cost is moderate in engineering time, not necessarily hosting cost.

**Database effect**

Add refresh-token families, token hashes, expiry, rotation, revocation, and reuse-detection fields. Access tokens themselves are normally not stored.

### Option C — Hosted identity provider

Use a managed provider for registration, login, email verification, and password recovery.

**Advantages**

- Reduces password and recovery implementation risk.
- Accelerates account functionality.

**Disadvantages**

- Adds vendor dependency and recurring cost.
- Requires careful user synchronization and provider outage handling.
- Some requirements may be constrained by the provider.

**Security and cost**

Strong security defaults are possible, but the provider becomes a critical dependency. Cost is low initially for some providers and grows with users or authentication volume.

**Database effect**

Store provider subject ID, provider, verification state, and local profile data. Do not store provider passwords.

### Recommendation and approval

Approved decision: use custom Node.js, Express.js, and PostgreSQL authentication with secure server-managed sessions, Argon2id, one account with multiple roles, and restricted administrator permissions. Remaining implementation details include cookie settings, session expiry/rotation, OTP delivery, password recovery, and staging tester policy.

## 2. Data retention

### Actual decision required

Define how long each data class is retained, what is deleted versus anonymized, what must remain for audit or legal reasons, and how users request deletion or export.

### Option A — Minimal, data-class-specific retention — recommended

Retain active account and listing data while needed. Expire recently viewed data quickly. Retain inquiries only as long as operationally useful. Anonymize deleted user-linked content where audit or moderation history must remain.

**Advantages**

- Reduces privacy risk and storage cost.
- Easier to explain to users.
- Fits a small local platform.

**Disadvantages**

- Requires scheduled cleanup jobs and documented exceptions.
- Some historical analytics become unavailable.

**Security and cost**

Less stored personal data lowers breach impact. Application cost is low; operational work is moderate.

**Database effect**

Add `deleted_at`, `anonymized_at`, retention class, and purge eligibility timestamps where appropriate. Keep audit records immutable but minimize personal data in them.

### Option B — Long-term retention for analytics and history

Retain account, inquiry, review, listing history, and event data for several years.

**Advantages**

- Richer historical reporting and dispute resolution.
- Less immediate data-loss anxiety.

**Disadvantages**

- Higher privacy, breach, storage, and compliance burden.
- More complicated deletion and anonymization requests.

**Security and cost**

Cost is still manageable at small scale but risk grows with every retained personal field.

**Database effect**

Requires partitioning or archival tables, retention jobs, and strong data-class metadata.

### Option C — User-controlled retention for most optional data

Let customers control recently viewed, inquiries, and optional profile data, with platform-required retention for moderation and security.

**Advantages**

- Strong privacy posture.
- Clear user control.

**Disadvantages**

- More UI and policy complexity.
- Harder to explain when operational or audit exceptions apply.

**Security and cost**

Good privacy characteristics; moderate implementation effort.

**Database effect**

Requires per-user preference and deletion-request state, plus deletion workflow auditing.

### Recommendation and approval

Approved policy elements: active accounts remain while active; deleted-account personal data is targeted for deletion within 30 days of a verified request; guest inquiries are retained for 24 months after last activity, with earlier complete deletion after a verified guest request and documented legal-hold and mandatory-retention exceptions; security logs for 90 days; administrator audit logs for 12 months; backups for 30 days. Guest inquiry retention is approved. Automated cleanup, anonymization, deletion/export handling, and legal review remain open implementation and governance work.

## 3. Search implementation

### Decision context and options considered

Choose how NandedConnect searches business names, descriptions, addresses, categories, and localities while supporting relevance, filters, and future scale.

### Option A — PostgreSQL full-text search plus trigram indexes — recommended

Use PostgreSQL `tsvector`/`tsquery` for descriptions and searchable text, combined with `pg_trgm` indexes for names and typo-tolerant matching. Keep category and locality as relational filters.

**Advantages**

- No separate service to deploy or pay for.
- Transactionally consistent with business data.
- Sufficient for an initial Nanded directory.
- Straightforward backup and staging isolation.

**Disadvantages**

- Relevance tuning is less sophisticated than a dedicated search service.
- Large-scale multilingual search may require future migration.

**Security and cost**

Low infrastructure cost. Query limits, parameterized queries, and rate limits are still required to prevent expensive searches.

**Database effect**

Add normalized search fields, generated or maintained `tsvector` data, trigram indexes, and indexes for status/category/locality. Search only approved, publishable records for public endpoints.

### Option B — Dedicated search service

Use OpenSearch, Elasticsearch, Meilisearch, or a managed equivalent with asynchronous indexing.

**Advantages**

- Better relevance, typo handling, faceting, and ranking controls.
- Easier future scale for a large catalog.

**Disadvantages**

- Additional service, synchronization, backup, monitoring, and cost.
- Eventual consistency between PostgreSQL and the search index.

**Security and cost**

Requires securing another network service and preventing private/unapproved listings from being indexed. Cost is moderate to high for a small startup.

**Database effect**

PostgreSQL remains authoritative. Add an indexing/outbox or synchronization status model and reindexing jobs.

### Option C — Simple SQL `ILIKE` search

Search normalized columns with bounded `ILIKE` queries.

**Advantages**

- Fastest initial implementation.
- Minimal schema work.

**Disadvantages**

- Weak typo tolerance and relevance.
- Can degrade with growth.

**Security and cost**

Low cost but requires strict limits and indexes where possible.

**Database effect**

Add normalized columns and basic indexes; likely requires a later migration to full-text search.

### Recommendation and approval

Approved decision: use PostgreSQL Full-Text Search with `pg_trgm`. Remaining implementation details include language dictionaries, ranking weights, normalization, thresholds, and future multi-city migration criteria.

## 4. Business verification evidence

### Actual decision required

Decide what evidence a business owner may submit, who can view it, how it is reviewed, how long it is retained, and whether verification means identity confirmation, business existence, contact confirmation, or something narrower.

### Option A — Private object storage with metadata in PostgreSQL — recommended

Store evidence files in a private S3-compatible bucket. Store only metadata, checksum, owner, verification request, file type, and protected object key in PostgreSQL. Administrators access files through short-lived signed URLs.

**Advantages**

- Affordable and standard.
- Database remains small and transactional.
- Private access and deletion are manageable.
- Works with later image/document scanning.

**Disadvantages**

- Requires object-storage lifecycle configuration.
- Requires secure upload, content validation, malware scanning, and access logging.

**Security and cost**

Low to moderate cost. Bucket privacy, encryption, signed URLs, file limits, MIME validation, malware scanning, and strict admin authorization are mandatory.

**Database effect**

Use `verification_requests` and `verification_documents` with private object keys, hashes, review status, reviewer, decision, timestamps, and deletion/retention fields.

### Option B — Store files directly in PostgreSQL

Use `bytea` or large-object storage for evidence.

**Advantages**

- One backup system and transaction boundary.
- Simple reference model at very small scale.

**Disadvantages**

- Database growth and backup size increase quickly.
- File delivery and scanning become less convenient.

**Security and cost**

No separate storage bill initially, but database operations and backup costs can rise. Sensitive access controls remain mandatory.

**Database effect**

Adds binary columns or large-object references, complicating migrations and restore times.

### Option C — Do not collect evidence initially

Use manual review of public information and owner declarations, with no uploaded documents in MVP.

**Advantages**

- Lowest initial cost and attack surface.
- Fastest implementation.

**Disadvantages**

- Weaker verification confidence.
- More dependence on administrator judgment and external contact.

**Security and cost**

Lowest technical risk, but fraud and impersonation risk may be higher.

**Database effect**

Keep verification request decisions and notes without document entities, while preserving a future migration path.

### Recommendation and approval

Approved decision: use hybrid verification with phone OTP plus manual administrator review of business details and appropriate supporting evidence. GST or Aadhaar is not universally required. Remaining details include accepted evidence types, upload security, reviewer access, retention, deletion, OTP provider, and launch enablement. Begin staging with synthetic files and no real personal documents.

## 5. Business ownership rules

### Actual decision required

Define who may claim a business, how ownership is proven, whether multiple people may manage a listing, what happens when ownership is disputed, and which owner actions require review.

### Option A — One primary owner plus assigned editors/managers — recommended

Each business has one primary owner relationship and optional additional members with explicit roles such as editor or manager. Material edits and ownership changes go through moderation.

**Advantages**

- Clear accountability.
- Supports real businesses with multiple staff members.
- Avoids overcomplicated organization/team billing models.

**Disadvantages**

- Requires invitations, revocation, and dispute handling.
- Primary-owner transfer needs administrator oversight.

**Security and cost**

Good least-privilege model with moderate implementation cost.

**Database effect**

Use `business_owners` with `user_id`, `business_id`, role, status, invited/accepted timestamps, and audit fields. Enforce at most one active primary owner unless an administrator performs a controlled transfer.

### Option B — One owner only

Allow exactly one account to manage each business.

**Advantages**

- Simplest authorization and database model.
- Lower initial engineering cost.

**Disadvantages**

- Poor fit for businesses with multiple representatives.
- Account loss creates operational support issues.

**Security and cost**

Lower complexity but greater single-account dependency.

**Database effect**

Use a single nullable `owner_user_id` or a constrained ownership table.

### Option C — Organization/team model

Create organizations, team memberships, invitations, and granular permissions before assigning businesses.

**Advantages**

- Strong long-term multi-business and agency support.
- Flexible permission model.

**Disadvantages**

- Excessive complexity for initial Nanded MVP.
- More UI, support, and authorization edge cases.

**Security and cost**

Higher security review and development cost.

**Database effect**

Adds organizations, memberships, invitations, and policy tables.

### Recommendation and approval

Approved decision: use one primary business owner initially, with future manager support. Ownership claims and transfers require verification and administrator approval. Remaining details include claim evidence, manager permissions, dispute handling, and whether an owner may manage multiple businesses.

## 6. Reviews and ratings

### Actual decision required

Decide who may review, whether a customer must have an interaction with a business, whether reviews require moderation, how edits/deletions work, and how aggregate ratings are calculated and displayed.

### Option A — Authenticated, one active review per customer/business, moderated — recommended

Customers submit a 1–5 rating and text review. New reviews enter moderation or a policy-based queue. Only one active review per customer/business is allowed, with a controlled edit history.

**Advantages**

- Limits spam and duplicate rating manipulation.
- Clear ownership and abuse-reporting path.
- Affordable and appropriate for a local directory.

**Disadvantages**

- Requires moderation workload.
- A customer-business interaction requirement may be difficult to prove initially.

**Security and cost**

Requires authentication, rate limits, abuse detection, moderation, report handling, and audit logs. Cost is moderate and mostly operational.

**Database effect**

Add unique active review constraint on `(user_id, business_id)`, status, rating, body, moderation fields, edit history, reports, and timestamps. Store aggregates or calculate them from approved reviews with caching later.

### Option B — Authenticated reviews with immediate publication and moderation after reporting

Publish reviews immediately and allow administrators to remove reported content.

**Advantages**

- Faster customer feedback loop.
- Lower initial moderation queue.

**Disadvantages**

- Higher risk of abuse, defamation, spam, and reputational harm.
- Requires rapid moderation response.

**Security and cost**

Lower pre-publication cost but higher safety and support risk.

**Database effect**

Still requires status, reports, audit history, rate-limit records, and removal metadata.

### Option C — Reviews disabled for MVP

Display no customer reviews or ratings until the platform has enough moderation capacity and policy clarity.

**Advantages**

- Lowest risk and implementation cost.
- Avoids invented or unverified social proof.

**Disadvantages**

- Less engagement and trust signal.
- Requires future migration when enabled.

**Security and cost**

Lowest cost and abuse risk.

**Database effect**

Reserve review tables and feature flags but do not expose write endpoints.

### Recommendation and approval

Approved decision: reviews require authentication, use a public display name, allow one review per customer per business, support editing, reporting, and moderation, and make no unsupported verified-purchase claims. Reviews remain disabled in private staging unless all data is synthetic. Remaining details include moderation thresholds, response rights, dispute handling, and rating aggregation.

## 7. Customer inquiries

### Actual decision required

Decide whether inquiries are internal messages, email relays, or both; who can see them; how spam is controlled; whether customer contact information is revealed; and how long messages are retained.

### Option A — Database-backed internal inbox with optional email notification — recommended

Store inquiries in PostgreSQL. Show them to authorized business members and customers. Add an optional notification adapter later; do not expose personal email addresses by default.

**Advantages**

- Consistent audit trail and ownership controls.
- Does not require email delivery for core functionality.
- Easier to moderate, report, and rate-limit.

**Disadvantages**

- Requires inbox UI and notification/read states.
- Businesses may miss messages without notifications.

**Security and cost**

Moderate security requirements: authorization, spam protection, content limits, abuse reporting, and personal-data minimization. Low initial infrastructure cost.

**Database effect**

Use `inquiries`, `inquiry_recipients` if needed, status, timestamps, read state, moderation/report fields, and optional notification delivery records.

### Option B — Email relay only

Forward customer messages through a controlled relay without storing full messages in the application database.

**Advantages**

- Smaller application surface.
- Familiar workflow for business owners.

**Disadvantages**

- Harder auditing, moderation, retry handling, and privacy control.
- Email provider becomes a critical dependency.

**Security and cost**

Requires anti-spam, address protection, provider security, and careful content handling. Recurring email cost may begin low but grows with use.

**Database effect**

Store delivery metadata and consent records, but not necessarily message content. This complicates support and audit requirements.

### Option C — No inquiries in MVP

Provide only existing public business contact actions until moderation, notification, and privacy policy are ready.

**Advantages**

- Lowest risk and fastest delivery.

**Disadvantages**

- Less platform engagement.
- Requires a later workflow decision.

**Security and cost**

Lowest operational cost and data risk.

**Database effect**

Keep inquiry tables out of the first migration or create them behind a disabled feature flag.

### Recommendation and approval

Approved decision: provide two-way inquiry messaging plus direct WhatsApp/call actions where valid, with owner/assigned-manager access restrictions, reusable OTP-verified guest identity, inquiry-scoped sessions, contact privacy, audit logging, rate limits, and spam protection. Keep inquiries disabled before launch until the approved controls are implemented. Remaining details include notification delivery, exact contact-encryption/key-management design, message limits, retention enforcement, and abuse handling.

## 8. Hosting

### Actual decision required

Choose where the frontend, Express API, PostgreSQL database, private staging access layer, logs, and file storage will run, including region, operational ownership, and spending limits.

### Option A — Managed application platform plus managed PostgreSQL — recommended

Use a reputable managed platform for the Node.js service and a managed PostgreSQL provider. Use an S3-compatible object store for evidence. Protect staging with an identity proxy, allowlist, or VPN.

**Advantages**

- Lowest operational burden for a small team.
- Simple deployments, logs, environment variables, and scaling.
- Predictable initial cost compared with running infrastructure manually.

**Disadvantages**

- Vendor-specific networking and deployment constraints.
- Costs can rise with traffic, database size, or logs.

**Security and cost**

Good security defaults are possible if private networking, secrets management, backups, and access roles are configured correctly. Low to moderate startup cost.

**Database effect**

Use provider-managed PostgreSQL with connection pooling, SSL, migrations, backup configuration, and separate staging/production instances.

### Option B — Single virtual private server

Run reverse proxy, Node.js, PostgreSQL, and storage-adjacent services on one hardened VPS.

**Advantages**

- Lowest monthly infrastructure bill at very small scale.
- Full control and simple network topology.

**Disadvantages**

- Team owns patching, monitoring, backups, failover, and incident response.
- Single host failure can affect every service.

**Security and cost**

Low monetary cost but high operational/security cost. Requires hardening, firewalling, secret management, and tested restores.

**Database effect**

PostgreSQL runs locally on the VPS, increasing the importance of off-host backups and recovery testing.

### Option C — Major cloud provider managed services

Use managed compute, managed PostgreSQL, object storage, networking, secrets, monitoring, and infrastructure as code on a major cloud.

**Advantages**

- Strongest long-term flexibility and service breadth.
- Better path to advanced networking and compliance controls.

**Disadvantages**

- More configuration and billing complexity.
- Higher engineering overhead for a small startup.

**Security and cost**

Excellent capability, but misconfiguration and unexpected billing are real risks. Cost is moderate to high unless carefully governed.

**Database effect**

Managed PostgreSQL, read replicas, backups, and private networking are available but require more infrastructure design.

### Recommendation and approval

Approved decision: use Render Static Site, Render Free Node.js backend, Neon PostgreSQL, and Cloudflare Access for private staging, targeting ₹0–₹500/month initially. Free-tier limitations, region availability, quotas, sleep behavior, connection limits, egress, reliability, and upgrade triggers must be documented and verified before implementation relies on them.

## 9. Backup and disaster recovery

### Actual decision required

Define recovery point objective (RPO), recovery time objective (RTO), backup frequency, retention, restore testing, regional failure strategy, and who is responsible during an incident.

### Option A — Managed point-in-time recovery plus encrypted logical backups — recommended

Enable provider-managed continuous or frequent PostgreSQL recovery, daily encrypted logical backups, object-storage versioning, and scheduled restore drills.

**Advantages**

- Strong protection without operating a backup cluster.
- Point-in-time recovery limits data loss.
- Logical backups provide portability if the provider changes.

**Disadvantages**

- Managed recovery is provider-dependent.
- Restore drills require operational discipline and staging capacity.

**Security and cost**

Low to moderate cost. Backups must be encrypted, access-controlled, isolated from the primary account, and monitored for failure.

**Database effect**

Requires backup policy metadata, migration compatibility, restore validation scripts, and documented sequence for rebuilding PostgreSQL and application services.

### Option B — Daily snapshots and weekly logical backups

Use scheduled database snapshots and periodic dump files.

**Advantages**

- Lower initial cost.
- Simple to understand and implement.

**Disadvantages**

- Greater possible data loss between backups.
- Recovery may be slower.

**Security and cost**

Low cost but weaker RPO. Encryption, off-host storage, access control, and restore testing remain mandatory.

**Database effect**

Requires backup metadata and restore procedures, but less continuous-recovery configuration.

### Option C — Multi-region standby and automated failover

Maintain a second region or provider with replicated database and application infrastructure.

**Advantages**

- Strongest availability and disaster resilience.

**Disadvantages**

- Too complex and expensive for an initial local startup.
- Replication, failover, data consistency, and testing are difficult.

**Security and cost**

High infrastructure and operational cost, with more secrets, networks, and failure modes.

**Database effect**

Requires replication topology, failover state, conflict handling, and more complex operational tooling.

### Recommendation and approval

Approved decision: use daily independent encrypted backups with 30-day retention, target RPO 24 hours and target RTO 8 hours, and require restore testing. Remaining details include independent storage location, key ownership, automation, measured recovery results, and incident runbooks.

## Cross-decision database impact

These decisions affect the PostgreSQL design as follows:

- Authentication determines session/token, password-reset, verification, and revocation tables.
- Retention determines soft deletion, anonymization, purge jobs, audit exceptions, and partitioning.
- Search determines normalized fields, `tsvector`, trigram indexes, or an external indexing/outbox model.
- Evidence determines protected document metadata and deletion lifecycle.
- Ownership determines `business_owners`, roles, invitations, transfer, and dispute records.
- Reviews determine uniqueness, moderation state, ratings, edit history, reports, and aggregates.
- Inquiries determine message, recipient, status, notification, retention, and abuse controls.
- Hosting determines connection pooling, environment separation, extensions, backup configuration, and operational metadata.
- Disaster recovery determines migration discipline, backup metadata, restore tests, and data portability.

## Remaining implementation risks and approvals

The D1–D34 product decisions are approved. The following implementation, legal, provider, and operational details remain unresolved and must not be silently assumed:

1. Exact session cookie names, device/session management, CSRF behavior, and the concurrency/idempotency implementation and tests for approved guest-token rotation.
2. Phone OTP provider, sender identity, provider-specific abuse monitoring, cost controls, and integration details. The approved OTP validity, attempt, cooldown, resend-cap, fresh-verification, and plaintext-storage rules remain unchanged.
3. Accepted verification evidence types, upload limits, malware scanning, signed-URL duration, storage encryption, and deletion workflow.
4. Search dictionaries, ranking weights, normalization, `pg_trgm` thresholds, and multi-city scale trigger.
5. Exact role names and permission matrix for future managers.
6. Ownership claim evidence, duplicate handling, transfer workflow, and dispute escalation.
7. Review moderation thresholds, rating aggregation, owner responses, and dispute process.
8. Inquiry notifications, WhatsApp link format, exact application-level contact-encryption/key-management design, message limits, and abuse handling. Guest identity, access, messaging, deletion scope, and retention are approved; automated retention/deletion enforcement remains incomplete.
9. Current Render, Neon, and Cloudflare Access quotas, region availability, free-tier sleep/scale behavior, connection limits, egress, reliability, and upgrade triggers.
10. Backup storage location, encryption-key ownership, automation, restore test schedule, and measured RPO/RTO.
11. Legal review of retention, deletion, OTP, evidence, privacy, terms, reviews, and communications requirements.
12. Monitoring, CI/CD, production approval workflow, and exact launch feature-flag runbook.
13. Deletion-request workflow details, OTP challenge cleanup, legal-hold evaluation, and mandatory-retention exception handling.
14. RLS transaction-local context implementation, database role/table ownership configuration, `BYPASSRLS` controls, and pooler compatibility testing.
15. Notification delivery/read-state behavior, generic report taxonomy/moderation workflow, and private media storage lifecycle.

The product owner must approve any change to decisions D1–D34, legal policies, launch enablement, public-write scope, or staging budget. Legal review and production readiness remain incomplete.

## Final recommendation

For a small startup, use PostgreSQL-backed secure sessions, data-class-specific retention, PostgreSQL full-text/trigram search, private evidence storage with the provider finalized during implementation, one primary business owner with future manager support, moderated authenticated reviews, an internal inquiry inbox, managed application hosting with managed PostgreSQL, and managed point-in-time recovery plus encrypted logical backups.

These choices keep the initial system affordable and maintainable while preserving upgrade paths. They are suitable for private staging implementation, but public registration, submissions, inquiries, reviews, and indexing must remain disabled until the product owner approves launch.
