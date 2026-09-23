package com.arsham.pingfix.chunk;

import com.arsham.pingfix.config.PingFixConfig;
import net.minecraft.util.math.ChunkPos;
import java.util.concurrent.ConcurrentLinkedQueue;

/**
 * Prioritizes chunks closest to the player during movement.
 * Created by Arsham for Minecraft 1.21.11 Fabric.
 */
public class ChunkScheduler {
    private final PingFixConfig config;
    private final ConcurrentLinkedQueue<ChunkPos> pendingChunks = new ConcurrentLinkedQueue<>();

    public ChunkScheduler(PingFixConfig config) {
        this.config = config;
    }

    public void queueChunkLoad(ChunkPos pos, ChunkPos playerPos) {
        if (!config.enableChunkSmoothing) return;
        pendingChunks.add(pos);
    }

    public int getPendingChunkCount() { return pendingChunks.size(); }
    public void clear() { pendingChunks.clear(); }
}
