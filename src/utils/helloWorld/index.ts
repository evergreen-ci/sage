/**
 * DEVPROD-23394: Prints "hello, world" to the console.
 * @returns The greeting string.
 */
export const helloWorld = (): string => {
  const message = 'hello, world';
  console.log(message);
  return message;
};
