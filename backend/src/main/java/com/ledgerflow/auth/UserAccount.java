package com.ledgerflow.auth;

public record UserAccount(long id, String name, String email, String passwordHash) {}
