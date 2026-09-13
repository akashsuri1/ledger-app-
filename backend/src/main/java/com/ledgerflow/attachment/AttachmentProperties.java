package com.ledgerflow.attachment;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.unit.DataSize;

@ConfigurationProperties(prefix = "ledgerflow.attachments")
public class AttachmentProperties {
    private DataSize maxSize = DataSize.ofMegabytes(10);

    public DataSize getMaxSize() { return maxSize; }
    public void setMaxSize(DataSize maxSize) {
        if (maxSize == null || maxSize.toBytes() < 1) {
            throw new IllegalArgumentException("ledgerflow.attachments.max-size must be positive");
        }
        this.maxSize = maxSize;
    }
}
