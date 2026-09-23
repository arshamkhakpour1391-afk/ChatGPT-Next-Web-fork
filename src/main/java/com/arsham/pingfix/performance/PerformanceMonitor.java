package com.arsham.pingfix.performance;

/**
 * Tracks client tick duration, network workload, and chunk processing.
 * Created by Arsham for Minecraft 1.21.11 Fabric.
 */
public class PerformanceMonitor {
    private final AllocationOptimizer.LongRingBuffer tickTimeBuffer = new AllocationOptimizer.LongRingBuffer(100);
    private final AllocationOptimizer.LongRingBuffer networkWorkBuffer = new AllocationOptimizer.LongRingBuffer(100);
    private final AllocationOptimizer.LongRingBuffer chunkWorkBuffer = new AllocationOptimizer.LongRingBuffer(100);

    private volatile double currentClientTickMs = 16.6;
    private volatile double currentNetworkWorkMs = 1.0;
    private volatile double currentChunkWorkMs = 2.0;

    public void recordTickDuration(long durationNanos) {
        tickTimeBuffer.add(durationNanos);
        currentClientTickMs = durationNanos / 1_000_000.0;
    }

    public void recordNetworkWork(long durationNanos) {
        networkWorkBuffer.add(durationNanos);
        currentNetworkWorkMs = durationNanos / 1_000_000.0;
    }

    public void recordChunkWork(long durationNanos) {
        chunkWorkBuffer.add(durationNanos);
        currentChunkWorkMs = durationNanos / 1_000_000.0;
    }

    public double getAverageClientTickMs() { return tickTimeBuffer.getAverage() / 1_000_000.0; }
    public double getCurrentClientTickMs() { return currentClientTickMs; }
    public double getCurrentNetworkWorkMs() { return currentNetworkWorkMs; }
    public double getCurrentChunkWorkMs() { return currentChunkWorkMs; }
}
