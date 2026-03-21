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
    async findAll(): Promise<Product[]> {
      return Array.from(products.values());
    },

    async findById(id: string): Promise<Product | undefined> {
      return products.get(id);
    },

    async create(dto: ProductCreateDto): Promise<Product> {
      const id = randomUUID();
      const product: Product = {
        id,
        ...dto,
      };
      products.set(id, product);
      return product;
    },

    async update(id: string, dto: ProductUpdateDto): Promise<Product | undefined> {
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

    async delete(id: string): Promise<boolean> {
      return products.delete(id);
    },
  };
}
