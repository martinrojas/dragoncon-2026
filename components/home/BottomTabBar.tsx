import type { JSX } from "react";
import { Icon } from "../CyberDragonUi";

interface BottomTabBarProps {
  activeTab: "schedule" | "agenda" | "friends" | "changes" | "profile";
  setActiveTab: (tab: "schedule" | "agenda" | "friends" | "changes" | "profile") => void;
  agendaCount: number;
}

export function BottomTabBar({ activeTab, setActiveTab, agendaCount }: BottomTabBarProps): JSX.Element {
  return (
    <nav className="cd-tabbar">
      <button
        onClick={() => setActiveTab("schedule")}
        className={`cd-tabbar-item ${activeTab === "schedule" ? "active" : ""}`}
      >
        <Icon name="calendar-clock" size={20} />
        <span>Schedule</span>
      </button>

      <button
        onClick={() => setActiveTab("agenda")}
        className={`cd-tabbar-item ${activeTab === "agenda" ? "active" : ""}`}
      >
        <Icon name="bookmark" size={20} />
        <span>Mine</span>
        {agendaCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: 6,
              right: "26%",
              background: "var(--purple-500)",
              color: "#fff",
              fontSize: 9,
              fontWeight: 700,
              borderRadius: "50%",
              width: 15,
              height: 15,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {agendaCount}
          </span>
        )}
      </button>

      <button
        onClick={() => setActiveTab("friends")}
        className={`cd-tabbar-item ${activeTab === "friends" ? "active" : ""}`}
      >
        <Icon name="users" size={20} />
        <span>Squad</span>
      </button>

      <button
        onClick={() => setActiveTab("profile")}
        className={`cd-tabbar-item ${activeTab === "profile" ? "active" : ""}`}
      >
        <Icon name="user" size={20} />
        <span>Profile</span>
      </button>
    </nav>
  );
}
