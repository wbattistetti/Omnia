/**
 * Anteprima audio voce condivisa: una sola riproduzione alla volta; Play ↔ Pausa sullo stesso clip.
 */

import React from 'react';
import type { CatalogVoice } from '@services/iaCatalogApi';

interface VoicePreviewContextValue {
  playingVoiceId: string | null;
  togglePreview: (voiceId: string) => void;
}

const VoicePreviewContext = React.createContext<VoicePreviewContextValue | null>(null);

export function VoicePreviewProvider({
  voices,
  children,
}: {
  voices: CatalogVoice[];
  children: React.ReactNode;
}) {
  const [playingVoiceId, setPlayingVoiceId] = React.useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const togglePreview = React.useCallback(
    (voiceId: string) => {
      const v = voices.find((x) => x.voice_id === voiceId);
      const url = v?.preview_url;
      if (!url || typeof Audio === 'undefined') return;

      const current = audioRef.current;
      const isThisPlaying = playingVoiceId === voiceId && current && !current.paused;

      if (isThisPlaying && current) {
        current.pause();
        current.currentTime = 0;
        audioRef.current = null;
        setPlayingVoiceId(null);
        return;
      }

      if (audioRef.current) {
        const prev = audioRef.current;
        prev.pause();
        prev.currentTime = 0;
        audioRef.current = null;
      }

      const a = new Audio(url);
      audioRef.current = a;
      setPlayingVoiceId(voiceId);

      const onEnded = () => {
        setPlayingVoiceId((id) => (id === voiceId ? null : id));
        if (audioRef.current === a) audioRef.current = null;
        a.removeEventListener('ended', onEnded);
      };
      a.addEventListener('ended', onEnded);
      void a.play().catch(() => {
        setPlayingVoiceId((id) => (id === voiceId ? null : id));
        if (audioRef.current === a) audioRef.current = null;
      });
    },
    [voices, playingVoiceId]
  );

  React.useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const value = React.useMemo(
    () => ({ playingVoiceId, togglePreview }),
    [playingVoiceId, togglePreview]
  );

  return (
    <VoicePreviewContext.Provider value={value}>{children}</VoicePreviewContext.Provider>
  );
}

export function useVoicePreview(): VoicePreviewContextValue {
  const ctx = React.useContext(VoicePreviewContext);
  if (!ctx) {
    throw new Error('useVoicePreview deve essere usato dentro VoicePreviewProvider');
  }
  return ctx;
}
