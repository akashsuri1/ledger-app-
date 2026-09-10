package com.ledgerflow.report;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;

import com.ledgerflow.common.InputValidator;
import com.ledgerflow.company.CompanyRepository;
import com.ledgerflow.financial.FinancialCalculationService;
import com.ledgerflow.financial.FinancialRepository;
import com.ledgerflow.membership.CompanyAccessService;
import com.ledgerflow.party.PartyRepository;
import com.ledgerflow.region.RegionRepository;
import com.ledgerflow.security.AuthenticatedUser;
import com.ledgerflow.settings.CompanySettingsRepository;
import com.ledgerflow.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class ReportService {
    private static final int MAX_STATEMENT_LIMIT = 10_000;
    private static final int MAX_DATE_RANGE_ROWS = 10_000;

    private final CompanyAccessService access;
    private final InputValidator validator;
    private final CompanyRepository companies;
    private final PartyRepository parties;
    private final RegionRepository regions;
    private final CompanySettingsRepository settings;
    private final FinancialRepository financial;
    private final FinancialCalculationService calculations;

    public ReportService(CompanyAccessService access, InputValidator validator, CompanyRepository companies,
                         PartyRepository parties, RegionRepository regions, CompanySettingsRepository settings,
                         FinancialRepository financial, FinancialCalculationService calculations) {
        this.access = access;
        this.validator = validator;
        this.companies = companies;
        this.parties = parties;
        this.regions = regions;
        this.settings = settings;
        this.financial = financial;
        this.calculations = calculations;
    }

    public record CompanyProfile(long id, String name, String address, String phone, String gstin, String email) {}
    public record PartyProfile(long id, long regionId, String regionName, String name, String phone,
                               String address, String gstin, String notes) {}
    public record StatementRow(long id, String transactionDate, String description, String notes,
                               String type, Long credit, Long debit, long signedAmount, long runningBalance) {}
    public record PartyStatement(CompanyProfile company, PartyProfile party, String from, String to,
                                 Object limit, long eligibleTransactionCount, long displayedTransactionCount,
                                 long openingBalance, long totalCredit, long totalDebit, long netMovement,
                                 long closingBalance, List<StatementRow> transactions) {}
    public record ReportTransaction(long id, long partyId, String partyName, long regionId, String regionName,
                                    String transactionDate, String description, String notes, String type,
                                    Long credit, Long debit, long signedAmount) {}
    public record DateRangeReport(CompanyProfile company, String from, String to, Long partyId, Long regionId,
                                  long transactionCount, long openingBalance, long totalCredit, long totalDebit,
                                  long netMovement, long closingBalance, List<ReportTransaction> transactions) {}
    public record RegionParty(long id, String name, long transactionCount, long totalCredit, long totalDebit,
                              long openingBalance, long netMovement, long closingBalance,
                              long balance, long receivable, long payable) {}
    public record RegionRow(long id, String name, long partyCount, long transactionCount,
                            long totalCredit, long totalDebit, long openingBalance, long netMovement,
                            long closingBalance, long netBalance, long totalReceivable, long totalPayable,
                            List<RegionParty> parties) {}
    public record RegionTotals(long regionCount, long partyCount, long transactionCount,
                               long totalCredit, long totalDebit, long openingBalance, long netMovement,
                               long closingBalance, long netBalance, long totalReceivable, long totalPayable) {}
    public record RegionReport(CompanyProfile company, Long regionId, String from, String to,
                               List<RegionRow> regions, RegionTotals totals) {}

    public PartyStatement partyStatement(AuthenticatedUser user, long companyId, long partyId,
                                         String fromValue, String toValue, String limitValue) {
        access.requireMembership(user.userId(), companyId);
        var party = requireParty(companyId, partyId);
        LocalDate from = validator.optionalDate(fromValue, "from");
        LocalDate to = validator.optionalDate(toValue, "to");
        validator.dateRange(from, to);
        Limit limit = statementLimit(companyId, limitValue);

        var activity = financial.activity(companyId, partyId, null, from, to);
        var rows = financial.transactions(companyId, partyId, null, from, to,
                limit.all() ? false : true, limit.all() ? null : limit.value());
        if (!limit.all()) Collections.reverse(rows);
        long opening;
        if (!rows.isEmpty()) {
            var first = rows.getFirst();
            opening = financial.balanceBefore(companyId, partyId, first.transactionDate(), first.id());
        } else {
            opening = from == null ? 0 : financial.balanceBefore(companyId, partyId, from, null);
        }

        long running = opening;
        long credit = 0;
        long debit = 0;
        var statementRows = new ArrayList<StatementRow>();
        for (var row : rows) {
            long signed = calculations.signed(row.type(), row.amount());
            running = Math.addExact(running, signed);
            if ("CREDIT".equals(row.type())) credit = Math.addExact(credit, row.amount());
            else debit = Math.addExact(debit, row.amount());
            statementRows.add(new StatementRow(row.id(), row.transactionDate().toString(), row.description(),
                    row.notes(), row.type(), "CREDIT".equals(row.type()) ? row.amount() : null,
                    "DEBIT".equals(row.type()) ? row.amount() : null, signed, running));
        }
        long movement = Math.subtractExact(credit, debit);
        long closing = Math.addExact(opening, movement);
        return new PartyStatement(company(companyId), party(party), fromValue(from), toValue(to), value(limit),
                activity.transactionCount(), rows.size(), opening, credit, debit, movement, closing, statementRows);
    }

    public DateRangeReport dateRange(AuthenticatedUser user, long companyId, Long partyId, Long regionId,
                                     String fromValue, String toValue) {
        access.requireMembership(user.userId(), companyId);
        LocalDate from = validator.optionalDate(fromValue, "from");
        LocalDate to = validator.optionalDate(toValue, "to");
        validator.dateRange(from, to);
        if (regionId != null) requireRegion(companyId, regionId);
        if (partyId != null) {
            var party = requireParty(companyId, partyId);
            if (regionId != null && party.regionId() != regionId) {
                throw new ApiException(HttpStatus.NOT_FOUND, "PARTY_NOT_FOUND", "The party is unavailable.");
            }
        }
        var activity = financial.activity(companyId, partyId, regionId, from, to);
        if (activity.transactionCount() > MAX_DATE_RANGE_ROWS) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "REPORT_TOO_LARGE",
                    "The date-range report exceeds 10000 transactions. Narrow the filters or date range.");
        }
        long opening = financial.openingBalance(companyId, partyId, regionId, from);
        var rows = financial.transactions(companyId, partyId, regionId, from, to, false, null)
                .stream().map(this::reportRow).toList();
        long movement = activity.netMovement();
        return new DateRangeReport(company(companyId), fromValue(from), toValue(to), partyId, regionId,
                activity.transactionCount(), opening, activity.totalCredit(), activity.totalDebit(),
                movement, Math.addExact(opening, movement), rows);
    }

    public RegionReport regions(AuthenticatedUser user, long companyId, Long regionId,
                                String fromValue, String toValue) {
        access.requireMembership(user.userId(), companyId);
        LocalDate from = validator.optionalDate(fromValue, "from");
        LocalDate to = validator.optionalDate(toValue, "to");
        validator.dateRange(from, to);
        if (regionId != null) requireRegion(companyId, regionId);

        var groups = new LinkedHashMap<Long, MutableRegion>();
        for (var identity : financial.regionIdentities(companyId)) {
            if (regionId == null || identity.id() == regionId) {
                groups.put(identity.id(), new MutableRegion(identity.id(), identity.name()));
            }
        }
        for (var item : financial.partyPeriods(companyId, regionId, from, to)) {
            var group = groups.get(item.regionId());
            long movement = Math.subtractExact(item.totalCredit(), item.totalDebit());
            long receivable = item.closingBalance() > 0 ? item.closingBalance() : 0;
            long payable = item.closingBalance() < 0 ? Math.negateExact(item.closingBalance()) : 0;
            group.parties.add(new RegionParty(item.partyId(), item.partyName(), item.transactionCount(),
                    item.totalCredit(), item.totalDebit(), item.openingBalance(), movement,
                    item.closingBalance(), item.closingBalance(), receivable, payable));
            group.transactionCount += item.transactionCount();
            group.totalCredit += item.totalCredit();
            group.totalDebit += item.totalDebit();
            group.opening += item.openingBalance();
            group.closing += item.closingBalance();
            group.receivable += receivable;
            group.payable += payable;
        }
        var output = groups.values().stream().map(MutableRegion::view).toList();
        long partyCount = 0, transactionCount = 0, credit = 0, debit = 0, opening = 0,
                closing = 0, receivable = 0, payable = 0;
        for (var row : output) {
            partyCount += row.partyCount(); transactionCount += row.transactionCount();
            credit += row.totalCredit(); debit += row.totalDebit(); opening += row.openingBalance();
            closing += row.closingBalance(); receivable += row.totalReceivable(); payable += row.totalPayable();
        }
        var totals = new RegionTotals(output.size(), partyCount, transactionCount, credit, debit, opening,
                credit - debit, closing, closing, receivable, payable);
        return new RegionReport(company(companyId), regionId, fromValue(from), toValue(to), output, totals);
    }

    private ReportTransaction reportRow(FinancialRepository.LedgerRow row) {
        long signed = calculations.signed(row.type(), row.amount());
        return new ReportTransaction(row.id(), row.partyId(), row.partyName(), row.regionId(), row.regionName(),
                row.transactionDate().toString(), row.description(), row.notes(), row.type(),
                "CREDIT".equals(row.type()) ? row.amount() : null,
                "DEBIT".equals(row.type()) ? row.amount() : null, signed);
    }

    private CompanyProfile company(long companyId) {
        var value = companies.find(companyId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                "COMPANY_NOT_FOUND", "The company is unavailable."));
        return new CompanyProfile(value.id(), value.name(), value.address(), value.phone(), value.gstin(), value.email());
    }

    private PartyRepository.Party requireParty(long companyId, long partyId) {
        return parties.find(companyId, partyId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                "PARTY_NOT_FOUND", "The party is unavailable."));
    }

    private RegionRepository.Region requireRegion(long companyId, long regionId) {
        return regions.find(companyId, regionId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                "REGION_NOT_FOUND", "The region is unavailable."));
    }

    private PartyProfile party(PartyRepository.Party value) {
        return new PartyProfile(value.id(), value.regionId(), value.regionName(), value.name(), value.phone(),
                value.address(), value.gstin(), value.notes());
    }

    private Limit statementLimit(long companyId, String requested) {
        String raw = requested;
        if (raw == null || raw.isBlank()) {
            raw = settings.find(companyId).orElseThrow().defaultTransactionLimit();
        }
        String normalized = raw.trim().toUpperCase();
        if ("ALL".equals(normalized)) return new Limit(true, null);
        try {
            int value = Integer.parseInt(normalized);
            if (value >= 1 && value <= MAX_STATEMENT_LIMIT) return new Limit(false, value);
        } catch (NumberFormatException ignored) {
            // Converted to the stable API error below.
        }
        throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_REPORT_LIMIT",
                "limit must be ALL or a whole number between 1 and 10000.");
    }

    private Object value(Limit limit) { return limit.all() ? "ALL" : limit.value(); }
    private String fromValue(LocalDate value) { return value == null ? null : value.toString(); }
    private String toValue(LocalDate value) { return value == null ? null : value.toString(); }
    private record Limit(boolean all, Integer value) {}

    private static final class MutableRegion {
        private final long id;
        private final String name;
        private final List<RegionParty> parties = new ArrayList<>();
        private long transactionCount;
        private long totalCredit;
        private long totalDebit;
        private long opening;
        private long closing;
        private long receivable;
        private long payable;
        private MutableRegion(long id, String name) { this.id = id; this.name = name; }
        private RegionRow view() {
            return new RegionRow(id, name, parties.size(), transactionCount, totalCredit, totalDebit,
                    opening, totalCredit - totalDebit, closing, closing, receivable, payable, parties);
        }
    }
}
