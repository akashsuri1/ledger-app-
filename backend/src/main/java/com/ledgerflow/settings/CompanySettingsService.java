package com.ledgerflow.settings;

import java.util.Set;

import com.ledgerflow.auth.SecurityAuditRepository;
import com.ledgerflow.common.InputValidator;
import com.ledgerflow.common.TextNormalizer;
import com.ledgerflow.membership.CompanyAccessService;
import com.ledgerflow.membership.MembershipRole;
import com.ledgerflow.security.AuthenticatedUser;
import com.ledgerflow.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

@Service
public class CompanySettingsService {
    private static final MembershipRole[] WRITERS = {
            MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.ACCOUNTANT
    };
    private static final Set<String> LIMITS = Set.of("10", "25", "50", "100", "ALL");
    private static final Set<String> ORIENTATIONS = Set.of("portrait", "landscape");
    private static final Set<String> FONT_SIZES = Set.of("small", "normal", "large");

    private final CompanySettingsRepository settings;
    private final CompanyAccessService access;
    private final InputValidator validator;
    private final SecurityAuditRepository audit;

    public CompanySettingsService(CompanySettingsRepository settings, CompanyAccessService access,
                                  InputValidator validator, SecurityAuditRepository audit) {
        this.settings = settings;
        this.access = access;
        this.validator = validator;
        this.audit = audit;
    }

    public record SettingsView(long companyId, String statementHeader, String statementFooter,
                               Object defaultTransactionLimit, boolean showRunningBalance,
                               boolean showNotes, boolean showAttachment,
                               boolean showBusinessAddress, boolean showBusinessPhone,
                               boolean showBusinessGstin, boolean showGeneratedDate,
                               boolean showPageNumbers, String paperSize, String orientation,
                               String fontSize, String customFooter, String updatedAt) {}

    public SettingsView get(AuthenticatedUser user, long companyId) {
        access.requireMembership(user.userId(), companyId);
        return view(require(companyId));
    }

    @Transactional
    public SettingsView update(AuthenticatedUser user, long companyId, JsonNode body) {
        access.requireRole(user.userId(), companyId, WRITERS);
        validator.object(body);
        var existing = require(companyId);

        String header = text(body, "statementHeader", existing.statementHeader(), 200);
        String footer = text(body, "statementFooter", existing.statementFooter(), 1000);
        String customFooter = text(body, "customFooter", existing.customFooter(), 1000);
        String limit = body.has("defaultTransactionLimit")
                ? limit(body.get("defaultTransactionLimit")) : existing.defaultTransactionLimit();
        String paperSize = body.has("paperSize")
                ? allowedText(body, "paperSize", Set.of("A4")) : existing.paperSize();
        String orientation = body.has("orientation")
                ? allowedText(body, "orientation", ORIENTATIONS) : existing.orientation();
        String fontSize = body.has("fontSize")
                ? allowedText(body, "fontSize", FONT_SIZES) : existing.fontSize();

        var updated = new CompanySettingsRepository.CompanySettings(companyId, header, footer, limit,
                bool(body, "showRunningBalance", existing.showRunningBalance()),
                bool(body, "showNotes", existing.showNotes()),
                bool(body, "showAttachment", existing.showAttachment()),
                bool(body, "showBusinessAddress", existing.showBusinessAddress()),
                bool(body, "showBusinessPhone", existing.showBusinessPhone()),
                bool(body, "showBusinessGstin", existing.showBusinessGstin()),
                bool(body, "showGeneratedDate", existing.showGeneratedDate()),
                bool(body, "showPageNumbers", existing.showPageNumbers()), paperSize, orientation,
                fontSize, customFooter, existing.updatedAt());
        settings.update(updated);
        audit.record(user.userId(), companyId, "COMPANY_SETTINGS_UPDATED", "COMPANY_SETTINGS", companyId, "{}");
        return view(require(companyId));
    }

    private CompanySettingsRepository.CompanySettings require(long companyId) {
        return settings.find(companyId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                "COMPANY_SETTINGS_NOT_FOUND", "The company settings are unavailable."));
    }

    private String text(JsonNode body, String field, String fallback, int maxLength) {
        if (!body.has(field)) return fallback;
        JsonNode value = body.get(field);
        if (!value.isTextual()) invalid(field + " must be text.");
        String result = TextNormalizer.optional(value.asText());
        if (result.length() > maxLength) invalid(field + " is too long.");
        return result;
    }

    private boolean bool(JsonNode body, String field, boolean fallback) {
        if (!body.has(field)) return fallback;
        JsonNode value = body.get(field);
        if (!value.isBoolean()) invalid(field + " must be true or false.");
        return value.booleanValue();
    }

    private String allowedText(JsonNode body, String field, Set<String> allowed) {
        JsonNode value = body.get(field);
        if (value == null || !value.isTextual() || !allowed.contains(value.asText())) {
            invalid(field + " has an unsupported value.");
        }
        return value.asText();
    }

    private String limit(JsonNode value) {
        String result;
        if (value != null && value.isIntegralNumber() && value.canConvertToInt()) {
            result = Integer.toString(value.intValue());
        } else if (value != null && value.isTextual()) {
            result = value.asText().trim().toUpperCase();
        } else {
            result = "";
        }
        if (!LIMITS.contains(result)) invalid("defaultTransactionLimit has an unsupported value.");
        return result;
    }

    private void invalid(String message) {
        throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "COMPANY_SETTINGS_INVALID", message);
    }

    private SettingsView view(CompanySettingsRepository.CompanySettings value) {
        Object limit = "ALL".equals(value.defaultTransactionLimit())
                ? "ALL" : Integer.valueOf(value.defaultTransactionLimit());
        return new SettingsView(value.companyId(), value.statementHeader(), value.statementFooter(), limit,
                value.showRunningBalance(), value.showNotes(), value.showAttachment(),
                value.showBusinessAddress(), value.showBusinessPhone(), value.showBusinessGstin(),
                value.showGeneratedDate(), value.showPageNumbers(), value.paperSize(), value.orientation(),
                value.fontSize(), value.customFooter(), value.updatedAt().toString());
    }
}
