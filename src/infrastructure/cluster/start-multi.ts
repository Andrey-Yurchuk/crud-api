import cluster from "node:cluster";
import os from "node:os";
import fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import dotenv from "dotenv";
import { HTTP_STATUS } from "../../presentation/http/http-status-codes";
import { createProductUseCases } from "../../application/product/product.use-cases";
import { registerProductRoutes } from "../../presentation/http/product/product.routes";
import { createMemoryProductRepository } from "../product/product.repository.memory";
import { createIpcProductRepository } from "../product/product.repository.ipc";
import type { ProductCreateDto, ProductUpdateDto } from "../../domain/product/product.types";
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
  PRODUCT_REPO_IPC_REQUEST_TYPE,
  PRODUCT_REPO_IPC_RESPONSE_TYPE,
  PRODUCT_REPO_OPERATIONS,
  type ProductRepoOperation,
} from "./product-repo-ipc.constants";

type ProductRepoRequestMessage = {
  type: typeof PRODUCT_REPO_IPC_REQUEST_TYPE;
  reqId: number;
  operation: ProductRepoOperation;
  args: unknown[];
};

type ProductRepoResponseMessage =
  | {
      type: typeof PRODUCT_REPO_IPC_RESPONSE_TYPE;
      reqId: number;
      ok: true;
      result: unknown;
    }
  | {
      type: typeof PRODUCT_REPO_IPC_RESPONSE_TYPE;
      reqId: number;
      ok: false;
      error: { message: string; name?: string };
    };

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

  const productRepository = createIpcProductRepository();
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

  const productRepository = createMemoryProductRepository();

  cluster.on("message", async (worker, message: unknown) => {
    const msg = message as ProductRepoRequestMessage;
    if (!msg || typeof msg !== "object") return;
    if (msg.type !== PRODUCT_REPO_IPC_REQUEST_TYPE) return;

    const workerProcess = worker as cluster.Worker;

    try {
      let result: unknown;
      if (msg.operation === PRODUCT_REPO_OPERATIONS.FIND_ALL) {
        result = await productRepository.findAll();
      } else if (msg.operation === PRODUCT_REPO_OPERATIONS.FIND_BY_ID) {
        result = await productRepository.findById(msg.args[0] as string);
      } else if (msg.operation === PRODUCT_REPO_OPERATIONS.CREATE) {
        result = await productRepository.create(msg.args[0] as ProductCreateDto);
      } else if (msg.operation === PRODUCT_REPO_OPERATIONS.UPDATE) {
        result = await productRepository.update(
          msg.args[0] as string,
          msg.args[1] as ProductUpdateDto,
        );
      } else if (msg.operation === PRODUCT_REPO_OPERATIONS.DELETE) {
        result = await productRepository.delete(msg.args[0] as string);
      }

      const response: ProductRepoResponseMessage = {
        type: PRODUCT_REPO_IPC_RESPONSE_TYPE,
        reqId: msg.reqId,
        ok: true,
        result,
      };
      workerProcess.send(response);
    } catch (error: unknown) {
      const err = error as Error;
      const response: ProductRepoResponseMessage = {
        type: PRODUCT_REPO_IPC_RESPONSE_TYPE,
        reqId: msg.reqId,
        ok: false,
        error: { message: err.message, name: err.name },
      };
      workerProcess.send(response);
    }
  });

  const workers: cluster.Worker[] = [];
  for (let i = 0; i < workerCount; i += 1) {
    const workerPort = workerPorts[i];
    const worker = cluster.fork({ PORT: String(workerPort) });
    workers.push(worker);
  }

  startLoadBalancer(workerPorts);
  void Promise.all(workers.map((w) => w.process.pid)).then(() => undefined);
}

if (cluster.isPrimary) {
  void startMaster();
} else {
  void startWorker();
}
