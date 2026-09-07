import type { ActiveTab } from "@/types";

export default function Navbar({ activeTab, setActiveTab, pendingCount }: {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  pendingCount: number;
}) {
  return <nav aria-label="Workspace" className="mb-8 flex flex-wrap gap-1 border-b border-stone-200">
    <button type="button" onClick={() => setActiveTab("add")} aria-current={activeTab === "add" ? "page" : undefined} className={`nav-tab ${activeTab === "add" ? "active" : ""}`}>
      <span className="mr-2 text-lg" aria-hidden="true">＋</span> Add Message
    </button>
    <button type="button" onClick={() => setActiveTab("queue")} aria-current={activeTab === "queue" ? "page" : undefined} className={`nav-tab ${activeTab === "queue" ? "active" : ""}`}>
      Send Queue <span className="ml-2 rounded-md bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">{pendingCount}</span>
    </button>
    <button type="button" onClick={() => setActiveTab("history")} aria-current={activeTab === "history" ? "page" : undefined} className={`nav-tab ${activeTab === "history" ? "active" : ""}`}>History</button>
  </nav>;
}
