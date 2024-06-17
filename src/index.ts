import puppeteer, { BrowserWorker } from '@cloudflare/puppeteer';

import { Hono } from 'hono';
import { domdistillerJsBundle } from './third_party/dom-distiller/domdistiller';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { turndownJsBundle } from './third_party/turndown-client/turndown';
import { turndownPluginGfmJsBundle } from './third_party/turndown-client/turndown-plugin-gfm';
// @ts-ignore
import { readabilityJsBundle } from './third_party/readability/readability';

async function scrapeAndDistill(
	browserWorker: puppeteer.BrowserWorker,
	url: string,
	markdown: boolean,
	useReadability: boolean
): Promise<string> {
	const browser = await puppeteer.launch(browserWorker);
	try {
		const page = await browser.newPage();
		await page.goto(url, { waitUntil: 'networkidle2' });

		// load the DOM Distiller script
		const content = useReadability ? await extractWithReadability(page) : await extractWithDomDistiller(page);

		if (markdown) {
			await page.evaluate(turndownJsBundle);
			await page.evaluate(turndownPluginGfmJsBundle);
			await page.evaluate(`var content = ${JSON.stringify(content)};`);
			const markdown = await page.evaluate(() => {
				// @ts-ignore
				const turndownService = new TurndownService({
					codeBlockStyle: 'fenced',
					preformattedCode: true,
				});

				// @ts-ignore
				turndownService.use(turndownPluginGfm.gfm);

				// https://github.com/mixmark-io/turndown/issues/192#issuecomment-1242819018
				// @ts-ignore
				const getExt = (node) => {
					// Simple match where the <pre> has the `highlight-source-js` tags
					// @ts-ignore
					const getFirstTag = (node) => node.outerHTML.split('>').shift() + '>';
					const match = getFirstTag(node).match(/highlight-source-[a-z]+/);
					if (match) return match[0].split('-').pop();

					// More complex match where the _parent_ (single) has that.
					// The parent of the <pre> is not a "wrapping" parent, so skip those
					if (node.parentNode.childNodes.length !== 1) return '';

					// Check the parent just in case
					const parent = getFirstTag(node.parentNode).match(/highlight-source-[a-z]+/);
					if (parent) return parent[0].split('-').pop();

					// Nothing was found...
					return '';
				};
				turndownService.addRule('fenceAllPreformattedText', {
					filter: ['pre'],
					// @ts-ignore
					replacement: function (content, node) {
						const ext = getExt(node);
						const code = [...node.childNodes].map((c) => c.textContent).join('');
						return '\n```' + ext + '\n' + code + '\n```\n\n';
					},
				});
				// @ts-ignore
				return turndownService.turndown(content);
			});
			return markdown;
		}

		return content;
	} finally {
		await browser.close();
	}
}

const DistillRequestSchema = z.object({
	url: z.string(),
	markdown: z.boolean(),
	useReadability: z.boolean().optional(),
});

type Request = z.infer<typeof DistillRequestSchema>;

const DistillResponseSchema = z.object({
	body: z.string(),
});

type Response = z.infer<typeof DistillResponseSchema>;
const app = new Hono<{ Bindings: Bindings }>();

type Bindings = {
	MYBROWSER: BrowserWorker;
	SERVICE_API_KEY?: string;
};

// set bearer auth if SERVICE_API_KEY is set
app.use(async (c, next) => {
	const serviceApiKey = c.env.SERVICE_API_KEY;
	// bypass auth if SERVICE_API_KEY is not set
	if (!serviceApiKey) {
		return await next();
	}

	const authHeader = c.req.header('Authorization');
	if (!authHeader) {
		return c.text('Authorization header is missing', { status: 401 });
	}

	const [authType, authValue] = authHeader.split(' ');

	if (authType !== 'Bearer') {
		return c.text('Invalid authorization type', { status: 401 });
	}

	if (authValue !== serviceApiKey) {
		return c.text('Invalid API key', { status: 401 });
	}

	return await next();
});

app.post('/distill', zValidator('json', DistillRequestSchema), async (c) => {
	const req = c.req.valid('json');

	const browserWorker = c.env.MYBROWSER;

	// return 429 if the browser worker is busy
	// https://github.com/cloudflare/puppeteer/blob/808f08afdd25ee49a267479f05eecd0a1b3edf0a/src/puppeteer-core.ts#L86
	const limits = await puppeteer.limits(browserWorker);
	if (limits.allowedBrowserAcquisitions < 1) {
		return c.text('The browser worker is busy', { status: 429 });
	}

	// by default, use readability
	const useReadability = req.useReadability ?? true;

	const distilled = await scrapeAndDistill(browserWorker, req.url, req.markdown, useReadability);

	const res: Response = {
		body: distilled,
	};

	return c.json(res);
});

async function extractWithDomDistiller(page: puppeteer.Page) {
	const distillerScript = domdistillerJsBundle;
	console.debug('Injecting DOM Distiller script');
	await page.evaluate(distillerScript);

	// run the DOM Distiller script
	console.debug('Running DOM Distiller');
	const distilledContent = await page.evaluate(() => {
		// @ts-ignore
		return org.chromium.distiller.DomDistiller.apply();
	});

	console.debug('Distilled content:', distilledContent);

	// console.log(distilledContent);
	const content = distilledContent[2][1];
	return content;
}

async function extractWithReadability(page: puppeteer.Page) {
	const readabilityScript = readabilityJsBundle;

	console.debug('Injecting Readability script');
	await page.evaluate(readabilityScript);

	// run the Readability script
	console.debug('Running Readability');
	const content = await page.evaluate(() => {
		// @ts-ignore
		const article = new Readability(document).parse();
		return article.content;
	});

	return content;
}

export default app;
