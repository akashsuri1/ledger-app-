package com.ledgerflow.attachment;

import java.io.IOException;
import java.io.InputStream;
import java.util.Locale;
import java.util.Map;

import com.ledgerflow.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

@Component
public class AttachmentFileValidator {
    private static final Map<String, String> MIME_TYPES = Map.of(
            "pdf", "application/pdf",
            "png", "image/png",
            "jpg", "image/jpeg",
            "jpeg", "image/jpeg"
    );
    private final AttachmentProperties properties;

    public AttachmentFileValidator(AttachmentProperties properties) { this.properties = properties; }

    public ValidatedFile validate(MultipartFile file) {
        if (file == null || file.isEmpty()) throw invalidContent("The attachment is empty.");
        long maximum = properties.getMaxSize().toBytes();
        if (file.getSize() > maximum) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "ATTACHMENT_TOO_LARGE",
                    "The attachment exceeds the configured size limit.");
        }
        String originalName = safeBaseName(file.getOriginalFilename());
        int dot = originalName.lastIndexOf('.');
        if (dot <= 0 || dot == originalName.length() - 1) throw typeNotAllowed();
        String extension = originalName.substring(dot + 1).toLowerCase(Locale.ROOT);
        String expectedMime = MIME_TYPES.get(extension);
        if (expectedMime == null) throw typeNotAllowed();
        String suppliedMime = file.getContentType() == null ? "" : file.getContentType().trim().toLowerCase(Locale.ROOT);
        if (!expectedMime.equals(suppliedMime)) throw typeNotAllowed();
        byte[] header = new byte[8];
        int read = 0;
        try (InputStream input = file.getInputStream()) {
            while (read < header.length) {
                int count = input.read(header, read, header.length - read);
                if (count < 0) break;
                read += count;
            }
        } catch (IOException exception) {
            throw invalidContent("The attachment could not be read.");
        }
        if (!hasExpectedSignature(extension, header, read)) {
            throw invalidContent("The attachment content does not match its declared file type.");
        }
        return new ValidatedFile(originalName, extension, expectedMime, maximum);
    }

    private String safeBaseName(String raw) {
        String value = raw == null ? "" : raw.replace('\\', '/');
        value = value.substring(value.lastIndexOf('/') + 1).trim();
        var safe = new StringBuilder();
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            safe.append(Character.isISOControl(character) || character == '"' ? '_' : character);
        }
        String result = safe.toString().trim();
        if (result.isBlank() || result.equals(".") || result.equals("..")) throw typeNotAllowed();
        return result.length() <= 255 ? result : result.substring(result.length() - 255);
    }

    private boolean hasExpectedSignature(String extension, byte[] bytes, int length) {
        return switch (extension) {
            case "pdf" -> length >= 5 && bytes[0] == '%' && bytes[1] == 'P' && bytes[2] == 'D'
                    && bytes[3] == 'F' && bytes[4] == '-';
            case "png" -> length >= 8 && bytes[0] == (byte) 0x89 && bytes[1] == 0x50
                    && bytes[2] == 0x4e && bytes[3] == 0x47 && bytes[4] == 0x0d
                    && bytes[5] == 0x0a && bytes[6] == 0x1a && bytes[7] == 0x0a;
            case "jpg", "jpeg" -> length >= 3 && bytes[0] == (byte) 0xff
                    && bytes[1] == (byte) 0xd8 && bytes[2] == (byte) 0xff;
            default -> false;
        };
    }

    private ApiException typeNotAllowed() {
        return new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "ATTACHMENT_TYPE_NOT_ALLOWED",
                "Only PDF, PNG, JPG, and JPEG attachments are allowed.");
    }

    private ApiException invalidContent(String message) {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "ATTACHMENT_CONTENT_INVALID", message);
    }

    public record ValidatedFile(String originalName, String extension, String mimeType, long maxBytes) {}
}
