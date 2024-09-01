import puppeteer, { BrowserWorker } from '@cloudflare/puppeteer';

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
// @ts-ignore
import { scrapeAndDistill } from './distiller';

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
		const retryAfter = limits.timeUntilNextAllowedBrowserAcquisition;
		return c.text('The browser worker is busy', 429, {
			'Retry-After': retryAfter.toString(),
		});
	}

	// by default, use readability
	const useReadability = req.useReadability ?? true;

	const distilled = await scrapeAndDistill(browserWorker, req.url, req.markdown, useReadability);

	const res: Response = {
		body: distilled,
	};

	return c.json(res);
});

export default app;
