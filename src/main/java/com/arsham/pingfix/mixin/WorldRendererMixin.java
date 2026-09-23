package com.arsham.pingfix.mixin;

import com.arsham.pingfix.PingFixCore;
import net.minecraft.client.render.WorldRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Mixin for WorldRenderer: coordinates render workload with network/chunk activity.
 * Created by Arsham for Minecraft 1.21.11 Fabric.
 */
@Mixin(WorldRenderer.class)
public class WorldRendererMixin {

    @Inject(method = "reload()V", at = @At("RETURN"))
    private void onWorldRendererReload(CallbackInfo ci) {
        try {
            PingFixCore.getInstance().getChunkOptimizer().getChunkScheduler().clear();
            PingFixCore.getInstance().getGhostBlockManager().getDesyncDetector().clear();
            PingFixCore.getInstance().getBlockRegisterEngine().clear();
        } catch (Throwable t) {
            // Graceful error isolation
        }
    }
}
