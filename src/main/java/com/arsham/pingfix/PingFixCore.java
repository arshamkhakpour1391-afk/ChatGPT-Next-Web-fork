package com.arsham.pingfix;

import com.arsham.pingfix.config.*;
import com.arsham.pingfix.performance.*;
import com.arsham.pingfix.latency.*;
import com.arsham.pingfix.tick.*;
import com.arsham.pingfix.network.*;
import com.arsham.pingfix.chunk.*;
import com.arsham.pingfix.sync.*;
import com.arsham.pingfix.combat.*;
import com.arsham.pingfix.block.*;
import com.arsham.pingfix.profile.*;
import com.arsham.pingfix.diagnostics.*;
import com.arsham.pingfix.privacy.*;
import com.arsham.pingfix.compat.*;
import com.arsham.pingfix.notification.*;

/**
 * Ping Fix Master Coordinator (V4 Ultra).
 * Next-Generation Client-Side Networking, Sub-Tick Block Registration, Hit Registration & Tick Optimization Engine.
 * 100% Anti-Cheat Safe / Non-Bannable.
 * Official Credit: Created by Arsham for Minecraft 1.21.11 Fabric.
 */
public class PingFixCore {
    public static final String MOD_ID = "pingfix";
    public static final String MOD_NAME = "Ping Fix";
    public static final String VERSION = "4.0.0";
    public static final String CREATOR = "Arsham";
    public static final String TARGET = "Minecraft 1.21.11 Fabric";

    private static final PingFixCore INSTANCE = new PingFixCore();

    public static PingFixCore getInstance() {
        return INSTANCE;
    }

    private final ConfigManager configManager;
    private final PrivacyManager privacyManager;
    private final CompatibilityManager compatibilityManager;
    private final PerformanceMonitor performanceMonitor;
    private final FrameMonitor frameMonitor;
    private final ServerTpsEstimator tpsEstimator;
    private final LatencyEngine latencyEngine;
    private final JitterEngine jitterEngine;
    private final SpikeDetector spikeDetector;
    private final ConnectionRecovery connectionRecovery;
    private final AdaptiveScheduler adaptiveScheduler;
    private final ClientTickOptimizer clientTickOptimizer;
    private final NetworkOptimizer networkOptimizer;
    private final BlockRegisterEngine blockRegisterEngine;
    private final BlockBreakSynchronizer blockBreakSynchronizer;
    private final HitRegOptimizer hitRegOptimizer;
    private final EntityTrajectoryPredictor trajectoryPredictor;
    private final ChunkOptimizer chunkOptimizer;
    private final DesyncDetector desyncDetector;
    private final GhostBlockManager ghostBlockManager;
    private final EntitySyncOptimizer entitySyncOptimizer;
    private final InventorySyncOptimizer inventorySyncOptimizer;
    private final ServerProfileManager serverProfileManager;
    private final DiagnosticsManager diagnosticsManager;
    private final NotificationManager notificationManager;

    private PingFixCore() {
        this.configManager = new ConfigManager();
        this.privacyManager = new PrivacyManager();
        this.compatibilityManager = new CompatibilityManager();
        this.performanceMonitor = new PerformanceMonitor();
        this.frameMonitor = new FrameMonitor();
        this.tpsEstimator = new ServerTpsEstimator();
        this.latencyEngine = new LatencyEngine();
        this.jitterEngine = new JitterEngine();
        this.spikeDetector = new SpikeDetector();
        this.connectionRecovery = new ConnectionRecovery();
        
        PingFixConfig config = configManager.getConfig();
        this.adaptiveScheduler = new AdaptiveScheduler(config);
        this.clientTickOptimizer = new ClientTickOptimizer(performanceMonitor, adaptiveScheduler);
        this.networkOptimizer = new NetworkOptimizer(config);
        this.blockRegisterEngine = new BlockRegisterEngine(config, networkOptimizer);
        this.blockBreakSynchronizer = new BlockBreakSynchronizer(config, networkOptimizer);
        this.hitRegOptimizer = new HitRegOptimizer(config, latencyEngine, tpsEstimator, networkOptimizer);
        this.trajectoryPredictor = new EntityTrajectoryPredictor(config, tpsEstimator);
        this.chunkOptimizer = new ChunkOptimizer(config, performanceMonitor);
        this.desyncDetector = new DesyncDetector();
        this.ghostBlockManager = new GhostBlockManager(config, desyncDetector);
        this.entitySyncOptimizer = new EntitySyncOptimizer(config);
        this.inventorySyncOptimizer = new InventorySyncOptimizer(config);
        this.serverProfileManager = new ServerProfileManager(config);
        this.diagnosticsManager = new DiagnosticsManager(latencyEngine, jitterEngine, performanceMonitor, frameMonitor, networkOptimizer, hitRegOptimizer, blockRegisterEngine);
        this.notificationManager = new NotificationManager();
    }

    public void initialize() {
        privacyManager.verifyPrivacyIntegrity();
        compatibilityManager.detectEnvironment();
        System.out.println("[Ping Fix] Initialized Ping Fix v" + VERSION + " (Target: " + TARGET + ") - Created by " + CREATOR);
    }

    public void optimizeNow() {
        adaptiveScheduler.updateAdaptiveBudget(
                performanceMonitor.getCurrentClientTickMs(),
                frameMonitor.getCurrentFrameTimeMs(),
                spikeDetector.isSpikeActive()
        );
        chunkOptimizer.getChunkScheduler().clear();
        entitySyncOptimizer.clear();
        trajectoryPredictor.clear();
        blockRegisterEngine.cleanupStaleRecords();
        ghostBlockManager.periodicCleanup();
    }

    public String diagnoseConnection() {
        return diagnosticsManager.getDiagnosticReport();
    }

    // Subsystem getters
    public ConfigManager getConfigManager() { return configManager; }
    public PrivacyManager getPrivacyManager() { return privacyManager; }
    public CompatibilityManager getCompatibilityManager() { return compatibilityManager; }
    public PerformanceMonitor getPerformanceMonitor() { return performanceMonitor; }
    public FrameMonitor getFrameMonitor() { return frameMonitor; }
    public ServerTpsEstimator getTpsEstimator() { return tpsEstimator; }
    public LatencyEngine getLatencyEngine() { return latencyEngine; }
    public JitterEngine getJitterEngine() { return jitterEngine; }
    public SpikeDetector getSpikeDetector() { return spikeDetector; }
    public ConnectionRecovery getConnectionRecovery() { return connectionRecovery; }
    public AdaptiveScheduler getAdaptiveScheduler() { return adaptiveScheduler; }
    public ClientTickOptimizer getClientTickOptimizer() { return clientTickOptimizer; }
    public NetworkOptimizer getNetworkOptimizer() { return networkOptimizer; }
    public BlockRegisterEngine getBlockRegisterEngine() { return blockRegisterEngine; }
    public BlockBreakSynchronizer getBlockBreakSynchronizer() { return blockBreakSynchronizer; }
    public HitRegOptimizer getHitRegOptimizer() { return hitRegOptimizer; }
    public EntityTrajectoryPredictor getTrajectoryPredictor() { return trajectoryPredictor; }
    public ChunkOptimizer getChunkOptimizer() { return chunkOptimizer; }
    public GhostBlockManager getGhostBlockManager() { return ghostBlockManager; }
    public EntitySyncOptimizer getEntitySyncOptimizer() { return entitySyncOptimizer; }
    public InventorySyncOptimizer getInventorySyncOptimizer() { return inventorySyncOptimizer; }
    public ServerProfileManager getServerProfileManager() { return serverProfileManager; }
    public DiagnosticsManager getDiagnosticsManager() { return diagnosticsManager; }
    public NotificationManager getNotificationManager() { return notificationManager; }
}
