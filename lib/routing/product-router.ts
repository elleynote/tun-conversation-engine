import type { Classification, Product } from "../types";

export function routeProducts(classification: Pick<Classification, "intent" | "recommended_product_key" | "recommended_product_keys">, products: Product[]) {
  const active = products.filter((p) => p.active !== false);
  const requested = classification.recommended_product_keys?.length
    ? classification.recommended_product_keys
    : classification.recommended_product_key
      ? [classification.recommended_product_key]
      : [];

  const result: Product[] = [];
  for (const key of requested) {
    const product = active.find((p) => p.key === key);
    if (product && !result.some((x) => x.key === product.key)) result.push(product);
  }

  if (!result.length) {
    const fallback = active
      .filter((p) => p.intent_keys?.includes(classification.intent))
      .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
    if (fallback[0]) result.push(fallback[0]);
  }

  return result;
}

export function routeProduct(intent: string, recommendedKey: string | null, products: Product[]) {
  return routeProducts(
    {
      intent,
      recommended_product_key: recommendedKey,
      recommended_product_keys: recommendedKey ? [recommendedKey] : [],
    },
    products,
  )[0] ?? null;
}
