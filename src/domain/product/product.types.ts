export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  inStock: boolean;
}

export interface ProductCreateDto {
  name: string;
  description: string;
  price: number;
  category: string;
  inStock: boolean;
}

export type ProductUpdateDto = ProductCreateDto;
