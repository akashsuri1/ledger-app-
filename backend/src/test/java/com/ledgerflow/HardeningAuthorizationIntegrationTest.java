package com.ledgerflow;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.UUID;

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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
class HardeningAuthorizationIntegrationTest {
    private static final Path ROOT = Path.of(System.getProperty("java.io.tmpdir"),
            "ledgerflow-m8-security-" + UUID.randomUUID()).toAbsolutePath().normalize();
    private static final Path DATABASE = ROOT.resolve("ledgerflow.db");
    private static final String PASSWORD = "correct horse battery staple";
    private static final byte[] PDF = "%PDF-1.4\nM8 security fixture".getBytes(java.nio.charset.StandardCharsets.UTF_8);

    @DynamicPropertySource
    static void configuration(DynamicPropertyRegistry registry) {
        registry.add("ledgerflow.database.path", DATABASE::toString);
        registry.add("ledgerflow.data-dir", ROOT::toString);
        registry.add("ledgerflow.security.auth-rate-limit", () -> 1000);
    }

    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper mapper;
    MockMvc mvc;

    @BeforeEach
    void reset() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
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
    static void cleanup() throws Exception {
        if (!ROOT.startsWith(Path.of(System.getProperty("java.io.tmpdir")).toAbsolutePath().normalize()))
            throw new IllegalStateException("Unsafe test-data cleanup target");
        if (Files.exists(ROOT)) {
            try (var paths = Files.walk(ROOT)) {
                for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(path);
            }
        }
    }

    @Test
    void completeRoleMatrixIsEnforcedAtApiBoundary() throws Exception {
        Client owner = registerAndLogin("owner@example.com");
        Client admin = registerAndLogin("admin@example.com");
        Client accountant = registerAndLogin("accountant@example.com");
        Client viewer = registerAndLogin("viewer@example.com");
        long company = id(mvc.perform(json(post("/api/companies"), owner)
                .content("{\"name\":\"Role Matrix Company\"}")).andReturn().getResponse().getContentAsString());
        long region = id(mvc.perform(json(post("/api/companies/{c}/regions", company), owner)
                .content("{\"name\":\"Main\"}")).andReturn().getResponse().getContentAsString());
        long party = id(mvc.perform(json(post("/api/companies/{c}/parties", company), owner)
                .content("{\"name\":\"Main Party\",\"regionId\":" + region + "}"))
                .andReturn().getResponse().getContentAsString());
        long transaction = id(mvc.perform(json(post("/api/companies/{c}/transactions", company), owner)
                .content(transactionBody(party))).andReturn().getResponse().getContentAsString());
        upload(owner, company, transaction, 201);
        membership(company, "admin@example.com", "ADMIN");
        membership(company, "accountant@example.com", "ACCOUNTANT");
        membership(company, "viewer@example.com", "VIEWER");

        for (var role : new RoleClient[] {
                new RoleClient("OWNER", owner), new RoleClient("ADMIN", admin),
                new RoleClient("ACCOUNTANT", accountant), new RoleClient("VIEWER", viewer) }) {
            Client client = role.client();
            boolean writer = !role.role().equals("VIEWER");
            boolean manager = role.role().equals("OWNER") || role.role().equals("ADMIN");
            boolean isOwner = role.role().equals("OWNER");

            for (String path : new String[] {
                    "/api/companies/" + company,
                    "/api/companies/" + company + "/regions",
                    "/api/companies/" + company + "/parties",
                    "/api/companies/" + company + "/parties/" + party,
                    "/api/companies/" + company + "/transactions",
                    "/api/companies/" + company + "/transactions/" + transaction,
                    "/api/companies/" + company + "/dashboard",
                    "/api/companies/" + company + "/settings",
                    "/api/companies/" + company + "/reports/party-statement?partyId=" + party,
                    "/api/companies/" + company + "/reports/date-range",
                    "/api/companies/" + company + "/reports/regions",
                    "/api/companies/" + company + "/transactions/" + transaction + "/attachment" }) {
                assertStatus(get(path).cookie(client.session()), 200);
            }
            assertStatus(json(patch("/api/companies/{c}", company), client)
                    .content("{\"address\":\"Role Test\"}"), manager ? 200 : 403);
            assertStatus(json(post("/api/companies/{c}/regions", company), client)
                    .content("{\"name\":\"New " + role.role() + "\"}"), writer ? 201 : 403);
            assertStatus(json(patch("/api/companies/{c}/regions/{r}", company, region), client)
                    .content("{\"name\":\"Main\"}"), writer ? 200 : 403);
            assertStatus(auth(delete("/api/companies/{c}/regions/{r}", company, 999_999), client),
                    writer ? 404 : 403);
            assertStatus(json(post("/api/companies/{c}/parties", company), client)
                    .content("{\"name\":\"New Party " + role.role() + "\",\"regionId\":" + region + "}"),
                    writer ? 201 : 403);
            assertStatus(json(patch("/api/companies/{c}/parties/{p}", company, party), client)
                    .content("{\"notes\":\"Role Test\"}"), writer ? 200 : 403);
            assertStatus(auth(delete("/api/companies/{c}/parties/{p}", company, 999_999), client),
                    writer ? 404 : 403);
            assertStatus(json(post("/api/companies/{c}/transactions", company), client)
                    .content(transactionBody(party)), writer ? 201 : 403);
            assertStatus(json(patch("/api/companies/{c}/transactions/{t}", company, transaction), client)
                    .content("{\"description\":\"Role Test\"}"), writer ? 200 : 403);
            assertStatus(auth(delete("/api/companies/{c}/transactions/{t}", company, 999_999), client),
                    writer ? 404 : 403);
            assertStatus(json(patch("/api/companies/{c}/settings", company), client)
                    .content("{\"statementHeader\":\"Role Test\"}"), writer ? 200 : 403);
            upload(client, company, transaction, writer ? 201 : 403);
            assertStatus(auth(delete("/api/companies/{c}/transactions/{t}/attachment", company, 999_999), client),
                    writer ? 404 : 403);
            assertStatus(json(post("/api/companies/{c}/backup", company), client)
                    .content("{\"passphrase\":\"safe passphrase for test\"}"), isOwner ? 200 : 403);
            assertStatus(auth(delete("/api/companies/{c}", company), client), isOwner ? 409 : 403);
            assertStatus(auth(multipart("/api/backups/restore/preview")
                    .file(new MockMultipartFile("file", "empty.lfbak", "application/vnd.ledgerflow.backup", new byte[0]))
                    .param("passphrase", "safe passphrase for test"), client), isOwner ? 400 : 403);
            assertStatus(json(post("/api/import/legacy/preview"), client).content("{}"), isOwner ? 422 : 403);
        }
    }

    @Test
    void foreignCompanyIdsAndNestedForeignEntitiesNeverLeak() throws Exception {
        Client a = registerAndLogin("a@example.com");
        Client b = registerAndLogin("b@example.com");
        long companyA = id(mvc.perform(json(post("/api/companies"), a)
                .content("{\"name\":\"Company A\"}")).andReturn().getResponse().getContentAsString());
        long companyB = id(mvc.perform(json(post("/api/companies"), b)
                .content("{\"name\":\"Company B\"}")).andReturn().getResponse().getContentAsString());
        long regionB = id(mvc.perform(json(post("/api/companies/{c}/regions", companyB), b)
                .content("{\"name\":\"Private Region\"}")).andReturn().getResponse().getContentAsString());
        long partyB = id(mvc.perform(json(post("/api/companies/{c}/parties", companyB), b)
                .content("{\"name\":\"Private Party\",\"regionId\":" + regionB + "}"))
                .andReturn().getResponse().getContentAsString());
        long transactionB = id(mvc.perform(json(post("/api/companies/{c}/transactions", companyB), b)
                .content(transactionBody(partyB))).andReturn().getResponse().getContentAsString());
        upload(b, companyB, transactionB, 201);

        for (String path : new String[] {
                "/api/companies/" + companyB,
                "/api/companies/" + companyB + "/regions",
                "/api/companies/" + companyB + "/parties",
                "/api/companies/" + companyB + "/transactions",
                "/api/companies/" + companyB + "/dashboard",
                "/api/companies/" + companyB + "/settings",
                "/api/companies/" + companyB + "/reports/date-range",
                "/api/companies/" + companyB + "/transactions/" + transactionB + "/attachment" }) {
            assertStatus(get(path).cookie(a.session()), 404);
        }
        assertStatus(get("/api/companies/{c}/parties/{p}", companyA, partyB).cookie(a.session()), 404);
        assertStatus(get("/api/companies/{c}/transactions/{t}", companyA, transactionB).cookie(a.session()), 404);
        assertStatus(get("/api/companies/{c}/reports/party-statement", companyA)
                .param("partyId", Long.toString(partyB)).cookie(a.session()), 404);
        assertStatus(get("/api/companies/{c}/reports/regions", companyA)
                .param("regionId", Long.toString(regionB)).cookie(a.session()), 404);
        assertStatus(json(post("/api/companies/{c}/parties", companyA), a)
                .content("{\"name\":\"Probe\",\"regionId\":" + regionB + "}"), 404);
        assertStatus(json(post("/api/companies/{c}/transactions", companyA), a)
                .content(transactionBody(partyB)), 404);
        assertStatus(json(patch("/api/companies/{c}/transactions/{t}", companyA, transactionB), a)
                .content("{\"description\":\"Probe\"}"), 404);
        assertStatus(auth(delete("/api/companies/{c}/transactions/{t}", companyA, transactionB), a), 404);
        assertStatus(get("/api/companies/{c}/transactions/{t}/attachment", companyA, transactionB)
                .cookie(a.session()), 404);
        assertStatus(json(post("/api/companies/{c}/backup", companyB), a)
                .content("{\"passphrase\":\"safe passphrase for test\"}"), 404);
    }

    @Test
    void csrfRejectsEveryAuthenticatedMutationFamily() throws Exception {
        Client owner = registerAndLogin("csrf-owner@example.com");
        long company = id(mvc.perform(json(post("/api/companies"), owner)
                .content("{\"name\":\"CSRF Company\"}")).andReturn().getResponse().getContentAsString());
        for (MockHttpServletRequestBuilder request : new MockHttpServletRequestBuilder[] {
                post("/api/companies").contentType(MediaType.APPLICATION_JSON).content("{}"),
                patch("/api/companies/{c}", company).contentType(MediaType.APPLICATION_JSON).content("{}"),
                delete("/api/companies/{c}", company),
                post("/api/companies/{c}/regions", company).contentType(MediaType.APPLICATION_JSON).content("{}"),
                post("/api/companies/{c}/parties", company).contentType(MediaType.APPLICATION_JSON).content("{}"),
                post("/api/companies/{c}/transactions", company).contentType(MediaType.APPLICATION_JSON).content("{}"),
                patch("/api/companies/{c}/settings", company).contentType(MediaType.APPLICATION_JSON).content("{}"),
                delete("/api/companies/{c}/transactions/1/attachment", company),
                post("/api/companies/{c}/backup", company).contentType(MediaType.APPLICATION_JSON).content("{}"),
                post("/api/import/legacy/preview").contentType(MediaType.APPLICATION_JSON).content("{}"),
                post("/api/import/legacy/commit").contentType(MediaType.APPLICATION_JSON).content("{}"),
                post("/api/auth/logout").contentType(MediaType.APPLICATION_JSON).content("{}") }) {
            assertStatus(request.cookie(owner.session()), 403);
        }
        assertStatus(multipart("/api/companies/{c}/transactions/1/attachment", company)
                .file(new MockMultipartFile("file", "x.pdf", "application/pdf", PDF))
                .cookie(owner.session()), 403);
        assertStatus(multipart("/api/backups/restore/preview")
                .file(new MockMultipartFile("file", "x.lfbak", "application/vnd.ledgerflow.backup", PDF))
                .param("passphrase", PASSWORD).cookie(owner.session()), 403);
        assertStatus(multipart("/api/backups/restore/commit")
                .file(new MockMultipartFile("file", "x.lfbak", "application/vnd.ledgerflow.backup", PDF))
                .param("passphrase", PASSWORD).cookie(owner.session()), 403);
    }

    private Client registerAndLogin(String email) throws Exception {
        var csrfResult = mvc.perform(get("/api/auth/csrf")).andReturn();
        Cookie csrf = csrfResult.getResponse().getCookie("XSRF-TOKEN");
        assertNotNull(csrf);
        mvc.perform(post("/api/auth/register").cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Security User\",\"email\":\"" + email
                        + "\",\"password\":\"" + PASSWORD + "\"}"));
        var login = mvc.perform(post("/api/auth/login").cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andReturn();
        Cookie session = login.getResponse().getCookie("LF_SESSION");
        assertNotNull(session);
        return new Client(csrf, session);
    }

    private void membership(long company, String email, String role) {
        long user = jdbc.queryForObject("SELECT id FROM users WHERE normalized_email=?", Long.class, email);
        jdbc.update("INSERT INTO company_memberships(company_id,user_id,role,status,created_at,updated_at) "
                + "VALUES(?,?,?,'ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)", company, user, role);
    }

    private MockHttpServletRequestBuilder auth(MockHttpServletRequestBuilder request, Client client) {
        return request.cookie(client.csrf(), client.session()).header("X-XSRF-TOKEN", client.csrf().getValue());
    }

    private MockMultipartHttpServletRequestBuilder auth(MockMultipartHttpServletRequestBuilder request, Client client) {
        return request.cookie(client.csrf(), client.session()).header("X-XSRF-TOKEN", client.csrf().getValue());
    }

    private MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder request, Client client) {
        return auth(request, client).contentType(MediaType.APPLICATION_JSON);
    }

    private void upload(Client client, long company, long transaction, int expectedStatus) throws Exception {
        assertStatus(auth(multipart("/api/companies/{c}/transactions/{t}/attachment", company, transaction)
                .file(new MockMultipartFile("file", "fixture.pdf", "application/pdf", PDF)), client), expectedStatus);
    }

    private void assertStatus(MockHttpServletRequestBuilder request, int expected) throws Exception {
        assertEquals(expected, mvc.perform(request).andReturn().getResponse().getStatus(),
                request.buildRequest(context.getServletContext()).getRequestURI());
    }

    private void assertStatus(MockMultipartHttpServletRequestBuilder request, int expected) throws Exception {
        assertEquals(expected, mvc.perform(request).andReturn().getResponse().getStatus());
    }

    private long id(String response) throws Exception {
        long id = mapper.readTree(response).at("/data/id").longValue();
        if (id <= 0) throw new AssertionError("Fixture creation failed: " + response);
        return id;
    }

    private String transactionBody(long party) {
        return "{\"partyId\":" + party + ",\"type\":\"CREDIT\",\"amount\":25000,"
                + "\"transactionDate\":\"2026-09-15\",\"description\":\"Security fixture\"}";
    }

    private record Client(Cookie csrf, Cookie session) {}
    private record RoleClient(String role, Client client) {}
}
