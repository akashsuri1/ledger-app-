package com.ledgerflow.backup;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.unit.DataSize;

@ConfigurationProperties(prefix = "ledgerflow.backups")
public class BackupProperties {
    private DataSize maxEncryptedSize = DataSize.ofMegabytes(256);
    private DataSize maxUncompressedSize = DataSize.ofMegabytes(512);
    private int maxEntries = 10_000;
    private int maxAttachments = 5_000;
    private int pbkdf2Iterations = 310_000;

    public DataSize getMaxEncryptedSize() { return maxEncryptedSize; }
    public void setMaxEncryptedSize(DataSize value) { maxEncryptedSize = positive(value, "max-encrypted-size"); }
    public DataSize getMaxUncompressedSize() { return maxUncompressedSize; }
    public void setMaxUncompressedSize(DataSize value) { maxUncompressedSize = positive(value, "max-uncompressed-size"); }
    public int getMaxEntries() { return maxEntries; }
    public void setMaxEntries(int value) { maxEntries = positive(value, "max-entries"); }
    public int getMaxAttachments() { return maxAttachments; }
    public void setMaxAttachments(int value) { maxAttachments = positive(value, "max-attachments"); }
    public int getPbkdf2Iterations() { return pbkdf2Iterations; }
    public void setPbkdf2Iterations(int value) {
        if (value < 100_000 || value > 1_000_000) {
            throw new IllegalArgumentException(
                    "ledgerflow.backups.pbkdf2-iterations must be between 100000 and 1000000");
        }
        pbkdf2Iterations = value;
    }

    private DataSize positive(DataSize value, String name) {
        if (value == null || value.toBytes() < 1) throw new IllegalArgumentException("ledgerflow.backups." + name + " must be positive");
        return value;
    }
    private int positive(int value, String name) {
        if (value < 1) throw new IllegalArgumentException("ledgerflow.backups." + name + " must be positive");
        return value;
    }
}
