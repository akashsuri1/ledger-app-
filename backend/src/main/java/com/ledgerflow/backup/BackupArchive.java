package com.ledgerflow.backup;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

import com.ledgerflow.backup.BackupModels.Archive;
import com.ledgerflow.backup.BackupModels.CompanyData;
import com.ledgerflow.backup.BackupModels.Manifest;
import com.ledgerflow.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
public class BackupArchive {
    public static final String FORMAT = "ledgerflow-backup";
    public static final int FORMAT_VERSION = 1;
    private static final String MANIFEST = "manifest.json";
    private static final String COMPANY = "company.json";
    private final ObjectMapper mapper;
    private final BackupProperties properties;

    public BackupArchive(ObjectMapper mapper, BackupProperties properties) {
        this.mapper = mapper;
        this.properties = properties;
    }

    public byte[] encode(CompanyData company, Map<String, byte[]> attachmentEntries) {
        try {
            byte[] companyJson = mapper.writeValueAsBytes(company);
            var checksums = new TreeMap<String, String>();
            checksums.put(COMPANY, sha256(companyJson));
            attachmentEntries.forEach((name, bytes) -> checksums.put(name, sha256(bytes)));
            int attachmentCount = company.transactions().stream()
                    .mapToInt(transaction -> transaction.attachment() == null ? 0 : 1).sum();
            var manifest = new Manifest(FORMAT, FORMAT_VERSION, Instant.now().toString(), "0.0.1",
                    "COMPANY", 1, attachmentCount, checksums);
            var entries = new LinkedHashMap<String, byte[]>();
            entries.put(MANIFEST, mapper.writeValueAsBytes(manifest));
            entries.put(COMPANY, companyJson);
            entries.putAll(new TreeMap<>(attachmentEntries));
            checkOutputLimits(entries);
            var output = new ByteArrayOutputStream();
            try (var zip = new ZipOutputStream(output, StandardCharsets.UTF_8)) {
                for (var entry : entries.entrySet()) {
                    validateEntryName(entry.getKey());
                    zip.putNextEntry(new ZipEntry(entry.getKey()));
                    zip.write(entry.getValue());
                    zip.closeEntry();
                }
            }
            return output.toByteArray();
        } catch (ApiException exception) {
            throw exception;
        } catch (IOException exception) {
            throw corrupted("The backup archive could not be created.");
        }
    }

    public Archive decode(byte[] archive) {
        Map<String, byte[]> entries = new HashMap<>();
        Set<String> names = new HashSet<>();
        long total = 0;
        try (var zip = new ZipInputStream(new ByteArrayInputStream(archive), StandardCharsets.UTF_8)) {
            ZipEntry entry;
            int count = 0;
            while ((entry = zip.getNextEntry()) != null) {
                if (++count > properties.getMaxEntries()) throw tooLarge();
                String name = entry.getName();
                validateEntryName(name);
                if (entry.isDirectory() || !names.add(name)) throw corrupted("The backup contains invalid entries.");
                byte[] bytes = readBounded(zip, properties.getMaxUncompressedSize().toBytes() - total);
                total = Math.addExact(total, bytes.length);
                entries.put(name, bytes);
                zip.closeEntry();
            }
        } catch (ApiException exception) {
            throw exception;
        } catch (IOException | ArithmeticException exception) {
            throw corrupted("The backup archive is corrupted or exceeds its limits.");
        }
        if (!entries.containsKey(MANIFEST) || !entries.containsKey(COMPANY)) {
            throw corrupted("The backup manifest or Company data is missing.");
        }
        try {
            Manifest manifest = mapper.readValue(entries.get(MANIFEST), Manifest.class);
            if (!FORMAT.equals(manifest.format())) throw format();
            if (manifest.formatVersion() != FORMAT_VERSION) {
                throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "BACKUP_VERSION_UNSUPPORTED",
                        "This LedgerFlow backup version is not supported.");
            }
            if (!"COMPANY".equals(manifest.scope()) || manifest.companyCount() != 1
                    || manifest.sha256() == null) throw format();
            Set<String> contentNames = new HashSet<>(entries.keySet());
            contentNames.remove(MANIFEST);
            if (!contentNames.equals(manifest.sha256().keySet())) {
                throw corrupted("The backup entry list does not match its manifest.");
            }
            for (String name : contentNames) {
                if (!sha256(entries.get(name)).equalsIgnoreCase(manifest.sha256().get(name))) {
                    throw corrupted("A backup entry failed its integrity check.");
                }
            }
            CompanyData company = mapper.readValue(entries.get(COMPANY), CompanyData.class);
            entries.remove(MANIFEST);
            entries.remove(COMPANY);
            if (entries.size() != manifest.attachmentCount()
                    || entries.size() > properties.getMaxAttachments()) throw corrupted("Attachment counts do not match.");
            return new Archive(manifest, company, Map.copyOf(entries));
        } catch (ApiException exception) {
            throw exception;
        } catch (Exception exception) {
            throw corrupted("The backup data is malformed.");
        }
    }

    private byte[] readBounded(InputStream input, long remaining) throws IOException {
        if (remaining < 0) throw tooLarge();
        var output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        long count = 0;
        int read;
        while ((read = input.read(buffer)) != -1) {
            count += read;
            if (count > remaining) throw tooLarge();
            output.write(buffer, 0, read);
        }
        return output.toByteArray();
    }

    private void checkOutputLimits(Map<String, byte[]> entries) {
        if (entries.size() > properties.getMaxEntries()) throw tooLarge();
        long total = 0;
        for (byte[] value : entries.values()) {
            total = Math.addExact(total, value.length);
            if (total > properties.getMaxUncompressedSize().toBytes()) throw tooLarge();
        }
    }

    private void validateEntryName(String name) {
        if (name == null || name.isBlank() || name.indexOf('\0') >= 0 || name.contains("\\")
                || name.startsWith("/") || name.matches("^[A-Za-z]:.*")) throw pathError();
        var parts = Arrays.asList(name.split("/", -1));
        if (parts.stream().anyMatch(part -> part.isBlank() || part.equals(".") || part.equals(".."))) throw pathError();
        if (!(name.equals(MANIFEST) || name.equals(COMPANY) || name.startsWith("attachments/"))) throw pathError();
    }

    public static String sha256(byte[] bytes) {
        try { return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)); }
        catch (NoSuchAlgorithmException exception) { throw new IllegalStateException(exception); }
    }

    private ApiException pathError() {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "BACKUP_CORRUPTED",
                "The backup contains an unsafe archive entry.");
    }
    private ApiException tooLarge() {
        return new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "BACKUP_TOO_LARGE",
                "The backup exceeds the configured resource limits.");
    }
    private ApiException format() {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "BACKUP_FORMAT_INVALID",
                "This is not a supported LedgerFlow Company backup.");
    }
    private ApiException corrupted(String message) {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "BACKUP_CORRUPTED", message);
    }
}
