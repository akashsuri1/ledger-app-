package com.ledgerflow.backup;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;
import java.util.function.Supplier;

import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Component
public class CompanyOperationLock {
    private final ConcurrentHashMap<Long, ReentrantLock> locks = new ConcurrentHashMap<>();

    public <T> T withLock(long companyId, Supplier<T> operation) {
        ReentrantLock lock = locks.computeIfAbsent(companyId, ignored -> new ReentrantLock(true));
        lock.lock();
        try { return operation.get(); }
        finally { lock.unlock(); }
    }

    public void withLock(long companyId, Runnable operation) {
        withLock(companyId, () -> { operation.run(); return null; });
    }

    public void lockUntilTransactionComplete(long companyId) {
        ReentrantLock lock = locks.computeIfAbsent(companyId, ignored -> new ReentrantLock(true));
        lock.lock();
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            lock.unlock();
            throw new IllegalStateException("A transaction synchronization is required for this company lock.");
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCompletion(int status) { lock.unlock(); }
        });
    }
}
