package com.arsham.pingfix.network;

import com.arsham.pingfix.performance.AllocationOptimizer;

/**
 * Records packet processing statistics with zero allocations.
 * Created by Arsham for Minecraft 1.21.11 Fabric.
 */
public class PacketMetrics {
    private final AllocationOptimizer.LongRingBuffer processingTimeBuffer = new AllocationOptimizer.LongRingBuffer(100);
    private volatile int queuedPacketCount = 0;

    public void recordPacketProcessingTime(long durationNanos) {
        processingTimeBuffer.add(durationNanos);
    }

    public void setQueuedPacketCount(int count) {
        this.queuedPacketCount = count;
    }

    public int getQueuedPacketCount() { return queuedPacketCount; }
}
