import cluster from "node:cluster";
import { fork, type ChildProcess } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import dotenv from "dotenv";
import { HTTP_STATUS } from "../../presentation/http/http-status-codes";
import { createProductUseCases } from "../../application/product/product.use-cases";
import { registerProductRoutes } from "../../presentation/http/product/product.routes";
import { createHttpProductRepository } from "../product/product.repository.http";
import {
  APPLICATION_JSON_MIME_SUBSTRING,
  API_PROXY_PATH,
  CLUSTER_HOST,
  CONTENT_TYPE_HEADER,
  DEFAULT_PORT,
  HTTP_PROTOCOL,
  HEALTH_PATH,
  LOOPBACK_HOST,
  INTERNAL_SERVER_ERROR_MESSAGE,
  NO_AVAILABLE_WORKERS_MESSAGE,
  HTTP_METHOD_GET,
  HTTP_METHOD_HEAD,
  WORKER_PORT_OFFSET,
} from "./cluster.constants";
import {
  STATE_SERVICE_DEFAULT_PORT,
  STATE_SERVICE_HOST,
} from "../state-service/state-service.constants";

function getBasePort(): number {
  const portEnv = process.env.PORT;
  const port = portEnv ? Number(portEnv) : DEFAULT_PORT;
  if (!Number.isFinite(port) || port <= 0) return DEFAULT_PORT;
  return port;
}

async function startWorker(): Promise<void> {
  dotenv.config();

  const port = getBasePort();
  const app: FastifyInstance = fastify();

  const productRepository = createHttpProductRepository();
  const productUseCases = createProductUseCases(productRepository);

  void app.get(HEALTH_PATH, async () => {
    return { status: "ok" };
  });

  void registerProductRoutes(app, productUseCases);

  app.setNotFoundHandler(async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    void reply.code(HTTP_STATUS.NOT_FOUND).send({
      message: `Route ${request.method} ${request.url} not found`,
    });
  });

  app.setErrorHandler(
    async (error: unknown, _request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      console.error("Unhandled error", error);
      void reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        message: INTERNAL_SERVER_ERROR_MESSAGE,
      });
    },
  );

  await app.listen({ port, host: CLUSTER_HOST });
  console.log(`Worker is running on port ${port}`);
}

function getStateServicePort(): number {
  const portEnv = process.env.STATE_SERVICE_PORT;
  const port = portEnv ? Number(portEnv) : STATE_SERVICE_DEFAULT_PORT;
  if (!Number.isFinite(port) || port <= 0) return STATE_SERVICE_DEFAULT_PORT;
  return port;
}

function startStateServiceProcess(): ChildProcess {
  const currentFilePath = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFilePath);
  const stateServiceScriptPath = path.resolve(
    currentDir,
    "../state-service/start-state-service.js",
  );

  const child = fork(stateServiceScriptPath, {
    env: {
      ...process.env,
      STATE_SERVICE_PORT: String(getStateServicePort()),
      STATE_SERVICE_HOST,
    },
    stdio: "inherit",
  });

  child.on("exit", (code) => {
    if (code !== 0) {
      console.error(`State service exited with code ${code}`);
    }
  });

  return child;
}

function startLoadBalancer(workerPorts: number[]): void {
  const basePort = getBasePort();
  const app: FastifyInstance = fastify();
  let rrIndex = 0;

  function nextPort(): number {
    const port = workerPorts[rrIndex % workerPorts.length];
    rrIndex += 1;
    return port;
  }

  async function forward(
    workerPort: number,
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<boolean> {
    const targetUrl = `${HTTP_PROTOCOL}${LOOPBACK_HOST}:${workerPort}${request.url}`;
    const contentType = request.headers[CONTENT_TYPE_HEADER];
    const isJson =
      typeof contentType === "string" && contentType.includes(APPLICATION_JSON_MIME_SUBSTRING);

    const options: RequestInit = {
      method: request.method,
      headers:
        isJson && typeof contentType === "string"
          ? { [CONTENT_TYPE_HEADER]: contentType }
          : undefined,
      body:
        request.method === HTTP_METHOD_GET || request.method === HTTP_METHOD_HEAD
          ? undefined
          : isJson && request.body !== undefined
            ? JSON.stringify(request.body)
            : undefined,
    };

    const res = await fetch(targetUrl, options);
    const status = res.status;
    void reply.code(status);

    if (status === HTTP_STATUS.NO_CONTENT) {
      void reply.send();
      return true;
    }

    const text = await res.text();
    if (!text) {
      void reply.send();
      return true;
    }

    void reply.send(JSON.parse(text));
    return true;
  }

  void app.get(HEALTH_PATH, async () => {
    return { status: "ok" };
  });

  void app.all(
    API_PROXY_PATH,
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const attempts = workerPorts.length;

      for (let i = 0; i < attempts; i += 1) {
        const workerPort = workerPorts[(rrIndex + i) % attempts] ?? nextPort();
        try {
          const ok = await forward(workerPort, request, reply);
          if (ok) return;
        } catch {
          //
        }
      }

      void reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        message: NO_AVAILABLE_WORKERS_MESSAGE,
      });
    },
  );

  app.setNotFoundHandler(async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    void reply.code(HTTP_STATUS.NOT_FOUND).send({
      message: `Route ${request.method} ${request.url} not found`,
    });
  });

  void app.listen({ port: basePort, host: CLUSTER_HOST }).then(() => {
    console.log(`Load balancer is running on port ${basePort}`);
  });
}

async function startMaster(): Promise<void> {
  dotenv.config();

  const basePort = getBasePort();
  const workerCount = Math.max(1, os.cpus().length - 1);
  const workerPorts = Array.from(
    { length: workerCount },
    (_, i) => basePort + i + WORKER_PORT_OFFSET,
  );
  const stateService = startStateServiceProcess();

  const workers: cluster.Worker[] = [];
  for (let i = 0; i < workerCount; i += 1) {
    const workerPort = workerPorts[i];
    const worker = cluster.fork({ PORT: String(workerPort) });
    workers.push(worker);
  }

  startLoadBalancer(workerPorts);

  process.on("SIGTERM", () => {
    stateService.kill("SIGTERM");
  });

  process.on("SIGINT", () => {
    stateService.kill("SIGINT");
  });

  void Promise.all(workers.map((w) => w.process.pid)).then(() => undefined);
}

if (cluster.isPrimary) {
  void startMaster();
} else {
  void startWorker();
}
