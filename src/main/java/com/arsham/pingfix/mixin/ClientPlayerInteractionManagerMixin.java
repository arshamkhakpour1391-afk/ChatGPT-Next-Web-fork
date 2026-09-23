package com.arsham.pingfix.mixin;

import com.arsham.pingfix.PingFixCore;
import net.minecraft.client.network.ClientPlayerInteractionManager;
import net.minecraft.entity.Entity;
import net.minecraft.util.math.BlockPos;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Mixin for ClientPlayerInteractionManager: tracks ghost block interactions and optimizes attack hit-reg dispatch.
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

    @Inject(method = "attackEntity(Lnet/minecraft/entity/Entity;Lnet/minecraft/entity/Entity;)V", at = @At("HEAD"), require = 0)
    private void onAttackEntity(Entity player, Entity target, CallbackInfo ci) {
        try {
            PingFixCore.getInstance().getHitRegOptimizer().onPlayerAttack(target);
        } catch (Throwable t) {
            // Graceful error isolation
        }
    }
}
