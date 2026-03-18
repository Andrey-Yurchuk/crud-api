import type { ProductRepository } from "../../domain/product/product.repository.port";
import type {
  Product,
  ProductCreateDto,
  ProductUpdateDto,
} from "../../domain/product/product.types";

import {
  IPC_REQUEST_TIMEOUT_MS,
  PRODUCT_REPO_IPC_REQUEST_TYPE,
  PRODUCT_REPO_IPC_RESPONSE_TYPE,
  PRODUCT_REPO_OPERATIONS,
  type ProductRepoOperation,
} from "../cluster/product-repo-ipc.constants";

type ProductRepoRequestMessage = {
  type: typeof PRODUCT_REPO_IPC_REQUEST_TYPE;
  reqId: number;
  operation: ProductRepoOperation;
  args: unknown[];
};

type ProductRepoResponseMessage =
  | {
      type: typeof PRODUCT_REPO_IPC_RESPONSE_TYPE;
      reqId: number;
      ok: true;
      result: unknown;
    }
  | {
      type: typeof PRODUCT_REPO_IPC_RESPONSE_TYPE;
      reqId: number;
      ok: false;
      error: { message: string; name?: string };
    };

export function createIpcProductRepository(): ProductRepository {
  const pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (reason: Error) => void; timeout: NodeJS.Timeout }
  >();
  let nextReqId = 1;

  function callMaster(operation: ProductRepoOperation, args: unknown[]): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const reqId = nextReqId;
      nextReqId += 1;

      const timeout = setTimeout(() => {
        pending.delete(reqId);
        reject(new Error(`IPC request timed out (operation=${operation})`));
      }, IPC_REQUEST_TIMEOUT_MS);

      pending.set(reqId, { resolve, reject, timeout });

      process.send?.({
        type: PRODUCT_REPO_IPC_REQUEST_TYPE,
        reqId,
        operation,
        args,
      } satisfies ProductRepoRequestMessage);
    });
  }

  process.on("message", (message: unknown) => {
    const msg = message as ProductRepoResponseMessage;
    if (!msg || typeof msg !== "object") return;
    if (msg.type !== PRODUCT_REPO_IPC_RESPONSE_TYPE) return;

    const pendingItem = pending.get(msg.reqId);
    if (!pendingItem) return;

    clearTimeout(pendingItem.timeout);
    pending.delete(msg.reqId);

    if (msg.ok) {
      pendingItem.resolve(msg.result);
    } else {
      pendingItem.reject(new Error(msg.error.message));
    }
  });

  return {
    async findAll(): Promise<Product[]> {
      return (await callMaster(PRODUCT_REPO_OPERATIONS.FIND_ALL, [])) as Product[];
    },

    async findById(id: string): Promise<Product | undefined> {
      return (await callMaster(PRODUCT_REPO_OPERATIONS.FIND_BY_ID, [id])) as Product | undefined;
    },

    async create(dto: ProductCreateDto): Promise<Product> {
      return (await callMaster(PRODUCT_REPO_OPERATIONS.CREATE, [dto])) as Product;
    },

    async update(id: string, dto: ProductUpdateDto): Promise<Product | undefined> {
      return (await callMaster(PRODUCT_REPO_OPERATIONS.UPDATE, [id, dto])) as Product | undefined;
    },

    async delete(id: string): Promise<boolean> {
      return (await callMaster(PRODUCT_REPO_OPERATIONS.DELETE, [id])) as boolean;
    },
  };
}
