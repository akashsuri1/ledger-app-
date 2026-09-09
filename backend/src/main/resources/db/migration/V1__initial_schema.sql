CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    normalized_email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    email_verified_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CONSTRAINT uq_users_normalized_email UNIQUE (normalized_email)
);

CREATE TABLE auth_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    created_at TEXT NOT NULL,
    CONSTRAINT uq_auth_sessions_token_hash UNIQUE (token_hash),
    CONSTRAINT fk_auth_sessions_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    address TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    gstin TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CONSTRAINT ck_companies_phone
        CHECK (phone = '' OR (length(phone) = 10 AND phone NOT GLOB '*[^0-9]*'))
);

CREATE TABLE company_memberships (
    company_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (company_id, user_id),
    CONSTRAINT ck_company_memberships_role
        CHECK (role IN ('OWNER', 'ADMIN', 'ACCOUNTANT', 'VIEWER')),
    CONSTRAINT ck_company_memberships_status
        CHECK (status IN ('INVITED', 'ACTIVE', 'SUSPENDED')),
    CONSTRAINT fk_company_memberships_company
        FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE,
    CONSTRAINT fk_company_memberships_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE user_preferences (
    user_id INTEGER PRIMARY KEY,
    remember_last_company INTEGER NOT NULL DEFAULT 0,
    last_active_company_id INTEGER,
    appearance_json TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL,
    CONSTRAINT ck_user_preferences_remember
        CHECK (remember_last_company IN (0, 1)),
    CONSTRAINT ck_user_preferences_appearance_json
        CHECK (json_valid(appearance_json)),
    CONSTRAINT fk_user_preferences_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_user_preferences_last_company
        FOREIGN KEY (last_active_company_id) REFERENCES companies (id) ON DELETE SET NULL
);

CREATE TABLE company_settings (
    company_id INTEGER PRIMARY KEY,
    statement_header TEXT NOT NULL DEFAULT 'Statement of Account',
    statement_footer TEXT NOT NULL DEFAULT '',
    default_transaction_limit TEXT NOT NULL DEFAULT '25',
    show_running_balance INTEGER NOT NULL DEFAULT 1,
    show_notes INTEGER NOT NULL DEFAULT 0,
    show_attachment INTEGER NOT NULL DEFAULT 1,
    show_business_address INTEGER NOT NULL DEFAULT 1,
    show_business_phone INTEGER NOT NULL DEFAULT 1,
    show_business_gstin INTEGER NOT NULL DEFAULT 1,
    show_generated_date INTEGER NOT NULL DEFAULT 1,
    show_page_numbers INTEGER NOT NULL DEFAULT 1,
    paper_size TEXT NOT NULL DEFAULT 'A4',
    orientation TEXT NOT NULL DEFAULT 'portrait',
    font_size TEXT NOT NULL DEFAULT 'normal',
    custom_footer TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL,
    CONSTRAINT ck_company_settings_transaction_limit
        CHECK (default_transaction_limit IN ('10', '25', '50', '100', 'ALL')),
    CONSTRAINT ck_company_settings_show_running_balance CHECK (show_running_balance IN (0, 1)),
    CONSTRAINT ck_company_settings_show_notes CHECK (show_notes IN (0, 1)),
    CONSTRAINT ck_company_settings_show_attachment CHECK (show_attachment IN (0, 1)),
    CONSTRAINT ck_company_settings_show_business_address CHECK (show_business_address IN (0, 1)),
    CONSTRAINT ck_company_settings_show_business_phone CHECK (show_business_phone IN (0, 1)),
    CONSTRAINT ck_company_settings_show_business_gstin CHECK (show_business_gstin IN (0, 1)),
    CONSTRAINT ck_company_settings_show_generated_date CHECK (show_generated_date IN (0, 1)),
    CONSTRAINT ck_company_settings_show_page_numbers CHECK (show_page_numbers IN (0, 1)),
    CONSTRAINT ck_company_settings_paper_size CHECK (paper_size = 'A4'),
    CONSTRAINT ck_company_settings_orientation CHECK (orientation IN ('portrait', 'landscape')),
    CONSTRAINT ck_company_settings_font_size CHECK (font_size IN ('small', 'normal', 'large')),
    CONSTRAINT fk_company_settings_company
        FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE
);

CREATE TABLE regions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CONSTRAINT uq_regions_company_name UNIQUE (company_id, normalized_name),
    CONSTRAINT uq_regions_id_company UNIQUE (id, company_id),
    CONSTRAINT fk_regions_company
        FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE RESTRICT
);

CREATE TABLE parties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    region_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    gstin TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CONSTRAINT uq_parties_company_region_name
        UNIQUE (company_id, region_id, normalized_name),
    CONSTRAINT uq_parties_id_company UNIQUE (id, company_id),
    CONSTRAINT ck_parties_phone
        CHECK (phone = '' OR (length(phone) = 10 AND phone NOT GLOB '*[^0-9]*')),
    CONSTRAINT fk_parties_company
        FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE RESTRICT,
    CONSTRAINT fk_parties_region_company
        FOREIGN KEY (region_id, company_id)
        REFERENCES regions (id, company_id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX uq_parties_company_gstin
    ON parties (company_id, gstin)
    WHERE gstin <> '';

CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    party_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    amount INTEGER NOT NULL,
    transaction_date TEXT NOT NULL,
    description TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CONSTRAINT uq_transactions_id_company UNIQUE (id, company_id),
    CONSTRAINT ck_transactions_type CHECK (type IN ('CREDIT', 'DEBIT')),
    CONSTRAINT ck_transactions_whole_positive_amount
        CHECK (typeof(amount) = 'integer' AND amount > 0),
    CONSTRAINT ck_transactions_date_only
        CHECK (
            length(transaction_date) = 10
            AND transaction_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
            AND date(transaction_date) IS NOT NULL
        ),
    CONSTRAINT ck_transactions_description CHECK (length(trim(description)) > 0),
    CONSTRAINT fk_transactions_company
        FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE RESTRICT,
    CONSTRAINT fk_transactions_party_company
        FOREIGN KEY (party_id, company_id)
        REFERENCES parties (id, company_id) ON DELETE CASCADE
);

CREATE TABLE transaction_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    transaction_id INTEGER NOT NULL,
    storage_key TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    byte_size INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    CONSTRAINT uq_transaction_attachments_storage_key UNIQUE (storage_key),
    CONSTRAINT ck_transaction_attachments_byte_size CHECK (byte_size > 0),
    CONSTRAINT fk_transaction_attachments_company
        FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE RESTRICT,
    CONSTRAINT fk_transaction_attachments_transaction_company
        FOREIGN KEY (transaction_id, company_id)
        REFERENCES transactions (id, company_id) ON DELETE CASCADE
);

CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER,
    user_id INTEGER,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    CONSTRAINT ck_audit_log_metadata_json CHECK (json_valid(metadata_json)),
    CONSTRAINT fk_audit_log_company
        FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE SET NULL,
    CONSTRAINT fk_audit_log_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_auth_sessions_user_expires
    ON auth_sessions (user_id, expires_at);

CREATE INDEX ix_company_memberships_user_status
    ON company_memberships (user_id, status, company_id);

CREATE INDEX ix_regions_company_id
    ON regions (company_id, id);

CREATE INDEX ix_parties_company_region_id
    ON parties (company_id, region_id, id);

CREATE INDEX ix_parties_company_name
    ON parties (company_id, normalized_name, id);

CREATE INDEX ix_transactions_company_date
    ON transactions (company_id, transaction_date, id);

CREATE INDEX ix_transactions_company_party_date
    ON transactions (company_id, party_id, transaction_date, id);

CREATE INDEX ix_transactions_company_type_date
    ON transactions (company_id, type, transaction_date, id);

CREATE INDEX ix_transaction_attachments_company_transaction
    ON transaction_attachments (company_id, transaction_id);

CREATE INDEX ix_audit_log_company_created
    ON audit_log (company_id, created_at, id);
