package com.arsham.pingfix.mixin;

import com.arsham.pingfix.PingFixCore;
import io.netty.channel.Channel;
import net.minecraft.network.ClientConnection;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Mixin for ClientConnection: optimizes Netty channel TCP_NODELAY and socket options.
 * Created by Arsham for Minecraft 1.21.11 Fabric.
 */
@Mixin(ClientConnection.class)
public class ClientConnectionMixin {

    @Shadow
    public Channel channel;

    @Inject(method = "channelActive(Lio/netty/channel/ChannelHandlerContext;)V", at = @At("RETURN"), require = 0)
    private void onChannelActive(Object ctx, CallbackInfo ci) {
        try {
            if (channel != null) {
                PingFixCore.getInstance().getNetworkOptimizer().optimizeChannel(channel);
            }
        } catch (Throwable t) {
            // Graceful error isolation
        }
    }
}
