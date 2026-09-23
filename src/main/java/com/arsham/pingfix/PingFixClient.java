package com.arsham.pingfix;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.api.EnvType;
import net.fabricmc.api.Environment;

/**
 * Client mod entrypoint for Fabric.
 * Created by Arsham for Minecraft 1.21.11 Fabric.
 */
@Environment(EnvType.CLIENT)
public class PingFixClient implements ClientModInitializer {
    @Override
    public void onInitializeClient() {
        PingFixCore.getInstance().initialize();
    }
}
