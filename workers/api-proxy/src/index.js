/**
 * Molebot API Proxy — Cloudflare Worker
 *
 * Проксирует /api/* на VPS (178.105.123.110).
 * Нужен потому что CF Pages _redirects с status 200 не проксирует POST.
 *
 * Route: mantle.molebot.org/api/*
 * Route: mantle.molebot.org/v1/*
 */

const VPS_ORIGIN = 'http://178.105.123.110';

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Прокси на VPS
    const targetUrl = `${VPS_ORIGIN}${url.pathname}${url.search}`;

    const proxyReq = new Request(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: ['GET', 'HEAD'].includes(request.method) ? null : request.body,
      duplex: 'half',
    });

    const resp = await fetch(proxyReq);

    // CORS для браузера
    const headers = new Headers(resp.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers,
    });
  },
};
