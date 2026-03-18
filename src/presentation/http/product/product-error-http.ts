import {
  PRODUCT_ERROR_CODES,
  type ProductApplicationErrorCode,
} from "../../../application/product/product-error-codes";
import { HTTP_STATUS } from "../http-status-codes";

export function httpStatusForProductApplicationError(
  code: ProductApplicationErrorCode,
): typeof HTTP_STATUS.BAD_REQUEST | typeof HTTP_STATUS.NOT_FOUND {
  if (code === PRODUCT_ERROR_CODES.PRODUCT_NOT_FOUND) {
    return HTTP_STATUS.NOT_FOUND;
  }

  return HTTP_STATUS.BAD_REQUEST;
}
