package com.ledgerflow.transaction;

import java.time.LocalDate;

import com.ledgerflow.attachment.AttachmentCleanupService;
import com.ledgerflow.attachment.AttachmentRepository;
import com.ledgerflow.attachment.AttachmentView;
import com.ledgerflow.backup.CompanyOperationLock;
import com.ledgerflow.auth.SecurityAuditRepository;
import com.ledgerflow.common.InputValidator;
import com.ledgerflow.membership.CompanyAccessService;
import com.ledgerflow.membership.MembershipRole;
import com.ledgerflow.party.PartyRepository;
import com.ledgerflow.region.RegionRepository;
import com.ledgerflow.security.AuthenticatedUser;
import com.ledgerflow.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

@Service
public class TransactionService {
    private static final MembershipRole[] WRITERS = {
            MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.ACCOUNTANT
    };
    private final TransactionRepository transactions;
    private final PartyRepository parties;
    private final RegionRepository regions;
    private final CompanyAccessService access;
    private final InputValidator validator;
    private final SecurityAuditRepository audit;
    private final AttachmentRepository attachments;
    private final AttachmentCleanupService attachmentCleanup;
    private final CompanyOperationLock companyLocks;

    public TransactionService(TransactionRepository transactions, PartyRepository parties,
                              RegionRepository regions, CompanyAccessService access,
                              InputValidator validator, SecurityAuditRepository audit,
                              AttachmentRepository attachments, AttachmentCleanupService attachmentCleanup,
                              CompanyOperationLock companyLocks) {
        this.transactions = transactions;
        this.parties = parties;
        this.regions = regions;
        this.access = access;
        this.validator = validator;
        this.audit = audit;
        this.attachments = attachments;
        this.attachmentCleanup = attachmentCleanup;
        this.companyLocks = companyLocks;
    }

    public record TransactionView(long id, long companyId, long partyId, String partyName,
                                  long regionId, String regionName, String type, long amount,
                                  String transactionDate, String description, String notes,
                                  String createdAt, String updatedAt, AttachmentView attachment) {}
    public record TransactionPage(java.util.List<TransactionView> items, long total) {}

    public TransactionPage list(AuthenticatedUser user, long companyId, String search,
                                Long partyId, Long regionId, String typeValue,
                                String fromValue, String toValue, int page, int pageSize) {
        access.requireMembership(user.userId(), companyId);
        validator.page(page, pageSize);
        if (partyId != null) requireParty(companyId, partyId);
        if (regionId != null) requireRegion(companyId, regionId);
        TransactionType type = typeValue == null || typeValue.isBlank() ? null : parseType(typeValue);
        LocalDate from = validator.optionalDate(fromValue, "from");
        LocalDate to = validator.optionalDate(toValue, "to");
        validator.dateRange(from, to);
        var result = transactions.list(companyId, search, partyId, regionId, type, from, to, page, pageSize);
        return new TransactionPage(result.items().stream().map(this::view).toList(), result.total());
    }

    public TransactionView get(AuthenticatedUser user, long companyId, long transactionId) {
        access.requireMembership(user.userId(), companyId);
        return view(require(companyId, transactionId));
    }

    @Transactional
    public TransactionView create(AuthenticatedUser user, long companyId, JsonNode body) {
        access.requireRole(user.userId(), companyId, WRITERS);
        validator.object(body);
        long partyId = validator.requiredPositiveId(body, "partyId");
        requireParty(companyId, partyId);
        TransactionType type = requiredType(body);
        long amount = validator.requiredPositiveAmount(body, "amount");
        LocalDate date = validator.requiredDate(body, "transactionDate");
        String description = validator.requiredText(body, "description");
        String notes = validator.optionalText(body, "notes", "");
        long id = transactions.create(companyId, partyId, type, amount, date, description, notes);
        return view(require(companyId, id));
    }

    @Transactional
    public TransactionView update(AuthenticatedUser user, long companyId, long transactionId, JsonNode body) {
        access.requireRole(user.userId(), companyId, WRITERS);
        validator.object(body);
        var existing = require(companyId, transactionId);
        long partyId = body.has("partyId")
                ? validator.requiredPositiveId(body, "partyId") : existing.partyId();
        requireParty(companyId, partyId);
        TransactionType type = body.has("type") ? requiredType(body) : existing.type();
        long amount = body.has("amount")
                ? validator.requiredPositiveAmount(body, "amount") : existing.amount();
        LocalDate date = body.has("transactionDate")
                ? validator.requiredDate(body, "transactionDate") : existing.transactionDate();
        String description = body.has("description")
                ? validator.requiredText(body, "description") : existing.description();
        String notes = validator.optionalText(body, "notes", existing.notes());
        transactions.update(new TransactionRepository.LedgerTransaction(
                transactionId, companyId, partyId, existing.partyName(), existing.regionId(), existing.regionName(),
                type, amount, date, description, notes, existing.createdAt(), existing.updatedAt(),
                existing.attachment()));
        return view(require(companyId, transactionId));
    }

    @Transactional
    public void delete(AuthenticatedUser user, long companyId, long transactionId) {
        access.requireRole(user.userId(), companyId, WRITERS);
        companyLocks.lockUntilTransactionComplete(companyId);
        require(companyId, transactionId);
        var attachment = attachments.find(companyId, transactionId).stream().toList();
        attachmentCleanup.afterCommit(attachment);
        audit.record(user.userId(), companyId, "TRANSACTION_DELETED", "TRANSACTION", transactionId,
                "{\"attachmentCount\":" + attachment.size() + "}");
        transactions.delete(companyId, transactionId);
    }

    private TransactionType requiredType(JsonNode body) {
        JsonNode value = body.get("type");
        if (value == null || !value.isTextual()) throw invalidType();
        return parseType(value.asText());
    }

    private TransactionType parseType(String value) {
        try {
            return TransactionType.valueOf(value);
        } catch (IllegalArgumentException exception) {
            throw invalidType();
        }
    }

    private ApiException invalidType() {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_TRANSACTION_TYPE",
                "type must be CREDIT or DEBIT.");
    }

    private TransactionRepository.LedgerTransaction require(long companyId, long transactionId) {
        return transactions.find(companyId, transactionId).orElseThrow(() -> new ApiException(
                HttpStatus.NOT_FOUND, "TRANSACTION_NOT_FOUND", "The transaction is unavailable."));
    }

    private void requireParty(long companyId, long partyId) {
        if (parties.find(companyId, partyId).isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "PARTY_NOT_FOUND", "The party is unavailable.");
        }
    }

    private void requireRegion(long companyId, long regionId) {
        if (regions.find(companyId, regionId).isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "REGION_NOT_FOUND", "The region is unavailable.");
        }
    }

    private TransactionView view(TransactionRepository.LedgerTransaction transaction) {
        return new TransactionView(transaction.id(), transaction.companyId(), transaction.partyId(),
                transaction.partyName(), transaction.regionId(), transaction.regionName(),
                transaction.type().name(), transaction.amount(), transaction.transactionDate().toString(),
                transaction.description(), transaction.notes(), transaction.createdAt().toString(),
                transaction.updatedAt().toString(), transaction.attachment());
    }
}
