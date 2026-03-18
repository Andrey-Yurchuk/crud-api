import {
  isProductApplicationError,
  type ProductApplicationError,
} from "../../../application/product/product.application-errors";
import type { ProductUseCases } from "../../../application/product/product.use-cases";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { HTTP_STATUS } from "../http-status-codes";
import { PRODUCT_ROUTES } from "./product.routes.constants";
import { httpStatusForProductApplicationError } from "./product-error-http";

interface IdParams {
  productId: string;
}

function sendProductApplicationError(reply: FastifyReply, error: ProductApplicationError): void {
  const status = httpStatusForProductApplicationError(error.code);
  void reply.code(status).send({ message: error.message });
}

export async function registerProductRoutes(
  app: FastifyInstance,
  productUseCases: ProductUseCases,
): Promise<void> {
  app.get(
    PRODUCT_ROUTES.BASE,
    async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const products = productUseCases.listProducts();
      void reply.code(HTTP_STATUS.OK).send(products);
    },
  );

  app.get(
    PRODUCT_ROUTES.BY_ID,
    async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply): Promise<void> => {
      const { productId } = request.params;

      try {
        const product = productUseCases.getProduct(productId);
        void reply.code(HTTP_STATUS.OK).send(product);
      } catch (error: unknown) {
        if (isProductApplicationError(error)) {
          sendProductApplicationError(reply, error);
          return;
        }

        throw error;
      }
    },
  );

  app.post(
    PRODUCT_ROUTES.BASE,
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        const created = productUseCases.createProduct(request.body);
        void reply.code(HTTP_STATUS.CREATED).send(created);
      } catch (error: unknown) {
        if (isProductApplicationError(error)) {
          sendProductApplicationError(reply, error);
          return;
        }

        throw error;
      }
    },
  );

  app.put(
    PRODUCT_ROUTES.BY_ID,
    async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply): Promise<void> => {
      const { productId } = request.params;

      try {
        const updated = productUseCases.updateProduct(productId, request.body);
        void reply.code(HTTP_STATUS.OK).send(updated);
      } catch (error: unknown) {
        if (isProductApplicationError(error)) {
          sendProductApplicationError(reply, error);
          return;
        }

        throw error;
      }
    },
  );

  app.delete(
    PRODUCT_ROUTES.BY_ID,
    async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply): Promise<void> => {
      const { productId } = request.params;

      try {
        productUseCases.deleteProduct(productId);
        void reply.code(HTTP_STATUS.NO_CONTENT).send();
      } catch (error: unknown) {
        if (isProductApplicationError(error)) {
          sendProductApplicationError(reply, error);
          return;
        }

        throw error;
      }
    },
  );
}
