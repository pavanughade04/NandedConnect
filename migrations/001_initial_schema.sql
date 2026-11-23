BEGIN;

-- NandedConnect initial schema for PostgreSQL 18 / nandedconnect_dev.
-- Documentation-only migration artifact: do not execute without the required
-- security, legal/privacy, migration, and operational reviews.
--
-- Safety boundary: this file uses only public-schema objects. It deliberately
-- creates no extensions, roles, users, passwords, secrets, or RLS policies.
-- UUID primary keys are supplied by the application as UUIDv4 values. The
-- approved gen_random_uuid() default is deferred because this migration is not
-- allowed to create an extension; choosing an extension/default is OPEN — VALIDATION.

-- ---------------------------------------------------------------------------
-- Identity and authorization
-- ---------------------------------------------------------------------------

CREATE TABLE public.users (
    id uuid PRIMARY KEY,
    email_normalized text NOT NULL UNIQUE,
    password_hash text,
    status text NOT NULL DEFAULT 'pending',
    email_verified_at timestamptz,
    deletion_requested_at timestamptz,
    deleted_at timestamptz,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    CONSTRAINT users_status_ck CHECK (status IN ('pending', 'active', 'suspended', 'deletion_requested', 'deleted')),
    CONSTRAINT users_password_hash_ck CHECK (password_hash IS NULL OR length(password_hash) > 0),
    CONSTRAINT users_deleted_state_ck CHECK (status <> 'deleted' OR deleted_at IS NOT NULL)
);

CREATE INDEX users_status_idx ON public.users (status);
CREATE INDEX users_deletion_idx ON public.users (deletion_requested_at) WHERE deletion_requested_at IS NOT NULL;

CREATE TABLE public.user_profiles (
    user_id uuid PRIMARY KEY REFERENCES public.users (id) ON DELETE RESTRICT,
    display_name text,
    phone_encrypted bytea,
    phone_key_version text,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL
);

CREATE TABLE public.roles (
    id uuid PRIMARY KEY,
    code text NOT NULL UNIQUE,
    description text,
    created_at timestamptz NOT NULL
);

CREATE TABLE public.user_roles (
    user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    role_id uuid NOT NULL REFERENCES public.roles (id) ON DELETE RESTRICT,
    assigned_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
    assigned_at timestamptz NOT NULL,
    revoked_at timestamptz,
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT user_roles_timestamps_ck CHECK (revoked_at IS NULL OR revoked_at >= assigned_at),
    CONSTRAINT user_roles_self_privilege_ck CHECK (assigned_by IS NULL OR assigned_by <> user_id)
);

CREATE INDEX user_roles_role_idx ON public.user_roles (role_id, revoked_at);
CREATE INDEX user_roles_assigned_by_idx ON public.user_roles (assigned_by) WHERE assigned_by IS NOT NULL;

CREATE TABLE public.sessions (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    token_hash bytea NOT NULL UNIQUE,
    created_at timestamptz NOT NULL,
    last_used_at timestamptz,
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    revocation_reason text,
    CONSTRAINT sessions_token_hash_len_ck CHECK (octet_length(token_hash) = 32),
    CONSTRAINT sessions_expiry_ck CHECK (expires_at > created_at),
    CONSTRAINT sessions_revocation_ck CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

CREATE INDEX sessions_user_active_idx ON public.sessions (user_id, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX sessions_expiry_idx ON public.sessions (expires_at);

CREATE TABLE public.password_reset_tokens (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    token_hash bytea NOT NULL UNIQUE,
    created_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    used_at timestamptz,
    revoked_at timestamptz,
    CONSTRAINT password_reset_token_hash_len_ck CHECK (octet_length(token_hash) = 32),
    CONSTRAINT password_reset_expiry_ck CHECK (expires_at > created_at),
    CONSTRAINT password_reset_single_use_ck CHECK (used_at IS NULL OR revoked_at IS NULL)
);

CREATE INDEX password_reset_user_expiry_idx ON public.password_reset_tokens (user_id, expires_at);

CREATE TABLE public.email_verification_tokens (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    token_hash bytea NOT NULL UNIQUE,
    created_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    used_at timestamptz,
    revoked_at timestamptz,
    CONSTRAINT email_verification_token_hash_len_ck CHECK (octet_length(token_hash) = 32),
    CONSTRAINT email_verification_expiry_ck CHECK (expires_at > created_at),
    CONSTRAINT email_verification_single_use_ck CHECK (used_at IS NULL OR revoked_at IS NULL)
);

CREATE INDEX email_verification_user_expiry_idx ON public.email_verification_tokens (user_id, expires_at);

-- ---------------------------------------------------------------------------
-- Directory, businesses, ownership, and verification
-- ---------------------------------------------------------------------------

CREATE TABLE public.categories (
    id uuid PRIMARY KEY,
    name text NOT NULL UNIQUE,
    slug text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL
);

CREATE TABLE public.localities (
    id uuid PRIMARY KEY,
    name text NOT NULL,
    slug text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL
);

CREATE TABLE public.businesses (
    id uuid PRIMARY KEY,
    category_id uuid REFERENCES public.categories (id) ON DELETE RESTRICT,
    locality_id uuid REFERENCES public.localities (id) ON DELETE RESTRICT,
    slug text NOT NULL UNIQUE,
    normalized_name text NOT NULL,
    description text,
    status text NOT NULL DEFAULT 'draft',
    published_at timestamptz,
    deletion_requested_at timestamptz,
    deleted_at timestamptz,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    CONSTRAINT businesses_status_ck CHECK (status IN ('draft', 'pending_review', 'verified', 'published', 'suspended', 'rejected', 'deleted')),
    CONSTRAINT businesses_deleted_state_ck CHECK (status <> 'deleted' OR deleted_at IS NOT NULL),
    CONSTRAINT businesses_publication_ck CHECK (published_at IS NULL OR status IN ('published', 'suspended'))
);

CREATE INDEX businesses_category_idx ON public.businesses (category_id) WHERE category_id IS NOT NULL;
CREATE INDEX businesses_locality_idx ON public.businesses (locality_id) WHERE locality_id IS NOT NULL;
CREATE INDEX businesses_status_idx ON public.businesses (status, updated_at);

CREATE TABLE public.business_contacts (
    id uuid PRIMARY KEY,
    business_id uuid NOT NULL REFERENCES public.businesses (id) ON DELETE RESTRICT,
    label text,
    phone text,
    email text,
    is_primary boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX business_contacts_one_primary_idx
    ON public.business_contacts (business_id) WHERE is_primary;
CREATE INDEX business_contacts_business_idx ON public.business_contacts (business_id);

CREATE TABLE public.business_locations (
    id uuid PRIMARY KEY,
    business_id uuid NOT NULL REFERENCES public.businesses (id) ON DELETE RESTRICT,
    address_line text NOT NULL,
    locality_id uuid REFERENCES public.localities (id) ON DELETE RESTRICT,
    latitude numeric(9,6),
    longitude numeric(9,6),
    is_primary boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    CONSTRAINT business_locations_latitude_ck CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    CONSTRAINT business_locations_longitude_ck CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);

CREATE UNIQUE INDEX business_locations_one_primary_idx
    ON public.business_locations (business_id) WHERE is_primary;
CREATE INDEX business_locations_business_idx ON public.business_locations (business_id);
CREATE INDEX business_locations_locality_idx ON public.business_locations (locality_id) WHERE locality_id IS NOT NULL;

CREATE TABLE public.business_hours (
    id uuid PRIMARY KEY,
    business_id uuid NOT NULL REFERENCES public.businesses (id) ON DELETE RESTRICT,
    day_of_week smallint NOT NULL,
    opens_at time,
    closes_at time,
    is_closed boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    CONSTRAINT business_hours_day_ck CHECK (day_of_week BETWEEN 0 AND 6),
    CONSTRAINT business_hours_closed_ck CHECK (is_closed OR (opens_at IS NOT NULL AND closes_at IS NOT NULL))
);

CREATE UNIQUE INDEX business_hours_business_day_idx ON public.business_hours (business_id, day_of_week);

CREATE TABLE public.business_services (
    id uuid PRIMARY KEY,
    business_id uuid NOT NULL REFERENCES public.businesses (id) ON DELETE RESTRICT,
    service_name text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX business_services_active_name_idx
    ON public.business_services (business_id, lower(service_name)) WHERE is_active;
CREATE INDEX business_services_business_idx ON public.business_services (business_id);

CREATE TABLE public.business_owners (
    id uuid PRIMARY KEY,
    business_id uuid NOT NULL REFERENCES public.businesses (id) ON DELETE RESTRICT,
    user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    relationship text NOT NULL,
    role text NOT NULL DEFAULT 'primary_owner',
    status text NOT NULL DEFAULT 'active',
    assigned_at timestamptz NOT NULL,
    revoked_at timestamptz,
    assigned_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT business_owners_status_ck CHECK (status IN ('active', 'revoked', 'pending')),
    CONSTRAINT business_owners_timestamps_ck CHECK (revoked_at IS NULL OR revoked_at >= assigned_at)
);

CREATE UNIQUE INDEX business_owners_one_primary_idx
    ON public.business_owners (business_id) WHERE role = 'primary_owner' AND status = 'active';
CREATE INDEX business_owners_user_idx ON public.business_owners (user_id, status);
CREATE INDEX business_owners_business_idx ON public.business_owners (business_id, status);

CREATE TABLE public.business_memberships (
    id uuid PRIMARY KEY,
    business_id uuid NOT NULL REFERENCES public.businesses (id) ON DELETE RESTRICT,
    user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    role text NOT NULL,
    status text NOT NULL DEFAULT 'invited',
    invited_at timestamptz,
    accepted_at timestamptz,
    revoked_at timestamptz,
    assigned_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    CONSTRAINT business_memberships_status_ck CHECK (status IN ('invited', 'active', 'revoked', 'expired')),
    CONSTRAINT business_memberships_timestamps_ck CHECK (revoked_at IS NULL OR accepted_at IS NULL OR revoked_at >= accepted_at)
);

CREATE UNIQUE INDEX business_memberships_active_idx
    ON public.business_memberships (business_id, user_id, role) WHERE status = 'active';
CREATE INDEX business_memberships_business_idx ON public.business_memberships (business_id, status);
CREATE INDEX business_memberships_user_idx ON public.business_memberships (user_id, status);

CREATE TABLE public.guest_identities (
    id uuid PRIMARY KEY,
    phone_lookup_key text NOT NULL UNIQUE,
    contact_encrypted bytea,
    contact_key_version text,
    verification_status text NOT NULL DEFAULT 'unverified',
    verified_at timestamptz,
    lifecycle_state text NOT NULL DEFAULT 'active',
    otp_resend_window_started_at timestamptz,
    otp_resend_count smallint NOT NULL DEFAULT 0,
    otp_cooldown_until timestamptz,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    CONSTRAINT guest_identity_verification_ck CHECK (verification_status IN ('unverified', 'verified', 'suspended')),
    CONSTRAINT guest_identity_lifecycle_ck CHECK (lifecycle_state IN ('active', 'deletion_requested', 'deleted')),
    CONSTRAINT guest_identity_verified_at_ck CHECK (verification_status <> 'verified' OR verified_at IS NOT NULL),
    CONSTRAINT guest_identity_resend_count_ck CHECK (otp_resend_count BETWEEN 0 AND 5)
);

CREATE INDEX guest_identities_lifecycle_idx ON public.guest_identities (lifecycle_state, verification_status);

CREATE TABLE public.verification_requests (
    id uuid PRIMARY KEY,
    business_id uuid NOT NULL REFERENCES public.businesses (id) ON DELETE RESTRICT,
    requester_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    verification_type text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    phone_otp_verified_at timestamptz,
    reviewer_user_id uuid REFERENCES public.users (id) ON DELETE RESTRICT,
    decision_reason text,
    submitted_at timestamptz,
    reviewed_at timestamptz,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    CONSTRAINT verification_requests_status_ck CHECK (status IN ('pending', 'in_review', 'approved', 'rejected', 'needs_changes')),
    CONSTRAINT verification_requests_review_ck CHECK (status NOT IN ('approved', 'rejected') OR (reviewer_user_id IS NOT NULL AND reviewed_at IS NOT NULL))
);

CREATE INDEX verification_requests_business_status_idx ON public.verification_requests (business_id, status);
CREATE INDEX verification_requests_requester_idx ON public.verification_requests (requester_user_id, status);

CREATE TABLE public.verification_documents (
    id uuid PRIMARY KEY,
    verification_request_id uuid NOT NULL REFERENCES public.verification_requests (id) ON DELETE RESTRICT,
    uploader_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    object_key text NOT NULL UNIQUE,
    checksum bytea NOT NULL,
    mime_type text NOT NULL,
    byte_size bigint NOT NULL,
    evidence_type text NOT NULL,
    lifecycle_status text NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL,
    deleted_at timestamptz,
    CONSTRAINT verification_documents_size_ck CHECK (byte_size > 0),
    CONSTRAINT verification_documents_lifecycle_ck CHECK (lifecycle_status IN ('active', 'deleted', 'retained'))
);

CREATE INDEX verification_documents_request_idx ON public.verification_documents (verification_request_id, lifecycle_status);

CREATE TABLE public.ownership_claims (
    id uuid PRIMARY KEY,
    business_id uuid NOT NULL REFERENCES public.businesses (id) ON DELETE RESTRICT,
    claimant_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    reviewer_user_id uuid REFERENCES public.users (id) ON DELETE RESTRICT,
    verification_request_id uuid REFERENCES public.verification_requests (id) ON DELETE RESTRICT,
    status text NOT NULL DEFAULT 'pending',
    decision_reason text,
    submitted_at timestamptz NOT NULL,
    decided_at timestamptz,
    CONSTRAINT ownership_claims_status_ck CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
    CONSTRAINT ownership_claims_decision_ck CHECK (status = 'pending' OR (reviewer_user_id IS NOT NULL AND decided_at IS NOT NULL))
);

CREATE INDEX ownership_claims_business_status_idx ON public.ownership_claims (business_id, status);
CREATE INDEX ownership_claims_claimant_idx ON public.ownership_claims (claimant_user_id, status);

CREATE TABLE public.business_submissions (
    id uuid PRIMARY KEY,
    submitting_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    business_id uuid REFERENCES public.businesses (id) ON DELETE RESTRICT,
    status text NOT NULL DEFAULT 'draft',
    submitted_at timestamptz,
    reviewed_at timestamptz,
    reviewed_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
    decision_reason text,
    snapshot jsonb NOT NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    CONSTRAINT business_submissions_status_ck CHECK (status IN ('draft', 'submitted', 'in_review', 'approved', 'rejected', 'needs_changes'))
);

CREATE INDEX business_submissions_business_status_idx ON public.business_submissions (business_id, status);
CREATE INDEX business_submissions_submitter_idx ON public.business_submissions (submitting_user_id, status);

-- ---------------------------------------------------------------------------
-- Guest OTP, inquiries, assignments, and messages
-- ---------------------------------------------------------------------------

CREATE TABLE public.guest_otp_challenges (
    id uuid PRIMARY KEY,
    guest_identity_id uuid NOT NULL REFERENCES public.guest_identities (id) ON DELETE RESTRICT,
    otp_hash bytea NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    attempt_count smallint NOT NULL DEFAULT 0,
    max_attempts smallint NOT NULL DEFAULT 5,
    last_resend_at timestamptz,
    resend_count smallint NOT NULL DEFAULT 0,
    resend_window_started_at timestamptz,
    cooldown_until timestamptz,
    verified_at timestamptz,
    consumed_at timestamptz,
    updated_at timestamptz NOT NULL,
    CONSTRAINT guest_otp_status_ck CHECK (status IN ('pending', 'verified', 'consumed', 'expired', 'locked')),
    CONSTRAINT guest_otp_hash_len_ck CHECK (octet_length(otp_hash) >= 16),
    CONSTRAINT guest_otp_expiry_ck CHECK (expires_at > created_at),
    CONSTRAINT guest_otp_attempts_ck CHECK (attempt_count BETWEEN 0 AND 5 AND max_attempts = 5),
    CONSTRAINT guest_otp_resends_ck CHECK (resend_count BETWEEN 0 AND 5),
    CONSTRAINT guest_otp_lifecycle_ck CHECK (
        (status IN ('verified', 'consumed') AND verified_at IS NOT NULL)
        OR status IN ('pending', 'expired', 'locked')
    ),
    CONSTRAINT guest_otp_consumed_ck CHECK (status <> 'consumed' OR consumed_at IS NOT NULL)
);

CREATE UNIQUE INDEX guest_otp_one_pending_idx
    ON public.guest_otp_challenges (guest_identity_id) WHERE status = 'pending';
CREATE INDEX guest_otp_expiry_idx ON public.guest_otp_challenges (expires_at, status);
CREATE INDEX guest_otp_guest_status_idx ON public.guest_otp_challenges (guest_identity_id, status, created_at);

-- The service must lock the guest identity and challenge when issuing or
-- resending OTPs: expires_at is five minutes after creation, cooldown_until
-- enforces 60 seconds, and the guest-identity window enforces five resends per
-- phone per hour. These time/rate checks require application transaction logic
-- and security validation; the schema stores the state and prevents negatives.

-- D30: exactly one authenticated customer OR reusable guest identity.
CREATE TABLE public.inquiries (
    id uuid PRIMARY KEY,
    business_id uuid NOT NULL REFERENCES public.businesses (id) ON DELETE RESTRICT,
    customer_user_id uuid REFERENCES public.users (id) ON DELETE RESTRICT,
    guest_identity_id uuid REFERENCES public.guest_identities (id) ON DELETE RESTRICT,
    subject text NOT NULL,
    body text,
    status text NOT NULL DEFAULT 'open',
    last_activity_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    deleted_at timestamptz,
    CONSTRAINT inquiries_owner_xor_ck CHECK ((customer_user_id IS NOT NULL) <> (guest_identity_id IS NOT NULL)),
    CONSTRAINT inquiries_status_ck CHECK (status IN ('open', 'pending', 'resolved', 'closed', 'deleted')),
    CONSTRAINT inquiries_deleted_state_ck CHECK (status <> 'deleted' OR deleted_at IS NOT NULL),
    CONSTRAINT inquiries_id_guest_identity_key UNIQUE (id, guest_identity_id),
    CONSTRAINT inquiries_id_business_key UNIQUE (id, business_id)
);

CREATE INDEX inquiries_business_activity_idx ON public.inquiries (business_id, status, last_activity_at DESC);
CREATE INDEX inquiries_customer_status_idx ON public.inquiries (customer_user_id, status) WHERE customer_user_id IS NOT NULL;
CREATE INDEX inquiries_guest_activity_idx ON public.inquiries (guest_identity_id, status, last_activity_at DESC) WHERE guest_identity_id IS NOT NULL;

CREATE TABLE public.inquiry_assignments (
    id uuid PRIMARY KEY,
    manager_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    business_id uuid NOT NULL REFERENCES public.businesses (id) ON DELETE RESTRICT,
    inquiry_id uuid NOT NULL,
    status text NOT NULL DEFAULT 'active',
    assigned_at timestamptz NOT NULL,
    revoked_at timestamptz,
    assigned_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    CONSTRAINT inquiry_assignments_inquiry_business_fk
        FOREIGN KEY (inquiry_id, business_id)
        REFERENCES public.inquiries (id, business_id) ON DELETE RESTRICT,
    CONSTRAINT inquiry_assignments_status_ck CHECK (status IN ('active', 'revoked', 'pending')),
    CONSTRAINT inquiry_assignments_timestamps_ck CHECK (revoked_at IS NULL OR revoked_at >= assigned_at)
);

-- TODO (OPEN — OWNER APPROVAL): active business membership plus inquiry
-- assignment is an authorization rule. The composite FK enforces business
-- identity matching, while the reviewed application/RLS path must enforce that
-- membership status is active; manager counts and conflict rules remain open.

CREATE UNIQUE INDEX inquiry_assignments_active_idx
    ON public.inquiry_assignments (inquiry_id, manager_user_id) WHERE status = 'active';
CREATE INDEX inquiry_assignments_manager_idx ON public.inquiry_assignments (manager_user_id, business_id, status);
CREATE INDEX inquiry_assignments_inquiry_idx ON public.inquiry_assignments (inquiry_id, status);
CREATE INDEX inquiry_assignments_business_idx ON public.inquiry_assignments (business_id, status);

CREATE TABLE public.guest_inquiry_sessions (
    id uuid PRIMARY KEY,
    guest_identity_id uuid NOT NULL,
    inquiry_id uuid NOT NULL,
    token_hash bytea NOT NULL UNIQUE,
    token_version bigint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL,
    last_used_at timestamptz,
    inactivity_expires_at timestamptz NOT NULL,
    absolute_expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    revocation_reason text,
    CONSTRAINT guest_sessions_guest_fk FOREIGN KEY (guest_identity_id)
        REFERENCES public.guest_identities (id) ON DELETE RESTRICT,
    CONSTRAINT guest_sessions_inquiry_fk FOREIGN KEY (inquiry_id)
        REFERENCES public.inquiries (id) ON DELETE RESTRICT,
    -- D34/D30 scope: a session's guest must own the same inquiry.
    CONSTRAINT guest_sessions_guest_inquiry_fk FOREIGN KEY (inquiry_id, guest_identity_id)
        REFERENCES public.inquiries (id, guest_identity_id) ON DELETE RESTRICT,
    CONSTRAINT guest_sessions_token_hash_len_ck CHECK (octet_length(token_hash) = 32),
    CONSTRAINT guest_sessions_version_ck CHECK (token_version >= 0),
    CONSTRAINT guest_sessions_expiry_ck CHECK (absolute_expires_at > created_at AND inactivity_expires_at <= absolute_expires_at),
    CONSTRAINT guest_sessions_revocation_ck CHECK (revoked_at IS NULL OR revoked_at >= created_at),
    CONSTRAINT guest_sessions_id_inquiry_key UNIQUE (id, inquiry_id),
    CONSTRAINT guest_sessions_id_guest_key UNIQUE (id, guest_identity_id)
);

CREATE INDEX guest_sessions_guest_inquiry_idx ON public.guest_inquiry_sessions (guest_identity_id, inquiry_id);
CREATE INDEX guest_sessions_active_inquiry_idx ON public.guest_inquiry_sessions (inquiry_id, revoked_at, absolute_expires_at);
CREATE INDEX guest_sessions_expiry_idx ON public.guest_inquiry_sessions (inactivity_expires_at, absolute_expires_at);

-- D31: exactly one authenticated user OR guest inquiry session sender.
CREATE TABLE public.inquiry_messages (
    id uuid PRIMARY KEY,
    inquiry_id uuid NOT NULL REFERENCES public.inquiries (id) ON DELETE RESTRICT,
    sender_user_id uuid REFERENCES public.users (id) ON DELETE RESTRICT,
    sender_guest_session_id uuid,
    -- Non-null polymorphic sender key used by message idempotency integrity.
    -- The sender XOR check below guarantees exactly one source value exists.
    sender_actor_key text GENERATED ALWAYS AS (
        CASE
            WHEN sender_user_id IS NOT NULL THEN 'user:' || sender_user_id::text
            ELSE 'guest:' || sender_guest_session_id::text
        END
    ) STORED,
    message_body text NOT NULL,
    idempotency_key text NOT NULL,
    created_at timestamptz NOT NULL,
    read_at timestamptz,
    redacted_at timestamptz,
    redaction_reason text,
    CONSTRAINT inquiry_messages_sender_xor_ck CHECK ((sender_user_id IS NOT NULL) <> (sender_guest_session_id IS NOT NULL)),
    -- D31: a guest sender must belong to this same inquiry.
    CONSTRAINT inquiry_messages_guest_scope_fk FOREIGN KEY (sender_guest_session_id, inquiry_id)
        REFERENCES public.guest_inquiry_sessions (id, inquiry_id) ON DELETE RESTRICT,
    CONSTRAINT inquiry_messages_body_ck CHECK (length(btrim(message_body)) > 0),
    CONSTRAINT inquiry_messages_idempotency_key_ck CHECK (length(idempotency_key) BETWEEN 1 AND 200),
    CONSTRAINT inquiry_messages_actor_key_ck CHECK (sender_actor_key IS NOT NULL),
    CONSTRAINT inquiry_messages_id_inquiry_key UNIQUE (id, inquiry_id),
    CONSTRAINT inquiry_messages_id_inquiry_actor_key UNIQUE (id, inquiry_id, sender_actor_key)
);

CREATE INDEX inquiry_messages_inquiry_created_idx ON public.inquiry_messages (inquiry_id, created_at, id);
CREATE INDEX inquiry_messages_sender_user_idx ON public.inquiry_messages (sender_user_id) WHERE sender_user_id IS NOT NULL;
CREATE INDEX inquiry_messages_sender_guest_session_idx ON public.inquiry_messages (sender_guest_session_id) WHERE sender_guest_session_id IS NOT NULL;

-- Durable idempotency state. Raw tokens are never stored; the response token
-- can only be delivered on the original response path. Retry response details
-- remain OPEN — OWNER APPROVAL and must be implemented by the service layer.
CREATE TABLE public.message_idempotency (
    id uuid PRIMARY KEY,
    guest_session_id uuid REFERENCES public.guest_inquiry_sessions (id) ON DELETE RESTRICT,
    authenticated_user_id uuid REFERENCES public.users (id) ON DELETE RESTRICT,
    inquiry_id uuid NOT NULL REFERENCES public.inquiries (id) ON DELETE RESTRICT,
    idempotency_key text NOT NULL,
    request_fingerprint bytea NOT NULL,
    message_id uuid NOT NULL REFERENCES public.inquiry_messages (id) ON DELETE RESTRICT,
    -- Generated from the same sender XOR representation as inquiry_messages;
    -- this avoids nullable composite-FK columns silently skipping validation.
    sender_actor_key text GENERATED ALWAYS AS (
        CASE
            WHEN authenticated_user_id IS NOT NULL THEN 'user:' || authenticated_user_id::text
            ELSE 'guest:' || guest_session_id::text
        END
    ) STORED,
    result_token_version bigint,
    result_token_hash bytea,
    created_at timestamptz NOT NULL,
    CONSTRAINT message_idempotency_actor_xor_ck CHECK ((guest_session_id IS NOT NULL) <> (authenticated_user_id IS NOT NULL)),
    CONSTRAINT message_idempotency_actor_key_ck CHECK (sender_actor_key IS NOT NULL),
    CONSTRAINT message_idempotency_message_inquiry_fk
        FOREIGN KEY (message_id, inquiry_id)
        REFERENCES public.inquiry_messages (id, inquiry_id) ON DELETE RESTRICT,
    CONSTRAINT message_idempotency_guest_inquiry_fk
        FOREIGN KEY (guest_session_id, inquiry_id)
        REFERENCES public.guest_inquiry_sessions (id, inquiry_id) ON DELETE RESTRICT,
    -- The non-null actor key makes sender matching fully declarative for both
    -- authenticated and guest actors; no nullable actor column is used here.
    CONSTRAINT message_idempotency_message_actor_fk
        FOREIGN KEY (message_id, inquiry_id, sender_actor_key)
        REFERENCES public.inquiry_messages (id, inquiry_id, sender_actor_key) ON DELETE RESTRICT,
    CONSTRAINT message_idempotency_token_result_ck CHECK (result_token_hash IS NULL OR octet_length(result_token_hash) = 32),
    CONSTRAINT message_idempotency_version_ck CHECK (result_token_version IS NULL OR result_token_version >= 0),
    CONSTRAINT message_idempotency_key_ck CHECK (length(idempotency_key) BETWEEN 1 AND 200)
);

CREATE UNIQUE INDEX message_idempotency_guest_scope_idx
    ON public.message_idempotency (guest_session_id, idempotency_key) WHERE guest_session_id IS NOT NULL;
CREATE UNIQUE INDEX message_idempotency_user_scope_idx
    ON public.message_idempotency (authenticated_user_id, inquiry_id, idempotency_key) WHERE authenticated_user_id IS NOT NULL;
CREATE INDEX message_idempotency_message_idx ON public.message_idempotency (message_id);

CREATE TABLE public.reviews (
    id uuid PRIMARY KEY,
    business_id uuid NOT NULL REFERENCES public.businesses (id) ON DELETE RESTRICT,
    customer_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    rating smallint NOT NULL,
    body text,
    display_name_snapshot text NOT NULL,
    moderation_status text NOT NULL DEFAULT 'pending',
    moderated_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
    moderated_at timestamptz,
    moderation_reason text,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    deleted_at timestamptz,
    CONSTRAINT reviews_rating_ck CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT reviews_moderation_status_ck CHECK (moderation_status IN ('pending', 'published', 'rejected', 'removed'))
);

CREATE UNIQUE INDEX reviews_one_active_per_customer_business_idx
    ON public.reviews (business_id, customer_user_id) WHERE deleted_at IS NULL;
CREATE INDEX reviews_business_moderation_idx ON public.reviews (business_id, moderation_status, created_at);

CREATE TABLE public.review_reports (
    id uuid PRIMARY KEY,
    review_id uuid NOT NULL REFERENCES public.reviews (id) ON DELETE RESTRICT,
    reporter_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    reason text NOT NULL,
    status text NOT NULL DEFAULT 'open',
    resolution text,
    resolved_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL,
    resolved_at timestamptz,
    CONSTRAINT review_reports_status_ck CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
    CONSTRAINT review_reports_resolution_ck CHECK (status IN ('open', 'reviewing') OR resolved_at IS NOT NULL)
);

CREATE UNIQUE INDEX review_reports_reporter_review_idx ON public.review_reports (review_id, reporter_user_id);
CREATE INDEX review_reports_review_status_idx ON public.review_reports (review_id, status);

CREATE TABLE public.reports (
    id uuid PRIMARY KEY,
    reporter_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    business_id uuid REFERENCES public.businesses (id) ON DELETE RESTRICT,
    review_id uuid REFERENCES public.reviews (id) ON DELETE RESTRICT,
    inquiry_id uuid REFERENCES public.inquiries (id) ON DELETE RESTRICT,
    reason text NOT NULL,
    status text NOT NULL DEFAULT 'open',
    resolution text,
    resolved_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL,
    resolved_at timestamptz,
    CONSTRAINT reports_one_target_ck CHECK (num_nonnulls(business_id, review_id, inquiry_id) = 1),
    CONSTRAINT reports_status_ck CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
    CONSTRAINT reports_resolution_ck CHECK (status IN ('open', 'reviewing') OR resolved_at IS NOT NULL)
);

CREATE INDEX reports_business_idx ON public.reports (business_id, status) WHERE business_id IS NOT NULL;
CREATE INDEX reports_review_idx ON public.reports (review_id, status) WHERE review_id IS NOT NULL;
CREATE INDEX reports_inquiry_idx ON public.reports (inquiry_id, status) WHERE inquiry_id IS NOT NULL;

CREATE TABLE public.business_media (
    id uuid PRIMARY KEY,
    business_id uuid NOT NULL REFERENCES public.businesses (id) ON DELETE RESTRICT,
    object_key text NOT NULL UNIQUE,
    checksum bytea NOT NULL,
    mime_type text NOT NULL,
    byte_size bigint NOT NULL,
    lifecycle_state text NOT NULL DEFAULT 'active',
    uploader_user_id uuid REFERENCES public.users (id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    deleted_at timestamptz,
    CONSTRAINT business_media_size_ck CHECK (byte_size > 0),
    CONSTRAINT business_media_lifecycle_ck CHECK (lifecycle_state IN ('active', 'deleted', 'retained'))
);

CREATE INDEX business_media_business_lifecycle_idx ON public.business_media (business_id, lifecycle_state, created_at);

-- ---------------------------------------------------------------------------
-- Events, notifications, launch controls, deletion, and audit
-- ---------------------------------------------------------------------------

CREATE TABLE public.system_events (
    id uuid PRIMARY KEY,
    event_type text NOT NULL,
    inquiry_id uuid REFERENCES public.inquiries (id) ON DELETE RESTRICT,
    business_id uuid REFERENCES public.businesses (id) ON DELETE RESTRICT,
    account_user_id uuid REFERENCES public.users (id) ON DELETE RESTRICT,
    actor_user_id uuid REFERENCES public.users (id) ON DELETE RESTRICT,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    occurred_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL,
    correlation_id uuid NOT NULL,
    idempotency_key text NOT NULL,
    visibility text NOT NULL DEFAULT 'private',
    CONSTRAINT system_events_visibility_ck CHECK (visibility IN ('private', 'customer', 'owner', 'manager', 'admin')),
    CONSTRAINT system_events_payload_ck CHECK (jsonb_typeof(payload) = 'object')
);

CREATE UNIQUE INDEX system_events_idempotency_idx
    ON public.system_events (correlation_id, idempotency_key);
CREATE INDEX system_events_inquiry_occurred_idx ON public.system_events (inquiry_id, occurred_at, id);
CREATE INDEX system_events_business_occurred_idx ON public.system_events (business_id, occurred_at, id);

CREATE TABLE public.notifications (
    id uuid PRIMARY KEY,
    system_event_id uuid REFERENCES public.system_events (id) ON DELETE RESTRICT,
    source_message_id uuid REFERENCES public.inquiry_messages (id) ON DELETE RESTRICT,
    recipient_user_id uuid REFERENCES public.users (id) ON DELETE RESTRICT,
    recipient_guest_identity_id uuid REFERENCES public.guest_identities (id) ON DELETE RESTRICT,
    inquiry_id uuid REFERENCES public.inquiries (id) ON DELETE RESTRICT,
    notification_type text NOT NULL,
    read_at timestamptz,
    delivery_state text NOT NULL DEFAULT 'pending',
    delivered_at timestamptz,
    created_at timestamptz NOT NULL,
    idempotency_key text NOT NULL,
    CONSTRAINT notifications_recipient_xor_ck CHECK ((recipient_user_id IS NOT NULL) <> (recipient_guest_identity_id IS NOT NULL)),
    -- D34: guest notifications must have an explicit inquiry scope.
    CONSTRAINT notifications_guest_scope_ck CHECK (recipient_guest_identity_id IS NULL OR inquiry_id IS NOT NULL),
    CONSTRAINT notifications_guest_inquiry_fk FOREIGN KEY (inquiry_id, recipient_guest_identity_id)
        REFERENCES public.inquiries (id, guest_identity_id) ON DELETE RESTRICT,
    CONSTRAINT notifications_source_ck CHECK (system_event_id IS NOT NULL OR source_message_id IS NOT NULL),
    CONSTRAINT notifications_delivery_state_ck CHECK (delivery_state IN ('pending', 'delivered', 'failed', 'read')),
    CONSTRAINT notifications_delivery_timestamp_ck CHECK (delivered_at IS NULL OR delivery_state IN ('delivered', 'read'))
);

CREATE UNIQUE INDEX notifications_user_idempotency_idx
    ON public.notifications (recipient_user_id, idempotency_key) WHERE recipient_user_id IS NOT NULL;
CREATE UNIQUE INDEX notifications_guest_idempotency_idx
    ON public.notifications (recipient_guest_identity_id, inquiry_id, idempotency_key) WHERE recipient_guest_identity_id IS NOT NULL;
CREATE INDEX notifications_user_read_idx ON public.notifications (recipient_user_id, read_at, created_at) WHERE recipient_user_id IS NOT NULL;
CREATE INDEX notifications_guest_scope_read_idx ON public.notifications (recipient_guest_identity_id, inquiry_id, read_at, created_at) WHERE recipient_guest_identity_id IS NOT NULL;
CREATE INDEX notifications_event_idx ON public.notifications (system_event_id) WHERE system_event_id IS NOT NULL;
CREATE INDEX notifications_message_idx ON public.notifications (source_message_id) WHERE source_message_id IS NOT NULL;

CREATE TABLE public.feature_flags (
    id uuid PRIMARY KEY,
    key text NOT NULL,
    environment text NOT NULL,
    enabled boolean NOT NULL DEFAULT false,
    configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    CONSTRAINT feature_flags_configuration_ck CHECK (jsonb_typeof(configuration) = 'object'),
    CONSTRAINT feature_flags_environment_ck CHECK (environment IN ('local', 'staging', 'production')),
    CONSTRAINT feature_flags_key_ck CHECK (length(key) BETWEEN 1 AND 200),
    CONSTRAINT feature_flags_environment_key_uk UNIQUE (environment, key)
);

CREATE TABLE public.launch_approvals (
    id uuid PRIMARY KEY,
    approver_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    approved_at timestamptz NOT NULL,
    environment text NOT NULL,
    launch_scope text NOT NULL,
    approved_flags jsonb NOT NULL,
    previous_configuration jsonb,
    new_configuration jsonb,
    rollback_reference text,
    status text NOT NULL DEFAULT 'approved',
    created_at timestamptz NOT NULL,
    CONSTRAINT launch_approvals_environment_ck CHECK (environment IN ('local', 'staging', 'production')),
    CONSTRAINT launch_approvals_status_ck CHECK (status IN ('pending', 'approved', 'revoked', 'superseded')),
    CONSTRAINT launch_approvals_flags_ck CHECK (jsonb_typeof(approved_flags) = 'object')
);

CREATE INDEX launch_approvals_environment_status_idx ON public.launch_approvals (environment, status, approved_at DESC);

CREATE TABLE public.feature_flag_changes (
    id uuid PRIMARY KEY,
    feature_flag_id uuid NOT NULL REFERENCES public.feature_flags (id) ON DELETE RESTRICT,
    changed_by uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    launch_approval_id uuid REFERENCES public.launch_approvals (id) ON DELETE RESTRICT,
    old_config jsonb NOT NULL,
    new_config jsonb NOT NULL,
    reason text,
    changed_at timestamptz NOT NULL,
    CONSTRAINT feature_flag_changes_old_config_ck CHECK (jsonb_typeof(old_config) = 'object'),
    CONSTRAINT feature_flag_changes_new_config_ck CHECK (jsonb_typeof(new_config) = 'object')
);

CREATE INDEX feature_flag_changes_history_idx ON public.feature_flag_changes (feature_flag_id, changed_at DESC);
CREATE INDEX feature_flag_changes_approval_idx ON public.feature_flag_changes (launch_approval_id) WHERE launch_approval_id IS NOT NULL;

CREATE TABLE public.deletion_requests (
    id uuid PRIMARY KEY,
    request_type text NOT NULL,
    requester_user_id uuid REFERENCES public.users (id) ON DELETE RESTRICT,
    requester_guest_identity_id uuid REFERENCES public.guest_identities (id) ON DELETE RESTRICT,
    target_user_id uuid REFERENCES public.users (id) ON DELETE RESTRICT,
    target_inquiry_id uuid REFERENCES public.inquiries (id) ON DELETE RESTRICT,
    target_guest_identity_id uuid REFERENCES public.guest_identities (id) ON DELETE RESTRICT,
    otp_verified_at timestamptz,
    status text NOT NULL DEFAULT 'Pending',
    legal_hold boolean NOT NULL DEFAULT false,
    mandatory_retention_exception boolean NOT NULL DEFAULT false,
    legal_hold_reason text,
    submitted_at timestamptz NOT NULL,
    verified_at timestamptz,
    processing_at timestamptz,
    completed_at timestamptz,
    rejected_at timestamptz,
    rejection_reason text,
    audit_actor_user_id uuid REFERENCES public.users (id) ON DELETE RESTRICT,
    correlation_id uuid NOT NULL,
    CONSTRAINT deletion_request_requester_xor_ck CHECK ((requester_user_id IS NOT NULL) <> (requester_guest_identity_id IS NOT NULL)),
    CONSTRAINT deletion_request_target_xor_ck CHECK (num_nonnulls(target_user_id, target_inquiry_id, target_guest_identity_id) = 1),
    CONSTRAINT deletion_request_type_ck CHECK (request_type IN ('account', 'inquiry', 'guest_identity')),
    CONSTRAINT deletion_request_status_ck CHECK (status IN ('Pending', 'Verified', 'Processing', 'Completed', 'Rejected')),
    CONSTRAINT deletion_request_otp_ck CHECK (requester_guest_identity_id IS NULL OR otp_verified_at IS NOT NULL)
);

-- TODO (OPEN — OWNER APPROVAL): whether a request may be marked Completed
-- while a legal hold or mandatory-retention exception leaves some data intact
-- belongs to the approved deletion workflow, not this physical schema.

CREATE INDEX deletion_requests_target_status_idx ON public.deletion_requests (target_user_id, status) WHERE target_user_id IS NOT NULL;
CREATE INDEX deletion_requests_inquiry_status_idx ON public.deletion_requests (target_inquiry_id, status) WHERE target_inquiry_id IS NOT NULL;
CREATE INDEX deletion_requests_guest_status_idx ON public.deletion_requests (target_guest_identity_id, status) WHERE target_guest_identity_id IS NOT NULL;
CREATE INDEX deletion_requests_processing_idx ON public.deletion_requests (status, processing_at);

CREATE TABLE public.audit_logs (
    id uuid PRIMARY KEY,
    actor_user_id uuid REFERENCES public.users (id) ON DELETE RESTRICT,
    actor_guest_identity_id uuid REFERENCES public.guest_identities (id) ON DELETE RESTRICT,
    session_id uuid REFERENCES public.guest_inquiry_sessions (id) ON DELETE RESTRICT,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id uuid,
    request_id uuid,
    before_data jsonb,
    after_data jsonb,
    created_at timestamptz NOT NULL,
    retention_class text NOT NULL,
    CONSTRAINT audit_logs_retention_ck CHECK (retention_class IN ('security_90_days', 'admin_12_months', 'legal_hold'))
);

-- TODO (OPEN — VALIDATION): actor representation for system jobs and whether
-- every audit row requires an actor must be defined with the RLS/job design.

CREATE INDEX audit_logs_resource_idx ON public.audit_logs (resource_type, resource_id, created_at);
CREATE INDEX audit_logs_action_time_idx ON public.audit_logs (action, created_at);
CREATE INDEX audit_logs_guest_session_idx ON public.audit_logs (session_id, created_at) WHERE session_id IS NOT NULL;

CREATE TABLE public.security_events (
    id uuid PRIMARY KEY,
    user_id uuid REFERENCES public.users (id) ON DELETE RESTRICT,
    guest_identity_id uuid REFERENCES public.guest_identities (id) ON DELETE RESTRICT,
    event_type text NOT NULL,
    severity text NOT NULL,
    network_metadata_hash bytea,
    user_agent_summary text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    occurred_at timestamptz NOT NULL,
    retention_class text NOT NULL DEFAULT 'security_90_days',
    CONSTRAINT security_events_severity_ck CHECK (severity IN ('info', 'warning', 'high', 'critical')),
    CONSTRAINT security_events_retention_ck CHECK (retention_class IN ('security_90_days', 'admin_12_months', 'legal_hold')),
    CONSTRAINT security_events_metadata_ck CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX security_events_user_time_idx ON public.security_events (user_id, occurred_at) WHERE user_id IS NOT NULL;
CREATE INDEX security_events_type_time_idx ON public.security_events (event_type, occurred_at);

-- RLS TODO (D23): create reviewed policies in a follow-up security-reviewed
-- migration. Protected operations must set transaction-local context with
-- set_config(..., true) on the same connection and deny missing context.
-- This migration intentionally does not claim RLS/security validation.

COMMIT;
