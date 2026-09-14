package com.ledgerflow.backup;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.ledgerflow.backup.BackupModels.Archive;
import com.ledgerflow.backup.BackupModels.CompanyData;
import com.ledgerflow.backup.BackupModels.Counts;
import com.ledgerflow.backup.BackupModels.LegacyWorkspace;
import com.ledgerflow.backup.BackupModels.Manifest;
import com.ledgerflow.backup.BackupModels.PartyData;
import com.ledgerflow.backup.BackupModels.RegionData;
import com.ledgerflow.backup.BackupModels.SettingsData;
import com.ledgerflow.backup.BackupModels.TransactionData;
import com.ledgerflow.common.TextNormalizer;
import com.ledgerflow.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Component
public class LegacyWorkspaceParser {
    private final BackupDataValidator validator;
    private final BackupProperties properties;
    private final ObjectMapper mapper;

    public LegacyWorkspaceParser(BackupDataValidator validator, BackupProperties properties,
                                 ObjectMapper mapper) {
        this.validator = validator; this.properties = properties; this.mapper = mapper;
    }

    public LegacyWorkspace parse(JsonNode input) {
        try {
            JsonNode workspace = unwrap(input);
            JsonNode companyNodes = array(workspace, "companies");
            JsonNode regionNodes = array(workspace, "regions");
            JsonNode partyNodes = array(workspace, "parties");
            JsonNode transactionNodes = array(workspace, "transactions");
            long total = (long) companyNodes.size() + regionNodes.size() + partyNodes.size()
                    + transactionNodes.size();
            if (total > properties.getMaxEntries()) throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE,
                    "BACKUP_TOO_LARGE", "The legacy workspace exceeds the configured record limit.");
            uniqueIds(companyNodes, "Company"); uniqueIds(regionNodes, "Region");
            uniqueIds(partyNodes, "Party"); uniqueIds(transactionNodes, "Transaction");

            Set<Long> knownCompanies = new HashSet<>();
            Set<String> companyNames = new HashSet<>();
            for (JsonNode company : companyNodes) {
                knownCompanies.add(id(company, "id"));
                if (!companyNames.add(TextNormalizer.comparison(text(company, "name", false)))) {
                    invalid("Company names are duplicated after normalization.");
                }
            }
            ensureCompanyReferences(regionNodes, knownCompanies, "Region");
            ensureCompanyReferences(partyNodes, knownCompanies, "Party");
            ensureCompanyReferences(transactionNodes, knownCompanies, "Transaction");

            List<String> warnings = new ArrayList<>();
            List<CompanyData> result = new ArrayList<>();
            int regionCount = 0, partyCount = 0, transactionCount = 0, attachmentNames = 0;
            for (JsonNode company : companyNodes) {
                long companyId = id(company, "id");
                List<RegionData> regions = new ArrayList<>();
                for (JsonNode region : regionNodes) if (id(region, "companyId") == companyId) {
                    regions.add(new RegionData(id(region, "id"), text(region, "name", false)));
                }
                List<PartyData> parties = new ArrayList<>();
                for (JsonNode party : partyNodes) if (id(party, "companyId") == companyId) {
                    parties.add(new PartyData(id(party, "id"), id(party, "regionId"),
                            text(party, "name", false), text(party, "phone", true),
                            text(party, "address", true), text(party, "gstin", true),
                            text(party, "notes", true)));
                }
                List<TransactionData> transactions = new ArrayList<>();
                for (JsonNode transaction : transactionNodes) if (id(transaction, "companyId") == companyId) {
                    JsonNode amount = transaction.get("amount");
                    if (amount == null || !amount.isIntegralNumber() || !amount.canConvertToLong()
                            || amount.longValue() <= 0) invalid("Transaction amount must be a positive whole-rupee integer.");
                    String attachmentName = optional(transaction, "attachmentName");
                    if (!attachmentName.isEmpty()) attachmentNames++;
                    transactions.add(new TransactionData(id(transaction, "id"), id(transaction, "partyId"),
                            text(transaction, "type", false), amount.longValue(),
                            transactionDate(transaction, warnings), text(transaction, "description", false),
                            text(transaction, "notes", true), null));
                }
                var raw = new CompanyData(companyId, text(company, "name", false),
                        text(company, "address", true), text(company, "phone", true),
                        text(company, "gstin", true), text(company, "email", true), settings(company.get("settings")),
                        regions, parties, transactions);
                var manifest = new Manifest(BackupArchive.FORMAT, 1, Instant.now().toString(), "legacy",
                        "COMPANY", 1, 0, Map.of());
                result.add(validator.validate(new Archive(manifest, raw, Map.of())).archive().company());
                regionCount += regions.size(); partyCount += parties.size(); transactionCount += transactions.size();
            }
            if (attachmentNames > 0) warnings.add("Original attachment files were not stored in the browser backup; "
                    + attachmentNames + " attachment name(s) cannot be migrated automatically.");
            String appearance = appearance(workspace);
            return new LegacyWorkspace(List.copyOf(result), appearance,
                    new Counts(result.size(), regionCount, partyCount, transactionCount, 0), List.copyOf(warnings));
        } catch (ApiException exception) {
            if (exception.code().startsWith("BACKUP_") && !"BACKUP_TOO_LARGE".equals(exception.code())) {
                throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "LEGACY_IMPORT_INVALID",
                        exception.getMessage());
            }
            throw exception;
        } catch (RuntimeException exception) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "LEGACY_IMPORT_INVALID",
                    "The legacy workspace structure is invalid.");
        }
    }

    private JsonNode unwrap(JsonNode input) {
        if (input == null || !input.isObject()) invalid("The legacy import must be a JSON object.");
        if (!input.has("format")) return input;
        String format = text(input, "format", false);
        if (!("ledgerflow-backup".equals(format) || "ledgerflow-workspace".equals(format))) {
            invalid("The legacy format is not recognized.");
        }
        JsonNode version = input.get("version");
        if (version == null || !version.isIntegralNumber() || version.intValue() != 1) {
            invalid("The legacy version is unsupported.");
        }
        JsonNode data = input.get("data");
        if (data == null || !data.isObject()) invalid("The legacy workspace data is missing.");
        return data;
    }

    private SettingsData settings(JsonNode value) {
        if (value == null || !value.isObject()) invalid("Company Settings are missing.");
        JsonNode print = value.get("print");
        if (print == null || !print.isObject()) invalid("Company print Settings are missing.");
        JsonNode limit = print.get("defaultTransactionLimit");
        String limitValue = limit != null && limit.isIntegralNumber()
                ? String.valueOf(limit.intValue()) : text(print, "defaultTransactionLimit", false);
        return new SettingsData(text(value, "statementHeader", true), text(value, "statementFooter", true),
                limitValue, bool(print, "showRunningBalance"), bool(print, "showNotes"),
                bool(print, "showAttachment"), bool(print, "showBusinessAddress"),
                bool(print, "showBusinessPhone"), bool(print, "showBusinessGstin"),
                bool(print, "showGeneratedDate"), bool(print, "showPageNumbers"),
                text(print, "paperSize", false), text(print, "orientation", false),
                text(print, "fontSize", false), text(print, "customFooter", true));
    }

    private String transactionDate(JsonNode transaction, List<String> warnings) {
        JsonNode value = transaction.get("transactionDate");
        if (value == null) value = transaction.get("transactionDateTime");
        if (value == null || !value.isTextual()) invalid("Transaction date is missing.");
        String raw = value.asText().trim();
        String date = raw.length() >= 10 ? raw.substring(0, 10) : raw;
        try { LocalDate.parse(date); }
        catch (RuntimeException exception) { invalid("Transaction date is invalid."); }
        if (!date.matches("\\d{4}-\\d{2}-\\d{2}")) invalid("Transaction date is invalid.");
        if (!raw.equals(date)) {
            if (!raw.matches("\\d{4}-\\d{2}-\\d{2}T.+")) invalid("Transaction date is invalid.");
            warnings.add("A legacy date-time value was reduced to its recorded YYYY-MM-DD date.");
        }
        return date;
    }

    private String appearance(JsonNode workspace) {
        JsonNode application = workspace.get("applicationSettings");
        JsonNode appearance = application == null ? null : application.get("appearance");
        if (appearance == null || !appearance.isObject()) invalid("Application appearance Settings are missing.");
        try { return mapper.writeValueAsString(appearance); }
        catch (Exception exception) { invalid("Application appearance Settings are invalid."); return "{}"; }
    }

    private void ensureCompanyReferences(JsonNode items, Set<Long> companies, String label) {
        for (JsonNode item : items) if (!companies.contains(id(item, "companyId"))) {
            invalid(label + " references an unknown Company.");
        }
    }
    private void uniqueIds(JsonNode items, String label) {
        Set<Long> values = new HashSet<>();
        for (JsonNode item : items) if (!values.add(id(item, "id"))) invalid(label + " identifiers are duplicated.");
    }
    private JsonNode array(JsonNode parent, String field) {
        JsonNode value = parent.get(field);
        if (value == null || !value.isArray()) invalid(field + " must be a list.");
        return value;
    }
    private long id(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        if (value == null || !value.isIntegralNumber() || !value.canConvertToLong() || value.longValue() <= 0) {
            invalid(field + " must be a positive integer.");
        }
        return value.longValue();
    }
    private String text(JsonNode node, String field, boolean emptyAllowed) {
        JsonNode value = node == null ? null : node.get(field);
        if (value == null || !value.isTextual()) invalid(field + " must be text.");
        String result = value.asText().trim();
        if (!emptyAllowed && result.isEmpty()) invalid(field + " is required.");
        return result;
    }
    private String optional(JsonNode node, String field) {
        JsonNode value = node.get(field);
        if (value == null) return "";
        if (!value.isTextual()) invalid(field + " must be text.");
        return value.asText().trim();
    }
    private boolean bool(JsonNode node, String field) {
        JsonNode value = node.get(field);
        if (value == null || !value.isBoolean()) invalid(field + " must be true or false.");
        return value.booleanValue();
    }
    private void invalid(String message) {
        throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "LEGACY_IMPORT_INVALID", message);
    }
}
