package com.arsham.pingfix.mixin;

import com.arsham.pingfix.PingFixCore;
import com.arsham.pingfix.tick.WorkloadBudget;
import net.minecraft.client.MinecraftClient;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Mixin for MinecraftClient: hooks tick loop and frame delivery.
 * Created by Arsham for Minecraft 1.21.11 Fabric.
 */
@Mixin(MinecraftClient.class)
public class MinecraftClientMixin {

    @Inject(method = "tick", at = @At("HEAD"))
    private void onTickStart(CallbackInfo ci) {
        try {
            PingFixCore core = PingFixCore.getInstance();
            core.getClientTickOptimizer().onClientTickStart();
            
            // Process adaptive scheduled network/chunk workloads
            long budgetNanos = core.getAdaptiveScheduler().getCalculatedBudgetNanos();
            WorkloadBudget budget = new WorkloadBudget(budgetNanos);
            core.getNetworkOptimizer().getPacketScheduler().processScheduledTasks(budget);
            core.getGhostBlockManager().periodicCleanup();
        } catch (Throwable t) {
            // Graceful error isolation
        }
    }

    @Inject(method = "tick", at = @At("RETURN"))
    private void onTickEnd(CallbackInfo ci) {
        try {
            PingFixCore.getInstance().getClientTickOptimizer().onClientTickEnd();
        } catch (Throwable t) {
            // Graceful error isolation
        }
    }

    @Inject(method = "render", at = @At("HEAD"))
    private void onRenderFrame(boolean tick, CallbackInfo ci) {
        try {
            PingFixCore.getInstance().getFrameMonitor().onRenderFrame();
        } catch (Throwable t) {
            // Graceful error isolation
        }
    }
}
