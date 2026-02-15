export type ConversationStatus =
  | "active"
  | "completed"
  | "booked"
  | "lost"
  | "follow_up";

export type LeadQuality = "hot" | "warm" | "cold" | "unqualified";

export interface LeadInfo {
  business_type?: string;
  business_name?: string;
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  pain_points?: string[];
  estimated_loss?: number;
  interested_in?: string[];
}

export interface SofiaConversation {
  id: string;
  session_id: string;
  started_at: string;
  last_message_at: string;
  status: ConversationStatus;
  lead_quality: LeadQuality;
  lead_info: LeadInfo;
  message_count: number;
  booked_call: boolean;
  language: "es" | "en";
  user_agent?: string;
  ip_country?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface SofiaMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      sofia_conversations: {
        Row: SofiaConversation;
        Insert: Partial<SofiaConversation>;
        Update: Partial<SofiaConversation>;
      };
      sofia_messages: {
        Row: SofiaMessage;
        Insert: Partial<SofiaMessage>;
        Update: Partial<SofiaMessage>;
      };
    };
    Views: {
      sofia_dashboard_stats: {
        Row: {
          total_conversations: number;
          active_conversations: number;
          booked_calls: number;
          hot_leads: number;
          warm_leads: number;
          last_24h: number;
          last_7_days: number;
          booking_rate: number;
        };
      };
    };
  };
}
