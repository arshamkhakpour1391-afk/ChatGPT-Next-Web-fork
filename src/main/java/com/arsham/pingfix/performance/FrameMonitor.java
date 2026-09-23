package com.arsham.pingfix.performance;

/**
 * Frame rendering analyzer and stutter detector.
 * Created by Arsham for Minecraft 1.21.11 Fabric.
 */
public class FrameMonitor {
    private final AllocationOptimizer.LongRingBuffer frameDeltaBuffer = new AllocationOptimizer.LongRingBuffer(120);
    private long lastFrameNanos = System.nanoTime();
    private volatile double currentFrameTimeMs = 16.6;

    public void onRenderFrame() {
        long now = System.nanoTime();
        long delta = now - lastFrameNanos;
        lastFrameNanos = now;
        if (delta > 0 && delta < 500_000_000L) {
            frameDeltaBuffer.add(delta);
            currentFrameTimeMs = delta / 1_000_000.0;
        }
    }

    public double getAverageFrameTimeMs() { return frameDeltaBuffer.getAverage() / 1_000_000.0; }
    public double getCurrentFrameTimeMs() { return currentFrameTimeMs; }
}
