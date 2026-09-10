package com.ledgerflow.web;

import com.ledgerflow.security.CurrentUserService;
import com.ledgerflow.transaction.TransactionService;
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
@RequestMapping("/api/companies/{companyId}/transactions")
public class TransactionController {
    private final CurrentUserService currentUser;
    private final TransactionService transactions;

    public TransactionController(CurrentUserService currentUser, TransactionService transactions) {
        this.currentUser = currentUser;
        this.transactions = transactions;
    }

    @GetMapping
    PagedEnvelope<TransactionService.TransactionView> list(
            @PathVariable long companyId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Long partyId,
            @RequestParam(required = false) Long regionId,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "25") int pageSize
    ) {
        var result = transactions.list(currentUser.require(), companyId, search, partyId, regionId,
                type, from, to, page, pageSize);
        return PagedEnvelope.of(result.items(), page, pageSize, result.total());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    ApiEnvelope<TransactionService.TransactionView> create(
            @PathVariable long companyId,
            @RequestBody JsonNode body
    ) {
        return ApiEnvelope.of(transactions.create(currentUser.require(), companyId, body));
    }

    @GetMapping("/{transactionId}")
    ApiEnvelope<TransactionService.TransactionView> get(
            @PathVariable long companyId,
            @PathVariable long transactionId
    ) {
        return ApiEnvelope.of(transactions.get(currentUser.require(), companyId, transactionId));
    }

    @PatchMapping("/{transactionId}")
    ApiEnvelope<TransactionService.TransactionView> update(
            @PathVariable long companyId,
            @PathVariable long transactionId,
            @RequestBody JsonNode body
    ) {
        return ApiEnvelope.of(transactions.update(currentUser.require(), companyId, transactionId, body));
    }

    @DeleteMapping("/{transactionId}")
    ApiEnvelope<AuthController.Message> delete(
            @PathVariable long companyId,
            @PathVariable long transactionId
    ) {
        transactions.delete(currentUser.require(), companyId, transactionId);
        return ApiEnvelope.of(new AuthController.Message("Transaction deleted."));
    }
}
