package com.ledgerflow;

import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Comparator;
import java.util.UUID;
import java.util.concurrent.Executors;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
class AttachmentIntegrationTest {
    private static final Path DATABASE_PATH = Path.of(System.getProperty("java.io.tmpdir"),
            "ledgerflow-m5-" + UUID.randomUUID() + ".db");
    private static final Path DATA_PATH = Path.of(System.getProperty("java.io.tmpdir"),
            "ledgerflow-m5-files-" + UUID.randomUUID());
    private static final String PASSWORD = "correct horse battery staple";
    private static final byte[] PDF = "%PDF-1.4\nLedgerFlow".getBytes(StandardCharsets.US_ASCII);
    private static final byte[] PNG = new byte[]{(byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1};

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("ledgerflow.database.path", DATABASE_PATH::toString);
        registry.add("ledgerflow.data-dir", DATA_PATH::toString);
        registry.add("ledgerflow.attachments.max-size", () -> "32B");
        registry.add("spring.servlet.multipart.max-file-size", () -> "1MB");
        registry.add("spring.servlet.multipart.max-request-size", () -> "2MB");
        registry.add("ledgerflow.security.auth-rate-limit", () -> 1000);
    }

    MockMvc mvc;
    @Autowired WebApplicationContext webContext;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void clean() throws IOException {
        mvc = MockMvcBuilders.webAppContextSetup(webContext).apply(springSecurity()).build();
        jdbc.execute("DROP TRIGGER IF EXISTS fail_attachment_audit");
        jdbc.update("DELETE FROM audit_log");
        jdbc.update("DELETE FROM password_reset_tokens");
        jdbc.update("DELETE FROM transaction_attachments");
        jdbc.update("DELETE FROM transactions");
        jdbc.update("DELETE FROM parties");
        jdbc.update("DELETE FROM regions");
        jdbc.update("DELETE FROM company_settings");
        jdbc.update("DELETE FROM user_preferences");
        jdbc.update("DELETE FROM company_memberships");
        jdbc.update("DELETE FROM auth_sessions");
        jdbc.update("DELETE FROM companies");
        jdbc.update("DELETE FROM users");
        removeTree(DATA_PATH.resolve("attachments"));
    }

    @AfterAll
    static void cleanup() throws IOException {
        Files.deleteIfExists(DATABASE_PATH);
        Files.deleteIfExists(Path.of(DATABASE_PATH + "-wal"));
        Files.deleteIfExists(Path.of(DATABASE_PATH + "-shm"));
        removeTree(DATA_PATH);
    }

    @Test
    void uploadDownloadAndReadModelsExposeSafeMetadata() throws Exception {
        Client owner = client("attachment-owner@example.com");
        Ledger ledger = ledger(owner, "Attachment Co");
        MockMultipartFile file = file("../../receipt.pdf", "application/pdf", PDF);

        mvc.perform(withAuth(multipart(url(ledger)).file(file), owner))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.originalName", is("receipt.pdf")))
                .andExpect(jsonPath("$.data.mimeType", is("application/pdf")))
                .andExpect(jsonPath("$.data.byteSize", is(PDF.length)))
                .andExpect(jsonPath("$.data.storageKey").doesNotExist());

        String key = jdbc.queryForObject("SELECT storage_key FROM transaction_attachments WHERE transaction_id=?",
                String.class, ledger.transactionId);
        assertNotNull(key);
        assertFalse(Path.of(key).isAbsolute());
        assertFalse(key.contains("receipt.pdf"));
        Path physical = DATA_PATH.resolve("attachments").resolve(key).normalize();
        assertTrue(physical.startsWith(DATA_PATH.resolve("attachments").normalize()));
        assertTrue(Files.isRegularFile(physical));

        MvcResult download = mvc.perform(get(url(ledger)).cookie(owner.session))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "application/pdf"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andReturn();
        assertArrayEquals(PDF, download.getResponse().getContentAsByteArray());
        assertTrue(download.getResponse().getHeader("Content-Disposition").contains("receipt.pdf"));

        mvc.perform(get("/api/companies/{id}/transactions/{transaction}", ledger.companyId,
                        ledger.transactionId).cookie(owner.session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.attachment.originalName", is("receipt.pdf")));
        mvc.perform(get("/api/companies/{id}/dashboard", ledger.companyId).cookie(owner.session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.recentTransactions[0].attachment.mimeType", is("application/pdf")));
        mvc.perform(get("/api/companies/{id}/reports/date-range", ledger.companyId).cookie(owner.session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.transactions[0].attachment.byteSize", is(PDF.length)));
        assertEquals(1, count("SELECT COUNT(*) FROM audit_log WHERE action='ATTACHMENT_UPLOADED'"));
    }

    @Test
    void replacementAndDeleteKeepOneMetadataRowAndCleanFiles() throws Exception {
        Client owner = client("replace-owner@example.com");
        Ledger ledger = ledger(owner, "Replace Co");
        upload(owner, ledger, file("first.pdf", "application/pdf", PDF));
        String first = key(ledger.transactionId);

        membership(ledger.companyId, userId("replace-owner@example.com"), "ADMIN");
        upload(owner, ledger, file("second.png", "image/png", PNG));
        String second = key(ledger.transactionId);
        assertNotEquals(first, second);
        assertFalse(Files.exists(filePath(first)));
        assertTrue(Files.exists(filePath(second)));
        assertEquals(1, count("SELECT COUNT(*) FROM transaction_attachments WHERE transaction_id=?",
                ledger.transactionId));
        assertEquals(1, count("SELECT COUNT(*) FROM audit_log WHERE action='ATTACHMENT_REPLACED'"));

        membership(ledger.companyId, userId("replace-owner@example.com"), "ACCOUNTANT");
        mvc.perform(withAuth(delete(url(ledger)), owner))
                .andExpect(status().isOk());
        assertEquals(0, count("SELECT COUNT(*) FROM transaction_attachments WHERE transaction_id=?",
                ledger.transactionId));
        assertFalse(Files.exists(filePath(second)));
        assertEquals(1, count("SELECT COUNT(*) FROM transactions WHERE id=?", ledger.transactionId));
        mvc.perform(get(url(ledger)).cookie(owner.session)).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code", is("ATTACHMENT_NOT_FOUND")));
    }

    @Test
    void invalidAndOversizedFilesAreRejectedWithoutReplacingExistingFile() throws Exception {
        Client owner = client("validation-owner@example.com");
        Ledger ledger = ledger(owner, "Validation Co");
        upload(owner, ledger, file("valid.pdf", "application/pdf", PDF));
        String existing = key(ledger.transactionId);

        assertUploadError(owner, ledger, file("virus.exe", "application/octet-stream", PDF),
                415, "ATTACHMENT_TYPE_NOT_ALLOWED");
        assertUploadError(owner, ledger, file("fake.pdf", "application/pdf", "not a pdf".getBytes()),
                422, "ATTACHMENT_CONTENT_INVALID");
        assertUploadError(owner, ledger, file("wrong.pdf", "image/png", PDF),
                415, "ATTACHMENT_TYPE_NOT_ALLOWED");
        assertUploadError(owner, ledger, file("large.pdf", "application/pdf",
                        ("%PDF-" + "x".repeat(40)).getBytes(StandardCharsets.US_ASCII)),
                413, "ATTACHMENT_TOO_LARGE");

        assertEquals(existing, key(ledger.transactionId));
        assertTrue(Files.exists(filePath(existing)));
    }

    @Test
    void viewerCanDownloadButCannotUploadOrDelete() throws Exception {
        Client owner = client("role-owner@example.com");
        Client viewer = client("role-viewer@example.com");
        Ledger ledger = ledger(owner, "Role Co");
        upload(owner, ledger, file("invoice.pdf", "application/pdf", PDF));
        membership(ledger.companyId, userId("role-viewer@example.com"), "VIEWER");

        mvc.perform(get(url(ledger)).cookie(viewer.session)).andExpect(status().isOk());
        mvc.perform(withAuth(multipart(url(ledger)).file(file("new.pdf", "application/pdf", PDF)), viewer))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code", is("COMPANY_ROLE_FORBIDDEN")));
        mvc.perform(withAuth(delete(url(ledger)), viewer)).andExpect(status().isForbidden());
        assertEquals("invoice.pdf", jdbc.queryForObject(
                "SELECT original_name FROM transaction_attachments WHERE transaction_id=?",
                String.class, ledger.transactionId));
    }

    @Test
    void companyScopeAndMissingPhysicalFileFailSafely() throws Exception {
        Client first = client("scope-first@example.com");
        Client second = client("scope-second@example.com");
        Ledger firstLedger = ledger(first, "First Scope");
        Ledger secondLedger = ledger(second, "Second Scope");
        upload(second, secondLedger, file("private.pdf", "application/pdf", PDF));

        String crossUrl = "/api/companies/" + firstLedger.companyId + "/transactions/"
                + secondLedger.transactionId + "/attachment";
        mvc.perform(get(crossUrl).cookie(first.session)).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code", is("TRANSACTION_NOT_FOUND")));
        assertUploadError(first, new Ledger(firstLedger.companyId, firstLedger.partyId, secondLedger.transactionId),
                file("attack.pdf", "application/pdf", PDF), 404, "TRANSACTION_NOT_FOUND");

        Files.delete(filePath(key(secondLedger.transactionId)));
        mvc.perform(get(url(secondLedger)).cookie(second.session)).andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code", is("ATTACHMENT_FILE_MISSING")));
    }

    @Test
    void deletingTransactionOrPartyRemovesCommittedAttachmentFiles() throws Exception {
        Client owner = client("cascade-owner@example.com");
        Ledger first = ledger(owner, "Cascade Co");
        upload(owner, first, file("transaction.pdf", "application/pdf", PDF));
        Path firstFile = filePath(key(first.transactionId));

        mvc.perform(withAuth(delete("/api/companies/{id}/transactions/{transaction}",
                        first.companyId, first.transactionId), owner)).andExpect(status().isOk());
        assertFalse(Files.exists(firstFile));

        long secondTransaction = createTransaction(owner, first.companyId, first.partyId);
        Ledger second = new Ledger(first.companyId, first.partyId, secondTransaction);
        upload(owner, second, file("party.pdf", "application/pdf", PDF));
        Path secondFile = filePath(key(second.transactionId));
        mvc.perform(withAuth(delete("/api/companies/{id}/parties/{party}",
                        second.companyId, second.partyId), owner)).andExpect(status().isOk());
        assertFalse(Files.exists(secondFile));
        assertEquals(0, count("SELECT COUNT(*) FROM transactions WHERE party_id=?", second.partyId));
    }

    @Test
    void databaseFailureRollsBackMetadataAndCompensatesStoredFile() throws Exception {
        Client owner = client("compensation-owner@example.com");
        Ledger ledger = ledger(owner, "Compensation Co");
        jdbc.execute("""
                CREATE TRIGGER fail_attachment_audit
                BEFORE INSERT ON audit_log
                WHEN NEW.action='ATTACHMENT_UPLOADED'
                BEGIN SELECT RAISE(ABORT, 'forced test failure'); END
                """);

        mvc.perform(withAuth(multipart(url(ledger)).file(file("rollback.pdf", "application/pdf", PDF)), owner))
                .andExpect(status().isInternalServerError());
        assertEquals(0, count("SELECT COUNT(*) FROM transaction_attachments WHERE transaction_id=?",
                ledger.transactionId));
        assertEquals(0, storedFileCount());
    }

    @Test
    void concurrentReplacementsLeaveOneMetadataRowAndOneFile() throws Exception {
        Client owner = client("concurrent-owner@example.com");
        Ledger ledger = ledger(owner, "Concurrent Co");
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> mvc.perform(withAuth(multipart(url(ledger))
                    .file(file("one.pdf", "application/pdf", PDF)), owner)).andReturn().getResponse().getStatus());
            var second = executor.submit(() -> mvc.perform(withAuth(multipart(url(ledger))
                    .file(file("two.png", "image/png", PNG)), owner)).andReturn().getResponse().getStatus());
            assertEquals(201, first.get());
            assertEquals(201, second.get());
        }
        assertEquals(1, count("SELECT COUNT(*) FROM transaction_attachments WHERE transaction_id=?",
                ledger.transactionId));
        assertEquals(1, storedFileCount());
    }

    private void assertUploadError(Client client, Ledger ledger, MockMultipartFile file,
                                   int statusCode, String code) throws Exception {
        mvc.perform(withAuth(multipart(url(ledger)).file(file), client))
                .andExpect(status().is(statusCode))
                .andExpect(jsonPath("$.error.code", is(code)));
    }

    private void upload(Client client, Ledger ledger, MockMultipartFile file) throws Exception {
        mvc.perform(withAuth(multipart(url(ledger)).file(file), client)).andExpect(status().isCreated());
    }

    private MockMultipartFile file(String name, String mime, byte[] content) {
        return new MockMultipartFile("file", name, mime, content);
    }

    private String url(Ledger ledger) {
        return "/api/companies/" + ledger.companyId + "/transactions/" + ledger.transactionId + "/attachment";
    }

    private Path filePath(String key) { return DATA_PATH.resolve("attachments").resolve(key); }
    private String key(long transactionId) {
        return jdbc.queryForObject("SELECT storage_key FROM transaction_attachments WHERE transaction_id=?",
                String.class, transactionId);
    }

    private Ledger ledger(Client client, String companyName) throws Exception {
        long company = createCompany(client, companyName);
        long region = id(mvc.perform(json(post("/api/companies/{id}/regions", company), client)
                        .content("{\"name\":\"North\"}"))
                .andExpect(status().isCreated()).andReturn());
        long party = id(mvc.perform(json(post("/api/companies/{id}/parties", company), client)
                        .content("{\"regionId\":" + region + ",\"name\":\"Customer\"}"))
                .andExpect(status().isCreated()).andReturn());
        return new Ledger(company, party, createTransaction(client, company, party));
    }

    private long createTransaction(Client client, long company, long party) throws Exception {
        return id(mvc.perform(json(post("/api/companies/{id}/transactions", company), client)
                        .content("{\"partyId\":" + party + ",\"type\":\"CREDIT\",\"amount\":1000,"
                                + "\"transactionDate\":\"2026-09-10\",\"description\":\"Invoice\"}"))
                .andExpect(status().isCreated()).andReturn());
    }

    private long createCompany(Client client, String name) throws Exception {
        return id(mvc.perform(json(post("/api/companies"), client)
                        .content("{\"name\":\"" + name + "\"}"))
                .andExpect(status().isCreated()).andReturn());
    }

    private Client client(String email) throws Exception {
        Csrf csrf = csrf();
        mvc.perform(withCsrf(post("/api/auth/register"), csrf).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Test User\",\"email\":\"" + email
                                + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isCreated());
        MvcResult login = mvc.perform(withCsrf(post("/api/auth/login"), csrf).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk()).andReturn();
        Cookie session = login.getResponse().getCookie("LF_SESSION");
        assertNotNull(session);
        return new Client(csrf, session);
    }

    private Csrf csrf() throws Exception {
        MvcResult result = mvc.perform(get("/api/auth/csrf")).andExpect(status().isOk()).andReturn();
        Cookie cookie = result.getResponse().getCookie("XSRF-TOKEN");
        assertNotNull(cookie);
        return new Csrf(cookie, cookie.getValue());
    }

    private MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder request, Client client) {
        return withAuth(request, client).contentType(MediaType.APPLICATION_JSON);
    }
    private MockHttpServletRequestBuilder withAuth(MockHttpServletRequestBuilder request, Client client) {
        return withCsrf(request, client.csrf).cookie(client.session);
    }
    private MockMultipartHttpServletRequestBuilder withAuth(MockMultipartHttpServletRequestBuilder request,
                                                            Client client) {
        return request.cookie(client.csrf.cookie, client.session)
                .header("X-XSRF-TOKEN", client.csrf.token);
    }
    private MockHttpServletRequestBuilder withCsrf(MockHttpServletRequestBuilder request, Csrf csrf) {
        return request.cookie(csrf.cookie).header("X-XSRF-TOKEN", csrf.token);
    }
    private long id(MvcResult result) throws Exception {
        return mapper.readTree(result.getResponse().getContentAsString()).at("/data/id").longValue();
    }
    private long userId(String email) {
        return jdbc.queryForObject("SELECT id FROM users WHERE normalized_email=?", Long.class, email);
    }
    private void membership(long companyId, long userId, String role) {
        String now = Instant.now().toString();
        jdbc.update("""
                INSERT OR REPLACE INTO company_memberships(company_id,user_id,role,status,created_at,updated_at)
                VALUES(?,?,?,'ACTIVE',?,?)
                """, companyId, userId, role, now, now);
    }
    private int count(String sql, Object... parameters) {
        Integer result = jdbc.queryForObject(sql, Integer.class, parameters);
        return result == null ? 0 : result;
    }
    private long storedFileCount() throws IOException {
        Path attachments = DATA_PATH.resolve("attachments");
        if (!Files.exists(attachments)) return 0;
        try (var entries = Files.walk(attachments)) {
            return entries.filter(Files::isRegularFile)
                    .filter(path -> !path.startsWith(attachments.resolve(".tmp"))).count();
        }
    }
    private static void removeTree(Path path) throws IOException {
        if (!Files.exists(path)) return;
        try (var entries = Files.walk(path)) {
            for (Path item : entries.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(item);
        }
    }

    private record Csrf(Cookie cookie, String token) {}
    private record Client(Csrf csrf, Cookie session) {}
    private record Ledger(long companyId, long partyId, long transactionId) {}
}
