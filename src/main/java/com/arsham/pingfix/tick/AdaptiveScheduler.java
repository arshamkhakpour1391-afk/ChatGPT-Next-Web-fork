package com.arsham.pingfix.tick;

import com.arsham.pingfix.config.PingFixConfig;

/**
 * Dynamically adjusts tick work quotas to prevent frame drops during network lag.
 * Created by Arsham for Minecraft 1.21.11 Fabric.
 */
public class AdaptiveScheduler {
    private final PingFixConfig config;
    private volatile long calculatedBudgetNanos = 10_000_000L; // 10ms default

    public AdaptiveScheduler(PingFixConfig config) {
        this.config = config;
    }

    public void updateAdaptiveBudget(double clientTickMs, double frameTimeMs, boolean jitterSpike) {
        if (!config.adaptiveTickBudget) {
            calculatedBudgetNanos = config.maxTickBudgetNanos;
            return;
        }

        // If client is experiencing lag, tighten non-critical processing slices to preserve responsiveness
        if (clientTickMs > 30.0 || frameTimeMs > 22.0 || jitterSpike) {
            calculatedBudgetNanos = Math.max(4_000_000L, calculatedBudgetNanos - 1_000_000L);
        } else if (clientTickMs < 16.0 && frameTimeMs < 14.0) {
            calculatedBudgetNanos = Math.min(config.maxTickBudgetNanos, calculatedBudgetNanos + 500_000L);
        }
    }

    public long getCalculatedBudgetNanos() {
        return calculatedBudgetNanos;
    }
}
