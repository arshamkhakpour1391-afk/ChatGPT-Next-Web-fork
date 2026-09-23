package com.arsham.pingfix.diagnostics;

import com.arsham.pingfix.latency.LatencyEngine;
import com.arsham.pingfix.latency.JitterEngine;
import com.arsham.pingfix.performance.PerformanceMonitor;
import com.arsham.pingfix.performance.FrameMonitor;

/**
 * Analyzes network and client conditions to identify the exact source of lag.
 * Created by Arsham for Minecraft 1.21.11 Fabric.
 */
public class LagSourceAnalyzer {

    public enum LagCause {
        OPTIMAL("Optimal", "All networking, hit-reg, and tick pipelines are operating smoothly."),
        NETWORK_LATENCY("Network Latency", "High ping detected between client and server."),
        NETWORK_JITTER("Network Jitter", "Packet arrival timing is fluctuating significantly."),
        CLIENT_TICK("Client Tick Load", "Local client tick workload is causing delay."),
        CHUNK_PROCESSING("Chunk Processing", "Heavy chunk loading/rebuilding overhead."),
        RENDER_SPIKES("Render Spikes", "GPU or rendering frame time bottleneck."),
        SERVER_DELAY("Server Delay", "Server-side tick backlog or response stall.");

        private final String title;
        private final String description;

        LagCause(String title, String description) {
            this.title = title;
            this.description = description;
        }

        public String getTitle() { return title; }
        public String getDescription() { return description; }
    }

    public LagCause analyze(LatencyEngine latency, JitterEngine jitter, PerformanceMonitor perf, FrameMonitor frame) {
        if (jitter.getJitterMs() > 25.0) return LagCause.NETWORK_JITTER;
        if (latency.getPing() > 180.0) return LagCause.NETWORK_LATENCY;
        if (perf.getCurrentClientTickMs() > 35.0) return LagCause.CLIENT_TICK;
        if (perf.getCurrentChunkWorkMs() > 15.0) return LagCause.CHUNK_PROCESSING;
        if (frame.getCurrentFrameTimeMs() > 30.0) return LagCause.RENDER_SPIKES;
        return LagCause.OPTIMAL;
    }
}
