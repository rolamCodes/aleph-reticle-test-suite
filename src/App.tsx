import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useMutation,
} from "convex/react";
import { SignInButton, UserButton } from "@clerk/react";
import { useEffect, useState } from "react";
import { api } from "../convex/_generated/api";
import Canvas from "./Canvas.tsx";
import HowItWorks from "./HowItWorks.tsx";
import ReticleTestApp from "./test-harness/ReticleTestApp.tsx";
import "./test-harness/reticle-test.css";

function SignedInApp() {
  const bootstrap = useMutation(api.users.bootstrap);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useEffect(() => {
    let active = true;
    void bootstrap({})
      .then(() => {
        if (active) setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [bootstrap]);

  if (status === "loading") {
    return <div className="app-state">Preparing your project…</div>;
  }
  if (status === "error") {
    return <div className="app-state">Unable to prepare your project.</div>;
  }

  return (
    <main className="app-shell">
      <div className="account-control">
        <UserButton />
      </div>
      <HowItWorks />
      <Canvas />
    </main>
  );
}

export default function App() {
  const [showTestHarness, setShowTestHarness] = useState(
    window.location.hash === "#reticle-test",
  );

  useEffect(() => {
    const handleHashChange = () => {
      setShowTestHarness(window.location.hash === "#reticle-test");
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  if (showTestHarness) {
    return (
      <>
        <button
          type="button"
          className="test-harness-toggle-btn"
          style={{ bottom: "16px", left: "auto", right: "16px" }}
          onClick={() => {
            window.location.hash = "";
            setShowTestHarness(false);
          }}
        >
          ← Return to Main Aleph App
        </button>
        <ReticleTestApp />
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        className="test-harness-toggle-btn"
        onClick={() => {
          window.location.hash = "#reticle-test";
          setShowTestHarness(true);
        }}
      >
        🧪 Reticle Test Suite
      </button>

      <AuthLoading>
        <div className="app-state">Loading…</div>
      </AuthLoading>
      <Unauthenticated>
        <div className="sign-in">
          <h1>Aleph</h1>
          <p>Sign in to open your projects.</p>
          <SignInButton mode="modal">
            <button type="button">Continue with Google</button>
          </SignInButton>
        </div>
      </Unauthenticated>
      <Authenticated>
        <SignedInApp />
      </Authenticated>
    </>
  );
}

