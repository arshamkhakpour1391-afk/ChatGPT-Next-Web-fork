package com.arsham.pingfix.chunk;

import com.arsham.pingfix.config.PingFixConfig;
import com.arsham.pingfix.performance.PerformanceMonitor;

/**
 * Chunk optimizer: distributes chunk decoding and prevents exploration freezes.
 * Created by Arsham for Minecraft 1.21.11 Fabric.
 */
public class ChunkOptimizer {
    private final PingFixConfig config;
    private final PerformanceMonitor performanceMonitor;
    private final ChunkScheduler chunkScheduler;
    private final ChunkFreezeProtection chunkFreezeProtection;

    public ChunkOptimizer(PingFixConfig config, PerformanceMonitor performanceMonitor) {
        this.config = config;
        this.performanceMonitor = performanceMonitor;
        this.chunkScheduler = new ChunkScheduler(config);
        this.chunkFreezeProtection = new ChunkFreezeProtection();
    }

    public PingFixConfig getConfig() { return config; }
    public PerformanceMonitor getPerformanceMonitor() { return performanceMonitor; }
    public ChunkScheduler getChunkScheduler() { return chunkScheduler; }
    public ChunkFreezeProtection getChunkFreezeProtection() { return chunkFreezeProtection; }
}
