/// <reference types="vite/client" />
declare module "vue3-dropzone"
interface ReadableStream<R = any> {
  [Symbol.asyncIterator](): AsyncIterableIterator<R>;
}