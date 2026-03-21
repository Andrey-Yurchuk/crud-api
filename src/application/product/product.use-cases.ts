import { validate as validateUuid } from "uuid";
import {
  InvalidProductIdError,
  InvalidProductPayloadError,
  ProductNotFoundError,
} from "../../domain/product/product.errors";
import type { ProductRepository } from "../../domain/product/product.repository.port";
import type {
  Product,
  ProductCreateDto,
  ProductUpdateDto,
} from "../../domain/product/product.types";
import { validateProductPayload } from "../../domain/product/product.validation";
import { mapProductDomainErrorToApplication } from "./product-map-domain-error";

export function createProductUseCases(repository: ProductRepository) {
  return {
    async listProducts(): Promise<Product[]> {
      return repository.findAll();
    },

    async getProduct(id: string): Promise<Product> {
      try {
        if (!validateUuid(id)) {
          throw new InvalidProductIdError();
        }

        const product = await repository.findById(id);

        if (!product) {
          throw new ProductNotFoundError();
        }

        return product;
      } catch (error: unknown) {
        mapProductDomainErrorToApplication(error);
      }
    },

    async createProduct(payload: unknown): Promise<Product> {
      try {
        const validationResult = validateProductPayload(payload);

        if (!validationResult.isValid) {
          throw new InvalidProductPayloadError(
            validationResult.errorMessage ?? "Invalid product payload",
          );
        }

        return await repository.create(validationResult.value as ProductCreateDto);
      } catch (error: unknown) {
        mapProductDomainErrorToApplication(error);
      }
    },

    async updateProduct(id: string, payload: unknown): Promise<Product> {
      try {
        if (!validateUuid(id)) {
          throw new InvalidProductIdError();
        }

        const validationResult = validateProductPayload(payload);

        if (!validationResult.isValid) {
          throw new InvalidProductPayloadError(
            validationResult.errorMessage ?? "Invalid product payload",
          );
        }

        const updated = await repository.update(id, validationResult.value as ProductUpdateDto);

        if (!updated) {
          throw new ProductNotFoundError();
        }

        return updated;
      } catch (error: unknown) {
        mapProductDomainErrorToApplication(error);
      }
    },

    async deleteProduct(id: string): Promise<void> {
      try {
        if (!validateUuid(id)) {
          throw new InvalidProductIdError();
        }

        const deleted = await repository.delete(id);

        if (!deleted) {
          throw new ProductNotFoundError();
        }
      } catch (error: unknown) {
        mapProductDomainErrorToApplication(error);
      }
    },
  };
}

export type ProductUseCases = ReturnType<typeof createProductUseCases>;
