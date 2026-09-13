package com.ledgerflow.attachment;

import java.io.InputStream;

public interface AttachmentStorage {
    record StoredFile(String storageKey, long byteSize) {}
    record LoadedFile(InputStream inputStream, long byteSize) {}

    StoredFile store(long companyId, long transactionId, String extension,
                     InputStream inputStream, long maxBytes);
    LoadedFile load(String storageKey);
    boolean delete(String storageKey);
    boolean exists(String storageKey);
}
