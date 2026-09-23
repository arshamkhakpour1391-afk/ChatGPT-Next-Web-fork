package com.arsham.pingfix.sync;

import net.minecraft.util.math.BlockPos;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Advanced desync detector: tracks pending block actions and purges stale predictions.
 * Created by Arsham for Minecraft 1.21.11 Fabric.
 */
public class DesyncDetector {
    private final ConcurrentHashMap<BlockPos, Long> pendingBlockActions = new ConcurrentHashMap<>();
    private volatile int desyncCount = 0;

    public void recordPendingAction(BlockPos pos) {
        if (pos == null) return;
        pendingBlockActions.put(pos, System.currentTimeMillis());
    }

    public void resolveAction(BlockPos pos) {
        if (pos == null) return;
        pendingBlockActions.remove(pos);
    }

    public void checkStaleActions() {
        long now = System.currentTimeMillis();
        pendingBlockActions.entrySet().removeIf(entry -> {
            if (now - entry.getValue() > 2000) {
                desyncCount++;
                return true;
            }
            return false;
        });
    }

    public int getDesyncCount() { return desyncCount; }
    public void clear() { pendingBlockActions.clear(); }
}
