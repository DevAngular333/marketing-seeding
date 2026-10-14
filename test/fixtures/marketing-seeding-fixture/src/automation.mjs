export class MockPage {
  async goto(url) {
    this.url = url;
  }
}

export class FixtureAutomation {
  constructor({ page }) {
    this.page = page;
  }

  async publishMock({ id, targetUrl, e2eLive = false }) {
    if (e2eLive) {
      try {
        await this.page.goto(targetUrl);
      } catch {
        return { status: "e2e_network_error", externalSideEffects: false, observedUrl: null, publicationUrl: null };
      }
      return { status: "e2e_dom_timeout", externalSideEffects: false, observedUrl: targetUrl, publicationUrl: null };
    }

    return {
      status: "mock_prepared",
      externalSideEffects: false,
      observedUrl: targetUrl,
      publicationUrl: `https://fixture.local/posts/${encodeURIComponent(id)}`
    };
  }
}

export async function attachCloakBrowser() {
  throw new Error("CloakBrowser is unavailable in the local fixture adapter");
}
