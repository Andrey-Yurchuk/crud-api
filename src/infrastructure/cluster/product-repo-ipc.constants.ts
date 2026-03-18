export const PRODUCT_REPO_IPC_REQUEST_TYPE = "productRepoRequest";
export const PRODUCT_REPO_IPC_RESPONSE_TYPE = "productRepoResponse";

export const PRODUCT_REPO_OPERATIONS = {
  FIND_ALL: "findAll",
  FIND_BY_ID: "findById",
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
} as const;

export type ProductRepoOperation =
  (typeof PRODUCT_REPO_OPERATIONS)[keyof typeof PRODUCT_REPO_OPERATIONS];

export const IPC_REQUEST_TIMEOUT_MS = 5000;
