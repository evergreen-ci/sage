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
 * The SPIFFE identity of Evergreen's service account.
 * Requests from this identity are trusted to provide the X-Evergreen-User-ID header.
 */
const EVERGREEN_SPIFFE_IDENTITY =
  'spiffe://cluster.local/ns/devprod-evergreen/sa/evergreen-sa';

export {
  EVERGREEN_USER_HEADER,
  KANOPY_AUTH_HEADER,
  EVERGREEN_USER_ID_HEADER,
  EVERGREEN_SPIFFE_IDENTITY,
};
