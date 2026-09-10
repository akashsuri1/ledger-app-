package com.ledgerflow.region;

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
public class RegionService {
    private static final MembershipRole[] WRITERS = {
            MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.ACCOUNTANT
    };
    private final RegionRepository regions;
    private final CompanyAccessService access;
    private final InputValidator validator;
    private final SecurityAuditRepository audit;

    public RegionService(RegionRepository regions, CompanyAccessService access,
                         InputValidator validator, SecurityAuditRepository audit) {
        this.regions = regions; this.access = access; this.validator = validator; this.audit = audit;
    }

    public record RegionView(long id, long companyId, String name, String createdAt, String updatedAt) {}

    public List<RegionView> list(AuthenticatedUser user, long companyId) {
        access.requireMembership(user.userId(), companyId);
        return regions.list(companyId).stream().map(this::view).toList();
    }

    @Transactional
    public RegionView create(AuthenticatedUser user, long companyId, JsonNode body) {
        access.requireRole(user.userId(), companyId, WRITERS);
        validator.object(body);
        String name = validator.requiredText(body, "name");
        String normalized = TextNormalizer.comparison(name);
        if (regions.nameExists(companyId, normalized, null)) duplicate();
        try {
            long id = regions.create(companyId, name, normalized);
            return view(require(companyId, id));
        } catch (DataAccessException exception) {
            if (regions.nameExists(companyId, normalized, null)) duplicate();
            throw exception;
        }
    }

    @Transactional
    public RegionView update(AuthenticatedUser user, long companyId, long regionId, JsonNode body) {
        access.requireRole(user.userId(), companyId, WRITERS);
        validator.object(body);
        var existing = require(companyId, regionId);
        String name = body.has("name") ? validator.requiredText(body, "name") : existing.name();
        String normalized = TextNormalizer.comparison(name);
        if (regions.nameExists(companyId, normalized, regionId)) duplicate();
        try {
            regions.update(new RegionRepository.Region(regionId, companyId, name, normalized,
                    existing.createdAt(), existing.updatedAt()));
            return view(require(companyId, regionId));
        } catch (DataAccessException exception) {
            if (regions.nameExists(companyId, normalized, regionId)) duplicate();
            throw exception;
        }
    }

    @Transactional
    public void delete(AuthenticatedUser user, long companyId, long regionId) {
        access.requireRole(user.userId(), companyId, WRITERS);
        require(companyId, regionId);
        if (regions.partyCount(companyId, regionId) > 0) {
            throw regionNotEmpty();
        }
        audit.record(user.userId(), companyId, "REGION_DELETED", "REGION", regionId, "{}");
        try {
            regions.delete(companyId, regionId);
        } catch (DataAccessException exception) {
            if (regions.partyCount(companyId, regionId) > 0) throw regionNotEmpty();
            throw exception;
        }
    }

    private RegionRepository.Region require(long companyId, long regionId) {
        return regions.find(companyId, regionId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                "REGION_NOT_FOUND", "The region is unavailable."));
    }

    private void duplicate() {
        throw new ApiException(HttpStatus.CONFLICT, "REGION_ALREADY_EXISTS",
                "A region with this name already exists in the company.");
    }

    private ApiException regionNotEmpty() {
        return new ApiException(HttpStatus.CONFLICT, "REGION_NOT_EMPTY",
                "This region contains parties. Move or delete those parties first.");
    }

    private RegionView view(RegionRepository.Region region) {
        return new RegionView(region.id(), region.companyId(), region.name(),
                region.createdAt().toString(), region.updatedAt().toString());
    }
}
