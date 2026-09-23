package com.arsham.pingfix.mixin;

import com.arsham.pingfix.PingFixCore;
import net.minecraft.client.network.ClientPlayNetworkHandler;
import net.minecraft.network.packet.Packet;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Mixin for ClientPlayNetworkHandler: hooks incoming and outgoing packets.
 * Created by Arsham for Minecraft 1.21.11 Fabric.
 */
@Mixin(ClientPlayNetworkHandler.class)
public class ClientPlayNetworkHandlerMixin {

    @Inject(method = "sendPacket(Lnet/minecraft/network/packet/Packet;)V", at = @At("HEAD"))
    private void onSendPacket(Packet<?> packet, CallbackInfo ci) {
        try {
            PingFixCore core = PingFixCore.getInstance();
            long now = System.nanoTime();
            core.getJitterEngine().recordPacketArrival(now);
            core.getConnectionRecovery().onPacketReceived();
        } catch (Throwable t) {
            // Graceful error isolation
        }
    }
}
