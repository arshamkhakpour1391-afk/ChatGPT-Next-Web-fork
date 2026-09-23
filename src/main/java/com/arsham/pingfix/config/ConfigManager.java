package com.arsham.pingfix.config;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Configuration manager: auto-calibrated defaults for V2.
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
            if (content.contains("\"adaptiveTickBudget\":false") || content.contains("\"adaptiveTickBudget\": false")) config.adaptiveTickBudget = false;
            if (content.contains("\"enableGhostBlockSync\":false") || content.contains("\"enableGhostBlockSync\": false")) config.enableGhostBlockSync = false;
            if (content.contains("\"enableEntitySyncOptimization\":false") || content.contains("\"enableEntitySyncOptimization\": false")) config.enableEntitySyncOptimization = false;
            if (content.contains("\"enableInventorySyncProtection\":false") || content.contains("\"enableInventorySyncProtection\": false")) config.enableInventorySyncProtection = false;
        } catch (Exception e) {
            // Keep safe defaults
        }
    }

    public synchronized void save() {
        try {
            if (CONFIG_PATH.getParent() != null) {
                Files.createDirectories(CONFIG_PATH.getParent());
            }
            String json = "{\n" +
                    "  \"mode\": \"AUTO\",\n" +
                    "  \"hudEnabled\": false,\n" +
                    "  \"showScreenIcon\": false,\n" +
                    "  \"adaptiveTickBudget\": " + config.adaptiveTickBudget + ",\n" +
                    "  \"enableGhostBlockSync\": " + config.enableGhostBlockSync + ",\n" +
                    "  \"enableEntitySyncOptimization\": " + config.enableEntitySyncOptimization + ",\n" +
                    "  \"enableInventorySyncProtection\": " + config.enableInventorySyncProtection + ",\n" +
                    "  \"enableTcpNoDelay\": " + config.enableTcpNoDelay + ",\n" +
                    "  \"strictPrivacy\": true\n" +
                    "}\n";
            Files.write(CONFIG_PATH, json.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            // Safe fallback
        }
    }
}
