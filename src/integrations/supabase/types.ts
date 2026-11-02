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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      absence_reports: {
        Row: {
          absence_date: string
          channel: string
          created_at: string
          id: string
          logged_by: string | null
          reason: string
          reported_by: string | null
          school_id: string
          student_id: string
        }
        Insert: {
          absence_date?: string
          channel?: string
          created_at?: string
          id?: string
          logged_by?: string | null
          reason: string
          reported_by?: string | null
          school_id: string
          student_id: string
        }
        Update: {
          absence_date?: string
          channel?: string
          created_at?: string
          id?: string
          logged_by?: string | null
          reason?: string
          reported_by?: string | null
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "absence_reports_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_reports_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      academic_years: {
        Row: {
          end_date: string
          id: string
          is_current: boolean
          name: string
          school_id: string
          start_date: string
        }
        Insert: {
          end_date: string
          id?: string
          is_current?: boolean
          name: string
          school_id: string
          start_date: string
        }
        Update: {
          end_date?: string
          id?: string
          is_current?: boolean
          name?: string
          school_id?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_years_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          checked_at: string | null
          checked_by: string | null
          class_id: string
          created_at: string
          created_by: string | null
          date: string
          id: string
          locked_at: string | null
          max_marks: number
          published: boolean
          school_id: string
          subject_id: string
          term_id: string | null
          title: string
          type: string
          weight: number
        }
        Insert: {
          checked_at?: string | null
          checked_by?: string | null
          class_id: string
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          locked_at?: string | null
          max_marks?: number
          published?: boolean
          school_id: string
          subject_id: string
          term_id?: string | null
          title: string
          type?: string
          weight?: number
        }
        Update: {
          checked_at?: string | null
          checked_by?: string | null
          class_id?: string
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          locked_at?: string | null
          max_marks?: number
          published?: boolean
          school_id?: string
          subject_id?: string
          term_id?: string | null
          title?: string
          type?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "assessments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          class_id: string | null
          created_at: string
          date: string
          id: string
          marked_by: string | null
          note: string | null
          school_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          date: string
          id?: string
          marked_by?: string | null
          note?: string | null
          school_id: string
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          date?: string
          id?: string
          marked_by?: string | null
          note?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          details: Json
          id: string
          school_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          school_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      behaviour_notes: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          id: string
          is_positive: boolean
          note: string
          parent_visible: boolean
          points: number
          private_note: string | null
          school_id: string
          severity: string
          student_id: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_positive?: boolean
          note: string
          parent_visible?: boolean
          points?: number
          private_note?: string | null
          school_id: string
          severity?: string
          student_id: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_positive?: boolean
          note?: string
          parent_visible?: boolean
          points?: number
          private_note?: string | null
          school_id?: string
          severity?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "behaviour_notes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "behaviour_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      class_subject_teachers: {
        Row: {
          class_id: string
          id: string
          school_id: string
          subject_id: string
          teacher_id: string
        }
        Insert: {
          class_id: string
          id?: string
          school_id: string
          subject_id: string
          teacher_id: string
        }
        Update: {
          class_id?: string
          id?: string
          school_id?: string
          subject_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_subject_teachers_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subject_teachers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subject_teachers_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          class_teacher_id: string | null
          created_at: string
          grade: string
          id: string
          name: string
          school_id: string
          section: string
        }
        Insert: {
          class_teacher_id?: string | null
          created_at?: string
          grade: string
          id?: string
          name: string
          school_id: string
          section: string
        }
        Update: {
          class_teacher_id?: string | null
          created_at?: string
          grade?: string
          id?: string
          name?: string
          school_id?: string
          section?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      disciplinary_reports: {
        Row: {
          created_at: string
          created_by: string
          filters: Json
          id: string
          prepared_for_hearing: boolean
          school_id: string
          snapshot: Json
          title: string
        }
        Insert: {
          created_at?: string
          created_by: string
          filters?: Json
          id?: string
          prepared_for_hearing?: boolean
          school_id: string
          snapshot?: Json
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          filters?: Json
          id?: string
          prepared_for_hearing?: boolean
          school_id?: string
          snapshot?: Json
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "disciplinary_reports_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          category: string
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          key: string
          name: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key: string
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key?: string
          name?: string
        }
        Relationships: []
      }
      gate_logs: {
        Row: {
          collected_by: string | null
          collector_id_checked: boolean
          collector_relationship: string | null
          id: string
          kind: string
          logged_at: string
          logged_by: string | null
          reason: string
          school_id: string
          student_id: string
        }
        Insert: {
          collected_by?: string | null
          collector_id_checked?: boolean
          collector_relationship?: string | null
          id?: string
          kind: string
          logged_at?: string
          logged_by?: string | null
          reason: string
          school_id: string
          student_id: string
        }
        Update: {
          collected_by?: string | null
          collector_id_checked?: boolean
          collector_relationship?: string | null
          id?: string
          kind?: string
          logged_at?: string
          logged_by?: string | null
          reason?: string
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gate_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gate_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      homework: {
        Row: {
          attachment_url: string | null
          class_id: string
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string
          id: string
          requires_submission: boolean
          school_id: string
          subject_id: string | null
          title: string
        }
        Insert: {
          attachment_url?: string | null
          class_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date: string
          id?: string
          requires_submission?: boolean
          school_id: string
          subject_id?: string | null
          title: string
        }
        Update: {
          attachment_url?: string | null
          class_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string
          id?: string
          requires_submission?: boolean
          school_id?: string
          subject_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_completions: {
        Row: {
          completed_at: string
          homework_id: string
          id: string
          marked_by: string | null
          school_id: string
          student_id: string
        }
        Insert: {
          completed_at?: string
          homework_id: string
          id?: string
          marked_by?: string | null
          school_id: string
          student_id: string
        }
        Update: {
          completed_at?: string
          homework_id?: string
          id?: string
          marked_by?: string | null
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_completions_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "homework"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_completions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_completions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      learner_transfers: {
        Row: {
          clearance: Json
          completed_at: string | null
          created_at: string
          created_by: string | null
          destination_school: string | null
          id: string
          leave_date: string
          reason: string
          school_id: string
          status: string
          student_id: string
        }
        Insert: {
          clearance?: Json
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          destination_school?: string | null
          id?: string
          leave_date?: string
          reason?: string
          school_id: string
          status?: string
          student_id: string
        }
        Update: {
          clearance?: Json
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          destination_school?: string | null
          id?: string
          leave_date?: string
          reason?: string
          school_id?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_transfers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_transfers_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      marks: {
        Row: {
          assessment_id: string
          comment: string | null
          created_at: string
          id: string
          school_id: string
          score: number | null
          student_id: string
        }
        Insert: {
          assessment_id: string
          comment?: string | null
          created_at?: string
          id?: string
          school_id: string
          score?: number | null
          student_id: string
        }
        Update: {
          assessment_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          school_id?: string
          score?: number | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marks_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marks_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      notice_reads: {
        Row: {
          id: string
          notice_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          id?: string
          notice_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          id?: string
          notice_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notice_reads_notice_id_fkey"
            columns: ["notice_id"]
            isOneToOne: false
            referencedRelation: "notices"
            referencedColumns: ["id"]
          },
        ]
      }
      notices: {
        Row: {
          attachment_url: string | null
          body: string
          class_id: string | null
          created_at: string
          created_by: string | null
          grade: string | null
          id: string
          priority: string
          published_at: string
          school_id: string
          scope: Database["public"]["Enums"]["notice_scope"]
          title: string
        }
        Insert: {
          attachment_url?: string | null
          body: string
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          grade?: string | null
          id?: string
          priority?: string
          published_at?: string
          school_id: string
          scope?: Database["public"]["Enums"]["notice_scope"]
          title: string
        }
        Update: {
          attachment_url?: string | null
          body?: string
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          grade?: string | null
          id?: string
          priority?: string
          published_at?: string
          school_id?: string
          scope?: Database["public"]["Enums"]["notice_scope"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notices_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          digest: boolean
          email_enabled: boolean
          event_prefs: Json
          id: string
          push_enabled: boolean
          quiet_hours_end: number | null
          quiet_hours_start: number | null
          user_id: string
          whatsapp_enabled: boolean
        }
        Insert: {
          digest?: boolean
          email_enabled?: boolean
          event_prefs?: Json
          id?: string
          push_enabled?: boolean
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          user_id: string
          whatsapp_enabled?: boolean
        }
        Update: {
          digest?: boolean
          email_enabled?: boolean
          event_prefs?: Json
          id?: string
          push_enabled?: boolean
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          user_id?: string
          whatsapp_enabled?: boolean
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          school_id: string | null
          student_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          school_id?: string | null
          student_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          school_id?: string | null
          student_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_student: {
        Row: {
          id: string
          is_primary: boolean
          parent_id: string
          relationship: string
          school_id: string
          student_id: string
        }
        Insert: {
          id?: string
          is_primary?: boolean
          parent_id: string
          relationship?: string
          school_id: string
          student_id: string
        }
        Update: {
          id?: string
          is_primary?: boolean
          parent_id?: string
          relationship?: string
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_student_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_student_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_student_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      parents: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          school_id: string
          user_id: string | null
          whatsapp_number: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          school_id: string
          user_id?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          school_id?: string
          user_id?: string | null
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          features: Json
          id: string
          is_active: boolean
          name: string
          price_annual: number
          price_monthly: number
          slug: string
          student_limit: number
          trial_days: number
        }
        Insert: {
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          name: string
          price_annual?: number
          price_monthly?: number
          slug: string
          student_limit?: number
          trial_days?: number
        }
        Update: {
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          name?: string
          price_annual?: number
          price_monthly?: number
          slug?: string
          student_limit?: number
          trial_days?: number
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          announcement: string | null
          announcement_active: boolean
          email_sender_name: string
          favicon_url: string | null
          id: boolean
          logo_url: string | null
          platform_name: string
          primary_color: string
          secondary_color: string
          show_powered_by: boolean
        }
        Insert: {
          announcement?: string | null
          announcement_active?: boolean
          email_sender_name?: string
          favicon_url?: string | null
          id?: boolean
          logo_url?: string | null
          platform_name?: string
          primary_color?: string
          secondary_color?: string
          show_powered_by?: boolean
        }
        Update: {
          announcement?: string | null
          announcement_active?: boolean
          email_sender_name?: string
          favicon_url?: string | null
          id?: boolean
          logo_url?: string | null
          platform_name?: string
          primary_color?: string
          secondary_color?: string
          show_powered_by?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          school_id: string | null
          whatsapp_number: string | null
          whatsapp_opt_in: boolean
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          phone?: string | null
          school_id?: string | null
          whatsapp_number?: string | null
          whatsapp_opt_in?: boolean
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          school_id?: string | null
          whatsapp_number?: string | null
          whatsapp_opt_in?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      relief_assignments: {
        Row: {
          absent_teacher_id: string
          created_at: string
          created_by: string | null
          ends_on: string
          id: string
          reason: string | null
          relief_teacher_id: string
          revoked_at: string | null
          school_id: string
          starts_on: string
        }
        Insert: {
          absent_teacher_id: string
          created_at?: string
          created_by?: string | null
          ends_on: string
          id?: string
          reason?: string | null
          relief_teacher_id: string
          revoked_at?: string | null
          school_id: string
          starts_on: string
        }
        Update: {
          absent_teacher_id?: string
          created_at?: string
          created_by?: string | null
          ends_on?: string
          id?: string
          reason?: string | null
          relief_teacher_id?: string
          revoked_at?: string | null
          school_id?: string
          starts_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "relief_assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          address: string | null
          contact_email: string | null
          created_at: string
          deleted_at: string | null
          id: string
          is_demo: boolean
          logo_url: string | null
          name: string
          phone: string | null
          plan_id: string | null
          primary_color: string
          secondary_color: string
          slug: string
          status: Database["public"]["Enums"]["school_status"]
          trial_ends_at: string | null
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_demo?: boolean
          logo_url?: string | null
          name: string
          phone?: string | null
          plan_id?: string | null
          primary_color?: string
          secondary_color?: string
          slug: string
          status?: Database["public"]["Enums"]["school_status"]
          trial_ends_at?: string | null
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_demo?: boolean
          logo_url?: string | null
          name?: string
          phone?: string | null
          plan_id?: string | null
          primary_color?: string
          secondary_color?: string
          slug?: string
          status?: Database["public"]["Enums"]["school_status"]
          trial_ends_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schools_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      seed_jobs: {
        Row: {
          created_at: string
          credentials: Json
          error: string | null
          finished_at: string | null
          id: string
          school_id: string | null
          size: string
          status: string
          summary: Json
        }
        Insert: {
          created_at?: string
          credentials?: Json
          error?: string | null
          finished_at?: string | null
          id?: string
          school_id?: string | null
          size?: string
          status?: string
          summary?: Json
        }
        Update: {
          created_at?: string
          credentials?: Json
          error?: string | null
          finished_at?: string | null
          id?: string
          school_id?: string | null
          size?: string
          status?: string
          summary?: Json
        }
        Relationships: [
          {
            foreignKeyName: "seed_jobs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      session_attendance: {
        Row: {
          created_at: string
          id: string
          marked_by: string | null
          school_id: string
          session_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          marked_by?: string | null
          school_id: string
          session_id: string
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          marked_by?: string | null
          school_id?: string
          session_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_attendance_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "timetable_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          admission_no: string
          class_id: string | null
          created_at: string
          date_of_birth: string | null
          deleted_at: string | null
          first_name: string
          gender: string | null
          id: string
          last_name: string
          medical_notes: string | null
          photo_url: string | null
          school_id: string
          user_id: string | null
        }
        Insert: {
          admission_no: string
          class_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          deleted_at?: string | null
          first_name: string
          gender?: string | null
          id?: string
          last_name: string
          medical_notes?: string | null
          photo_url?: string | null
          school_id: string
          user_id?: string | null
        }
        Update: {
          admission_no?: string
          class_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          deleted_at?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          last_name?: string
          medical_notes?: string | null
          photo_url?: string | null
          school_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          archived: boolean
          code: string | null
          grades: string | null
          id: string
          name: string
          phase: string | null
          school_id: string
        }
        Insert: {
          archived?: boolean
          code?: string | null
          grades?: string | null
          id?: string
          name: string
          phase?: string | null
          school_id: string
        }
        Update: {
          archived?: boolean
          code?: string | null
          grades?: string | null
          id?: string
          name?: string
          phase?: string | null
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_feature_overrides: {
        Row: {
          enabled: boolean
          flag_key: string
          id: string
          school_id: string
        }
        Insert: {
          enabled: boolean
          flag_key: string
          id?: string
          school_id: string
        }
        Update: {
          enabled?: boolean
          flag_key?: string
          id?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_feature_overrides_flag_key_fkey"
            columns: ["flag_key"]
            isOneToOne: false
            referencedRelation: "feature_flags"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "tenant_feature_overrides_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      terms: {
        Row: {
          academic_year_id: string | null
          end_date: string
          id: string
          is_current: boolean
          name: string
          school_id: string
          start_date: string
        }
        Insert: {
          academic_year_id?: string | null
          end_date: string
          id?: string
          is_current?: boolean
          name: string
          school_id: string
          start_date: string
        }
        Update: {
          academic_year_id?: string | null
          end_date?: string
          id?: string
          is_current?: boolean
          name?: string
          school_id?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "terms_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terms_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      timetable_sessions: {
        Row: {
          class_id: string | null
          created_at: string
          created_by: string | null
          date: string
          end_time: string
          grade: string | null
          id: string
          kind: string
          school_id: string
          start_time: string
          title: string
          venue: string | null
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          end_time?: string
          grade?: string | null
          id?: string
          kind?: string
          school_id: string
          start_time?: string
          title: string
          venue?: string | null
        }
        Update: {
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          end_time?: string
          grade?: string | null
          id?: string
          kind?: string
          school_id?: string
          start_time?: string
          title?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timetable_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          school_id: string | null
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          school_id?: string | null
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          school_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_manage_attendance_row: {
        Args: { _class: string; _school: string; _student: string }
        Returns: boolean
      }
      can_manage_register: {
        Args: { _class: string; _school: string }
        Returns: boolean
      }
      can_see_student: {
        Args: { _school: string; _student: string }
        Returns: boolean
      }
      clear_demo_data: { Args: never; Returns: Json }
      delete_school: { Args: { _school: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _school: string
          _user_id: string
        }
        Returns: boolean
      }
      is_active_relief_for: {
        Args: { _school: string; _teacher: string }
        Returns: boolean
      }
      is_front_office: { Args: { _school: string }; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      is_school_admin: { Args: { _school: string }; Returns: boolean }
      is_school_member: { Args: { _school: string }; Returns: boolean }
      is_school_staff: { Args: { _school: string }; Returns: boolean }
      my_student_ids: { Args: never; Returns: string[] }
      sa_phone_key: { Args: { p: string }; Returns: string }
      seed_demo_attendance_chunk: {
        Args: { p_from: string; p_school: string; p_to: string }
        Returns: number
      }
      seed_demo_marks_chunk: {
        Args: { p_from: number; p_school: string; p_to: number }
        Returns: number
      }
      seed_demo_school: {
        Args: { p_name?: string; p_size?: string }
        Returns: Json
      }
      seed_demo_school_base: {
        Args: { p_name?: string; p_size?: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "school_admin" | "teacher" | "parent" | "student" | "clerk"
      attendance_status: "present" | "absent" | "late" | "excused" | "half_day"
      notice_scope: "school" | "grade" | "class"
      school_status: "active" | "suspended" | "trial"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["school_admin", "teacher", "parent", "student", "clerk"],
      attendance_status: ["present", "absent", "late", "excused", "half_day"],
      notice_scope: ["school", "grade", "class"],
      school_status: ["active", "suspended", "trial"],
    },
  },
} as const
