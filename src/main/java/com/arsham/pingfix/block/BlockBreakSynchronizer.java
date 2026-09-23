package com.arsham.pingfix.block;

import com.arsham.pingfix.config.PingFixConfig;
import com.arsham.pingfix.network.NetworkOptimizer;
import net.minecraft.util.math.BlockPos;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Continuous Mining & Anti-Rebreak Synchronizer.
 * Prevents mining fatigue and mining progress resets on high-ping laggy servers.
 * Created by Arsham for Minecraft 1.21.11 Fabric.
 */
public class BlockBreakSynchronizer {
    private final PingFixConfig config;
    private final NetworkOptimizer networkOptimizer;
    private final ConcurrentHashMap<BlockPos, Long> breakingBlocks = new ConcurrentHashMap<>();

    public BlockBreakSynchronizer(PingFixConfig config, NetworkOptimizer networkOptimizer) {
        this.config = config;
        this.networkOptimizer = networkOptimizer;
    }

    public void onStartBreaking(BlockPos pos) {
        if (!config.enableBlockRegisterOptimization || pos == null) return;
        breakingBlocks.put(pos, System.currentTimeMillis());
        networkOptimizer.flushImmediate();
    }

    public void onStopBreaking(BlockPos pos) {
        if (pos == null) return;
        breakingBlocks.remove(pos);
    }

    public boolean isActivelyMining(BlockPos pos) {
        return breakingBlocks.containsKey(pos);
    }

    public void clear() {
        breakingBlocks.clear();
    }
}
