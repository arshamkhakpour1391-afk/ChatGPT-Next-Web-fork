package com.arsham.pingfix.latency;

import com.arsham.pingfix.performance.AllocationOptimizer;

/**
 * Network jitter engine: measures packet inter-arrival variability.
 * Created by Arsham for Minecraft 1.21.11 Fabric.
 */
public class JitterEngine {
    private final AllocationOptimizer.LongRingBuffer jitterHistory = new AllocationOptimizer.LongRingBuffer(100);
    private long lastPacketArrivalNanos = 0;
    private volatile double currentJitterMs = 2.0;

    public synchronized void recordPacketArrival(long arrivalNanos) {
        if (lastPacketArrivalNanos > 0) {
            long delta = Math.abs(arrivalNanos - lastPacketArrivalNanos);
            long deltaMs = delta / 1_000_000L;
            double jitter = Math.abs(deltaMs - 50.0);
            if (jitter < 500.0) {
                currentJitterMs = jitter;
                jitterHistory.add((long) (jitter * 1000));
            }
        }
        lastPacketArrivalNanos = arrivalNanos;
    }

    public double getJitterMs() { return currentJitterMs; }
    public double getAverageJitterMs() { return jitterHistory.getAverage() / 1000.0; }
}
