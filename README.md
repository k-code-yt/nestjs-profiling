# NestJS Memory Profiling & Performance Monitoring

A comprehensive memory profiling and performance monitoring solution for NestJS applications with Docker, Prometheus, and Grafana integration.

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for development)

### 1. Clone and Setup

```bash
git clone https://github.com/k-code-yt/nestjs-profiling.git
cd nestjs-profiling
npm install
```

### 2. Start the Stack

```bash
# Start all services
docker-compose up -d

# Check services status
docker-compose ps
```

## 📊 Service Ports & Access

| Service        | Port | URL                   | Description                               |
| -------------- | ---- | --------------------- | ----------------------------------------- |
| **NestJS App** | 3000 | http://localhost:3000 | Main application with profiling endpoints |
| **Grafana**    | 3001 | http://localhost:3001 | Memory & performance dashboards           |
| **Prometheus** | 9090 | http://localhost:9090 | Metrics collection & queries              |

### 🔐 Default Credentials

- **Grafana**: `admin` / `admin123`

## 🧪 Testing Memory & CPU Profiling

### Memory Stress Tests

```bash
# Allocate memory
curl -X POST "http://localhost:3000/stress/allocate-memory?sizeMB=50"

# Create memory leak
curl -X POST "http://localhost:3000/stress/create-memory-leak"

# Clear all memory
curl -X POST "http://localhost:3000/stress/clear-memory"
```

### CPU Stress Tests

```bash
# CPU intensive task
curl -X POST "http://localhost:3000/stress/cpu-intensive?duration=5000&complexity=heavy"

```

### Profiling Controls

```bash
# Start CPU profiling
curl -X POST "http://localhost:3000/profiling/cpu-profile/start"

# Take heap snapshot
curl -X POST "http://localhost:3000/profiling/heap-snapshot"

# Get memory usage
curl "http://localhost:3000/profiling/memory"

# Force garbage collection
curl -X POST "http://localhost:3000/profiling/gc"
```

## 📈 Monitoring Dashboards

### Grafana Dashboards

1. **NestJS Memory Usage** - Stacked memory visualization
2. **Memory Leak Detection** - Leak detection and GC monitoring

### Key Metrics to Watch

- **Memory Growth Rate** - Should be ~0 for healthy apps
- **Event Loop Lag** - Should be <10ms
- **GC Frequency** - Indicates memory pressure
- **Container Memory** - Approaching 256MB limit

### Memory Limits

- **Container Limit**: 256MB (configurable in docker-compose.yml)
- **Node.js Heap**: 200MB (configurable via NODE_OPTIONS)

## 🔧 Configuration

### Environment Variables

```bash
NODE_OPTIONS=--max-old-space-size=200 --expose-gc
MEMORY_LIMIT=256M
GF_SECURITY_ADMIN_PASSWORD=admin123
```

### Profiling Options

- **Monitoring Interval**: 30 seconds
- **Memory Threshold**: 80% for warnings
- **Sample Rate**: 100% (configurable for production)

## 📊 Understanding Memory Types

- **Heap Used**: JavaScript objects and variables
- **External**: Buffers, file handles, native modules
- **RSS**: Total physical memory used by process
- **Old Space**: Long-lived objects (main application data)
- **New Space**: Recently created objects (temporary data)

## 🚨 Memory Leak Detection

### Warning Signs

- Memory growth rate > 1MB/sec consistently
- Event loop lag > 50ms
- GC frequency increasing over time
- Memory usage approaching container limit

### Investigation Tools

1. **Heap Snapshots**: Compare before/after operations
2. **CPU Profiles**: Identify performance bottlenecks
3. **Grafana Alerts**: Monitor trends and thresholds
4. **Chrome DevTools**: Analyze heap snapshots

## 🧹 Cleanup

```bash
# Stop all services
docker-compose down

# Remove volumes and data
docker-compose down -v

# Clean up profiling files
rm -rf heap-snapshots/* cpu-profiles/*
```

### Performance Impact(DO YOUR OWN RESEARCH!!!)

- **CPU Overhead**: ~0.3-1ms per request
- **Memory Overhead**: ~1-2KB per request
- **Production Ready**: <1% performance impact with sampling

---

**Happy Profiling!** 🎯 Monitor your memory, optimize your performance!
