package com.ledgerflow.web;

import com.ledgerflow.backup.BackupModels.LegacyPreview;
import com.ledgerflow.backup.BackupModels.LegacyResult;
import com.ledgerflow.backup.LegacyImportService;
import com.ledgerflow.security.CurrentUserService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

@RestController
public class LegacyImportController {
    private final CurrentUserService currentUser;
    private final LegacyImportService imports;

    public LegacyImportController(CurrentUserService currentUser, LegacyImportService imports) {
        this.currentUser = currentUser; this.imports = imports;
    }

    @PostMapping("/api/import/legacy/preview")
    ApiEnvelope<LegacyPreview> preview(@RequestBody JsonNode body) {
        return ApiEnvelope.of(imports.preview(currentUser.require(), body));
    }

    @PostMapping("/api/import/legacy/commit")
    ApiEnvelope<LegacyResult> commit(@RequestBody JsonNode body) {
        return ApiEnvelope.of(imports.commit(currentUser.require(), body));
    }
}
