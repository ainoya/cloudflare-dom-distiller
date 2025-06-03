# Cloudflare DOM Distiller

This repository provides an API implementation for easily retrieving content from target web pages on Cloudflare Workers.

## Features

- **Cloudflare Workers & Browser Rendering**: Utilizes Cloudflare Workers and browser rendering to fetch page information.
- **Readability**: Uses Readability to extract page content and remove unnecessary information.
- **DOM-Distiller**: If you set option `useReadability: false` in a request, uses dom-distiller to extract page content and remove unnecessary information.
- **Turndown**: Converts the extracted HTML to Markdown format for better readability.
- **CSS skipping**: Set `disableCss: true` in a request to prevent loading CSS files during rendering.

## Example Usage

To run the API in development mode:

```bash
npx wrangler dev --remote
```

You can make a request to your local server and verify that the content of the target web page is converted to Markdown format:

```bash
$ curl -H 'Content-Type: application/json' \
 -X POST http://localhost:8787/distill \
 -d '{"url": "https://blog.samaltman.com/gpt-4o", "markdown": true}'

{"body":"There ... to the team that poured so much work into making this happen!"}
```

## Endpoint: `/distill`

### Request Format

- **url**: The URL of the target web page to fetch content from.
- **markdown**: Boolean value to indicate whether the content should be converted to Markdown format.
- **useReadability**: Optional boolean to switch between Readability and DOM Distiller (default is `true`).
- **disableCss**: Optional boolean to disable CSS loading during rendering.

### Response Format

- **body**: Returns the content of the web page.

## References

- [mixmark\-io/turndown: 🛏 An HTML to Markdown converter written in JavaScript](https://github.com/mixmark-io/turndown)
- [mozilla/readability: A standalone version of the readability lib](https://github.com/mozilla/readability)
- [chromium/dom\-distiller: Distills the DOM](https://github.com/chromium/dom-distiller)
- [Puppeteer · Browser Rendering docs](https://developers.cloudflare.com/browser-rendering/platform/puppeteer/)
