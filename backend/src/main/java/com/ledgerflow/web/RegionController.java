package com.ledgerflow.web;

import java.util.List;

import com.ledgerflow.region.RegionService;
import com.ledgerflow.security.CurrentUserService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/api/companies/{companyId}/regions")
public class RegionController {
    private final CurrentUserService currentUser;
    private final RegionService regions;
    public RegionController(CurrentUserService currentUser, RegionService regions) {
        this.currentUser = currentUser; this.regions = regions;
    }

    @GetMapping ApiEnvelope<List<RegionService.RegionView>> list(@PathVariable long companyId) {
        return ApiEnvelope.of(regions.list(currentUser.require(), companyId));
    }

    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    ApiEnvelope<RegionService.RegionView> create(@PathVariable long companyId, @RequestBody JsonNode body) {
        return ApiEnvelope.of(regions.create(currentUser.require(), companyId, body));
    }

    @PatchMapping("/{regionId}") ApiEnvelope<RegionService.RegionView> update(
            @PathVariable long companyId, @PathVariable long regionId, @RequestBody JsonNode body) {
        return ApiEnvelope.of(regions.update(currentUser.require(), companyId, regionId, body));
    }

    @DeleteMapping("/{regionId}") ApiEnvelope<AuthController.Message> delete(
            @PathVariable long companyId, @PathVariable long regionId) {
        regions.delete(currentUser.require(), companyId, regionId);
        return ApiEnvelope.of(new AuthController.Message("Region deleted."));
    }
}
