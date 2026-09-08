import { notebookRepository } from '@/repositories/NotebookRepository';
import { PageAudioPersistenceCoordinator } from './pageAudioPersistence';

/** Shared queue for drawing saves and page-audio metadata mutations. */
export const pageAudioPersistence = new PageAudioPersistenceCoordinator(notebookRepository);
