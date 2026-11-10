
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "board_items": {
                  Row: {
                    "author_id": string,"body": string | null,"created_at": string,"evidence_id": string | null,"group_label": string | null,"highlight": boolean,"id": string,"kind": Database["public"]['Enums']["board_item_kind"],"session_id": string,"status": Database["public"]['Enums']["board_status"],"updated_at": string,"visibility": Database["public"]['Enums']["board_visibility"],"x": number,"y": number
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"body"?: string | null,"created_at"?: string,"evidence_id"?: string | null,"group_label"?: string | null,"highlight"?: boolean,"id"?: string,"kind": Database["public"]['Enums']["board_item_kind"],"session_id": string,"status"?: Database["public"]['Enums']["board_status"],"updated_at"?: string,"visibility"?: Database["public"]['Enums']["board_visibility"],"x"?: number,"y"?: number
                  }
                  Update: {
                    "author_id"?: string,"body"?: string | null,"created_at"?: string,"evidence_id"?: string | null,"group_label"?: string | null,"highlight"?: boolean,"id"?: string,"kind"?: Database["public"]['Enums']["board_item_kind"],"session_id"?: string,"status"?: Database["public"]['Enums']["board_status"],"updated_at"?: string,"visibility"?: Database["public"]['Enums']["board_visibility"],"x"?: number,"y"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "board_items_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "board_items_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "case_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"board_links": {
                  Row: {
                    "author_id": string,"created_at": string,"from_item": string,"id": string,"label": string | null,"session_id": string,"status": Database["public"]['Enums']["board_status"],"to_item": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"created_at"?: string,"from_item": string,"id"?: string,"label"?: string | null,"session_id": string,"status"?: Database["public"]['Enums']["board_status"],"to_item": string
                  }
                  Update: {
                    "author_id"?: string,"created_at"?: string,"from_item"?: string,"id"?: string,"label"?: string | null,"session_id"?: string,"status"?: Database["public"]['Enums']["board_status"],"to_item"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "board_links_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "board_links_from_item_fkey"
      columns: ["from_item"]
isOneToOne: false
      referencedRelation: "board_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "board_links_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "case_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "board_links_to_item_fkey"
      columns: ["to_item"]
isOneToOne: false
      referencedRelation: "board_items"
      referencedColumns: ["id"]
    }
                  ]
                },"case_sessions": {
                  Row: {
                    "case_id": string,"case_version_id": string,"completed_at": string | null,"duo_id": string,"id": string,"progress": number,"started_at": string,"started_by": string | null,"state": NonNullable<Json>,"state_version": number,"status": Database["public"]['Enums']["session_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "case_id": string,"case_version_id": string,"completed_at"?: string | null,"duo_id": string,"id"?: string,"progress"?: number,"started_at"?: string,"started_by"?: string | null,"state": NonNullable<Json>,"state_version"?: number,"status"?: Database["public"]['Enums']["session_status"],"updated_at"?: string
                  }
                  Update: {
                    "case_id"?: string,"case_version_id"?: string,"completed_at"?: string | null,"duo_id"?: string,"id"?: string,"progress"?: number,"started_at"?: string,"started_by"?: string | null,"state"?: NonNullable<Json>,"state_version"?: number,"status"?: Database["public"]['Enums']["session_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "case_sessions_case_id_fkey"
      columns: ["case_id"]
isOneToOne: false
      referencedRelation: "cases"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "case_sessions_case_version_id_fkey"
      columns: ["case_version_id"]
isOneToOne: false
      referencedRelation: "case_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "case_sessions_duo_id_fkey"
      columns: ["duo_id"]
isOneToOne: false
      referencedRelation: "duos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "case_sessions_started_by_fkey"
      columns: ["started_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"case_versions": {
                  Row: {
                    "case_id": string,"content_hash": string,"created_at": string,"definition": NonNullable<Json>,"id": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "case_id": string,"content_hash": string,"created_at"?: string,"definition": NonNullable<Json>,"id"?: string,"version": number
                  }
                  Update: {
                    "case_id"?: string,"content_hash"?: string,"created_at"?: string,"definition"?: NonNullable<Json>,"id"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "case_versions_case_id_fkey"
      columns: ["case_id"]
isOneToOne: false
      referencedRelation: "cases"
      referencedColumns: ["id"]
    }
                  ]
                },"cases": {
                  Row: {
                    "category": string,"code": string,"cover": string,"created_at": string,"difficulty": Database["public"]['Enums']["case_difficulty"],"duration_max": number | null,"duration_min": number | null,"id": string,"is_playable": boolean,"puzzle_count": number | null,"season_id": string,"sort_order": number,"synopsis": string,"title": string,"unlock_requires": (string)[],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"code": string,"cover": string,"created_at"?: string,"difficulty": Database["public"]['Enums']["case_difficulty"],"duration_max"?: number | null,"duration_min"?: number | null,"id": string,"is_playable"?: boolean,"puzzle_count"?: number | null,"season_id": string,"sort_order"?: number,"synopsis": string,"title": string,"unlock_requires"?: (string)[],"updated_at"?: string
                  }
                  Update: {
                    "category"?: string,"code"?: string,"cover"?: string,"created_at"?: string,"difficulty"?: Database["public"]['Enums']["case_difficulty"],"duration_max"?: number | null,"duration_min"?: number | null,"id"?: string,"is_playable"?: boolean,"puzzle_count"?: number | null,"season_id"?: string,"sort_order"?: number,"synopsis"?: string,"title"?: string,"unlock_requires"?: (string)[],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cases_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "seasons"
      referencedColumns: ["id"]
    }
                  ]
                },"duo_invites": {
                  Row: {
                    "code_hash": string,"created_at": string,"created_by": string,"duo_id": string,"expires_at": string,"id": string,"revoked_at": string | null,"used_at": string | null,"used_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "code_hash": string,"created_at"?: string,"created_by": string,"duo_id": string,"expires_at": string,"id"?: string,"revoked_at"?: string | null,"used_at"?: string | null,"used_by"?: string | null
                  }
                  Update: {
                    "code_hash"?: string,"created_at"?: string,"created_by"?: string,"duo_id"?: string,"expires_at"?: string,"id"?: string,"revoked_at"?: string | null,"used_at"?: string | null,"used_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "duo_invites_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "duo_invites_duo_id_fkey"
      columns: ["duo_id"]
isOneToOne: false
      referencedRelation: "duos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "duo_invites_used_by_fkey"
      columns: ["used_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"duo_members": {
                  Row: {
                    "duo_id": string,"joined_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "duo_id": string,"joined_at"?: string,"user_id": string
                  }
                  Update: {
                    "duo_id"?: string,"joined_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "duo_members_duo_id_fkey"
      columns: ["duo_id"]
isOneToOne: false
      referencedRelation: "duos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "duo_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"duos": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "duos_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "codename": string | null,"created_at": string,"id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "codename"?: string | null,"created_at"?: string,"id": string,"updated_at"?: string
                  }
                  Update: {
                    "codename"?: string | null,"created_at"?: string,"id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"seasons": {
                  Row: {
                    "created_at": string,"id": string,"number": number,"tagline": string | null,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id": string,"number": number,"tagline"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"number"?: number,"tagline"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"session_actions": {
                  Row: {
                    "action": NonNullable<Json>,"action_id": string,"actor_id": string,"created_at": string,"outcome": NonNullable<Json>,"session_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": NonNullable<Json>,"action_id": string,"actor_id": string,"created_at"?: string,"outcome": NonNullable<Json>,"session_id": string
                  }
                  Update: {
                    "action"?: NonNullable<Json>,"action_id"?: string,"actor_id"?: string,"created_at"?: string,"outcome"?: NonNullable<Json>,"session_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "session_actions_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "session_actions_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "case_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"session_events": {
                  Row: {
                    "action_id": string | null,"actor_id": string | null,"created_at": string,"payload": NonNullable<Json>,"session_id": string,"state_version": number,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action_id"?: string | null,"actor_id"?: string | null,"created_at"?: string,"payload"?: NonNullable<Json>,"session_id": string,"state_version": number,"type": string
                  }
                  Update: {
                    "action_id"?: string | null,"actor_id"?: string | null,"created_at"?: string,"payload"?: NonNullable<Json>,"session_id"?: string,"state_version"?: number,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "session_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "session_events_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "case_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"session_messages": {
                  Row: {
                    "author_id": string,"body": string | null,"created_at": string,"evidence_id": string | null,"id": string,"kind": string,"puzzle_id": string | null,"session_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"body"?: string | null,"created_at"?: string,"evidence_id"?: string | null,"id"?: string,"kind": string,"puzzle_id"?: string | null,"session_id": string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string | null,"created_at"?: string,"evidence_id"?: string | null,"id"?: string,"kind"?: string,"puzzle_id"?: string | null,"session_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "session_messages_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "session_messages_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "case_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"session_players": {
                  Row: {
                    "role": Database["public"]['Enums']["player_role"],"session_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "role": Database["public"]['Enums']["player_role"],"session_id": string,"user_id": string
                  }
                  Update: {
                    "role"?: Database["public"]['Enums']["player_role"],"session_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "session_players_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "case_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "session_players_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"session_reads": {
                  Row: {
                    "last_read_at": string,"session_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "last_read_at"?: string,"session_id": string,"user_id": string
                  }
                  Update: {
                    "last_read_at"?: string,"session_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "session_reads_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "case_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "session_reads_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "commit_session_transition":
{ Args: { "p_action": Json,"p_action_id": string,"p_actor_id": string,"p_event_payload": Json,"p_event_type": string,"p_expected_version": number,"p_outcome": Json,"p_progress": number,"p_session_id": string,"p_state": Json,"p_status": Database["public"]['Enums']["session_status"] }; Returns: string
                           },
"consume_rate_limit":
{ Args: { "p_key": string,"p_max": number,"p_window_seconds": number }; Returns: boolean
                           },
"create_duo":
{ Args: { "p_name": string }; Returns: string
                           },
"create_duo_invite":
{ Args: Record<PropertyKey, never>; Returns: {
              "code": string,"expires_at": string
            }[]
                           },
"hook_before_user_created":
{ Args: { "event": Json }; Returns: Json
                           },
"join_duo":
{ Args: { "p_code": string }; Returns: string
                           },
"notify_duo":
{ Args: { "p_duo_id": string,"p_event": string,"p_payload": Json }; Returns: undefined
                           }
          }
          Enums: {
            "board_item_kind": "evidence"|"note","board_status": "hypothesis"|"confirmed"|"contradiction","board_visibility": "private"|"shared","case_difficulty": "easy"|"medium"|"hard","player_role": "A"|"B","session_status": "active"|"completed"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "board_item_kind": ["evidence", "note"],"board_status": ["hypothesis", "confirmed", "contradiction"],"board_visibility": ["private", "shared"],"case_difficulty": ["easy", "medium", "hard"],"player_role": ["A", "B"],"session_status": ["active", "completed"]
          }
        }
} as const
