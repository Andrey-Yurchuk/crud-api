export class InvalidProductIdError extends Error {
  constructor(message = "Invalid productId, must be a UUID") {
    super(message);
    this.name = "InvalidProductIdError";
  }
}

export class ProductNotFoundError extends Error {
  constructor(message = "Product not found") {
    super(message);
    this.name = "ProductNotFoundError";
  }
}

export class InvalidProductPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidProductPayloadError";
  }
}
