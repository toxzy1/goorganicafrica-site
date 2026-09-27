import { Buffer } from 'node:buffer';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

interface Env {
  GITHUB_APP_CLIENT_ID: string;
  GITHUB_APP_CLIENT_SECRET: string;
}

const AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const TOKEN_URL = 'https://github.com/login/oauth/access_token';
const USER_AGENT = 'goorganicafrica-cms-oauth-proxy';
const STATE_TTL_SECONDS = 600;
const CMS_SCOPE = 'public_repo,user';

const base64UrlEncode = (input: Buffer) =>
  input.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

const base64UrlDecode = (input: string) => {
  const padLength = (4 - (input.length % 4)) % 4;
  const padded = input + '='.repeat(padLength);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
};

const signState = (payload: string, env: Env) =>
  createHmac('sha256', env.GITHUB_APP_CLIENT_SECRET).update(payload).digest('hex');

const createState = (env: Env) => {
  const payload = JSON.stringify({
    nonce: randomBytes(16).toString('hex'),
    exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
  });
  const encoded = base64UrlEncode(Buffer.from(payload));
  return encoded + '.' + signState(encoded, env);
};

const verifyState = (state: string, env: Env) => {
  const parts = state.split('.');
  if (parts.length !== 2) throw new Error('Invalid OAuth state');

  const expected = signState(parts[0], env);
  const supplied = Buffer.from(parts[1], 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');

  if (
    supplied.length !== expectedBuffer.length ||
    !timingSafeEqual(supplied, expectedBuffer)
  ) {
    throw new Error('OAuth state signature mismatch');
  }

  const payload = JSON.parse(base64UrlDecode(parts[0]).toString('utf8')) as { exp?: number };
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('OAuth state expired');
  }
};

const exchangeCode = async (env: Env, code: string, redirectUrl: string) => {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
    },
    body: JSON.stringify({
      client_id: env.GITHUB_APP_CLIENT_ID,
      client_secret: env.GITHUB_APP_CLIENT_SECRET,
      code,
      redirect_uri: redirectUrl,
    }),
  });

  const json = await response.json() as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || 'GitHub token exchange failed');
  }

  return json.access_token;
};

const callbackPage = (status: string, token: string) => {
  const message = 'authorization:github:' + status + ':' + JSON.stringify({ token });
  const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>GoOrganicAfrica CMS</title></head>' +
    '<body><script>' +
    'if(window.opener){window.opener.postMessage(' + JSON.stringify(message) + ',"*");}' +
    'document.body.innerHTML=' + JSON.stringify(
      status === 'success'
        ? '<p>Authentication complete. You can close this window.</p>'
        : '<p>Authentication failed. You can close this window and try again.</p>'
    ) + ';' +
    '</script></body></html>';

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=UTF-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method !== 'GET') {
      return new Response('Method not allowed', {
        status: 405,
        headers: { Allow: 'GET' },
      });
    }

    if (url.pathname === '/auth') {
      if (url.searchParams.get('provider') !== 'github') {
        return new Response('Invalid provider', { status: 400 });
      }

      const redirectUrl = 'https://' + url.hostname + '/callback?provider=github';
      const authorize = new URL(AUTHORIZE_URL);
      authorize.searchParams.set('client_id', env.GITHUB_APP_CLIENT_ID);
      authorize.searchParams.set('redirect_uri', redirectUrl);
      authorize.searchParams.set('state', createState(env));
      authorize.searchParams.set('allow_signup', 'false');
      authorize.searchParams.set('scope', CMS_SCOPE);

      return Response.redirect(authorize.toString(), 302);
    }

    if (url.pathname === '/callback') {
      if (url.searchParams.get('provider') !== 'github') {
        return new Response('Invalid provider', { status: 400 });
      }

      try {
        const state = url.searchParams.get('state');
        if (!state) throw new Error('Missing OAuth state');

        verifyState(state, env);

        const code = url.searchParams.get('code');
        if (!code) throw new Error('Missing OAuth code');

        const redirectUrl = 'https://' + url.hostname + '/callback?provider=github';
        const token = await exchangeCode(env, code, redirectUrl);
        return callbackPage('success', token);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Authentication failed';
        return callbackPage('error', message);
      }
    }

    return new Response('GoOrganicAfrica CMS authentication service is running.', {
      headers: {
        'Content-Type': 'text/plain; charset=UTF-8',
        'Cache-Control': 'no-store',
      },
    });
  },
};
