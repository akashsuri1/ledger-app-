package com.ledgerflow.backup;

import java.io.IOException;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

import com.ledgerflow.auth.SecurityAuditRepository;
import com.ledgerflow.backup.BackupModels.CompanySummary;
import com.ledgerflow.backup.BackupModels.Preview;
import com.ledgerflow.backup.BackupModels.RestoreResult;
import com.ledgerflow.common.TextNormalizer;
import com.ledgerflow.company.CompanyRepository;
import com.ledgerflow.membership.CompanyAccessService;
import com.ledgerflow.membership.MembershipRepository;
import com.ledgerflow.membership.MembershipRole;
import com.ledgerflow.security.AuthenticatedUser;
import com.ledgerflow.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

@Service
public class BackupService {
    private final CompanyAccessService access;
    private final MembershipRepository memberships;
    private final CompanyRepository companies;
    private final BackupSnapshotRepository snapshots;
    private final BackupArchive archives;
    private final BackupCrypto crypto;
    private final BackupDataValidator validator;
    private final BackupProperties properties;
    private final CompanyOperationLock locks;
    private final CompanyRestoreWriter restoreWriter;
    private final SecurityAuditRepository audit;
    private final TransactionTemplate transactionTemplate;

    public BackupService(CompanyAccessService access, MembershipRepository memberships,
                         CompanyRepository companies, BackupSnapshotRepository snapshots,
                         BackupArchive archives, BackupCrypto crypto, BackupDataValidator validator,
                         BackupProperties properties, CompanyOperationLock locks,
                         CompanyRestoreWriter restoreWriter, SecurityAuditRepository audit,
                         TransactionTemplate transactionTemplate) {
        this.access = access; this.memberships = memberships; this.companies = companies;
        this.snapshots = snapshots; this.archives = archives; this.crypto = crypto;
        this.validator = validator; this.properties = properties; this.locks = locks;
        this.restoreWriter = restoreWriter; this.audit = audit; this.transactionTemplate = transactionTemplate;
    }

    public BackupFile create(AuthenticatedUser user, long companyId, char[] passphrase) {
        try {
            access.requireRole(user.userId(), companyId, MembershipRole.OWNER);
            return locks.withLock(companyId, () -> transactionTemplate.execute(status -> {
                var snapshot = snapshots.snapshot(companyId);
                try {
                    byte[] plaintext = archives.encode(snapshot.company(), snapshot.files());
                    try {
                        byte[] encrypted = crypto.encrypt(plaintext, passphrase);
                        if (encrypted.length > properties.getMaxEncryptedSize().toBytes()) throw tooLarge();
                        audit.record(user.userId(), companyId, "BACKUP_CREATED", "COMPANY", companyId,
                                "{\"attachmentCount\":" + snapshot.files().size() + "}");
                        return new BackupFile(fileName(snapshot.company().name()), encrypted);
                    } finally {
                        Arrays.fill(plaintext, (byte) 0);
                    }
                } finally {
                    snapshot.files().values().forEach(bytes -> Arrays.fill(bytes, (byte) 0));
                }
            }));
        } finally {
            Arrays.fill(passphrase, '\0');
        }
    }

    public Preview preview(AuthenticatedUser user, MultipartFile file, char[] passphrase) {
        try {
            requireRestoreAuthority(user.userId());
            var validated = readAndValidate(file, passphrase);
            try {
                var company = validated.archive().company();
                var conflicts = nameConflicts(user.userId(), company.name());
                return new Preview(true, validated.archive().manifest().formatVersion(),
                        validated.archive().manifest().createdAt(), new CompanySummary(company.name()),
                        validated.counts(), List.of(), conflicts);
            } finally {
                clearAttachments(validated);
            }
        } finally {
            Arrays.fill(passphrase, '\0');
        }
    }

    public RestoreResult restoreAsNew(AuthenticatedUser user, MultipartFile file, char[] passphrase,
                                      String requestedName) {
        try {
            requireRestoreAuthority(user.userId());
            var validated = readAndValidate(file, passphrase);
            try {
                String name = requestedName == null || requestedName.isBlank()
                        ? validated.archive().company().name() : TextNormalizer.display(requestedName);
                if (name.isEmpty()) throw new ApiException(HttpStatus.CONFLICT, "RESTORE_CONFLICT",
                        "A non-empty Company name is required.");
                if (!nameConflicts(user.userId(), name).isEmpty()) throw new ApiException(HttpStatus.CONFLICT,
                        "RESTORE_CONFLICT", "You already have access to a Company with this name.");
                return restoreWriter.restore(user.userId(), validated.archive(), validated.counts(), name,
                        "COMPANY_RESTORED");
            } finally {
                clearAttachments(validated);
            }
        } finally {
            Arrays.fill(passphrase, '\0');
        }
    }

    private BackupDataValidator.Validated readAndValidate(MultipartFile file, char[] passphrase) {
        if (file == null || file.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST,
                "BACKUP_FORMAT_INVALID", "An encrypted backup file is required.");
        if (file.getSize() > properties.getMaxEncryptedSize().toBytes()) throw tooLarge();
        try {
            byte[] encrypted = file.getBytes();
            byte[] plaintext = crypto.decrypt(encrypted, passphrase);
            try { return validator.validate(archives.decode(plaintext)); }
            finally { Arrays.fill(plaintext, (byte) 0); }
        } catch (ApiException exception) {
            throw exception;
        } catch (IOException exception) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "BACKUP_CORRUPTED",
                    "The encrypted backup could not be read.");
        }
    }

    public void requireRestoreAuthority(long userId) {
        int active = memberships.countActiveMemberships(userId);
        if (active > 0 && memberships.countOwnedCompanies(userId) == 0) {
            throw new ApiException(HttpStatus.FORBIDDEN, "COMPANY_ROLE_FORBIDDEN",
                    "Only a Company owner can restore or import Company data.");
        }
    }

    private List<String> nameConflicts(long userId, String name) {
        return companies.accessibleNameExists(userId, TextNormalizer.comparison(name), null)
                ? List.of("COMPANY_NAME_ALREADY_ACCESSIBLE") : List.of();
    }

    private void clearAttachments(BackupDataValidator.Validated validated) {
        validated.archive().entries().values().forEach(bytes -> Arrays.fill(bytes, (byte) 0));
    }

    private String fileName(String companyName) {
        String safe = companyName.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-|-$", "");
        if (safe.isEmpty()) safe = "company";
        if (safe.length() > 64) safe = safe.substring(0, 64);
        return safe + "-" + LocalDate.now() + ".lfbak";
    }

    private ApiException tooLarge() {
        return new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "BACKUP_TOO_LARGE",
                "The backup exceeds the configured size limit.");
    }

    public record BackupFile(String fileName, byte[] bytes) {}
}
