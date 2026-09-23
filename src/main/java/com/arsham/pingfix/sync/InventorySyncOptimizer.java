package com.arsham.pingfix.sync;

import com.arsham.pingfix.config.PingFixConfig;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Protects inventory and slot click sequences from desynchronization during network lag.
 * Created by Arsham for Minecraft 1.21.11 Fabric.
 */
public class InventorySyncOptimizer {
    private final PingFixConfig config;
    private final AtomicInteger pendingTransactions = new AtomicInteger(0);

    public InventorySyncOptimizer(PingFixConfig config) {
        this.config = config;
    }

    public void onSlotClick() {
        if (!config.enableInventorySyncProtection) return;
        pendingTransactions.incrementAndGet();
    }

    public void onServerConfirm() {
        if (!config.enableInventorySyncProtection) return;
        pendingTransactions.updateAndGet(v -> Math.max(0, v - 1));
    }

    public int getPendingTransactions() { return pendingTransactions.get(); }
    public void reset() { pendingTransactions.set(0); }
}
