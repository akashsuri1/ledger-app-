package com.ledgerflow.web;

import java.util.List;

import com.ledgerflow.company.CompanyService;
import com.ledgerflow.security.CurrentUserService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/api/companies")
public class CompanyController {
    private final CurrentUserService currentUser;
    private final CompanyService companies;
    public CompanyController(CurrentUserService currentUser, CompanyService companies) {
        this.currentUser = currentUser; this.companies = companies;
    }

    @GetMapping ApiEnvelope<List<CompanyService.CompanyView>> list() {
        return ApiEnvelope.of(companies.list(currentUser.require()));
    }

    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    ApiEnvelope<CompanyService.CompanyView> create(@RequestBody JsonNode body) {
        return ApiEnvelope.of(companies.create(currentUser.require(), body));
    }

    @GetMapping("/{companyId}") ApiEnvelope<CompanyService.CompanyView> get(@PathVariable long companyId) {
        return ApiEnvelope.of(companies.get(currentUser.require(), companyId));
    }

    @PatchMapping("/{companyId}") ApiEnvelope<CompanyService.CompanyView> update(
            @PathVariable long companyId, @RequestBody JsonNode body) {
        return ApiEnvelope.of(companies.update(currentUser.require(), companyId, body));
    }

    @DeleteMapping("/{companyId}") ApiEnvelope<AuthController.Message> delete(@PathVariable long companyId) {
        companies.delete(currentUser.require(), companyId);
        return ApiEnvelope.of(new AuthController.Message("Company deleted."));
    }
}
