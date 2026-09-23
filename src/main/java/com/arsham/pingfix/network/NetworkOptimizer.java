package com.arsham.pingfix.network;

import io.netty.channel.Channel;
import io.netty.channel.ChannelOption;
import com.arsham.pingfix.config.PingFixConfig;

/**
 * Socket pipeline optimizer: sets TCP_NODELAY and optimizes thread contention.
 * Created by Arsham for Minecraft 1.21.11 Fabric.
 */
public class NetworkOptimizer {
    private final PingFixConfig config;
    private final PacketScheduler packetScheduler;
    private final PacketMetrics packetMetrics;
    private final PacketBurstEngine packetBurstEngine;

    public NetworkOptimizer(PingFixConfig config) {
        this.config = config;
        this.packetMetrics = new PacketMetrics();
        this.packetScheduler = new PacketScheduler(config, packetMetrics);
        this.packetBurstEngine = new PacketBurstEngine();
    }

    public void optimizeChannel(Channel channel) {
        if (channel == null || !config.enableTcpNoDelay) return;
        try {
            if (channel.isOpen() && channel.config() != null) {
                channel.config().setOption(ChannelOption.TCP_NODELAY, Boolean.TRUE);
                channel.config().setOption(ChannelOption.SO_KEEPALIVE, Boolean.TRUE);
            }
        } catch (Throwable t) {
            // Graceful fallback
        }
    }

    public PacketScheduler getPacketScheduler() { return packetScheduler; }
    public PacketMetrics getPacketMetrics() { return packetMetrics; }
    public PacketBurstEngine getPacketBurstEngine() { return packetBurstEngine; }
}
