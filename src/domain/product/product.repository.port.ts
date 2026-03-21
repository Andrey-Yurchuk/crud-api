import type { Product, ProductCreateDto, ProductUpdateDto } from "./product.types";

export interface ProductRepository {
  findAll(): Promise<Product[]>;
  findById(id: string): Promise<Product | undefined>;
  create(dto: ProductCreateDto): Promise<Product>;
  update(id: string, dto: ProductUpdateDto): Promise<Product | undefined>;
  delete(id: string): Promise<boolean>;
}
