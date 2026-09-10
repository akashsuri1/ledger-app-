package com.ledgerflow;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDate;
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
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
class Milestone4IntegrationTest {
    private static final Path DATABASE_PATH = Path.of(System.getProperty("java.io.tmpdir"),
            "ledgerflow-m4-" + UUID.randomUUID() + ".db");
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
    void dashboardCalculatesPartySplitsRegionsRecentRowsChartAndIsolation() throws Exception {
        Client owner = client("owner@example.com");
        Client outsider = client("outside@example.com");
        long emptyCompany = createCompany(owner, "Empty Company");
        mvc.perform(get("/api/companies/{id}/dashboard", emptyCompany).cookie(owner.session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.partyCount", is(0)))
                .andExpect(jsonPath("$.data.transactionCount", is(0)))
                .andExpect(jsonPath("$.data.totalReceivable", is(0)))
                .andExpect(jsonPath("$.data.totalPayable", is(0)))
                .andExpect(jsonPath("$.data.netBalance", is(0)))
                .andExpect(jsonPath("$.data.chart", hasSize(6)));

        long company = createCompany(owner, "Dashboard Company");
        long regionA = createRegion(owner, company, "Punjab");
        createRegion(owner, company, "Empty Region");
        long partyA = createParty(owner, company, regionA, "Party A");
        long partyB = createParty(owner, company, regionA, "Party B");
        String today = LocalDate.now().toString();
        createTransaction(owner, company, partyA, "CREDIT", 25000, today, "Credit");
        long debitA = createTransaction(owner, company, partyA, "DEBIT", 10000, today, "Debit A");
        long debitB = createTransaction(owner, company, partyB, "DEBIT", 5000, today, "Debit B");

        long foreignCompany = createCompany(outsider, "Foreign Company");
        long foreignRegion = createRegion(outsider, foreignCompany, "Foreign");
        long foreignParty = createParty(outsider, foreignCompany, foreignRegion, "Foreign Party");
        createTransaction(outsider, foreignCompany, foreignParty, "CREDIT", 999999, today, "Foreign");

        mvc.perform(get("/api/companies/{id}/dashboard", company).cookie(owner.session)
                        .param("recentLimit", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.partyCount", is(2)))
                .andExpect(jsonPath("$.data.transactionCount", is(3)))
                .andExpect(jsonPath("$.data.totalReceivable", is(15000)))
                .andExpect(jsonPath("$.data.totalPayable", is(5000)))
                .andExpect(jsonPath("$.data.netBalance", is(10000)))
                .andExpect(jsonPath("$.data.recentTransactions", hasSize(2)))
                .andExpect(jsonPath("$.data.recentTransactions[0].id", is((int) debitB)))
                .andExpect(jsonPath("$.data.recentTransactions[1].id", is((int) debitA)))
                .andExpect(jsonPath("$.data.regions", hasSize(2)));

        String month = today.substring(0, 7);
        mvc.perform(get("/api/companies/{id}/dashboard", company).cookie(owner.session))
                .andExpect(jsonPath("$.data.chart[?(@.key == '" + month + "')].credit", is(java.util.List.of(25000))))
                .andExpect(jsonPath("$.data.chart[?(@.key == '" + month + "')].debit", is(java.util.List.of(15000))));
        mvc.perform(get("/api/companies/{id}/dashboard", company).cookie(outsider.session))
                .andExpect(status().isNotFound());
        membership(company, userId("outside@example.com"), "VIEWER");
        mvc.perform(get("/api/companies/{id}/dashboard", company).cookie(outsider.session))
                .andExpect(status().isOk());
        mvc.perform(get("/api/companies/{id}/dashboard", company).cookie(owner.session)
                        .param("recentLimit", "26"))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void settingsDefaultsValidateRolesStayCompanyScopedAndDoNotChangeAppearance() throws Exception {
        Client owner = client("owner@example.com");
        Client member = client("member@example.com");
        long companyA = createCompany(owner, "Company A");
        long companyB = createCompany(owner, "Company B");

        mvc.perform(get("/api/companies/{id}/settings", companyA).cookie(owner.session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.defaultTransactionLimit", is(25)))
                .andExpect(jsonPath("$.data.paperSize", is("A4")))
                .andExpect(jsonPath("$.data.orientation", is("portrait")));
        mvc.perform(request(patch("/api/me/preferences"), owner)
                        .content("{\"appearance\":{\"theme\":\"dark\"}}"))
                .andExpect(status().isOk());
        mvc.perform(request(patch("/api/companies/{id}/settings", companyA), owner).content("""
                {"statementHeader":"Account Summary","statementFooter":"Thank you",
                 "defaultTransactionLimit":"ALL","showRunningBalance":false,"showNotes":true,
                 "showAttachment":false,"showBusinessAddress":false,"showBusinessPhone":false,
                 "showBusinessGstin":false,"showGeneratedDate":false,"showPageNumbers":false,
                 "paperSize":"A4","orientation":"landscape","fontSize":"large","customFooter":"Pay soon"}
                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.defaultTransactionLimit", is("ALL")))
                .andExpect(jsonPath("$.data.orientation", is("landscape")))
                .andExpect(jsonPath("$.data.showNotes", is(true)));
        assertEquals("{\"theme\":\"dark\"}", jdbc.queryForObject(
                "SELECT appearance_json FROM user_preferences WHERE user_id=?", String.class, userId("owner@example.com")));
        mvc.perform(get("/api/companies/{id}/settings", companyB).cookie(owner.session))
                .andExpect(jsonPath("$.data.statementHeader", is("Statement of Account")))
                .andExpect(jsonPath("$.data.orientation", is("portrait")));

        mvc.perform(request(patch("/api/companies/{id}/settings", companyA), owner)
                        .content("{\"orientation\":\"diagonal\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.code", is("COMPANY_SETTINGS_INVALID")));
        membership(companyA, userId("member@example.com"), "ADMIN");
        mvc.perform(request(patch("/api/companies/{id}/settings", companyA), member)
                        .content("{\"fontSize\":\"small\"}"))
                .andExpect(status().isOk());
        membership(companyA, userId("member@example.com"), "ACCOUNTANT");
        mvc.perform(request(patch("/api/companies/{id}/settings", companyA), member)
                        .content("{\"defaultTransactionLimit\":50}"))
                .andExpect(status().isOk());
        membership(companyA, userId("member@example.com"), "VIEWER");
        mvc.perform(get("/api/companies/{id}/settings", companyA).cookie(member.session))
                .andExpect(status().isOk());
        mvc.perform(request(patch("/api/companies/{id}/settings", companyA), member)
                        .content("{\"showNotes\":false}"))
                .andExpect(status().isForbidden());
        assertEquals(3, count("SELECT COUNT(*) FROM audit_log WHERE action='COMPANY_SETTINGS_UPDATED'"));
    }

    @Test
    void partyStatementCalculatesOpeningPeriodClosingAndLatestN() throws Exception {
        Client owner = client("owner@example.com");
        long company = createCompany(owner, "Reports Company");
        long region = createRegion(owner, company, "Punjab");
        long party = createParty(owner, company, region, "Statement Party");
        createTransaction(owner, company, party, "CREDIT", 10000, "2026-08-01", "One");
        createTransaction(owner, company, party, "DEBIT", 2000, "2026-08-05", "Two");
        long third = createTransaction(owner, company, party, "CREDIT", 5000, "2026-08-10", "Three");
        long fourth = createTransaction(owner, company, party, "DEBIT", 3000, "2026-08-20", "Four");

        mvc.perform(get("/api/companies/{company}/reports/party-statement", company).cookie(owner.session)
                        .param("partyId", Long.toString(party)).param("from", "2026-08-10")
                        .param("to", "2026-08-20").param("limit", "ALL"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.openingBalance", is(8000)))
                .andExpect(jsonPath("$.data.totalCredit", is(5000)))
                .andExpect(jsonPath("$.data.totalDebit", is(3000)))
                .andExpect(jsonPath("$.data.closingBalance", is(10000)))
                .andExpect(jsonPath("$.data.transactions", hasSize(2)))
                .andExpect(jsonPath("$.data.transactions[0].id", is((int) third)))
                .andExpect(jsonPath("$.data.transactions[0].runningBalance", is(13000)))
                .andExpect(jsonPath("$.data.transactions[1].id", is((int) fourth)))
                .andExpect(jsonPath("$.data.transactions[1].runningBalance", is(10000)));

        long lastNParty = createParty(owner, company, region, "Last N Party");
        long eighth = 0;
        for (int index = 1; index <= 10; index++) {
            long id = createTransaction(owner, company, lastNParty, "CREDIT", 100,
                    "2026-09-" + String.format("%02d", index), "Entry " + index);
            if (index == 8) eighth = id;
        }
        mvc.perform(get("/api/companies/{company}/reports/party-statement", company).cookie(owner.session)
                        .param("partyId", Long.toString(lastNParty)).param("limit", "3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.eligibleTransactionCount", is(10)))
                .andExpect(jsonPath("$.data.displayedTransactionCount", is(3)))
                .andExpect(jsonPath("$.data.openingBalance", is(700)))
                .andExpect(jsonPath("$.data.closingBalance", is(1000)))
                .andExpect(jsonPath("$.data.transactions[0].id", is((int) eighth)))
                .andExpect(jsonPath("$.data.transactions[2].runningBalance", is(1000)));
        mvc.perform(get("/api/companies/{company}/reports/party-statement", company).cookie(owner.session)
                        .param("partyId", Long.toString(lastNParty)).param("limit", "10001"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.code", is("INVALID_REPORT_LIMIT")));
        mvc.perform(get("/api/companies/{company}/reports/party-statement", company).cookie(owner.session))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code", is("MALFORMED_REQUEST")));
    }

    @Test
    void dateRangeReportIsInclusiveFilteredAndAccountingCorrect() throws Exception {
        Client owner = client("owner@example.com");
        long company = createCompany(owner, "Date Report Company");
        long region = createRegion(owner, company, "Punjab");
        long party = createParty(owner, company, region, "Date Party");
        createTransaction(owner, company, party, "CREDIT", 10000, "2026-08-01", "Before");
        long start = createTransaction(owner, company, party, "DEBIT", 2000, "2026-08-10", "Start");
        long end = createTransaction(owner, company, party, "CREDIT", 5000, "2026-08-20", "End");
        createTransaction(owner, company, party, "DEBIT", 3000, "2026-08-21", "After");

        mvc.perform(get("/api/companies/{company}/reports/date-range", company).cookie(owner.session)
                        .param("partyId", Long.toString(party)).param("from", "2026-08-10").param("to", "2026-08-20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.openingBalance", is(10000)))
                .andExpect(jsonPath("$.data.totalCredit", is(5000)))
                .andExpect(jsonPath("$.data.totalDebit", is(2000)))
                .andExpect(jsonPath("$.data.netMovement", is(3000)))
                .andExpect(jsonPath("$.data.closingBalance", is(13000)))
                .andExpect(jsonPath("$.data.transactions", hasSize(2)))
                .andExpect(jsonPath("$.data.transactions[0].id", is((int) start)))
                .andExpect(jsonPath("$.data.transactions[1].id", is((int) end)));
        mvc.perform(get("/api/companies/{company}/reports/date-range", company).cookie(owner.session)
                        .param("from", "2026-09-10").param("to", "2026-09-01"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.code", is("INVALID_DATE_RANGE")));
    }

    @Test
    void regionReportSeparatesActivityFromClosingBalancesAndBlocksForeignIds() throws Exception {
        Client owner = client("owner@example.com");
        Client other = client("other@example.com");
        long company = createCompany(owner, "Region Report Company");
        long regionA = createRegion(owner, company, "Region A");
        long regionB = createRegion(owner, company, "Region B");
        long partyA = createParty(owner, company, regionA, "Party A");
        long partyB = createParty(owner, company, regionA, "Party B");
        long partyC = createParty(owner, company, regionB, "Party C");
        createTransaction(owner, company, partyA, "CREDIT", 25000, "2026-09-01", "Opening A");
        createTransaction(owner, company, partyA, "DEBIT", 10000, "2026-09-02", "Debit A");
        createTransaction(owner, company, partyB, "DEBIT", 5000, "2026-09-03", "Debit B");
        createTransaction(owner, company, partyC, "CREDIT", 7000, "2026-09-04", "Credit C");

        mvc.perform(get("/api/companies/{company}/reports/regions", company).cookie(owner.session)
                        .param("regionId", Long.toString(regionA)).param("from", "2026-09-02")
                        .param("to", "2026-09-30"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.regions", hasSize(1)))
                .andExpect(jsonPath("$.data.regions[0].partyCount", is(2)))
                .andExpect(jsonPath("$.data.regions[0].transactionCount", is(2)))
                .andExpect(jsonPath("$.data.regions[0].totalCredit", is(0)))
                .andExpect(jsonPath("$.data.regions[0].totalDebit", is(15000)))
                .andExpect(jsonPath("$.data.regions[0].openingBalance", is(25000)))
                .andExpect(jsonPath("$.data.regions[0].totalReceivable", is(15000)))
                .andExpect(jsonPath("$.data.regions[0].totalPayable", is(5000)))
                .andExpect(jsonPath("$.data.regions[0].netBalance", is(10000)));

        long foreignCompany = createCompany(other, "Foreign");
        long foreignRegion = createRegion(other, foreignCompany, "Foreign Region");
        long foreignParty = createParty(other, foreignCompany, foreignRegion, "Foreign Party");
        mvc.perform(get("/api/companies/{company}/reports/regions", company).cookie(owner.session)
                        .param("regionId", Long.toString(foreignRegion)))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/companies/{company}/reports/party-statement", company).cookie(owner.session)
                        .param("partyId", Long.toString(foreignParty)))
                .andExpect(status().isNotFound());

        membership(company, userId("other@example.com"), "VIEWER");
        mvc.perform(get("/api/companies/{company}/reports/regions", company).cookie(other.session))
                .andExpect(status().isOk());
        mvc.perform(get("/api/companies/{company}/reports/date-range", company).cookie(other.session))
                .andExpect(status().isOk());
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
        return id(mvc.perform(request(post("/api/companies"), client)
                        .content("{\"name\":\"" + name + "\"}"))
                .andExpect(status().isCreated()).andReturn());
    }

    private long createRegion(Client client, long companyId, String name) throws Exception {
        return id(mvc.perform(request(post("/api/companies/{id}/regions", companyId), client)
                        .content("{\"name\":\"" + name + "\"}"))
                .andExpect(status().isCreated()).andReturn());
    }

    private long createParty(Client client, long companyId, long regionId, String name) throws Exception {
        return id(mvc.perform(request(post("/api/companies/{id}/parties", companyId), client)
                        .content("{\"regionId\":" + regionId + ",\"name\":\"" + name + "\"}"))
                .andExpect(status().isCreated()).andReturn());
    }

    private long createTransaction(Client client, long companyId, long partyId, String type,
                                   long amount, String date, String description) throws Exception {
        return id(mvc.perform(request(post("/api/companies/{id}/transactions", companyId), client)
                        .content("{\"partyId\":" + partyId + ",\"type\":\"" + type
                                + "\",\"amount\":" + amount + ",\"transactionDate\":\"" + date
                                + "\",\"description\":\"" + description + "\"}"))
                .andExpect(status().isCreated()).andReturn());
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

    private record Csrf(Cookie cookie, String token) {}
    private record Client(Csrf csrf, Cookie session) {}
}
