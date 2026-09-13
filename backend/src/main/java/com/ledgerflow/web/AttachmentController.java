package com.ledgerflow.web;

import java.nio.charset.StandardCharsets;

import com.ledgerflow.attachment.AttachmentService;
import com.ledgerflow.attachment.AttachmentView;
import com.ledgerflow.security.CurrentUserService;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/companies/{companyId}/transactions/{transactionId}/attachment")
public class AttachmentController {
    private final CurrentUserService currentUser;
    private final AttachmentService attachments;

    public AttachmentController(CurrentUserService currentUser, AttachmentService attachments) {
        this.currentUser = currentUser;
        this.attachments = attachments;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    ResponseEntity<ApiEnvelope<AttachmentView>> upload(@PathVariable long companyId,
                                                        @PathVariable long transactionId,
                                                        @RequestPart("file") MultipartFile file) {
        var result = attachments.upload(currentUser.require(), companyId, transactionId, file);
        return ResponseEntity.status(201).body(ApiEnvelope.of(result));
    }

    @GetMapping
    ResponseEntity<InputStreamResource> download(@PathVariable long companyId,
                                                  @PathVariable long transactionId) {
        var result = attachments.download(currentUser.require(), companyId, transactionId);
        var disposition = ContentDisposition.attachment()
                .filename(result.metadata().originalName(), StandardCharsets.UTF_8).build();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(result.metadata().mimeType()))
                .contentLength(result.byteSize())
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header("X-Content-Type-Options", "nosniff")
                .cacheControl(CacheControl.noStore())
                .body(new InputStreamResource(result.inputStream()));
    }

    @DeleteMapping
    ApiEnvelope<AuthController.Message> delete(@PathVariable long companyId,
                                                @PathVariable long transactionId) {
        attachments.delete(currentUser.require(), companyId, transactionId);
        return ApiEnvelope.of(new AuthController.Message("Attachment deleted."));
    }
}
