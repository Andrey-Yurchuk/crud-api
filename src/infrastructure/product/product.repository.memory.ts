import { randomUUID } from "crypto";
import type { ProductRepository } from "../../domain/product/product.repository.port";
import type {
  Product,
  ProductCreateDto,
  ProductUpdateDto,
} from "../../domain/product/product.types";

const products = new Map<string, Product>();

export function createMemoryProductRepository(): ProductRepository {
  return {
    findAll(): Product[] {
      return Array.from(products.values());
    },

    findById(id: string): Product | undefined {
      return products.get(id);
    },

    create(dto: ProductCreateDto): Product {
      const id = randomUUID();
      const product: Product = {
        id,
        ...dto,
      };
      products.set(id, product);
      return product;
    },

    update(id: string, dto: ProductUpdateDto): Product | undefined {
      if (!products.has(id)) {
        return undefined;
      }
      const updated: Product = {
        id,
        ...dto,
      };
      products.set(id, updated);
      return updated;
    },

    delete(id: string): boolean {
      return products.delete(id);
    },
  };
}
