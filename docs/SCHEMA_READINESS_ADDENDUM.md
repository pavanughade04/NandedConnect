# NandedConnect Schema Readiness Addendum

This addendum records the approved status vocabularies, initial-MVP inventory, conceptual requirements for the two missing user-activity entities, and the remaining implementation and approval work. It supplements the existing database and architecture documents; it does not replace them.

## 1. Approved status vocabularies

These are approved value vocabularies. They do not, by themselves, define or enforce every allowed transition. Transition graphs, authorization, audit recording, and invalid-transition handling remain backend implementation and testing work.

### `businesses`

Approved values:

`draft`, `submitted`, `under_review`, `changes_requested`, `approved`, `rejected`, `suspended`, `archived`

Deletion is represented by `deleted_at`, not by an invented business workflow status. Publication eligibility and publication timestamps must be represented separately from approval status. Public visibility must also account for suspension and deletion.

### `business_submissions`

Approved values:

`draft`, `submitted`, `under_review`, `approved`, `rejected`, `changes_requested`

### `verification_requests`

Approved values:

`pending`, `in_review`, `approved`, `rejected`, `needs_changes`

### `reviews`

Approved values:

`pending`, `approved`, `rejected`, `hidden`

The moderation vocabulary is separate from any publication or visibility implementation detail that may be needed by the backend.

### `inquiries`

Approved values:

`new`, `open`, `closed`, `spam`

### `ownership_claims`

Approved values:

`pending`, `in_review`, `approved`, `rejected`, `withdrawn`

### `reports`

Approved values:

`open`, `reviewing`, `resolved`, `dismissed`

### `launch_approvals`

Approved values:

`pending`, `approved`, `revoked`, `superseded`

### `deletion_requests`

Preserve the approved lifecycle:

`Pending` → `Verified` → `Processing` → `Completed`

`Rejected` is a terminal state. Backend workflow and audit enforcement remain required.

### `feature_flags`

Retain the configuration-based design: `enabled`, environment, and configuration. Do not add a status column. Feature-flag evaluation and change authorization must be enforced server-side.

## 2. Initial MVP table inventory

`favorites` and `recently_viewed` are approved MVP entities and must be included in the initial schema. `message_idempotency` remains the selected technical design for retry-safe inquiry message insertion, subject to engineering validation.

The expected migration inventory is **41 tables** if no other entities are added or removed. The current inspected migration contains **39 tables**; this addendum does not claim that it currently contains 41.

## 3. `favorites` conceptual schema

### PROPOSED TECHNICAL DESIGN

Proposed table: `public.favorites`.

| Column or constraint | Proposed definition | Purpose |
| --- | --- | --- |
| `user_id` | `UUID NOT NULL`, foreign key to `public.users(id)` | Identifies the user who saved the business. |
| `business_id` | `UUID NOT NULL`, foreign key to `public.businesses(id)` | Identifies the saved business. |
| `created_at` | `TIMESTAMPTZ NOT NULL` | Records when the favorite was created. |
| Primary key | `(user_id, business_id)` | Prevents duplicate user/business favorites. |
| Lookup index | Index beginning with `user_id` | Supports listing a user's favorites. |

The foreign-key deletion action for users and businesses, including any retention exception, remains **OPEN — OWNER APPROVAL** until a retention policy is approved. No deletion behavior is implied here.

## 4. `recently_viewed` conceptual schema

### PROPOSED TECHNICAL DESIGN

Proposed table: `public.recently_viewed`.

| Column or constraint | Proposed definition | Purpose |
| --- | --- | --- |
| `user_id` | `UUID NOT NULL`, foreign key to `public.users(id)` | Identifies the viewer. |
| `business_id` | `UUID NOT NULL`, foreign key to `public.businesses(id)` | Identifies the viewed business. |
| `last_viewed_at` | `TIMESTAMPTZ NOT NULL` | Records the latest view. |
| `view_count` | Optional counter; include only if justified by existing requirements | Avoids adding an unsupported product behavior. |
| Primary key | `(user_id, business_id)` | Prevents duplicate user/business rows. |
| Lookup index | `(user_id, last_viewed_at DESC)` | Supports a user's most-recently-viewed listing. |

Viewing an existing business should update its timestamp rather than create a duplicate user/business row. Exact retention duration, expiry processing, and deletion behavior are **OPEN — OWNER DECISION REQUIRED**.

## 5. Retention and deletion design

### PROPOSED TECHNICAL DESIGN

The eventual implementation must address, without silently selecting a policy:

- deletion of favorites when a user or business is deleted;
- retention and expiry of recently viewed records;
- interactions between account deletion and both activity tables;
- business archival or deletion and both activity tables;
- legal holds and mandatory retention requirements; and
- auditability of relevant deletion, expiry, hold, release, and override operations.

Existing approved retention decisions remain in force, including the 24-month guest-inquiry retention requirement and preservation of records subject to legal hold. Exact policies for favorites and recently viewed are new and unresolved. No exact retention period, anonymization rule, cascade action, or legal-compliance claim is made here.

**OPEN — OWNER APPROVAL:** favorites deletion and retention policy; recently viewed retention/expiry and deletion policy; account-deletion and business-archival/deletion behavior.

**OPEN — LEGAL APPROVAL:** legal-hold scope, mandatory retention exceptions, and any verified early-deletion rule.

## 6. Workflow and security requirements

### PROPOSED TECHNICAL DESIGN

- Status transitions must be backend-controlled. Database status checks validate vocabulary, but do not complete transition authorization.
- Moderation, approval, rejection, suspension, launch, deletion, and legal-hold decisions must record an audit actor, timestamp, and reason where the applicable workflow requires it.
- Public business visibility must require the appropriate approval state and publication eligibility, and must exclude suspended or deleted businesses.
- D30 inquiry ownership must enforce exactly one owner: an authenticated customer through `user_id` or an OTP-verified guest through `guest_identity_id`. Business ownership and inquiry assignment are separate authorization concepts and must not be substituted for inquiry ownership.
- D31 and D32 message identity must enforce exactly one human sender per inquiry message: an authenticated user or a guest inquiry session. The guest session must belong to the same inquiry. System-generated workflow events and notifications remain separate from human-authored inquiry messages, and system events must not trigger guest message-token rotation.
- D34 guest notification identity and authorization must use the reusable guest identity as the durable notification recipient. Every inquiry-related notification must carry explicit inquiry/resource scope. An active inquiry-scoped guest session provides temporary read authorization; guest identity alone never grants cross-inquiry access. Session expiry does not delete notifications; a fresh OTP may establish a new session for the same guest identity and inquiry; revoked sessions immediately lose authorization; and read/unread state belongs to the notification recipient record, not the guest session.
- Feature-flag and launch-approval checks must be enforced server-side. Feature-flag changes must link to the relevant launch approval and preserve references to the previous and new configuration, actor, and timestamp. Snapshot representation and rollback mechanics remain open technical details.
- D23 and D25 database security requires that the runtime database role not own protected tables and not have `BYPASSRLS`. Protected operations must use server-validated transaction-local identity context on the same connection and transaction. Missing or invalid context must deny protected access when RLS is implemented. Custom transaction-local configuration is context propagation, not cryptographic authentication.
- RLS and transaction-local identity context remain required security implementation work. Missing identity context must deny protected access when policies are implemented.
- OTP limits, token rotation, idempotency, and concurrent-request behavior require backend transactional enforcement and security testing.
- Deletion workflows must respect legal holds, approved retention requirements, verification, auditability, and controlled processing.

Database constraints are necessary integrity controls, but they do not replace backend authorization, RLS policy design, audit enforcement, or security review.

## 7. Migration reconciliation

The current inspection baseline is:

| Item | Current baseline |
| --- | --- |
| Current migration inventory | 39 tables |
| `favorites` | Missing |
| `recently_viewed` | Missing |
| `message_idempotency` | Present |
| Expected inventory after adding both approved MVP entities | 41 tables, subject to final inventory verification |
| Migration execution | Not executed |
| PostgreSQL database | Untouched |

### PROPOSED TECHNICAL DESIGN

Before controlled execution review, the migration will eventually require:

1. Add `favorites` with the conceptual columns, composite primary key, foreign keys, and user lookup index above.
2. Add `recently_viewed` with the conceptual columns, composite primary key, foreign keys, and `(user_id, last_viewed_at DESC)` index above.
3. Reconcile the migration's current status checks with the approved vocabularies in this addendum, while retaining separate deletion and publication concepts.
4. Verify that message idempotency, D30 owner XOR, D31/D32 sender XOR and same-inquiry guest sessions, D34 notification recipient and inquiry scoping, legal-hold fields, and restrictive deletion behavior remain intact.
5. Perform final inventory, dependency-order, PostgreSQL syntax, constraint, index, RLS, and authorization validation.

No SQL is written in this addendum, and no migration is executed by this documentation change.

## 8. Remaining open items

- **OPEN — OWNER DECISION REQUIRED:** favorites deletion and retention behavior.
- **OPEN — OWNER DECISION REQUIRED:** recently viewed retention, expiry, and deletion behavior.
- **OPEN — OWNER DECISION REQUIRED:** exact transition graphs and permitted actors for each workflow.
- **OPEN — OWNER DECISION REQUIRED:** submission and verification lifecycle enforcement details.
- **OPEN — OWNER DECISION REQUIRED:** report resolution requirements, evidence, and closure behavior.
- **OPEN — OWNER DECISION REQUIRED:** launch approval rollback mechanics and supersession behavior.
- **OPEN — SECURITY REVIEW:** RLS policy implementation, transaction-local identity context, database role privileges, and connection-pool context safety.
- **OPEN — VALIDATION:** authorization and concurrency testing for messages, idempotency, OTPs, sessions, and token rotation.
- **OPEN — VALIDATION:** audit enforcement for moderation, approval, launch, deletion, legal holds, and retention operations.
- **OPEN — LEGAL APPROVAL:** legal-hold handling, mandatory retention, and verified early deletion requirements.
- **OPEN — OWNER DECISION REQUIRED:** whether optional `recently_viewed.view_count` is required by the product.

The public launch and public write capabilities remain disabled until the approved launch and security controls are implemented and validated.
