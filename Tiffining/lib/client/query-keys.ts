import type { ReadOperation } from "@/lib/client/endpoints";

export const sellerKey = (sellerId: string) => ["tiffining", sellerId] as const;
export const resourceKey = (sellerId: string, operation: ReadOperation, input: Record<string, unknown>) => [...sellerKey(sellerId), operation, input] as const;
