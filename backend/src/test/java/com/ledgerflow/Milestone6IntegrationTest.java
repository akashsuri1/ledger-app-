package com.ledgerflow;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Comparator;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

import com.ledgerflow.backup.BackupCrypto;
import com.ledgerflow.web.BackupController;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.mock.web.MockPart;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
class Milestone6IntegrationTest {
    private static final Path DATABASE_PATH = Path.of(System.getProperty("java.io.tmpdir"),
            "ledgerflow-m6-" + UUID.randomUUID() + ".db");
    private static final Path DATA_PATH = Path.of(System.getProperty("java.io.tmpdir"),
            "ledgerflow-m6-files-" + UUID.randomUUID());
    private static final String PASSWORD = "correct horse battery staple";
    private static final String PASSPHRASE = "safe backup passphrase";
    private static final byte[] PDF = "%PDF-1.4\nM6 PDF".getBytes(StandardCharsets.US_ASCII);
    private static final byte[] PNG = new byte[]{(byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9};

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("ledgerflow.database.path", DATABASE_PATH::toString);
        registry.add("ledgerflow.data-dir", DATA_PATH::toString);
        registry.add("ledgerflow.backups.pbkdf2-iterations", () -> 100_000);
        registry.add("ledgerflow.backups.max-entries", () -> 30);
        registry.add("ledgerflow.backups.max-uncompressed-size", () -> "64KB");
        registry.add("ledgerflow.security.auth-rate-limit", () -> 1000);
    }

    MockMvc mvc;
    @Autowired WebApplicationContext webContext;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired BackupCrypto crypto;

    @BeforeEach
    void clean() throws IOException {
        mvc = MockMvcBuilders.webAppContextSetup(webContext).apply(springSecurity()).build();
        jdbc.execute("DROP TRIGGER IF EXISTS fail_restore_audit");
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
    void encryptedCompanyRoundTripPreservesLedgerSettingsReportsAndAttachments() throws Exception {
        Client owner = client("roundtrip@example.com");
        long company = createCompany(owner, "Round Trip Co");
        mvc.perform(json(patch("/api/companies/{id}", company), owner).content("""
                {"address":"42 Ledger Lane","phone":"9876543210",
                 "gstin":"03ABCDE1234F1Z5","email":"books@example.com"}
                """)).andExpect(status().isOk());
        long punjab = createRegion(owner, company, "Punjab");
        long himachal = createRegion(owner, company, "Himachal Pradesh");
        long abc = createParty(owner, company, punjab, "ABC Traders", "03ABCDE1234F1Z5");
        long xyz = createParty(owner, company, himachal, "XYZ Stores", "");
        long credit25 = createTransaction(owner, company, abc, "CREDIT", 25_000, "2026-09-13", "Credit 25");
        long debit10 = createTransaction(owner, company, abc, "DEBIT", 10_000, "2026-09-14", "Debit 10");
        createTransaction(owner, company, xyz, "CREDIT", 50_000, "2026-09-15", "Credit 50");
        upload(owner, company, credit25, "invoice.pdf", "application/pdf", PDF);
        upload(owner, company, debit10, "receipt.png", "image/png", PNG);
        mvc.perform(json(patch("/api/companies/{id}/settings", company), owner).content("""
                {"statementHeader":"Custom Statement","defaultTransactionLimit":"ALL",
                 "showNotes":true,"orientation":"landscape","fontSize":"large",
                 "customFooter":"Thank you"}
                """)).andExpect(status().isOk());

        byte[] backup = backup(owner, company, PASSPHRASE);
        assertFalse(new String(backup, StandardCharsets.ISO_8859_1).contains("Round Trip Co"));
        assertFalse(new String(backup, StandardCharsets.ISO_8859_1).contains(PASSPHRASE));

        mvc.perform(restoreRequest("/api/backups/restore/preview", owner, backup, PASSPHRASE, null))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.valid", is(true)))
                .andExpect(jsonPath("$.data.counts.regions", is(2)))
                .andExpect(jsonPath("$.data.counts.parties", is(2)))
                .andExpect(jsonPath("$.data.counts.transactions", is(3)))
                .andExpect(jsonPath("$.data.counts.attachments", is(2)))
                .andExpect(jsonPath("$.data.conflicts[0]", is("COMPANY_NAME_ALREADY_ACCESSIBLE")));

        MvcResult restoredResult = mvc.perform(restoreRequest("/api/backups/restore/commit", owner,
                        backup, PASSPHRASE, "Round Trip Restored"))
                .andExpect(status().isOk()).andReturn();
        long restored = mapper.readTree(restoredResult.getResponse().getContentAsString())
                .at("/data/companyId").longValue();
        assertNotEquals(company, restored);
        assertEquals("42 Ledger Lane", jdbc.queryForObject(
                "SELECT address FROM companies WHERE id=?", String.class, restored));
        assertEquals("03ABCDE1234F1Z5", jdbc.queryForObject(
                "SELECT gstin FROM companies WHERE id=?", String.class, restored));
        assertEquals(2, count("SELECT COUNT(*) FROM regions WHERE company_id=?", restored));
        assertEquals(2, count("SELECT COUNT(*) FROM parties WHERE company_id=?", restored));
        assertEquals(2, count("SELECT COUNT(*) FROM transactions WHERE company_id=? AND type='CREDIT'", restored));
        assertEquals(1, count("SELECT COUNT(*) FROM transactions WHERE company_id=? AND type='DEBIT'", restored));
        assertEquals(65_000L, jdbc.queryForObject("""
                SELECT SUM(CASE type WHEN 'CREDIT' THEN amount ELSE -amount END)
                FROM transactions WHERE company_id=?
                """, Long.class, restored));
        assertEquals("2026-09-13", jdbc.queryForObject("""
                SELECT transaction_date FROM transactions WHERE company_id=? AND description='Credit 25'
                """, String.class, restored));
        assertEquals("Custom Statement", jdbc.queryForObject(
                "SELECT statement_header FROM company_settings WHERE company_id=?", String.class, restored));
        assertEquals("landscape", jdbc.queryForObject(
                "SELECT orientation FROM company_settings WHERE company_id=?", String.class, restored));
        assertEquals(2, count("SELECT COUNT(*) FROM transaction_attachments WHERE company_id=?", restored));
        assertEquals(1, count("""
                SELECT COUNT(*) FROM transaction_attachments
                WHERE company_id=? AND original_name='invoice.pdf' AND mime_type='application/pdf'
                """, restored));

        long restoredCredit = jdbc.queryForObject(
                "SELECT id FROM transactions WHERE company_id=? AND description='Credit 25'", Long.class, restored);
        MvcResult download = mvc.perform(get("/api/companies/{company}/transactions/{tx}/attachment",
                        restored, restoredCredit).cookie(owner.session)).andExpect(status().isOk()).andReturn();
        assertArrayEquals(PDF, download.getResponse().getContentAsByteArray());
        mvc.perform(get("/api/companies/{id}/dashboard", restored).cookie(owner.session))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.netBalance", is(65000)));
        mvc.perform(get("/api/companies/{id}/reports/date-range", restored).cookie(owner.session))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.transactionCount", is(3)));
        long restoredAbc = jdbc.queryForObject(
                "SELECT id FROM parties WHERE company_id=? AND name='ABC Traders'", Long.class, restored);
        mvc.perform(get("/api/companies/{company}/parties/{party}", restored, restoredAbc)
                        .cookie(owner.session))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.balance", is(15000)))
                .andExpect(jsonPath("$.data.notes", is("Party notes")));
        mvc.perform(get("/api/companies/{company}/reports/party-statement", restored)
                .param("partyId", Long.toString(restoredAbc)).cookie(owner.session))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.closingBalance", is(15000)))
                .andExpect(jsonPath("$.data.eligibleTransactionCount", is(2)));
        assertEquals(1, count("SELECT COUNT(*) FROM audit_log WHERE action='BACKUP_CREATED'"));
        assertEquals(1, count("SELECT COUNT(*) FROM audit_log WHERE action='COMPANY_RESTORED'"));
    }

    @Test
    void randomEncryptionWrongPasswordAndTamperingFailWithoutMutation() throws Exception {
        assertFalse(new BackupController.BackupRequest(PASSPHRASE.toCharArray()).toString()
                .contains(PASSPHRASE));
        Client owner = client("crypto@example.com");
        long company = simpleLedger(owner, "Crypto Co");
        byte[] first = backup(owner, company, PASSPHRASE);
        byte[] second = backup(owner, company, PASSPHRASE);
        assertFalse(java.util.Arrays.equals(first, second));
        int before = count("SELECT COUNT(*) FROM companies");

        mvc.perform(restoreRequest("/api/backups/restore/preview", owner, first, "wrong passphrase", null))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.code", is("BACKUP_PASSWORD_INVALID")));
        byte[] changedCiphertext = first.clone();
        changedCiphertext[changedCiphertext.length - 1] ^= 1;
        mvc.perform(restoreRequest("/api/backups/restore/preview", owner, changedCiphertext, PASSPHRASE, null))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.code", is("BACKUP_PASSWORD_INVALID")));
        byte[] changedHeader = first.clone();
        changedHeader[20] ^= 1;
        mvc.perform(restoreRequest("/api/backups/restore/preview", owner, changedHeader, PASSPHRASE, null))
                .andExpect(status().isUnprocessableEntity());
        assertEquals(before, count("SELECT COUNT(*) FROM companies"));
    }

    @Test
    void onlyOwnersCanExportOrRestoreAndCompanyScopeDoesNotLeak() throws Exception {
        Client ownerA = client("owner-a@example.com");
        Client ownerB = client("owner-b@example.com");
        long companyA = simpleLedger(ownerA, "Company A");
        long companyB = simpleLedger(ownerB, "Company B");
        byte[] backupA = backup(ownerA, companyA, PASSPHRASE);
        membership(companyA, userId("owner-b@example.com"), "VIEWER");

        mvc.perform(json(post("/api/companies/{id}/backup", companyA), ownerB)
                        .content("{\"passphrase\":\"" + PASSPHRASE + "\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(json(post("/api/companies/{id}/backup", companyB), ownerA)
                        .content("{\"passphrase\":\"" + PASSPHRASE + "\"}"))
                .andExpect(status().isNotFound());
        membership(companyA, userId("owner-a@example.com"), "ADMIN");
        mvc.perform(json(post("/api/companies/{id}/backup", companyA), ownerA)
                        .content("{\"passphrase\":\"" + PASSPHRASE + "\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(restoreRequest("/api/backups/restore/preview", ownerA, backupA, PASSPHRASE, null))
                .andExpect(status().isForbidden());
        mvc.perform(restoreRequest("/api/backups/restore/commit", ownerA, backupA,
                        PASSPHRASE, "Forbidden Restore"))
                .andExpect(status().isForbidden());
        membership(companyA, userId("owner-a@example.com"), "ACCOUNTANT");
        mvc.perform(json(post("/api/companies/{id}/backup", companyA), ownerA)
                        .content("{\"passphrase\":\"" + PASSPHRASE + "\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(json(post("/api/import/legacy/preview"), ownerA).content(legacyWorkspace(1_000)))
                .andExpect(status().isForbidden());
    }

    @Test
    void futureVersionsUnsafeEntriesAndExpansionLimitsAreRejected() throws Exception {
        Client owner = client("archive@example.com");
        long company = simpleLedger(owner, "Archive Co");
        byte[] valid = backup(owner, company, PASSPHRASE);
        byte[] zip = crypto.decrypt(valid, PASSPHRASE.toCharArray());

        Map<String, byte[]> entries = unzip(zip);
        JsonNode manifest = mapper.readTree(entries.get("manifest.json"));
        ((tools.jackson.databind.node.ObjectNode) manifest).put("formatVersion", 99);
        entries.put("manifest.json", mapper.writeValueAsBytes(manifest));
        byte[] future = crypto.encrypt(zip(entries), PASSPHRASE.toCharArray());
        mvc.perform(restoreRequest("/api/backups/restore/preview", owner, future, PASSPHRASE, null))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.code", is("BACKUP_VERSION_UNSUPPORTED")));

        for (String unsafeName : java.util.List.of("../../ledgerflow.db", "..\\..\\ledgerflow.db",
                "/tmp/ledgerflow.db", "C:/Windows/ledgerflow.db")) {
            Map<String, byte[]> unsafeEntries = new HashMap<>();
            unsafeEntries.put(unsafeName, "attack".getBytes(StandardCharsets.UTF_8));
            byte[] unsafe = crypto.encrypt(zip(unsafeEntries), PASSPHRASE.toCharArray());
            mvc.perform(restoreRequest("/api/backups/restore/preview", owner, unsafe, PASSPHRASE, null))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.error.code", is("BACKUP_CORRUPTED")));
        }

        Map<String, byte[]> excessiveEntries = new HashMap<>();
        for (int index = 0; index < 31; index++) {
            excessiveEntries.put("attachments/" + index + ".bin", new byte[]{1});
        }
        byte[] excessive = crypto.encrypt(zip(excessiveEntries), PASSPHRASE.toCharArray());
        mvc.perform(restoreRequest("/api/backups/restore/preview", owner, excessive, PASSPHRASE, null))
                .andExpect(status().isPayloadTooLarge())
                .andExpect(jsonPath("$.error.code", is("BACKUP_TOO_LARGE")));

        Map<String, byte[]> expandedEntries = Map.of("attachments/large.bin", new byte[65 * 1024]);
        byte[] expanded = crypto.encrypt(zip(expandedEntries), PASSPHRASE.toCharArray());
        mvc.perform(restoreRequest("/api/backups/restore/preview", owner, expanded, PASSPHRASE, null))
                .andExpect(status().isPayloadTooLarge())
                .andExpect(jsonPath("$.error.code", is("BACKUP_TOO_LARGE")));
    }

    @Test
    void restoreFailureRollsBackDatabaseAndCompensatesStagedFiles() throws Exception {
        Client owner = client("failure@example.com");
        long company = simpleLedger(owner, "Failure Source");
        long transaction = jdbc.queryForObject("SELECT id FROM transactions WHERE company_id=?",
                Long.class, company);
        upload(owner, company, transaction, "failure.pdf", "application/pdf", PDF);
        byte[] backup = backup(owner, company, PASSPHRASE);
        long filesBefore = storedFileCount();
        int companiesBefore = count("SELECT COUNT(*) FROM companies");
        jdbc.execute("""
                CREATE TRIGGER fail_restore_audit BEFORE INSERT ON audit_log
                WHEN NEW.action='COMPANY_RESTORED'
                BEGIN SELECT RAISE(ABORT, 'forced restore failure'); END
                """);

        mvc.perform(restoreRequest("/api/backups/restore/commit", owner, backup,
                        PASSPHRASE, "Failure Restored"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error.code", is("RESTORE_FAILED")));
        assertEquals(companiesBefore, count("SELECT COUNT(*) FROM companies"));
        assertEquals(0, count("SELECT COUNT(*) FROM companies WHERE name='Failure Restored'"));
        assertEquals(filesBefore, storedFileCount());
    }

    @Test
    void currentLegacyWorkspacePreviewsAndImportsWithoutFakeAttachments() throws Exception {
        Client owner = client("legacy@example.com");
        long existing = simpleLedger(owner, "Existing Server Co");
        String legacy = legacyWorkspace(25_000);

        mvc.perform(json(post("/api/import/legacy/preview"), owner).content(legacy))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.counts.companies", is(1)))
                .andExpect(jsonPath("$.data.counts.transactions", is(1)))
                .andExpect(jsonPath("$.data.counts.attachments", is(0)))
                .andExpect(jsonPath("$.data.warnings", hasItem(containsString("cannot be migrated"))));
        MvcResult result = mvc.perform(json(post("/api/import/legacy/commit"), owner).content(legacy))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.warnings", hasSize(2)))
                .andExpect(jsonPath("$.data.warnings", hasItem(containsString("cannot be migrated"))))
                .andReturn();
        long imported = mapper.readTree(result.getResponse().getContentAsString())
                .at("/data/companyIds/0").longValue();
        assertNotEquals(900, imported);
        assertEquals(1, count("SELECT COUNT(*) FROM companies WHERE id=?", existing));
        assertEquals(25_000L, jdbc.queryForObject(
                "SELECT amount FROM transactions WHERE company_id=?", Long.class, imported));
        assertEquals("2026-09-13", jdbc.queryForObject(
                "SELECT transaction_date FROM transactions WHERE company_id=?", String.class, imported));
        assertEquals("Legacy Header", jdbc.queryForObject(
                "SELECT statement_header FROM company_settings WHERE company_id=?", String.class, imported));
        assertEquals(0, count("SELECT COUNT(*) FROM transaction_attachments WHERE company_id=?", imported));
        assertEquals(1, count("""
                SELECT COUNT(*) FROM company_memberships
                WHERE company_id=? AND user_id=? AND role='OWNER' AND status='ACTIVE'
                """, imported, userId("legacy@example.com")));
        assertTrue(jdbc.queryForObject("SELECT appearance_json FROM user_preferences WHERE user_id=?",
                String.class, userId("legacy@example.com")).contains("dark"));
        assertEquals(1, count("SELECT COUNT(*) FROM audit_log WHERE action='LEGACY_IMPORT_COMMITTED'"));

        String decimal = legacyWorkspace(25_000).replace("\"amount\":25000", "\"amount\":25000.5");
        int before = count("SELECT COUNT(*) FROM companies");
        mvc.perform(json(post("/api/import/legacy/preview"), owner).content(decimal))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.code", is("LEGACY_IMPORT_INVALID")));
        assertEquals(before, count("SELECT COUNT(*) FROM companies"));
    }

    private byte[] backup(Client client, long companyId, String passphrase) throws Exception {
        return mvc.perform(json(post("/api/companies/{id}/backup", companyId), client)
                        .content("{\"passphrase\":\"" + passphrase + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
    }

    private MockMultipartHttpServletRequestBuilder restoreRequest(String url, Client client, byte[] backup,
                                                                  String passphrase, String companyName) {
        var request = multipart(url).file(new MockMultipartFile("file", "company.lfbak",
                "application/vnd.ledgerflow.backup", backup));
        var passphrasePart = new MockPart("passphrase", passphrase.getBytes(StandardCharsets.UTF_8));
        passphrasePart.getHeaders().setContentType(MediaType.TEXT_PLAIN);
        request.part(passphrasePart);
        if (companyName != null) {
            var namePart = new MockPart("companyName", companyName.getBytes(StandardCharsets.UTF_8));
            namePart.getHeaders().setContentType(MediaType.TEXT_PLAIN);
            request.part(namePart);
        }
        return withAuth(request, client);
    }

    private long simpleLedger(Client client, String companyName) throws Exception {
        long company = createCompany(client, companyName);
        long region = createRegion(client, company, "North");
        long party = createParty(client, company, region, "Customer", "");
        createTransaction(client, company, party, "CREDIT", 1_000, "2026-09-13", "Invoice");
        return company;
    }

    private long createCompany(Client client, String name) throws Exception {
        return id(mvc.perform(json(post("/api/companies"), client)
                        .content("{\"name\":\"" + name + "\"}"))
                .andExpect(status().isCreated()).andReturn());
    }

    private long createRegion(Client client, long company, String name) throws Exception {
        return id(mvc.perform(json(post("/api/companies/{id}/regions", company), client)
                        .content("{\"name\":\"" + name + "\"}"))
                .andExpect(status().isCreated()).andReturn());
    }

    private long createParty(Client client, long company, long region, String name, String gstin) throws Exception {
        String body = mapper.writeValueAsString(Map.of("regionId", region, "name", name, "gstin", gstin,
                "phone", "9876543210", "notes", "Party notes"));
        return id(mvc.perform(json(post("/api/companies/{id}/parties", company), client).content(body))
                .andExpect(status().isCreated()).andReturn());
    }

    private long createTransaction(Client client, long company, long party, String type, long amount,
                                   String date, String description) throws Exception {
        String body = mapper.writeValueAsString(Map.of("partyId", party, "type", type, "amount", amount,
                "transactionDate", date, "description", description, "notes", "Transaction notes"));
        return id(mvc.perform(json(post("/api/companies/{id}/transactions", company), client).content(body))
                .andExpect(status().isCreated()).andReturn());
    }

    private void upload(Client client, long company, long transaction, String name,
                        String mime, byte[] bytes) throws Exception {
        mvc.perform(withAuth(multipart("/api/companies/{company}/transactions/{tx}/attachment",
                        company, transaction).file(new MockMultipartFile("file", name, mime, bytes)), client))
                .andExpect(status().isCreated());
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
        jdbc.update("""
                INSERT INTO company_memberships(company_id, user_id, role, status, created_at, updated_at)
                VALUES (?, ?, ?, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT(company_id, user_id) DO UPDATE SET role=excluded.role, status='ACTIVE',
                    updated_at=CURRENT_TIMESTAMP
                """, companyId, userId, role);
    }
    private int count(String sql, Object... parameters) {
        Integer value = jdbc.queryForObject(sql, Integer.class, parameters);
        return value == null ? 0 : value;
    }
    private long storedFileCount() throws IOException {
        Path root = DATA_PATH.resolve("attachments");
        if (!Files.exists(root)) return 0;
        try (var paths = Files.walk(root)) { return paths.filter(Files::isRegularFile).count(); }
    }

    private Map<String, byte[]> unzip(byte[] bytes) throws IOException {
        Map<String, byte[]> entries = new HashMap<>();
        try (var input = new ZipInputStream(new ByteArrayInputStream(bytes), StandardCharsets.UTF_8)) {
            ZipEntry entry;
            while ((entry = input.getNextEntry()) != null) entries.put(entry.getName(), input.readAllBytes());
        }
        return entries;
    }
    private byte[] zip(Map<String, byte[]> entries) throws IOException {
        var output = new ByteArrayOutputStream();
        try (var zip = new ZipOutputStream(output, StandardCharsets.UTF_8)) {
            for (var entry : entries.entrySet()) {
                zip.putNextEntry(new ZipEntry(entry.getKey()));
                zip.write(entry.getValue());
                zip.closeEntry();
            }
        }
        return output.toByteArray();
    }

    private String legacyWorkspace(long amount) {
        return """
                {
                  "format":"ledgerflow-backup","version":1,"scope":"full","createdAt":"2026-09-13T10:00:00Z",
                  "data":{
                    "companies":[{"id":900,"name":"Legacy Co","address":"Legacy Address",
                      "phone":"9876543210","gstin":"03ABCDE1234F1Z5","email":"legacy@example.com",
                      "createdAt":"2026-01-01T00:00:00Z","settings":{
                        "statementHeader":"Legacy Header","statementFooter":"Legacy Footer","print":{
                          "defaultTransactionLimit":25,"showRunningBalance":true,"showNotes":true,
                          "showAttachment":true,"showBusinessAddress":true,"showBusinessPhone":true,
                          "showBusinessGstin":true,"showGeneratedDate":true,"showPageNumbers":true,
                          "paperSize":"A4","orientation":"portrait","fontSize":"normal","customFooter":"Footer"
                        }}}],
                    "activeCompanyId":900,
                    "regions":[{"id":901,"companyId":900,"name":"Punjab"}],
                    "parties":[{"id":902,"companyId":900,"name":"ABC Traders","phone":"9876543210",
                      "regionId":901,"address":"Address","gstin":"","notes":"Notes",
                      "createdAt":"2026-01-01T00:00:00Z"}],
                    "transactions":[{"id":903,"companyId":900,"partyId":902,"type":"CREDIT",
                      "amount":%d,"transactionDate":"2026-09-13T10:30:00Z","description":"Legacy invoice",
                      "notes":"Legacy notes","attachmentName":"invoice.pdf","createdAt":"2026-09-13T10:30:00Z"}],
                    "applicationSettings":{"appearance":{"fontFamily":"inter","baseFontSize":14,
                      "uiScale":100,"density":"comfortable","tableDensity":"normal",
                      "accentColor":"blue","theme":"dark"}}
                  }
                }
                """.formatted(amount);
    }

    private static void removeTree(Path path) throws IOException {
        if (!Files.exists(path)) return;
        try (var paths = Files.walk(path)) {
            for (Path item : paths.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(item);
        }
    }

    private record Csrf(Cookie cookie, String token) {}
    private record Client(Csrf csrf, Cookie session) {}
}
