import { useEffect, useRef, useCallback, useState } from 'react';

import { RealtimeClient } from '@openai/realtime-api-beta';
import { ItemType } from '@openai/realtime-api-beta/dist/lib/client.js';
import { WavRecorder, WavStreamPlayer } from '../lib/wavtools/index.js';
import { instructions } from '../utils/conversation_config.js';
import { WavRenderer } from '../utils/wav_renderer';

import { Button } from '../components/button/Button';

/**
 * Type for all event logs
 */
interface RealtimeEvent {
  time: string;
  source: 'client' | 'server';
  count?: number;
  event: {
    event_id?: string;
    type?: string;
    [key: string]: any;
  };
}

export function ConsolePage() {
  const apiKey =
    localStorage.getItem('tmp::voice_api_key') ||
    prompt('OpenAI API Key') ||
    '';
  if (apiKey !== '') {
    localStorage.setItem('tmp::voice_api_key', apiKey);
  }

  const wavRecorderRef = useRef<WavRecorder>(
    new WavRecorder({ sampleRate: 24000 })
  );
  const wavStreamPlayerRef = useRef<WavStreamPlayer>(
    new WavStreamPlayer({ sampleRate: 24000 })
  );
  const clientRef = useRef<RealtimeClient>(
    new RealtimeClient({
      apiKey: apiKey,
      dangerouslyAllowAPIKeyInBrowser: true,
    })
  );

  const clientCanvasRef = useRef<HTMLCanvasElement>(null);
  const serverCanvasRef = useRef<HTMLCanvasElement>(null);
  const eventsScrollHeightRef = useRef(0);
  const eventsScrollRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<string>(new Date().toISOString());

  const [items, setItems] = useState<ItemType[]>([]);
  const [realtimeEvents, setRealtimeEvents] = useState<RealtimeEvent[]>([]);
  const [expandedEvents, setExpandedEvents] = useState<{
    [key: string]: boolean;
  }>({});
  const [isConnected, setIsConnected] = useState(false);
  const [memoryKv, setMemoryKv] = useState<{ [key: string]: any }>({
    userName: 'swyx',
    todaysDate: new Date().toISOString().split('T')[0],
  });
  const [currentId, setCurrentId] = useState<string | null>(null);

  const formatTime = useCallback((timestamp: string) => {
    const startTime = startTimeRef.current;
    const t0 = new Date(startTime).valueOf();
    const t1 = new Date(timestamp).valueOf();
    const delta = t1 - t0;
    const hs = Math.floor(delta / 10) % 100;
    const s = Math.floor(delta / 1000) % 60;
    const m = Math.floor(delta / 60_000) % 60;
    const pad = (n: number) => {
      let s = n + '';
      while (s.length < 2) {
        s = '0' + s;
      }
      return s;
    };
    return `${pad(m)}:${pad(s)}.${pad(hs)}`;
  }, []);

  const resetAPIKey = useCallback(() => {
    const apiKey = prompt('OpenAI API Key');
    if (apiKey !== null) {
      localStorage.clear();
      localStorage.setItem('tmp::voice_api_key', apiKey);
      window.location.reload();
    }
  }, []);

  const connectConversation = useCallback(async () => {
    try {
      const client = clientRef.current;
      const wavRecorder = wavRecorderRef.current;
      const wavStreamPlayer = wavStreamPlayerRef.current;

      startTimeRef.current = new Date().toISOString();

      if (!client.isConnected()) {
        await client.connect();
      }

      // Only proceed with other setup if connection successful
      setIsConnected(true);
      setRealtimeEvents([]);
      setItems(client.conversation.getItems());

      await wavRecorder.begin();
      await wavStreamPlayer.connect();

      client.sendUserMessageContent([
        {
          type: `input_text`,
          text: `Hello!`,
        },
      ]);

      // Configure VAD to be less sensitive
      client.updateSession({
        turn_detection: {
          type: 'server_vad',
          // config: {
          //   min_speech_duration: 0.5,  // Increase minimum speech duration
          //   speech_pad_ms: 500,        // Add more padding after speech
          //   min_silence_duration: 1.0,  // Wait longer for silence before cutting off
          // }
        },
      });

      await wavRecorder.record((data) => {
        if (client.isConnected()) {
          client.appendInputAudio(data.mono);
        }
      });
    } catch (error) {
      console.error('Connection error:', error);
      setIsConnected(false);
    }
  }, []);

  const disconnectConversation = useCallback(async () => {
    try {
      const client = clientRef.current;
      const wavRecorder = wavRecorderRef.current;
      const wavStreamPlayer = wavStreamPlayerRef.current;

      // Stop recording first
      await wavRecorder.end();
      await wavStreamPlayer.interrupt();

      // // Then clean up client
      // if (client.isConnected()) {
      //   await client.disconnect();
      // }

      // Finally update state
      setIsConnected(false);
      // setRealtimeEvents([]);
      // setItems([]);
      // setMemoryKv({});
    } catch (error) {
      console.error('Disconnection error:', error);
      // Force state reset even if there's an error
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    if (eventsScrollRef.current) {
      const eventsEl = eventsScrollRef.current;
      const scrollHeight = eventsEl.scrollHeight;
      if (scrollHeight !== eventsScrollHeightRef.current) {
        eventsEl.scrollTop = scrollHeight;
        eventsScrollHeightRef.current = scrollHeight;
      }
    }
  }, [realtimeEvents]);

  useEffect(() => {
    const conversationEls = [].slice.call(
      document.body.querySelectorAll('[data-conversation-content]')
    );
    for (const el of conversationEls) {
      const conversationEl = el as HTMLDivElement;
      conversationEl.scrollTop = conversationEl.scrollHeight;
    }
  }, [items]);

  useEffect(() => {
    let isLoaded = true;

    const wavRecorder = wavRecorderRef.current;
    const clientCanvas = clientCanvasRef.current;
    let clientCtx: CanvasRenderingContext2D | null = null;

    const wavStreamPlayer = wavStreamPlayerRef.current;
    const serverCanvas = serverCanvasRef.current;
    let serverCtx: CanvasRenderingContext2D | null = null;

    const render = () => {
      if (isLoaded) {
        if (clientCanvas) {
          if (!clientCanvas.width || !clientCanvas.height) {
            clientCanvas.width = clientCanvas.offsetWidth;
            clientCanvas.height = clientCanvas.offsetHeight;
          }
          clientCtx = clientCtx || clientCanvas.getContext('2d');
          if (clientCtx) {
            clientCtx.clearRect(0, 0, clientCanvas.width, clientCanvas.height);
            const result = wavRecorder.recording
              ? wavRecorder.getFrequencies('voice')
              : { values: new Float32Array([0]) };
            WavRenderer.drawBars(
              clientCanvas,
              clientCtx,
              result.values,
              '#0099ff',
              10,
              0,
              8
            );
          }
        }
        if (serverCanvas) {
          if (!serverCanvas.width || !serverCanvas.height) {
            serverCanvas.width = serverCanvas.offsetWidth;
            serverCanvas.height = serverCanvas.offsetHeight;
          }
          serverCtx = serverCtx || serverCanvas.getContext('2d');
          if (serverCtx) {
            serverCtx.clearRect(0, 0, serverCanvas.width, serverCanvas.height);
            const result = wavStreamPlayer.analyser
              ? wavStreamPlayer.getFrequencies('voice')
              : { values: new Float32Array([0]) };
            WavRenderer.drawBars(
              serverCanvas,
              serverCtx,
              result.values,
              '#009900',
              10,
              0,
              8
            );
          }
        }
        window.requestAnimationFrame(render);
      }
    };
    render();

    return () => {
      isLoaded = false;
    };
  }, []);

  useEffect(() => {
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const client = clientRef.current;

    client.updateSession({
      instructions:
        instructions + ' Memory: ' + JSON.stringify(memoryKv, null, 2),
    });
    client.updateSession({ input_audio_transcription: { model: 'whisper-1' } });

    client.addTool(
      {
        name: 'set_memory',
        description: 'Saves important data about the user into memory.',
        parameters: {
          type: 'object',
          properties: {
            key: {
              type: 'string',
              description:
                'The key of the memory value. Always use lowercase and underscores, no other characters.',
            },
            value: {
              type: 'string',
              description: 'Value can be anything represented as a string',
            },
          },
          required: ['key', 'value'],
        },
      },
      async ({ key, value }: { key: string; value: string }) => {
        setMemoryKv((prev) => ({ ...prev, [key]: value }));
      }
    );

    client.on('error', (error: Error) => {
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

    client.on('realtime.event', (event: any) => {
      if (
        event.source === 'server' &&
        [
          'conversation.item.input_audio_transcription.completed',
          'response.audio_transcript.done',
          'response.cancel',
        ].includes(event.event.type)
      ) {
        // no op - we want to show these server events
      } else {
        console.log('suppressed event1 ', event.event.type, event);
        return;
      }
      if (
        event.source === 'client' &&
        event.event.type === 'input_audio_buffer.append' // DO NOT show these events as they tend to just be super noisy
      ) {
        console.log('suppressed event2 ', event.event.type, event);
        return;
      }
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

    client.on('connected', () => {
      setRealtimeEvents((prev) => [
        ...prev,
        {
          time: new Date().toISOString(),
          source: 'client',
          event: { type: 'connected' },
        },
      ]);
    });

    client.on('disconnected', () => {
      setRealtimeEvents((prev) => [
        ...prev,
        {
          time: new Date().toISOString(),
          source: 'client',
          event: { type: 'disconnected' },
        },
      ]);
    });

    client.on('message', (message: { role: string; [key: string]: any }) => {
      setRealtimeEvents((prev) => [
        ...prev,
        {
          time: new Date().toISOString(),
          source: message.role === 'assistant' ? 'server' : 'client',
          event: message,
        },
      ]);
    });

    client.on('audio', (audio: { audio: Uint8Array }) => {
      wavStreamPlayer.add16BitPCM(audio.audio);
    });

    client.on(
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
        const items = client.conversation.getItems();
        if (delta?.audio) {
          wavStreamPlayer.add16BitPCM(delta.audio, item.id);
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

    client.on('conversation.interrupted', async () => {
      const trackSampleOffset = await wavStreamPlayer.interrupt();
      if (trackSampleOffset?.trackId) {
        const { trackId, offset } = trackSampleOffset;
        await client.cancelResponse(trackId, offset);
      }
    });

    client.on(
      'conversation.item.appended',
      ({ item }: { item: { id: string; status: string } }) => {
        if (item.status === 'in_progress') {
          setCurrentId(item.id);
        }
      }
    );

    client.on(
      'conversation.item.completed',
      ({ item }: { item: { id: string; status: string } }) => {
        if (item.status === 'completed') {
          setCurrentId(null);
        }
      }
    );

    return () => {
      client.off('error');
      client.off('realtime.event');
      client.off('connected');
      client.off('disconnected');
      client.off('message');
      client.off('audio');
      client.off('conversation.updated');
      client.off('conversation.interrupted');
      client.off('conversation.item.appended');
      client.off('conversation.item.completed');

      try {
        client.removeTool('set_memory');
      } catch (e) {
        console.debug('Tool removal failed:', e);
      }
    };
  }, []); // Empty dependency array since we want this to run only once

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-none p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            onClick={isConnected ? disconnectConversation : connectConversation}
            disabled={!apiKey}
            className={`px-4 py-2 rounded-md ${
              isConnected
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {isConnected ? 'Disconnect' : 'Connect'}
          </Button>
          {isConnected && (
            <span className="flex">
              <Button
                onClick={() => clientRef.current.createResponse()}
                buttonStyle="action"
              >
                Create Response
              </Button>
              <Button
                onClick={() =>
                  clientRef.current.cancelResponse(currentId || '')
                }
                buttonStyle="alert"
                disabled={!currentId}
              >
                Cancel Response
              </Button>
            </span>
          )}
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={resetAPIKey}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            {apiKey.slice(0, 4)}...{apiKey.slice(-4)}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="h-full flex flex-col md:flex-row">
          <div className="flex-1 border-r border-gray-200 overflow-auto">
            <div className="p-4">
              <div className="mb-4">
                <canvas
                  ref={clientCanvasRef}
                  className="w-full h-12 bg-gray-50 rounded"
                />
              </div>
              <div className="mb-4">
                <canvas
                  ref={serverCanvasRef}
                  className="w-full h-12 bg-gray-50 rounded"
                />
              </div>
            </div>
          </div>

          <div className="w-full md:w-96 overflow-auto">
            <div className="p-4">
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700">Memory</h3>
                <pre className="mt-2 text-xs text-wrap">
                  {JSON.stringify(memoryKv, null, 2)}
                </pre>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700">
                  Filtered Events ({realtimeEvents.length})
                </h3>
                <div
                  ref={eventsScrollRef}
                  className="mt-2 space-y-2 h-96 overflow-auto"
                >
                  {realtimeEvents.map((event, i) => (
                    <div
                      key={i}
                      className={`text-xs p-2 rounded ${
                        event.source === 'server' ? 'bg-green-50' : 'bg-blue-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono">
                          {formatTime(event.time)}
                        </span>
                        <button
                          onClick={() =>
                            setExpandedEvents((prev) => ({
                              ...prev,
                              [i]: !prev[i],
                            }))
                          }
                          className="text-gray-500 hover:text-gray-700"
                        >
                          {expandedEvents[i] ? '▼' : '▶'}
                        </button>
                      </div>
                      <div className="text-xs text-gray-600">
                        {(event.event.event.transcript &&
                          '"' + event.event.event.transcript + '"') || (
                            <span className="font-mono">
                              {event.event.event.type}
                            </span>
                          ) ||
                          console.log(event.event) ||
                          JSON.stringify(event.event)}
                      </div>
                      {expandedEvents[i] && (
                        <pre className="mt-2 whitespace-pre-wrap overflow-auto max-h-40">
                          {JSON.stringify(event.event, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
