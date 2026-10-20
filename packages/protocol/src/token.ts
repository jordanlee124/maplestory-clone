// Server-only: account access tokens issued by the API and verified by the game server.
// Import via '@cindervale/protocol/token'; never from browser code.
import { jwtVerify, SignJWT } from 'jose';

const ISSUER = 'cindervale-api';
const AUDIENCE = 'cindervale';

export function signToken(accountId: string, secret: Uint8Array): Promise<string> {
  return new SignJWT()
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(accountId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(secret);
}

/** Returns the account id, or null if the token is invalid or expired. */
export async function verifyToken(token: string, secret: Uint8Array): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
