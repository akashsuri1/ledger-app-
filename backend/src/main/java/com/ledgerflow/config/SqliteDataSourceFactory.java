package com.ledgerflow.config;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import javax.sql.DataSource;

import org.sqlite.SQLiteConfig;
import org.sqlite.SQLiteDataSource;

public final class SqliteDataSourceFactory {

    private SqliteDataSourceFactory() {
    }

    public static DataSource create(String configuredPath) {
        if (configuredPath == null || configuredPath.isBlank()) {
            throw new IllegalArgumentException("ledgerflow.database.path must not be blank");
        }

        Path databasePath = Path.of(configuredPath).toAbsolutePath().normalize();
        Path parent = databasePath.getParent();

        try {
            if (parent != null) {
                Files.createDirectories(parent);
            }
        } catch (IOException exception) {
            throw new IllegalStateException(
                    "Could not create the LedgerFlow database directory: " + parent,
                    exception
            );
        }

        SQLiteConfig config = new SQLiteConfig();
        config.enforceForeignKeys(true);
        config.setBusyTimeout(5_000);
        config.setJournalMode(SQLiteConfig.JournalMode.WAL);
        config.setSynchronous(SQLiteConfig.SynchronousMode.NORMAL);

        SQLiteDataSource dataSource = new SQLiteDataSource(config);
        String portablePath = databasePath.toString().replace('\\', '/');
        dataSource.setUrl("jdbc:sqlite:" + portablePath);
        return dataSource;
    }
}
