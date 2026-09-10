package com.ledgerflow.web;

import com.ledgerflow.party.PartyService;
import com.ledgerflow.security.CurrentUserService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/api/companies/{companyId}/parties")
public class PartyController {
    private final CurrentUserService currentUser;
    private final PartyService parties;
    public PartyController(CurrentUserService currentUser, PartyService parties) {
        this.currentUser = currentUser; this.parties = parties;
    }

    @GetMapping
    PagedEnvelope<PartyService.PartyView> list(@PathVariable long companyId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Long regionId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "25") int pageSize) {
        var result = parties.list(currentUser.require(), companyId, search, regionId, page, pageSize);
        return PagedEnvelope.of(result.items(), page, pageSize, result.total());
    }

    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    ApiEnvelope<PartyService.PartyView> create(@PathVariable long companyId, @RequestBody JsonNode body) {
        return ApiEnvelope.of(parties.create(currentUser.require(), companyId, body));
    }

    @GetMapping("/{partyId}")
    ApiEnvelope<PartyService.PartyView> get(@PathVariable long companyId, @PathVariable long partyId) {
        return ApiEnvelope.of(parties.get(currentUser.require(), companyId, partyId));
    }

    @PatchMapping("/{partyId}")
    ApiEnvelope<PartyService.PartyView> update(@PathVariable long companyId, @PathVariable long partyId,
                                               @RequestBody JsonNode body) {
        return ApiEnvelope.of(parties.update(currentUser.require(), companyId, partyId, body));
    }

    @DeleteMapping("/{partyId}")
    ApiEnvelope<AuthController.Message> delete(@PathVariable long companyId, @PathVariable long partyId) {
        parties.delete(currentUser.require(), companyId, partyId);
        return ApiEnvelope.of(new AuthController.Message("Party and its transactions deleted."));
    }
}
