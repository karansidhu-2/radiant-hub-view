export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_allowlist: {
        Row: {
          added_by: string | null
          created_at: string
          email: string
          id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          city: string
          created_at: string
          customer_phone_notify: string | null
          email: string
          full_name: string
          id: string
          notes: string | null
          phone: string
          reference: string
          scheduled_date: string
          scheduled_hour: number
          service_charge: number | null
          service_name: string
          service_slug: string | null
          state: string
          status: Database["public"]["Enums"]["booking_status"]
          street: string
          technician: string | null
          updated_at: string
          user_id: string | null
          zip: string
        }
        Insert: {
          city: string
          created_at?: string
          customer_phone_notify?: string | null
          email: string
          full_name: string
          id?: string
          notes?: string | null
          phone: string
          reference?: string
          scheduled_date: string
          scheduled_hour: number
          service_charge?: number | null
          service_name: string
          service_slug?: string | null
          state: string
          status?: Database["public"]["Enums"]["booking_status"]
          street: string
          technician?: string | null
          updated_at?: string
          user_id?: string | null
          zip: string
        }
        Update: {
          city?: string
          created_at?: string
          customer_phone_notify?: string | null
          email?: string
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string
          reference?: string
          scheduled_date?: string
          scheduled_hour?: number
          service_charge?: number | null
          service_name?: string
          service_slug?: string | null
          state?: string
          status?: Database["public"]["Enums"]["booking_status"]
          street?: string
          technician?: string | null
          updated_at?: string
          user_id?: string | null
          zip?: string
        }
        Relationships: []
      }
      capacity_conflicts: {
        Row: {
          booking_id: string | null
          capacity: number
          count: number
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          scheduled_date: string
          scheduled_hour: number
          source: string
          updated_at: string
        }
        Insert: {
          booking_id?: string | null
          capacity: number
          count: number
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          scheduled_date: string
          scheduled_hour: number
          source: string
          updated_at?: string
        }
        Update: {
          booking_id?: string | null
          capacity?: number
          count?: number
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          scheduled_date?: string
          scheduled_hour?: number
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          brand: string | null
          created_at: string
          id: string
          include_installation: boolean
          installation_fee: number
          order_id: string
          product_name: string
          product_slug: string
          quantity: number
          unit_price: number
        }
        Insert: {
          brand?: string | null
          created_at?: string
          id?: string
          include_installation?: boolean
          installation_fee?: number
          order_id: string
          product_name: string
          product_slug: string
          quantity?: number
          unit_price: number
        }
        Update: {
          brand?: string | null
          created_at?: string
          id?: string
          include_installation?: boolean
          installation_fee?: number
          order_id?: string
          product_name?: string
          product_slug?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          city: string
          created_at: string
          email: string
          full_name: string
          id: string
          installation_total: number
          notes: string | null
          phone: string
          reference: string
          scheduled_date: string | null
          scheduled_hour: number | null
          state: string
          status: Database["public"]["Enums"]["order_status"]
          street: string
          subtotal: number
          total: number
          updated_at: string
          user_id: string | null
          zip: string
        }
        Insert: {
          city: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          installation_total?: number
          notes?: string | null
          phone: string
          reference?: string
          scheduled_date?: string | null
          scheduled_hour?: number | null
          state: string
          status?: Database["public"]["Enums"]["order_status"]
          street: string
          subtotal: number
          total: number
          updated_at?: string
          user_id?: string | null
          zip: string
        }
        Update: {
          city?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          installation_total?: number
          notes?: string | null
          phone?: string
          reference?: string
          scheduled_date?: string | null
          scheduled_hour?: number | null
          state?: string
          status?: Database["public"]["Enums"]["order_status"]
          street?: string
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
          zip?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          available: boolean
          brand: string
          capacity_btu: number | null
          category: string
          created_at: string
          description: string
          features: Json
          hspf: number | null
          id: string
          image_url: string | null
          installation_fee: number
          low_stock_threshold: number | null
          media: Json
          name: string
          price: number
          published: boolean
          seer: number | null
          slug: string
          stock: number
          tag: string | null
          updated_at: string
        }
        Insert: {
          available?: boolean
          brand: string
          capacity_btu?: number | null
          category: string
          created_at?: string
          description: string
          features?: Json
          hspf?: number | null
          id?: string
          image_url?: string | null
          installation_fee?: number
          low_stock_threshold?: number | null
          media?: Json
          name: string
          price: number
          published?: boolean
          seer?: number | null
          slug: string
          stock?: number
          tag?: string | null
          updated_at?: string
        }
        Update: {
          available?: boolean
          brand?: string
          capacity_btu?: number | null
          category?: string
          created_at?: string
          description?: string
          features?: Json
          hspf?: number | null
          id?: string
          image_url?: string | null
          installation_fee?: number
          low_stock_threshold?: number | null
          media?: Json
          name?: string
          price?: number
          published?: boolean
          seer?: number | null
          slug?: string
          stock?: number
          tag?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      review_audit_log: {
        Row: {
          action: string
          admin_email: string | null
          admin_id: string
          created_at: string
          details: Json
          id: string
          review_id: string | null
          service_name: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_email?: string | null
          admin_id: string
          created_at?: string
          details?: Json
          id?: string
          review_id?: string | null
          service_name?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_email?: string | null
          admin_id?: string
          created_at?: string
          details?: Json
          id?: string
          review_id?: string | null
          service_name?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          admin_note: string | null
          admin_reply: string | null
          admin_reply_at: string | null
          booking_id: string
          comment: string | null
          created_at: string
          id: string
          published: boolean
          rating: number
          service_name: string
          service_slug: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          admin_reply?: string | null
          admin_reply_at?: string | null
          booking_id: string
          comment?: string | null
          created_at?: string
          id?: string
          published?: boolean
          rating: number
          service_name: string
          service_slug?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          admin_reply?: string | null
          admin_reply_at?: string | null
          booking_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          published?: boolean
          rating?: number
          service_name?: string
          service_slug?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_addresses: {
        Row: {
          city: string
          created_at: string
          id: string
          is_default: boolean
          label: string
          state: string
          street: string
          updated_at: string
          user_id: string
          zip: string
        }
        Insert: {
          city: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          state: string
          street: string
          updated_at?: string
          user_id: string
          zip: string
        }
        Update: {
          city?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          state?: string
          street?: string
          updated_at?: string
          user_id?: string
          zip?: string
        }
        Relationships: []
      }
      service_areas: {
        Row: {
          active: boolean
          city: string | null
          created_at: string
          id: string
          state: string | null
          zip: string
        }
        Insert: {
          active?: boolean
          city?: string | null
          created_at?: string
          id?: string
          state?: string | null
          zip: string
        }
        Update: {
          active?: boolean
          city?: string | null
          created_at?: string
          id?: string
          state?: string | null
          zip?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          bullets: Json
          category: string
          created_at: string
          description: string
          icon: string
          id: string
          name: string
          published: boolean
          short: string
          slug: string
          starting_at: number
          updated_at: string
        }
        Insert: {
          bullets?: Json
          category: string
          created_at?: string
          description: string
          icon?: string
          id?: string
          name: string
          published?: boolean
          short: string
          slug: string
          starting_at?: number
          updated_at?: string
        }
        Update: {
          bullets?: Json
          category?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name?: string
          published?: boolean
          short?: string
          slug?: string
          starting_at?: number
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          address: string
          business_hours: string
          company_name: string
          created_at: string
          crew_capacity: number
          crew_capacity_enabled: boolean
          emergency_phone: string
          id: string
          notification_templates: Json
          notify_email_enabled: boolean
          notify_on_reschedule: boolean
          notify_on_status_change: boolean
          notify_sms_enabled: boolean
          singleton: boolean
          support_email: string
          support_phone: string
          tagline: string
          technicians: string[]
          twilio_from_phone: string
          updated_at: string
        }
        Insert: {
          address?: string
          business_hours?: string
          company_name?: string
          created_at?: string
          crew_capacity?: number
          crew_capacity_enabled?: boolean
          emergency_phone?: string
          id?: string
          notification_templates?: Json
          notify_email_enabled?: boolean
          notify_on_reschedule?: boolean
          notify_on_status_change?: boolean
          notify_sms_enabled?: boolean
          singleton?: boolean
          support_email?: string
          support_phone?: string
          tagline?: string
          technicians?: string[]
          twilio_from_phone?: string
          updated_at?: string
        }
        Update: {
          address?: string
          business_hours?: string
          company_name?: string
          created_at?: string
          crew_capacity?: number
          crew_capacity_enabled?: boolean
          emergency_phone?: string
          id?: string
          notification_templates?: Json
          notify_email_enabled?: boolean
          notify_on_reschedule?: boolean
          notify_on_status_change?: boolean
          notify_sms_enabled?: boolean
          singleton?: boolean
          support_email?: string
          support_phone?: string
          tagline?: string
          technicians?: string[]
          twilio_from_phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "customer"
      booking_status:
        | "pending"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
      order_status:
        | "pending"
        | "confirmed"
        | "scheduled"
        | "installed"
        | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "customer"],
      booking_status: [
        "pending",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
      ],
      order_status: [
        "pending",
        "confirmed",
        "scheduled",
        "installed",
        "cancelled",
      ],
    },
  },
} as const
