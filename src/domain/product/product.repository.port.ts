import type { Product, ProductCreateDto, ProductUpdateDto } from "./product.types";

export interface ProductRepository {
  findAll(): Product[];
  findById(id: string): Product | undefined;
  create(dto: ProductCreateDto): Product;
  update(id: string, dto: ProductUpdateDto): Product | undefined;
  delete(id: string): boolean;
}
