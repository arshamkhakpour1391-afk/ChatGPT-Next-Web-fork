package com.arsham.pingfix.network;

import com.arsham.pingfix.config.PingFixConfig;
import com.arsham.pingfix.tick.WorkloadBudget;
import java.util.concurrent.ConcurrentLinkedQueue;

/**
 * High-performance protocol-aware packet scheduler.
 * Prioritizes combat and interaction packets while batching bulk payloads during lag.
 * 100% Anti-Cheat safe.
 * Created by Arsham for Minecraft 1.21.11 Fabric.
 */
public class PacketScheduler {
    private final PingFixConfig config;
    private final PacketMetrics metrics;
    private final ConcurrentLinkedQueue<Runnable> priorityTasks = new ConcurrentLinkedQueue<>();
    private final ConcurrentLinkedQueue<Runnable> deferredTasks = new ConcurrentLinkedQueue<>();

    public PacketScheduler(PingFixConfig config, PacketMetrics metrics) {
        this.config = config;
        this.metrics = metrics;
    }

    public void schedulePriorityTask(Runnable task) {
        priorityTasks.add(task);
    }

    public void scheduleDeferredTask(Runnable task) {
        if (!config.enablePacketPrioritization) {
            task.run();
            return;
        }
        deferredTasks.add(task);
    }

    public void processScheduledTasks(WorkloadBudget budget) {
        Runnable task;
        // Priority tasks (combat, interaction, health) execute immediately
        while ((task = priorityTasks.poll()) != null) {
            try {
                task.run();
            } catch (Throwable t) {
                // Ignore task failure
            }
        }

        // Deferred tasks (distant chunks/entities) execute within adaptive budget
        while (budget.hasRemainingBudget() && (task = deferredTasks.poll()) != null) {
            try {
                task.run();
            } catch (Throwable t) {
                // Ignore task failure
            }
        }

        metrics.setQueuedPacketCount(priorityTasks.size() + deferredTasks.size());
    }

    public void clear() {
        priorityTasks.clear();
        deferredTasks.clear();
        metrics.setQueuedPacketCount(0);
    }
}
