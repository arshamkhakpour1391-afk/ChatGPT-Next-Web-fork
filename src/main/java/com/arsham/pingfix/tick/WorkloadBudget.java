package com.arsham.pingfix.tick;

/**
 * Microsecond time budget calculator for background packet and chunk processing.
 * Created by Arsham for Minecraft 1.21.11 Fabric.
 */
public class WorkloadBudget {
    private final long maxBudgetNanos;
    private final long startNanos;

    public WorkloadBudget(long maxBudgetNanos) {
        this.maxBudgetNanos = maxBudgetNanos;
        this.startNanos = System.nanoTime();
    }

    public boolean hasRemainingBudget() {
        return (System.nanoTime() - startNanos) < maxBudgetNanos;
    }
}
