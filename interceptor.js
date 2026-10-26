(() => {
  const MESSAGE_TYPE = "APICATCHER_RESPONSE";

  const sendResponse = (request) => {
    window.postMessage(
      {
        source: "ApiCatcher",
        type: MESSAGE_TYPE,
        payload: request
      },
      window.location.origin
    );
  };

  const getMethod = (input, init) => {
    if (init && init.method) {
      return String(init.method).toUpperCase();
    }

    if (input instanceof Request && input.method) {
      return input.method.toUpperCase();
    }

    return "GET";
  };

  const getUrl = (input) => {
    if (typeof input === "string") {
      return new URL(input, window.location.href).href;
    }

    if (input instanceof URL) {
      return input.href;
    }

    if (input instanceof Request) {
      return input.url;
    }

    return String(input);
  };

  const originalFetch = window.fetch;

  window.fetch = async function (...args) {
    const [input, init] = args;
    const method = getMethod(input, init);
    const url = getUrl(input);
    const response = await originalFetch.apply(this, args);

    response
      .clone()
      .json()
      .then((data) => {
        sendResponse({
          url: response.url || url,
          method,
          status: response.status,
          data
        });
      })
      .catch(() => {
        // Only JSON responses are useful to ApiCatcher.
      });

    return response;
  };

  const OriginalXMLHttpRequest = window.XMLHttpRequest;

  class ApiCatcherXMLHttpRequest extends OriginalXMLHttpRequest {
    constructor() {
      super();
      this.__apiCatcherMethod = "GET";
      this.__apiCatcherUrl = "";

      this.addEventListener("load", () => {
        if (this.responseType && this.responseType !== "text") {
          return;
        }

        try {
          const data = JSON.parse(this.responseText);
          sendResponse({
            url: this.responseURL || this.__apiCatcherUrl,
            method: this.__apiCatcherMethod,
            status: this.status,
            data
          });
        } catch {
          // Only JSON responses are useful to ApiCatcher.
        }
      });
    }

    open(method, url, ...rest) {
      this.__apiCatcherMethod = String(method).toUpperCase();
      this.__apiCatcherUrl = new URL(url, window.location.href).href;
      return super.open(method, url, ...rest);
    }
  }

  window.XMLHttpRequest = ApiCatcherXMLHttpRequest;
})();
