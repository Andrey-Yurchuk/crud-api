import fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { HTTP_STATUS } from "../../presentation/http/http-status-codes";
import { createMemoryProductRepository } from "../product/product.repository.memory";
import { STATE_SERVICE_HEALTH_PATH, STATE_SERVICE_INTERNAL_BASE } from "./state-service.constants";
import type { ProductCreateDto, ProductUpdateDto } from "../../domain/product/product.types";

type IdParams = { id: string };

export function createStateServiceApp(): FastifyInstance {
  const app = fastify();
  const productRepository = createMemoryProductRepository();

  void app.get(STATE_SERVICE_HEALTH_PATH, async () => ({ status: "ok" }));

  void app.get(
    STATE_SERVICE_INTERNAL_BASE,
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const products = await productRepository.findAll();
      void reply.code(HTTP_STATUS.OK).send(products);
    },
  );

  void app.get(
    `${STATE_SERVICE_INTERNAL_BASE}/:id`,
    async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
      const product = await productRepository.findById(request.params.id);
      if (!product) {
        void reply.code(HTTP_STATUS.NOT_FOUND).send({ message: "Product not found" });
        return;
      }
      void reply.code(HTTP_STATUS.OK).send(product);
    },
  );

  void app.post(
    STATE_SERVICE_INTERNAL_BASE,
    async (request: FastifyRequest, reply: FastifyReply) => {
      const created = await productRepository.create(request.body as ProductCreateDto);
      void reply.code(HTTP_STATUS.CREATED).send(created);
    },
  );

  void app.put(
    `${STATE_SERVICE_INTERNAL_BASE}/:id`,
    async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
      const updated = await productRepository.update(
        request.params.id,
        request.body as ProductUpdateDto,
      );
      if (!updated) {
        void reply.code(HTTP_STATUS.NOT_FOUND).send({ message: "Product not found" });
        return;
      }
      void reply.code(HTTP_STATUS.OK).send(updated);
    },
  );

  void app.delete(
    `${STATE_SERVICE_INTERNAL_BASE}/:id`,
    async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
      const deleted = await productRepository.delete(request.params.id);
      if (!deleted) {
        void reply.code(HTTP_STATUS.NOT_FOUND).send({ message: "Product not found" });
        return;
      }
      void reply.code(HTTP_STATUS.NO_CONTENT).send();
    },
  );

  app.setNotFoundHandler(async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    void reply.code(HTTP_STATUS.NOT_FOUND).send({
      message: `Route ${request.method} ${request.url} not found`,
    });
  });

  app.setErrorHandler(
    async (error: unknown, _request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      console.error("State service unhandled error", error);
      void reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        message: "Internal server error",
      });
    },
  );

  return app;
}
