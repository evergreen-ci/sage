const PARSLEY_AGENT_NAME = 'parsleyAgent';
/**
 * This is the header that is sent to evergreen to identify the user.
 */
const EVERGREEN_USER_HEADER = 'x-authenticated-sage-user';
/**
 * This is the user id that is used to identify the user in the runtime context.
 * It is used to identify the end user making the request to the downstream API.
 */
const USER_ID = 'userId';
/**
 * This is the authorization header that is used by Kanopy to authenticate the user.
 * This can be read and used to generate a user id for the user.
 */
const KANOPY_AUTH_HEADER = 'x-kanopy-internal-authorization';

export {
  PARSLEY_AGENT_NAME,
  EVERGREEN_USER_HEADER,
  USER_ID,
  KANOPY_AUTH_HEADER,
};
