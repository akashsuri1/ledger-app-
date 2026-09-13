package com.ledgerflow.party;

import com.ledgerflow.attachment.AttachmentCleanupService;
import com.ledgerflow.attachment.AttachmentRepository;
import com.ledgerflow.auth.SecurityAuditRepository;
import com.ledgerflow.common.InputValidator;
import com.ledgerflow.common.TextNormalizer;
import com.ledgerflow.membership.CompanyAccessService;
import com.ledgerflow.membership.MembershipRole;
import com.ledgerflow.region.RegionRepository;
import com.ledgerflow.security.AuthenticatedUser;
import com.ledgerflow.web.ApiException;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

@Service
public class PartyService {
    private static final MembershipRole[] WRITERS = {
            MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.ACCOUNTANT
    };
    private final PartyRepository parties;
    private final RegionRepository regions;
    private final CompanyAccessService access;
    private final InputValidator validator;
    private final SecurityAuditRepository audit;
    private final AttachmentRepository attachments;
    private final AttachmentCleanupService attachmentCleanup;

    public PartyService(PartyRepository parties, RegionRepository regions, CompanyAccessService access,
                        InputValidator validator, SecurityAuditRepository audit,
                        AttachmentRepository attachments, AttachmentCleanupService attachmentCleanup) {
        this.parties = parties; this.regions = regions; this.access = access;
        this.validator = validator; this.audit = audit;
        this.attachments = attachments; this.attachmentCleanup = attachmentCleanup;
    }

    public record PartyView(long id, long companyId, long regionId, String regionName, String name,
                            String phone, String address, String gstin, String notes,
                            String createdAt, String updatedAt, long balance, long transactionCount) {}
    public record PartyPage(java.util.List<PartyView> items, long total) {}

    public PartyPage list(AuthenticatedUser user, long companyId, String search, Long regionId,
                          int page, int pageSize) {
        access.requireMembership(user.userId(), companyId);
        validator.page(page, pageSize);
        if (regionId != null) requireRegion(companyId, regionId);
        var result = parties.list(companyId, search, regionId, page, pageSize);
        return new PartyPage(result.items().stream().map(this::view).toList(), result.total());
    }

    public PartyView get(AuthenticatedUser user, long companyId, long partyId) {
        access.requireMembership(user.userId(), companyId);
        return view(require(companyId, partyId));
    }

    @Transactional
    public PartyView create(AuthenticatedUser user, long companyId, JsonNode body) {
        access.requireRole(user.userId(), companyId, WRITERS);
        validator.object(body);
        String name = validator.requiredText(body, "name");
        String normalized = TextNormalizer.comparison(name);
        long regionId = validator.requiredPositiveId(body, "regionId");
        requireRegion(companyId, regionId);
        String phone = validator.optionalText(body, "phone", "");
        String address = validator.optionalText(body, "address", "");
        String gstin = TextNormalizer.gstin(validator.optionalText(body, "gstin", ""));
        String notes = validator.optionalText(body, "notes", "");
        validator.phone(phone);
        ensureUnique(companyId, regionId, normalized, gstin, null);
        try {
            long id = parties.create(companyId, regionId, name, normalized, phone, address, gstin, notes);
            return view(require(companyId, id));
        } catch (DataAccessException exception) {
            mapConflict(companyId, regionId, normalized, gstin, null);
            throw exception;
        }
    }

    @Transactional
    public PartyView update(AuthenticatedUser user, long companyId, long partyId, JsonNode body) {
        access.requireRole(user.userId(), companyId, WRITERS);
        validator.object(body);
        var existing = require(companyId, partyId);
        long regionId = body.has("regionId") ? validator.requiredPositiveId(body, "regionId") : existing.regionId();
        requireRegion(companyId, regionId);
        String name = body.has("name") ? validator.requiredText(body, "name") : existing.name();
        String normalized = TextNormalizer.comparison(name);
        String phone = validator.optionalText(body, "phone", existing.phone());
        String address = validator.optionalText(body, "address", existing.address());
        String gstin = body.has("gstin")
                ? TextNormalizer.gstin(validator.optionalText(body, "gstin", "")) : existing.gstin();
        String notes = validator.optionalText(body, "notes", existing.notes());
        validator.phone(phone);
        ensureUnique(companyId, regionId, normalized, gstin, partyId);
        try {
            parties.update(new PartyRepository.Party(partyId, companyId, regionId, existing.regionName(),
                    name, normalized, phone, address, gstin, notes, existing.createdAt(), existing.updatedAt(),
                    existing.balance(), existing.transactionCount()));
            return view(require(companyId, partyId));
        } catch (DataAccessException exception) {
            mapConflict(companyId, regionId, normalized, gstin, partyId);
            throw exception;
        }
    }

    @Transactional
    public void delete(AuthenticatedUser user, long companyId, long partyId) {
        access.requireRole(user.userId(), companyId, WRITERS);
        require(companyId, partyId);
        var files = attachments.findForParty(companyId, partyId);
        attachmentCleanup.afterCommit(files);
        var counts = parties.cascadeCounts(companyId, partyId);
        String metadata = "{\"transactionCount\":" + counts.transactions()
                + ",\"attachmentCount\":" + counts.attachments() + "}";
        audit.record(user.userId(), companyId, "PARTY_DELETED", "PARTY", partyId, metadata);
        parties.delete(companyId, partyId);
    }

    private PartyRepository.Party require(long companyId, long partyId) {
        return parties.find(companyId, partyId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                "PARTY_NOT_FOUND", "The party is unavailable."));
    }

    private void requireRegion(long companyId, long regionId) {
        if (regions.find(companyId, regionId).isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "REGION_NOT_FOUND", "The region is unavailable.");
        }
    }

    private void ensureUnique(long companyId, long regionId, String normalized, String gstin, Long excludingId) {
        if (parties.nameExists(companyId, regionId, normalized, excludingId)) duplicateName();
        if (parties.gstinExists(companyId, gstin, excludingId)) duplicateGstin();
    }

    private void mapConflict(long companyId, long regionId, String normalized, String gstin,
                             Long excludingId) {
        if (parties.nameExists(companyId, regionId, normalized, excludingId)) duplicateName();
        if (parties.gstinExists(companyId, gstin, excludingId)) duplicateGstin();
    }

    private void duplicateName() {
        throw new ApiException(HttpStatus.CONFLICT, "PARTY_ALREADY_EXISTS",
                "A party with this name already exists in the region.");
    }

    private void duplicateGstin() {
        throw new ApiException(HttpStatus.CONFLICT, "PARTY_GSTIN_ALREADY_EXISTS",
                "A party with this GSTIN already exists in the company.");
    }

    private PartyView view(PartyRepository.Party party) {
        return new PartyView(party.id(), party.companyId(), party.regionId(), party.regionName(), party.name(),
                party.phone(), party.address(), party.gstin(), party.notes(), party.createdAt().toString(),
                party.updatedAt().toString(), party.balance(), party.transactionCount());
    }
}
