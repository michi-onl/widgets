class APIClient {
  constructor(baseUrl, token = "") {
    this.baseUrl = baseUrl;
    this.token = token;
    this.timeout = 10; // 10 seconds, matching API timeout
  }

  async fetch(endpoint, params = {}) {
    const url = this.buildUrl(endpoint, params);
    console.log(`Fetching: ${endpoint}`);

    const request = new Request(url);
    request.timeoutInterval = this.timeout;
    if (this.token) request.headers = { Authorization: `Bearer ${this.token}` };

    try {
      const response = await request.loadJSON();
      console.log(`Success: ${endpoint}`);
      return response;
    } catch (error) {
      console.error(`API Error for ${endpoint}: ${error.message}`);
      console.error(`URL was: ${endpoint}`);
      throw new Error(`Failed to fetch from ${endpoint}: ${error.message}`);
    }
  }

  encodeParams(params) {
    return Object.entries(params)
      .filter(([, value]) => value !== null && value !== undefined)
      .map(
        ([key, value]) =>
          `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
      )
      .join("&");
  }

  buildUrl(endpoint, params) {
    let url = this.baseUrl + endpoint;
    // Filter out empty values so they never reach the URL.
    const filtered = Object.fromEntries(
      Object.entries(params).filter(
        ([, v]) => v !== "" && v !== null && v !== undefined,
      ),
    );
    if (Object.keys(filtered).length === 0) return url;
    const separator = url.includes("?") ? "&" : "?";
    return url + separator + this.encodeParams(filtered);
  }
}

module.exports = { APIClient };
