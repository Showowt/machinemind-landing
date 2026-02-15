"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";

interface LeadInfo {
  business_type?: string;
  location?: string;
  pain_points?: string[];
}

interface SofiaConversation {
  id: string;
  session_id: string;
  started_at: string;
  last_message_at: string;
  status: string;
  lead_quality: string;
  lead_info: LeadInfo;
  message_count: number;
  booked_call: boolean;
  language: string;
  notes?: string;
}

interface SofiaMessage {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  timestamp: string;
}

interface DashboardStats {
  total_conversations: number;
  active_conversations: number;
  booked_calls: number;
  hot_leads: number;
  warm_leads: number;
  last_24h: number;
  last_7_days: number;
  booking_rate: number;
}

// Lazy create Supabase client
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  return createBrowserClient(url, key);
}

export default function SofiaAdminPage() {
  const [conversations, setConversations] = useState<SofiaConversation[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<SofiaConversation | null>(null);
  const [messages, setMessages] = useState<SofiaMessage[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [filter, setFilter] = useState<"all" | "hot" | "warm" | "booked">(
    "all",
  );

  const loadData = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setConfigured(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Load stats
      const { data: statsData } = await supabase
        .from("sofia_dashboard_stats")
        .select("*")
        .single();
      if (statsData) setStats(statsData as DashboardStats);

      // Load conversations
      let query = supabase
        .from("sofia_conversations")
        .select("*")
        .order("last_message_at", { ascending: false });

      if (filter === "hot") {
        query = query.eq("lead_quality", "hot");
      } else if (filter === "warm") {
        query = query.eq("lead_quality", "warm");
      } else if (filter === "booked") {
        query = query.eq("booked_call", true);
      }

      const { data: convData } = await query.limit(50);
      if (convData) setConversations(convData as SofiaConversation[]);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadMessages = async (conversation: SofiaConversation) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    setSelectedConversation(conversation);
    const { data } = await supabase
      .from("sofia_messages")
      .select("*")
      .eq("conversation_id", conversation.id)
      .order("timestamp", { ascending: true });
    if (data) setMessages(data as SofiaMessage[]);
  };

  const updateConversation = async (
    id: string,
    updates: Partial<SofiaConversation>,
  ) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    await supabase.from("sofia_conversations").update(updates).eq("id", id);
    loadData();
    if (selectedConversation?.id === id) {
      setSelectedConversation({
        ...selectedConversation,
        ...updates,
      } as SofiaConversation);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getLeadBadge = (quality: string) => {
    const badges = {
      hot: "bg-red-500/20 text-red-400 border-red-500/50",
      warm: "bg-orange-500/20 text-orange-400 border-orange-500/50",
      cold: "bg-blue-500/20 text-blue-400 border-blue-500/50",
      unqualified: "bg-gray-500/20 text-gray-400 border-gray-500/50",
    };
    return badges[quality as keyof typeof badges] || badges.cold;
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      active: "bg-green-500/20 text-green-400",
      completed: "bg-gray-500/20 text-gray-400",
      booked: "bg-purple-500/20 text-purple-400",
      lost: "bg-red-500/20 text-red-400",
      follow_up: "bg-yellow-500/20 text-yellow-400",
    };
    return badges[status as keyof typeof badges] || badges.active;
  };

  // Show configuration message if Supabase isn't set up
  if (!configured) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] text-white flex items-center justify-center">
        <div className="max-w-lg text-center p-8 border border-[var(--mm-border)]">
          <div className="text-4xl mb-4">🔧</div>
          <h1 className="text-2xl font-bold mb-4">
            Supabase Configuration Required
          </h1>
          <p className="text-muted mb-6">
            To enable Sofia CRM, add your Supabase credentials to the
            environment:
          </p>
          <div className="bg-[rgba(0,0,0,0.3)] p-4 text-left font-mono text-sm text-[var(--mm-blue-core)]">
            <p>NEXT_PUBLIC_SUPABASE_URL=your_url</p>
            <p>NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key</p>
            <p>SUPABASE_SERVICE_ROLE_KEY=your_key</p>
          </div>
          <p className="text-muted text-sm mt-6">
            Then run the migration in{" "}
            <code className="text-[var(--mm-blue-core)]">
              supabase/migrations/001_sofia_crm.sql
            </code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      {/* Header */}
      <header className="border-b border-[var(--mm-border)] p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white font-heading">
              Sofia CRM
            </h1>
            <p className="text-muted text-sm">
              Lead tracking & conversation management
            </p>
          </div>
          <button
            onClick={() => loadData()}
            className="px-4 py-2 bg-[var(--mm-blue-core)] text-[var(--mm-background)] font-medium text-sm"
          >
            Refresh
          </button>
        </div>
      </header>

      {/* Stats Row */}
      {stats && (
        <div className="border-b border-[var(--mm-border)] p-6">
          <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            <StatCard label="Total" value={stats.total_conversations} />
            <StatCard
              label="Active"
              value={stats.active_conversations}
              color="green"
            />
            <StatCard
              label="Booked"
              value={stats.booked_calls}
              color="purple"
            />
            <StatCard label="Hot" value={stats.hot_leads} color="red" />
            <StatCard label="Warm" value={stats.warm_leads} color="orange" />
            <StatCard label="24h" value={stats.last_24h} />
            <StatCard label="7 days" value={stats.last_7_days} />
            <StatCard
              label="Book %"
              value={`${stats.booking_rate || 0}%`}
              color="cyan"
            />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex gap-6">
          {/* Conversation List */}
          <div className="w-full md:w-1/3 lg:w-1/4">
            {/* Filters */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {(["all", "hot", "warm", "booked"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-xs font-medium capitalize ${
                    filter === f
                      ? "bg-[var(--mm-blue-core)] text-[var(--mm-background)]"
                      : "bg-[rgba(255,255,255,0.05)] text-muted hover:text-white"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* List */}
            <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto">
              {loading ? (
                <div className="text-center py-8 text-muted">Loading...</div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-8 text-muted">
                  No conversations yet.
                  <br />
                  <span className="text-sm">
                    Sofia will track them automatically.
                  </span>
                </div>
              ) : (
                conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => loadMessages(conv)}
                    className={`w-full text-left p-4 border ${
                      selectedConversation?.id === conv.id
                        ? "border-[var(--mm-blue-core)] bg-[rgba(0,180,255,0.1)]"
                        : "border-[var(--mm-border)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.05)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span
                        className={`text-xs px-2 py-0.5 border ${getLeadBadge(conv.lead_quality)}`}
                      >
                        {conv.lead_quality}
                      </span>
                      <span className="text-xs text-muted">
                        {formatTime(conv.last_message_at)}
                      </span>
                    </div>
                    <div className="text-sm text-white mb-1">
                      {(conv.lead_info as { business_type?: string })
                        ?.business_type || "Unknown business"}
                    </div>
                    <div className="text-xs text-muted">
                      {conv.message_count} messages •{" "}
                      {conv.language.toUpperCase()}
                    </div>
                    {conv.booked_call && (
                      <div className="mt-2 text-xs text-purple-400 flex items-center gap-1">
                        <span>📅</span> Booked
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Conversation Detail */}
          <div className="hidden md:block flex-1">
            {selectedConversation ? (
              <div className="border border-[var(--mm-border)] bg-[rgba(255,255,255,0.02)]">
                {/* Detail Header */}
                <div className="p-4 border-b border-[var(--mm-border)]">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-1 text-xs border ${getLeadBadge(selectedConversation.lead_quality)}`}
                      >
                        {selectedConversation.lead_quality}
                      </span>
                      <span
                        className={`px-2 py-1 text-xs ${getStatusBadge(selectedConversation.status)}`}
                      >
                        {selectedConversation.status}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          updateConversation(selectedConversation.id, {
                            status: "follow_up",
                          })
                        }
                        className="px-3 py-1.5 text-xs bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
                      >
                        Follow Up
                      </button>
                      <button
                        onClick={() =>
                          updateConversation(selectedConversation.id, {
                            booked_call: true,
                            status: "booked",
                          })
                        }
                        className="px-3 py-1.5 text-xs bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
                      >
                        Mark Booked
                      </button>
                      <button
                        onClick={() =>
                          updateConversation(selectedConversation.id, {
                            status: "lost",
                          })
                        }
                        className="px-3 py-1.5 text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30"
                      >
                        Lost
                      </button>
                    </div>
                  </div>

                  {/* Lead Info */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted block text-xs">
                        Business Type
                      </span>
                      <span className="text-white capitalize">
                        {(
                          selectedConversation.lead_info as {
                            business_type?: string;
                          }
                        )?.business_type || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted block text-xs">Location</span>
                      <span className="text-white">
                        {(
                          selectedConversation.lead_info as {
                            location?: string;
                          }
                        )?.location || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted block text-xs">Messages</span>
                      <span className="text-white">
                        {selectedConversation.message_count}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted block text-xs">Started</span>
                      <span className="text-white">
                        {formatTime(selectedConversation.started_at)}
                      </span>
                    </div>
                  </div>

                  {/* Pain Points */}
                  {(
                    selectedConversation.lead_info as { pain_points?: string[] }
                  )?.pain_points && (
                    <div className="mt-3">
                      <span className="text-muted text-xs block mb-1">
                        Pain Points
                      </span>
                      <div className="flex gap-2 flex-wrap">
                        {(
                          (
                            selectedConversation.lead_info as {
                              pain_points?: string[];
                            }
                          ).pain_points || []
                        ).map((p) => (
                          <span
                            key={p}
                            className="px-2 py-0.5 text-xs bg-red-500/10 text-red-400 border border-red-500/30"
                          >
                            {p.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Messages */}
                <div className="p-4 space-y-4 max-h-[calc(100vh-480px)] overflow-y-auto">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] p-3 text-sm whitespace-pre-wrap ${
                          msg.role === "user"
                            ? "bg-[var(--mm-blue-core)] text-white"
                            : "bg-[rgba(255,255,255,0.05)] text-white border border-[var(--mm-border)]"
                        }`}
                      >
                        {msg.content}
                        <div className="text-xs mt-2 opacity-60">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Notes */}
                <div className="p-4 border-t border-[var(--mm-border)]">
                  <textarea
                    placeholder="Add notes about this lead..."
                    defaultValue={selectedConversation.notes || ""}
                    onBlur={(e) =>
                      updateConversation(selectedConversation.id, {
                        notes: e.target.value,
                      })
                    }
                    className="w-full bg-[rgba(255,255,255,0.05)] border border-[var(--mm-border)] p-3 text-sm text-white placeholder:text-muted focus:outline-none focus:border-[var(--mm-blue-core)] min-h-[80px]"
                  />
                </div>
              </div>
            ) : (
              <div className="border border-[var(--mm-border)] bg-[rgba(255,255,255,0.02)] p-12 text-center">
                <div className="text-4xl mb-4">💬</div>
                <h3 className="text-lg font-medium text-white mb-2">
                  Select a conversation
                </h3>
                <p className="text-muted text-sm">
                  Click on a conversation to view details and messages
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color?: string;
}) {
  const colorClass =
    {
      green: "text-green-400",
      red: "text-red-400",
      orange: "text-orange-400",
      purple: "text-purple-400",
      cyan: "text-[var(--mm-blue-core)]",
    }[color || ""] || "text-white";

  return (
    <div className="bg-[rgba(255,255,255,0.02)] border border-[var(--mm-border)] p-3 text-center">
      <div className={`text-xl font-bold ${colorClass}`}>{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
