package com.arsham.pingfix.network;

/**
 * Dampens extreme packet bursts during lag catch-up.
 * Created by Arsham for Minecraft 1.21.11 Fabric.
 */
public class PacketBurstEngine {
    private volatile int burstThreshold = 250;
    private volatile long burstCount = 0;
    private volatile boolean inBurst = false;

    public void onPacketBatch(int count) {
        burstCount += count;
        inBurst = (burstCount > burstThreshold);
    }

    public void onTickReset() {
        burstCount = 0;
        inBurst = false;
    }

    public boolean isInBurst() { return inBurst; }
}
