interface GoogleJwtHeader {
  alg?: string;
  kid?: string;
}

export interface GoogleJwtClaims {
  aud?: string | string[];
  email?: string;
  email_verified?: boolean | string;
  exp?: number;
  iat?: number;
  iss?: string;
  nbf?: number;
  name?: string;
  picture?: string;
  sub?: string;
}

interface GoogleJwk extends JsonWebKey {
  alg?: string;
  kid?: string;
  use?: string;
}

interface GoogleCertificateResponse {
  keys?: GoogleJwk[];
}

function decodeBase64Url(value: string): ArrayBuffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return bytes.buffer as ArrayBuffer;
}

function decodeJsonPart<T>(value: string): T {
  const bytes = decodeBase64Url(value);
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

function isValidClaims(
  claims: GoogleJwtClaims,
  expectedClientId: string,
  nowSeconds: number,
): boolean {
  const audienceMatches = Array.isArray(claims.aud)
    ? claims.aud.includes(expectedClientId)
    : claims.aud === expectedClientId;
  const issuerMatches =
    claims.iss === 'https://accounts.google.com' || claims.iss === 'accounts.google.com';
  const expirationMatches = typeof claims.exp === 'number' && claims.exp > nowSeconds;
  const issuedAtMatches =
    claims.iat === undefined ||
    (typeof claims.iat === 'number' && claims.iat <= nowSeconds + 60);
  const notBeforeMatches =
    claims.nbf === undefined ||
    (typeof claims.nbf === 'number' && claims.nbf <= nowSeconds + 60);
  const emailVerified = claims.email_verified === true || claims.email_verified === 'true';

  return (
    audienceMatches &&
    issuerMatches &&
    expirationMatches &&
    issuedAtMatches &&
    notBeforeMatches &&
    typeof claims.email === 'string' &&
    emailVerified
  );
}

export async function verifyGoogleIdToken(
  token: string,
  expectedClientId: string,
): Promise<GoogleJwtClaims | null> {
  try {
    if (!expectedClientId) {
      return null;
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const header = decodeJsonPart<GoogleJwtHeader>(encodedHeader);
    const claims = decodeJsonPart<GoogleJwtClaims>(encodedPayload);
    if (header.alg !== 'RS256' || !header.kid) {
      return null;
    }

    const certificateResponse = await fetch('https://www.googleapis.com/oauth2/v3/certs', {
      headers: { Accept: 'application/json' },
    });
    if (!certificateResponse.ok) {
      return null;
    }

    const certificateBody = (await certificateResponse.json()) as GoogleCertificateResponse;
    const jwk = certificateBody.keys?.find((key) => key.kid === header.kid);
    if (!jwk) {
      return null;
    }

    const cryptoKey = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const signatureIsValid = await crypto.subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5' },
      cryptoKey,
      decodeBase64Url(encodedSignature),
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
    );

    return signatureIsValid && isValidClaims(claims, expectedClientId, Math.floor(Date.now() / 1000))
      ? claims
      : null;
  } catch {
    return null;
  }
}
