package com.arsham.pingfix.chunk;

/**
 * Prevents client freezes during rapid exploration.
 * Created by Arsham for Minecraft 1.21.11 Fabric.
 */
public class ChunkFreezeProtection {
    public boolean shouldThrottleChunkRebuild(long currentElapsedNanos, long maxBudgetNanos) {
        return currentElapsedNanos > maxBudgetNanos;
    }
}
