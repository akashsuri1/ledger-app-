package com.ledgerflow.web;

import com.ledgerflow.dashboard.DashboardService;
import com.ledgerflow.security.CurrentUserService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/companies/{companyId}/dashboard")
public class DashboardController {
    private final CurrentUserService currentUser;
    private final DashboardService dashboard;

    public DashboardController(CurrentUserService currentUser, DashboardService dashboard) {
        this.currentUser = currentUser;
        this.dashboard = dashboard;
    }

    @GetMapping
    ApiEnvelope<DashboardService.DashboardView> get(@PathVariable long companyId,
                                                    @RequestParam(required = false) Integer recentLimit) {
        return ApiEnvelope.of(dashboard.get(currentUser.require(), companyId, recentLimit));
    }
}
