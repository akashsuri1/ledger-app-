package com.ledgerflow.financial;

import java.util.List;

import org.springframework.stereotype.Service;

@Service
public class FinancialCalculationService {
    public record BalanceSplit(long receivable, long payable, long net) {}

    public BalanceSplit splitBalances(List<FinancialRepository.PartyBalance> balances) {
        long receivable = 0;
        long payable = 0;
        for (var party : balances) {
            if (party.balance() > 0) receivable = Math.addExact(receivable, party.balance());
            if (party.balance() < 0) payable = Math.addExact(payable, Math.negateExact(party.balance()));
        }
        return new BalanceSplit(receivable, payable, Math.subtractExact(receivable, payable));
    }

    public long signed(String type, long amount) {
        return "CREDIT".equals(type) ? amount : Math.negateExact(amount);
    }
}
