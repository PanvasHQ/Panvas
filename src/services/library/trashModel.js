// Electron's source imports use .js specifiers so that the compiled IPC
// bundle can resolve them. Node's focused TypeScript tests load the source
// directly, therefore this tiny compatibility re-export keeps both paths on
// the same canonical implementation.
export * from './trashModel.ts';
