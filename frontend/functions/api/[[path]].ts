/**
 * Cloudflare Pages Function — прокси /api/* на VPS.
 * Работает для всех HTTP методов (GET, POST, OPTIONS).
 */

const VPS_ORIGIN = 'http://178.105.123.110';

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const targetUrl = `${VPS_ORIGIN}${url.pathname}${url.search}`;

  const proxyRequest = new Request(targetUrl, {
    method: request.method,
    headers: request.headers,
    body: ['GET', 'HEAD'].includes(request.method) ? null : request.body,
    duplex: 'half',
  });

  const response = await fetch(proxyRequest);
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
