package com.ledgerflow.web;

import com.ledgerflow.report.ReportService;
import com.ledgerflow.security.CurrentUserService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/companies/{companyId}/reports")
public class ReportController {
    private final CurrentUserService currentUser;
    private final ReportService reports;

    public ReportController(CurrentUserService currentUser, ReportService reports) {
        this.currentUser = currentUser;
        this.reports = reports;
    }

    @GetMapping("/party-statement")
    ApiEnvelope<ReportService.PartyStatement> partyStatement(@PathVariable long companyId,
            @RequestParam long partyId, @RequestParam(required = false) String from,
            @RequestParam(required = false) String to, @RequestParam(required = false) String limit) {
        return ApiEnvelope.of(reports.partyStatement(currentUser.require(), companyId, partyId, from, to, limit));
    }

    @GetMapping("/date-range")
    ApiEnvelope<ReportService.DateRangeReport> dateRange(@PathVariable long companyId,
            @RequestParam(required = false) Long partyId, @RequestParam(required = false) Long regionId,
            @RequestParam(required = false) String from, @RequestParam(required = false) String to) {
        return ApiEnvelope.of(reports.dateRange(currentUser.require(), companyId, partyId, regionId, from, to));
    }

    @GetMapping("/regions")
    ApiEnvelope<ReportService.RegionReport> regions(@PathVariable long companyId,
            @RequestParam(required = false) Long regionId, @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        return ApiEnvelope.of(reports.regions(currentUser.require(), companyId, regionId, from, to));
    }
}
