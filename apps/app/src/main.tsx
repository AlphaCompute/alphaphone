import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/public-sans/400.css";
import "@fontsource/public-sans/600.css";
import "@fontsource/fraunces/400.css";
import { useDevice } from "./useDevice";
import "./style.css";

function App() {
  const device = useDevice();
  const [now, setNow] = useState(new Date());
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState("");
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 30000);
    const home = () => setExpanded(false);
    window.addEventListener("launcher-home", home);
    return () => {
      clearInterval(tick);
      window.removeEventListener("launcher-home", home);
    };
  }, []);
  const ask = () => {
    setExpanded(true);
    device.setNotice(
      draft.trim()
        ? "Alpha is not connected in this setup build. Your message has not been sent."
        : "Type a message to Alpha.",
    );
  };
  return (
    <main className="phone">
      <header>
        <span className="wordmark">ALPHA COMPUTE</span>
        <button onClick={device.settings} aria-label="Open Android settings">
          Settings
        </button>
      </header>
      <section className="overview" aria-label="Your day">
        <div className="day-card">
          <span>
            {now.toLocaleDateString(undefined, {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </span>
          <h1>
            {now.toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })}
          </h1>
          <p>
            Your day.
            <br />
            Room to focus.
          </p>
        </div>
        <div className="assistant-card">
          <span className="alpha" aria-hidden="true">
            α
          </span>
          <strong>
            Make space
            <br />
            for what matters.
          </strong>
          <p>Assistant setup is still to come.</p>
        </div>
      </section>
      <section className="library" aria-labelledby="apps-title">
        <div className="section-title">
          <h2 id="apps-title">Your apps</h2>
          <span>ON THIS DEVICE</span>
        </div>
        {device.apps.length ? (
          <div className="apps">
            {device.apps.map((app) => (
              <button key={app.packageName} onClick={() => device.launch(app)}>
                <span className="app-icon" aria-hidden="true">
                  {app.label.slice(0, 1)}
                </span>
                <span>{app.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="empty">Installed apps appear here on Android.</p>
        )}
      </section>
      {device.launcher && !device.isHome ? (
        <button className="set-home" onClick={device.makeHome}>
          Use Alpha Phone as your home app
        </button>
      ) : null}
      <p className="build-status">
        {device.isHome ? "Your home app" : "Setup build"} · Powered by elizaOS
      </p>
      <section
        className={"composer " + (expanded ? "expanded" : "")}
        aria-label="Ask Alpha"
      >
        <div className="composer-top">
          <span className="alpha" aria-hidden="true">
            α
          </span>
          <strong>Alpha</strong>
          <button
            aria-label={
              expanded ? "Minimize conversation" : "Expand conversation"
            }
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "−" : "+"}
          </button>
        </div>
        {expanded ? <p>What would you like a hand with?</p> : null}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask();
          }}
        >
          <input
            aria-label="Ask Alpha"
            placeholder="Ask Alpha"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button type="submit">Send</button>
          <button
            type="button"
            onClick={() => {
              setExpanded(true);
              device.setNotice(
                "Voice is not connected in this setup build. You can type instead.",
              );
            }}
          >
            Talk
          </button>
        </form>
        {device.notice ? (
          <p className="notice" role="status">
            {device.notice}
          </p>
        ) : null}
      </section>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
