package com.ledgerflow;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

import com.ledgerflow.config.SqliteDataSourceFactory;

class DatabaseMigrationUpgradeTest {

    private static final String NOW = "2026-09-09T10:00:00.000Z";

    @Test
    void versionThreeDatabaseMigratesToFourWithoutLosingLedgerOrOldAttachments() throws Exception {
        Path database = Path.of(System.getProperty("java.io.tmpdir"),
                "ledgerflow-upgrade-" + UUID.randomUUID() + ".db");
        try {
            var source = SqliteDataSourceFactory.create(database.toString());
            Flyway.configure().dataSource(source).communityDBSupportEnabled(true)
                    .locations("classpath:db/migration").target("3").load().migrate();
            JdbcTemplate jdbc = new JdbcTemplate(source);
            jdbc.update("INSERT INTO users(id,name,email,normalized_email,password_hash,created_at,updated_at) VALUES (1,'Owner','owner@example.test','owner@example.test','old-hash',?,?)", NOW, NOW);
            jdbc.update("INSERT INTO companies(id,name,normalized_name,created_at,updated_at) VALUES (1,'Old Company','old company',?,?)", NOW, NOW);
            jdbc.update("INSERT INTO company_memberships(company_id,user_id,role,created_at,updated_at) VALUES (1,1,'OWNER',?,?)", NOW, NOW);
            jdbc.update("INSERT INTO regions(id,company_id,name,normalized_name,created_at,updated_at) VALUES (1,1,'North','north',?,?)", NOW, NOW);
            jdbc.update("INSERT INTO parties(id,company_id,region_id,name,normalized_name,created_at,updated_at) VALUES (1,1,1,'Old Party','old party',?,?)", NOW, NOW);
            jdbc.update("INSERT INTO transactions(id,company_id,party_id,type,amount,transaction_date,description,created_at,updated_at) VALUES (1,1,1,'CREDIT',5000,'2026-09-09','Old invoice',?,?)", NOW, NOW);
            jdbc.update("INSERT INTO transaction_attachments(id,company_id,transaction_id,storage_key,original_name,mime_type,byte_size,created_at) VALUES (1,1,1,'old-file','old.pdf','application/pdf',9,?)", NOW);

            Flyway current = Flyway.configure().dataSource(source).communityDBSupportEnabled(true)
                    .locations("classpath:db/migration").load();
            current.migrate();
            current.validate();

            assertEquals(4, jdbc.queryForObject("SELECT count(*) FROM flyway_schema_history WHERE success=1", Integer.class));
            assertEquals(5000L, jdbc.queryForObject("SELECT amount FROM transactions WHERE id=1", Long.class));
            assertEquals("Old Company", jdbc.queryForObject("SELECT name FROM companies WHERE id=1", String.class));
            assertEquals("old.pdf", jdbc.queryForObject("SELECT original_name FROM transaction_attachments WHERE id=1", String.class));
            assertEquals(null, jdbc.queryForObject("SELECT sha256 FROM transaction_attachments WHERE id=1", String.class));
            assertEquals(1, jdbc.queryForObject("PRAGMA foreign_keys", Integer.class));
            assertThrows(DataAccessException.class, () -> jdbc.update("UPDATE transaction_attachments SET sha256='invalid' WHERE id=1"));
            current.migrate();
            assertEquals(4, jdbc.queryForObject("SELECT count(*) FROM flyway_schema_history WHERE success=1", Integer.class));
        } finally {
            Files.deleteIfExists(database);
            Files.deleteIfExists(Path.of(database + "-wal"));
            Files.deleteIfExists(Path.of(database + "-shm"));
        }
    }
}
