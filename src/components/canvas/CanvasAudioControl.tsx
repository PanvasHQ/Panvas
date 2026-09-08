import React, { useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { canvasRepository } from '@/repositories/CanvasRepository';
import { PageAudioRecordingSession, audioFileExtension, createSupportedMediaRecorder, negotiateRecordingMimeType, recordingErrorMessage } from '@/services/audio/audioLifecycle';
import { createCanvasVoiceNoteBlock, getCanvasVoiceNoteViewportPosition, isActiveCanvasAudioOwner } from '@/services/audio/voiceNoteObjects';
import { generateId } from '@/lib/utils/id';

/** Records directly into an immutable canvas owner and creates the existing
 * persisted custom-block representation when finalization completes. */
export function CanvasAudioControl() {
  const canvasId = useWorkspaceStore(state => state.activeCanvasId);
  const workspaceId = useWorkspaceStore(state => state.activeWorkspaceId);
  const userId = useAuthStore(state => state.user?.id ?? null);
  const showToast = useUIStore(state => state.showToast);
  const [recording, setRecording] = useState(false);
  const session = useRef<PageAudioRecordingSession>();
  const start = async () => {
    if (!canvasId || !workspaceId || session.current) return;
    const owner = { workspaceId, notebookId: canvasId, pageId: canvasId };
    const canvasStateAtStart = useCanvasStore.getState();
    const viewportAtStart = document.getElementById('excalidraw-container')?.getBoundingClientRect();
    const voiceNotePosition = viewportAtStart
      ? getCanvasVoiceNoteViewportPosition(
          { width: viewportAtStart.width, height: viewportAtStart.height },
          canvasStateAtStart.excalidrawAPI?.getAppState?.() ?? {},
        )
      : undefined;
    let stream: MediaStream | undefined;
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new DOMException('', 'NotSupportedError');
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = createSupportedMediaRecorder(stream);
      const selectedMimeType = recorder.mimeType || negotiateRecordingMimeType(type => MediaRecorder.isTypeSupported?.(type) ?? false);
      const value = new PageAudioRecordingSession({ owner, recorder, stream, selectedMimeType, onComplete: async result => {
        const fileName = `canvas-voice-${new Date(result.startedAt).toISOString().replace(/[:.]/g,'-')}.${audioFileExtension(result.mimeType)}`;
        const asset = await canvasRepository.storeAudio(userId, result.owner.pageId, fileName, result.mimeType, await result.blob.arrayBuffer());
        const block = await canvasRepository.addBlock(userId, createCanvasVoiceNoteBlock(result.owner.pageId, asset.id, generateId('audio'), fileName, result.mimeType, result.durationMs, 0, voiceNotePosition));
        if (isActiveCanvasAudioOwner(useWorkspaceStore.getState().activeCanvasId, result.owner)) {
          useCanvasStore.setState(state => ({ customBlocks: [...state.customBlocks, block] }));
        }
      }, onError: error => showToast(recordingErrorMessage(error), 'error') });
      session.current = value; setRecording(true); value.start();
      void value.completion.catch(() => undefined).finally(() => { if (session.current === value) session.current = undefined; setRecording(false); });
    } catch (error) { stream?.getTracks().forEach(track => track.stop()); showToast(recordingErrorMessage(error), 'error'); }
  };
  const stop = () => void session.current?.stop();
  const label = recording ? 'Stop canvas voice note' : 'Record canvas voice note';
  return <button type="button" role="menuitem" className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${recording ? 'bg-panvas-accent-rose text-white' : 'text-panvas-text-secondary hover:bg-panvas-bg-hover hover:text-panvas-text-primary'}`} onClick={recording ? stop : () => void start()} title={label} aria-label={label}>{recording ? <Square size={14} fill="currentColor"/> : <Mic size={16}/>}<span>{label}</span></button>;
}
