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
      associations: {
        Row: {
          abbreviation: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          sport_type: string
          state: string | null
          timezone: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          abbreviation?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          sport_type?: string
          state?: string | null
          timezone?: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          abbreviation?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          sport_type?: string
          state?: string | null
          timezone?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      clubs: {
        Row: {
          abbreviation: string | null
          association_id: string
          created_at: string
          id: string
          logo_url: string | null
          name: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          abbreviation?: string | null
          association_id: string
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          abbreviation?: string | null
          association_id?: string
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
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
          gender: string | null
          id: string
          max_age: number | null
          min_age: number | null
          name: string
          season_id: string | null
        }
        Insert: {
          age_group?: string | null
          association_id: string
          competition_id?: string | null
          created_at?: string
          gender?: string | null
          id?: string
          max_age?: number | null
          min_age?: number | null
          name: string
          season_id?: string | null
        }
        Update: {
          age_group?: string | null
          association_id?: string
          competition_id?: string | null
          created_at?: string
          gender?: string | null
          id?: string
          max_age?: number | null
          min_age?: number | null
          name?: string
          season_id?: string | null
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
          created_at: string
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
          created_at?: string
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
          created_at?: string
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
          created_at: string
          id: string
          player_id: string
          position_code: string
          preference: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          player_id: string
          position_code: string
          preference: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          player_id?: string
          position_code?: string
          preference?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_position_preferences_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          submission_id?: string
          team_id?: string | null
          votes?: number
        }
        Relationships: [
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
          legacy_umpire_email: string | null
          proxy_reason: string | null
          proxy_submitter_id: string | null
          proxy_submitter_name: string | null
          proxy_umpire_name: string | null
          round_number: number | null
          submitted_at: string
          submitted_by_admin_id: string | null
          submitted_by_admin_name: string | null
          umpire_user_id: string | null
          updated_at: string
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
          legacy_umpire_email?: string | null
          proxy_reason?: string | null
          proxy_submitter_id?: string | null
          proxy_submitter_name?: string | null
          proxy_umpire_name?: string | null
          round_number?: number | null
          submitted_at?: string
          submitted_by_admin_id?: string | null
          submitted_by_admin_name?: string | null
          umpire_user_id?: string | null
          updated_at?: string
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
          legacy_umpire_email?: string | null
          proxy_reason?: string | null
          proxy_submitter_id?: string | null
          proxy_submitter_name?: string | null
          proxy_umpire_name?: string | null
          round_number?: number | null
          submitted_at?: string
          submitted_by_admin_id?: string | null
          submitted_by_admin_name?: string | null
          umpire_user_id?: string | null
          updated_at?: string
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
          revsports_player_id: string | null
          street_address: string | null
          suburb: string | null
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
          revsports_player_id?: string | null
          street_address?: string | null
          suburb?: string | null
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
          revsports_player_id?: string | null
          street_address?: string | null
          suburb?: string | null
          updated_at?: string
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
          action_text: string
          assigned_to: string | null
          created_at: string
          due_date: string | null
          id: string
          risk_id: string
          status: Database["public"]["Enums"]["action_status_enum"]
          updated_at: string
        }
        Insert: {
          action_text: string
          assigned_to?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          risk_id: string
          status?: Database["public"]["Enums"]["action_status_enum"]
          updated_at?: string
        }
        Update: {
          action_text?: string
          assigned_to?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          risk_id?: string
          status?: Database["public"]["Enums"]["action_status_enum"]
          updated_at?: string
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
            foreignKeyName: "rg_be_smart_actions_risk_id_fkey"
            columns: ["risk_id"]
            isOneToOne: false
            referencedRelation: "rg_risk_register"
            referencedColumns: ["id"]
          },
        ]
      }
      rg_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          record_id: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          record_id: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          record_id?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: [
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
          id: string
          label: string
          sort_order: number | null
          value: string
        }
        Insert: {
          category: string
          id?: string
          label: string
          sort_order?: number | null
          value: string
        }
        Update: {
          category?: string
          id?: string
          label?: string
          sort_order?: number | null
          value?: string
        }
        Relationships: []
      }
      rg_quality_improvement_items: {
        Row: {
          association_id: string | null
          club_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          status: Database["public"]["Enums"]["action_status_enum"]
          title: string
          updated_at: string
        }
        Insert: {
          association_id?: string | null
          club_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          status?: Database["public"]["Enums"]["action_status_enum"]
          title: string
          updated_at?: string
        }
        Update: {
          association_id?: string | null
          club_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          status?: Database["public"]["Enums"]["action_status_enum"]
          title?: string
          updated_at?: string
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
        ]
      }
      rg_risk_guidance_sections: {
        Row: {
          category: string | null
          content: string | null
          id: string
          sort_order: number | null
          title: string
        }
        Insert: {
          category?: string | null
          content?: string | null
          id?: string
          sort_order?: number | null
          title: string
        }
        Update: {
          category?: string | null
          content?: string | null
          id?: string
          sort_order?: number | null
          title?: string
        }
        Relationships: []
      }
      rg_risk_matrix: {
        Row: {
          color: string
          consequence: number
          id: string
          likelihood: number
          risk_level: string
        }
        Insert: {
          color: string
          consequence: number
          id?: string
          likelihood: number
          risk_level: string
        }
        Update: {
          color?: string
          consequence?: number
          id?: string
          likelihood?: number
          risk_level?: string
        }
        Relationships: []
      }
      rg_risk_register: {
        Row: {
          association_id: string | null
          category: string | null
          club_id: string | null
          consequence: number | null
          created_at: string
          description: string | null
          id: string
          likelihood: number | null
          owner_id: string | null
          risk_score: number | null
          status: Database["public"]["Enums"]["risk_status_enum"]
          team_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          association_id?: string | null
          category?: string | null
          club_id?: string | null
          consequence?: number | null
          created_at?: string
          description?: string | null
          id?: string
          likelihood?: number | null
          owner_id?: string | null
          risk_score?: number | null
          status?: Database["public"]["Enums"]["risk_status_enum"]
          team_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          association_id?: string | null
          category?: string | null
          club_id?: string | null
          consequence?: number | null
          created_at?: string
          description?: string | null
          id?: string
          likelihood?: number | null
          owner_id?: string | null
          risk_score?: number | null
          status?: Database["public"]["Enums"]["risk_status_enum"]
          team_id?: string | null
          title?: string
          updated_at?: string
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
        ]
      }
      rg_risk_reviews: {
        Row: {
          id: string
          new_status: Database["public"]["Enums"]["risk_status_enum"] | null
          notes: string | null
          reviewed_at: string
          reviewed_by: string | null
          risk_id: string
        }
        Insert: {
          id?: string
          new_status?: Database["public"]["Enums"]["risk_status_enum"] | null
          notes?: string | null
          reviewed_at?: string
          reviewed_by?: string | null
          risk_id: string
        }
        Update: {
          id?: string
          new_status?: Database["public"]["Enums"]["risk_status_enum"] | null
          notes?: string | null
          reviewed_at?: string
          reviewed_by?: string | null
          risk_id?: string
        }
        Relationships: [
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
          name: string
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
          name: string
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
          name?: string
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
          p_association_admin_associations?: string[]
          p_club_admin_scopes?: Json
          p_coach_scopes?: Json
          p_manager_scopes?: Json
          p_roles: string[]
          p_user_id: string
        }
        Returns: undefined
      }
      claim_placeholder_profile: {
        Args: { p_real_profile_id: string }
        Returns: {
          placeholder_profile_id: string
          reason: string
          status: string
        }[]
      }
      close_legacy_mvp_sessions_for_cutover: {
        Args: { p_reason: string }
        Returns: Json
      }
      close_mvp_voting_session: {
        Args: { p_session_id: string }
        Returns: Json
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
      is_super_admin: { Args: never; Returns: boolean }
      open_mvp_voting_session: {
        Args: { p_closes_at?: string; p_fixture_id: string; p_team_id: string }
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
      resolve_mvp_result_dispute: {
        Args: { p_closes_at?: string; p_session_id: string }
        Returns: Json
      }
      set_team_mvp_enabled: {
        Args: { p_enabled: boolean; p_team_id: string }
        Returns: Json
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
      action_status_enum: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "OVERDUE"
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
      action_status_enum: ["PENDING", "IN_PROGRESS", "COMPLETED", "OVERDUE"],
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
