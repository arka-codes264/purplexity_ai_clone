import { createClient } from "@/lib/client";

const supabase = createClient();

async function loginWithGitHub() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: window.location.origin,
    },
  });

  if (error) {
    console.error("OAuth error:", error.message);
    alert("Error signing in with GitHub: " + error.message);
  }
}

export default function Auth() {
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Logo / Brand */}
        <div style={styles.brand}>
          <div style={styles.logoCircle}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="url(#grad)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#a78bfa" />
                  <stop offset="100%" stopColor="#60a5fa" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 style={styles.title}>Purplexity</h1>
        </div>

        <p style={styles.subtitle}>
          Sign in to continue searching smarter.
        </p>

        {/* GitHub Login Button */}
        <button
          id="github-login-btn"
          style={styles.githubBtn}
          onClick={loginWithGitHub}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#2d333b";
            (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              "0 8px 30px rgba(0,0,0,0.4)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#24292f";
            (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              "0 4px 15px rgba(0,0,0,0.3)";
          }}
        >
          {/* GitHub SVG Icon */}
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="white"
            style={{ flexShrink: 0 }}
          >
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
          Continue with GitHub
        </button>

        <p style={styles.terms}>
          By signing in, you agree to our{" "}
          <a href="#" style={styles.link}>Terms</a> and{" "}
          <a href="#" style={styles.link}>Privacy Policy</a>.
        </p>
      </div>

      {/* Background glow orbs */}
      <div style={{ ...styles.orb, ...styles.orb1 }} />
      <div style={{ ...styles.orb, ...styles.orb2 }} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #0d0d1a 0%, #0f0f23 50%, #0d0d1a 100%)",
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    position: "relative",
    overflow: "hidden",
  },
  card: {
    position: "relative",
    zIndex: 10,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "24px",
    padding: "48px 40px",
    width: "100%",
    maxWidth: "400px",
    textAlign: "center",
    backdropFilter: "blur(20px)",
    boxShadow: "0 25px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    marginBottom: "8px",
  },
  logoCircle: {
    width: "48px",
    height: "48px",
    borderRadius: "14px",
    background: "linear-gradient(135deg, rgba(167,139,250,0.15), rgba(96,165,250,0.15))",
    border: "1px solid rgba(167,139,250,0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    margin: 0,
    fontSize: "26px",
    fontWeight: 700,
    background: "linear-gradient(90deg, #a78bfa, #60a5fa)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    letterSpacing: "-0.5px",
  },
  subtitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: "15px",
    margin: "16px 0 32px",
    lineHeight: "1.5",
  },
  githubBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    width: "100%",
    padding: "14px 24px",
    background: "#24292f",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "12px",
    fontSize: "15px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s ease",
    boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
    letterSpacing: "0.2px",
  },
  terms: {
    marginTop: "24px",
    fontSize: "13px",
    color: "rgba(255,255,255,0.3)",
  },
  link: {
    color: "rgba(167,139,250,0.8)",
    textDecoration: "none",
  },
  orb: {
    position: "absolute",
    borderRadius: "50%",
    filter: "blur(80px)",
    pointerEvents: "none",
  },
  orb1: {
    width: "400px",
    height: "400px",
    background: "rgba(139,92,246,0.12)",
    top: "-100px",
    left: "-100px",
  },
  orb2: {
    width: "300px",
    height: "300px",
    background: "rgba(59,130,246,0.1)",
    bottom: "-80px",
    right: "-60px",
  },
};