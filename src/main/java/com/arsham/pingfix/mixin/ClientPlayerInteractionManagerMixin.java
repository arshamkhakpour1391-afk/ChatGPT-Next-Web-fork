package com.arsham.pingfix.mixin;

import com.arsham.pingfix.PingFixCore;
import net.minecraft.client.network.ClientPlayerInteractionManager;
import net.minecraft.util.math.BlockPos;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Mixin for ClientPlayerInteractionManager: tracks ghost block interactions during server lag.
 * Created by Arsham for Minecraft 1.21.11 Fabric.
 */
@Mixin(ClientPlayerInteractionManager.class)
public class ClientPlayerInteractionManagerMixin {

    @Inject(method = "breakBlock(Lnet/minecraft/util/math/BlockPos;)Z", at = @At("HEAD"))
    private void onBreakBlock(BlockPos pos, CallbackInfoReturnable<Boolean> cir) {
        try {
            PingFixCore.getInstance().getGhostBlockManager().onPlayerAction(pos, null);
        } catch (Throwable t) {
            // Graceful error isolation
        }
    }
}
