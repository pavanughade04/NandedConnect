# NandedConnect Product Requirements Document

**Product:** NandedConnect  
**Purpose:** Production-ready local business discovery platform for Nanded, Maharashtra  
**Strategy:** Build first, launch later  
**Document status:** Product and engineering baseline; 34 architecture decisions (D1–D34) approved; legal review, security validation, restore testing, production readiness, and public launch approval remain incomplete

## 1. Product vision

NandedConnect will help residents and visitors discover local businesses, services, categories, and places in Nanded. It will also give local business owners a controlled way to create and maintain listings, while administrators manage quality, verification, moderation, and platform safety.

The product must be trustworthy, transparent about listing quality, mobile-friendly, accessible, and ready for future growth without presenting unverified information as official or guaranteed.

The existing frontend business data, category data, locality data, tourism content, and useful discovery workflows should be preserved and migrated carefully where applicable.

## 2. Build-first, launch-later strategy

The complete product may be built, tested, and deployed to a private staging environment before public launch. Deployment is not permission to launch publicly.

Until the product owner explicitly approves launch:

- Public access must remain disabled or restricted to an approved allowlist.
- Public registration and real account creation must remain disabled.
- Real business submissions, inquiries, reviews, and user-generated content must remain disabled.
- Development must use clearly labeled demo, seed, and test data.
- Search engine indexing must be prevented with `noindex` controls, restricted access, and environment-level protections.
- Production credentials, secrets, and real personal data must not be used in development or staging.
- A launch feature flag or equivalent release gate must control public write functionality.
- The product owner must explicitly approve public launch after the launch-readiness checklist is complete.

## 3. User roles

### 3.1 Public Visitor

Unauthenticated visitor who can access only the pages and data enabled for the current environment. In private staging, access requires the configured staging protection.

Capabilities after launch approval may include:

- Browse the homepage, categories, localities, and public business listings.
- Search and filter businesses.
- View approved business details, contact information, services, ratings, and reviews.
- Submit a contact or inquiry form when enabled.

### 3.2 Customer

Authenticated end user who discovers and saves local businesses.

Capabilities:

- Register, sign in, sign out, and recover an account when public authentication is enabled.
- Manage profile information and preferences.
- Save and remove favorite businesses.
- View recently viewed businesses.
- Submit, edit, or remove reviews only when the review feature is enabled and the user is authorized.
- Submit inquiries to businesses when enabled.
- Manage account privacy and deletion requests.

### 3.3 Business Owner

Authenticated owner or authorized representative of a business.

Capabilities:

- Create a business claim or listing submission.
- Submit business profile, locality, address, phone, services, hours, and media for review.
- View listing status and moderation feedback.
- Edit an approved listing through a new review workflow.
- Manage services and inquiry responses when enabled.
- View only authorized listing analytics and business data.

### 3.4 Administrator

Privileged staff role with least-privilege access to platform management tools.

Capabilities:

- Manage users, roles, businesses, categories, localities, and content.
- Review business submissions and verification evidence.
- Approve, reject, suspend, archive, or request changes to listings.
- Moderate reviews, inquiries, reports, and abusive content.
- Review audit logs and security events.
- Manage launch flags, staging data, and platform configuration.

## 4. MVP functional requirements

### 4.1 Discovery

- Homepage with NandedConnect branding and clear visitor calls to action.
- Business discovery by name, category, locality, address, and description.
- Combined filters for category and locality.
- Sorting by relevance and name.
- Empty, loading, error, and no-result states.
- Responsive layouts for mobile, tablet, laptop, and desktop.
- Category discovery with category descriptions and approved business results.
- Business detail page with only available, approved information.
- Related businesses based on category or locality.
- Map or directions link only when valid location data exists.
- Phone/call action only when a valid business phone exists.

### 4.2 Customer account

- Registration, login, logout, and password recovery when enabled.
- Secure password reset flow with expiring, single-use tokens.
- Email verification when enabled by launch policy.
- Profile view and edit.
- Favorites persisted to the authenticated account after backend integration.
- Recently viewed businesses.
- Account settings, privacy controls, and account deletion request.

### 4.3 Business owner workflow

- Business listing submission form.
- Draft saving and editing.
- Business ownership claim workflow.
- Listing status: draft, submitted, changes requested, under review, approved, rejected, suspended, archived.
- Services management.
- Contact and inquiry management when enabled.
- Listing edit history and moderation feedback.

### 4.4 Administration

- Protected administrator dashboard.
- Business submission review queue.
- Verification evidence review.
- User and role management.
- Category and locality management.
- Review and report moderation.
- Audit log search and export controls.
- Safe seed-data and staging reset tools that cannot affect production data.

### 4.5 Content and trust

- Every listing must show its status and last reviewed/updated metadata where appropriate.
- The interface must distinguish approved platform data, user-provided data, imported public data, and demo/test data.
- Listings must include a clear “not an endorsement” or equivalent disclaimer where required.
- No invented business details, phone numbers, ratings, reviews, addresses, or performance statistics.

## 5. PostgreSQL data model

The final schema should use UUID primary keys, UTC timestamps, foreign keys, indexes for discovery queries, and soft-delete or archival fields where retention is required.

### Core entities

| Entity | Purpose | Important relationships |
| --- | --- | --- |
| `users` | Account identity and status | Has many roles, favorites, views, reviews, inquiries, audit events |
| `roles` | Role definitions | Many-to-many with users through `user_roles` |
| `user_roles` | User-role assignments | References `users` and `roles` |
| `user_profiles` | Editable profile details | One-to-one with users |
| `sessions` | Server-side authenticated sessions | References users; stores only one-way token hashes and revocation/expiry state |
| `password_reset_tokens` | Short-lived password recovery tokens | References users; stores only one-way token hashes and single-use state |
| `email_verification_tokens` | Email verification tokens | References users; stores only one-way token hashes and expiry/use state |
| `businesses` | Canonical business record | Belongs to owner where claimed; has category, locality, services, reviews, inquiries |
| `business_owners` | Authorized ownership links | Many-to-many between users and businesses with ownership status |
| `business_memberships` | Business-specific assignment relationship | Supports scoped managers and other authorized members; relationship to `business_owners` remains open |
| `inquiry_assignments` | Inquiry-specific manager assignment relationship | Links manager users, businesses, and inquiries; physical implementation and assignment rules remain open |
| `ownership_claims` | Business ownership claim workflow | References businesses, claimant users, verification requests, reviewers, decisions, and timestamps |
| `categories` | Business category taxonomy | Has many businesses |
| `localities` | Nanded locality taxonomy | Has many businesses |
| `business_services` | Services offered by a business | Belongs to businesses |
| `business_hours` | Opening-hours data | Belongs to businesses |
| `business_contacts` | Phone, email, website, and contact metadata | Belongs to businesses; sensitive fields require access controls |
| `business_locations` | Address, coordinates, and map metadata | Belongs to businesses |
| `business_submissions` | Submitted or changed listing payloads | Belongs to a business and submitting user |
| `verification_requests` | Verification workflow and evidence | Belongs to businesses and reviewers |
| `verification_documents` | Metadata for submitted evidence | Belongs to verification requests; protected storage reference only |
| `favorites` | Customer saved businesses | Unique composite key on user and business |
| `recently_viewed` | Customer/business viewing history | References user and business with timestamp |
| `reviews` | Customer reviews and ratings | References user and business; moderation status required |
| `review_reports` | Review-specific abuse reports | References reviews and reporters; includes reason, status, resolution, and timestamps |
| `inquiries` | Customer-to-business messages | References customer, business, and optional owner recipient |
| `guest_identities` | Reusable verified-guest identity | References normalized phone identity and encrypted contact metadata; raw OTP values are not stored |
| `guest_inquiry_sessions` | Inquiry-scoped guest access session | References one guest identity and one inquiry; stores token-hash and expiry/revocation/rotation metadata |
| `inquiry_messages` | Inquiry message records | References an inquiry and either an authenticated user sender or guest-session sender |
| `reports` | Abuse, accuracy, or safety reports | References reporter and reported resource |
| `system_events` | Durable workflow and domain event records | Separate from human-authored inquiry messages; event taxonomy and visibility remain open |
| `notifications` | Recipient-specific in-app delivery and read-state records | May reference authenticated users or inquiry-scoped guest recipients; email delivery is not an approved MVP requirement |
| `audit_logs` | Immutable security and moderation history | References actor and affected resource |
| `security_events` | Security and suspicious-activity events | Records minimized event metadata and optional user association |
| `feature_flags` | Environment and launch controls | Managed by administrators and deployment configuration |
| `feature_flag_changes` | Feature-flag change history | References feature flags and the authorizing actor |
| `deletion_requests` | Verified account or guest-inquiry deletion workflow | References requester, related account/inquiry, verification, legal holds, retention exceptions, and audit history |
| `guest_otp_challenges` | Short-lived guest OTP verification lifecycle | References reusable guest identity; stores only a secure OTP hash and verification state |
| `launch_approvals` | Product-owner approval for public launch or scoped enablement | Records approver, environment, scope, feature flags, configuration references, rollback reference, and audit history |
| `business_media` | Business media metadata and private storage references | Belongs to businesses; actual files remain in private object storage |

### Relationship requirements

- A business may be unclaimed, claimed by one owner, or associated with multiple authorized owners.
- A business must reference a valid category and locality where those fields are required.
- Favorites and recently viewed rows must reference existing users and businesses.
- Reviews must reference an authenticated customer and a business and must have moderation status.
- Verification decisions must record reviewer, decision, reason, timestamps, and audit event.
- Deleting a user must follow a documented retention and anonymization policy.
- Deleting a business must not silently delete required audit history.
- Manager access requires both business membership authorization and inquiry-specific assignment.
- System events and notifications are separate from human-authored inquiry messages and do not rotate guest tokens.

### Guest inquiry identity, access, messaging, and privacy

The following guest-inquiry controls are approved product requirements and apply when public inquiries are enabled:

- A guest has a reusable identity associated with the verified phone number, but each inquiry receives a separate inquiry-scoped access session.
- Guest inquiry sessions expire after 30 minutes of inactivity and absolutely after 24 hours. Fresh OTP verification is required after expiry; it creates a new inquiry-scoped session and does not revive an expired session.
- OTPs are valid for 5 minutes, allow at most 5 incorrect attempts, require a 60-second resend cooldown, and allow at most 5 resends per hour per phone number. OTP values must never be stored in plaintext.
- Guest access uses cryptographically random opaque tokens stored only as hashes in PostgreSQL and delivered through Secure, HttpOnly, SameSite cookies. Guest tokens must never be stored in localStorage.
- The guest access token rotates after every successfully processed message. The rotation design must handle concurrent requests, retries, idempotency, atomic message/token updates, and prevention of multiple valid successor tokens.
- OTP-verified guests and authenticated business owners or assigned managers have two-way inquiry messaging. Full guest contact information is restricted to the authorized business owner and assigned managers for that business’s inquiries.
- Guest contact information is encrypted at the application level. Every sensitive contact access is audit-logged.
- A verified guest may request complete inquiry deletion after fresh OTP verification, including associated messages and personal contact information, subject to documented legal holds and mandatory retention requirements.
- Guest notifications use the reusable guest identity as durable recipient identity and explicit inquiry/resource scope. An active inquiry-scoped guest session authorizes reads only for that guest identity and inquiry; expired or revoked sessions deny access, while fresh OTP verification creates a new session without deleting or reassigning notification history. Read/unread state belongs to the notification record, not the session. Exact recipient keys, global guest notifications, RLS, visibility, delivery, deletion, retention, legal holds, and idempotency remain OPEN.

## 6. Backend and API requirements

- Use a versioned REST or equivalent HTTP API with consistent JSON responses.
- Validate request bodies, query parameters, path parameters, and uploaded metadata server-side.
- Apply pagination, sorting, filtering, and bounded query limits to discovery endpoints.
- Use transactions for multi-table workflows such as submission approval and ownership changes.
- Use migrations for every schema change.
- Keep business, verification, moderation, and audit logic on the server.
- Return only fields authorized for the requesting role.
- Use structured error codes and messages that do not reveal sensitive implementation details.
- Add health, readiness, and migration status checks for staging deployment.
- Keep secrets and environment configuration outside source control.
- Add rate limits to authentication, password recovery, submissions, reviews, inquiries, and report endpoints.

## 7. Authentication and security requirements

- Use a vetted authentication mechanism with secure, HttpOnly, Secure, SameSite cookies or an equivalent secure token strategy.
- Never store plaintext passwords, passwords in localStorage, or passwords in logs.
- Hash passwords with a modern adaptive password hash such as Argon2id or an approved equivalent.
- Enforce password policy, login throttling, account lockout or progressive delay, and suspicious-login monitoring.
- Protect against CSRF, XSS, SQL injection, SSRF, broken access control, insecure direct object references, and mass assignment.
- Apply server-side authorization checks to every protected resource.
- Configure security headers including CSP, HSTS where appropriate, frame protection, MIME sniffing protection, and a restrictive referrer policy.
- Validate and sanitize uploaded files; restrict type, size, storage location, and access.
- Do not expose database credentials, secrets, stack traces, or internal identifiers unnecessarily.
- Encrypt sensitive data in transit and protect sensitive data at rest according to deployment requirements.
- Record security-relevant events in audit logs without logging secrets or passwords.
- Define backup, restore, retention, incident response, and credential rotation procedures.

## 8. Business verification workflow

1. Owner creates a draft listing or claims an existing listing.
2. Owner submits required business details and permitted evidence.
3. Server validates the submission and records a versioned snapshot.
4. Administrator reviews identity, contact, locality, duplicate risk, and evidence.
5. Administrator approves, rejects, suspends, or requests changes with a reason.
6. Approved information becomes publicly visible only when the launch flag and listing status both permit it.
7. Any material edit creates a new reviewable version where required.
8. Verification expires or is rechecked according to a documented policy.
9. All decisions and changes are recorded in the audit log.

Verification must not imply endorsement, legal certification, or guaranteed business quality. The UI must explain what was checked and what was not checked.

## 9. Testing requirements

### Automated testing

- Unit tests for validation, filtering, authorization policies, and business rules.
- API integration tests for every public and protected endpoint.
- Database migration and rollback tests.
- Authentication, authorization, password-reset, and session tests.
- Verification workflow and moderation tests.
- Frontend component and route tests.
- End-to-end tests for customer, owner, administrator, and visitor journeys.
- Accessibility tests against WCAG 2.1 AA targets.
- Security scanning for dependencies, source code, headers, and common web vulnerabilities.

### Manual and acceptance testing

- Verify all supported routes and navigation paths.
- Test mobile, tablet, laptop, and desktop breakpoints.
- Test loading, empty, error, unauthorized, forbidden, and expired-session states.
- Confirm demo/test data is clearly labeled and isolated.
- Confirm public registration, submissions, inquiries, reviews, and indexing remain disabled in staging.
- Test backup restoration and staging recovery procedures.

## 10. Deployment and environments

Required environments:

- Local development
- Private staging
- Production, provisioned but launch-gated

Private staging requirements:

- Require VPN, identity-aware proxy, HTTP basic authentication, or an approved allowlist.
- Disable public registration and all real user-generated write workflows.
- Use isolated staging database and credentials.
- Seed only demo/test data marked as such.
- Set `X-Robots-Tag: noindex, nofollow` and an appropriate `robots.txt`.
- Do not expose staging URLs through public navigation, search, or marketing materials.
- Enable error monitoring and audit logging without collecting unnecessary personal data.

Deployment must include automated builds, migration checks, environment validation, health checks, rollback procedures, and secret verification. Production deployment must not automatically enable public access.

## 11. Launch-readiness checklist

Launch requires explicit product-owner approval after all applicable items are complete:

- [ ] Core customer, business owner, administrator, and visitor workflows accepted.
- [ ] Authentication, authorization, session handling, and password recovery security reviewed.
- [ ] Database migrations, indexes, backups, restore tests, and retention policies verified.
- [ ] Business verification and moderation workflows accepted.
- [ ] Public listing data reviewed for accuracy and provenance.
- [ ] Demo/test data removed or isolated from production.
- [ ] Public registration and write workflows intentionally enabled only at launch.
- [ ] Contact, inquiries, reviews, and notifications configured and tested.
- [ ] Accessibility, browser, responsive, performance, and security testing passed.
- [ ] Monitoring, alerting, audit logs, incident response, and rollback procedures ready.
- [ ] Legal, privacy, terms, moderation, and data deletion content reviewed.
- [ ] `noindex` and staging access restrictions removed only from approved production surfaces.
- [ ] Product owner has explicitly approved public launch.

## 12. Out of scope until separately approved

- Public launch without owner approval.
- Unmoderated business publishing.
- Unverified claims of business quality or ratings.
- Storage of real customer or owner data in local development.
- Unapproved third-party integrations.
- Real payments, advertising, or monetization.
- Automated collection of personal data from external websites.

## 13. Approved architecture decisions

The following decisions were approved by the product owner and supersede earlier provisional recommendations. They define the implementation baseline while preserving the build-first, launch-later strategy.

1. **Authentication:** NandedConnect will use custom authentication implemented with Node.js, Express.js, and PostgreSQL. One account may hold multiple roles. Authentication will use secure server-managed PostgreSQL sessions, secure cookies, Argon2id password hashing, and restricted administrator permissions.
2. **Retention:** Active accounts are retained while active. Personal data for a deleted account is targeted for deletion within 30 days of a verified request. Guest inquiries are retained for 24 months after last activity, with earlier deletion after a verified guest request. Legal holds and mandatory retention requirements are documented exceptions. Security logs are retained for 90 days, administrator audit logs for 12 months, and backups for 30 days. Guest inquiry retention is approved; automated retention/deletion enforcement, legal/privacy review, and operational validation remain incomplete.
3. **Search:** PostgreSQL Full-Text Search with `pg_trgm` will be used for the initial search implementation.
4. **Business verification:** Verification will use phone OTP plus manual administrator review of business details and appropriate supporting evidence. There is no universal GST or Aadhaar requirement.
5. **Ownership:** Each business has one primary owner initially, with future manager support. Ownership claims and transfers require verification and administrator approval.
6. **Reviews:** Reviews require authentication, display a public display name, allow one review per customer per business, support editing, reporting, and moderation, and must not make unsupported verified-purchase claims.
7. **Inquiries:** The product will provide two-way inquiry messaging for authenticated customers or OTP-verified guests, plus direct WhatsApp and call actions where valid business contact data exists. Owner/customer access restrictions, rate limits, spam protection, inquiry-scoped guest sessions, privacy controls, and audit logging are required.
8. **Hosting:** Private staging will use Render Static Site, Render Free Node.js backend, Neon PostgreSQL, and Cloudflare Access, with an initial target budget of ₹0–₹500/month. Free-tier limits must be documented and monitored; no provider capability may be assumed without verification.
9. **Recovery:** Use daily independent encrypted backups with 30-day retention, a target RPO of 24 hours, and a target RTO of 8 hours. Restore testing is required.
10. **Launch control:** Explicit product-owner approval and feature flags are required. There is no public launch or public write functionality without that approval.

11. **Search configuration:** Use PostgreSQL simple text search plus `pg_trgm`, with multilingual testing before production use.
12. **UUID and extensions:** Use UUIDv4 via `gen_random_uuid()` and only the minimum necessary PostgreSQL extensions.
13. **OTP architecture:** Use a provider-independent OTP adapter; private staging uses mock OTP and must not send accidental real messages.
14. **Verification evidence:** Use private object storage for evidence; PostgreSQL stores metadata and protected object references only.
15. **Inquiry access:** Support authenticated customers or OTP-verified guests, with controlled business-owner access, assigned-manager access, inquiry-scoped guest sessions, rate limits, privacy controls, and audit logging.
16. **Manager permissions:** Allow limited managers while the primary owner retains ownership, transfer, verification, and manager-control authority.
17. **Database authorization:** Use application authorization plus selective PostgreSQL RLS for high-risk data.
18. **Hosting posture:** Use free-tier-first private staging and upgrade when necessary based on measured requirements.
19. **Legal gate:** Qualified legal/privacy review is mandatory before public launch; it is not complete.
20. **Recovery ownership:** The Product Owner is responsible for initial backup and recovery operations; restore testing and operational readiness remain incomplete.

21. **Deletion requests:** Use a separate `deletion_requests` entity for guest or authenticated-customer requests, including requester identity, related inquiry/account, required OTP verification state/time, status (`Pending`, `Verified`, `Processing`, `Completed`, `Rejected`), legal holds, mandatory-retention exceptions, processing timestamps, and audit information.
22. **Guest OTP challenges:** Use a separate `guest_otp_challenges` entity referencing reusable guest identity. Store only a secure OTP hash; enforce five-minute validity, five incorrect attempts, a 60-second resend cooldown, five resends per hour per phone number, verification time/status, consumed/expired states, and single-use successful verification.
23. **RLS security:** Protected backend operations use transactions with server-validated identity in transaction-local context using `SET LOCAL` or `set_config(..., true)`. Protected queries use the same connection and transaction; commit/rollback occurs before pool return. Missing/invalid context denies access. The runtime application database role must not own ANY database tables and must not have BYPASSRLS. Application authorization and selective RLS both enforce access. Security review and pooler compatibility testing remain pending.
24. **Limited manager permissions:** Managers may view business profiles, edit permitted fields, and view/respond only to assigned inquiries. They may not add/remove managers, transfer ownership, delete businesses, change owner security settings, or approve business verification. Access is business-specific and assignment-based; maximum manager count and detailed conflict/transfer rules remain unresolved.
25. **Launch approval audit:** Use a separate `launch_approvals` entity recording approval ID, authorized approver, timestamp, environment, launch scope, approved feature flags, previous/new configuration references, rollback reference, approval status, and audit history. Public launch remains disabled without explicit product-owner approval.
26. **Notifications, reports, and media:** Provide in-app notifications for inquiry messages, status updates, and important account events; abuse reports for businesses, reviews, and inquiries with admin moderation status; and business media metadata/storage references in PostgreSQL. Store actual files in private object storage with no public media URLs or unrestricted access.
27. **Immediate guest-token revocation:** Revoking an inquiry-scoped guest session immediately invalidates its token before expiry. Revocation is transactionally persisted, later requests with the token are rejected, and sensitive revocation actions are audit-logged.

Decisions 21–34 below are the approved D21–D34 addendum and do not alter D1–D20.

These decisions do not mark legal review, security review, restore testing, production readiness, or public launch as complete. Public registration, business submissions, reviews, inquiries, and search indexing remain disabled until approval. Frontend hiding and `noindex` are not security controls; staging access and backend APIs must be protected independently.

28. **D28 — Schema-readiness addendum:** Approve conceptual ERD synchronization, D23 database role/RLS security corrections, missing entity relationships, and schema-critical constraints. Preserve D1–D27 without modification. This authorizes documentation-only schema-readiness work, not SQL, migrations, database changes, or deployment.
29. **D29 — Inquiry assignments:** Use a separate conceptual `inquiry_assignments` entity or relationship linking manager users, businesses, and inquiries for assignment-based manager access. Business membership authorization and inquiry-specific assignment are both required conceptually; detailed modeling remains OPEN.
30. **D30 — Inquiry ownership XOR:** Require exactly one authenticated customer or guest identity for each inquiry, enforced by a PostgreSQL database-level XOR invariant and an authorized backend-controlled write path. Exact constraint, mutability, verification, write-path, concurrency, error-mapping, and testing details remain OPEN.
31. **D31 — Message sender XOR:** Require exactly one authenticated-user or guest-inquiry-session sender, enforced by a PostgreSQL database-level XOR invariant and an authorized backend-controlled write path. System-generated events remain separate from human-authored inquiry messages; sender representation and implementation details remain OPEN.
32. **D32 — System events separate from inquiry messages:** Keep workflow/status/assignment changes, reminders, and important account events separate from `inquiry_messages`. System events do not rotate guest tokens; timeline-visible system senders require separate approval. Event taxonomy, visibility, retention, ordering, audit, and job details remain OPEN.
33. **D33 — Separate system events and notifications:** Use durable `system_events` and recipient-specific `notifications`; one event may produce zero, one, or many notifications. Both remain separate from `inquiry_messages`, with transactional in-app writes, idempotent creation, and retry-safe processing permitted for MVP. Outbox/queue use remains OPEN and future-channel compatible.
34. **D34 — Hybrid guest notification identity and authorization:** Use reusable guest identity as durable notification recipient identity with explicit inquiry/resource scope. Active inquiry sessions provide temporary read authorization; expiry or revocation denies access, fresh OTP creates a new session, and notification read state is not session state. Cross-inquiry access is denied; remaining recipient, RLS, visibility, delivery, deletion, retention, legal-hold, and idempotency details remain OPEN.

## 14. Current implementation baseline

The current repository is a vanilla HTML/CSS/JavaScript frontend with centralized mock data and browser-only state. The existing frontend should remain functional while backend work is introduced incrementally behind stable contracts and launch gates.

The current frontend files are preserved as the baseline:

- [`index.html`](../index.html)
- [`data.js`](../data.js)
- [`script.js`](../script.js)
- [`style.css`](../style.css)

Backend implementation must not be considered public-launch ready until the requirements and checklist in this document have been completed and approved.
