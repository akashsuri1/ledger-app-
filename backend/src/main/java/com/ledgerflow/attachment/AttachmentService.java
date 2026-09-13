package com.ledgerflow.attachment;

import java.io.IOException;
import java.io.InputStream;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;

import com.ledgerflow.auth.SecurityAuditRepository;
import com.ledgerflow.membership.CompanyAccessService;
import com.ledgerflow.membership.MembershipRole;
import com.ledgerflow.security.AuthenticatedUser;
import com.ledgerflow.transaction.TransactionRepository;
import com.ledgerflow.web.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

@Service
public class AttachmentService {
    private static final Logger log = LoggerFactory.getLogger(AttachmentService.class);
    private static final MembershipRole[] WRITERS = {
            MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.ACCOUNTANT
    };
    private final CompanyAccessService access;
    private final TransactionRepository transactions;
    private final AttachmentRepository attachments;
    private final AttachmentStorage storage;
    private final AttachmentFileValidator validator;
    private final SecurityAuditRepository audit;
    private final TransactionTemplate transactionTemplate;
    private final ConcurrentHashMap<String, ReentrantLock> locks = new ConcurrentHashMap<>();

    public AttachmentService(CompanyAccessService access, TransactionRepository transactions,
                             AttachmentRepository attachments, AttachmentStorage storage,
                             AttachmentFileValidator validator, SecurityAuditRepository audit,
                             TransactionTemplate transactionTemplate) {
        this.access = access;
        this.transactions = transactions;
        this.attachments = attachments;
        this.storage = storage;
        this.validator = validator;
        this.audit = audit;
        this.transactionTemplate = transactionTemplate;
    }

    public AttachmentView upload(AuthenticatedUser user, long companyId, long transactionId, MultipartFile file) {
        access.requireRole(user.userId(), companyId, WRITERS);
        requireTransaction(companyId, transactionId);
        var valid = validator.validate(file);
        AttachmentStorage.StoredFile stored;
        try {
            stored = storage.store(companyId, transactionId, valid.extension(), file.getInputStream(), valid.maxBytes());
        } catch (IOException exception) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "ATTACHMENT_CONTENT_INVALID",
                    "The attachment could not be read.");
        }

        ReentrantLock lock = locks.computeIfAbsent(companyId + ":" + transactionId, ignored -> new ReentrantLock());
        lock.lock();
        try {
            Change change;
            try {
                change = transactionTemplate.execute(status -> {
                    requireTransaction(companyId, transactionId);
                    var previous = attachments.find(companyId, transactionId).orElse(null);
                    attachments.upsert(companyId, transactionId, stored.storageKey(), valid.originalName(),
                            valid.mimeType(), stored.byteSize());
                    var current = requireAttachment(companyId, transactionId);
                    String action = previous == null ? "ATTACHMENT_UPLOADED" : "ATTACHMENT_REPLACED";
                    audit.record(user.userId(), companyId, action, "TRANSACTION_ATTACHMENT", current.id(),
                            "{\"transactionId\":" + transactionId + ",\"byteSize\":" + stored.byteSize() + "}");
                    return new Change(previous, current);
                });
            } catch (RuntimeException exception) {
                if (!storage.delete(stored.storageKey())) {
                    log.warn("Could not compensate staged attachment for storage key hash {}",
                            Integer.toHexString(stored.storageKey().hashCode()));
                }
                throw exception;
            }
            if (change.previous() != null && !change.previous().storageKey().equals(stored.storageKey())
                    && !storage.delete(change.previous().storageKey())) {
                log.warn("Could not remove replaced attachment for storage key hash {}",
                        Integer.toHexString(change.previous().storageKey().hashCode()));
            }
            return change.current().view();
        } finally {
            lock.unlock();
        }
    }

    public Download download(AuthenticatedUser user, long companyId, long transactionId) {
        access.requireMembership(user.userId(), companyId);
        requireTransaction(companyId, transactionId);
        var attachment = requireAttachment(companyId, transactionId);
        var file = storage.load(attachment.storageKey());
        return new Download(attachment.view(), file.inputStream(), file.byteSize());
    }

    public void delete(AuthenticatedUser user, long companyId, long transactionId) {
        access.requireRole(user.userId(), companyId, WRITERS);
        requireTransaction(companyId, transactionId);
        ReentrantLock lock = locks.computeIfAbsent(companyId + ":" + transactionId, ignored -> new ReentrantLock());
        lock.lock();
        try {
            var removed = transactionTemplate.execute(status -> {
                requireTransaction(companyId, transactionId);
                var attachment = requireAttachment(companyId, transactionId);
                attachments.delete(companyId, transactionId);
                audit.record(user.userId(), companyId, "ATTACHMENT_DELETED", "TRANSACTION_ATTACHMENT",
                        attachment.id(), "{\"transactionId\":" + transactionId + "}");
                return attachment;
            });
            if (!storage.delete(removed.storageKey())) {
                log.warn("Could not remove deleted attachment for storage key hash {}",
                        Integer.toHexString(removed.storageKey().hashCode()));
            }
        } finally {
            lock.unlock();
        }
    }

    private void requireTransaction(long companyId, long transactionId) {
        if (transactions.find(companyId, transactionId).isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "TRANSACTION_NOT_FOUND", "The transaction is unavailable.");
        }
    }

    private AttachmentRepository.Attachment requireAttachment(long companyId, long transactionId) {
        return attachments.find(companyId, transactionId).orElseThrow(() -> new ApiException(
                HttpStatus.NOT_FOUND, "ATTACHMENT_NOT_FOUND", "The transaction has no attachment."));
    }

    private record Change(AttachmentRepository.Attachment previous, AttachmentRepository.Attachment current) {}
    public record Download(AttachmentView metadata, InputStream inputStream, long byteSize) {}
}
