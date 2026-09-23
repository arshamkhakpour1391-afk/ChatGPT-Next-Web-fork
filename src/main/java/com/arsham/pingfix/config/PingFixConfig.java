package com.arsham.pingfix.config;

/**
 * Auto-calibrated configuration model for Ping Fix V4 (Ultra).
 * Runs 100% on intelligent AUTO in the background with zero setup.
 * Created by Arsham for Minecraft 1.21.11 Fabric.
 */
public class PingFixConfig {
    public final boolean hudEnabled = false;
    public final boolean showScreenIcon = false;

    // Advanced Core Optimizations (All active by default in AUTO mode)
    public boolean adaptiveTickBudget = true;
    public long maxTickBudgetNanos = 12_000_000L;
    public boolean enableBlockRegisterOptimization = true;
    public boolean enableHitRegOptimization = true;
    public boolean enableTrajectoryPrediction = true;
    public boolean enableTpsEstimation = true;
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
    public boolean strictPrivacy = true;
}
