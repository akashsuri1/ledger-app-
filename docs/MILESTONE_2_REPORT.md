# Backend Milestone 2 report

## 1. Files created

Application code was added under these backend packages:

- `auth`: `AuthService`, `AuthSessionRepository`, `NoOpPasswordResetNotifier`,
  `PasswordPolicy`, `PasswordResetNotifier`, `PasswordResetService`,
  `PasswordResetTokenRepository`, `SecurityAuditRepository`, `UserAccount`, and
  `UserRepository`.
- `membership`: `CompanyAccessService`, `MembershipRepository`,
  `MembershipRole`, and `MembershipStatus`.
- `preferences`: `MeService` and `UserPreferencesRepository`.
- `security`: `AuthenticatedUser`, `AuthRateLimitFilter`, `CurrentUserService`,
  `JsonAccessDeniedHandler`, `JsonAuthenticationEntryPoint`,
  `LedgerFlowSecurityProperties`, `OpaqueSessionAuthenticationFilter`,
  `SecurityConfiguration`, `SessionCookieService`,
  `SpaCsrfTokenRequestHandler`, and `TokenService`.
- `web`: `ApiEnvelope`, `ApiErrorEnvelope`, `ApiException`, `AuthController`,
  `GlobalExceptionHandler`, and `MeController`.
- Tests: `AuthMembershipIntegrationTest`.
- Configuration/migration: `application-prod.yml` and
  `V2__password_reset_tokens.sql`.

## 2. Files modified

- `backend/src/main/resources/application.yml`
- `backend/src/test/java/com/ledgerflow/DatabaseSchemaIntegrationTest.java`
- `backend/README.md`

The completed React frontend was not changed for this milestone.

## 3. Flyway migrations

`V2__password_reset_tokens.sql` adds a single-use, expiring password-reset table,
an index for user/expiry lookup, and an active-session expiry index. The deployed
`V1__initial_schema.sql` was not edited.

## 4. Authentication architecture

Spring Security runs statelessly at the HTTP layer. A custom filter resolves the
opaque session cookie once, loads its database record, rejects expired/revoked
records, and installs an `AuthenticatedUser` in the Spring Security context.
Controllers and services use `CurrentUserService` rather than parsing cookies.

Implemented endpoints:

```text
GET  /api/auth/csrf
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/refresh
POST /api/auth/forgot-password
POST /api/auth/reset-password
GET  /api/me/bootstrap
PATCH /api/me/preferences
```

Registration creates a user only. It does not create a company.

## 5. Password encoder

The backend uses Spring Security's delegating `PasswordEncoder`, whose current
default encoding is bcrypt and whose `{id}` prefix permits future hash migration.
Passwords must contain at least 12 characters and fit bcrypt's 72-byte UTF-8
limit. Login also checks an encoded dummy password for unknown emails to reduce
the account-existence timing difference.

## 6. Session and token design

Sessions use 32 cryptographically random bytes encoded with URL-safe Base64.
The `LF_SESSION` cookie receives the raw value; SQLite stores only its SHA-256
hash. Sessions expire after seven days by default and support immediate
revocation. Refresh replaces the stored hash and cookie, so the old token stops
working. Logout revokes the row and clears the cookie. A successful password
reset revokes all sessions for that user.

## 7. Cookies and CSRF

The session cookie is `HttpOnly`, `SameSite=Lax`, scoped to `/`, and has an
explicit max age. It is non-Secure for localhost development and always Secure
under the `prod` profile. CSRF remains enabled. `GET /api/auth/csrf` creates the
separate readable `XSRF-TOKEN` cookie; React must copy it into the
`X-XSRF-TOKEN` header for mutations. That cookie is readable only because it is
not an authentication credential. CORS accepts configured explicit origins and
credentials, with no wildcard origin.

## 8. Membership authorization

`CompanyAccessService` centralizes `hasMembership`, `requireMembership`, and
`requireRole`. Only `ACTIVE` memberships grant access. Missing or inaccessible
companies use `404 COMPANY_ACCESS_DENIED` so another user's resource existence is
not revealed. A service guard rejects deletion or demotion of a company's final
active owner.

## 9. Roles

Roles are strongly typed as `OWNER`, `ADMIN`, `ACCOUNTANT`, and `VIEWER`.
Membership status is also typed as `INVITED`, `ACTIVE`, or `SUSPENDED`.

## 10. Bootstrap

`GET /api/me/bootstrap` returns the authenticated user, companies reached through
that user's active memberships, each membership role, and user preferences. Zero
memberships returns an empty company array. Inactive and other-user memberships
are excluded. A stored last-active company that is no longer accessible is
returned as `null`.

## 11. User preferences

`PATCH /api/me/preferences` supports independent partial updates of
`rememberLastCompany`, nullable `lastActiveCompanyId`, and the existing appearance
JSON object. A non-null company ID is saved only after an active-membership check.

## 12. Password reset

Forgot-password returns identical public responses for existing and unknown
emails. Existing users receive a 32-byte random token through the
`PasswordResetNotifier` abstraction; only its SHA-256 hash is saved. Tokens have
a 30-minute default lifetime and become unusable after one successful reset.
The default notifier is provider-neutral and logs only the user ID. No token is
logged. Provider failures are also hidden from the public response to prevent
email enumeration.

## 13. Tests

There are 24 passing test methods: 14 original schema tests and 10 Milestone 2
integration tests. The new tests cover registration validation and password
encoding, normalized duplicates, generic login failures, hashed sessions,
authenticated bootstrap, logout revocation, expiry, refresh rotation, zero and
multiple membership results, inactive/cross-user isolation, preference access
validation, stale preferences, password reset privacy/hash/expiry/single use,
CSRF enforcement, role enforcement, and final-owner protection.

## 14. `mvn test`

Passed: 24 tests, 0 failures, 0 errors, 0 skipped.

## 15. `mvn package`

Passed and produced the executable
`backend/target/ledgerflow-backend-0.0.1-SNAPSHOT.jar`.
The packaged JAR was also started successfully against a fresh disposable
SQLite database; Flyway applied V1 and V2 and Tomcat reached accepting-traffic
state.

## 16. Security decisions to review before deployment

- Set the real production frontend origin through
  `LEDGERFLOW_ALLOWED_ORIGINS`.
- The `prod` profile forces Secure cookies; production must terminate HTTPS.
- The local rate limiter allows 30 requests per endpoint/IP per minute. It is an
  in-process foundation and should become a shared limiter if the service is
  deployed as multiple instances.
- Replace `NoOpPasswordResetNotifier` with an email-provider implementation. Its
  boundary deliberately receives the raw reset token because delivery requires
  it; implementations must never log it.
- Session and reset-token cleanup can be added as scheduled maintenance before a
  long-running production deployment. Expired rows already cannot authenticate.

## 17. Deferred to Milestone 3

Company CRUD and membership mutation endpoints, Regions, Parties, Transactions,
dashboard/report APIs, company settings, attachments, backup/import, and frontend
API integration remain deferred. Every new company-scoped service should call the
membership guard before querying or mutating data. The existing whole-rupee and
date-only transaction schema remains unchanged.
