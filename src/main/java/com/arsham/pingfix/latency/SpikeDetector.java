package com.arsham.pingfix.latency;

import com.arsham.pingfix.performance.AllocationOptimizer;

/**
 * Statistical spike detector: warns scheduler when network latency spikes.
 * Created by Arsham for Minecraft 1.21.11 Fabric.
 */
public class SpikeDetector {
    private final AllocationOptimizer.LongRingBuffer latencySamples = new AllocationOptimizer.LongRingBuffer(60);
    private volatile boolean spikeActive = false;
    private volatile long spikeStartTime = 0;

    public synchronized void recordSample(long latencyNanos) {
        double avg = latencySamples.getAverage();
        double std = latencySamples.getStandardDeviation();
        latencySamples.add(latencyNanos);

        if (latencySamples.size() > 10 && std > 0) {
            if (latencyNanos > avg + (2.0 * std)) {
                spikeActive = true;
                spikeStartTime = System.currentTimeMillis();
            } else if (spikeActive && (System.currentTimeMillis() - spikeStartTime > 1500)) {
                spikeActive = false;
            }
        }
    }

    public boolean isSpikeActive() { return spikeActive; }
}
