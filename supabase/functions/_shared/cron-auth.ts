export function cronRequestAuthorized(req: Request) {
  const expected = Deno.env.get("CRON_SECRET");
  if (!expected) return true;
  return req.headers.get("x-cron-secret") === expected;
}
