package com.ledgerflow.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "ledgerflow.database")
public class LedgerFlowDatabaseProperties {

    private String path = "./data/ledgerflow.db";

    public String getPath() {
        return path;
    }

    public void setPath(String path) {
        this.path = path;
    }
}
