package com.ledgerflow.security;

public record AuthenticatedUser(long userId, long sessionId, String name, String email) {}
