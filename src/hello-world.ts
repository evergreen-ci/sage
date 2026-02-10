/**
 * Returns the "hello, world" greeting message.
 * Implemented for DEVPROD-23394.
 * @returns The "hello, world" string.
 */
export const helloWorld = (): string => {
  const message = 'hello, world';
  console.log(message);
  return message;
};
