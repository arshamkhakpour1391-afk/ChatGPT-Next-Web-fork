package com.arsham.pingfix.latency;

/**
 * Coordinates smooth client-side recovery after lag spikes and stalls.
 * Created by Arsham for Minecraft 1.21.11 Fabric.
 */
public class ConnectionRecovery {
    private volatile long lastPacketTime = System.currentTimeMillis();
    private volatile boolean recovering = false;

    public void onPacketReceived() {
        long now = System.currentTimeMillis();
        long stallDuration = now - lastPacketTime;
        if (stallDuration > 1000) {
            recovering = true;
        } else if (recovering && (now - lastPacketTime < 250)) {
            recovering = false;
        }
        lastPacketTime = now;
    }

    public boolean isRecovering() { return recovering; }
}
