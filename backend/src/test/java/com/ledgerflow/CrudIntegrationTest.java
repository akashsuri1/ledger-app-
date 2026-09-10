package com.ledgerflow;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.UUID;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
class CrudIntegrationTest {
    private static final Path DATABASE_PATH = Path.of(System.getProperty("java.io.tmpdir"),
            "ledgerflow-crud-" + UUID.randomUUID() + ".db");
    private static final String PASSWORD = "correct horse battery staple";

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("ledgerflow.database.path", DATABASE_PATH::toString);
        registry.add("ledgerflow.security.auth-rate-limit", () -> 1000);
    }

    MockMvc mvc;
    @Autowired WebApplicationContext webContext;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void clean() {
        mvc = MockMvcBuilders.webAppContextSetup(webContext).apply(springSecurity()).build();
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
    }

    @AfterAll
    static void removeDatabase() throws IOException {
        Files.deleteIfExists(DATABASE_PATH);
        Files.deleteIfExists(Path.of(DATABASE_PATH + "-wal"));
        Files.deleteIfExists(Path.of(DATABASE_PATH + "-shm"));
    }

    @Test
    void companyCreationLifecycleRolesAndIsolation() throws Exception {
        Client owner = client("owner@example.com");
        Client other = client("other@example.com");
        long company = createCompany(owner, "  Alpha   Traders  ");

        assertEquals("Alpha Traders", jdbc.queryForObject("SELECT name FROM companies WHERE id=?", String.class, company));
        assertEquals("OWNER", jdbc.queryForObject(
                "SELECT role FROM company_memberships WHERE company_id=? AND user_id=?",
                String.class, company, userId("owner@example.com")));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM company_settings WHERE company_id=?", Integer.class, company));
        mvc.perform(get("/api/me/bootstrap").cookie(owner.session))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.companies", hasSize(1)))
                .andExpect(jsonPath("$.data.companies[0].id", is((int) company)));
        mvc.perform(get("/api/companies").cookie(owner.session))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data", hasSize(1)))
                .andExpect(jsonPath("$.data[0].id", is((int) company)));

        mvc.perform(request(post("/api/companies"), owner).content(companyJson("alpha traders")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code", is("COMPANY_ALREADY_EXISTS")));
        long otherCompany = createCompany(other, "ALPHA TRADERS");
        assertTrue(otherCompany != company);
        mvc.perform(get("/api/companies/{id}", company).cookie(other.session))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code", is("COMPANY_ACCESS_DENIED")));

        long adminId = userId("other@example.com");
        membership(company, adminId, "ADMIN");
        mvc.perform(request(patch("/api/companies/{id}", company), other)
                        .content("{\"address\":\"Updated address\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.address", is("Updated address")));
        mvc.perform(request(delete("/api/companies/{id}", company), other))
                .andExpect(status().isForbidden());

        long region = createRegion(owner, company, "Punjab");
        mvc.perform(request(delete("/api/companies/{id}", company), owner))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code", is("COMPANY_NOT_EMPTY")));
        mvc.perform(request(delete("/api/companies/{company}/regions/{region}", company, region), owner))
                .andExpect(status().isOk());
        mvc.perform(request(delete("/api/companies/{id}", company), owner)).andExpect(status().isOk());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM companies WHERE id=?", Integer.class, company));
        assertEquals(1, count("SELECT COUNT(*) FROM audit_log WHERE action='COMPANY_DELETED' AND entity_id=?", company));
    }

    @Test
    void companyAndLedgerMutationsRequireCsrf() throws Exception {
        Client owner = client("owner@example.com");
        mvc.perform(post("/api/companies").cookie(owner.session).contentType(MediaType.APPLICATION_JSON)
                        .content(companyJson("No CSRF")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code", is("CSRF_INVALID")));
    }

    @Test
    void regionCrudUniquenessRestrictionCrossCompanyAndViewerRole() throws Exception {
        Client owner = client("owner@example.com");
        Client other = client("other@example.com");
        long companyA = createCompany(owner, "Company A");
        long companyB = createCompany(other, "Company B");
        long punjabA = createRegion(owner, companyA, "Punjab");
        long punjabB = createRegion(other, companyB, "PUNJAB");

        mvc.perform(request(post("/api/companies/{id}/regions", companyA), owner).content("{\"name\":\" punjab \"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error.code", is("REGION_ALREADY_EXISTS")));
        mvc.perform(request(patch("/api/companies/{company}/regions/{region}", companyA, punjabA), owner)
                        .content("{\"name\":\"North Punjab\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.name", is("North Punjab")));
        mvc.perform(request(patch("/api/companies/{company}/regions/{region}", companyA, punjabB), owner)
                        .content("{\"name\":\"Stolen\"}"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.error.code", is("REGION_NOT_FOUND")));

        membership(companyA, userId("other@example.com"), "VIEWER");
        mvc.perform(get("/api/companies/{id}/regions", companyA).cookie(other.session)).andExpect(status().isOk());
        mvc.perform(request(post("/api/companies/{id}/regions", companyA), other).content("{\"name\":\"Delhi\"}"))
                .andExpect(status().isForbidden());

        long party = createParty(owner, companyA, punjabA, "ABC Traders", "");
        mvc.perform(request(delete("/api/companies/{company}/regions/{region}", companyA, punjabA), owner))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error.code", is("REGION_NOT_EMPTY")));
        mvc.perform(request(delete("/api/companies/{company}/parties/{party}", companyA, party), owner))
                .andExpect(status().isOk());
        mvc.perform(request(delete("/api/companies/{company}/regions/{region}", companyA, punjabA), owner))
                .andExpect(status().isOk());
        membership(companyA, userId("other@example.com"), "ACCOUNTANT");
        mvc.perform(request(post("/api/companies/{id}/regions", companyA), other)
                        .content("{\"name\":\"Accountant Region\"}"))
                .andExpect(status().isCreated());
    }

    @Test
    void partyCrudSearchPaginationUniquenessIsolationAndViewerRole() throws Exception {
        Client owner = client("owner@example.com");
        Client other = client("other@example.com");
        long companyA = createCompany(owner, "Company A");
        long companyB = createCompany(other, "Company B");
        long punjabA = createRegion(owner, companyA, "Punjab");
        long delhiA = createRegion(owner, companyA, "Delhi");
        long punjabB = createRegion(other, companyB, "Punjab");

        long partyA = createParty(owner, companyA, punjabA, "ABC Traders", "03abcde1234f1z5");
        mvc.perform(get("/api/companies/{company}/parties/{party}", companyA, partyA).cookie(owner.session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.gstin", is("03ABCDE1234F1Z5")))
                .andExpect(jsonPath("$.data.balance", is(0)))
                .andExpect(jsonPath("$.data.transactionCount", is(0)));

        mvc.perform(request(post("/api/companies/{id}/parties", companyA), owner)
                        .content(partyJson(punjabB, "Wrong Region", "")))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.error.code", is("REGION_NOT_FOUND")));
        mvc.perform(request(post("/api/companies/{id}/parties", companyA), owner)
                        .content(partyJson(punjabA, " abc   traders ", "")))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error.code", is("PARTY_ALREADY_EXISTS")));
        createParty(owner, companyA, delhiA, "ABC Traders", "");
        createParty(other, companyB, punjabB, "ABC Traders", "03abcde1234f1z5");
        mvc.perform(request(post("/api/companies/{id}/parties", companyA), owner)
                        .content(partyJson(delhiA, "Unique Name", "03ABCDE1234F1Z5")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code", is("PARTY_GSTIN_ALREADY_EXISTS")));

        mvc.perform(request(patch("/api/companies/{company}/parties/{party}", companyA, partyA), owner)
                        .content("{\"name\":\"ABC Wholesale\",\"notes\":\"Special search phrase\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.name", is("ABC Wholesale")));
        createParty(owner, companyA, punjabA, "Third Party", "");
        mvc.perform(get("/api/companies/{id}/parties", companyA).cookie(owner.session)
                        .param("search", "special search").param("page", "1").param("pageSize", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data", hasSize(1)))
                .andExpect(jsonPath("$.data[0].id", is((int) partyA)))
                .andExpect(jsonPath("$.meta.total", is(1)))
                .andExpect(jsonPath("$.meta.totalPages", is(1)));
        mvc.perform(get("/api/companies/{id}/parties", companyA).cookie(owner.session)
                        .param("page", "2").param("pageSize", "2"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.meta.total", is(3)))
                .andExpect(jsonPath("$.meta.totalPages", is(2)));

        long partyB = jdbc.queryForObject("SELECT id FROM parties WHERE company_id=? LIMIT 1", Long.class, companyB);
        mvc.perform(get("/api/companies/{company}/parties/{party}", companyA, partyB).cookie(owner.session))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.error.code", is("PARTY_NOT_FOUND")));
        mvc.perform(request(patch("/api/companies/{company}/parties/{party}", companyA, partyB), owner)
                        .content("{\"name\":\"Stolen\"}"))
                .andExpect(status().isNotFound());

        membership(companyA, userId("other@example.com"), "VIEWER");
        mvc.perform(get("/api/companies/{id}/parties", companyA).cookie(other.session)).andExpect(status().isOk());
        mvc.perform(request(patch("/api/companies/{company}/parties/{party}", companyA, partyA), other)
                        .content("{\"name\":\"Forbidden\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void transactionCrudAccountingValidationFiltersOrderingAndIsolation() throws Exception {
        Client owner = client("owner@example.com");
        Client other = client("other@example.com");
        long companyA = createCompany(owner, "Company A");
        long companyB = createCompany(other, "Company B");
        long regionA = createRegion(owner, companyA, "Punjab");
        long regionA2 = createRegion(owner, companyA, "Delhi");
        long regionB = createRegion(other, companyB, "Punjab");
        long partyA = createParty(owner, companyA, regionA, "Party A", "");
        long partyA2 = createParty(owner, companyA, regionA2, "Party B", "");
        long partyB = createParty(other, companyB, regionB, "Foreign Party", "");
        long foreignTx = createTransaction(other, companyB, partyB, "CREDIT", 9000,
                "2026-09-05", "Foreign transaction");

        long credit = createTransaction(owner, companyA, partyA, "CREDIT", 25000, "2026-09-01", "Opening invoice");
        long debit = createTransaction(owner, companyA, partyA, "DEBIT", 10000, "2026-09-30", "Payment received");
        mvc.perform(get("/api/companies/{company}/parties/{party}", companyA, partyA).cookie(owner.session))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.balance", is(15000)))
                .andExpect(jsonPath("$.data.transactionCount", is(2)));

        mvc.perform(request(post("/api/companies/{id}/transactions", companyA), owner)
                        .content(transactionJson(partyA, "CREDIT", "0", "2026-09-10", "Zero")))
                .andExpect(status().isUnprocessableEntity());
        mvc.perform(request(post("/api/companies/{id}/transactions", companyA), owner)
                        .content(transactionJson(partyA, "CREDIT", "-10", "2026-09-10", "Negative")))
                .andExpect(status().isUnprocessableEntity());
        mvc.perform(request(post("/api/companies/{id}/transactions", companyA), owner)
                        .content(transactionJson(partyA, "CREDIT", "25000.50", "2026-09-10", "Decimal")))
                .andExpect(status().isUnprocessableEntity());
        mvc.perform(request(post("/api/companies/{id}/transactions", companyA), owner)
                        .content(transactionJson(partyA, "OTHER", "10", "2026-09-10", "Bad type")))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.code", is("INVALID_TRANSACTION_TYPE")));
        mvc.perform(request(post("/api/companies/{id}/transactions", companyA), owner)
                        .content(transactionJson(partyA, "CREDIT", "10", "2026-02-30", "Bad date")))
                .andExpect(status().isUnprocessableEntity());
        mvc.perform(request(post("/api/companies/{id}/transactions", companyA), owner)
                        .content(transactionJson(partyB, "CREDIT", "10", "2026-09-10", "Foreign")))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.error.code", is("PARTY_NOT_FOUND")));

        mvc.perform(request(patch("/api/companies/{company}/transactions/{tx}", companyA, credit), owner)
                        .content("{\"amount\":30000}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.amount", is(30000)));
        mvc.perform(get("/api/companies/{company}/parties/{party}", companyA, partyA).cookie(owner.session))
                .andExpect(jsonPath("$.data.balance", is(20000)));
        long movable = createTransaction(owner, companyA, partyA, "DEBIT", 2000, "2026-09-15", "Move me");
        mvc.perform(request(patch("/api/companies/{company}/transactions/{tx}", companyA, movable), owner)
                        .content("{\"partyId\":" + partyA2 + ",\"type\":\"CREDIT\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.partyId", is((int) partyA2)))
                .andExpect(jsonPath("$.data.type", is("CREDIT")));
        mvc.perform(request(patch("/api/companies/{company}/transactions/{tx}", companyA, movable), owner)
                        .content("{\"partyId\":" + partyB + "}"))
                .andExpect(status().isNotFound());

        long sameDateLater = createTransaction(owner, companyA, partyA2, "CREDIT", 5000, "2026-09-30", "Searchable bonus");
        mvc.perform(get("/api/companies/{id}/transactions", companyA).cookie(owner.session)
                        .param("page", "1").param("pageSize", "10"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].id", is((int) sameDateLater)));
        mvc.perform(get("/api/companies/{id}/transactions", companyA).cookie(owner.session).param("search", "bonus"))
                .andExpect(jsonPath("$.meta.total", is(1)));
        mvc.perform(get("/api/companies/{id}/transactions", companyA).cookie(owner.session)
                        .param("partyId", Long.toString(partyA)).param("type", "CREDIT"))
                .andExpect(jsonPath("$.meta.total", is(1)));
        mvc.perform(get("/api/companies/{id}/transactions", companyA).cookie(owner.session)
                        .param("regionId", Long.toString(regionA2)))
                .andExpect(jsonPath("$.meta.total", is(2)));
        mvc.perform(get("/api/companies/{id}/transactions", companyA).cookie(owner.session)
                        .param("from", "2026-09-01").param("to", "2026-09-30")
                        .param("page", "2").param("pageSize", "2"))
                .andExpect(jsonPath("$.meta.total", is(4))).andExpect(jsonPath("$.meta.totalPages", is(2)));
        mvc.perform(get("/api/companies/{id}/transactions", companyA).cookie(owner.session)
                        .param("from", "2026-10-01").param("to", "2026-09-01"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.code", is("INVALID_DATE_RANGE")));

        mvc.perform(get("/api/companies/{company}/transactions/{tx}", companyA, foreignTx).cookie(owner.session))
                .andExpect(status().isNotFound());
        mvc.perform(request(patch("/api/companies/{company}/transactions/{tx}", companyA, foreignTx), owner)
                        .content("{\"amount\":1}"))
                .andExpect(status().isNotFound());
        membership(companyA, userId("other@example.com"), "VIEWER");
        mvc.perform(request(delete("/api/companies/{company}/transactions/{tx}", companyA, credit), other))
                .andExpect(status().isForbidden());

        mvc.perform(request(delete("/api/companies/{company}/transactions/{tx}", companyA, debit), owner))
                .andExpect(status().isOk());
        mvc.perform(get("/api/companies/{company}/parties/{party}", companyA, partyA).cookie(owner.session))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.balance", is(30000)))
                .andExpect(jsonPath("$.data.transactionCount", is(1)));
    }

    @Test
    void partyDeleteCascadesOnlyItsTransactionsAndAttachmentMetadata() throws Exception {
        Client owner = client("owner@example.com");
        Client other = client("other@example.com");
        long companyA = createCompany(owner, "Company A");
        long companyB = createCompany(other, "Company B");
        long regionA = createRegion(owner, companyA, "Punjab");
        long regionB = createRegion(other, companyB, "Punjab");
        long partyA = createParty(owner, companyA, regionA, "Party A", "");
        long partyA2 = createParty(owner, companyA, regionA, "Party B", "");
        long partyB = createParty(other, companyB, regionB, "Party Foreign", "");
        long txA1 = createTransaction(owner, companyA, partyA, "CREDIT", 25000, "2026-09-01", "A credit");
        createTransaction(owner, companyA, partyA, "DEBIT", 10000, "2026-09-02", "A debit");
        long txA2 = createTransaction(owner, companyA, partyA2, "CREDIT", 5000, "2026-09-03", "B credit");
        long txB = createTransaction(other, companyB, partyB, "CREDIT", 7000, "2026-09-04", "Foreign credit");
        jdbc.update("""
                INSERT INTO transaction_attachments(company_id,transaction_id,storage_key,original_name,mime_type,byte_size,created_at)
                VALUES(?,?,?,'receipt.pdf','application/pdf',100,?)
                """, companyA, txA1, "company-a/receipt.pdf", Instant.now().toString());

        mvc.perform(request(delete("/api/companies/{company}/parties/{party}", companyA, partyA), owner))
                .andExpect(status().isOk());
        assertEquals(0, count("SELECT COUNT(*) FROM parties WHERE id=?", partyA));
        assertEquals(0, count("SELECT COUNT(*) FROM transactions WHERE party_id=?", partyA));
        assertEquals(0, count("SELECT COUNT(*) FROM transaction_attachments WHERE transaction_id=?", txA1));
        assertEquals(1, count("SELECT COUNT(*) FROM parties WHERE id=?", partyA2));
        assertEquals(1, count("SELECT COUNT(*) FROM transactions WHERE id=?", txA2));
        assertEquals(1, count("SELECT COUNT(*) FROM transactions WHERE id=?", txB));
        assertEquals(0, count("SELECT COUNT(*) FROM transactions t LEFT JOIN parties p ON p.id=t.party_id AND p.company_id=t.company_id WHERE p.id IS NULL"));
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

    private MockHttpServletRequestBuilder withCsrf(MockHttpServletRequestBuilder request, Csrf csrf) {
        return request.cookie(csrf.cookie).header("X-XSRF-TOKEN", csrf.token);
    }

    private MockHttpServletRequestBuilder request(MockHttpServletRequestBuilder request, Client client) {
        return withCsrf(request, client.csrf).cookie(client.session).contentType(MediaType.APPLICATION_JSON);
    }

    private long createCompany(Client client, String name) throws Exception {
        MvcResult result = mvc.perform(request(post("/api/companies"), client).content(companyJson(name)))
                .andExpect(status().isCreated()).andReturn();
        return id(result);
    }

    private long createRegion(Client client, long companyId, String name) throws Exception {
        MvcResult result = mvc.perform(request(post("/api/companies/{id}/regions", companyId), client)
                        .content("{\"name\":\"" + name + "\"}"))
                .andExpect(status().isCreated()).andReturn();
        return id(result);
    }

    private long createParty(Client client, long companyId, long regionId, String name, String gstin) throws Exception {
        MvcResult result = mvc.perform(request(post("/api/companies/{id}/parties", companyId), client)
                        .content(partyJson(regionId, name, gstin)))
                .andExpect(status().isCreated()).andReturn();
        return id(result);
    }

    private long createTransaction(Client client, long companyId, long partyId, String type,
                                   long amount, String date, String description) throws Exception {
        MvcResult result = mvc.perform(request(post("/api/companies/{id}/transactions", companyId), client)
                        .content(transactionJson(partyId, type, Long.toString(amount), date, description)))
                .andExpect(status().isCreated()).andReturn();
        return id(result);
    }

    private long id(MvcResult result) throws Exception {
        return mapper.readTree(result.getResponse().getContentAsString()).at("/data/id").longValue();
    }

    private int count(String sql, Object... parameters) {
        Integer result = jdbc.queryForObject(sql, Integer.class, parameters);
        return result == null ? 0 : result;
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

    private String companyJson(String name) {
        return "{\"name\":\"" + name + "\",\"address\":\"Pathankot\","
                + "\"phone\":\"9876543210\",\"gstin\":\" 03abcde1234f1z5 \","
                + "\"email\":\"accounts@example.com\"}";
    }

    private String partyJson(long regionId, String name, String gstin) {
        return "{\"name\":\"" + name + "\",\"regionId\":" + regionId
                + ",\"phone\":\"9876543210\",\"address\":\"Market Road\","
                + "\"gstin\":\"" + gstin + "\",\"notes\":\"Preferred customer\"}";
    }

    private String transactionJson(long partyId, String type, String amount, String date, String description) {
        return "{\"partyId\":" + partyId + ",\"type\":\"" + type + "\",\"amount\":" + amount
                + ",\"transactionDate\":\"" + date + "\",\"description\":\"" + description
                + "\",\"notes\":\"September entry\"}";
    }

    private record Csrf(Cookie cookie, String token) {}
    private record Client(Csrf csrf, Cookie session) {}
}
