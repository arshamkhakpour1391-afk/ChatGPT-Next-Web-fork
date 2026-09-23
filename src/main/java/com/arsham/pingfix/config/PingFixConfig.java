package com.arsham.pingfix.config;

/**
 * Auto-tuned configuration for Ping Fix V2.
 * Everything runs on intelligent AUTO in the background with zero setup.
 * Created by Arsham for Minecraft 1.21.11 Fabric.
 */
public class PingFixConfig {
    // 100% background operation - zero HUD, zero on-screen icons
    public final boolean hudEnabled = false;
    public final boolean showScreenIcon = false;

    // Advanced Core Optimizations (All active by default in AUTO mode)
    public boolean adaptiveTickBudget = true;
    public long maxTickBudgetNanos = 12_000_000L; // 12ms max per-tick budget
    public boolean enablePacketPrioritization = true;
    public boolean enableBurstSmoothing = true;
    public boolean enableChunkSmoothing = true;
    public boolean enableChunkFreezeProtection = true;
    public boolean enableGhostBlockSync = true;
    public boolean enableEntitySyncOptimization = true;
    public boolean enableInventorySyncProtection = true;
    public boolean enableTcpNoDelay = true;
    public boolean enableSpikeMitigation = true;
    public boolean enableServerProfiles = true;
    public boolean strictPrivacy = true; // 100% offline, zero telemetry
}
