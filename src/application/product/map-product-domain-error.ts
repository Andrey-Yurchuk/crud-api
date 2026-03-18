import {
  InvalidProductIdError,
  InvalidProductPayloadError,
  ProductNotFoundError,
} from "../../domain/product/product.errors";
import { ProductApplicationError } from "./product.application-errors";
import { PRODUCT_ERROR_CODES } from "./product-error-codes";

export function mapProductDomainErrorToApplication(error: unknown): never {
  if (error instanceof InvalidProductIdError) {
    throw new ProductApplicationError(PRODUCT_ERROR_CODES.INVALID_PRODUCT_ID, error.message);
  }

  if (error instanceof ProductNotFoundError) {
    throw new ProductApplicationError(PRODUCT_ERROR_CODES.PRODUCT_NOT_FOUND, error.message);
  }

  if (error instanceof InvalidProductPayloadError) {
    throw new ProductApplicationError(PRODUCT_ERROR_CODES.INVALID_PAYLOAD, error.message);
  }

  throw error;
}
