package com.arsham.pingfix.config;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Configuration manager: auto-calibrated defaults for V4.
 * Created by Arsham for Minecraft 1.21.11 Fabric.
 */
public class ConfigManager {
    private static final Path CONFIG_PATH = Paths.get("config", "pingfix.json");
    private final PingFixConfig config = new PingFixConfig();

    public ConfigManager() {
        load();
    }

    public PingFixConfig getConfig() {
        return config;
    }

    public synchronized void load() {
        if (!Files.exists(CONFIG_PATH)) {
            save();
            return;
        }

        try {
            String content = new String(Files.readAllBytes(CONFIG_PATH), StandardCharsets.UTF_8);
            if (content.contains("\"enableBlockRegisterOptimization\":false") || content.contains("\"enableBlockRegisterOptimization\": false")) config.enableBlockRegisterOptimization = false;
            if (content.contains("\"enableHitRegOptimization\":false") || content.contains("\"enableHitRegOptimization\": false")) config.enableHitRegOptimization = false;
            if (content.contains("\"enableTrajectoryPrediction\":false") || content.contains("\"enableTrajectoryPrediction\": false")) config.enableTrajectoryPrediction = false;
            if (content.contains("\"adaptiveTickBudget\":false") || content.contains("\"adaptiveTickBudget\": false")) config.adaptiveTickBudget = false;
            if (content.contains("\"enableGhostBlockSync\":false") || content.contains("\"enableGhostBlockSync\": false")) config.enableGhostBlockSync = false;
        } catch (Exception e) {
            // Keep safe defaults
        }
    }

    public synchronized void save() {
        try {
            if (CONFIG_PATH.getParent() != null) {
                Files.createDirectories(CONFIG_PATH.getParent());
            }
            StringBuilder sb = new StringBuilder();
            sb.append("{\n");
            sb.append("  \"mode\": \"AUTO\",\n");
            sb.append("  \"hudEnabled\": false,\n");
            sb.append("  \"showScreenIcon\": false,\n");
            sb.append("  \"enableBlockRegisterOptimization\": ").append(config.enableBlockRegisterOptimization).append(",\n");
            sb.append("  \"enableHitRegOptimization\": ").append(config.enableHitRegOptimization).append(",\n");
            sb.append("  \"enableTrajectoryPrediction\": ").append(config.enableTrajectoryPrediction).append(",\n");
            sb.append("  \"adaptiveTickBudget\": ").append(config.adaptiveTickBudget).append(",\n");
            sb.append("  \"enableGhostBlockSync\": ").append(config.enableGhostBlockSync).append(",\n");
            sb.append("  \"enableEntitySyncOptimization\": ").append(config.enableEntitySyncOptimization).append(",\n");
            sb.append("  \"enableInventorySyncProtection\": ").append(config.enableInventorySyncProtection).append(",\n");
            sb.append("  \"enableTcpNoDelay\": ").append(config.enableTcpNoDelay).append(",\n");
            sb.append("  \"strictPrivacy\": true\n");
            sb.append("}\n");
            Files.write(CONFIG_PATH, sb.toString().getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            // Safe fallback
        }
    }
}
