import type { ProductRepository } from "../../domain/product/product.repository.port";
import type {
  Product,
  ProductCreateDto,
  ProductUpdateDto,
} from "../../domain/product/product.types";
import { HTTP_STATUS } from "../../presentation/http/http-status-codes";
import {
  STATE_SERVICE_DEFAULT_PORT,
  STATE_SERVICE_HOST,
  STATE_SERVICE_INTERNAL_BASE,
} from "../state-service/state-service.constants";

function getStateServiceBaseUrl(): string {
  const host = process.env.STATE_SERVICE_HOST ?? STATE_SERVICE_HOST;
  const portEnv = process.env.STATE_SERVICE_PORT;
  const port = portEnv ? Number(portEnv) : STATE_SERVICE_DEFAULT_PORT;
  const safePort = Number.isFinite(port) && port > 0 ? port : STATE_SERVICE_DEFAULT_PORT;
  return `http://${host}:${safePort}${STATE_SERVICE_INTERNAL_BASE}`;
}

async function readJson<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : null;
}

export function createHttpProductRepository(): ProductRepository {
  const baseUrl = getStateServiceBaseUrl();

  return {
    async findAll(): Promise<Product[]> {
      const res = await fetch(baseUrl);
      if (!res.ok) {
        throw new Error(`State service error: findAll failed (${res.status})`);
      }
      return ((await readJson<Product[]>(res)) ?? []) as Product[];
    },

    async findById(id: string): Promise<Product | undefined> {
      const res = await fetch(`${baseUrl}/${id}`);
      if (res.status === HTTP_STATUS.NOT_FOUND) {
        return undefined;
      }
      if (!res.ok) {
        throw new Error(`State service error: findById failed (${res.status})`);
      }
      return (await readJson<Product>(res)) ?? undefined;
    },

    async create(dto: ProductCreateDto): Promise<Product> {
      const res = await fetch(baseUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(dto),
      });
      if (!res.ok) {
        throw new Error(`State service error: create failed (${res.status})`);
      }
      const created = await readJson<Product>(res);
      if (!created) {
        throw new Error("State service error: create returned empty body");
      }
      return created;
    },

    async update(id: string, dto: ProductUpdateDto): Promise<Product | undefined> {
      const res = await fetch(`${baseUrl}/${id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(dto),
      });
      if (res.status === HTTP_STATUS.NOT_FOUND) {
        return undefined;
      }
      if (!res.ok) {
        throw new Error(`State service error: update failed (${res.status})`);
      }
      return (await readJson<Product>(res)) ?? undefined;
    },

    async delete(id: string): Promise<boolean> {
      const res = await fetch(`${baseUrl}/${id}`, { method: "DELETE" });
      if (res.status === HTTP_STATUS.NOT_FOUND) {
        return false;
      }
      if (res.status === HTTP_STATUS.NO_CONTENT) {
        return true;
      }
      if (!res.ok) {
        throw new Error(`State service error: delete failed (${res.status})`);
      }
      return true;
    },
  };
}
