import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  SetStateAction,
} from 'react';
import { RealtimeClient } from '@openai/realtime-api-beta';
import {
  ItemType,
  ToolDefinitionType,
} from '@openai/realtime-api-beta/dist/lib/client.js';

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
  tools?: [{ schema: ToolDefinitionType; fn: Function }]
) {
  const clientRef = useRef<RealtimeClient>(
    new RealtimeClient({
      apiKey: apiKey,
      dangerouslyAllowAPIKeyInBrowser: true,
    })
  );
  const [isConnected, setIsConnected] = useState(false);
  const [items, setItems] = useState<ItemType[]>([]);

  // basic idempotency wrappers
  const connect = useCallback(async () => {
    const client = clientRef.current;
    if (!client.isConnected()) {
      await client.connect();
    }
    setIsConnected(true);
    setItems(client.conversation.getItems());
  }, []);

  const disconnect = useCallback(async () => {
    const client = clientRef.current;
    if (client.isConnected()) {
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
        if (clientRef.current.isConnected()) {
          clientRef.current.appendInputAudio(data.mono);
        }
      });
    } catch (error) {
      console.error('Connection error:', error);
    }
  }, [connect, setItems]);

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

    clientRef.current.on('error', (error: Error) => {
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

    clientRef.current.on('audio', (audio: { audio: Uint8Array }) => {
      wavStreamPlayerRef.current.add16BitPCM(audio.audio);
    });

    clientRef.current.on(
      'conversation.updated',
      async ({
        item,
        delta,
      }: {
        item: {
          id: string;
          status: string;
          formatted: {
            audio?: Uint8Array;
            file?: { url: string };
          };
        };
        delta?: { audio?: Uint8Array };
      }) => {
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
      }
    );

    clientRef.current.on('conversation.interrupted', async () => {
      const trackSampleOffset = await wavStreamPlayerRef.current.interrupt();
      if (trackSampleOffset?.trackId) {
        const { trackId, offset } = trackSampleOffset;
        await clientRef.current.cancelResponse(trackId, offset);
      }
    });

    // we omitted "proper" cleanup code bc not needed for simple demo but remember to add in real life to prevent mem leak. hot reloading here will also cause multiple injections
    return () => void clientRef.current.removeTool('set_memory'); // remember to add back other cleanup code as needed eg client.off('error');
  }, []); // Empty dependency array since we want this to run only once

  return {
    client: clientRef.current,
    isConnected,
    items,
    connectConversation,
    disconnectConversation,
  };
}
