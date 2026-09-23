package com.arsham.pingfix.performance;

/**
 * Zero-allocation primitive ring buffers for ultra-fast metric storage.
 * Created by Arsham for Minecraft 1.21.11 Fabric.
 */
public class AllocationOptimizer {

    public static class LongRingBuffer {
        private final long[] data;
        private int head = 0;
        private int count = 0;

        public LongRingBuffer(int capacity) {
            this.data = new long[Math.max(4, capacity)];
        }

        public synchronized void add(long value) {
            data[head] = value;
            head = (head + 1) % data.length;
            if (count < data.length) {
                count++;
            }
        }

        public synchronized double getAverage() {
            if (count == 0) return 0.0;
            long sum = 0;
            for (int i = 0; i < count; i++) {
                sum += data[i];
            }
            return (double) sum / count;
        }

        public synchronized double getStandardDeviation() {
            if (count < 2) return 0.0;
            double avg = getAverage();
            double sumSq = 0.0;
            for (int i = 0; i < count; i++) {
                double diff = data[i] - avg;
                sumSq += diff * diff;
            }
            return Math.sqrt(sumSq / count);
        }

        public synchronized int size() {
            return count;
        }
    }
}
