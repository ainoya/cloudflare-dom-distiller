import puppeteer, { BrowserWorker } from '@cloudflare/puppeteer';

async function scrapeAndDistill(browserWorker: puppeteer.BrowserWorker, url: string, markdown: boolean): Promise<string> {
	const browser = await puppeteer.launch(browserWorker);
	try {
		const page = await browser.newPage();
		await page.goto(url, { waitUntil: 'networkidle2' });

		// load the DOM Distiller script
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

		console.debug('Content:', content);

		if (markdown) {
			await page.evaluate(turndownJsBundle);
			await page.evaluate(`var content = ${JSON.stringify(content)};`);
			const markdown = await page.evaluate(() => {
				// @ts-ignore
				const turndownService = new TurndownService();
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
});

type Request = z.infer<typeof DistillRequestSchema>;

const DistillResponseSchema = z.object({
	body: z.string(),
});

type Response = z.infer<typeof DistillResponseSchema>;

import { Hono } from 'hono';
import { domdistillerJsBundle } from './third_party/dom-distiller/domdistiller';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { turndownJsBundle } from './third_party/turndown-client/turndown';
const app = new Hono<{ Bindings: Bindings }>();

type Bindings = {
	MYBROWSER: BrowserWorker;
};

app.get('/', (c) => c.text('Hono!'));

app.post('/distill', zValidator('json', DistillRequestSchema), async (c) => {
	const req = c.req.valid('json');

	const browserWorker = c.env.MYBROWSER;
	const distilled = await scrapeAndDistill(browserWorker, req.url, req.markdown);

	console.debug('Distilled:', distilled);

	const res: Response = {
		body: distilled,
	};

	return c.json(res);
});

export default app;
