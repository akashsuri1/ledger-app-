package com.ledgerflow;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;

import com.ledgerflow.security.AuthRateLimitFilter;
import com.ledgerflow.security.LedgerFlowSecurityProperties;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class AuthRateLimitFilterTest {
    @Test
    void sensitiveEndpointLimitsAreStableAndIndependent() throws Exception {
        var properties = new LedgerFlowSecurityProperties();
        properties.setAuthRateLimit(2);
        properties.setAuthRateWindow(Duration.ofMinutes(1));
        var filter = new AuthRateLimitFilter(properties);
        for (int attempt = 1; attempt <= 3; attempt++) {
            var request = new MockHttpServletRequest("POST", "/api/auth/login");
            request.setRemoteAddr("192.0.2.25");
            var response = new MockHttpServletResponse();
            var chain = new MockFilterChain();
            filter.doFilter(request, response, chain);
            if (attempt <= 2) {
                assertNotNull(chain.getRequest());
                assertEquals(200, response.getStatus());
            } else {
                assertEquals(429, response.getStatus());
                assertTrue(response.getContentAsString().contains("\"code\":\"RATE_LIMITED\""));
            }
        }
        var resetRequest = new MockHttpServletRequest("POST", "/api/auth/forgot-password");
        resetRequest.setRemoteAddr("192.0.2.25");
        var resetChain = new MockFilterChain();
        filter.doFilter(resetRequest, new MockHttpServletResponse(), resetChain);
        assertNotNull(resetChain.getRequest());
    }
}
