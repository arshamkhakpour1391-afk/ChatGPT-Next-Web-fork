package com.arsham.pingfix.mixin;

import com.arsham.pingfix.PingFixCore;
import net.minecraft.client.world.ClientChunkManager;
import net.minecraft.util.math.ChunkPos;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Mixin for ClientChunkManager: optimizes chunk operations.
 * Created by Arsham for Minecraft 1.21.11 Fabric.
 */
@Mixin(ClientChunkManager.class)
public class ClientChunkManagerMixin {

    @Inject(method = "onChunkStatusChange(IILnet/minecraft/world/chunk/ChunkStatus;)V", at = @At("HEAD"), require = 0)
    private void onChunkStatus(int x, int z, Object status, CallbackInfo ci) {
        try {
            PingFixCore.getInstance().getChunkOptimizer().getChunkScheduler().queueChunkLoad(new ChunkPos(x, z), new ChunkPos(0, 0));
        } catch (Throwable t) {
            // Graceful error isolation
        }
    }
}
