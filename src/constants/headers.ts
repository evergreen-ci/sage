/**
 * This is the header that is sent to evergreen to identify the user.
 */
const EVERGREEN_USER_HEADER = 'x-authenticated-sage-user';
/**
 * This is the authorization header that is used by Kanopy to authenticate the user.
 * This can be read and used to generate a user id for the user.
 */
const KANOPY_AUTH_HEADER = 'x-kanopy-internal-authorization';

export { EVERGREEN_USER_HEADER, KANOPY_AUTH_HEADER };
