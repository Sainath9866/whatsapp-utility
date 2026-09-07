export type WhatsAppMessage = {
  id: string;
  recipient_name: string;
  country_code: string;
  phone_number: string;
  full_phone: string;
  message: string;
  status: "pending" | "sent";
  created_at: string;
};

export type MessageInput = Pick<WhatsAppMessage, "recipient_name" | "country_code" | "phone_number" | "full_phone" | "message">;
export type ActiveTab = "add" | "queue" | "history";
export type Database = {
  public: {
    Tables: {
      whatsapp_messages: {
        Row: WhatsAppMessage;
        Insert: MessageInput & { id?: string; status?: "pending" | "sent"; created_at?: string };
        Update: { status?: "pending" | "sent" };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
