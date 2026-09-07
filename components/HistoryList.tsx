import MessageList from "./MessageList";

export default function HistoryList(props: { revision: number; active: boolean; onChanged: () => void }) {
  return <MessageList status="sent" {...props} />;
}
