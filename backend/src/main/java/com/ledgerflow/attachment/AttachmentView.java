package com.ledgerflow.attachment;

public record AttachmentView(long id, String originalName, String mimeType, long byteSize) {}
