package com.ledgerflow.company;

import java.util.List;

import com.ledgerflow.auth.SecurityAuditRepository;
import com.ledgerflow.common.InputValidator;
import com.ledgerflow.common.TextNormalizer;
import com.ledgerflow.membership.CompanyAccessService;
import com.ledgerflow.membership.MembershipRole;
import com.ledgerflow.security.AuthenticatedUser;
import com.ledgerflow.web.ApiException;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

@Service
public class CompanyService {
    private final CompanyRepository companies;
    private final CompanyAccessService access;
    private final InputValidator validator;
    private final SecurityAuditRepository audit;

    public CompanyService(CompanyRepository companies, CompanyAccessService access,
                          InputValidator validator, SecurityAuditRepository audit) {
        this.companies = companies; this.access = access; this.validator = validator; this.audit = audit;
    }

    public record CompanyView(long id, String name, String address, String phone, String gstin,
                              String email, String role, String createdAt, String updatedAt) {}

    @Transactional
    public CompanyView create(AuthenticatedUser user, JsonNode body) {
        validator.object(body);
        String name = validator.requiredText(body, "name");
        String normalized = TextNormalizer.comparison(name);
        String address = validator.optionalText(body, "address", "");
        String phone = validator.optionalText(body, "phone", "");
        String gstin = TextNormalizer.gstin(validator.optionalText(body, "gstin", ""));
        String email = validator.optionalText(body, "email", "");
        validator.phone(phone); validator.email(email);
        if (companies.accessibleNameExists(user.userId(), normalized, null)) duplicateName();
        long id = companies.create(name, normalized, address, phone, gstin, email);
        companies.createOwnerMembership(id, user.userId());
        companies.createDefaultSettings(id);
        audit.record(user.userId(), id, "COMPANY_CREATED", "COMPANY", id, "{}");
        return view(companies.find(id).orElseThrow(), MembershipRole.OWNER);
    }

    public List<CompanyView> list(AuthenticatedUser user) {
        return companies.findAccessible(user.userId()).stream()
                .map(item -> view(item.company(), item.role())).toList();
    }

    public CompanyView get(AuthenticatedUser user, long companyId) {
        var membership = access.requireMembership(user.userId(), companyId);
        return view(requireCompany(companyId), membership.role());
    }

    @Transactional
    public CompanyView update(AuthenticatedUser user, long companyId, JsonNode body) {
        validator.object(body);
        var membership = access.requireRole(user.userId(), companyId, MembershipRole.OWNER, MembershipRole.ADMIN);
        var existing = requireCompany(companyId);
        String name = body.has("name") ? validator.requiredText(body, "name") : existing.name();
        String normalized = TextNormalizer.comparison(name);
        String address = validator.optionalText(body, "address", existing.address());
        String phone = validator.optionalText(body, "phone", existing.phone());
        String gstin = body.has("gstin")
                ? TextNormalizer.gstin(validator.optionalText(body, "gstin", "")) : existing.gstin();
        String email = validator.optionalText(body, "email", existing.email());
        validator.phone(phone); validator.email(email);
        if (!normalized.equals(existing.normalizedName())
                && companies.accessibleNameExists(user.userId(), normalized, companyId)) duplicateName();
        var updated = new CompanyRepository.Company(companyId, name, normalized, address, phone, gstin,
                email, existing.createdAt(), existing.updatedAt());
        companies.update(updated);
        audit.record(user.userId(), companyId, "COMPANY_UPDATED", "COMPANY", companyId, "{}");
        return view(requireCompany(companyId), membership.role());
    }

    @Transactional
    public void delete(AuthenticatedUser user, long companyId) {
        access.requireRole(user.userId(), companyId, MembershipRole.OWNER);
        requireCompany(companyId);
        if (!companies.isEmpty(companyId)) {
            throw companyNotEmpty();
        }
        audit.record(user.userId(), companyId, "COMPANY_DELETED", "COMPANY", companyId, "{}");
        try {
            companies.delete(companyId);
        } catch (DataAccessException exception) {
            if (!companies.isEmpty(companyId)) throw companyNotEmpty();
            throw exception;
        }
    }

    private CompanyRepository.Company requireCompany(long id) {
        return companies.find(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                "COMPANY_NOT_FOUND", "The company is unavailable."));
    }

    private void duplicateName() {
        throw new ApiException(HttpStatus.CONFLICT, "COMPANY_ALREADY_EXISTS",
                "You already have access to a company with this name.");
    }

    private ApiException companyNotEmpty() {
        return new ApiException(HttpStatus.CONFLICT, "COMPANY_NOT_EMPTY",
                "Only an empty company can be deleted. Remove its regions, parties, and transactions first.");
    }

    private CompanyView view(CompanyRepository.Company company, MembershipRole role) {
        return new CompanyView(company.id(), company.name(), company.address(), company.phone(), company.gstin(),
                company.email(), role.name(), company.createdAt().toString(), company.updatedAt().toString());
    }
}
