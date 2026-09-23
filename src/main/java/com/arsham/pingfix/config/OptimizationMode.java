package com.arsham.pingfix.config;

/**
 * Operating modes for Ping Fix.
 * Created by Arsham for Minecraft 1.21.11 Fabric.
 */
public enum OptimizationMode {
    AUTO("Automatic", "Continuously adapts optimization intensity to network and client conditions."),
    MAXIMUM_PERFORMANCE("Maximum Performance", "Enables all aggressive legitimate client-side optimizations."),
    SIMPLE("Simple", "Minimal automatic background optimization."),
    ADVANCED("Advanced", "Full granular adaptive pipeline optimization.");

    private final String displayName;
    private final String description;

    OptimizationMode(String displayName, String description) {
        this.displayName = displayName;
        this.description = description;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getDescription() {
        return description;
    }
}
