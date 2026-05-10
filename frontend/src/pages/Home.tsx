import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { createClient } from "@/lib/client";
import type { User } from "@supabase/supabase-js";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BACKEND_URL } from "@/lib/config";
import {
  Search,
  Plus,
  Monitor,
  Layers,
  Compass,
  Clock,
  Settings,
  Bell,
  ChevronDown,
  Mic,
  ArrowRight,
  Zap,
  Globe,
  BookOpen,
  TrendingUp,
  Briefcase,
  LogOut,
  User as UserIcon,
} from "lucide-react";

const supabase = createClient();

const SUGGESTIONS = [
  "Organize my life",
  "Recruiting strategies",
  "Build a business plan",
  "Monitor the situation",
];

const PROMPTS = [
  "Create a budget tracker from my spending",
  "Plan a trip with full itinerary and bookings",
  "Redesign my schedule around priorities",
];

const NAV_TOPICS = [
  { label: "Discover", icon: <Compass size={14} /> },
  { label: "Finance", icon: <TrendingUp size={14} /> },
  { label: "Health", icon: <Zap size={14} /> },
  { label: "Academic", icon: <BookOpen size={14} /> },
  { label: "Patents", icon: <Briefcase size={14} /> },
];

export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [query, setQuery] = useState("");
  const [sidebarOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<{ role: string, content: string, sources?: any[], followUps?: string[] }[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser(data.user);
    });
  }, []);

  // Close menu on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null);
    navigate("/auth");
  }

  async function handleSearch(e: React.FormEvent, followupQuery?: string) {
    if (e && e.preventDefault) e.preventDefault();
    
    const prompt = followupQuery || query.trim();
    if (!prompt || isStreaming) return;
    
    setMessages(prev => [...prev, { role: "User", content: prompt }]);
    setQuery("");
    setIsStreaming(true);

    const { data: { session } } = await supabase.auth.getSession();
    const jwt = session?.access_token;
    
    try {
      const endpoint = conversationId ? "/perplexity_follow_up" : "/perplexity_ask";
      const body = conversationId ? { conversationId, query: prompt } : { query: prompt };
      
      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": jwt || "",
        },
        body: JSON.stringify(body)
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      
      setMessages(prev => [...prev, { role: "Assistant", content: "" }]);
      
      let answerText = "";
      let sourcesRaw = "";
      let convIdRaw = "";
      let followUpsRaw = "";
      let isParsingSources = false;
      let isParsingConvId = false;
      let isParsingFollowUps = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        
        if (chunk.includes("<CONVERSATION_ID>")) {
           isParsingConvId = true;
           isParsingSources = false;
           isParsingFollowUps = false;
           const parts = chunk.split("<CONVERSATION_ID>");
           // Depending on order, the previous part could be sources or answer
           if (isParsingSources) sourcesRaw += parts[0] || "";
           else if (isParsingFollowUps) followUpsRaw += parts[0] || "";
           else answerText += parts[0] || "";
           convIdRaw += parts[1] || "";
        } else if (chunk.includes("</CONVERSATION_ID>")) {
           const parts = chunk.split("</CONVERSATION_ID>");
           convIdRaw += parts[0] || "";
           isParsingConvId = false;
        } else if (chunk.includes("<FOLLOW_UPS>")) {
           isParsingFollowUps = true;
           isParsingSources = false;
           isParsingConvId = false;
           const parts = chunk.split("<FOLLOW_UPS>");
           if (isParsingSources) sourcesRaw += parts[0] || "";
           else if (isParsingConvId) convIdRaw += parts[0] || "";
           else answerText += parts[0] || "";
           followUpsRaw += parts[1] || "";
        } else if (chunk.includes("</FOLLOW_UPS>")) {
           const parts = chunk.split("</FOLLOW_UPS>");
           followUpsRaw += parts[0] || "";
           isParsingFollowUps = false;
        } else if (chunk.includes("<SOURCES>")) {
           isParsingSources = true;
           isParsingConvId = false;
           isParsingFollowUps = false;
           const parts = chunk.split("<SOURCES>");
           answerText += parts[0] || "";
           sourcesRaw += parts[1] || "";
        } else if (chunk.includes("</SOURCES>")) {
           const parts = chunk.split("</SOURCES>");
           sourcesRaw += parts[0] || "";
           isParsingSources = false;
        } else {
           if (isParsingConvId) {
             convIdRaw += chunk;
           } else if (isParsingSources) {
             sourcesRaw += chunk;
           } else if (isParsingFollowUps) {
             followUpsRaw += chunk;
           } else {
             answerText += chunk;
           }
        }
        
        answerText = answerText.replace("-------sources---------", "").replace("\n-------sources---------\n", "");

        setMessages(prev => {
           const newMessages = [...prev];
           const lastMsg = newMessages[newMessages.length - 1] as any;
           if (lastMsg) {
             lastMsg.content = answerText;
             if (sourcesRaw) {
                try {
                   lastMsg.sources = JSON.parse(sourcesRaw.trim());
                } catch (e) {}
             }
             if (followUpsRaw) {
                try {
                   lastMsg.followUps = JSON.parse(followUpsRaw.trim());
                } catch (e) {}
             }
           }
           return newMessages;
        });

        if (convIdRaw.trim() && !conversationId) {
           setConversationId(convIdRaw.trim());
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSearch(e as unknown as React.FormEvent);
    }
  }

  const avatar =
    user?.user_metadata?.avatar_url ||
    `https://api.dicebear.com/7.x/initials/svg?seed=${user?.email ?? "U"}`;

  return (
    <div style={s.root}>
      {/* ── Sidebar ── */}
      {sidebarOpen && (
        <aside style={s.sidebar}>
          {/* Logo */}
          <div style={s.sidebarLogo}>
            <div style={s.logoMark}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                  stroke="url(#sg)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <defs>
                  <linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#a78bfa" />
                    <stop offset="100%" stopColor="#60a5fa" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>

          {/* New Thread */}
          <button
            id="new-thread-btn"
            style={s.newBtn}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.background =
                "rgba(255,255,255,0.08)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.background =
                "rgba(255,255,255,0.04)")
            }
            onClick={() => setQuery("")}
          >
            <Plus size={16} />
            <span>New</span>
          </button>

          {/* Nav Items */}
          <nav style={s.nav}>
            {[
              { icon: <Monitor size={16} />, label: "Computer", id: "nav-computer" },
              { icon: <Layers size={16} />, label: "Spaces", id: "nav-spaces" },
              { icon: <Globe size={16} />, label: "Artifacts", id: "nav-artifacts" },
              { icon: <Settings size={16} />, label: "Customize", id: "nav-customize" },
              { icon: <Clock size={16} />, label: "History", id: "nav-history" },
            ].map(({ icon, label, id }) => (
              <button
                key={id}
                id={id}
                style={s.navItem}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.background =
                    "rgba(255,255,255,0.06)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.background = "transparent")
                }
              >
                <span style={s.navIcon}>{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </nav>

          {/* Recent */}
          <div style={s.recentSection}>
            {[
              "Can you find me all the reso...",
              "Okay, I want to build an AI s...",
              "Hello... 안녕... Bufer.... Lek.",
              "https://razorpay.com/m/fix-...",
            ].map((item, i) => (
              <button
                key={i}
                style={s.recentItem}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.background =
                    "rgba(255,255,255,0.05)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.background = "transparent")
                }
              >
                {item}
              </button>
            ))}
          </div>

          {/* Footer */}
          <div style={s.sidebarFooter}>
            <button id="upgrade-btn" style={s.upgradeBtn}>
              <Zap size={13} />
              <span>Upgrade plan</span>
              <span style={s.upgradeDot} />
            </button>

            {/* User Avatar / Menu */}
            <div style={{ position: "relative" }} ref={menuRef}>
              <button
                id="user-avatar-btn"
                style={s.avatarBtn}
                onClick={() => setUserMenuOpen((v) => !v)}
              >
                <img src={avatar} alt="avatar" style={s.avatarImg} />
                <span style={s.avatarName}>
                  {user?.user_metadata?.name ?? user?.email?.split("@")[0] ?? "User"}
                </span>
              </button>

              {userMenuOpen && (
                <div style={s.userMenu}>
                  <div style={s.userMenuHeader}>
                    <img src={avatar} alt="avatar" style={{ ...s.avatarImg, width: 32, height: 32 }} />
                    <div>
                      <div style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>
                        {user?.user_metadata?.name ?? "User"}
                      </div>
                      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>
                        {user?.email}
                      </div>
                    </div>
                  </div>
                  <hr style={s.menuDivider} />
                  <button id="profile-btn" style={s.menuItem}>
                    <UserIcon size={14} /> Profile
                  </button>
                  <button
                    id="signout-btn"
                    style={{ ...s.menuItem, color: "#f87171" }}
                    onClick={handleSignOut}
                  >
                    <LogOut size={14} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>
      )}

      {/* ── Main ── */}
      <main style={s.main}>
        {/* Top Nav */}
        <header style={s.header}>
          <button id="get-pro-btn" style={s.proBadge}>
            Get Pro
          </button>

          <div style={s.topNav}>
            {NAV_TOPICS.map(({ label }) => (
              <button
                key={label}
                style={s.topNavItem}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.color = "#fff")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.color =
                    "rgba(255,255,255,0.55)")
                }
              >
                {label}
              </button>
            ))}
          </div>

          <div style={s.headerRight}>
            <button id="scheduled-btn" style={s.scheduledBtn}>
              <Clock size={14} />
              <span>Scheduled</span>
              <ChevronDown size={13} />
            </button>
            <button id="bell-btn" style={s.iconBtn}>
              <Bell size={17} />
            </button>
          </div>
        </header>

        {messages.length === 0 ? (
          <section style={s.hero}>
            {/* Background orbs */}
            <div style={s.orb1} />
            <div style={s.orb2} />
            <div style={s.orb3} />

            <h1 style={s.heroTitle}>purplexity</h1>

            {/* Search Box */}
            <form onSubmit={handleSearch} style={s.searchBox}>
              <textarea
                ref={inputRef}
                id="main-search-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything..."
                style={s.searchInput}
                rows={1}
              />

              <div style={s.searchActions}>
                <div style={s.searchLeft}>
                  <button type="button" style={s.actionChip} id="attach-btn">
                    <Plus size={14} />
                  </button>
                  <button type="button" style={s.actionChip} id="search-mode-btn">
                    <Search size={13} />
                    <span>Search</span>
                    <ChevronDown size={12} />
                  </button>
                  <button type="button" style={s.actionChip} id="focus-btn">
                    <Monitor size={13} />
                  </button>
                </div>
                <div style={s.searchRight}>
                  <button type="button" style={s.actionChip} id="model-btn">
                    <span>Model</span>
                    <ChevronDown size={12} />
                  </button>
                  <button type="button" style={s.actionChip} id="mic-btn">
                    <Mic size={14} />
                  </button>
                  <button
                    type="submit"
                    id="submit-btn"
                    disabled={isStreaming || !query.trim()}
                    style={{
                      ...s.actionChip,
                      ...(query.trim()
                        ? {
                            background:
                              "linear-gradient(135deg, #a78bfa, #60a5fa)",
                            border: "none",
                            color: "#fff",
                          }
                        : {}),
                    }}
                  >
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </form>

            {/* Try Computer */}
            <button id="try-computer-btn" style={s.tryComputerBtn}>
              <Monitor size={14} />
              <span>Try Computer</span>
            </button>

            {/* Suggestion Chips */}
            <div style={s.chips}>
              {SUGGESTIONS.map((s_) => (
                <button
                  key={s_}
                  style={s.chip}
                  onClick={(e) => {
                     setQuery(s_);
                     handleSearch(e, s_);
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.background =
                      "rgba(255,255,255,0.08)")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.background =
                      "rgba(255,255,255,0.04)")
                  }
                >
                  {s_}
                </button>
              ))}
            </div>

            {/* Prompt links */}
            <div style={s.promptLinks}>
              {PROMPTS.map((p) => (
                <button
                  key={p}
                  style={s.promptLink}
                  onClick={(e) => {
                     setQuery(p);
                     handleSearch(e, p);
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.color = "#a78bfa")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.color =
                      "rgba(255,255,255,0.45)")
                  }
                >
                  {p}
                </button>
              ))}
            </div>
          </section>
        ) : (
          <section style={s.chatContainer}>
            <div style={s.chatHistory}>
              {messages.map((msg, idx) => (
                <div key={idx} style={msg.role === "User" ? s.userMessage : s.assistantMessage}>
                  {msg.role === "User" ? (
                    <div style={s.userMessageContent}>{msg.content}</div>
                  ) : (
                    <div style={s.assistantMessageContent}>
                      <div style={s.completedSteps}>
                        <Globe size={14} /> Completed 3 steps <ChevronDown size={14} />
                      </div>
                      <div className="markdown-body" style={s.markdownContainer}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                      {msg.sources && msg.sources.length > 0 && (
                        <div style={s.sourcesContainer}>
                          <h4 style={{ margin: "0 0 10px", fontSize: 13, color: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", gap: 6 }}>
                            <Layers size={14} /> Sources
                          </h4>
                          <div style={s.sourcesList}>
                            {msg.sources.map((src: any, sIdx: number) => (
                              <a key={sIdx} href={src.url} target="_blank" rel="noreferrer" style={s.sourceCard}>
                                <div style={s.sourceTitle}>{src.title}</div>
                                <div style={s.sourceUrl}>{new URL(src.url).hostname}</div>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {msg.followUps && msg.followUps.length > 0 && (
                        <div style={s.followUpsContainer}>
                           <h4 style={{ margin: "16px 0 10px", fontSize: 13, color: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", gap: 6 }}>
                             <Compass size={14} /> Follow-up Questions
                           </h4>
                           <div style={s.followUpsList}>
                             {msg.followUps.map((q: string, qIdx: number) => (
                               <button 
                                 key={qIdx} 
                                 style={s.followUpBtn} 
                                 onClick={(e) => {
                                    setQuery(q);
                                    handleSearch(e, q);
                                 }}
                               >
                                 <Plus size={14} style={{ color: "rgba(167,139,250,0.8)" }} />
                                 {q}
                               </button>
                             ))}
                           </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div style={s.chatInputContainer}>
              <form onSubmit={handleSearch} style={s.chatSearchBox}>
                <textarea
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a follow-up"
                  style={s.chatSearchInput}
                  rows={1}
                />
                <div style={s.searchActions}>
                  <div style={s.searchLeft}>
                    <button type="button" style={s.actionChip} id="attach-btn">
                      <Plus size={14} />
                    </button>
                    <button type="button" style={s.actionChip} id="search-mode-btn">
                      <Search size={13} />
                      <span>Search</span>
                      <ChevronDown size={12} />
                    </button>
                  </div>
                  <div style={s.searchRight}>
                    <button type="button" style={s.actionChip} id="model-btn">
                      <span>Model</span>
                      <ChevronDown size={12} />
                    </button>
                    <button type="button" style={s.actionChip} id="mic-btn">
                      <Mic size={14} />
                    </button>
                    <button
                      type="submit"
                      disabled={isStreaming || !query.trim()}
                      style={{
                        ...s.actionChip,
                        ...(query.trim()
                          ? { background: "linear-gradient(135deg, #a78bfa, #60a5fa)", border: "none", color: "#fff" }
                          : { background: "rgba(255,255,255,0.1)", border: "none" }),
                        borderRadius: "50%",
                        width: 30,
                        height: 30,
                        padding: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                    >
                      <ArrowRight size={14} style={{ transform: "rotate(-90deg)" }} />
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

/* ─── Styles ─── */
const s: Record<string, React.CSSProperties> = {
  root: {
    display: "flex",
    minHeight: "100vh",
    background: "#131318",
    fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
    color: "#fff",
    overflow: "hidden",
  },

  /* Sidebar */
  sidebar: {
    width: 220,
    minWidth: 220,
    background: "#0e0e14",
    borderRight: "1px solid rgba(255,255,255,0.06)",
    display: "flex",
    flexDirection: "column",
    padding: "16px 10px",
    gap: 4,
    overflowY: "auto",
  },
  sidebarLogo: {
    padding: "4px 8px 12px",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  logoMark: {
    width: 34,
    height: 34,
    borderRadius: 10,
    background: "linear-gradient(135deg,rgba(167,139,250,.15),rgba(96,165,250,.15))",
    border: "1px solid rgba(167,139,250,.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  newBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    padding: "9px 12px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    transition: "background 0.15s",
    marginBottom: 8,
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 12px",
    background: "transparent",
    border: "none",
    borderRadius: 8,
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    cursor: "pointer",
    transition: "background 0.15s",
    textAlign: "left",
    width: "100%",
  },
  navIcon: { color: "rgba(255,255,255,0.4)", display: "flex" },
  recentSection: {
    marginTop: 12,
    display: "flex",
    flexDirection: "column",
    gap: 1,
    flex: 1,
  },
  recentItem: {
    padding: "7px 12px",
    background: "transparent",
    border: "none",
    borderRadius: 7,
    color: "rgba(255,255,255,0.38)",
    fontSize: 12,
    cursor: "pointer",
    textAlign: "left",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    transition: "background 0.15s",
    width: "100%",
  },
  sidebarFooter: {
    marginTop: "auto",
    paddingTop: 12,
    borderTop: "1px solid rgba(255,255,255,0.06)",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  upgradeBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 12px",
    background: "transparent",
    border: "none",
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    cursor: "pointer",
    borderRadius: 8,
    textAlign: "left",
  },
  upgradeDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#a78bfa",
    marginLeft: "auto",
  },
  avatarBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "7px 10px",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    borderRadius: 8,
    width: "100%",
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
  },
  avatarImg: {
    width: 26,
    height: 26,
    borderRadius: "50%",
    border: "1px solid rgba(255,255,255,0.15)",
    objectFit: "cover",
  },
  avatarName: { fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  userMenu: {
    position: "absolute",
    bottom: "110%",
    left: 0,
    width: 200,
    background: "#1c1c24",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: "8px",
    boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
    zIndex: 100,
  },
  userMenuHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "6px 8px",
  },
  menuDivider: { border: "none", borderTop: "1px solid rgba(255,255,255,0.08)", margin: "6px 0" },
  menuItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    background: "transparent",
    border: "none",
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
    cursor: "pointer",
    borderRadius: 7,
    width: "100%",
    textAlign: "left",
    transition: "background 0.15s",
  },

  /* Main */
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },

  /* Header */
  header: {
    display: "flex",
    alignItems: "center",
    padding: "12px 24px",
    gap: 24,
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  },
  proBadge: {
    padding: "6px 14px",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 20,
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
    letterSpacing: "0.3px",
  },
  topNav: { display: "flex", alignItems: "center", gap: 4, flex: 1 },
  topNavItem: {
    padding: "6px 12px",
    background: "transparent",
    border: "none",
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    cursor: "pointer",
    borderRadius: 8,
    fontWeight: 500,
    transition: "color 0.15s",
  },
  headerRight: { display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" },
  scheduledBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20,
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    cursor: "pointer",
    fontWeight: 500,
  },
  iconBtn: {
    width: 34,
    height: 34,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: "50%",
    color: "rgba(255,255,255,0.5)",
    cursor: "pointer",
  },

  /* Hero */
  hero: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    padding: "40px 24px 80px",
    gap: 16,
  },
  orb1: {
    position: "absolute",
    width: 500,
    height: 500,
    borderRadius: "50%",
    background: "rgba(139,92,246,0.07)",
    filter: "blur(120px)",
    top: "5%",
    left: "15%",
    pointerEvents: "none",
  },
  orb2: {
    position: "absolute",
    width: 400,
    height: 400,
    borderRadius: "50%",
    background: "rgba(59,130,246,0.06)",
    filter: "blur(100px)",
    bottom: "10%",
    right: "10%",
    pointerEvents: "none",
  },
  orb3: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: "50%",
    background: "rgba(167,139,250,0.04)",
    filter: "blur(80px)",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
  },
  heroTitle: {
    fontSize: "clamp(36px, 6vw, 64px)",
    fontWeight: 300,
    letterSpacing: "-2px",
    background: "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.55) 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    margin: 0,
    marginBottom: 8,
    zIndex: 1,
  },

  /* Search */
  searchBox: {
    width: "100%",
    maxWidth: 680,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 16,
    padding: "14px 14px 10px",
    backdropFilter: "blur(20px)",
    boxShadow: "0 8px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)",
    zIndex: 1,
    transition: "border-color 0.2s, box-shadow 0.2s",
  },
  searchInput: {
    width: "100%",
    background: "transparent",
    border: "none",
    outline: "none",
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
    lineHeight: 1.5,
    resize: "none",
    fontFamily: "inherit",
    padding: "0 4px 8px",
    boxSizing: "border-box",
  },
  searchActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  searchLeft: { display: "flex", alignItems: "center", gap: 6 },
  searchRight: { display: "flex", alignItems: "center", gap: 6 },
  actionChip: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    padding: "5px 10px",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 8,
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "background 0.15s",
  },
  tryComputerBtn: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    padding: "9px 18px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 24,
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    cursor: "pointer",
    zIndex: 1,
    fontFamily: "inherit",
    transition: "background 0.15s",
  },
  chips: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    zIndex: 1,
    maxWidth: 680,
  },
  chip: {
    padding: "7px 16px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20,
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "background 0.15s",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  promptLinks: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    zIndex: 1,
  },
  promptLink: {
    background: "transparent",
    border: "none",
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "color 0.15s",
    padding: "3px 0",
    textDecoration: "underline",
    textDecorationColor: "rgba(255,255,255,0.15)",
    textUnderlineOffset: 3,
  },
  chatContainer: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    alignItems: "center",
    padding: "0 24px"
  },
  chatHistory: {
    flex: 1,
    width: "100%",
    maxWidth: 760,
    overflowY: "auto",
    paddingTop: 32,
    paddingBottom: 40,
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  userMessage: {
    display: "flex",
    justifyContent: "flex-end",
    width: "100%",
  },
  userMessageContent: {
    background: "rgba(255,255,255,0.08)",
    padding: "12px 18px",
    borderRadius: 20,
    borderTopRightRadius: 4,
    fontSize: 15,
    maxWidth: "80%",
    lineHeight: 1.5,
  },
  assistantMessage: {
    display: "flex",
    justifyContent: "flex-start",
    width: "100%",
  },
  assistantMessageContent: {
    fontSize: 15,
    lineHeight: 1.6,
    width: "100%",
    color: "rgba(255,255,255,0.9)",
  },
  sourcesContainer: {
    marginTop: 16,
    padding: "16px",
    background: "rgba(255,255,255,0.03)",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.06)",
  },
  sourcesList: {
    display: "flex",
    gap: 12,
    overflowX: "auto",
    paddingBottom: 4,
  },
  sourceCard: {
    display: "flex",
    flexDirection: "column",
    minWidth: 160,
    maxWidth: 200,
    padding: 12,
    background: "rgba(255,255,255,0.05)",
    borderRadius: 8,
    textDecoration: "none",
    border: "1px solid rgba(255,255,255,0.08)",
    transition: "background 0.15s",
  },
  sourceTitle: {
    fontSize: 13,
    color: "#fff",
    fontWeight: 500,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    marginBottom: 4,
  },
  sourceUrl: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
  },
  chatInputContainer: {
    width: "100%",
    maxWidth: 760,
    paddingBottom: 24,
    paddingTop: 10,
  },
  chatSearchBox: {
    width: "100%",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 16,
    padding: "14px 14px 10px",
    backdropFilter: "blur(20px)",
    boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
  },
  chatSearchInput: {
    width: "100%",
    background: "transparent",
    border: "none",
    outline: "none",
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
    lineHeight: 1.5,
    resize: "none",
    fontFamily: "inherit",
    padding: "0 4px 8px",
    boxSizing: "border-box",
  },
  completedSteps: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    marginBottom: 12,
    cursor: "pointer",
    padding: "4px 10px",
    borderRadius: 8,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  markdownContainer: {
    width: "100%",
    overflowX: "auto",
  },

  followUpsContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTop: "1px solid rgba(255,255,255,0.06)",
  },
  followUpsList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  followUpBtn: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 16px",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    cursor: "pointer",
    textAlign: "left",
    transition: "background 0.2s",
  },
};
