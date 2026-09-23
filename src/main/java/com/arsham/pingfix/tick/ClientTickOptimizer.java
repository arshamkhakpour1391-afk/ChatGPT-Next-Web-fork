package com.arsham.pingfix.tick;

import com.arsham.pingfix.performance.PerformanceMonitor;

/**
 * Optimizes the client-side tick pipeline.
 * Created by Arsham for Minecraft 1.21.11 Fabric.
 */
public class ClientTickOptimizer {
    private final PerformanceMonitor performanceMonitor;
    private final AdaptiveScheduler adaptiveScheduler;
    private long tickStartNanos = 0;
    private volatile double tickBacklogMs = 0.0;

    public ClientTickOptimizer(PerformanceMonitor performanceMonitor, AdaptiveScheduler adaptiveScheduler) {
        this.performanceMonitor = performanceMonitor;
        this.adaptiveScheduler = adaptiveScheduler;
    }

    public void onClientTickStart() {
        this.tickStartNanos = System.nanoTime();
    }

    public void onClientTickEnd() {
        if (tickStartNanos > 0) {
            long durationNanos = System.nanoTime() - tickStartNanos;
            performanceMonitor.recordTickDuration(durationNanos);
            double durationMs = durationNanos / 1_000_000.0;
            tickBacklogMs = Math.max(0.0, durationMs - 50.0);
        }
    }

    public double getTickBacklogMs() { return tickBacklogMs; }
    public AdaptiveScheduler getAdaptiveScheduler() { return adaptiveScheduler; }
}
