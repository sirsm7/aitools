export async function onRequestGet(context) {
  const env = context.env || {};
  const payload = {
    GAS_ENDPOINT_URL: env.GAS_ENDPOINT_URL || "",
    CACHE_TTL_MS: 300000,
    DB_NAME: "SchoolDashboardDB",
    DB_VERSION: 1,
    STORE_NAME: "teachers_data"
  };

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate"
    }
  });
}