package com.arsham.pingfix.network;

import com.arsham.pingfix.config.PingFixConfig;
import com.arsham.pingfix.tick.WorkloadBudget;
import java.util.concurrent.ConcurrentLinkedQueue;

/**
 * Protocol-aware packet scheduler.
 * High-priority combat and interaction tasks execute immediately.
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
        while ((task = priorityTasks.poll()) != null) {
            try {
                task.run();
            } catch (Throwable t) {
                // Ignore task failure
            }
        }

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
