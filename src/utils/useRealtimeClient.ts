import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import {
  FormattedItem,
  Realtime,
  RealtimeClient,
  ToolHandler,
} from 'openai-realtime-api';
import { WavRecorder } from 'wavtools';

/**
 * Type for all event logs
 */
export interface RealtimeEvent {
  time: string;
  source: 'client' | 'server';
  count?: number;
  event: {
    event_id?: string;
    type?: string;
    [key: string]: any;
  };
}
export function useRealtimeClient(
  apiKey: string,
  startTimeRef: any,
  setRealtimeEvents: React.Dispatch<React.SetStateAction<RealtimeEvent[]>>,
  wavStreamPlayerRef: any,
  wavRecorderRef: any,
  initialInstructions: string,
  tools?: [{ schema: Realtime.PartialToolDefinition; fn: ToolHandler }]
) {
  const clientRef = useRef<RealtimeClient>(
    new RealtimeClient({
      apiKey: apiKey,
      dangerouslyAllowAPIKeyInBrowser: true,
    })
  );
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [items, setItems] = useState<FormattedItem[]>([]);

  // basic idempotency wrappers
  const connect = useCallback(async () => {
    const client = clientRef.current;
    if (!client.isConnected) {
      await client.connect();
    }
    setIsConnected(true);
    setItems(client.conversation.getItems());
  }, []);

  const disconnect = useCallback(async () => {
    const client = clientRef.current;
    if (client.isConnected) {
      await client.disconnect();
    }
    setIsConnected(false);
    setItems([]);
  }, []);

  // tie into the  messaging layer
  const connectConversation = useCallback(async () => {
    try {
      startTimeRef.current = new Date().toISOString();

      await connect();

      // Only proceed with other setup if connection successful
      setRealtimeEvents([]);
      setItems(clientRef.current.conversation.getItems());

      await wavStreamPlayerRef.current.connect();

      clientRef.current.sendUserMessageContent([
        {
          type: `input_text`,
          text: `Hello!`,
        },
      ]);

      clientRef.current.updateSession({
        turn_detection: {
          type: 'server_vad',
        },
      });

      await wavRecorderRef.current.begin(); // Ensure the recorder is connected before recording
      await wavRecorderRef.current.record((data: any) => {
        if (clientRef.current.isConnected && !isMuted) {
          clientRef.current.appendInputAudio(data.mono);
        }
      });
    } catch (error) {
      console.error('Connection error:', error);
    }
  }, [connect, setItems, isMuted]);

  const disconnectConversation = useCallback(async () => {
    try {
      await wavRecorderRef.current.end();
      await wavStreamPlayerRef.current.interrupt();
      await disconnect();
      setIsConnected(false);
    } catch (error) {
      console.error('Disconnection error:', error);
      setIsConnected(false);
    }
  }, [disconnect]);

  // SIGNIFICANT LOGIC LAYER!

  useEffect(() => {
    clientRef.current.updateSession({
      instructions: initialInstructions,
    });
    clientRef.current.updateSession({
      input_audio_transcription: { model: 'whisper-1' },
    });

    tools?.forEach((obj) => clientRef.current.addTool(obj.schema, obj.fn));

    clientRef.current.on('error', (error: any) => {
      // should be Error
      console.error(error);
      setRealtimeEvents((prev) => [
        ...prev,
        {
          time: new Date().toISOString(),
          source: 'client',
          event: { type: 'error', error: error.message },
        },
      ]);
    });

    clientRef.current.on('realtime.event', (event: any) => {
      if (event.source === 'server') {
        if (
          [
            'conversation.item.input_audio_transcription.completed',
            'response.audio_transcript.done',
            'response.cancel',
            'response.function_call_arguments.done',
          ].includes(event.event.type)
        ) {
          // no op - we want to show these server events
        } else {
          console.log('suppressed event1 ', event.event.type, event);
          return;
        }
      }

      if (
        event.source === 'client' &&
        event.event.type === 'input_audio_buffer.append' // DO NOT show these events as they tend to just be super noisy
      ) {
        // console.log('suppressed event2 ', event.event.type, event); // its so noisy that i'm just gonna REALLY suppress this
        return;
      }

      // hacky final adjustment
      if (
        event.event.type ===
        'conversation.item.input_audio_transcription.completed'
      ) {
        // this is the user's voice transcript
        event.source = 'client'; // force it to render as client even tho its technically not
      }
      setRealtimeEvents((prev) => [
        ...prev,
        {
          time: new Date().toISOString(),
          source: event.source || 'client',
          event: event,
        },
      ]);
    });

    clientRef.current.on('conversation.updated', async ({ item, delta }) => {
      const items = clientRef.current.conversation.getItems();
      if (delta?.audio) {
        wavStreamPlayerRef.current.add16BitPCM(delta.audio, item.id);
      }
      if (item.status === 'completed' && item.formatted.audio?.length) {
        const wavFile = await WavRecorder.decode(
          item.formatted.audio,
          24000,
          24000
        );
        item.formatted.file = wavFile;
      }
      setItems(items);
    });

    clientRef.current.on('conversation.interrupted', async () => {
      const trackSampleOffset = await wavStreamPlayerRef.current.interrupt();
      if (trackSampleOffset?.trackId) {
        const { trackId, offset } = trackSampleOffset;
        await clientRef.current.cancelResponse(trackId, offset);
      }
    });

    // Cleanup function to remove all event listeners and tools when component unmounts
    return () => {
      // Remove all tools
      tools?.forEach((obj) => clientRef.current.removeTool(obj.schema.name));
      
      // Remove all event listeners
      clientRef.current.off('error');
      clientRef.current.off('realtime.event');
      clientRef.current.off('conversation.updated');
      clientRef.current.off('conversation.interrupted');
    };
  }, []); // Empty dependency array since we want this to run only once

  // Create a memoized setMuted function that handles the recorder state
  const setMuted = useCallback(async (muted: boolean) => {
    setIsMuted(muted);
    if (muted) {
      await wavRecorderRef.current.end();
    } else {
      await wavRecorderRef.current.begin();
      await wavRecorderRef.current.record((data: any) => {
        if (clientRef.current.isConnected && !muted) {
          clientRef.current.appendInputAudio(data.mono);
        }
      });
    }
  }, []);

  return {
    client: clientRef.current,
    isConnected,
    isMuted,
    setIsMuted: setMuted,
    items,
    connectConversation,
    disconnectConversation,
  };
}
