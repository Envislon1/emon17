export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      device_assignments: {
        Row: {
          channel_count: number | null
          created_at: string
          custom_name: string | null
          device_id: string
          device_name: string
          id: string
          user_id: string
        }
        Insert: {
          channel_count?: number | null
          created_at?: string
          custom_name?: string | null
          device_id: string
          device_name?: string
          id?: string
          user_id: string
        }
        Update: {
          channel_count?: number | null
          created_at?: string
          custom_name?: string | null
          device_id?: string
          device_name?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      device_channels: {
        Row: {
          channel_number: number
          created_at: string | null
          custom_name: string | null
          device_id: string
          id: string
          user_id: string | null
        }
        Insert: {
          channel_number: number
          created_at?: string | null
          custom_name?: string | null
          device_id: string
          id?: string
          user_id?: string | null
        }
        Update: {
          channel_number?: number
          created_at?: string | null
          custom_name?: string | null
          device_id?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      energy_data: {
        Row: {
          channel_number: number
          cost: number | null
          current: number | null
          device_id: string
          energy_wh: number | null
          id: string
          power: number | null
          timestamp: string
        }
        Insert: {
          channel_number?: number
          cost?: number | null
          current?: number | null
          device_id: string
          energy_wh?: number | null
          id?: string
          power?: number | null
          timestamp?: string
        }
        Update: {
          channel_number?: number
          cost?: number | null
          current?: number | null
          device_id?: string
          energy_wh?: number | null
          id?: string
          power?: number | null
          timestamp?: string
        }
        Relationships: []
      }
      energy_reset_sessions: {
        Row: {
          created_at: string
          device_id: string
          expires_at: string
          id: string
          required_votes: number
          reset_executed_at: string | null
          status: string
          votes_received: number
        }
        Insert: {
          created_at?: string
          device_id: string
          expires_at?: string
          id?: string
          required_votes: number
          reset_executed_at?: string | null
          status?: string
          votes_received: number
        }
        Update: {
          created_at?: string
          device_id?: string
          expires_at?: string
          id?: string
          required_votes?: number
          reset_executed_at?: string | null
          status?: string
          votes_received?: number
        }
        Relationships: []
      }
      energy_reset_votes: {
        Row: {
          device_id: string
          id: string
          user_id: string
          voted_at: string
        }
        Insert: {
          device_id: string
          id?: string
          user_id: string
          voted_at?: string
        }
        Update: {
          device_id?: string
          id?: string
          user_id?: string
          voted_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          apartment_number: number | null
          created_at: string | null
          full_name: string | null
          id: string
          theme_preference: string | null
          updated_at: string | null
        }
        Insert: {
          apartment_number?: number | null
          created_at?: string | null
          full_name?: string | null
          id: string
          theme_preference?: string | null
          updated_at?: string | null
        }
        Update: {
          apartment_number?: number | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          theme_preference?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      total_bill_settings: {
        Row: {
          billing_period: string
          created_at: string
          device_id: string
          id: string
          total_bill_amount: number
          updated_at: string
        }
        Insert: {
          billing_period?: string
          created_at?: string
          device_id: string
          id?: string
          total_bill_amount?: number
          updated_at?: string
        }
        Update: {
          billing_period?: string
          created_at?: string
          device_id?: string
          id?: string
          total_bill_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_mock_readings: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      handle_esp32_data: {
        Args: { p_device_id: string; p_data: Json }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
