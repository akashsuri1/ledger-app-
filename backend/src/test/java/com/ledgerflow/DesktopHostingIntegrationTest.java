package com.ledgerflow;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Path;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.junit.jupiter.api.BeforeEach;

@ActiveProfiles("desktop")
@SpringBootTest(properties = "ledgerflow.desktop.shutdown-token=abcdefghijklmnopqrstuvwxyz-1234567890")
class DesktopHostingIntegrationTest {
    private static final Path DATA = Path.of(System.getProperty("java.io.tmpdir"),
            "ledgerflow-desktop-hosting-" + UUID.randomUUID());

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("ledgerflow.data-dir", DATA::toString);
        registry.add("ledgerflow.database.path", () -> DATA.resolve("ledgerflow.db").toString());
    }

    @Autowired
    WebApplicationContext context;

    private MockMvc mvc;

    @BeforeEach
    void configureMvc() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    @Test
    void directFrontendRoutesFallBackToThePackagedIndex() throws Exception {
        mvc.perform(get("/")).andExpect(status().isOk());
        for (String path : new String[]{"/login", "/dashboard", "/parties/123", "/select-company", "/unknown-route"}) {
            mvc.perform(get(path)).andExpect(status().isOk())
                    .andExpect(content().string(containsString("LEDGERFLOW_DESKTOP_TEST")));
        }
    }

    @Test
    void apiAndMissingAssetPathsNeverFallBackToTheSpa() throws Exception {
        mvc.perform(get("/api/does-not-exist")).andExpect(status().isUnauthorized())
                .andExpect(content().string(not(containsString("LEDGERFLOW_DESKTOP_TEST"))));
        mvc.perform(get("/assets/missing.js")).andExpect(status().isNotFound())
                .andExpect(content().string(not(containsString("LEDGERFLOW_DESKTOP_TEST"))));
    }

    @Test
    void shutdownEndpointRequiresThePrivateSupervisorToken() throws Exception {
        mvc.perform(post("/api/desktop/shutdown").header("X-LedgerFlow-Shutdown", "wrong"))
                .andExpect(status().isNotFound());
    }
}
