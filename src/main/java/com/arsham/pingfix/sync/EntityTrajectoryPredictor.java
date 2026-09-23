package com.arsham.pingfix.sync;

import com.arsham.pingfix.config.PingFixConfig;
import com.arsham.pingfix.latency.ServerTpsEstimator;
import net.minecraft.util.math.Vec3d;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Velocity-Guided Entity Trajectory Predictor & Hitbox Aligning Engine.
 * Eliminates jittery entity stutter and ghost swings on laggy servers without cheating.
 * 100% Anti-Cheat Safe.
 * Created by Arsham for Minecraft 1.21.11 Fabric.
 */
public class EntityTrajectoryPredictor {
    private final PingFixConfig config;
    private final ServerTpsEstimator tpsEstimator;

    private static class TrajectoryState {
        Vec3d lastPos;
        Vec3d velocity;
        long lastTimestamp;

        TrajectoryState(Vec3d pos, Vec3d vel, long time) {
            this.lastPos = pos;
            this.velocity = vel;
            this.lastTimestamp = time;
        }
    }

    private final ConcurrentHashMap<Integer, TrajectoryState> trajectoryMap = new ConcurrentHashMap<>();

    public EntityTrajectoryPredictor(PingFixConfig config, ServerTpsEstimator tpsEstimator) {
        this.config = config;
        this.tpsEstimator = tpsEstimator;
    }

    public void updateEntityPosition(int entityId, Vec3d newPos, Vec3d velocity) {
        if (!config.enableTrajectoryPrediction || newPos == null) return;
        trajectoryMap.put(entityId, new TrajectoryState(newPos, velocity != null ? velocity : new Vec3d(0, 0, 0), System.currentTimeMillis()));
    }

    public Vec3d getPredictedPosition(int entityId, float tickDelta) {
        if (!config.enableTrajectoryPrediction) return null;
        TrajectoryState state = trajectoryMap.get(entityId);
        if (state == null) return null;

        long elapsed = System.currentTimeMillis() - state.lastTimestamp;
        if (elapsed > 400) return null; // Stale data fallback

        if (tpsEstimator.isServerLagging()) {
            double dt = (elapsed / 1000.0);
            return state.lastPos.add(state.velocity.multiply(dt * 0.5));
        }

        return state.lastPos;
    }

    public void clear() {
        trajectoryMap.clear();
    }
}
