import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import os from "node:os";

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForOk(url, timeoutMs = 12_000) {
  const startedAt = Date.now();
  const intervalMs = 200;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      //
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(`Timeout waiting for ${url}`);
}

test("start:multi keeps consistent state across workers", async () => {
  const workerCount = Math.max(1, os.cpus().length - 1);
  if (workerCount < 2) {
    return;
  }

  const basePort = await getFreePort();
  const stateServicePort = await getFreePort();

  const child = spawn(process.execPath, ["dist/infrastructure/cluster/start-multi.js"], {
    env: {
      ...process.env,
      PORT: String(basePort),
      STATE_SERVICE_PORT: String(stateServicePort),
      STATE_SERVICE_HOST: "127.0.0.1",
      NODE_ENV: "production",
    },
    stdio: ["ignore", "ignore", "ignore"],
    detached: true,
  });

  child.unref();

  const worker1 = basePort + 1;
  const worker2 = basePort + 2;
  const workerN = basePort + workerCount;

  try {
    await waitForOk(`http://127.0.0.1:${basePort}/health`);
    await waitForOk(`http://127.0.0.1:${stateServicePort}/health`);

    const createRes = await fetch(`http://127.0.0.1:${worker1}/api/products`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Cluster Book",
        description: "Shared state",
        price: 5,
        category: "books",
        inStock: true,
      }),
    });
    assert.equal(createRes.status, 201);
    const created = await createRes.json();
    assert.equal(typeof created.id, "string");

    const getFromOtherWorker = await fetch(
      `http://127.0.0.1:${worker2}/api/products/${created.id}`,
    );
    assert.equal(getFromOtherWorker.status, 200);

    const deleteFromThirdWorker = await fetch(
      `http://127.0.0.1:${workerN}/api/products/${created.id}`,
      { method: "DELETE" },
    );
    assert.equal(deleteFromThirdWorker.status, 204);

    const getAfterDelete = await fetch(`http://127.0.0.1:${worker1}/api/products/${created.id}`);
    assert.equal(getAfterDelete.status, 404);
  } finally {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      //
    }
  }
});
