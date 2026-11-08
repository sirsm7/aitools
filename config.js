(function () {
  const DEFAULT_CONFIG = {
    GAS_ENDPOINT_URL: "",
    CACHE_TTL_MS: 300000,
    DB_NAME: "SchoolDashboardDB",
    DB_VERSION: 1,
    STORE_NAME: "teachers_data"
  };

  window.ENV_READY = (async function () {
    let resolvedConfig = { ...DEFAULT_CONFIG };

    try {
      const response = await fetch("/api/config", {
        method: "GET",
        headers: {
          "Accept": "application/json"
        },
        cache: "no-store"
      });

      if (response.ok) {
        const data = await response.json();
        if (data && typeof data === "object") {
          resolvedConfig = {
            GAS_ENDPOINT_URL: typeof data.GAS_ENDPOINT_URL === "string" ? data.GAS_ENDPOINT_URL : DEFAULT_CONFIG.GAS_ENDPOINT_URL,
            CACHE_TTL_MS: typeof data.CACHE_TTL_MS === "number" ? data.CACHE_TTL_MS : DEFAULT_CONFIG.CACHE_TTL_MS,
            DB_NAME: typeof data.DB_NAME === "string" ? data.DB_NAME : DEFAULT_CONFIG.DB_NAME,
            DB_VERSION: typeof data.DB_VERSION === "number" ? data.DB_VERSION : DEFAULT_CONFIG.DB_VERSION,
            STORE_NAME: typeof data.STORE_NAME === "string" ? data.STORE_NAME : DEFAULT_CONFIG.STORE_NAME
          };
        }
      }
    } catch (_) {}

    const frozenEnv = Object.freeze(resolvedConfig);
    window.__ENV = frozenEnv;
    window.APP_CONFIG = frozenEnv;

    return frozenEnv;
  })();
})();