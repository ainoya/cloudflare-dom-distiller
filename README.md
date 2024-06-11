# DOM Distiller API

This repository provides an API implementation for easily retrieving content from target web pages on Cloudflare Workers.

## Features

- **Cloudflare Workers & Browser Rendering**: Utilizes Cloudflare Workers and browser rendering to fetch page information.
- **DOM-Distiller**: Uses dom-distiller to extract page content and remove unnecessary information.
- **Turndown**: Converts the extracted HTML to Markdown format for better readability.

## Example Usage

To run the API in development mode:

```bash
npx wrangler dev --remote
```

You can make a request to your local server and verify that the content of the target web page is converted to Markdown format:

```bash
curl -H 'Content-Type: application/json' -X POST http://localhost:8787/distill -d '{"url": "https://blog.samaltman.com/gpt-4o", "markdown": true}'
{"body":"There ... to the team that poured so much work into making this happen!"}
```

## Endpoint: `/distill`

### Request Format

- **url**: The URL of the target web page to fetch content from.
- **markdown**: Boolean value to indicate whether the content should be converted to Markdown format.

### Response Format

- **body**: Returns the content of the web page.

## References

- [mixmark\-io/turndown: 🛏 An HTML to Markdown converter written in JavaScript](https://github.com/mixmark-io/turndown)
- [chromium/dom\-distiller: Distills the DOM](https://github.com/chromium/dom-distiller)
- [Puppeteer · Browser Rendering docs](https://developers.cloudflare.com/browser-rendering/platform/puppeteer/)
