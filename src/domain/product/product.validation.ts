import type { ProductCreateDto } from "./product.types";

export interface ValidationResult<T> {
  isValid: boolean;
  value?: T;
  errorMessage?: string;
}

export function validateProductPayload(payload: unknown): ValidationResult<ProductCreateDto> {
  if (payload === null || typeof payload !== "object") {
    return {
      isValid: false,
      errorMessage: "Body must be a JSON object",
    };
  }

  const value = payload as Record<string, unknown>;

  const name = value.name;
  const description = value.description;
  const price = value.price;
  const category = value.category;
  const inStock = value.inStock;

  if (
    typeof name !== "string" ||
    typeof description !== "string" ||
    typeof category !== "string" ||
    typeof inStock !== "boolean"
  ) {
    return {
      isValid: false,
      errorMessage: "Missing or invalid required fields",
    };
  }

  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
    return {
      isValid: false,
      errorMessage: "Price must be a positive number",
    };
  }

  return {
    isValid: true,
    value: {
      name,
      description,
      price,
      category,
      inStock,
    },
  };
}
