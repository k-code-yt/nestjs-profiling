#!/bin/bash

# leak-detection.sh - Automated memory leak detection

echo "🔍 Starting Memory Leak Detection Test..."

BASE_URL="http://localhost:3000"

# Function to get memory usage
get_memory() {
    curl -s "$BASE_URL/profiling/memory" | jq -r '.data.heapUsed'
}

# Function to force GC
force_gc() {
    curl -s -X POST "$BASE_URL/profiling/gc" > /dev/null
}

# Test 1: Baseline memory after GC
echo "📊 Test 1: Establishing baseline memory..."
force_gc
sleep 2
BASELINE=$(get_memory)
echo "Baseline memory: ${BASELINE}MB"

# Test 2: Memory leak test
echo -e "\n💧 Test 2: Creating intentional memory leak..."
curl -s -X POST "$BASE_URL/stress/create-memory-leak?intervalMs=100" > /dev/null
echo "Memory leak created (100ms interval)"

# Monitor for 30 seconds
echo "Monitoring memory for 30 seconds..."
for i in {1..30}; do
    CURRENT=$(get_memory)
    GROWTH=$((CURRENT - BASELINE))
    echo "Time: ${i}s, Memory: ${CURRENT}MB, Growth: +${GROWTH}MB"
    sleep 1
done

# Stop the leak
echo -e "\n🛑 Stopping memory leak..."
curl -s -X POST "$BASE_URL/stress/clear-memory?type=leaks" > /dev/null

# Test 3: Memory after cleanup
echo -e "\n🧹 Test 3: Memory after cleanup..."
force_gc
sleep 2
AFTER_CLEANUP=$(get_memory)
FINAL_GROWTH=$((AFTER_CLEANUP - BASELINE))

echo "Memory after cleanup: ${AFTER_CLEANUP}MB"
echo "Net memory growth: +${FINAL_GROWTH}MB"

# Test 4: Endpoint-specific leak test
echo -e "\n🎯 Test 4: Testing each endpoint for leaks..."

endpoints=(
    "GET /profiling/health"
    "GET /profiling/memory" 
    "POST /stress/allocate-memory?sizeMB=5"
)

for endpoint in "${endpoints[@]}"; do
    method=$(echo $endpoint | cut -d' ' -f1)
    path=$(echo $endpoint | cut -d' ' -f2)
    
    echo "Testing: $endpoint"
    
    # Get baseline
    force_gc
    sleep 1
    baseline=$(get_memory)
    
    # Make 10 requests
    for j in {1..10}; do
        if [[ $method == "GET" ]]; then
            curl -s "$BASE_URL$path" > /dev/null
        else
            curl -s -X POST "$BASE_URL$path" > /dev/null
        fi
    done
    
    # Check memory after requests
    sleep 1
    after=$(get_memory)
    delta=$((after - baseline))
    
    echo "  Baseline: ${baseline}MB, After: ${after}MB, Delta: ${delta}MB"
    
    if [[ $delta -gt 5 ]]; then
        echo "  ⚠️  POTENTIAL LEAK DETECTED: +${delta}MB after 10 requests"
    else
        echo "  ✅ Endpoint looks healthy"
    fi
    echo
done

# Test 5: Generate recommendations
echo "📋 MEMORY LEAK ANALYSIS SUMMARY:"
echo "================================"

if [[ $FINAL_GROWTH -gt 10 ]]; then
    echo "❌ MEMORY LEAK DETECTED: Net growth of +${FINAL_GROWTH}MB"
    echo "   Recommendations:"
    echo "   - Check endpoints with high memory delta in Grafana"
    echo "   - Take heap snapshots before/after operations"
    echo "   - Look for event listeners not being removed"
    echo "   - Check for unclosed database connections"
else
    echo "✅ No significant memory leaks detected"
    echo "   Net growth of +${FINAL_GROWTH}MB is within normal range"
fi

echo ""
echo "🔬 Next steps for investigation:"
echo "1. Check Grafana dashboard for trending memory growth"
echo "2. Take heap snapshots: curl -X POST $BASE_URL/profiling/heap-snapshot"
echo "3. Compare snapshots using Chrome DevTools"
echo "4. Monitor 'Memory Leaking Endpoints' panel in Grafana"

echo ""
echo "📊 Key metrics to watch in Grafana:"
echo "- nodejs_memory_usage_bytes{type=\"heap_used\"} should have sawtooth pattern"
echo "- rate(nodejs_memory_usage_bytes[10m]) should be close to 0"
echo "- http_endpoint_memory_delta_mb should average close to 0 per endpoint"