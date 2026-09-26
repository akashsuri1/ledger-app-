package com.ledgerflow.desktop;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Profile;
import com.ledgerflow.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@Profile("desktop")
@RestController
public class DesktopShutdownController {
    private final ConfigurableApplicationContext context;
    private final byte[] expectedToken;

    public DesktopShutdownController(ConfigurableApplicationContext context,
                                     @Value("${ledgerflow.desktop.shutdown-token:}") String shutdownToken) {
        this.context = context;
        this.expectedToken = shutdownToken.getBytes(StandardCharsets.UTF_8);
    }

    @PostMapping("/api/desktop/shutdown")
    public Map<String, String> shutdown(
            HttpServletRequest request,
            @RequestHeader(value = "X-LedgerFlow-Shutdown", required = false) String token) {
        if (!request.getRemoteAddr().equals("127.0.0.1") && !request.getRemoteAddr().equals("0:0:0:0:0:0:0:1")
                && !request.getRemoteAddr().equals("::1")) {
            throw notFound();
        }
        byte[] supplied = token == null ? new byte[0] : token.getBytes(StandardCharsets.UTF_8);
        if (expectedToken.length < 32 || !MessageDigest.isEqual(expectedToken, supplied)) {
            throw notFound();
        }
        Thread.ofPlatform().name("ledgerflow-desktop-shutdown").daemon().start(() -> {
            try {
                Thread.sleep(150);
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
            }
            context.close();
        });
        return Map.of("status", "STOPPING");
    }

    private ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "The requested resource was not found.");
    }
}
