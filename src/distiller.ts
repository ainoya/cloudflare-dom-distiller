import puppeteer, { BrowserWorker, Page, ActiveSession } from '@cloudflare/puppeteer';

// @ts-ignore
import { readabilityJsBundle } from './third_party/readability/readability';
import { domdistillerJsBundle } from './third_party/dom-distiller/domdistiller';
import { turndownJsBundle } from './third_party/turndown-client/turndown';
import { turndownPluginGfmJsBundle } from './third_party/turndown-client/turndown-plugin-gfm';
// @ts-ignore
import { readabilityJsBundle } from './third_party/readability/readability';

export async function scrapeAndDistill(
	browserWorker: BrowserWorker,
	url: string,
	markdown: boolean,
	useReadability: boolean
): Promise<string> {
	const { browser } = await pickRandomSession(browserWorker);
	try {
		const page = await browser.newPage();
		page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
		// @ts-ignore
		await page.goto(url, { waitUntil: 'networkidle2' });
		// @ts-ignore
		await page.evaluate(() => (window.__name = (n, v) => v));

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
				function getExt(node) {
					try {
						// Simple match where the <pre> has the `highlight-source-js` tags
						// @ts-ignore
						function getFirstTag(node) {
							return node.outerHTML.split('>').shift() + '>';
						}
						const match = getFirstTag(node).match(/highlight-source-[a-z]+/);
						if (match) return match[0].split('-').pop();

						// More complex match where the _parent_ (single) has that.
						// The parent of the <pre> is not a "wrapping" parent, so skip those
						if (node.parentNode.childNodes.length !== 1) return '';

						// Check the parent just in case
						const parent = getFirstTag(node.parentNode).match(/highlight-source-[a-z]+/);
						if (parent) return parent[0].split('-').pop();
					} catch (e) {
						return '';
					}
					// Nothing was found...
					return '';
				}

				const rule = {};
				// @ts-ignore
				rule['filter'] = ['pre'];
				// @ts-ignore
				rule['replacement'] = function (content, node) {
					const ext = getExt(node);
					// @ts-ignore
					const code = [...node.childNodes].map((c) => c.textContent).join('');
					return '\n```' + ext + '\n' + code + '\n```\n\n';
				};

				turndownService.addRule('fenceAllPreformattedText', rule);
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

async function extractWithDomDistiller(page: Page) {
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

async function extractWithReadability(page: Page) {
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

// Pick random free session
// Other custom logic could be used instead
// https://developers.cloudflare.com/browser-rendering/get-started/reuse-sessions/
async function getRandomSession(endpoint: BrowserWorker): Promise<string | undefined> {
	const sessions: ActiveSession[] = await puppeteer.sessions(endpoint);
	console.log(`Sessions: ${JSON.stringify(sessions)}`);
	const sessionsIds = sessions
		.filter((v) => {
			return !v.connectionId; // remove sessions with workers connected to them
		})
		.map((v) => {
			return v.sessionId;
		});
	if (sessionsIds.length === 0) {
		return;
	}

	const sessionId = sessionsIds[Math.floor(Math.random() * sessionsIds.length)];

	return sessionId!;
}

async function pickRandomSession(browserWorker: BrowserWorker) {
	// Pick random session from open sessions
	let sessionId = await getRandomSession(browserWorker);
	let browser, launched;
	if (sessionId) {
		try {
			browser = await puppeteer.connect(browserWorker, sessionId);
		} catch (e) {
			// another worker may have connected first
			console.log(`Failed to connect to ${sessionId}. Error ${e}`);
		}
	}
	if (!browser) {
		// No open sessions, launch new session
		browser = await puppeteer.launch(browserWorker);
		launched = true;
	}

	return { browser, launched };
}
