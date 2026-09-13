package com.ledgerflow.dashboard;

import java.time.YearMonth;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;

import com.ledgerflow.attachment.AttachmentView;
import com.ledgerflow.financial.FinancialCalculationService;
import com.ledgerflow.financial.FinancialRepository;
import com.ledgerflow.membership.CompanyAccessService;
import com.ledgerflow.security.AuthenticatedUser;
import com.ledgerflow.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class DashboardService {
    private static final int DEFAULT_RECENT_LIMIT = 5;
    private static final int MAX_RECENT_LIMIT = 25;

    private final CompanyAccessService access;
    private final FinancialRepository financial;
    private final FinancialCalculationService calculations;

    public DashboardService(CompanyAccessService access, FinancialRepository financial,
                            FinancialCalculationService calculations) {
        this.access = access;
        this.financial = financial;
        this.calculations = calculations;
    }

    public record RecentTransaction(long id, long partyId, String partyName, long regionId,
                                    String regionName, String type, long amount, String transactionDate,
                                    String description, String notes, AttachmentView attachment) {}
    public record RegionSummary(long id, String name, long partyCount,
                                long receivable, long payable, long net) {}
    public record ChartPoint(String key, String month, long credit, long debit) {}
    public record DashboardView(long partyCount, long transactionCount, long totalReceivable,
                                long totalPayable, long netBalance,
                                List<RecentTransaction> recentTransactions,
                                List<RegionSummary> regions, List<ChartPoint> chart) {}

    public DashboardView get(AuthenticatedUser user, long companyId, Integer requestedLimit) {
        access.requireMembership(user.userId(), companyId);
        int recentLimit = requestedLimit == null ? DEFAULT_RECENT_LIMIT : requestedLimit;
        if (recentLimit < 1 || recentLimit > MAX_RECENT_LIMIT) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_ERROR",
                    "recentLimit must be between 1 and 25.");
        }

        var counts = financial.counts(companyId);
        var partyBalances = financial.partyBalances(companyId, null);
        var totals = calculations.splitBalances(partyBalances);
        var recent = financial.transactions(companyId, null, null, null, null, true, recentLimit)
                .stream().map(this::recent).toList();

        var regionGroups = new LinkedHashMap<Long, MutableRegion>();
        for (var party : partyBalances) {
            var region = regionGroups.computeIfAbsent(party.regionId(),
                    ignored -> new MutableRegion(party.regionId(), party.regionName()));
            region.partyCount++;
            if (party.balance() > 0) region.receivable = Math.addExact(region.receivable, party.balance());
            if (party.balance() < 0) region.payable = Math.addExact(region.payable, Math.negateExact(party.balance()));
        }
        // Include Regions without Parties.
        var regionRows = new ArrayList<RegionSummary>();
        var allRegions = financial.regionIdentities(companyId);
        for (var identity : allRegions) {
            var region = regionGroups.getOrDefault(identity.id(), new MutableRegion(identity.id(), identity.name()));
            regionRows.add(new RegionSummary(region.id, region.name, region.partyCount,
                    region.receivable, region.payable, region.receivable - region.payable));
        }

        return new DashboardView(counts.partyCount(), counts.transactionCount(), totals.receivable(),
                totals.payable(), totals.net(), recent, regionRows, chart(companyId));
    }

    private List<ChartPoint> chart(long companyId) {
        YearMonth last = YearMonth.now();
        YearMonth first = last.minusMonths(5);
        var activity = financial.monthlyActivity(companyId, first.toString(), last.toString()).stream()
                .collect(java.util.stream.Collectors.toMap(FinancialRepository.MonthActivity::month, item -> item));
        var points = new ArrayList<ChartPoint>();
        for (int offset = 0; offset < 6; offset++) {
            YearMonth month = first.plusMonths(offset);
            var value = activity.get(month.toString());
            points.add(new ChartPoint(month.toString(),
                    month.getMonth().getDisplayName(TextStyle.SHORT, Locale.ENGLISH),
                    value == null ? 0 : value.credit(), value == null ? 0 : value.debit()));
        }
        return points;
    }

    private RecentTransaction recent(FinancialRepository.LedgerRow row) {
        return new RecentTransaction(row.id(), row.partyId(), row.partyName(), row.regionId(),
                row.regionName(), row.type(), row.amount(), row.transactionDate().toString(),
                row.description(), row.notes(), row.attachment());
    }

    private static final class MutableRegion {
        private final long id;
        private final String name;
        private long partyCount;
        private long receivable;
        private long payable;
        private MutableRegion(long id, String name) { this.id = id; this.name = name; }
    }
}
