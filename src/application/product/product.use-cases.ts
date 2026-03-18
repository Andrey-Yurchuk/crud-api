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
import { mapProductDomainErrorToApplication } from "./map-product-domain-error";

export function createProductUseCases(repository: ProductRepository) {
  return {
    listProducts(): Product[] {
      return repository.findAll();
    },

    getProduct(id: string): Product {
      try {
        if (!validateUuid(id)) {
          throw new InvalidProductIdError();
        }

        const product = repository.findById(id);

        if (!product) {
          throw new ProductNotFoundError();
        }

        return product;
      } catch (error: unknown) {
        mapProductDomainErrorToApplication(error);
      }
    },

    createProduct(payload: unknown): Product {
      try {
        const validationResult = validateProductPayload(payload);

        if (!validationResult.isValid) {
          throw new InvalidProductPayloadError(
            validationResult.errorMessage ?? "Invalid product payload",
          );
        }

        return repository.create(validationResult.value as ProductCreateDto);
      } catch (error: unknown) {
        mapProductDomainErrorToApplication(error);
      }
    },

    updateProduct(id: string, payload: unknown): Product {
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

        const updated = repository.update(id, validationResult.value as ProductUpdateDto);

        if (!updated) {
          throw new ProductNotFoundError();
        }

        return updated;
      } catch (error: unknown) {
        mapProductDomainErrorToApplication(error);
      }
    },

    deleteProduct(id: string): void {
      try {
        if (!validateUuid(id)) {
          throw new InvalidProductIdError();
        }

        const deleted = repository.delete(id);

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
