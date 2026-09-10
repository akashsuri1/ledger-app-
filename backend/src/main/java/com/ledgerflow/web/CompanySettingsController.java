package com.ledgerflow.web;

import com.ledgerflow.security.CurrentUserService;
import com.ledgerflow.settings.CompanySettingsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/api/companies/{companyId}/settings")
public class CompanySettingsController {
    private final CurrentUserService currentUser;
    private final CompanySettingsService settings;

    public CompanySettingsController(CurrentUserService currentUser, CompanySettingsService settings) {
        this.currentUser = currentUser;
        this.settings = settings;
    }

    @GetMapping
    ApiEnvelope<CompanySettingsService.SettingsView> get(@PathVariable long companyId) {
        return ApiEnvelope.of(settings.get(currentUser.require(), companyId));
    }

    @PatchMapping
    ApiEnvelope<CompanySettingsService.SettingsView> update(@PathVariable long companyId,
                                                            @RequestBody JsonNode body) {
        return ApiEnvelope.of(settings.update(currentUser.require(), companyId, body));
    }
}
