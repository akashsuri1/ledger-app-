package com.ledgerflow.backup;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Arrays;

import javax.crypto.AEADBadTagException;
import javax.crypto.Cipher;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;

import com.ledgerflow.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class BackupCrypto {
    private static final byte[] MAGIC = "LFBK0001".getBytes(StandardCharsets.US_ASCII);
    private static final int CONTAINER_VERSION = 1;
    private static final int KDF_PBKDF2_SHA256 = 1;
    private static final int SALT_LENGTH = 32;
    private static final int NONCE_LENGTH = 12;
    private static final int TAG_BITS = 128;
    private final SecureRandom random = new SecureRandom();
    private final BackupProperties properties;

    public BackupCrypto(BackupProperties properties) { this.properties = properties; }

    public byte[] encrypt(byte[] plaintext, char[] passphrase) {
        requirePassphrase(passphrase);
        byte[] salt = new byte[SALT_LENGTH];
        byte[] nonce = new byte[NONCE_LENGTH];
        random.nextBytes(salt);
        random.nextBytes(nonce);
        byte[] header = header(properties.getPbkdf2Iterations(), salt, nonce);
        byte[] key = derive(passphrase, salt, properties.getPbkdf2Iterations());
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(TAG_BITS, nonce));
            cipher.updateAAD(header);
            byte[] ciphertext = cipher.doFinal(plaintext);
            var output = new ByteArrayOutputStream(header.length + ciphertext.length);
            output.writeBytes(header);
            output.writeBytes(ciphertext);
            return output.toByteArray();
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("The backup could not be encrypted.", exception);
        } finally {
            Arrays.fill(key, (byte) 0);
            Arrays.fill(salt, (byte) 0);
            Arrays.fill(nonce, (byte) 0);
        }
    }

    public byte[] decrypt(byte[] encrypted, char[] passphrase) {
        requirePassphrase(passphrase);
        if (encrypted.length > properties.getMaxEncryptedSize().toBytes()) {
            throw error(HttpStatus.PAYLOAD_TOO_LARGE, "BACKUP_TOO_LARGE", "The backup exceeds the configured size limit.");
        }
        ParsedHeader parsed = parse(encrypted);
        byte[] key = derive(passphrase, parsed.salt(), parsed.iterations());
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"),
                    new GCMParameterSpec(TAG_BITS, parsed.nonce()));
            cipher.updateAAD(parsed.encoded());
            return cipher.doFinal(encrypted, parsed.encoded().length, encrypted.length - parsed.encoded().length);
        } catch (AEADBadTagException exception) {
            throw error(HttpStatus.UNPROCESSABLE_ENTITY, "BACKUP_PASSWORD_INVALID",
                    "The passphrase is incorrect or the backup has been altered.");
        } catch (GeneralSecurityException | IllegalArgumentException exception) {
            throw error(HttpStatus.UNPROCESSABLE_ENTITY, "BACKUP_CORRUPTED", "The encrypted backup is corrupted.");
        } finally {
            Arrays.fill(key, (byte) 0);
            Arrays.fill(parsed.salt(), (byte) 0);
            Arrays.fill(parsed.nonce(), (byte) 0);
        }
    }

    private ParsedHeader parse(byte[] encrypted) {
        try {
            var raw = new ByteArrayInputStream(encrypted);
            var input = new DataInputStream(raw);
            byte[] magic = input.readNBytes(MAGIC.length);
            if (!Arrays.equals(MAGIC, magic)) throw format();
            int version = input.readInt();
            if (version != CONTAINER_VERSION) {
                throw error(HttpStatus.UNPROCESSABLE_ENTITY, "BACKUP_VERSION_UNSUPPORTED",
                        "This backup container version is not supported.");
            }
            if (input.readUnsignedByte() != KDF_PBKDF2_SHA256) throw format();
            int iterations = input.readInt();
            if (iterations < 100_000 || iterations > 1_000_000) throw format();
            int saltLength = input.readUnsignedByte();
            if (saltLength != SALT_LENGTH) throw format();
            byte[] salt = input.readNBytes(saltLength);
            int nonceLength = input.readUnsignedByte();
            if (nonceLength != NONCE_LENGTH) throw format();
            byte[] nonce = input.readNBytes(nonceLength);
            int headerLength = encrypted.length - raw.available();
            if (salt.length != SALT_LENGTH || nonce.length != NONCE_LENGTH
                    || encrypted.length - headerLength < 16) throw format();
            return new ParsedHeader(iterations, salt, nonce, Arrays.copyOf(encrypted, headerLength));
        } catch (ApiException exception) {
            throw exception;
        } catch (Exception exception) {
            throw format();
        }
    }

    private byte[] header(int iterations, byte[] salt, byte[] nonce) {
        try {
            var output = new ByteArrayOutputStream();
            var data = new DataOutputStream(output);
            data.write(MAGIC);
            data.writeInt(CONTAINER_VERSION);
            data.writeByte(KDF_PBKDF2_SHA256);
            data.writeInt(iterations);
            data.writeByte(salt.length);
            data.write(salt);
            data.writeByte(nonce.length);
            data.write(nonce);
            data.flush();
            return output.toByteArray();
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private byte[] derive(char[] passphrase, byte[] salt, int iterations) {
        var specification = new PBEKeySpec(passphrase, salt, iterations, 256);
        try {
            return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(specification).getEncoded();
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("The backup key could not be derived.", exception);
        } finally {
            specification.clearPassword();
        }
    }

    private void requirePassphrase(char[] passphrase) {
        if (passphrase == null || passphrase.length < 8 || passphrase.length > 1024) {
            throw error(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_ERROR",
                    "passphrase must contain between 8 and 1024 characters.");
        }
    }

    private ApiException format() {
        return error(HttpStatus.UNPROCESSABLE_ENTITY, "BACKUP_FORMAT_INVALID",
                "This is not a supported LedgerFlow backup file.");
    }
    private ApiException error(HttpStatus status, String code, String message) {
        return new ApiException(status, code, message);
    }

    private record ParsedHeader(int iterations, byte[] salt, byte[] nonce, byte[] encoded) {}
}
