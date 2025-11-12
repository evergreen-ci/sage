// Re-export from utils for backward compatibility
export {
  getK8sSecret,
  withK8sSecret,
  type SecretData,
  type SecretMiddlewareConfig,
} from '@/mastra/utils/kubernetes';
export { getK8sClient, getNamespace } from '@/mastra/utils/kubernetes';
