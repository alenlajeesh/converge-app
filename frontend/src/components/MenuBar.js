import "../styles/menubar.css";

const MENU_ITEMS = ["File", "Edit", "Selection", "View", "Go", "Run", "Terminal", "Help"];

function MenuBar() {
  return (
    <div className="menubar">
      <div className="menubar-left">
        {MENU_ITEMS.map((item) => (
          <span key={item} className="menubar-item">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

export default MenuBar;