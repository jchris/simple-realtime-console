import { useEffect, useRef, useState, useCallback } from 'react';
import { RealtimeClient } from '@openai/realtime-api-beta';
import { ItemType } from '@openai/realtime-api-beta/dist/lib/client.js';

export function useRealtimeClient(apiKey: string) {
  const clientRef = useRef<RealtimeClient>(
    new RealtimeClient({
      apiKey: apiKey,
      dangerouslyAllowAPIKeyInBrowser: true,
    })
  );
  const [isConnected, setIsConnected] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [items, setItems] = useState<ItemType[]>([]);

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
    setCurrentId(null);
  }, []);

  useEffect(() => {
    const client = clientRef.current;
    const handleItemAppended = ({ item }: { item: { id: string; status: string } }) => {
      if (item.status === 'in_progress') {
        setCurrentId(item.id);
      }
    };
    const handleItemCompleted = ({ item }: { item: { id: string; status: string } }) => {
      if (item.status === 'completed') {
        setCurrentId(null);
      }
    };

    client.on('conversation.item.appended', handleItemAppended);
    client.on('conversation.item.completed', handleItemCompleted);

    return () => {
      client.off('conversation.item.appended', handleItemAppended);
      client.off('conversation.item.completed', handleItemCompleted);
    };
  }, []);

  return {
    client: clientRef.current,
    isConnected,
    currentId,
    items,
    connect,
    disconnect,
    setIsConnected,
    setCurrentId,
  };
}
