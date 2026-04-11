import asyncio
import aiohttp
import time
import random
import json

# -------------------------------------------------------
# Disaster Platform Load Tester
# -------------------------------------------------------
# Two modes:
#   MODE="ping"   -> test raw Flask throughput (/ping)
#   MODE="report" -> test full report submission pipeline
# -------------------------------------------------------

MODE = "ping"  # Switch to "report" when PostgreSQL is running

PING_URL    = "http://localhost:5001/ping"
REPORT_URL  = "http://localhost:5001/api/report"
NUM_REQUESTS = 10000
CONCURRENCY  = 200

SOURCES = ["sms", "web", "mobile", "api"]
MESSAGES = [
    "Trapped on the 3rd floor flood waters rising",
    "Earthquake destroyed our home, 2 injured",
    "Need medical supplies at Main St shelter",
    "Building collapsed near the central park",
    "No power, no water, 5 families waiting",
]
LOCATIONS = [
    "Times Square", "Brooklyn Bridge", "Central Station",
    "Aami River", "Downtown Gorakhpur", "City Hospital",
]

async def ping(session):
    start = time.time()
    try:
        async with session.get(PING_URL, timeout=aiohttp.ClientTimeout(total=15)) as r:
            await r.text()
            return r.status, time.time() - start
    except Exception as e:
        return f"Error: {e}", time.time() - start

async def send_report(session):
    payload = {
        "phone":   f"+9198{random.randint(10000000, 99999999)}",
        "message": random.choice(MESSAGES) + f" near {random.choice(LOCATIONS)}",
        "source":  random.choice(SOURCES)
    }
    start = time.time()
    try:
        async with session.post(REPORT_URL, json=payload, timeout=aiohttp.ClientTimeout(total=30)) as r:
            await r.text()
            return r.status, time.time() - start
    except Exception as e:
        return f"Error: {e}", time.time() - start

async def main():
    func = ping if MODE == "ping" else send_report
    url  = PING_URL if MODE == "ping" else REPORT_URL
    method = "GET" if MODE == "ping" else "POST"

    print(f"Starting Load Test: {NUM_REQUESTS} x {method} {url} | concurrency={CONCURRENCY}")
    start = time.time()

    conn = aiohttp.TCPConnector(limit=CONCURRENCY)
    async with aiohttp.ClientSession(connector=conn) as session:
        results = await asyncio.gather(*[func(session) for _ in range(NUM_REQUESTS)])

    elapsed = time.time() - start

    counts, total_latency, ok = {}, 0, 0
    for status, dur in results:
        counts[status] = counts.get(status, 0) + 1
        if isinstance(status, int) and status < 400:
            total_latency += dur
            ok += 1

    avg_lat = (total_latency / ok) if ok else 0

    print(f"\n--- Load Test Results (mode={MODE}) ---")
    print(f"Total Time:          {elapsed:.2f}s")
    print(f"Throughput:          {NUM_REQUESTS / elapsed:.0f} req/sec")
    print(f"Successful:          {ok} / {NUM_REQUESTS}")
    print(f"Avg Success Latency: {avg_lat*1000:.1f} ms")
    print("Status Codes:")
    for s, c in sorted(counts.items(), key=lambda x: -x[1]):
        print(f"  {s}: {c}")

if __name__ == "__main__":
    asyncio.run(main())
