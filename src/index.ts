import fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import dotenv from "dotenv";
import { HTTP_STATUS } from "./presentation/http/http-status-codes";
import { createProductUseCases } from "./application/product/product.use-cases";
import { createMemoryProductRepository } from "./infrastructure/product/product.repository.memory";
import { registerProductRoutes } from "./presentation/http/product/product.routes";

dotenv.config();

const app: FastifyInstance = fastify();

const portEnv: string | undefined = process.env.PORT;
const port: number = portEnv ? Number(portEnv) : 4000;

const productRepository = createMemoryProductRepository();
const productUseCases = createProductUseCases(productRepository);

void app.get("/health", async () => {
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
      message: "Internal server error",
    });
  },
);

void app
  .listen({ port, host: "0.0.0.0" })
  .then(() => {
    console.log(`Server is running on port ${port}`);
  })
  .catch((error: unknown) => {
    console.error("Failed to start server", error);
    process.exit(1);
  });
