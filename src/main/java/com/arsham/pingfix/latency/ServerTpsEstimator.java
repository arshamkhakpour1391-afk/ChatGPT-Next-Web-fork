package com.arsham.pingfix.latency;

import com.arsham.pingfix.performance.AllocationOptimizer;

/**
 * Real-time Server TPS Estimator.
 * Tracks actual server tick health even under severe network lag.
 * Created by Arsham for Minecraft 1.21.11 Fabric.
 */
public class ServerTpsEstimator {
    private final AllocationOptimizer.LongRingBuffer tickDeltaBuffer = new AllocationOptimizer.LongRingBuffer(60);
    private long lastTimePacketNanos = 0;
    private volatile double estimatedTps = 20.0;

    public synchronized void onServerTimeUpdate() {
        long now = System.nanoTime();
        if (lastTimePacketNanos > 0) {
            long delta = now - lastTimePacketNanos;
            if (delta > 100_000_000L && delta < 3_000_000_000L) {
                tickDeltaBuffer.add(delta);
                double avgDeltaSec = (tickDeltaBuffer.getAverage() / 1_000_000_000.0);
                if (avgDeltaSec > 0) {
                    double tps = Math.min(20.0, 1.0 / (avgDeltaSec / 20.0));
                    estimatedTps = (0.2 * tps) + (0.8 * estimatedTps);
                }
            }
        }
        lastTimePacketNanos = now;
    }

    public double getEstimatedTps() { return estimatedTps; }
    public boolean isServerLagging() { return estimatedTps < 17.5; }
}
