import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";

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

async function waitForOk(url, timeoutMs = 10_000) {
  const startedAt = Date.now();
  const intervalMs = 150;
  const maxAttempts = Math.ceil(timeoutMs / intervalMs);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
    }

    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Timeout waiting for ${url}`);
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

async function requestJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  return { res, data };
}

async function withServer(testFn) {
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;

  const child = spawn(process.execPath, ["dist/index.js"], {
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "ignore", "ignore"],
  });

  try {
    await waitForOk(`${baseUrl}/health`);
    await testFn(baseUrl);
  } finally {
    child.kill("SIGTERM");
  }
}

test("api/products: GET empty list", async () => {
  await withServer(async (baseUrl) => {
    const { res, data } = await requestJson(`${baseUrl}/api/products`);
    assert.equal(res.status, 200);
    assert.deepEqual(data, []);
  });
});

test("api/products: validation + non-existing endpoint => 400/404", async () => {
  await withServer(async (baseUrl) => {
    {
      const { res, data } = await requestJson(`${baseUrl}/api/products/not-a-uuid`);
      assert.equal(res.status, 400);
      assert.deepEqual(data, { message: "Invalid productId, must be a UUID" });
    }

    {
      const { res, data } = await requestJson(`${baseUrl}/api/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: "No name provided",
          price: 10,
          category: "books",
          inStock: true,
        }),
      });
      assert.equal(res.status, 400);
      assert.deepEqual(data, { message: "Missing or invalid required fields" });
    }

    {
      const { res, data } = await requestJson(`${baseUrl}/some-non/existing/resource`);
      assert.equal(res.status, 404);
      assert.equal(data.message, "Route GET /some-non/existing/resource not found");
    }
  });
});

test("api/products: CRUD flow => 201/200/204/404", async () => {
  await withServer(async (baseUrl) => {
    const created = await (async () => {
      const { res, data } = await requestJson(`${baseUrl}/api/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Book",
          description: "Good book",
          price: 10.5,
          category: "books",
          inStock: true,
        }),
      });
      assert.equal(res.status, 201);
      assert.ok(typeof data?.id === "string");
      return data;
    })();

    {
      const { res, data } = await requestJson(`${baseUrl}/api/products/${created.id}`);
      assert.equal(res.status, 200);
      assert.equal(data.id, created.id);
      assert.equal(data.name, "Book");
    }

    const updated = await (async () => {
      const { res, data } = await requestJson(`${baseUrl}/api/products/${created.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Book 2",
          description: "Better book",
          price: 12,
          category: "books",
          inStock: false,
        }),
      });
      assert.equal(res.status, 200);
      assert.equal(data.id, created.id);
      return data;
    })();

    assert.equal(updated.name, "Book 2");
    assert.equal(updated.inStock, false);

    {
      const res = await fetch(`${baseUrl}/api/products/${created.id}`, { method: "DELETE" });
      assert.equal(res.status, 204);
      assert.equal(await res.text(), "");
    }

    {
      const { res, data } = await requestJson(`${baseUrl}/api/products/${created.id}`);
      assert.equal(res.status, 404);
      assert.deepEqual(data, { message: "Product not found" });
    }
  });
});
