import { FaFolder, FaComments, FaPhone, FaVideo } from "react-icons/fa";

export default function ActivityBar({ active, setActive }) {
  return (
    <div className="activity-bar">
      <div onClick={() => setActive("explorer")} className={active === "explorer" ? "active" : ""}>
        <FaFolder />
      </div>
      <div onClick={() => setActive("chat")} className={active === "chat" ? "active" : ""}>
        <FaComments />
      </div>
      <div onClick={() => setActive("call")} className={active === "call" ? "active" : ""}>
        <FaPhone />
      </div>
      <div onClick={() => setActive("video")} className={active === "video" ? "active" : ""}>
        <FaVideo />
      </div>
    </div>
  );
}
