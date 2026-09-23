package com.arsham.pingfix.latency;

import com.arsham.pingfix.performance.AllocationOptimizer;

/**
 * High-precision latency tracking and EWMA smoothing.
 * Created by Arsham for Minecraft 1.21.11 Fabric.
 */
public class LatencyEngine {
    private final AllocationOptimizer.LongRingBuffer pingHistory = new AllocationOptimizer.LongRingBuffer(120);
    private volatile double ewmaPing = 30.0;
    private volatile double lastReportedPing = 30.0;
    private final double alpha = 0.15;

    public synchronized void recordPing(long pingMs) {
        if (pingMs <= 0 || pingMs > 5000) return;
        lastReportedPing = pingMs;
        pingHistory.add(pingMs);
        ewmaPing = (alpha * pingMs) + ((1.0 - alpha) * ewmaPing);
    }

    public double getPing() { return lastReportedPing; }
    public double getEwmaPing() { return ewmaPing; }
    public double getAveragePing() { return pingHistory.getAverage(); }
}
