package com.arsham.pingfix.diagnostics;

import com.arsham.pingfix.latency.LatencyEngine;
import com.arsham.pingfix.latency.JitterEngine;
import com.arsham.pingfix.performance.PerformanceMonitor;
import com.arsham.pingfix.performance.FrameMonitor;
import com.arsham.pingfix.network.NetworkOptimizer;

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
    private final LagSourceAnalyzer lagSourceAnalyzer;

    public DiagnosticsManager(LatencyEngine latencyEngine, JitterEngine jitterEngine,
                              PerformanceMonitor performanceMonitor, FrameMonitor frameMonitor,
                              NetworkOptimizer networkOptimizer) {
        this.latencyEngine = latencyEngine;
        this.jitterEngine = jitterEngine;
        this.performanceMonitor = performanceMonitor;
        this.frameMonitor = frameMonitor;
        this.networkOptimizer = networkOptimizer;
        this.lagSourceAnalyzer = new LagSourceAnalyzer();
    }

    public NetworkOptimizer getNetworkOptimizer() { return networkOptimizer; }

    public String getDiagnosticReport() {
        LagSourceAnalyzer.LagCause cause = lagSourceAnalyzer.analyze(latencyEngine, jitterEngine, performanceMonitor, frameMonitor);
        return String.format("Ping: %.1f ms | Jitter: %.1f ms | Tick: %.1f ms | Net: %.1f ms | Status: %s",
                latencyEngine.getPing(),
                jitterEngine.getJitterMs(),
                performanceMonitor.getCurrentClientTickMs(),
                performanceMonitor.getCurrentNetworkWorkMs(),
                cause.getTitle());
    }

    public LagSourceAnalyzer.LagCause getCurrentLagCause() {
        return lagSourceAnalyzer.analyze(latencyEngine, jitterEngine, performanceMonitor, frameMonitor);
    }
}
