package com.ledgerflow.web;

import com.ledgerflow.preferences.MeService;
import com.ledgerflow.security.CurrentUserService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/api/me")
public class MeController {
    private final CurrentUserService currentUser;
    private final MeService me;
    public MeController(CurrentUserService currentUser, MeService me) { this.currentUser = currentUser; this.me = me; }

    @GetMapping("/bootstrap")
    ApiEnvelope<MeService.Bootstrap> bootstrap() {
        return ApiEnvelope.of(me.bootstrap(currentUser.require()));
    }

    @PatchMapping("/preferences")
    ApiEnvelope<MeService.PreferencesView> preferences(@RequestBody JsonNode body) {
        if (!body.isObject()) invalid("Request body must be an object.");
        boolean rememberPresent = body.has("rememberLastCompany");
        JsonNode rememberNode = body.get("rememberLastCompany");
        if (rememberPresent && (rememberNode == null || !rememberNode.isBoolean()))
            invalid("rememberLastCompany must be a boolean.");

        boolean lastPresent = body.has("lastActiveCompanyId");
        JsonNode lastNode = body.get("lastActiveCompanyId");
        Long last = null;
        if (lastPresent && lastNode != null && !lastNode.isNull()) {
            if (!lastNode.isIntegralNumber() || lastNode.longValue() <= 0) invalid("lastActiveCompanyId must be a positive integer or null.");
            last = lastNode.longValue();
        }

        boolean appearancePresent = body.has("appearance");
        JsonNode appearance = body.get("appearance");
        if (appearancePresent && (appearance == null || !appearance.isObject())) invalid("appearance must be an object.");

        var command = new MeService.UpdateCommand(rememberPresent,
                rememberPresent ? rememberNode.booleanValue() : null,
                lastPresent, last, appearancePresent, appearance);
        return ApiEnvelope.of(me.update(currentUser.require(), command));
    }

    private void invalid(String message) {
        throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_ERROR", message);
    }
}
