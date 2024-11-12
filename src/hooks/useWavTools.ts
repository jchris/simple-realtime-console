import { useRef } from 'react';
import { WavRecorder, WavStreamPlayer } from '../lib/wavtools/index.js';

export function useWavTools() {
  const wavRecorderRef = useRef<WavRecorder>(
    new WavRecorder({ sampleRate: 24000 })
  );
  const wavStreamPlayerRef = useRef<WavStreamPlayer>(
    new WavStreamPlayer({ sampleRate: 24000 })
  );

  const connectRecorder = async () => {
    await wavRecorderRef.current.begin();
  };

  const startRecording = async (callback: (data: any) => void) => {
    await connectRecorder(); // Ensure the recorder is connected before recording
    await wavRecorderRef.current.record(callback);
  };

  const stopRecording = async () => {
    await wavRecorderRef.current.end();
  };

  const connectPlayer = async () => {
    await wavStreamPlayerRef.current.connect();
  };

  const interruptPlayer = async () => {
    await wavStreamPlayerRef.current.interrupt();
  };

  return {
    wavRecorder: wavRecorderRef.current,
    wavStreamPlayer: wavStreamPlayerRef.current,
    connectRecorder,
    startRecording,
    stopRecording,
    connectPlayer,
    interruptPlayer,
  };
}
