import type { ProductApplicationErrorCode } from "./product-error-codes";

export class ProductApplicationError extends Error {
  readonly code: ProductApplicationErrorCode;

  constructor(code: ProductApplicationErrorCode, message: string) {
    super(message);
    this.name = "ProductApplicationError";
    this.code = code;
  }
}

export function isProductApplicationError(error: unknown): error is ProductApplicationError {
  return error instanceof ProductApplicationError;
}
