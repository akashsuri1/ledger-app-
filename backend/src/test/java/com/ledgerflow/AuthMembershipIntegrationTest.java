package com.ledgerflow;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import com.ledgerflow.auth.PasswordResetNotifier;
import com.ledgerflow.auth.UserAccount;
import com.ledgerflow.membership.CompanyAccessService;
import com.ledgerflow.membership.MembershipRole;
import com.ledgerflow.security.TokenService;
import com.ledgerflow.web.ApiException;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
class AuthMembershipIntegrationTest {
    private static final Path DATABASE_PATH = Path.of(System.getProperty("java.io.tmpdir"),
            "ledgerflow-auth-" + UUID.randomUUID() + ".db");
    private static final String PASSWORD = "correct horse battery staple";

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("ledgerflow.database.path", DATABASE_PATH::toString);
        registry.add("ledgerflow.security.auth-rate-limit", () -> 1000);
    }

    MockMvc mvc;
    @Autowired WebApplicationContext webContext;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper mapper;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired TokenService tokenService;
    @Autowired CapturingNotifier notifier;
    @Autowired CompanyAccessService companyAccess;

    @BeforeEach
    void clean() {
        mvc = MockMvcBuilders.webAppContextSetup(webContext).apply(springSecurity()).build();
        notifier.token.set(null);
        jdbc.update("DELETE FROM audit_log");
        jdbc.update("DELETE FROM password_reset_tokens");
        jdbc.update("DELETE FROM user_preferences");
        jdbc.update("DELETE FROM company_memberships");
        jdbc.update("DELETE FROM auth_sessions");
        jdbc.update("DELETE FROM companies");
        jdbc.update("DELETE FROM users");
    }

    @AfterAll
    static void removeDatabase() throws IOException {
        Files.deleteIfExists(DATABASE_PATH);
        Files.deleteIfExists(Path.of(DATABASE_PATH + "-wal"));
        Files.deleteIfExists(Path.of(DATABASE_PATH + "-shm"));
    }

    @Test
    void csrfIsRequiredForStateChangingRequests() throws Exception {
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"a@example.com\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code", is("CSRF_INVALID")));
    }

    @Test
    void registrationValidatesNormalizesAndStoresOnlyEncodedPassword() throws Exception {
        Csrf csrf = csrf();
        String response = mvc.perform(withCsrf(post("/api/auth/register"), csrf)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson("User@Example.com", PASSWORD)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.email", is("User@Example.com")))
                .andReturn().getResponse().getContentAsString();

        String hash = jdbc.queryForObject("SELECT password_hash FROM users", String.class);
        assertNotNull(hash);
        assertNotEquals(PASSWORD, hash);
        assertTrue(passwordEncoder.matches(PASSWORD, hash));
        assertFalse(response.contains("passwordHash"));
        assertFalse(response.contains(hash));

        mvc.perform(withCsrf(post("/api/auth/register"), csrf).contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson("USER@example.com", PASSWORD)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code", is("EMAIL_ALREADY_REGISTERED")));
        mvc.perform(withCsrf(post("/api/auth/register"), csrf).contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson("bad-email", PASSWORD)))
                .andExpect(status().isUnprocessableEntity());
        mvc.perform(withCsrf(post("/api/auth/register"), csrf).contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson("weak@example.com", "too-short")))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void loginUsesGenericErrorsHashesSessionAndAuthenticatesBootstrap() throws Exception {
        Csrf csrf = csrf();
        register(csrf, "user@example.com");

        mvc.perform(withCsrf(post("/api/auth/login"), csrf).contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("user@example.com", "wrong-password")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code", is("AUTH_INVALID_CREDENTIALS")));
        mvc.perform(withCsrf(post("/api/auth/login"), csrf).contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("unknown@example.com", "wrong-password")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code", is("AUTH_INVALID_CREDENTIALS")));

        Cookie session = login(csrf, "USER@example.com", PASSWORD);
        String storedHash = jdbc.queryForObject("SELECT token_hash FROM auth_sessions", String.class);
        assertNotNull(storedHash);
        assertNotEquals(session.getValue(), storedHash);
        assertTrue(storedHash.equals(tokenService.hash(session.getValue())));
        mvc.perform(get("/api/me/bootstrap").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.companies", hasSize(0)))
                .andExpect(jsonPath("$.data.preferences.lastActiveCompanyId").doesNotExist());
    }

    @Test
    void logoutRevokesOldSessionImmediately() throws Exception {
        Csrf csrf = csrf(); register(csrf, "user@example.com");
        Cookie session = login(csrf, "user@example.com", PASSWORD);
        mvc.perform(withCsrf(post("/api/auth/logout"), csrf).cookie(session))
                .andExpect(status().isOk()).andExpect(cookie().maxAge("LF_SESSION", 0));
        mvc.perform(get("/api/me/bootstrap").cookie(session))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code", is("AUTH_REQUIRED")));
    }

    @Test
    void expiredSessionReturnsStableExpiredError() throws Exception {
        Csrf csrf = csrf(); register(csrf, "user@example.com");
        Cookie session = login(csrf, "user@example.com", PASSWORD);
        jdbc.update("UPDATE auth_sessions SET expires_at = ?", Instant.now().minusSeconds(1).toString());
        mvc.perform(get("/api/me/bootstrap").cookie(session))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code", is("AUTH_SESSION_EXPIRED")));
    }

    @Test
    void refreshRotatesTokenAndInvalidatesOldToken() throws Exception {
        Csrf csrf = csrf(); register(csrf, "user@example.com");
        Cookie oldSession = login(csrf, "user@example.com", PASSWORD);
        MvcResult result = mvc.perform(withCsrf(post("/api/auth/refresh"), csrf).cookie(oldSession))
                .andExpect(status().isOk()).andReturn();
        Cookie newSession = result.getResponse().getCookie("LF_SESSION");
        assertNotNull(newSession);
        assertNotEquals(oldSession.getValue(), newSession.getValue());
        mvc.perform(get("/api/me/bootstrap").cookie(oldSession)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/me/bootstrap").cookie(newSession)).andExpect(status().isOk());
    }

    @Test
    void bootstrapReturnsOnlyActiveMembershipsForCurrentUser() throws Exception {
        Csrf csrf = csrf();
        register(csrf, "a@example.com"); register(csrf, "b@example.com");
        long userA = userId("a@example.com"), userB = userId("b@example.com");
        long companyA = company("Alpha"), companyB = company("Beta"), inactive = company("Hidden");
        membership(userA, companyA, "OWNER", "ACTIVE");
        membership(userB, companyB, "ACCOUNTANT", "ACTIVE");
        membership(userA, inactive, "VIEWER", "SUSPENDED");

        Cookie sessionA = login(csrf, "a@example.com", PASSWORD);
        mvc.perform(get("/api/me/bootstrap").cookie(sessionA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.companies", hasSize(1)))
                .andExpect(jsonPath("$.data.companies[0].name", is("Alpha")))
                .andExpect(jsonPath("$.data.companies[0].role", is("OWNER")));
        Cookie sessionB = login(csrf, "b@example.com", PASSWORD);
        mvc.perform(get("/api/me/bootstrap").cookie(sessionB))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.companies", hasSize(1)))
                .andExpect(jsonPath("$.data.companies[0].name", is("Beta")));
    }

    @Test
    void preferencesRejectForeignCompanyAndNullOutStaleStoredCompany() throws Exception {
        Csrf csrf = csrf(); register(csrf, "a@example.com"); register(csrf, "b@example.com");
        long userA = userId("a@example.com"), userB = userId("b@example.com");
        long own = company("Own"), foreign = company("Foreign");
        membership(userA, own, "OWNER", "ACTIVE"); membership(userB, foreign, "OWNER", "ACTIVE");
        Cookie session = login(csrf, "a@example.com", PASSWORD);

        mvc.perform(withCsrf(patch("/api/me/preferences"), csrf).cookie(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lastActiveCompanyId\":" + foreign + "}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code", is("COMPANY_ACCESS_DENIED")));
        mvc.perform(withCsrf(patch("/api/me/preferences"), csrf).cookie(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rememberLastCompany\":true,\"lastActiveCompanyId\":" + own
                                + ",\"appearance\":{\"theme\":\"dark\"}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.lastActiveCompanyId", is((int) own)))
                .andExpect(jsonPath("$.data.appearance.theme", is("dark")));

        jdbc.update("UPDATE company_memberships SET status='SUSPENDED' WHERE user_id=? AND company_id=?", userA, own);
        mvc.perform(get("/api/me/bootstrap").cookie(session)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.preferences.lastActiveCompanyId").doesNotExist());
    }

    @Test
    void resetResponsesArePrivateAndTokensAreHashedExpiringAndSingleUse() throws Exception {
        Csrf csrf = csrf(); register(csrf, "user@example.com");
        String existingResponse = mvc.perform(withCsrf(post("/api/auth/forgot-password"), csrf)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"user@example.com\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String raw = notifier.token.get();
        assertNotNull(raw);
        String stored = jdbc.queryForObject("SELECT token_hash FROM password_reset_tokens", String.class);
        assertNotEquals(raw, stored);
        assertTrue(stored.equals(tokenService.hash(raw)));
        String unknownResponse = mvc.perform(withCsrf(post("/api/auth/forgot-password"), csrf)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"none@example.com\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertTrue(mapper.readTree(existingResponse).equals(mapper.readTree(unknownResponse)));

        String newPassword = "a newer correct horse battery staple";
        mvc.perform(withCsrf(post("/api/auth/reset-password"), csrf).contentType(MediaType.APPLICATION_JSON)
                        .content(resetJson(raw, newPassword))).andExpect(status().isOk());
        mvc.perform(withCsrf(post("/api/auth/reset-password"), csrf).contentType(MediaType.APPLICATION_JSON)
                        .content(resetJson(raw, newPassword))).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code", is("AUTH_RESET_TOKEN_INVALID")));
        mvc.perform(withCsrf(post("/api/auth/login"), csrf).contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("user@example.com", PASSWORD))).andExpect(status().isUnauthorized());
        login(csrf, "user@example.com", newPassword);

        mvc.perform(withCsrf(post("/api/auth/forgot-password"), csrf).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"user@example.com\"}")).andExpect(status().isOk());
        String expired = notifier.token.get();
        jdbc.update("UPDATE password_reset_tokens SET expires_at=? WHERE token_hash=?",
                Instant.now().minusSeconds(1).toString(), tokenService.hash(expired));
        mvc.perform(withCsrf(post("/api/auth/reset-password"), csrf).contentType(MediaType.APPLICATION_JSON)
                        .content(resetJson(expired, PASSWORD))).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code", is("AUTH_RESET_TOKEN_EXPIRED")));
    }

    @Test
    void companyAccessEnforcesRolesAndProtectsFinalOwner() {
        long user = directUser("owner@example.com"), company = company("Owned");
        membership(user, company, "OWNER", "ACTIVE");
        assertTrue(companyAccess.hasMembership(user, company));
        assertTrue(companyAccess.requireRole(user, company, MembershipRole.OWNER).role() == MembershipRole.OWNER);
        ApiException role = assertThrows(ApiException.class,
                () -> companyAccess.requireRole(user, company, MembershipRole.ADMIN));
        assertTrue(role.status().value() == 403);
        ApiException finalOwner = assertThrows(ApiException.class,
                () -> companyAccess.requireOwnerRemovalLeavesAnotherOwner(user, company));
        assertTrue(finalOwner.code().equals("FINAL_OWNER_REQUIRED"));
        long other = directUser("other@example.com");
        membership(other, company, "OWNER", "ACTIVE");
        companyAccess.requireOwnerRemovalLeavesAnotherOwner(user, company);
    }

    private Csrf csrf() throws Exception {
        MvcResult result = mvc.perform(get("/api/auth/csrf")).andExpect(status().isOk()).andReturn();
        Cookie cookie = result.getResponse().getCookie("XSRF-TOKEN");
        assertNotNull(cookie);
        return new Csrf(cookie, cookie.getValue());
    }

    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder withCsrf(
            org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request, Csrf csrf) {
        return request.cookie(csrf.cookie).header("X-XSRF-TOKEN", csrf.token);
    }

    private void register(Csrf csrf, String email) throws Exception {
        mvc.perform(withCsrf(post("/api/auth/register"), csrf).contentType(MediaType.APPLICATION_JSON)
                .content(registerJson(email, PASSWORD))).andExpect(status().isCreated());
    }

    private Cookie login(Csrf csrf, String email, String password) throws Exception {
        MvcResult result = mvc.perform(withCsrf(post("/api/auth/login"), csrf)
                        .contentType(MediaType.APPLICATION_JSON).content(loginJson(email, password)))
                .andExpect(status().isOk()).andReturn();
        Cookie cookie = result.getResponse().getCookie("LF_SESSION");
        assertNotNull(cookie);
        assertTrue(cookie.isHttpOnly());
        return cookie;
    }

    private long userId(String email) {
        return jdbc.queryForObject("SELECT id FROM users WHERE normalized_email=?", Long.class, email);
    }

    private long directUser(String email) {
        String now = Instant.now().toString();
        jdbc.update("INSERT INTO users(name,email,normalized_email,password_hash,created_at,updated_at) VALUES('User',?,?,?,?,?)",
                email, email, passwordEncoder.encode(PASSWORD), now, now);
        return userId(email);
    }

    private long company(String name) {
        String now = Instant.now().toString();
        jdbc.update("INSERT INTO companies(name,normalized_name,created_at,updated_at) VALUES(?,?,?,?)",
                name, name.toLowerCase(), now, now);
        return jdbc.queryForObject("SELECT id FROM companies WHERE normalized_name=?", Long.class, name.toLowerCase());
    }

    private void membership(long userId, long companyId, String role, String status) {
        String now = Instant.now().toString();
        jdbc.update("INSERT INTO company_memberships(company_id,user_id,role,status,created_at,updated_at) VALUES(?,?,?,?,?,?)",
                companyId, userId, role, status, now, now);
    }

    private String registerJson(String email, String password) {
        return "{\"name\":\"Test User\",\"email\":\"" + email + "\",\"password\":\"" + password + "\"}";
    }
    private String loginJson(String email, String password) {
        return "{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}";
    }
    private String resetJson(String token, String password) {
        return "{\"token\":\"" + token + "\",\"password\":\"" + password + "\"}";
    }
    private record Csrf(Cookie cookie, String token) {}

    @TestConfiguration
    static class NotificationConfiguration {
        @Bean @Primary CapturingNotifier capturingNotifier() { return new CapturingNotifier(); }
    }
    static class CapturingNotifier implements PasswordResetNotifier {
        final AtomicReference<String> token = new AtomicReference<>();
        @Override public void sendPasswordReset(UserAccount user, String rawToken) { token.set(rawToken); }
    }
}
