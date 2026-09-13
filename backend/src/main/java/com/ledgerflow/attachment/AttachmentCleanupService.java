package com.ledgerflow.attachment;

import java.util.Collection;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class AttachmentCleanupService {
    private static final Logger log = LoggerFactory.getLogger(AttachmentCleanupService.class);
    private final AttachmentStorage storage;

    public AttachmentCleanupService(AttachmentStorage storage) { this.storage = storage; }

    public void afterCommit(Collection<AttachmentRepository.Attachment> attachments) {
        if (attachments.isEmpty()) return;
        Runnable cleanup = () -> attachments.forEach(this::delete);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { cleanup.run(); }
            });
        } else {
            cleanup.run();
        }
    }

    public void delete(AttachmentRepository.Attachment attachment) {
        if (!storage.delete(attachment.storageKey())) {
            log.warn("Attachment cleanup could not remove storage key hash {}",
                    Integer.toHexString(attachment.storageKey().hashCode()));
        }
    }
}
