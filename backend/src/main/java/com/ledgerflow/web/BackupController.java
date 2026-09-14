package com.ledgerflow.web;

import java.nio.charset.StandardCharsets;

import com.ledgerflow.backup.BackupModels.Preview;
import com.ledgerflow.backup.BackupModels.RestoreResult;
import com.ledgerflow.backup.BackupService;
import com.ledgerflow.security.CurrentUserService;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
public class BackupController {
    private static final MediaType BACKUP_MEDIA = MediaType.parseMediaType("application/vnd.ledgerflow.backup");
    private final CurrentUserService currentUser;
    private final BackupService backups;

    public BackupController(CurrentUserService currentUser, BackupService backups) {
        this.currentUser = currentUser;
        this.backups = backups;
    }

    @PostMapping("/api/companies/{companyId}/backup")
    ResponseEntity<byte[]> create(@PathVariable long companyId, @RequestBody BackupRequest body) {
        var file = backups.create(currentUser.require(), companyId, passphrase(body));
        var disposition = ContentDisposition.attachment()
                .filename(file.fileName(), StandardCharsets.UTF_8).build();
        return ResponseEntity.ok().contentType(BACKUP_MEDIA).contentLength(file.bytes().length)
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header("X-Content-Type-Options", "nosniff")
                .cacheControl(CacheControl.noStore()).body(file.bytes());
    }

    @PostMapping(path = "/api/backups/restore/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    ApiEnvelope<Preview> preview(@RequestPart("file") MultipartFile file,
                                 @RequestParam("passphrase") String passphrase) {
        return ApiEnvelope.of(backups.preview(currentUser.require(), file, passphrase.toCharArray()));
    }

    @PostMapping(path = "/api/backups/restore/commit", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    ApiEnvelope<RestoreResult> commit(@RequestPart("file") MultipartFile file,
                                      @RequestParam("passphrase") String passphrase,
                                      @RequestParam(value = "companyName", required = false) String companyName) {
        return ApiEnvelope.of(backups.restoreAsNew(currentUser.require(), file,
                passphrase.toCharArray(), companyName));
    }

    private char[] passphrase(BackupRequest body) {
        if (body == null || body.passphrase() == null) {
            throw new ApiException(org.springframework.http.HttpStatus.UNPROCESSABLE_ENTITY,
                    "VALIDATION_ERROR", "passphrase is required.");
        }
        return body.passphrase();
    }

    /** Prevents Spring's debug request logging from rendering the secret value. */
    public record BackupRequest(char[] passphrase) {
        @Override public String toString() { return "BackupRequest[passphrase=[REDACTED]]"; }
    }
}
