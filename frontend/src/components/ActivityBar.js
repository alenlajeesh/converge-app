import { FaFolder, FaComments, FaPhone, FaVideo } from "react-icons/fa";

export default function ActivityBar({ active, setActive, sidebarOpen, setSidebarOpen }) {
  const handleClick = (view) => {
    if (view === "explorer") {
      if (active === "explorer") {
        setSidebarOpen((prev) => !prev);
      } else {
        setActive("explorer");
        setSidebarOpen(true);
      }
    } else {
      setActive(view);
      setSidebarOpen(false);
    }
  };

  const items = [
    { view: "explorer", icon: <FaFolder />,   title: "Explorer"    },
    { view: "chat",     icon: <FaComments />, title: "Team Chat"   },
    { view: "call",     icon: <FaPhone />,    title: "Voice Call"  },
    { view: "video",    icon: <FaVideo />,    title: "Video Call"  },
  ];

  return (
    <div className="activity-bar">
      {items.map(({ view, icon, title }) => {
        const isActive    = active === view;
        const isCollapsed = view === "explorer" && isActive && !sidebarOpen;

        return (
          <div
            key={view}
            title={title}
            onClick={() => handleClick(view)}
            className={[
              "activity-bar-item",
              isActive && !isCollapsed ? "active"       : "",
              isCollapsed             ? "active-muted"  : "",
            ].filter(Boolean).join(" ")}
          >
            {icon}
            <span className="activity-bar-tooltip">{title}</span>
          </div>
        );
      })}
    </div>
  );
}
