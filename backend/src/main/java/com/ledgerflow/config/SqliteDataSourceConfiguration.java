package com.ledgerflow.config;

import javax.sql.DataSource;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(LedgerFlowDatabaseProperties.class)
public class SqliteDataSourceConfiguration {

    @Bean
    DataSource dataSource(LedgerFlowDatabaseProperties properties) {
        return SqliteDataSourceFactory.create(properties.getPath());
    }
}
