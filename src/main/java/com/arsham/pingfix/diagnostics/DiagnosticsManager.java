package com.arsham.pingfix.diagnostics;

import com.arsham.pingfix.latency.LatencyEngine;
import com.arsham.pingfix.latency.JitterEngine;
import com.arsham.pingfix.performance.PerformanceMonitor;
import com.arsham.pingfix.performance.FrameMonitor;
import com.arsham.pingfix.network.NetworkOptimizer;
import com.arsham.pingfix.combat.HitRegOptimizer;

/**
 * Diagnostic reporting manager.
 * Created by Arsham for Minecraft 1.21.11 Fabric.
 */
public class DiagnosticsManager {
    private final LatencyEngine latencyEngine;
    private final JitterEngine jitterEngine;
    private final PerformanceMonitor performanceMonitor;
    private final FrameMonitor frameMonitor;
    private final NetworkOptimizer networkOptimizer;
    private final HitRegOptimizer hitRegOptimizer;
    private final LagSourceAnalyzer lagSourceAnalyzer;

    public DiagnosticsManager(LatencyEngine latencyEngine, JitterEngine jitterEngine,
                              PerformanceMonitor performanceMonitor, FrameMonitor frameMonitor,
                              NetworkOptimizer networkOptimizer, HitRegOptimizer hitRegOptimizer) {
        this.latencyEngine = latencyEngine;
        this.jitterEngine = jitterEngine;
        this.performanceMonitor = performanceMonitor;
        this.frameMonitor = frameMonitor;
        this.networkOptimizer = networkOptimizer;
        this.hitRegOptimizer = hitRegOptimizer;
        this.lagSourceAnalyzer = new LagSourceAnalyzer();
    }

    public NetworkOptimizer getNetworkOptimizer() { return networkOptimizer; }
    public HitRegOptimizer getHitRegOptimizer() { return hitRegOptimizer; }

    public String getDiagnosticReport() {
        LagSourceAnalyzer.LagCause cause = lagSourceAnalyzer.analyze(latencyEngine, jitterEngine, performanceMonitor, frameMonitor);
        return String.format("Ping: %.1f ms | Jitter: %.1f ms | Tick: %.1f ms | Net: %.1f ms | HitReg: %.1f%% | Status: %s",
                latencyEngine.getPing(),
                jitterEngine.getJitterMs(),
                performanceMonitor.getCurrentClientTickMs(),
                performanceMonitor.getCurrentNetworkWorkMs(),
                hitRegOptimizer.getHitRegistrationEfficiency(),
                cause.getTitle());
    }

    public LagSourceAnalyzer.LagCause getCurrentLagCause() {
        return lagSourceAnalyzer.analyze(latencyEngine, jitterEngine, performanceMonitor, frameMonitor);
    }
}
