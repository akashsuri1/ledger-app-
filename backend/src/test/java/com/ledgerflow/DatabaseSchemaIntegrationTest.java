package com.ledgerflow;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.output.MigrateResult;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

@SpringBootTest
class DatabaseSchemaIntegrationTest {

    private static final String NOW = "2026-09-09T10:00:00.000Z";
    private static final Path DATABASE_PATH = Path.of(
            System.getProperty("java.io.tmpdir"),
            "ledgerflow-schema-" + UUID.randomUUID() + ".db"
    );

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("ledgerflow.database.path", DATABASE_PATH::toString);
    }

    @Autowired
    private DataSource dataSource;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private Flyway flyway;

    @BeforeEach
    void clearApplicationTables() {
        jdbc.update("DELETE FROM audit_log");
        jdbc.update("DELETE FROM password_reset_tokens");
        jdbc.update("DELETE FROM transaction_attachments");
        jdbc.update("DELETE FROM transactions");
        jdbc.update("DELETE FROM parties");
        jdbc.update("DELETE FROM regions");
        jdbc.update("DELETE FROM company_settings");
        jdbc.update("DELETE FROM user_preferences");
        jdbc.update("DELETE FROM company_memberships");
        jdbc.update("DELETE FROM auth_sessions");
        jdbc.update("DELETE FROM companies");
        jdbc.update("DELETE FROM users");
    }

    @AfterAll
    static void removeTestDatabase() throws IOException {
        Files.deleteIfExists(DATABASE_PATH);
        Files.deleteIfExists(Path.of(DATABASE_PATH + "-wal"));
        Files.deleteIfExists(Path.of(DATABASE_PATH + "-shm"));
    }

    @Test
    void applicationStartsAndMigratesFreshDatabase() {
        assertNotNull(dataSource);
        assertTrue(Files.exists(DATABASE_PATH));

        Integer successfulMigrations = jdbc.queryForObject(
                "SELECT COUNT(*) FROM flyway_schema_history WHERE success = 1",
                Integer.class
        );
        assertEquals(2, successfulMigrations);

        Integer domainTableCount = jdbc.queryForObject(
                """
                SELECT COUNT(*)
                FROM sqlite_master
                WHERE type = 'table'
                  AND name IN (
                    'users', 'auth_sessions', 'companies', 'company_memberships',
                    'user_preferences', 'company_settings', 'regions', 'parties',
                    'transactions', 'transaction_attachments', 'audit_log',
                    'password_reset_tokens'
                  )
                """,
                Integer.class
        );
        assertEquals(12, domainTableCount);
    }

    @Test
    void rerunningMigrationLeavesSchemaAndDataIntact() {
        insertCompany(10, "Persistent Company");

        flyway.validate();
        MigrateResult secondRun = flyway.migrate();

        assertEquals(0, secondRun.migrationsExecuted);
        assertEquals(
                "Persistent Company",
                jdbc.queryForObject("SELECT name FROM companies WHERE id = 10", String.class)
        );
    }

    @Test
    void sqliteForeignKeysAreEnabled() {
        Integer enabled = jdbc.queryForObject("PRAGMA foreign_keys", Integer.class);
        assertEquals(1, enabled);
    }

    @Test
    void duplicateNormalizedRegionInsideCompanyIsRejected() {
        insertCompany(10, "Company A");
        insertRegion(100, 10, "Punjab", "punjab");

        assertThrows(
                DataAccessException.class,
                () -> insertRegion(101, 10, "PUNJAB", "punjab")
        );
    }

    @Test
    void sameNormalizedRegionAcrossCompaniesIsAllowed() {
        insertCompany(10, "Company A");
        insertCompany(20, "Company B");

        insertRegion(100, 10, "Punjab", "punjab");
        insertRegion(200, 20, "PUNJAB", "punjab");

        assertEquals(
                2,
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM regions WHERE normalized_name = 'punjab'",
                        Integer.class
                )
        );
    }

    @Test
    void partyCannotReferenceRegionFromAnotherCompany() {
        insertCompany(10, "Company A");
        insertCompany(20, "Company B");
        insertRegion(100, 10, "Punjab", "punjab");

        assertThrows(
                DataAccessException.class,
                () -> insertParty(200, 20, 100, "Wrong Company Party")
        );
    }

    @Test
    void transactionCannotReferencePartyFromAnotherCompany() {
        insertCompany(10, "Company A");
        insertCompany(20, "Company B");
        insertRegion(100, 10, "Punjab", "punjab");
        insertParty(1000, 10, 100, "Company A Party");

        assertThrows(
                DataAccessException.class,
                () -> insertTransaction(5000, 20, 1000, 25000L)
        );
    }

    @Test
    void transactionAmountMustBePositiveWholeRupees() {
        insertLedgerParents();
        insertTransaction(5000, 10, 1000, 25000L);

        Number savedAmount = jdbc.queryForObject(
                "SELECT amount FROM transactions WHERE id = 5000",
                Number.class
        );
        assertNotNull(savedAmount);
        assertEquals(25000L, savedAmount.longValue());

        assertThrows(
                DataAccessException.class,
                () -> insertTransaction(5001, 10, 1000, 0L)
        );
        assertThrows(
                DataAccessException.class,
                () -> insertTransactionWithAmount(5002, 10, 1000, 25000.50)
        );
    }

    @Test
    void transactionDateRejectsDateTimeValues() {
        insertLedgerParents();

        assertThrows(
                DataAccessException.class,
                () -> jdbc.update(
                        """
                        INSERT INTO transactions (
                            id, company_id, party_id, type, amount, transaction_date,
                            description, notes, created_at, updated_at
                        ) VALUES (?, ?, ?, 'CREDIT', ?, ?, 'Invoice', '', ?, ?)
                        """,
                        5000, 10, 1000, 1000L, "2026-09-09T10:30:00", NOW, NOW
                )
        );
    }

    @Test
    void regionContainingPartyCannotBeDeleted() {
        insertLedgerParents();

        assertThrows(
                DataAccessException.class,
                () -> jdbc.update("DELETE FROM regions WHERE id = 100")
        );
        assertEquals(
                1,
                jdbc.queryForObject("SELECT COUNT(*) FROM regions WHERE id = 100", Integer.class)
        );
    }

    @Test
    void deletingPartyCascadesTransactionsAndAttachmentMetadata() {
        insertLedgerParents();
        insertTransaction(5000, 10, 1000, 25000L);
        jdbc.update(
                """
                INSERT INTO transaction_attachments (
                    id, company_id, transaction_id, storage_key,
                    original_name, mime_type, byte_size, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                7000, 10, 5000, "company-10/receipt.pdf",
                "receipt.pdf", "application/pdf", 1024L, NOW
        );

        jdbc.update("DELETE FROM parties WHERE id = 1000");

        assertEquals(0, count("transactions"));
        assertEquals(0, count("transaction_attachments"));
    }

    @Test
    void populatedCompanyCannotBeDeletedByCascade() {
        insertCompany(10, "Company A");
        insertRegion(100, 10, "Punjab", "punjab");

        assertThrows(
                DataAccessException.class,
                () -> jdbc.update("DELETE FROM companies WHERE id = 10")
        );
    }

    @Test
    void companyMembershipIsUniquePerUserAndCompany() {
        insertUser(1, "owner@example.com");
        insertCompany(10, "Company A");
        insertMembership(10, 1, "OWNER");

        assertThrows(
                DataAccessException.class,
                () -> insertMembership(10, 1, "ACCOUNTANT")
        );
    }

    @Test
    void nonEmptyPartyGstinIsUniqueInsideCompany() {
        insertCompany(10, "Company A");
        insertRegion(100, 10, "Punjab", "punjab");
        insertRegion(101, 10, "Haryana", "haryana");
        insertPartyWithGstin(1000, 10, 100, "Party One", "03ABCDE1234F1Z5");

        assertThrows(
                DataAccessException.class,
                () -> insertPartyWithGstin(
                        1001, 10, 101, "Party Two", "03ABCDE1234F1Z5"
                )
        );
    }

    private void insertLedgerParents() {
        insertCompany(10, "Company A");
        insertRegion(100, 10, "Punjab", "punjab");
        insertParty(1000, 10, 100, "Ledger Party");
    }

    private void insertUser(long id, String email) {
        jdbc.update(
                """
                INSERT INTO users (
                    id, name, email, normalized_email, password_hash, created_at, updated_at
                ) VALUES (?, 'Test User', ?, ?, 'not-a-real-hash', ?, ?)
                """,
                id, email, email.toLowerCase(), NOW, NOW
        );
    }

    private void insertCompany(long id, String name) {
        jdbc.update(
                """
                INSERT INTO companies (
                    id, name, normalized_name, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?)
                """,
                id, name, name.toLowerCase(), NOW, NOW
        );
    }

    private void insertMembership(long companyId, long userId, String role) {
        jdbc.update(
                """
                INSERT INTO company_memberships (
                    company_id, user_id, role, status, created_at, updated_at
                ) VALUES (?, ?, ?, 'ACTIVE', ?, ?)
                """,
                companyId, userId, role, NOW, NOW
        );
    }

    private void insertRegion(long id, long companyId, String name, String normalizedName) {
        jdbc.update(
                """
                INSERT INTO regions (
                    id, company_id, name, normalized_name, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                id, companyId, name, normalizedName, NOW, NOW
        );
    }

    private void insertParty(long id, long companyId, long regionId, String name) {
        insertPartyWithGstin(id, companyId, regionId, name, "");
    }

    private void insertPartyWithGstin(
            long id,
            long companyId,
            long regionId,
            String name,
            String gstin
    ) {
        jdbc.update(
                """
                INSERT INTO parties (
                    id, company_id, region_id, name, normalized_name,
                    gstin, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                id, companyId, regionId, name, name.toLowerCase(), gstin, NOW, NOW
        );
    }

    private void insertTransaction(long id, long companyId, long partyId, long amount) {
        insertTransactionWithAmount(id, companyId, partyId, amount);
    }

    private void insertTransactionWithAmount(
            long id,
            long companyId,
            long partyId,
            Object amount
    ) {
        jdbc.update(
                """
                INSERT INTO transactions (
                    id, company_id, party_id, type, amount, transaction_date,
                    description, notes, created_at, updated_at
                ) VALUES (?, ?, ?, 'CREDIT', ?, '2026-09-09', 'Invoice', '', ?, ?)
                """,
                id, companyId, partyId, amount, NOW, NOW
        );
    }

    private int count(String table) {
        Integer value = jdbc.queryForObject("SELECT COUNT(*) FROM " + table, Integer.class);
        return value == null ? 0 : value;
    }
}
