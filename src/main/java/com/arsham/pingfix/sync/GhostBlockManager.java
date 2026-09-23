package com.arsham.pingfix.sync;

import com.arsham.pingfix.config.PingFixConfig;
import net.minecraft.block.BlockState;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.world.ClientWorld;
import net.minecraft.util.math.BlockPos;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Ultra-Robust Ghost Block Prevention Engine for laggy servers.
 * Instantly synchronizes authoritative server blocks and forces render updates.
 * 100% Anti-Cheat safe.
 * Created by Arsham for Minecraft 1.21.11 Fabric.
 */
public class GhostBlockManager {
    private final PingFixConfig config;
    private final DesyncDetector desyncDetector;
    private final ConcurrentHashMap<BlockPos, BlockState> anticipatedStates = new ConcurrentHashMap<>();

    public GhostBlockManager(PingFixConfig config, DesyncDetector desyncDetector) {
        this.config = config;
        this.desyncDetector = desyncDetector;
    }

    public void onPlayerAction(BlockPos pos, BlockState expectedState) {
        if (!config.enableGhostBlockSync || pos == null) return;
        desyncDetector.recordPendingAction(pos);
        if (expectedState != null) {
            anticipatedStates.put(pos, expectedState);
        }
    }

    public void handleServerBlockUpdate(ClientWorld world, BlockPos pos, BlockState newState) {
        if (!config.enableGhostBlockSync || world == null || pos == null) return;
        
        desyncDetector.resolveAction(pos);
        anticipatedStates.remove(pos);

        BlockState currentState = world.getBlockState(pos);
        if (currentState != null && !currentState.equals(newState)) {
            // Apply authoritative server state immediately
            world.setBlockState(pos, newState, 3);
            
            // Force immediate render mesh refresh for the affected block
            try {
                MinecraftClient client = MinecraftClient.getInstance();
                if (client.worldRenderer != null) {
                    client.worldRenderer.scheduleBlockRerenderIfNeeded(pos, currentState, newState);
                }
            } catch (Throwable t) {
                // Ignore render hook failure
            }
        }
    }

    public void periodicCleanup() {
        desyncDetector.checkStaleActions();
        if (anticipatedStates.size() > 500) {
            anticipatedStates.clear();
        }
    }

    public DesyncDetector getDesyncDetector() { return desyncDetector; }
}
