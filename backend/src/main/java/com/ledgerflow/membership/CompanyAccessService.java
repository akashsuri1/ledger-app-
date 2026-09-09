package com.ledgerflow.membership;

import java.util.Arrays;
import java.util.Set;

import com.ledgerflow.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class CompanyAccessService {
    private final MembershipRepository memberships;
    public CompanyAccessService(MembershipRepository memberships) { this.memberships = memberships; }

    public boolean hasMembership(long userId, long companyId) {
        return memberships.findActive(userId, companyId).isPresent();
    }

    public MembershipRepository.Membership requireMembership(long userId, long companyId) {
        return memberships.findActive(userId, companyId).orElseThrow(() -> new ApiException(
                HttpStatus.NOT_FOUND, "COMPANY_ACCESS_DENIED", "The company is unavailable."));
    }

    public MembershipRepository.Membership requireRole(long userId, long companyId,
                                                         MembershipRole... allowedRoles) {
        var membership = requireMembership(userId, companyId);
        Set<MembershipRole> allowed = Set.copyOf(Arrays.asList(allowedRoles));
        if (!allowed.contains(membership.role())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "COMPANY_ROLE_FORBIDDEN",
                    "Your company role does not allow this action.");
        }
        return membership;
    }

    public void requireOwnerRemovalLeavesAnotherOwner(long userId, long companyId) {
        var membership = requireMembership(userId, companyId);
        if (membership.role() == MembershipRole.OWNER && memberships.countActiveOwners(companyId) <= 1) {
            throw new ApiException(HttpStatus.CONFLICT, "FINAL_OWNER_REQUIRED",
                    "A company must retain at least one active owner.");
        }
    }
}
