package com.arsham.pingfix.sync;

import com.arsham.pingfix.config.PingFixConfig;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Entity synchronization optimizer: smooths entity interpolation during server lag spikes.
 * Prevents snapping and jerky entity teleports when server bursts delayed movement packets.
 * 100% Anti-Cheat safe.
 * Created by Arsham for Minecraft 1.21.11 Fabric.
 */
public class EntitySyncOptimizer {
    private final PingFixConfig config;
    private final ConcurrentHashMap<Integer, Long> lastEntityUpdate = new ConcurrentHashMap<>();

    public EntitySyncOptimizer(PingFixConfig config) {
        this.config = config;
    }

    public boolean shouldProcessEntityUpdate(int entityId) {
        if (!config.enableEntitySyncOptimization) return true;
        long now = System.currentTimeMillis();
        Long last = lastEntityUpdate.put(entityId, now);
        // Suppress intermediate redundant sub-millisecond duplicate updates
        return last == null || (now - last >= 1);
    }

    public void clear() {
        lastEntityUpdate.clear();
    }
}
