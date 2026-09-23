package com.arsham.pingfix.mixin;

import com.arsham.pingfix.PingFixCore;
import net.minecraft.client.network.ClientPlayerInteractionManager;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.entity.Entity;
import net.minecraft.util.Hand;
import net.minecraft.util.math.BlockPos;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Mixin for ClientPlayerInteractionManager: optimizes block placement registration, mining synchronization, and attack hit-reg dispatch.
 * Created by Arsham for Minecraft 1.21.11 Fabric.
 */
@Mixin(ClientPlayerInteractionManager.class)
public class ClientPlayerInteractionManagerMixin {

    @Inject(method = "breakBlock(Lnet/minecraft/util/math/BlockPos;)Z", at = @At("HEAD"))
    private void onBreakBlock(BlockPos pos, CallbackInfoReturnable<Boolean> cir) {
        try {
            PingFixCore core = PingFixCore.getInstance();
            core.getGhostBlockManager().onPlayerAction(pos, null);
            core.getBlockBreakSynchronizer().onStartBreaking(pos);
        } catch (Throwable t) {
            // Graceful error isolation
        }
    }

    @Inject(method = "interactBlock(Lnet/minecraft/client/network/ClientPlayerEntity;Lnet/minecraft/util/Hand;Ljava/lang/Object;)Z", at = @At("HEAD"), require = 0)
    private void onInteractBlock(ClientPlayerEntity player, Hand hand, Object hitResult, CallbackInfoReturnable<Boolean> cir) {
        try {
            PingFixCore core = PingFixCore.getInstance();
            if (player != null) {
                core.getBlockRegisterEngine().onBlockInteract(player.getBlockPos(), null);
            }
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
