package com.ledgerflow.preferences;

import java.util.List;

import com.ledgerflow.membership.CompanyAccessService;
import com.ledgerflow.membership.MembershipRepository;
import com.ledgerflow.security.AuthenticatedUser;
import com.ledgerflow.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Service
public class MeService {
    private final MembershipRepository memberships;
    private final CompanyAccessService access;
    private final UserPreferencesRepository preferences;
    private final ObjectMapper mapper;

    public MeService(MembershipRepository memberships, CompanyAccessService access,
                     UserPreferencesRepository preferences, ObjectMapper mapper) {
        this.memberships = memberships; this.access = access; this.preferences = preferences; this.mapper = mapper;
    }

    public record UserView(long id, String name, String email) {}
    public record CompanyView(long id, String name, String address, String phone, String gstin,
                              String email, String role, String createdAt) {}
    public record PreferencesView(boolean rememberLastCompany, Long lastActiveCompanyId,
                                  JsonNode appearance) {}
    public record Bootstrap(UserView user, List<CompanyView> companies, PreferencesView preferences) {}
    public record UpdateCommand(boolean rememberPresent, Boolean rememberLastCompany,
                                boolean lastCompanyPresent, Long lastActiveCompanyId,
                                boolean appearancePresent, JsonNode appearance) {}

    @Transactional(readOnly = true)
    public Bootstrap bootstrap(AuthenticatedUser user) {
        List<CompanyView> companies = memberships.findAccessibleCompanies(user.userId()).stream()
                .map(company -> new CompanyView(company.id(), company.name(), company.address(), company.phone(),
                        company.gstin(), company.email(), company.role().name(), company.createdAt().toString()))
                .toList();
        var stored = preferences.find(user.userId());
        Long validLast = stored.lastActiveCompanyId();
        if (validLast != null && !access.hasMembership(user.userId(), validLast)) validLast = null;
        return new Bootstrap(new UserView(user.userId(), user.name(), user.email()), companies,
                new PreferencesView(stored.rememberLastCompany(), validLast, parseAppearance(stored.appearanceJson())));
    }

    @Transactional
    public PreferencesView update(AuthenticatedUser user, UpdateCommand command) {
        var stored = preferences.find(user.userId());
        boolean remember = command.rememberPresent() ? command.rememberLastCompany() : stored.rememberLastCompany();
        Long last = command.lastCompanyPresent() ? command.lastActiveCompanyId() : stored.lastActiveCompanyId();
        if (last != null) access.requireMembership(user.userId(), last);
        JsonNode appearance = command.appearancePresent() ? command.appearance() : parseAppearance(stored.appearanceJson());
        try {
            preferences.save(user.userId(), new UserPreferencesRepository.Preferences(
                    remember, last, mapper.writeValueAsString(appearance)));
        } catch (Exception exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "MALFORMED_REQUEST", "Appearance settings are invalid.");
        }
        return new PreferencesView(remember, last, appearance);
    }

    private JsonNode parseAppearance(String json) {
        try { return mapper.readTree(json); }
        catch (Exception exception) { return mapper.createObjectNode(); }
    }
}
