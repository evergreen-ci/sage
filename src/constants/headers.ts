/**
 * This is the header that is sent to evergreen to identify the user.
 */
const EVERGREEN_USER_HEADER = 'x-authenticated-sage-user';
/**
 * This is the authorization header that is used by Kanopy to authenticate the user.
 * This can be read and used to generate a user id for the user.
 */
const KANOPY_AUTH_HEADER = 'x-kanopy-internal-authorization';
/**
 * This header contains the user ID for backend-to-backend calls from Evergreen.
 * Only trusted when the caller is Evergreen's verified service account.
 */
const EVERGREEN_USER_ID_HEADER = 'x-evergreen-user-id';
/**
 * This header contains the SPIFFE identity of the calling service (from Istio/Envoy).
 * Used to verify the caller's identity for service-to-service authentication.
 * Format: By=spiffe://...;Hash=...;Subject=...;URI=spiffe://...
 */
const FORWARDED_CLIENT_CERT_HEADER = 'x-forwarded-client-cert';

export {
  EVERGREEN_USER_HEADER,
  KANOPY_AUTH_HEADER,
  EVERGREEN_USER_ID_HEADER,
  FORWARDED_CLIENT_CERT_HEADER,
};
