import MessageList from "./MessageList";

export default function SendQueueList(props: { revision: number; active: boolean; onChanged: () => void; onCompose: () => void }) {
  return <MessageList status="pending" {...props} />;
}
