package com.arsham.pingfix.compat;

import net.fabricmc.loader.api.FabricLoader;

/**
 * Performance mod compatibility detector.
 * Created by Arsham for Minecraft 1.21.11 Fabric.
 */
public class CompatibilityManager {
    private boolean sodiumPresent = false;
    private boolean lithiumPresent = false;
    private boolean ferriteCorePresent = false;
    private boolean immediatelyFastPresent = false;
    private boolean irisPresent = false;
    private boolean entityCullingPresent = false;

    public void detectEnvironment() {
        try {
            FabricLoader loader = FabricLoader.getInstance();
            sodiumPresent = loader.isModLoaded("sodium");
            lithiumPresent = loader.isModLoaded("lithium");
            ferriteCorePresent = loader.isModLoaded("ferritecore");
            immediatelyFastPresent = loader.isModLoaded("immediatelyfast");
            irisPresent = loader.isModLoaded("iris");
            entityCullingPresent = loader.isModLoaded("entityculling");
        } catch (Throwable t) {
            // Graceful error isolation
        }
    }

    public boolean isSodiumPresent() { return sodiumPresent; }
    public boolean isLithiumPresent() { return lithiumPresent; }
    public boolean isFerriteCorePresent() { return ferriteCorePresent; }
    public boolean isImmediatelyFastPresent() { return immediatelyFastPresent; }
    public boolean isIrisPresent() { return irisPresent; }
    public boolean isEntityCullingPresent() { return entityCullingPresent; }
}
