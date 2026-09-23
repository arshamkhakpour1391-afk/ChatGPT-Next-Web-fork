package com.arsham.pingfix.profile;

import com.arsham.pingfix.config.PingFixConfig;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 100% Offline local profile memory per server address.
 * Created by Arsham for Minecraft 1.21.11 Fabric.
 */
public class ServerProfileManager {
    private static final Path PROFILES_DIR = Paths.get("config", "pingfix", "profiles");
    private final PingFixConfig config;
    private final ConcurrentHashMap<String, ServerProfile> profiles = new ConcurrentHashMap<>();

    public ServerProfileManager(PingFixConfig config) {
        this.config = config;
    }

    public static Path getProfilesDir() { return PROFILES_DIR; }

    public ServerProfile getProfile(String address) {
        if (!config.enableServerProfiles || address == null) return new ServerProfile();
        return profiles.computeIfAbsent(address, this::loadProfile);
    }

    private ServerProfile loadProfile(String address) {
        ServerProfile profile = new ServerProfile();
        profile.serverAddress = address;
        return profile;
    }

    public void updateProfile(String address, double currentPing, double currentJitter) {
        if (!config.enableServerProfiles || address == null) return;
        ServerProfile prof = getProfile(address);
        prof.sampleCount++;
        prof.baselinePing = (prof.baselinePing * 0.9) + (currentPing * 0.1);
        prof.baselineJitter = (prof.baselineJitter * 0.9) + (currentJitter * 0.1);
    }
}
