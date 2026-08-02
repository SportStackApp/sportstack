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
      administration_audit_log: {
        Row: {
          action: string
          actor_id: string
          actor_mode: string
          association_id: string | null
          club_id: string | null
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          record_type: string
          target_user_id: string | null
          team_id: string | null
        }
        Insert: {
          action: string
          actor_id: string
          actor_mode: string
          association_id?: string | null
          club_id?: string | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          record_type: string
          target_user_id?: string | null
          team_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          actor_mode?: string
          association_id?: string | null
          club_id?: string | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          record_type?: string
          target_user_id?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "administration_audit_log_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "administration_audit_log_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "administration_audit_log_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "administration_audit_log_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      administration_integrity_snapshot_batches: {
        Row: {
          captured_at: string
          captured_by: string | null
          duplicate_user_team_groups: number
          id: string
          multiple_primary_users: number
          notes: string
        }
        Insert: {
          captured_at?: string
          captured_by?: string | null
          duplicate_user_team_groups?: number
          id?: string
          multiple_primary_users?: number
          notes: string
        }
        Update: {
          captured_at?: string
          captured_by?: string | null
          duplicate_user_team_groups?: number
          id?: string
          multiple_primary_users?: number
          notes?: string
        }
        Relationships: []
      }
      administration_membership_integrity_snapshot: {
        Row: {
          batch_id: string
          captured_at: string
          created_at: string | null
          id: string
          invited_by: string | null
          issue_type: string
          jersey_number: number | null
          membership_id: string
          membership_type: string
          position: string | null
          status: string
          team_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          batch_id: string
          captured_at?: string
          created_at?: string | null
          id?: string
          invited_by?: string | null
          issue_type: string
          jersey_number?: number | null
          membership_id: string
          membership_type: string
          position?: string | null
          status: string
          team_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          batch_id?: string
          captured_at?: string
          created_at?: string | null
          id?: string
          invited_by?: string | null
          issue_type?: string
          jersey_number?: number | null
          membership_id?: string
          membership_type?: string
          position?: string | null
          status?: string
          team_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "administration_membership_integrity_snapshot_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "administration_integrity_snapshot_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      app_feedback: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          message: string
          page_path: string | null
          screenshot_path: string | null
          status: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          message: string
          page_path?: string | null
          screenshot_path?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          message?: string
          page_path?: string | null
          screenshot_path?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      app_feedback_attachments: {
        Row: {
          content_type: string | null
          created_at: string
          feedback_id: string
          file_name: string | null
          file_size: number | null
          id: string
          storage_path: string
          user_id: string
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          feedback_id: string
          file_name?: string | null
          file_size?: number | null
          id?: string
          storage_path: string
          user_id: string
        }
        Update: {
          content_type?: string | null
          created_at?: string
          feedback_id?: string
          file_name?: string | null
          file_size?: number | null
          id?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_feedback_attachments_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "app_feedback"
            referencedColumns: ["id"]
          },
        ]
      }
      associations: {
        Row: {
          abbreviation: string | null
          banner_url: string | null
          created_at: string
          default_match_duration_minutes: number
          fill_in_access_grace_minutes: number
          id: string
          logo_url: string | null
          name: string
          primary_colour: string | null
          secondary_colour: string | null
          sport_type: string
          state: string | null
          timezone: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          abbreviation?: string | null
          banner_url?: string | null
          created_at?: string
          default_match_duration_minutes?: number
          fill_in_access_grace_minutes?: number
          id?: string
          logo_url?: string | null
          name: string
          primary_colour?: string | null
          secondary_colour?: string | null
          sport_type?: string
          state?: string | null
          timezone?: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          abbreviation?: string | null
          banner_url?: string | null
          created_at?: string
          default_match_duration_minutes?: number
          fill_in_access_grace_minutes?: number
          id?: string
          logo_url?: string | null
          name?: string
          primary_colour?: string | null
          secondary_colour?: string | null
          sport_type?: string
          state?: string | null
          timezone?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      availability_reminder_delivery_log: {
        Row: {
          attempt_number: number
          created_at: string
          detail: string | null
          dispatch_id: string
          event_type: string
          id: string
        }
        Insert: {
          attempt_number: number
          created_at?: string
          detail?: string | null
          dispatch_id: string
          event_type: string
          id?: string
        }
        Update: {
          attempt_number?: number
          created_at?: string
          detail?: string | null
          dispatch_id?: string
          event_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_reminder_delivery_log_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "availability_reminder_dispatches"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_reminder_dispatches: {
        Row: {
          attempts: number
          channel: string
          completed_at: string | null
          created_at: string
          due_at: string
          fixture_id: string
          id: string
          last_attempt_at: string | null
          last_error: string | null
          reminder_days: number
          status: string
          team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          channel: string
          completed_at?: string | null
          created_at?: string
          due_at: string
          fixture_id: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          reminder_days: number
          status?: string
          team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          channel?: string
          completed_at?: string | null
          created_at?: string
          due_at?: string
          fixture_id?: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          reminder_days?: number
          status?: string
          team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_reminder_dispatches_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_reminder_dispatches_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_reminder_dispatches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_availability_reminder_settings: {
        Row: {
          club_id: string
          reminder_days: number[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          club_id: string
          reminder_days?: number[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          club_id?: string
          reminder_days?: number[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_availability_reminder_settings_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: true
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_availability_reminder_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          abbreviation: string | null
          association_id: string
          banner_url: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          primary_colour: string | null
          secondary_colour: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          abbreviation?: string | null
          association_id: string
          banner_url?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          primary_colour?: string | null
          secondary_colour?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          abbreviation?: string | null
          association_id?: string
          banner_url?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          primary_colour?: string | null
          secondary_colour?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clubs_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_position_assessments: {
        Row: {
          assessment: number
          coach_id: string
          created_at: string
          id: string
          notes: string | null
          player_id: string
          position_code: string
          team_id: string
          updated_at: string
        }
        Insert: {
          assessment: number
          coach_id: string
          created_at?: string
          id?: string
          notes?: string | null
          player_id: string
          position_code: string
          team_id: string
          updated_at?: string
        }
        Update: {
          assessment?: number
          coach_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          player_id?: string
          position_code?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_position_assessments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_position_assessments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_position_assessments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      committee_activity_log: {
        Row: {
          action: string
          actor_id: string | null
          committee_id: string
          created_at: string
          details: Json
          id: number
          record_id: string | null
          record_title: string | null
          record_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          committee_id: string
          created_at?: string
          details?: Json
          id?: never
          record_id?: string | null
          record_title?: string | null
          record_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          committee_id?: string
          created_at?: string
          details?: Json
          id?: never
          record_id?: string | null
          record_title?: string | null
          record_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "committee_activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_activity_log_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
        ]
      }
      committee_agenda_template_items: {
        Row: {
          created_at: string
          id: string
          include_open_actions: boolean
          item_type: string
          notes_prompt: string | null
          presenter: string | null
          sort_order: number
          template_id: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          include_open_actions?: boolean
          item_type?: string
          notes_prompt?: string | null
          presenter?: string | null
          sort_order?: number
          template_id: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          include_open_actions?: boolean
          item_type?: string
          notes_prompt?: string | null
          presenter?: string | null
          sort_order?: number
          template_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "committee_agenda_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "committee_agenda_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      committee_agenda_templates: {
        Row: {
          committee_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          title: string
          updated_at: string
        }
        Insert: {
          committee_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          committee_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "committee_agenda_templates_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_agenda_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      committee_documents: {
        Row: {
          committee_id: string
          created_at: string
          created_by: string | null
          document_type: string
          document_url: string
          id: string
          notes: string | null
          title: string
          updated_at: string
        }
        Insert: {
          committee_id: string
          created_at?: string
          created_by?: string | null
          document_type?: string
          document_url: string
          id?: string
          notes?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          committee_id?: string
          created_at?: string
          created_by?: string | null
          document_type?: string
          document_url?: string
          id?: string
          notes?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "committee_documents_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      committee_meeting_item_links: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          meeting_item_id: string
          record_id: string
          record_type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          meeting_item_id: string
          record_id: string
          record_type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          meeting_item_id?: string
          record_id?: string
          record_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "committee_meeting_item_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_meeting_item_links_meeting_item_id_fkey"
            columns: ["meeting_item_id"]
            isOneToOne: false
            referencedRelation: "committee_meeting_items"
            referencedColumns: ["id"]
          },
        ]
      }
      committee_meeting_items: {
        Row: {
          action_due_date: string | null
          action_owner_id: string | null
          action_text: string | null
          agenda_notes: string | null
          created_at: string
          decision: string | null
          id: string
          include_open_actions: boolean
          item_type: string
          linked_record_id: string | null
          linked_record_type: string | null
          meeting_id: string
          minutes: string | null
          presenter: string | null
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          action_due_date?: string | null
          action_owner_id?: string | null
          action_text?: string | null
          agenda_notes?: string | null
          created_at?: string
          decision?: string | null
          id?: string
          include_open_actions?: boolean
          item_type?: string
          linked_record_id?: string | null
          linked_record_type?: string | null
          meeting_id: string
          minutes?: string | null
          presenter?: string | null
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          action_due_date?: string | null
          action_owner_id?: string | null
          action_text?: string | null
          agenda_notes?: string | null
          created_at?: string
          decision?: string | null
          id?: string
          include_open_actions?: boolean
          item_type?: string
          linked_record_id?: string | null
          linked_record_type?: string | null
          meeting_id?: string
          minutes?: string | null
          presenter?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "committee_meeting_items_action_owner_id_fkey"
            columns: ["action_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_meeting_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "committee_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      committee_meetings: {
        Row: {
          agenda_template_id: string | null
          apology_ids: string[]
          attendee_ids: string[]
          committee_id: string
          created_at: string
          created_by: string | null
          id: string
          location: string | null
          scheduled_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          agenda_template_id?: string | null
          apology_ids?: string[]
          attendee_ids?: string[]
          committee_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          scheduled_at: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          agenda_template_id?: string | null
          apology_ids?: string[]
          attendee_ids?: string[]
          committee_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          scheduled_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "committee_meetings_agenda_template_id_fkey"
            columns: ["agenda_template_id"]
            isOneToOne: false
            referencedRelation: "committee_agenda_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_meetings_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_meetings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      committee_member_qualifications: {
        Row: {
          committee_member_id: string
          created_at: string
          created_by: string | null
          document_url: string | null
          expiry_date: string | null
          id: string
          issuer: string | null
          notes: string | null
          obtained_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          committee_member_id: string
          created_at?: string
          created_by?: string | null
          document_url?: string | null
          expiry_date?: string | null
          id?: string
          issuer?: string | null
          notes?: string | null
          obtained_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          committee_member_id?: string
          created_at?: string
          created_by?: string | null
          document_url?: string | null
          expiry_date?: string | null
          id?: string
          issuer?: string | null
          notes?: string | null
          obtained_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "committee_member_qualifications_committee_member_id_fkey"
            columns: ["committee_member_id"]
            isOneToOne: false
            referencedRelation: "committee_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_member_qualifications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      committee_members: {
        Row: {
          appointed_by: string | null
          appointment_notes: string | null
          committee_id: string
          created_at: string
          end_date: string | null
          id: string
          position_id: string
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          appointed_by?: string | null
          appointment_notes?: string | null
          committee_id: string
          created_at?: string
          end_date?: string | null
          id?: string
          position_id: string
          start_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          appointed_by?: string | null
          appointment_notes?: string | null
          committee_id?: string
          created_at?: string
          end_date?: string | null
          id?: string
          position_id?: string
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "committee_members_appointed_by_fkey"
            columns: ["appointed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_members_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_members_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "committee_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      committee_messages: {
        Row: {
          body: string
          committee_id: string
          created_at: string
          edited_at: string | null
          id: string
          reply_to_id: string | null
          user_id: string
        }
        Insert: {
          body: string
          committee_id: string
          created_at?: string
          edited_at?: string | null
          id?: string
          reply_to_id?: string | null
          user_id: string
        }
        Update: {
          body?: string
          committee_id?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          reply_to_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "committee_messages_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "committee_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      committee_poll_answers: {
        Row: {
          free_text: string | null
          id: string
          question_id: string
          response_id: string
          selected_options: Json
        }
        Insert: {
          free_text?: string | null
          id?: string
          question_id: string
          response_id: string
          selected_options?: Json
        }
        Update: {
          free_text?: string | null
          id?: string
          question_id?: string
          response_id?: string
          selected_options?: Json
        }
        Relationships: [
          {
            foreignKeyName: "committee_poll_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "committee_poll_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_poll_answers_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "committee_poll_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      committee_poll_questions: {
        Row: {
          created_at: string
          id: string
          options: Json
          poll_id: string
          prompt: string
          question_type: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          options?: Json
          poll_id: string
          prompt: string
          question_type: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          options?: Json
          poll_id?: string
          prompt?: string
          question_type?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "committee_poll_questions_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "committee_polls"
            referencedColumns: ["id"]
          },
        ]
      }
      committee_poll_responses: {
        Row: {
          id: string
          poll_id: string
          submitted_at: string
          user_id: string
        }
        Insert: {
          id?: string
          poll_id: string
          submitted_at?: string
          user_id: string
        }
        Update: {
          id?: string
          poll_id?: string
          submitted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "committee_poll_responses_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "committee_polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_poll_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      committee_polls: {
        Row: {
          closes_at: string | null
          committee_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          closes_at?: string | null
          committee_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          closes_at?: string | null
          committee_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "committee_polls_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_polls_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      committee_positions: {
        Row: {
          committee_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_president: boolean
          permissions: Json
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          committee_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_president?: boolean
          permissions?: Json
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          committee_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_president?: boolean
          permissions?: Json
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "committee_positions_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
        ]
      }
      committees: {
        Row: {
          association_id: string
          club_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          scope_type: string
          updated_at: string
        }
        Insert: {
          association_id: string
          club_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          scope_type: string
          updated_at?: string
        }
        Update: {
          association_id?: string
          club_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          scope_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "committees_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committees_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committees_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_channels: {
        Row: {
          association_id: string | null
          club_id: string | null
          created_at: string
          id: string
          scope_type: string
          team_id: string | null
        }
        Insert: {
          association_id?: string | null
          club_id?: string | null
          created_at?: string
          id?: string
          scope_type: string
          team_id?: string | null
        }
        Update: {
          association_id?: string | null
          club_id?: string | null
          created_at?: string
          id?: string
          scope_type?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_channels_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_channels_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_channels_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_email_deliveries: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          id: string
          last_attempt_at: string | null
          last_error: string | null
          message_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          message_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          message_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_email_deliveries_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "communication_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_email_deliveries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_mentions: {
        Row: {
          created_at: string
          id: string
          mentioned_user_id: string
          message_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mentioned_user_id: string
          message_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mentioned_user_id?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_mentions_mentioned_user_id_fkey"
            columns: ["mentioned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_mentions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "communication_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_message_revisions: {
        Row: {
          content: string
          edited_at: string
          edited_by: string
          id: string
          message_id: string
          revision_number: number
        }
        Insert: {
          content: string
          edited_at?: string
          edited_by: string
          id?: string
          message_id: string
          revision_number: number
        }
        Update: {
          content?: string
          edited_at?: string
          edited_by?: string
          id?: string
          message_id?: string
          revision_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "communication_message_revisions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "communication_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_messages: {
        Row: {
          author_id: string
          channel_id: string
          content: string
          created_at: string
          edited_at: string | null
          id: string
          is_important: boolean
          message_type: string
          moderation_reason: string | null
          removed_at: string | null
          removed_by: string | null
          reply_to_id: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          channel_id: string
          content: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_important?: boolean
          message_type: string
          moderation_reason?: string | null
          removed_at?: string | null
          removed_by?: string | null
          reply_to_id?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          channel_id?: string
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_important?: boolean
          message_type?: string
          moderation_reason?: string | null
          removed_at?: string | null
          removed_by?: string | null
          reply_to_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "communication_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_messages_removed_by_fkey"
            columns: ["removed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "communication_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_moderation_audit: {
        Row: {
          action: string
          actor_id: string
          channel_id: string
          created_at: string
          id: string
          message_id: string
          previous_content: string
          reason: string | null
          replacement_content: string | null
        }
        Insert: {
          action: string
          actor_id: string
          channel_id: string
          created_at?: string
          id?: string
          message_id: string
          previous_content: string
          reason?: string | null
          replacement_content?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          channel_id?: string
          created_at?: string
          id?: string
          message_id?: string
          previous_content?: string
          reason?: string | null
          replacement_content?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_moderation_audit_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_moderation_audit_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "communication_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_moderation_audit_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "communication_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_permissions: {
        Row: {
          can_moderate: boolean
          can_publish: boolean
          channel_id: string
          created_at: string
          granted_by: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_moderate?: boolean
          can_publish?: boolean
          channel_id: string
          created_at?: string
          granted_by: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_moderate?: boolean
          can_publish?: boolean
          channel_id?: string
          created_at?: string
          granted_by?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_permissions_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "communication_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "communication_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_read_state: {
        Row: {
          channel_id: string
          last_read_at: string
          last_read_message_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          last_read_at?: string
          last_read_message_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          last_read_at?: string
          last_read_message_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_read_state_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "communication_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_read_state_last_read_message_id_fkey"
            columns: ["last_read_message_id"]
            isOneToOne: false
            referencedRelation: "communication_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_read_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      competitions: {
        Row: {
          association_id: string
          created_at: string | null
          id: string
          is_active: boolean
          name: string
          revsports_competition_id: string | null
          season_id: string
          updated_at: string | null
        }
        Insert: {
          association_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          revsports_competition_id?: string | null
          season_id: string
          updated_at?: string | null
        }
        Update: {
          association_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          revsports_competition_id?: string | null
          season_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competitions_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      divisions: {
        Row: {
          age_group: string | null
          association_id: string
          competition_id: string | null
          created_at: string
          default_match_duration_minutes: number | null
          gender: string | null
          id: string
          max_age: number | null
          min_age: number | null
          name: string
          season_id: string | null
          umpire_vote_scheme_key: string
        }
        Insert: {
          age_group?: string | null
          association_id: string
          competition_id?: string | null
          created_at?: string
          default_match_duration_minutes?: number | null
          gender?: string | null
          id?: string
          max_age?: number | null
          min_age?: number | null
          name: string
          season_id?: string | null
          umpire_vote_scheme_key?: string
        }
        Update: {
          age_group?: string | null
          association_id?: string
          competition_id?: string | null
          created_at?: string
          default_match_duration_minutes?: number | null
          gender?: string | null
          id?: string
          max_age?: number | null
          min_age?: number | null
          name?: string
          season_id?: string | null
          umpire_vote_scheme_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "divisions_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "divisions_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "divisions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      error_logs: {
        Row: {
          context: string | null
          created_at: string
          details: Json | null
          id: string
          message: string
          page_url: string | null
          user_id: string | null
        }
        Insert: {
          context?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          message: string
          page_url?: string | null
          user_id?: string | null
        }
        Update: {
          context?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          message?: string
          page_url?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      external_entities: {
        Row: {
          association_name: string | null
          club_name: string | null
          competition_name: string | null
          created_at: string
          entity_type: string
          external_id: string | null
          external_name: string
          first_seen_at: string
          grade: string | null
          id: string
          last_seen_at: string
          raw_data: Json
          source: string
          source_url: string | null
          status: string
          team_name: string | null
          updated_at: string
        }
        Insert: {
          association_name?: string | null
          club_name?: string | null
          competition_name?: string | null
          created_at?: string
          entity_type: string
          external_id?: string | null
          external_name: string
          first_seen_at?: string
          grade?: string | null
          id?: string
          last_seen_at?: string
          raw_data?: Json
          source?: string
          source_url?: string | null
          status?: string
          team_name?: string | null
          updated_at?: string
        }
        Update: {
          association_name?: string | null
          club_name?: string | null
          competition_name?: string | null
          created_at?: string
          entity_type?: string
          external_id?: string | null
          external_name?: string
          first_seen_at?: string
          grade?: string | null
          id?: string
          last_seen_at?: string
          raw_data?: Json
          source?: string
          source_url?: string | null
          status?: string
          team_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      external_entity_links: {
        Row: {
          confidence: string
          created_at: string
          external_entity_id: string
          id: string
          matched_at: string | null
          matched_by: string | null
          notes: string | null
          status: string
          target_id: string | null
          target_table: string
          updated_at: string
        }
        Insert: {
          confidence?: string
          created_at?: string
          external_entity_id: string
          id?: string
          matched_at?: string | null
          matched_by?: string | null
          notes?: string | null
          status?: string
          target_id?: string | null
          target_table: string
          updated_at?: string
        }
        Update: {
          confidence?: string
          created_at?: string
          external_entity_id?: string
          id?: string
          matched_at?: string | null
          matched_by?: string | null
          notes?: string | null
          status?: string
          target_id?: string | null
          target_table?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_entity_links_external_entity_id_fkey"
            columns: ["external_entity_id"]
            isOneToOne: false
            referencedRelation: "external_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_entity_links_matched_by_fkey"
            columns: ["matched_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      field_templates: {
        Row: {
          association_id: string | null
          background_image_url: string | null
          club_id: string | null
          code: string | null
          created_at: string
          created_by: string | null
          default_icon_id: string | null
          grid_columns: number
          grid_rows: number
          id: string
          is_active: boolean
          name: string
          owner_scope: Database["public"]["Enums"]["formation_owner_scope"]
          pitch_boundary_height: number
          pitch_boundary_width: number
          pitch_boundary_x: number
          pitch_boundary_y: number
          position_icon_size: number
          sport: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          association_id?: string | null
          background_image_url?: string | null
          club_id?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          default_icon_id?: string | null
          grid_columns?: number
          grid_rows?: number
          id?: string
          is_active?: boolean
          name: string
          owner_scope: Database["public"]["Enums"]["formation_owner_scope"]
          pitch_boundary_height?: number
          pitch_boundary_width?: number
          pitch_boundary_x?: number
          pitch_boundary_y?: number
          position_icon_size?: number
          sport?: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          association_id?: string | null
          background_image_url?: string | null
          club_id?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          default_icon_id?: string | null
          grid_columns?: number
          grid_rows?: number
          id?: string
          is_active?: boolean
          name?: string
          owner_scope?: Database["public"]["Enums"]["formation_owner_scope"]
          pitch_boundary_height?: number
          pitch_boundary_width?: number
          pitch_boundary_x?: number
          pitch_boundary_y?: number
          position_icon_size?: number
          sport?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_templates_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_templates_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_templates_default_icon_id_fkey"
            columns: ["default_icon_id"]
            isOneToOne: false
            referencedRelation: "formation_icons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_templates_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      fixture_availability: {
        Row: {
          fixture_id: string
          id: string
          note: string | null
          status: Database["public"]["Enums"]["availability_status_enum"]
          updated_at: string
          user_id: string
        }
        Insert: {
          fixture_id: string
          id?: string
          note?: string | null
          status?: Database["public"]["Enums"]["availability_status_enum"]
          updated_at?: string
          user_id: string
        }
        Update: {
          fixture_id?: string
          id?: string
          note?: string | null
          status?: Database["public"]["Enums"]["availability_status_enum"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixture_availability_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixture_availability_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fixture_fill_ins: {
        Row: {
          access_expires_at: string
          access_starts_at: string
          added_by: string | null
          created_at: string
          fixture_id: string
          id: string
          player_id: string
          removal_reason: string | null
          removed_at: string | null
          removed_by: string | null
          status: string
          team_id: string
          updated_at: string
        }
        Insert: {
          access_expires_at: string
          access_starts_at?: string
          added_by?: string | null
          created_at?: string
          fixture_id: string
          id?: string
          player_id: string
          removal_reason?: string | null
          removed_at?: string | null
          removed_by?: string | null
          status?: string
          team_id: string
          updated_at?: string
        }
        Update: {
          access_expires_at?: string
          access_starts_at?: string
          added_by?: string | null
          created_at?: string
          fixture_id?: string
          id?: string
          player_id?: string
          removal_reason?: string | null
          removed_at?: string | null
          removed_by?: string | null
          status?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixture_fill_ins_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixture_fill_ins_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixture_fill_ins_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixture_fill_ins_removed_by_fkey"
            columns: ["removed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixture_fill_ins_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      fixture_lineup_assignments: {
        Row: {
          created_at: string
          fixture_lineup_id: string
          formation_position_id: string | null
          id: string
          is_starting: boolean
          player_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          fixture_lineup_id: string
          formation_position_id?: string | null
          id?: string
          is_starting?: boolean
          player_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          fixture_lineup_id?: string
          formation_position_id?: string | null
          id?: string
          is_starting?: boolean
          player_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixture_lineup_assignments_fixture_lineup_id_fkey"
            columns: ["fixture_lineup_id"]
            isOneToOne: false
            referencedRelation: "fixture_lineups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixture_lineup_assignments_formation_position_id_fkey"
            columns: ["formation_position_id"]
            isOneToOne: false
            referencedRelation: "formation_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixture_lineup_assignments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fixture_lineups: {
        Row: {
          created_at: string
          created_by: string | null
          fixture_id: string
          formation_id: string | null
          id: string
          published_at: string | null
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          fixture_id: string
          formation_id?: string | null
          id?: string
          published_at?: string | null
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          fixture_id?: string
          formation_id?: string | null
          id?: string
          published_at?: string | null
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixture_lineups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixture_lineups_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixture_lineups_formation_id_fkey"
            columns: ["formation_id"]
            isOneToOne: false
            referencedRelation: "formations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixture_lineups_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      fixtures: {
        Row: {
          away_score: number | null
          away_team_id: string | null
          created_at: string
          division_id: string | null
          fixture_date: string | null
          home_score: number | null
          home_team_id: string
          id: string
          notes: string | null
          pitch_id: string | null
          revsports_match_url: string | null
          round_name: string | null
          round_number: number | null
          scheduled_end_at: string | null
          season_id: string | null
          status: Database["public"]["Enums"]["fixture_status_enum"]
          updated_at: string
          venue_id: string | null
        }
        Insert: {
          away_score?: number | null
          away_team_id?: string | null
          created_at?: string
          division_id?: string | null
          fixture_date?: string | null
          home_score?: number | null
          home_team_id: string
          id?: string
          notes?: string | null
          pitch_id?: string | null
          revsports_match_url?: string | null
          round_name?: string | null
          round_number?: number | null
          scheduled_end_at?: string | null
          season_id?: string | null
          status?: Database["public"]["Enums"]["fixture_status_enum"]
          updated_at?: string
          venue_id?: string | null
        }
        Update: {
          away_score?: number | null
          away_team_id?: string | null
          created_at?: string
          division_id?: string | null
          fixture_date?: string | null
          home_score?: number | null
          home_team_id?: string
          id?: string
          notes?: string | null
          pitch_id?: string | null
          revsports_match_url?: string | null
          round_name?: string | null
          round_number?: number | null
          scheduled_end_at?: string | null
          season_id?: string | null
          status?: Database["public"]["Enums"]["fixture_status_enum"]
          updated_at?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fixtures_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_pitch_id_fkey"
            columns: ["pitch_id"]
            isOneToOne: false
            referencedRelation: "pitches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      fixtures_backup_20260625: {
        Row: {
          away_score: number | null
          away_team_id: string | null
          created_at: string | null
          division_id: string | null
          fixture_date: string | null
          home_score: number | null
          home_team_id: string | null
          id: string | null
          notes: string | null
          pitch_id: string | null
          revsports_match_url: string | null
          round_name: string | null
          round_number: number | null
          season_id: string | null
          status: Database["public"]["Enums"]["fixture_status_enum"] | null
          updated_at: string | null
          venue_id: string | null
        }
        Insert: {
          away_score?: number | null
          away_team_id?: string | null
          created_at?: string | null
          division_id?: string | null
          fixture_date?: string | null
          home_score?: number | null
          home_team_id?: string | null
          id?: string | null
          notes?: string | null
          pitch_id?: string | null
          revsports_match_url?: string | null
          round_name?: string | null
          round_number?: number | null
          season_id?: string | null
          status?: Database["public"]["Enums"]["fixture_status_enum"] | null
          updated_at?: string | null
          venue_id?: string | null
        }
        Update: {
          away_score?: number | null
          away_team_id?: string | null
          created_at?: string | null
          division_id?: string | null
          fixture_date?: string | null
          home_score?: number | null
          home_team_id?: string | null
          id?: string | null
          notes?: string | null
          pitch_id?: string | null
          revsports_match_url?: string | null
          round_name?: string | null
          round_number?: number | null
          season_id?: string | null
          status?: Database["public"]["Enums"]["fixture_status_enum"] | null
          updated_at?: string | null
          venue_id?: string | null
        }
        Relationships: []
      }
      formation_icons: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          is_custom: boolean
          lucide_icon: string | null
          name: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_custom?: boolean
          lucide_icon?: string | null
          name: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_custom?: boolean
          lucide_icon?: string | null
          name?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "formation_icons_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      formation_positions: {
        Row: {
          canonical_group: string | null
          code: string
          created_at: string
          formation_id: string
          grid_x: number
          grid_y: number
          icon_id: string | null
          id: string
          is_starting_slot: boolean
          name: string
          sort_order: number
          updated_at: string
          x_percent: number
          y_percent: number
          zone: string | null
        }
        Insert: {
          canonical_group?: string | null
          code: string
          created_at?: string
          formation_id: string
          grid_x: number
          grid_y: number
          icon_id?: string | null
          id?: string
          is_starting_slot?: boolean
          name: string
          sort_order?: number
          updated_at?: string
          x_percent: number
          y_percent: number
          zone?: string | null
        }
        Update: {
          canonical_group?: string | null
          code?: string
          created_at?: string
          formation_id?: string
          grid_x?: number
          grid_y?: number
          icon_id?: string | null
          id?: string
          is_starting_slot?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
          x_percent?: number
          y_percent?: number
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "formation_positions_canonical_group_fkey"
            columns: ["canonical_group"]
            isOneToOne: false
            referencedRelation: "sport_position_groups"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "formation_positions_formation_id_fkey"
            columns: ["formation_id"]
            isOneToOne: false
            referencedRelation: "formations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formation_positions_icon_id_fkey"
            columns: ["icon_id"]
            isOneToOne: false
            referencedRelation: "formation_icons"
            referencedColumns: ["id"]
          },
        ]
      }
      formations: {
        Row: {
          association_id: string | null
          background_image_url: string | null
          club_id: string | null
          code: string | null
          created_at: string
          created_by: string | null
          description: string | null
          field_template_id: string | null
          grid_columns: number
          grid_rows: number
          id: string
          is_default: boolean
          name: string
          owner_scope: Database["public"]["Enums"]["formation_owner_scope"]
          pitch_boundary_height: number
          pitch_boundary_width: number
          pitch_boundary_x: number
          pitch_boundary_y: number
          position_icon_size: number
          team_id: string | null
          updated_at: string
        }
        Insert: {
          association_id?: string | null
          background_image_url?: string | null
          club_id?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          field_template_id?: string | null
          grid_columns: number
          grid_rows: number
          id?: string
          is_default?: boolean
          name: string
          owner_scope: Database["public"]["Enums"]["formation_owner_scope"]
          pitch_boundary_height?: number
          pitch_boundary_width?: number
          pitch_boundary_x?: number
          pitch_boundary_y?: number
          position_icon_size?: number
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          association_id?: string | null
          background_image_url?: string | null
          club_id?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          field_template_id?: string | null
          grid_columns?: number
          grid_rows?: number
          id?: string
          is_default?: boolean
          name?: string
          owner_scope?: Database["public"]["Enums"]["formation_owner_scope"]
          pitch_boundary_height?: number
          pitch_boundary_width?: number
          pitch_boundary_x?: number
          pitch_boundary_y?: number
          position_icon_size?: number
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "formations_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formations_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formations_field_template_id_fkey"
            columns: ["field_template_id"]
            isOneToOne: false
            referencedRelation: "field_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      lineups: {
        Row: {
          created_at: string
          fixture_id: string
          id: string
          is_starting: boolean
          player_id: string
          position: string | null
          team_id: string
        }
        Insert: {
          created_at?: string
          fixture_id: string
          id?: string
          is_starting?: boolean
          player_id: string
          position?: string | null
          team_id: string
        }
        Update: {
          created_at?: string
          fixture_id?: string
          id?: string
          is_starting?: boolean
          player_id?: string
          position?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lineups_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      module_feature_flags: {
        Row: {
          association_id: string | null
          club_id: string | null
          created_at: string
          created_by: string | null
          division_id: string | null
          enabled: boolean
          id: string
          module_key: string
          notes: string | null
          scope_id: string
          scope_type: string
          team_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          association_id?: string | null
          club_id?: string | null
          created_at?: string
          created_by?: string | null
          division_id?: string | null
          enabled: boolean
          id?: string
          module_key: string
          notes?: string | null
          scope_id: string
          scope_type: string
          team_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          association_id?: string | null
          club_id?: string | null
          created_at?: string
          created_by?: string | null
          division_id?: string | null
          enabled?: boolean
          id?: string
          module_key?: string
          notes?: string | null
          scope_id?: string
          scope_type?: string
          team_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "module_feature_flags_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_feature_flags_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_feature_flags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_feature_flags_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_feature_flags_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_feature_flags_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mvp_result_checks: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          response: string
          result_check_round: number
          session_id: string
          voter_profile_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          response: string
          result_check_round: number
          session_id: string
          voter_profile_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          response?: string
          result_check_round?: number
          session_id?: string
          voter_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mvp_result_checks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "mvp_voting_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mvp_result_checks_voter_profile_id_fkey"
            columns: ["voter_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mvp_tokens: {
        Row: {
          away_team: string
          created_at: string | null
          date: string
          grade: string
          home_team: string
          id: string
          is_closed: boolean
          match_url: string
          round: string
          shoutout: string | null
          token: string
          voted_at: string | null
          voter_name: string
        }
        Insert: {
          away_team?: string
          created_at?: string | null
          date?: string
          grade?: string
          home_team?: string
          id?: string
          is_closed?: boolean
          match_url: string
          round?: string
          shoutout?: string | null
          token: string
          voted_at?: string | null
          voter_name: string
        }
        Update: {
          away_team?: string
          created_at?: string | null
          date?: string
          grade?: string
          home_team?: string
          id?: string
          is_closed?: boolean
          match_url?: string
          round?: string
          shoutout?: string | null
          token?: string
          voted_at?: string | null
          voter_name?: string
        }
        Relationships: []
      }
      mvp_vote_audit: {
        Row: {
          action: string
          changed_at: string | null
          changed_by: string | null
          details: Json
          id: string
          new_data: Json | null
          old_data: Json | null
          reason: string | null
          session_id: string | null
          team_id: string | null
          vote_id: string | null
          voter_profile_id: string | null
        }
        Insert: {
          action: string
          changed_at?: string | null
          changed_by?: string | null
          details?: Json
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          reason?: string | null
          session_id?: string | null
          team_id?: string | null
          vote_id?: string | null
          voter_profile_id?: string | null
        }
        Update: {
          action?: string
          changed_at?: string | null
          changed_by?: string | null
          details?: Json
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          reason?: string | null
          session_id?: string | null
          team_id?: string | null
          vote_id?: string | null
          voter_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mvp_vote_audit_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mvp_vote_audit_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "mvp_voting_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mvp_vote_audit_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mvp_vote_audit_vote_id_fkey"
            columns: ["vote_id"]
            isOneToOne: false
            referencedRelation: "mvp_votes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mvp_vote_audit_voter_profile_id_fkey"
            columns: ["voter_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mvp_vote_submissions: {
        Row: {
          created_at: string
          id: string
          session_id: string
          shoutout: string | null
          submitted_at: string
          voter_profile_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          session_id: string
          shoutout?: string | null
          submitted_at?: string
          voter_profile_id: string
        }
        Update: {
          created_at?: string
          id?: string
          session_id?: string
          shoutout?: string | null
          submitted_at?: string
          voter_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mvp_vote_submissions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "mvp_voting_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mvp_vote_submissions_voter_profile_id_fkey"
            columns: ["voter_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mvp_vote_tokens: {
        Row: {
          created_at: string | null
          email_sent_at: string | null
          id: string
          reminder_24h_sent_at: string | null
          reminder_48h_sent_at: string | null
          revsports_player_id: string
          session_id: string
          shoutout: string | null
          token: string
          voted_at: string | null
        }
        Insert: {
          created_at?: string | null
          email_sent_at?: string | null
          id?: string
          reminder_24h_sent_at?: string | null
          reminder_48h_sent_at?: string | null
          revsports_player_id: string
          session_id: string
          shoutout?: string | null
          token?: string
          voted_at?: string | null
        }
        Update: {
          created_at?: string | null
          email_sent_at?: string | null
          id?: string
          reminder_24h_sent_at?: string | null
          reminder_48h_sent_at?: string | null
          revsports_player_id?: string
          session_id?: string
          shoutout?: string | null
          token?: string
          voted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mvp_vote_tokens_revsports_player_id_fkey"
            columns: ["revsports_player_id"]
            isOneToOne: false
            referencedRelation: "revsports_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mvp_vote_tokens_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "mvp_voting_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      mvp_votes: {
        Row: {
          created_at: string | null
          id: string
          player_id: string
          points: number
          session_id: string | null
          token_id: string | null
          updated_at: string | null
          updated_by: string | null
          voter_profile_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          player_id: string
          points: number
          session_id?: string | null
          token_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          voter_profile_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          player_id?: string
          points?: number
          session_id?: string | null
          token_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          voter_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mvp_votes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "mvp_voting_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mvp_votes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mvp_votes_voted_for_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "revsports_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mvp_votes_voter_profile_id_fkey"
            columns: ["voter_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mvp_votes_voter_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "mvp_vote_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      mvp_voting_email_events: {
        Row: {
          created_at: string
          email: string | null
          error_message: string | null
          event_type: string
          id: string
          profile_id: string
          session_id: string
          status: string
          voting_cycle: number
        }
        Insert: {
          created_at?: string
          email?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          profile_id: string
          session_id: string
          status: string
          voting_cycle?: number
        }
        Update: {
          created_at?: string
          email?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          profile_id?: string
          session_id?: string
          status?: string
          voting_cycle?: number
        }
        Relationships: [
          {
            foreignKeyName: "mvp_voting_email_events_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mvp_voting_email_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "mvp_voting_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      mvp_voting_sessions: {
        Row: {
          away_team: string | null
          closed_at: string | null
          closed_by: string | null
          closes_at: string | null
          created_at: string | null
          created_by: string | null
          fixture_id: string | null
          game_date: string | null
          grade: string | null
          home_team: string | null
          id: string
          locked_at: string | null
          locked_by: string | null
          locked_reason: string | null
          match_url: string | null
          opened_at: string | null
          opened_by: string | null
          result_check_round: number
          results_confirmed_at: string | null
          results_confirmed_by: string | null
          round: string | null
          status: Database["public"]["Enums"]["mvp_session_status"]
          team_id: string | null
          voting_cycle: number
        }
        Insert: {
          away_team?: string | null
          closed_at?: string | null
          closed_by?: string | null
          closes_at?: string | null
          created_at?: string | null
          created_by?: string | null
          fixture_id?: string | null
          game_date?: string | null
          grade?: string | null
          home_team?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          locked_reason?: string | null
          match_url?: string | null
          opened_at?: string | null
          opened_by?: string | null
          result_check_round?: number
          results_confirmed_at?: string | null
          results_confirmed_by?: string | null
          round?: string | null
          status?: Database["public"]["Enums"]["mvp_session_status"]
          team_id?: string | null
          voting_cycle?: number
        }
        Update: {
          away_team?: string | null
          closed_at?: string | null
          closed_by?: string | null
          closes_at?: string | null
          created_at?: string | null
          created_by?: string | null
          fixture_id?: string | null
          game_date?: string | null
          grade?: string | null
          home_team?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          locked_reason?: string | null
          match_url?: string | null
          opened_at?: string | null
          opened_by?: string | null
          result_check_round?: number
          results_confirmed_at?: string | null
          results_confirmed_by?: string | null
          round?: string | null
          status?: Database["public"]["Enums"]["mvp_session_status"]
          team_id?: string | null
          voting_cycle?: number
        }
        Relationships: [
          {
            foreignKeyName: "mvp_voting_sessions_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mvp_voting_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mvp_voting_sessions_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mvp_voting_sessions_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mvp_voting_sessions_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mvp_voting_sessions_results_confirmed_by_fkey"
            columns: ["results_confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mvp_voting_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      mvp_voting_sessions_backup_20260625: {
        Row: {
          away_team: string | null
          closes_at: string | null
          created_at: string | null
          created_by: string | null
          fixture_id: string | null
          game_date: string | null
          grade: string | null
          home_team: string | null
          id: string | null
          match_url: string | null
          opened_at: string | null
          round: string | null
          status: Database["public"]["Enums"]["mvp_session_status"] | null
        }
        Insert: {
          away_team?: string | null
          closes_at?: string | null
          created_at?: string | null
          created_by?: string | null
          fixture_id?: string | null
          game_date?: string | null
          grade?: string | null
          home_team?: string | null
          id?: string | null
          match_url?: string | null
          opened_at?: string | null
          round?: string | null
          status?: Database["public"]["Enums"]["mvp_session_status"] | null
        }
        Update: {
          away_team?: string | null
          closes_at?: string | null
          created_at?: string | null
          created_by?: string | null
          fixture_id?: string | null
          game_date?: string | null
          grade?: string | null
          home_team?: string | null
          id?: string | null
          match_url?: string | null
          opened_at?: string | null
          round?: string | null
          status?: Database["public"]["Enums"]["mvp_session_status"] | null
        }
        Relationships: []
      }
      notification_category_preferences: {
        Row: {
          category: string
          email_enabled: boolean
          in_app_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          email_enabled?: boolean
          in_app_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          email_enabled?: boolean
          in_app_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_category_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          email_enabled: boolean
          id: string
          push_enabled: boolean
          user_id: string
        }
        Insert: {
          email_enabled?: boolean
          id?: string
          push_enabled?: boolean
          user_id: string
        }
        Update: {
          email_enabled?: boolean
          id?: string
          push_enabled?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string | null
          communication_message_id: string | null
          created_at: string
          dedupe_key: string | null
          fixture_id: string | null
          game_id: string | null
          id: string
          message: string
          read: boolean
          team_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          body?: string | null
          communication_message_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          fixture_id?: string | null
          game_id?: string | null
          id?: string
          message?: string
          read?: boolean
          team_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          body?: string | null
          communication_message_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          fixture_id?: string | null
          game_id?: string | null
          id?: string
          message?: string
          read?: boolean
          team_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_communication_message_id_fkey"
            columns: ["communication_message_id"]
            isOneToOne: false
            referencedRelation: "communication_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_signups: {
        Row: {
          association_id: string | null
          club_id: string | null
          created_at: string
          first_name: string | null
          last_name: string | null
          team_id: string | null
          user_id: string
        }
        Insert: {
          association_id?: string | null
          club_id?: string | null
          created_at?: string
          first_name?: string | null
          last_name?: string | null
          team_id?: string | null
          user_id: string
        }
        Update: {
          association_id?: string | null
          club_id?: string | null
          created_at?: string
          first_name?: string | null
          last_name?: string | null
          team_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_signups_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_signups_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_signups_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_assignments: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          permission_set_id: string
          scope_id: string
          scope_type: string
          subject_key: string
          subject_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          permission_set_id: string
          scope_id: string
          scope_type: string
          subject_key: string
          subject_type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          permission_set_id?: string
          scope_id?: string
          scope_type?: string
          subject_key?: string
          subject_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "permission_assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_assignments_permission_set_id_fkey"
            columns: ["permission_set_id"]
            isOneToOne: false
            referencedRelation: "permission_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_assignments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_catalogue: {
        Row: {
          category: string
          created_at: string
          default_allowed: boolean
          description: string
          label: string
          module_key: string
          permission_key: string
        }
        Insert: {
          category?: string
          created_at?: string
          default_allowed?: boolean
          description: string
          label: string
          module_key: string
          permission_key: string
        }
        Update: {
          category?: string
          created_at?: string
          default_allowed?: boolean
          description?: string
          label?: string
          module_key?: string
          permission_key?: string
        }
        Relationships: []
      }
      permission_group_members: {
        Row: {
          added_at: string
          added_by: string | null
          group_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          group_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          group_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_group_members_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "permission_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_groups: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          scope_id: string
          scope_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          scope_id: string
          scope_type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          scope_id?: string
          scope_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "permission_groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_groups_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_overrides: {
        Row: {
          active: boolean
          allowed: boolean
          created_at: string
          created_by: string | null
          id: string
          permission_key: string
          reason: string | null
          scope_id: string
          scope_type: string
          subject_key: string
          subject_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          allowed: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          permission_key: string
          reason?: string | null
          scope_id: string
          scope_type: string
          subject_key: string
          subject_type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          allowed?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          permission_key?: string
          reason?: string | null
          scope_id?: string
          scope_type?: string
          subject_key?: string
          subject_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "permission_overrides_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_overrides_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permission_catalogue"
            referencedColumns: ["permission_key"]
          },
          {
            foreignKeyName: "permission_overrides_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_set_permissions: {
        Row: {
          allowed: boolean
          permission_key: string
          permission_set_id: string
        }
        Insert: {
          allowed: boolean
          permission_key: string
          permission_set_id: string
        }
        Update: {
          allowed?: boolean
          permission_key?: string
          permission_set_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_set_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permission_catalogue"
            referencedColumns: ["permission_key"]
          },
          {
            foreignKeyName: "permission_set_permissions_permission_set_id_fkey"
            columns: ["permission_set_id"]
            isOneToOne: false
            referencedRelation: "permission_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_sets: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          owner_scope_id: string
          owner_scope_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          owner_scope_id: string
          owner_scope_type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          owner_scope_id?: string
          owner_scope_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "permission_sets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_sets_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pitches: {
        Row: {
          id: string
          name: string
          surface_type: string | null
          venue_id: string
        }
        Insert: {
          id?: string
          name: string
          surface_type?: string | null
          venue_id: string
        }
        Update: {
          id?: string
          name?: string
          surface_type?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pitches_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      player_position_preferences: {
        Row: {
          canonical_group: string | null
          created_at: string
          id: string
          player_id: string
          position_code: string
          preference: number
          team_id: string | null
          updated_at: string
        }
        Insert: {
          canonical_group?: string | null
          created_at?: string
          id?: string
          player_id: string
          position_code: string
          preference: number
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          canonical_group?: string | null
          created_at?: string
          id?: string
          player_id?: string
          position_code?: string
          preference?: number
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_position_preferences_canonical_group_fkey"
            columns: ["canonical_group"]
            isOneToOne: false
            referencedRelation: "sport_position_groups"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "player_position_preferences_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_position_preferences_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      player_vote_edits: {
        Row: {
          changed_at: string
          changed_by_id: string | null
          field_name: string
          id: string
          new_value: string | null
          original_value: string | null
          submission_id: string
        }
        Insert: {
          changed_at?: string
          changed_by_id?: string | null
          field_name: string
          id?: string
          new_value?: string | null
          original_value?: string | null
          submission_id: string
        }
        Update: {
          changed_at?: string
          changed_by_id?: string | null
          field_name?: string
          id?: string
          new_value?: string | null
          original_value?: string | null
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_vote_edits_changed_by_id_fkey"
            columns: ["changed_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_vote_edits_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "player_vote_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      player_vote_lines: {
        Row: {
          created_at: string
          custom_team: string | null
          id: string
          player_name: string
          player_number: number | null
          profile_id: string | null
          scheme_line_key: string | null
          submission_id: string
          team_id: string | null
          votes: number
        }
        Insert: {
          created_at?: string
          custom_team?: string | null
          id?: string
          player_name?: string
          player_number?: number | null
          profile_id?: string | null
          scheme_line_key?: string | null
          submission_id: string
          team_id?: string | null
          votes: number
        }
        Update: {
          created_at?: string
          custom_team?: string | null
          id?: string
          player_name?: string
          player_number?: number | null
          profile_id?: string | null
          scheme_line_key?: string | null
          submission_id?: string
          team_id?: string | null
          votes?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_vote_lines_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_vote_lines_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "player_vote_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_vote_lines_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      player_vote_submissions: {
        Row: {
          association_id: string | null
          away_team_id: string | null
          custom_away_team: string | null
          custom_division: string | null
          custom_home_team: string | null
          custom_round: string | null
          deleted_at: string | null
          deleted_by: string | null
          division_id: string | null
          fixture_id: string | null
          home_team_id: string | null
          id: string
          is_approved: boolean
          is_deleted: boolean
          is_locked: boolean
          is_public_submission: boolean
          legacy_umpire_email: string | null
          proxy_reason: string | null
          proxy_submitter_id: string | null
          proxy_submitter_name: string | null
          proxy_umpire_name: string | null
          public_duplicate_key: string | null
          public_idempotency_key: string | null
          public_identity_status: string | null
          public_submission_reference: string | null
          public_submitter_email: string | null
          public_submitter_name: string | null
          round_number: number | null
          submitted_at: string
          submitted_by_admin_id: string | null
          submitted_by_admin_name: string | null
          umpire_user_id: string | null
          updated_at: string
          vote_scheme_key: string | null
        }
        Insert: {
          association_id?: string | null
          away_team_id?: string | null
          custom_away_team?: string | null
          custom_division?: string | null
          custom_home_team?: string | null
          custom_round?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          division_id?: string | null
          fixture_id?: string | null
          home_team_id?: string | null
          id?: string
          is_approved?: boolean
          is_deleted?: boolean
          is_locked?: boolean
          is_public_submission?: boolean
          legacy_umpire_email?: string | null
          proxy_reason?: string | null
          proxy_submitter_id?: string | null
          proxy_submitter_name?: string | null
          proxy_umpire_name?: string | null
          public_duplicate_key?: string | null
          public_idempotency_key?: string | null
          public_identity_status?: string | null
          public_submission_reference?: string | null
          public_submitter_email?: string | null
          public_submitter_name?: string | null
          round_number?: number | null
          submitted_at?: string
          submitted_by_admin_id?: string | null
          submitted_by_admin_name?: string | null
          umpire_user_id?: string | null
          updated_at?: string
          vote_scheme_key?: string | null
        }
        Update: {
          association_id?: string | null
          away_team_id?: string | null
          custom_away_team?: string | null
          custom_division?: string | null
          custom_home_team?: string | null
          custom_round?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          division_id?: string | null
          fixture_id?: string | null
          home_team_id?: string | null
          id?: string
          is_approved?: boolean
          is_deleted?: boolean
          is_locked?: boolean
          is_public_submission?: boolean
          legacy_umpire_email?: string | null
          proxy_reason?: string | null
          proxy_submitter_id?: string | null
          proxy_submitter_name?: string | null
          proxy_umpire_name?: string | null
          public_duplicate_key?: string | null
          public_idempotency_key?: string | null
          public_identity_status?: string | null
          public_submission_reference?: string | null
          public_submitter_email?: string | null
          public_submitter_name?: string | null
          round_number?: number | null
          submitted_at?: string
          submitted_by_admin_id?: string | null
          submitted_by_admin_name?: string | null
          umpire_user_id?: string | null
          updated_at?: string
          vote_scheme_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_vote_submissions_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_vote_submissions_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_vote_submissions_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_vote_submissions_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_vote_submissions_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_vote_submissions_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_vote_submissions_proxy_submitter_id_fkey"
            columns: ["proxy_submitter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_vote_submissions_submitted_by_admin_id_fkey"
            columns: ["submitted_by_admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_vote_submissions_umpire_user_id_fkey"
            columns: ["umpire_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      primary_change_requests: {
        Row: {
          created_at: string
          from_team_id: string | null
          id: string
          requested_at: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          to_team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          from_team_id?: string | null
          id?: string
          requested_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          to_team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          from_team_id?: string | null
          id?: string
          requested_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          to_team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "primary_change_requests_from_team_id_fkey"
            columns: ["from_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "primary_change_requests_to_team_id_fkey"
            columns: ["to_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_claim_audit: {
        Row: {
          created_at: string
          id: string
          match_method: string | null
          match_value: string | null
          placeholder_profile_id: string | null
          real_profile_id: string | null
          reason: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_method?: string | null
          match_value?: string | null
          placeholder_profile_id?: string | null
          real_profile_id?: string | null
          reason?: string | null
          status: string
        }
        Update: {
          created_at?: string
          id?: string
          match_method?: string | null
          match_value?: string | null
          placeholder_profile_id?: string | null
          real_profile_id?: string | null
          reason?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_claim_audit_placeholder_profile_id_fkey"
            columns: ["placeholder_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_claim_audit_real_profile_id_fkey"
            columns: ["real_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_claim_reviews: {
        Row: {
          created_at: string
          id: string
          match_method: string
          match_value: string | null
          merged_at: string | null
          placeholder_profile_id: string | null
          real_profile_id: string | null
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_method: string
          match_value?: string | null
          merged_at?: string | null
          placeholder_profile_id?: string | null
          real_profile_id?: string | null
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          match_method?: string
          match_value?: string | null
          merged_at?: string | null
          placeholder_profile_id?: string | null
          real_profile_id?: string | null
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_claim_reviews_placeholder_profile_id_fkey"
            columns: ["placeholder_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_claim_reviews_real_profile_id_fkey"
            columns: ["real_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_claim_reviews_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          date_of_birth: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relationship: string | null
          first_name: string | null
          gender: string | null
          hockey_vic_number: string | null
          id: string
          is_placeholder: boolean
          is_umpire: boolean
          last_name: string | null
          phone: string | null
          registered_club_id: string | null
          revsports_player_id: string | null
          street_address: string | null
          suburb: string | null
          theme_preference: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          first_name?: string | null
          gender?: string | null
          hockey_vic_number?: string | null
          id: string
          is_placeholder?: boolean
          is_umpire?: boolean
          last_name?: string | null
          phone?: string | null
          registered_club_id?: string | null
          revsports_player_id?: string | null
          street_address?: string | null
          suburb?: string | null
          theme_preference?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          first_name?: string | null
          gender?: string | null
          hockey_vic_number?: string | null
          id?: string
          is_placeholder?: boolean
          is_umpire?: boolean
          last_name?: string | null
          phone?: string | null
          registered_club_id?: string | null
          revsports_player_id?: string | null
          street_address?: string | null
          suburb?: string | null
          theme_preference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_registered_club_id_fkey"
            columns: ["registered_club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      public_umpire_portal_events: {
        Row: {
          created_at: string
          event_type: string
          id: number
          key_hash: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: never
          key_hash: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: never
          key_hash?: string
        }
        Relationships: []
      }
      requests: {
        Row: {
          association_id: string | null
          cancelled_by: string | null
          club_id: string | null
          created_at: string
          id: string
          membership_type: string
          notes: string | null
          request_type: Database["public"]["Enums"]["request_type_enum"]
          requester_id: string
          responded_by: string | null
          status: Database["public"]["Enums"]["request_status_enum"]
          target_user_id: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          association_id?: string | null
          cancelled_by?: string | null
          club_id?: string | null
          created_at?: string
          id?: string
          membership_type?: string
          notes?: string | null
          request_type: Database["public"]["Enums"]["request_type_enum"]
          requester_id: string
          responded_by?: string | null
          status?: Database["public"]["Enums"]["request_status_enum"]
          target_user_id: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          association_id?: string | null
          cancelled_by?: string | null
          club_id?: string | null
          created_at?: string
          id?: string
          membership_type?: string
          notes?: string | null
          request_type?: Database["public"]["Enums"]["request_type_enum"]
          requester_id?: string
          responded_by?: string | null
          status?: Database["public"]["Enums"]["request_status_enum"]
          target_user_id?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requests_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      revsports_association_mappings: {
        Row: {
          association_id: string
          created_at: string | null
          id: string
          revsports_association_name: string
          updated_at: string | null
        }
        Insert: {
          association_id: string
          created_at?: string | null
          id?: string
          revsports_association_name: string
          updated_at?: string | null
        }
        Update: {
          association_id?: string
          created_at?: string | null
          id?: string
          revsports_association_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revsports_association_mappings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
      revsports_club_mappings: {
        Row: {
          club_id: string | null
          created_at: string | null
          id: string
          revsports_club_name: string
          updated_at: string | null
        }
        Insert: {
          club_id?: string | null
          created_at?: string | null
          id?: string
          revsports_club_name: string
          updated_at?: string | null
        }
        Update: {
          club_id?: string | null
          created_at?: string | null
          id?: string
          revsports_club_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revsports_club_mappings_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      revsports_competition_mappings: {
        Row: {
          competition_id: string
          created_at: string | null
          id: string
          notes: string | null
          revsports_competition_id: string | null
          revsports_competition_name: string
          status: string
          updated_at: string | null
        }
        Insert: {
          competition_id: string
          created_at?: string | null
          id?: string
          notes?: string | null
          revsports_competition_id?: string | null
          revsports_competition_name: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          competition_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          revsports_competition_id?: string | null
          revsports_competition_name?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revsports_competition_mappings_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      revsports_fixture_mappings: {
        Row: {
          created_at: string | null
          fixture_id: string | null
          game_date: string | null
          grade: string
          id: string
          revsports_match_url: string
          round: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          fixture_id?: string | null
          game_date?: string | null
          grade?: string
          id?: string
          revsports_match_url: string
          round?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          fixture_id?: string | null
          game_date?: string | null
          grade?: string
          id?: string
          revsports_match_url?: string
          round?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revsports_fixture_mappings_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
        ]
      }
      revsports_grade_mappings: {
        Row: {
          association: string | null
          created_at: string | null
          division_id: string | null
          id: string
          notes: string | null
          revsports_grade: string
          revsports_grade_id: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          association?: string | null
          created_at?: string | null
          division_id?: string | null
          id?: string
          notes?: string | null
          revsports_grade: string
          revsports_grade_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          association?: string | null
          created_at?: string | null
          division_id?: string | null
          id?: string
          notes?: string | null
          revsports_grade?: string
          revsports_grade_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revsports_grade_mappings_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      revsports_pitch_mappings: {
        Row: {
          created_at: string | null
          id: string
          pitch_id: string | null
          revsports_pitch_name: string
          revsports_venue_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          pitch_id?: string | null
          revsports_pitch_name: string
          revsports_venue_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          pitch_id?: string | null
          revsports_pitch_name?: string
          revsports_venue_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revsports_pitch_mappings_pitch_id_fkey"
            columns: ["pitch_id"]
            isOneToOne: false
            referencedRelation: "pitches"
            referencedColumns: ["id"]
          },
        ]
      }
      revsports_player_history: {
        Row: {
          association: string | null
          id: string
          player_name: string | null
          revsports_player_id: string
          scraped_at: string | null
          season_attended: number | null
          season_goals: number | null
          season_green_cards: number | null
          season_red_cards: number | null
          season_year: number
          season_yellow_cards: number | null
        }
        Insert: {
          association?: string | null
          id?: string
          player_name?: string | null
          revsports_player_id: string
          scraped_at?: string | null
          season_attended?: number | null
          season_goals?: number | null
          season_green_cards?: number | null
          season_red_cards?: number | null
          season_year: number
          season_yellow_cards?: number | null
        }
        Update: {
          association?: string | null
          id?: string
          player_name?: string | null
          revsports_player_id?: string
          scraped_at?: string | null
          season_attended?: number | null
          season_goals?: number | null
          season_green_cards?: number | null
          season_red_cards?: number | null
          season_year?: number
          season_yellow_cards?: number | null
        }
        Relationships: []
      }
      revsports_player_mappings: {
        Row: {
          club_name: string | null
          created_at: string | null
          grade: string
          id: string
          is_fillin: boolean
          jersey: string | null
          profile_id: string | null
          revsports_player_id: string | null
          revsports_player_name: string
          team: string
          updated_at: string | null
        }
        Insert: {
          club_name?: string | null
          created_at?: string | null
          grade?: string
          id?: string
          is_fillin?: boolean
          jersey?: string | null
          profile_id?: string | null
          revsports_player_id?: string | null
          revsports_player_name: string
          team?: string
          updated_at?: string | null
        }
        Update: {
          club_name?: string | null
          created_at?: string | null
          grade?: string
          id?: string
          is_fillin?: boolean
          jersey?: string | null
          profile_id?: string | null
          revsports_player_id?: string | null
          revsports_player_name?: string
          team?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revsports_player_mappings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      revsports_player_registry: {
        Row: {
          association: string | null
          competition_id: string
          first_name: string | null
          id: string
          last_name: string | null
          player_name: string
          profile_id: string | null
          revsports_player_id: string
          scraped_at: string | null
          season_attended: number | null
          season_goals: number | null
          season_green_cards: number | null
          season_red_cards: number | null
          season_yellow_cards: number | null
        }
        Insert: {
          association?: string | null
          competition_id: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          player_name: string
          profile_id?: string | null
          revsports_player_id: string
          scraped_at?: string | null
          season_attended?: number | null
          season_goals?: number | null
          season_green_cards?: number | null
          season_red_cards?: number | null
          season_yellow_cards?: number | null
        }
        Update: {
          association?: string | null
          competition_id?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          player_name?: string
          profile_id?: string | null
          revsports_player_id?: string
          scraped_at?: string | null
          season_attended?: number | null
          season_goals?: number | null
          season_green_cards?: number | null
          season_red_cards?: number | null
          season_yellow_cards?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "revsports_player_registry_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      revsports_players: {
        Row: {
          appearance_key: string
          association: string | null
          attended: boolean | null
          away_club_name: string | null
          away_revsports_team_id: string | null
          away_score: number | null
          away_team: string | null
          away_team_label: string | null
          away_team_url: string | null
          club_name: string | null
          competition_name: string | null
          created_at: string | null
          email: string | null
          fixture_id: string | null
          game_date: string | null
          game_time: string | null
          goals: number | null
          grade: string | null
          green_cards: number | null
          home_club_name: string | null
          home_revsports_team_id: string | null
          home_score: number | null
          home_team: string | null
          home_team_label: string | null
          home_team_url: string | null
          id: string
          is_captain: boolean
          is_fillin: boolean
          is_goalkeeper: boolean
          is_removed: boolean
          jersey: string | null
          match_url: string
          pitch: string | null
          player_name: string
          profile_id: string | null
          red_cards: number | null
          revsports_competition_id: string | null
          revsports_grade_id: string | null
          revsports_match_id: string | null
          revsports_player_id: string | null
          revsports_team_id: string | null
          revsports_venue_id: string | null
          revsports_venue_url: string | null
          round: string | null
          scraped_at: string | null
          team: string | null
          team_label: string | null
          team_side: string | null
          team_url: string | null
          umpire_1: string | null
          umpire_2: string | null
          venue: string | null
          yellow_cards: number | null
        }
        Insert: {
          appearance_key: string
          association?: string | null
          attended?: boolean | null
          away_club_name?: string | null
          away_revsports_team_id?: string | null
          away_score?: number | null
          away_team?: string | null
          away_team_label?: string | null
          away_team_url?: string | null
          club_name?: string | null
          competition_name?: string | null
          created_at?: string | null
          email?: string | null
          fixture_id?: string | null
          game_date?: string | null
          game_time?: string | null
          goals?: number | null
          grade?: string | null
          green_cards?: number | null
          home_club_name?: string | null
          home_revsports_team_id?: string | null
          home_score?: number | null
          home_team?: string | null
          home_team_label?: string | null
          home_team_url?: string | null
          id?: string
          is_captain?: boolean
          is_fillin?: boolean
          is_goalkeeper?: boolean
          is_removed?: boolean
          jersey?: string | null
          match_url: string
          pitch?: string | null
          player_name: string
          profile_id?: string | null
          red_cards?: number | null
          revsports_competition_id?: string | null
          revsports_grade_id?: string | null
          revsports_match_id?: string | null
          revsports_player_id?: string | null
          revsports_team_id?: string | null
          revsports_venue_id?: string | null
          revsports_venue_url?: string | null
          round?: string | null
          scraped_at?: string | null
          team?: string | null
          team_label?: string | null
          team_side?: string | null
          team_url?: string | null
          umpire_1?: string | null
          umpire_2?: string | null
          venue?: string | null
          yellow_cards?: number | null
        }
        Update: {
          appearance_key?: string
          association?: string | null
          attended?: boolean | null
          away_club_name?: string | null
          away_revsports_team_id?: string | null
          away_score?: number | null
          away_team?: string | null
          away_team_label?: string | null
          away_team_url?: string | null
          club_name?: string | null
          competition_name?: string | null
          created_at?: string | null
          email?: string | null
          fixture_id?: string | null
          game_date?: string | null
          game_time?: string | null
          goals?: number | null
          grade?: string | null
          green_cards?: number | null
          home_club_name?: string | null
          home_revsports_team_id?: string | null
          home_score?: number | null
          home_team?: string | null
          home_team_label?: string | null
          home_team_url?: string | null
          id?: string
          is_captain?: boolean
          is_fillin?: boolean
          is_goalkeeper?: boolean
          is_removed?: boolean
          jersey?: string | null
          match_url?: string
          pitch?: string | null
          player_name?: string
          profile_id?: string | null
          red_cards?: number | null
          revsports_competition_id?: string | null
          revsports_grade_id?: string | null
          revsports_match_id?: string | null
          revsports_player_id?: string | null
          revsports_team_id?: string | null
          revsports_venue_id?: string | null
          revsports_venue_url?: string | null
          round?: string | null
          scraped_at?: string | null
          team?: string | null
          team_label?: string | null
          team_side?: string | null
          team_url?: string | null
          umpire_1?: string | null
          umpire_2?: string | null
          venue?: string | null
          yellow_cards?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "revsports_players_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revsports_players_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      revsports_players_profile_id_backup_20260621: {
        Row: {
          id: string | null
          profile_id: string | null
        }
        Insert: {
          id?: string | null
          profile_id?: string | null
        }
        Update: {
          id?: string | null
          profile_id?: string | null
        }
        Relationships: []
      }
      revsports_team_mappings: {
        Row: {
          club_name: string
          created_at: string | null
          division_name: string
          grade: string
          id: string
          notes: string | null
          revsports_team_id: string | null
          revsports_team_name: string
          status: string
          team_id: string | null
          updated_at: string | null
        }
        Insert: {
          club_name?: string
          created_at?: string | null
          division_name?: string
          grade?: string
          id?: string
          notes?: string | null
          revsports_team_id?: string | null
          revsports_team_name: string
          status?: string
          team_id?: string | null
          updated_at?: string | null
        }
        Update: {
          club_name?: string
          created_at?: string | null
          division_name?: string
          grade?: string
          id?: string
          notes?: string | null
          revsports_team_id?: string | null
          revsports_team_name?: string
          status?: string
          team_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revsports_team_mappings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      revsports_umpire_mappings: {
        Row: {
          created_at: string | null
          id: string
          profile_id: string | null
          revsports_umpire_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          profile_id?: string | null
          revsports_umpire_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          profile_id?: string | null
          revsports_umpire_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revsports_umpire_mappings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      revsports_unmatched_items: {
        Row: {
          association: string
          club_name: string | null
          competition_name: string | null
          first_seen_at: string
          grade: string | null
          id: string
          last_seen_at: string
          mapped_team_id: string | null
          notes: string | null
          status: string
          team: string | null
        }
        Insert: {
          association: string
          club_name?: string | null
          competition_name?: string | null
          first_seen_at?: string
          grade?: string | null
          id?: string
          last_seen_at?: string
          mapped_team_id?: string | null
          notes?: string | null
          status?: string
          team?: string | null
        }
        Update: {
          association?: string
          club_name?: string | null
          competition_name?: string | null
          first_seen_at?: string
          grade?: string | null
          id?: string
          last_seen_at?: string
          mapped_team_id?: string | null
          notes?: string | null
          status?: string
          team?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revsports_unmatched_items_mapped_team_id_fkey"
            columns: ["mapped_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      revsports_venue_mappings: {
        Row: {
          created_at: string | null
          id: string
          revsports_venue_name: string
          updated_at: string | null
          venue_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          revsports_venue_name: string
          updated_at?: string | null
          venue_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          revsports_venue_name?: string
          updated_at?: string | null
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revsports_venue_mappings_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      rg_audit_log: {
        Row: {
          action: string
          association_id: string | null
          changed_at: string
          club_id: string | null
          field_name: string | null
          id: string
          new_data: Json | null
          new_value: Json | null
          old_data: Json | null
          previous_value: Json | null
          reason: string | null
          record_id: string | null
          record_reference: string | null
          record_title: string | null
          record_type: string | null
          related_record_id: string | null
          related_record_reference: string | null
          related_record_title: string | null
          related_record_type: string | null
          table_name: string | null
          team_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          association_id?: string | null
          changed_at?: string
          club_id?: string | null
          field_name?: string | null
          id?: string
          new_data?: Json | null
          new_value?: Json | null
          old_data?: Json | null
          previous_value?: Json | null
          reason?: string | null
          record_id?: string | null
          record_reference?: string | null
          record_title?: string | null
          record_type?: string | null
          related_record_id?: string | null
          related_record_reference?: string | null
          related_record_title?: string | null
          related_record_type?: string | null
          table_name?: string | null
          team_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          association_id?: string | null
          changed_at?: string
          club_id?: string | null
          field_name?: string | null
          id?: string
          new_data?: Json | null
          new_value?: Json | null
          old_data?: Json | null
          previous_value?: Json | null
          reason?: string | null
          record_id?: string | null
          record_reference?: string | null
          record_title?: string | null
          record_type?: string | null
          related_record_id?: string | null
          related_record_reference?: string | null
          related_record_title?: string | null
          related_record_type?: string | null
          table_name?: string | null
          team_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rg_audit_log_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_audit_log_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_audit_log_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rg_be_smart_actions: {
        Row: {
          achievable: string | null
          action_text: string
          assigned_to: string | null
          association_id: string
          baseline: string | null
          club_id: string | null
          created_at: string
          created_by: string | null
          display_number: number
          due_date: string | null
          evaluate: string | null
          id: string
          last_change_reason: string
          measurable: string | null
          relevant: string | null
          resources: string | null
          risk_id: string | null
          specific: string | null
          status: Database["public"]["Enums"]["action_status_enum"]
          team_id: string | null
          time_bound: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          achievable?: string | null
          action_text: string
          assigned_to?: string | null
          association_id: string
          baseline?: string | null
          club_id?: string | null
          created_at?: string
          created_by?: string | null
          display_number?: number
          due_date?: string | null
          evaluate?: string | null
          id?: string
          last_change_reason?: string
          measurable?: string | null
          relevant?: string | null
          resources?: string | null
          risk_id?: string | null
          specific?: string | null
          status?: Database["public"]["Enums"]["action_status_enum"]
          team_id?: string | null
          time_bound?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          achievable?: string | null
          action_text?: string
          assigned_to?: string | null
          association_id?: string
          baseline?: string | null
          club_id?: string | null
          created_at?: string
          created_by?: string | null
          display_number?: number
          due_date?: string | null
          evaluate?: string | null
          id?: string
          last_change_reason?: string
          measurable?: string | null
          relevant?: string | null
          resources?: string | null
          risk_id?: string | null
          specific?: string | null
          status?: Database["public"]["Enums"]["action_status_enum"]
          team_id?: string | null
          time_bound?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rg_be_smart_actions_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_be_smart_actions_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_be_smart_actions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_be_smart_actions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_be_smart_actions_risk_id_fkey"
            columns: ["risk_id"]
            isOneToOne: false
            referencedRelation: "rg_risk_register"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_be_smart_actions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_be_smart_actions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rg_bright_ideas: {
        Row: {
          association_id: string
          club_id: string | null
          committee_notes: string | null
          could_assist: string | null
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          decision: string | null
          decision_reason: string | null
          display_number: number
          id: string
          last_change_reason: string
          other_information: string | null
          status: string
          submitted_at: string
          submitted_by: string | null
          suggested_evaluation: string | null
          suggested_implementation: string | null
          team_id: string | null
          title: string
          updated_at: string
          updated_by: string | null
          why_needed: string
        }
        Insert: {
          association_id: string
          club_id?: string | null
          committee_notes?: string | null
          could_assist?: string | null
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          decision_reason?: string | null
          display_number?: number
          id?: string
          last_change_reason?: string
          other_information?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string | null
          suggested_evaluation?: string | null
          suggested_implementation?: string | null
          team_id?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
          why_needed: string
        }
        Update: {
          association_id?: string
          club_id?: string | null
          committee_notes?: string | null
          could_assist?: string | null
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          decision_reason?: string | null
          display_number?: number
          id?: string
          last_change_reason?: string
          other_information?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string | null
          suggested_evaluation?: string | null
          suggested_implementation?: string | null
          team_id?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          why_needed?: string
        }
        Relationships: [
          {
            foreignKeyName: "rg_bright_ideas_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_bright_ideas_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_bright_ideas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_bright_ideas_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_bright_ideas_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_bright_ideas_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_bright_ideas_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rg_comments: {
        Row: {
          association_id: string
          club_id: string | null
          content: string
          created_at: string
          id: string
          last_change_reason: string
          record_id: string
          table_name: string
          team_id: string | null
          user_id: string | null
        }
        Insert: {
          association_id: string
          club_id?: string | null
          content: string
          created_at?: string
          id?: string
          last_change_reason?: string
          record_id: string
          table_name: string
          team_id?: string | null
          user_id?: string | null
        }
        Update: {
          association_id?: string
          club_id?: string | null
          content?: string
          created_at?: string
          id?: string
          last_change_reason?: string
          record_id?: string
          table_name?: string
          team_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rg_comments_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_comments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_comments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rg_dropdown_values: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          label: string
          last_change_reason: string
          settings_id: string
          sort_order: number | null
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          label: string
          last_change_reason?: string
          settings_id: string
          sort_order?: number | null
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          label?: string
          last_change_reason?: string
          settings_id?: string
          sort_order?: number | null
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "rg_dropdown_values_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_dropdown_values_settings_id_fkey"
            columns: ["settings_id"]
            isOneToOne: false
            referencedRelation: "rg_risk_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_dropdown_values_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rg_quality_improvement_items: {
        Row: {
          area: string | null
          association_id: string
          club_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          display_number: number
          due_date: string | null
          id: string
          issue: string | null
          last_change_reason: string
          outcome: string | null
          owner_id: string | null
          priority: string
          required_action: string | null
          source: string | null
          status: Database["public"]["Enums"]["action_status_enum"]
          team_id: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          area?: string | null
          association_id: string
          club_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_number?: number
          due_date?: string | null
          id?: string
          issue?: string | null
          last_change_reason?: string
          outcome?: string | null
          owner_id?: string | null
          priority?: string
          required_action?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["action_status_enum"]
          team_id?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          area?: string | null
          association_id?: string
          club_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_number?: number
          due_date?: string | null
          id?: string
          issue?: string | null
          last_change_reason?: string
          outcome?: string | null
          owner_id?: string | null
          priority?: string
          required_action?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["action_status_enum"]
          team_id?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rg_quality_improvement_items_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_quality_improvement_items_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_quality_improvement_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_quality_improvement_items_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_quality_improvement_items_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_quality_improvement_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rg_record_links: {
        Row: {
          action_id: string | null
          association_id: string
          bright_idea_id: string | null
          club_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          last_change_reason: string
          link_reason: string | null
          qi_item_id: string | null
          risk_id: string | null
          team_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          action_id?: string | null
          association_id: string
          bright_idea_id?: string | null
          club_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          last_change_reason?: string
          link_reason?: string | null
          qi_item_id?: string | null
          risk_id?: string | null
          team_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          action_id?: string | null
          association_id?: string
          bright_idea_id?: string | null
          club_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          last_change_reason?: string
          link_reason?: string | null
          qi_item_id?: string | null
          risk_id?: string | null
          team_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rg_record_links_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "rg_be_smart_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_record_links_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_record_links_bright_idea_id_fkey"
            columns: ["bright_idea_id"]
            isOneToOne: false
            referencedRelation: "rg_bright_ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_record_links_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_record_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_record_links_qi_item_id_fkey"
            columns: ["qi_item_id"]
            isOneToOne: false
            referencedRelation: "rg_quality_improvement_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_record_links_risk_id_fkey"
            columns: ["risk_id"]
            isOneToOne: false
            referencedRelation: "rg_risk_register"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_record_links_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_record_links_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rg_risk_guidance_sections: {
        Row: {
          category: string | null
          content: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          last_change_reason: string
          settings_id: string
          sort_order: number | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category?: string | null
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          last_change_reason?: string
          settings_id: string
          sort_order?: number | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string | null
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          last_change_reason?: string
          settings_id?: string
          sort_order?: number | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rg_risk_guidance_sections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_risk_guidance_sections_settings_id_fkey"
            columns: ["settings_id"]
            isOneToOne: false
            referencedRelation: "rg_risk_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_risk_guidance_sections_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rg_risk_matrix: {
        Row: {
          color: string
          consequence: number
          created_at: string
          created_by: string | null
          id: string
          last_change_reason: string
          likelihood: number
          risk_level: string
          settings_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          color: string
          consequence: number
          created_at?: string
          created_by?: string | null
          id?: string
          last_change_reason?: string
          likelihood: number
          risk_level: string
          settings_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          color?: string
          consequence?: number
          created_at?: string
          created_by?: string | null
          id?: string
          last_change_reason?: string
          likelihood?: number
          risk_level?: string
          settings_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rg_risk_matrix_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_risk_matrix_settings_id_fkey"
            columns: ["settings_id"]
            isOneToOne: false
            referencedRelation: "rg_risk_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_risk_matrix_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rg_risk_register: {
        Row: {
          association_id: string
          category: string | null
          club_id: string | null
          consequence: number | null
          consequences: string | null
          created_at: string
          created_by: string | null
          description: string | null
          display_number: number
          evidence: string | null
          existing_controls: string | null
          id: string
          inherent_consequence: number | null
          inherent_likelihood: number | null
          inherent_rating: string | null
          last_change_reason: string
          likelihood: number | null
          next_review_date: string | null
          owner_id: string | null
          residual_consequence: number | null
          residual_likelihood: number | null
          residual_rating: string | null
          review_frequency: string | null
          risk_event: string | null
          risk_score: number | null
          risk_type: string | null
          status: Database["public"]["Enums"]["risk_status_enum"]
          target_rating: string | null
          team_id: string | null
          title: string
          treatment_plan: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          association_id: string
          category?: string | null
          club_id?: string | null
          consequence?: number | null
          consequences?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_number?: number
          evidence?: string | null
          existing_controls?: string | null
          id?: string
          inherent_consequence?: number | null
          inherent_likelihood?: number | null
          inherent_rating?: string | null
          last_change_reason?: string
          likelihood?: number | null
          next_review_date?: string | null
          owner_id?: string | null
          residual_consequence?: number | null
          residual_likelihood?: number | null
          residual_rating?: string | null
          review_frequency?: string | null
          risk_event?: string | null
          risk_score?: number | null
          risk_type?: string | null
          status?: Database["public"]["Enums"]["risk_status_enum"]
          target_rating?: string | null
          team_id?: string | null
          title: string
          treatment_plan?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          association_id?: string
          category?: string | null
          club_id?: string | null
          consequence?: number | null
          consequences?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_number?: number
          evidence?: string | null
          existing_controls?: string | null
          id?: string
          inherent_consequence?: number | null
          inherent_likelihood?: number | null
          inherent_rating?: string | null
          last_change_reason?: string
          likelihood?: number | null
          next_review_date?: string | null
          owner_id?: string | null
          residual_consequence?: number | null
          residual_likelihood?: number | null
          residual_rating?: string | null
          review_frequency?: string | null
          risk_event?: string | null
          risk_score?: number | null
          risk_type?: string | null
          status?: Database["public"]["Enums"]["risk_status_enum"]
          target_rating?: string | null
          team_id?: string | null
          title?: string
          treatment_plan?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rg_risk_register_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_risk_register_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_risk_register_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_risk_register_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_risk_register_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_risk_register_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rg_risk_reviews: {
        Row: {
          association_id: string
          club_id: string | null
          evidence: string | null
          id: string
          last_change_reason: string
          new_status: Database["public"]["Enums"]["risk_status_enum"] | null
          next_review_date: string | null
          notes: string | null
          residual_consequence: number | null
          residual_likelihood: number | null
          residual_rating: string | null
          review_reason: string | null
          reviewed_at: string
          reviewed_by: string | null
          risk_id: string
          team_id: string | null
        }
        Insert: {
          association_id: string
          club_id?: string | null
          evidence?: string | null
          id?: string
          last_change_reason?: string
          new_status?: Database["public"]["Enums"]["risk_status_enum"] | null
          next_review_date?: string | null
          notes?: string | null
          residual_consequence?: number | null
          residual_likelihood?: number | null
          residual_rating?: string | null
          review_reason?: string | null
          reviewed_at?: string
          reviewed_by?: string | null
          risk_id: string
          team_id?: string | null
        }
        Update: {
          association_id?: string
          club_id?: string | null
          evidence?: string | null
          id?: string
          last_change_reason?: string
          new_status?: Database["public"]["Enums"]["risk_status_enum"] | null
          next_review_date?: string | null
          notes?: string | null
          residual_consequence?: number | null
          residual_likelihood?: number | null
          residual_rating?: string | null
          review_reason?: string | null
          reviewed_at?: string
          reviewed_by?: string | null
          risk_id?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rg_risk_reviews_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_risk_reviews_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_risk_reviews_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_risk_reviews_risk_id_fkey"
            columns: ["risk_id"]
            isOneToOne: false
            referencedRelation: "rg_risk_register"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_risk_reviews_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      rg_risk_settings: {
        Row: {
          association_id: string | null
          club_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          is_provisional: boolean
          last_change_reason: string
          name: string
          scope_level: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          association_id?: string | null
          club_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_provisional?: boolean
          last_change_reason?: string
          name: string
          scope_level: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          association_id?: string | null
          club_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_provisional?: boolean
          last_change_reason?: string
          name?: string
          scope_level?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rg_risk_settings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_risk_settings_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_risk_settings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rg_risk_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          association_id: string
          created_at: string
          end_date: string | null
          id: string
          is_active: boolean
          name: string
          start_date: string | null
          year: number | null
        }
        Insert: {
          association_id: string
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          name: string
          start_date?: string | null
          year?: number | null
        }
        Update: {
          association_id?: string
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          name?: string
          start_date?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "seasons_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
      source_revsports_change_log: {
        Row: {
          change_type: string
          detected_at: string
          field_name: string
          id: string
          new_value: string | null
          notes: string | null
          old_value: string | null
          promoted_at: string | null
          promotion_status: string
          scrape_run_id: string | null
          source_key: string | null
          source_row_id: string | null
          source_table: string
        }
        Insert: {
          change_type?: string
          detected_at?: string
          field_name: string
          id?: string
          new_value?: string | null
          notes?: string | null
          old_value?: string | null
          promoted_at?: string | null
          promotion_status?: string
          scrape_run_id?: string | null
          source_key?: string | null
          source_row_id?: string | null
          source_table: string
        }
        Update: {
          change_type?: string
          detected_at?: string
          field_name?: string
          id?: string
          new_value?: string | null
          notes?: string | null
          old_value?: string | null
          promoted_at?: string | null
          promotion_status?: string
          scrape_run_id?: string | null
          source_key?: string | null
          source_row_id?: string | null
          source_table?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_revsports_change_log_scrape_run_id_fkey"
            columns: ["scrape_run_id"]
            isOneToOne: false
            referencedRelation: "source_scrape_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      source_revsports_match_teams: {
        Row: {
          club_name: string | null
          first_seen_at: string
          id: string
          last_seen_at: string
          match_id: string
          raw_data: Json
          revsports_team_id: string | null
          score: number | null
          scraped_at: string
          side: string
          team_label: string | null
          team_name: string | null
          team_url: string | null
          updated_at: string
        }
        Insert: {
          club_name?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          match_id: string
          raw_data?: Json
          revsports_team_id?: string | null
          score?: number | null
          scraped_at?: string
          side: string
          team_label?: string | null
          team_name?: string | null
          team_url?: string | null
          updated_at?: string
        }
        Update: {
          club_name?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          match_id?: string
          raw_data?: Json
          revsports_team_id?: string | null
          score?: number | null
          scraped_at?: string
          side?: string
          team_label?: string | null
          team_name?: string | null
          team_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_revsports_match_teams_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "source_revsports_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      source_revsports_matches: {
        Row: {
          association_name: string
          away_club_name: string | null
          away_revsports_team_id: string | null
          away_score: number | null
          away_team_name: string | null
          competition_name: string | null
          first_seen_at: string
          game_date: string | null
          game_time: string | null
          grade: string | null
          home_club_name: string | null
          home_revsports_team_id: string | null
          home_score: number | null
          home_team_name: string | null
          id: string
          last_seen_at: string
          match_url: string
          pitch_name: string | null
          raw_data: Json
          round_name: string | null
          round_number: number | null
          scrape_run_id: string | null
          scraped_at: string
          umpire_1: string | null
          umpire_2: string | null
          updated_at: string
          venue_name: string | null
        }
        Insert: {
          association_name: string
          away_club_name?: string | null
          away_revsports_team_id?: string | null
          away_score?: number | null
          away_team_name?: string | null
          competition_name?: string | null
          first_seen_at?: string
          game_date?: string | null
          game_time?: string | null
          grade?: string | null
          home_club_name?: string | null
          home_revsports_team_id?: string | null
          home_score?: number | null
          home_team_name?: string | null
          id?: string
          last_seen_at?: string
          match_url: string
          pitch_name?: string | null
          raw_data?: Json
          round_name?: string | null
          round_number?: number | null
          scrape_run_id?: string | null
          scraped_at?: string
          umpire_1?: string | null
          umpire_2?: string | null
          updated_at?: string
          venue_name?: string | null
        }
        Update: {
          association_name?: string
          away_club_name?: string | null
          away_revsports_team_id?: string | null
          away_score?: number | null
          away_team_name?: string | null
          competition_name?: string | null
          first_seen_at?: string
          game_date?: string | null
          game_time?: string | null
          grade?: string | null
          home_club_name?: string | null
          home_revsports_team_id?: string | null
          home_score?: number | null
          home_team_name?: string | null
          id?: string
          last_seen_at?: string
          match_url?: string
          pitch_name?: string | null
          raw_data?: Json
          round_name?: string | null
          round_number?: number | null
          scrape_run_id?: string | null
          scraped_at?: string
          umpire_1?: string | null
          umpire_2?: string | null
          updated_at?: string
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "source_revsports_matches_scrape_run_id_fkey"
            columns: ["scrape_run_id"]
            isOneToOne: false
            referencedRelation: "source_scrape_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      source_revsports_player_appearances: {
        Row: {
          appearance_key: string
          attended: boolean | null
          club_name: string | null
          first_seen_at: string
          goals: number
          green_cards: number
          id: string
          is_captain: boolean
          is_fillin: boolean
          is_goalkeeper: boolean
          is_removed: boolean
          jersey: string | null
          last_seen_at: string
          match_id: string | null
          match_team_id: string | null
          player_name: string
          raw_data: Json
          red_cards: number
          revsports_player_id: string | null
          revsports_team_id: string | null
          scrape_run_id: string | null
          scraped_at: string
          team_name: string | null
          team_side: string | null
          updated_at: string
          yellow_cards: number
        }
        Insert: {
          appearance_key: string
          attended?: boolean | null
          club_name?: string | null
          first_seen_at?: string
          goals?: number
          green_cards?: number
          id?: string
          is_captain?: boolean
          is_fillin?: boolean
          is_goalkeeper?: boolean
          is_removed?: boolean
          jersey?: string | null
          last_seen_at?: string
          match_id?: string | null
          match_team_id?: string | null
          player_name: string
          raw_data?: Json
          red_cards?: number
          revsports_player_id?: string | null
          revsports_team_id?: string | null
          scrape_run_id?: string | null
          scraped_at?: string
          team_name?: string | null
          team_side?: string | null
          updated_at?: string
          yellow_cards?: number
        }
        Update: {
          appearance_key?: string
          attended?: boolean | null
          club_name?: string | null
          first_seen_at?: string
          goals?: number
          green_cards?: number
          id?: string
          is_captain?: boolean
          is_fillin?: boolean
          is_goalkeeper?: boolean
          is_removed?: boolean
          jersey?: string | null
          last_seen_at?: string
          match_id?: string | null
          match_team_id?: string | null
          player_name?: string
          raw_data?: Json
          red_cards?: number
          revsports_player_id?: string | null
          revsports_team_id?: string | null
          scrape_run_id?: string | null
          scraped_at?: string
          team_name?: string | null
          team_side?: string | null
          updated_at?: string
          yellow_cards?: number
        }
        Relationships: [
          {
            foreignKeyName: "source_revsports_player_appearances_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "source_revsports_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_revsports_player_appearances_match_team_id_fkey"
            columns: ["match_team_id"]
            isOneToOne: false
            referencedRelation: "source_revsports_match_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_revsports_player_appearances_scrape_run_id_fkey"
            columns: ["scrape_run_id"]
            isOneToOne: false
            referencedRelation: "source_scrape_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      source_scrape_runs: {
        Row: {
          association_id: string | null
          association_name: string | null
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          rows_found: number
          rows_written: number
          scraper_name: string
          source: string
          source_config: Json
          started_at: string
          status: string
        }
        Insert: {
          association_id?: string | null
          association_name?: string | null
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          rows_found?: number
          rows_written?: number
          scraper_name: string
          source?: string
          source_config?: Json
          started_at?: string
          status?: string
        }
        Update: {
          association_id?: string | null
          association_name?: string | null
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          rows_found?: number
          rows_written?: number
          scraper_name?: string
          source?: string
          source_config?: Json
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_scrape_runs_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
      sport_position_aliases: {
        Row: {
          association_id: string | null
          canonical_group: string
          club_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          local_code: string
          local_label: string
          sport: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          association_id?: string | null
          canonical_group: string
          club_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          local_code: string
          local_label: string
          sport?: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          association_id?: string | null
          canonical_group?: string
          club_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          local_code?: string
          local_label?: string
          sport?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sport_position_aliases_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sport_position_aliases_canonical_group_fkey"
            columns: ["canonical_group"]
            isOneToOne: false
            referencedRelation: "sport_position_groups"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "sport_position_aliases_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sport_position_aliases_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      sport_position_groups: {
        Row: {
          code: string
          created_at: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          label: string
          sort_order: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      team_availability_reminder_settings: {
        Row: {
          enabled: boolean
          team_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled?: boolean
          team_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          team_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_availability_reminder_settings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_availability_reminder_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_divisions: {
        Row: {
          division_id: string
          id: string
          season_id: string | null
          team_id: string
        }
        Insert: {
          division_id: string
          id?: string
          season_id?: string | null
          team_id: string
        }
        Update: {
          division_id?: string
          id?: string
          season_id?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_divisions_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_divisions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_divisions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_memberships: {
        Row: {
          activated_at: string | null
          created_at: string
          id: string
          invited_by: string | null
          jersey_number: number | null
          membership_type: Database["public"]["Enums"]["membership_type_enum"]
          position: string | null
          status: Database["public"]["Enums"]["membership_status_enum"]
          team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          id?: string
          invited_by?: string | null
          jersey_number?: number | null
          membership_type?: Database["public"]["Enums"]["membership_type_enum"]
          position?: string | null
          status?: Database["public"]["Enums"]["membership_status_enum"]
          team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          id?: string
          invited_by?: string | null
          jersey_number?: number | null
          membership_type?: Database["public"]["Enums"]["membership_type_enum"]
          position?: string | null
          status?: Database["public"]["Enums"]["membership_status_enum"]
          team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_memberships_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_memberships_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          team_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          team_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_messages_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          abbreviation: string | null
          age_group: string | null
          banner_url: string | null
          club_id: string
          created_at: string
          division: string | null
          division_id: string | null
          gender: string | null
          home_venue_id: string | null
          id: string
          logo_url: string | null
          mvp_enabled: boolean
          mvp_notifications_enabled: boolean
          name: string
          primary_colour: string | null
          secondary_colour: string | null
          updated_at: string
        }
        Insert: {
          abbreviation?: string | null
          age_group?: string | null
          banner_url?: string | null
          club_id: string
          created_at?: string
          division?: string | null
          division_id?: string | null
          gender?: string | null
          home_venue_id?: string | null
          id?: string
          logo_url?: string | null
          mvp_enabled?: boolean
          mvp_notifications_enabled?: boolean
          name: string
          primary_colour?: string | null
          secondary_colour?: string | null
          updated_at?: string
        }
        Update: {
          abbreviation?: string | null
          age_group?: string | null
          banner_url?: string | null
          club_id?: string
          created_at?: string
          division?: string | null
          division_id?: string | null
          gender?: string | null
          home_venue_id?: string | null
          id?: string
          logo_url?: string | null
          mvp_enabled?: boolean
          mvp_notifications_enabled?: boolean
          name?: string
          primary_colour?: string | null
          secondary_colour?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_home_venue_id_fkey"
            columns: ["home_venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      umpire_audit_log: {
        Row: {
          action: string
          changed_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "umpire_audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      umpire_fixtures: {
        Row: {
          away_team_id: string | null
          created_at: string
          fixture_date: string | null
          fixture_id: string | null
          home_team_id: string | null
          id: string
          is_active: boolean
          pitch_id: string | null
          round_id: string | null
          status: string
          venue_id: string | null
        }
        Insert: {
          away_team_id?: string | null
          created_at?: string
          fixture_date?: string | null
          fixture_id?: string | null
          home_team_id?: string | null
          id?: string
          is_active?: boolean
          pitch_id?: string | null
          round_id?: string | null
          status?: string
          venue_id?: string | null
        }
        Update: {
          away_team_id?: string | null
          created_at?: string
          fixture_date?: string | null
          fixture_id?: string | null
          home_team_id?: string | null
          id?: string
          is_active?: boolean
          pitch_id?: string | null
          round_id?: string | null
          status?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "umpire_fixtures_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umpire_fixtures_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umpire_fixtures_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umpire_fixtures_pitch_id_fkey"
            columns: ["pitch_id"]
            isOneToOne: false
            referencedRelation: "pitches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umpire_fixtures_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "umpire_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umpire_fixtures_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      umpire_guests: {
        Row: {
          access_token: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          token_expires_at: string | null
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          token_expires_at?: string | null
        }
        Update: {
          access_token?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          token_expires_at?: string | null
        }
        Relationships: []
      }
      umpire_rounds: {
        Row: {
          created_at: string
          division_id: string | null
          end_date: string | null
          id: string
          name: string
          round_number: number | null
          season_id: string | null
          start_date: string | null
        }
        Insert: {
          created_at?: string
          division_id?: string | null
          end_date?: string | null
          id?: string
          name: string
          round_number?: number | null
          season_id?: string | null
          start_date?: string | null
        }
        Update: {
          created_at?: string
          division_id?: string | null
          end_date?: string | null
          id?: string
          name?: string
          round_number?: number | null
          season_id?: string | null
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "umpire_rounds_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umpire_rounds_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      umpire_vote_edits: {
        Row: {
          edited_at: string
          edited_by: string | null
          id: string
          reason: string | null
          submission_id: string
        }
        Insert: {
          edited_at?: string
          edited_by?: string | null
          id?: string
          reason?: string | null
          submission_id: string
        }
        Update: {
          edited_at?: string
          edited_by?: string | null
          id?: string
          reason?: string | null
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "umpire_vote_edits_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umpire_vote_edits_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "umpire_vote_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      umpire_vote_lines: {
        Row: {
          comment: string | null
          id: string
          rating: number | null
          submission_id: string
          umpire_guest_id: string | null
          umpire_user_id: string | null
        }
        Insert: {
          comment?: string | null
          id?: string
          rating?: number | null
          submission_id: string
          umpire_guest_id?: string | null
          umpire_user_id?: string | null
        }
        Update: {
          comment?: string | null
          id?: string
          rating?: number | null
          submission_id?: string
          umpire_guest_id?: string | null
          umpire_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "umpire_vote_lines_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "umpire_vote_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umpire_vote_lines_umpire_guest_id_fkey"
            columns: ["umpire_guest_id"]
            isOneToOne: false
            referencedRelation: "umpire_guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umpire_vote_lines_umpire_user_id_fkey"
            columns: ["umpire_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      umpire_vote_submissions: {
        Row: {
          id: string
          is_proxy: boolean
          status: string
          submitted_at: string
          submitted_by: string | null
          umpire_fixture_id: string
        }
        Insert: {
          id?: string
          is_proxy?: boolean
          status?: string
          submitted_at?: string
          submitted_by?: string | null
          umpire_fixture_id: string
        }
        Update: {
          id?: string
          is_proxy?: boolean
          status?: string
          submitted_at?: string
          submitted_by?: string | null
          umpire_fixture_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "umpire_vote_submissions_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umpire_vote_submissions_umpire_fixture_id_fkey"
            columns: ["umpire_fixture_id"]
            isOneToOne: false
            referencedRelation: "umpire_fixtures"
            referencedColumns: ["id"]
          },
        ]
      }
      user_formation_preferences: {
        Row: {
          created_at: string
          formation_id: string
          id: string
          is_favourite: boolean
          is_hidden: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          formation_id: string
          id?: string
          is_favourite?: boolean
          is_hidden?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          formation_id?: string
          id?: string
          is_favourite?: boolean
          is_hidden?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_formation_preferences_formation_id_fkey"
            columns: ["formation_id"]
            isOneToOne: false
            referencedRelation: "formations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_formation_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          association_id: string | null
          club_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role_enum"]
          team_id: string | null
          user_id: string
        }
        Insert: {
          association_id?: string | null
          club_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["user_role_enum"]
          team_id?: string | null
          user_id: string
        }
        Update: {
          association_id?: string | null
          club_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role_enum"]
          team_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_associations: {
        Row: {
          allowed_pitch_ids: string[] | null
          association_id: string
          created_at: string | null
          id: string
          venue_id: string
        }
        Insert: {
          allowed_pitch_ids?: string[] | null
          association_id: string
          created_at?: string | null
          id?: string
          venue_id: string
        }
        Update: {
          allowed_pitch_ids?: string[] | null
          association_id?: string
          created_at?: string | null
          id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_associations_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_associations_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          address: string | null
          association_id: string | null
          available_times: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          postcode: string | null
          state: string | null
          suburb: string | null
        }
        Insert: {
          address?: string | null
          association_id?: string | null
          available_times?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          postcode?: string | null
          state?: string | null
          suburb?: string | null
        }
        Update: {
          address?: string | null
          association_id?: string | null
          available_times?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          postcode?: string | null
          state?: string | null
          suburb?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venues_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_cancel_team_invite: {
        Args: { p_actor_mode?: string; p_request_id: string }
        Returns: undefined
      }
      admin_create_team_invite: {
        Args: {
          p_actor_mode?: string
          p_membership_type: string
          p_target_user_id: string
          p_team_id: string
        }
        Returns: string
      }
      admin_manage_team_membership: {
        Args: {
          p_action: string
          p_actor_mode?: string
          p_membership_id: string
          p_membership_type?: string
        }
        Returns: Json
      }
      admin_membership_integrity_report: {
        Args: never
        Returns: {
          issue_type: string
          membership_ids: string[]
          row_count: number
          team_id: string
          user_id: string
        }[]
      }
      admin_merge_profiles: {
        Args: {
          p_conflict_resolutions: Json
          p_field_choices: Json
          p_keep_id: string
          p_merge_id: string
        }
        Returns: undefined
      }
      admin_save_user_roles: {
        Args: {
          p_actor_mode?: string
          p_association_admin_associations?: string[]
          p_club_admin_scopes?: Json
          p_coach_scopes?: Json
          p_manager_scopes?: Json
          p_roles: string[]
          p_user_id: string
        }
        Returns: undefined
      }
      admin_save_user_roles_unchecked: {
        Args: {
          p_actor_mode?: string
          p_association_admin_associations?: string[]
          p_club_admin_scopes?: Json
          p_coach_scopes?: Json
          p_manager_scopes?: Json
          p_roles: string[]
          p_user_id: string
        }
        Returns: undefined
      }
      admin_update_profile_details: {
        Args: { p_actor_mode?: string; p_details: Json; p_user_id: string }
        Returns: Json
      }
      admin_visible_profile_ids: {
        Args: {
          p_actor_mode?: string
          p_association_id?: string
          p_club_id?: string
          p_team_id?: string
        }
        Returns: {
          profile_id: string
        }[]
      }
      administration_effective_mode: {
        Args: { p_requested_mode?: string }
        Returns: string
      }
      administration_scope_allows: {
        Args: {
          p_association_id?: string
          p_club_id?: string
          p_requested_mode: string
          p_team_id?: string
        }
        Returns: boolean
      }
      approve_membership_request: {
        Args: { p_assign_team?: boolean; p_request_id: string }
        Returns: Json
      }
      authorise_dev_test_account_provisioning: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: boolean
      }
      can_manage_committee_scope: {
        Args: {
          p_association_id: string
          p_club_id?: string
          p_user_id: string
        }
        Returns: boolean
      }
      can_manage_module_scope: {
        Args: { p_scope_id: string; p_scope_type: string; p_user_id: string }
        Returns: boolean
      }
      can_upload_committee_file: {
        Args: { p_committee_id: string; p_user_id: string }
        Returns: boolean
      }
      can_view_committee: {
        Args: { p_committee_id: string; p_user_id?: string }
        Returns: boolean
      }
      claim_placeholder_profile: {
        Args: { p_real_profile_id: string }
        Returns: {
          placeholder_profile_id: string
          reason: string
          status: string
        }[]
      }
      claim_sportstack_notification_work: {
        Args: { p_limit?: number }
        Returns: {
          action_url: string
          body_text: string
          delivery_id: string
          recipient_email: string
          recipient_name: string
          subject: string
          work_type: string
        }[]
      }
      clear_module_feature_flag: {
        Args: { p_module_key: string; p_scope_id: string; p_scope_type: string }
        Returns: boolean
      }
      close_legacy_mvp_sessions_for_cutover: {
        Args: { p_reason: string }
        Returns: Json
      }
      close_mvp_voting_session: {
        Args: { p_session_id: string }
        Returns: Json
      }
      complete_sportstack_notification_work: {
        Args: {
          p_delivery_id: string
          p_error?: string
          p_success: boolean
          p_work_type: string
        }
        Returns: undefined
      }
      configure_sportstack_notification_cron: {
        Args: { p_project_url: string }
        Returns: undefined
      }
      create_committee_agenda_template: {
        Args: {
          p_committee_id: string
          p_description: string
          p_items: Json
          p_title: string
        }
        Returns: string
      }
      create_committee_meeting_from_template: {
        Args: {
          p_committee_id: string
          p_location: string
          p_scheduled_at: string
          p_template_id: string
          p_title: string
        }
        Returns: string
      }
      create_committee_poll: {
        Args: {
          p_closes_at: string
          p_committee_id: string
          p_description: string
          p_questions: Json
          p_status: string
          p_title: string
        }
        Returns: string
      }
      create_public_umpire_vote: {
        Args: { p_lines: Json; p_submission: Json }
        Returns: {
          submission_id: string
          submission_reference: string
        }[]
      }
      delete_unused_venue: { Args: { p_venue_id: string }; Returns: Json }
      get_committee_meeting_item_links: {
        Args: { p_committee_id: string }
        Returns: {
          meeting_item_id: string
          record_id: string
          record_type: string
        }[]
      }
      get_mvp_result_check_state: {
        Args: { p_session_id: string }
        Returns: Json
      }
      get_mvp_session_results: {
        Args: { p_session_id: string }
        Returns: {
          player_id: string
          player_name: string
          points: number
          profile_id: string
          vote_count: number
        }[]
      }
      has_committee_permission: {
        Args: {
          p_committee_id: string
          p_permission_key: string
          p_user_id?: string
        }
        Returns: boolean
      }
      has_effective_permission: {
        Args: {
          p_association_id?: string
          p_club_id?: string
          p_division_id?: string
          p_permission_key: string
          p_team_id?: string
        }
        Returns: boolean
      }
      is_active_committee_member: {
        Args: { p_committee_id: string; p_user_id?: string }
        Returns: boolean
      }
      is_super_admin: { Args: never; Returns: boolean }
      list_permission_management_records_for_mode: {
        Args: {
          p_actor_mode?: string
          p_scope_id: string
          p_scope_type: string
        }
        Returns: Json
      }
      open_mvp_voting_session: {
        Args: { p_closes_at?: string; p_fixture_id: string; p_team_id: string }
        Returns: Json
      }
      permission_mode_scope_allows: {
        Args: { p_actor_mode: string; p_scope_id: string; p_scope_type: string }
        Returns: boolean
      }
      permission_save_assignment_unchecked: {
        Args: {
          p_active?: boolean
          p_actor_mode?: string
          p_assignment_id: string
          p_permission_set_id: string
          p_scope_id: string
          p_scope_type: string
          p_subject_key: string
          p_subject_type: string
        }
        Returns: string
      }
      permission_save_group_unchecked: {
        Args: {
          p_active?: boolean
          p_actor_mode?: string
          p_description: string
          p_group_id: string
          p_member_ids?: string[]
          p_name: string
          p_scope_id: string
          p_scope_type: string
        }
        Returns: string
      }
      permission_save_override_unchecked: {
        Args: {
          p_active?: boolean
          p_actor_mode?: string
          p_allowed: boolean
          p_permission_key: string
          p_reason?: string
          p_scope_id: string
          p_scope_type: string
          p_subject_key: string
          p_subject_type: string
        }
        Returns: string
      }
      permission_save_set_unchecked: {
        Args: {
          p_active?: boolean
          p_actor_mode?: string
          p_description: string
          p_name: string
          p_permission_set_id: string
          p_permissions: Json
          p_scope_id: string
          p_scope_type: string
        }
        Returns: string
      }
      permission_scope_details: {
        Args: { p_scope_id: string; p_scope_type: string }
        Returns: {
          association_id: string
          club_id: string
          division_id: string
          team_id: string
        }[]
      }
      permission_subject_manageable: {
        Args: {
          p_actor_mode: string
          p_subject_key: string
          p_subject_type: string
        }
        Returns: boolean
      }
      permission_subject_matches: {
        Args: {
          p_association_id: string
          p_club_id: string
          p_subject_key: string
          p_subject_type: string
          p_team_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      permission_subject_matches_for_mode: {
        Args: {
          p_effective_mode: string
          p_rule_scope_id: string
          p_rule_scope_type: string
          p_subject_key: string
          p_subject_type: string
          p_user_id: string
        }
        Returns: boolean
      }
      permission_user_in_scope: {
        Args: { p_scope_id: string; p_scope_type: string; p_user_id: string }
        Returns: boolean
      }
      permission_visible_profiles: {
        Args: { p_scope_id: string; p_scope_type: string }
        Returns: {
          display_name: string
          profile_id: string
        }[]
      }
      permission_visible_profiles_for_mode: {
        Args: {
          p_actor_mode?: string
          p_scope_id: string
          p_scope_type: string
        }
        Returns: {
          display_name: string
          profile_id: string
        }[]
      }
      provision_dev_test_account_data: {
        Args: {
          p_actor_id: string
          p_association_id: string
          p_club_id: string
          p_created: boolean
          p_email: string
          p_role: string
          p_team_id: string
          p_user_id: string
        }
        Returns: Json
      }
      record_mvp_result_check: {
        Args: { p_comment?: string; p_response: string; p_session_id: string }
        Returns: Json
      }
      reopen_mvp_voting_session: {
        Args: { p_closes_at?: string; p_session_id: string }
        Returns: Json
      }
      request_mvp_session_reopen: {
        Args: { p_session_id: string }
        Returns: Json
      }
      resolve_effective_permission: {
        Args: {
          p_association_id?: string
          p_club_id?: string
          p_division_id?: string
          p_permission_key: string
          p_team_id?: string
          p_user_id?: string
        }
        Returns: Json
      }
      resolve_effective_permission_for_mode: {
        Args: {
          p_actor_mode: string
          p_association_id?: string
          p_club_id?: string
          p_division_id?: string
          p_permission_key: string
          p_team_id?: string
        }
        Returns: Json
      }
      resolve_module_enabled: {
        Args: {
          p_association_id?: string
          p_club_id?: string
          p_division_id?: string
          p_module_key: string
          p_team_id?: string
        }
        Returns: boolean
      }
      resolve_mvp_result_dispute: {
        Args: { p_closes_at?: string; p_session_id: string }
        Returns: Json
      }
      review_umpire_vote_submission: {
        Args: { p_action: string; p_lines?: Json; p_submission_id: string }
        Returns: Json
      }
      save_committee_meeting_attendance: {
        Args: {
          p_apology_ids: string[]
          p_attendee_ids: string[]
          p_meeting_id: string
        }
        Returns: undefined
      }
      save_permission_assignment: {
        Args: {
          p_active?: boolean
          p_actor_mode?: string
          p_assignment_id: string
          p_permission_set_id: string
          p_scope_id: string
          p_scope_type: string
          p_subject_key: string
          p_subject_type: string
        }
        Returns: string
      }
      save_permission_group: {
        Args: {
          p_active?: boolean
          p_actor_mode?: string
          p_description: string
          p_group_id: string
          p_member_ids?: string[]
          p_name: string
          p_scope_id: string
          p_scope_type: string
        }
        Returns: string
      }
      save_permission_override: {
        Args: {
          p_active?: boolean
          p_actor_mode?: string
          p_allowed: boolean
          p_permission_key: string
          p_reason?: string
          p_scope_id: string
          p_scope_type: string
          p_subject_key: string
          p_subject_type: string
        }
        Returns: string
      }
      save_permission_set: {
        Args: {
          p_active?: boolean
          p_actor_mode?: string
          p_description: string
          p_name: string
          p_permission_set_id: string
          p_permissions: Json
          p_scope_id: string
          p_scope_type: string
        }
        Returns: string
      }
      save_safety_hub_form: {
        Args: {
          p_association_id: string
          p_club_id: string
          p_mode: string
          p_payload: Json
          p_record_id: string
          p_team_id: string
        }
        Returns: string
      }
      save_safety_risk_configuration: {
        Args: {
          p_association_id: string
          p_categories: Json
          p_change_reason: string
          p_club_id: string
          p_consequences: Json
          p_likelihoods: Json
          p_matrix: Json
        }
        Returns: string
      }
      set_committee_meeting_item_links: {
        Args: { p_links: Json; p_meeting_item_id: string }
        Returns: undefined
      }
      set_module_feature_flag: {
        Args: {
          p_enabled: boolean
          p_module_key: string
          p_notes?: string
          p_scope_id: string
          p_scope_type: string
        }
        Returns: Json
      }
      set_team_mvp_enabled: {
        Args: { p_enabled: boolean; p_team_id: string }
        Returns: Json
      }
      set_team_mvp_notifications_enabled: {
        Args: { p_enabled: boolean; p_team_id: string }
        Returns: Json
      }
      submit_committee_poll_response: {
        Args: { p_answers: Json; p_poll_id: string }
        Returns: string
      }
      submit_mvp_ballot: {
        Args: {
          p_one_point_player_id: string
          p_session_id: string
          p_shoutout?: string
          p_three_point_player_id: string
          p_two_point_player_id: string
        }
        Returns: Json
      }
      submit_umpire_match_vote: {
        Args: {
          p_fixture_id: string
          p_lines: Json
          p_proxy_reason?: string
          p_proxy_umpire_name?: string
          p_vote_scheme_key: string
        }
        Returns: string
      }
      verify_sportstack_notification_cron: {
        Args: { p_secret: string }
        Returns: boolean
      }
      withdraw_mvp_submission: {
        Args: {
          p_reason: string
          p_session_id: string
          p_voter_profile_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      action_status_enum:
        | "PENDING"
        | "IN_PROGRESS"
        | "COMPLETED"
        | "OVERDUE"
        | "NEW"
        | "AWAITING_DECISION"
        | "APPROVED"
        | "BLOCKED"
        | "ENTERED_IN_ERROR"
      availability_status_enum:
        | "AVAILABLE"
        | "UNAVAILABLE"
        | "MAYBE"
        | "NO_RESPONSE"
      fixture_status_enum:
        | "SCHEDULED"
        | "IN_PROGRESS"
        | "COMPLETED"
        | "CANCELLED"
        | "POSTPONED"
        | "INCOMPLETE"
      formation_owner_scope: "SUPER_ADMIN" | "ASSOCIATION" | "CLUB" | "TEAM"
      membership_status_enum:
        | "ACTIVE"
        | "INACTIVE"
        | "PENDING"
        | "INVITED"
        | "CANCELLED"
      membership_type_enum: "PRIMARY" | "PERMANENT" | "FILL_IN" | "SECONDARY"
      mvp_session_status: "PENDING" | "OPEN" | "CLOSED" | "RESULT_DISPUTED"
      request_status_enum: "PENDING" | "APPROVED" | "DECLINED" | "CANCELLED"
      request_type_enum: "PLAYER_REQUEST" | "TEAM_INVITE"
      risk_status_enum:
        | "OPEN"
        | "IN_PROGRESS"
        | "RESOLVED"
        | "CLOSED"
        | "ACCEPTED"
        | "CONTROLLED"
        | "ENTERED_IN_ERROR"
      user_role_enum:
        | "SUPER_ADMIN"
        | "ASSOCIATION_ADMIN"
        | "CLUB_ADMIN"
        | "TEAM_MANAGER"
        | "COACH"
        | "PLAYER"
        | "UMPIRE"
        | "VOTER"
        | "UMPIRE_ADMIN"
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
      action_status_enum: [
        "PENDING",
        "IN_PROGRESS",
        "COMPLETED",
        "OVERDUE",
        "NEW",
        "AWAITING_DECISION",
        "APPROVED",
        "BLOCKED",
        "ENTERED_IN_ERROR",
      ],
      availability_status_enum: [
        "AVAILABLE",
        "UNAVAILABLE",
        "MAYBE",
        "NO_RESPONSE",
      ],
      fixture_status_enum: [
        "SCHEDULED",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
        "POSTPONED",
        "INCOMPLETE",
      ],
      formation_owner_scope: ["SUPER_ADMIN", "ASSOCIATION", "CLUB", "TEAM"],
      membership_status_enum: [
        "ACTIVE",
        "INACTIVE",
        "PENDING",
        "INVITED",
        "CANCELLED",
      ],
      membership_type_enum: ["PRIMARY", "PERMANENT", "FILL_IN", "SECONDARY"],
      mvp_session_status: ["PENDING", "OPEN", "CLOSED", "RESULT_DISPUTED"],
      request_status_enum: ["PENDING", "APPROVED", "DECLINED", "CANCELLED"],
      request_type_enum: ["PLAYER_REQUEST", "TEAM_INVITE"],
      risk_status_enum: [
        "OPEN",
        "IN_PROGRESS",
        "RESOLVED",
        "CLOSED",
        "ACCEPTED",
        "CONTROLLED",
        "ENTERED_IN_ERROR",
      ],
      user_role_enum: [
        "SUPER_ADMIN",
        "ASSOCIATION_ADMIN",
        "CLUB_ADMIN",
        "TEAM_MANAGER",
        "COACH",
        "PLAYER",
        "UMPIRE",
        "VOTER",
        "UMPIRE_ADMIN",
      ],
    },
  },
} as const

