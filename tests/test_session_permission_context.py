"""Regression checks for session-bound mode and selected-scope permissions."""

from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).parents[1]
MIGRATION = (
    ROOT
    / "supabase"
    / "migrations"
    / "20260802113500_session_bound_permission_context.sql"
)
APP = ROOT / "src" / "App.tsx"
APP_MODE_CONTEXT = ROOT / "src" / "contexts" / "AppModeContext.tsx"
APP_LAYOUT = ROOT / "src" / "components" / "layout" / "AppLayout.tsx"
MODE_ROUTE_GATE = ROOT / "src" / "components" / "auth" / "ModeRouteGate.tsx"
TEAM_CONTEXT = ROOT / "src" / "contexts" / "TeamContext.tsx"
MODULE_AVAILABILITY = ROOT / "src" / "hooks" / "useModuleAvailability.ts"
ADMIN_SCOPE = ROOT / "src" / "hooks" / "useAdminScope.ts"


def normalised(path: Path) -> str:
    """Return lower-case source with repeated whitespace collapsed."""

    return re.sub(r"\s+", " ", path.read_text(encoding="utf-8")).lower()


class SessionPermissionContextMigrationTests(unittest.TestCase):
    def test_session_row_stores_the_full_selected_cascade(self) -> None:
        sql = normalised(MIGRATION)

        for column in ("association_id", "club_id", "division_id", "team_id"):
            self.assertIn(f"add column if not exists {column} uuid", sql)
            self.assertIn(f"'{column}', mode_row.{column}", sql)

    def test_atomic_context_setter_validates_live_session_and_scope(self) -> None:
        sql = normalised(MIGRATION)

        self.assertIn("create or replace function public.set_active_permission_context", sql)
        self.assertIn("from auth.sessions session_row", sql)
        self.assertIn("session_row.not_after is null or session_row.not_after > now()", sql)
        self.assertIn("from private.permission_context_canonical_scope", sql)
        self.assertIn("insert into private.auth_session_permission_modes", sql)
        self.assertIn("on conflict (session_id, user_id) do update", sql)
        for assignment in (
            "association_id = excluded.association_id",
            "club_id = excluded.club_id",
            "division_id = excluded.division_id",
            "team_id = excluded.team_id",
        ):
            self.assertIn(assignment, sql)

    def test_old_mode_setter_is_only_a_context_preserving_wrapper(self) -> None:
        sql = normalised(MIGRATION)

        wrapper = re.search(
            r"create or replace function public\.set_active_permission_mode\(.*?"
            r"\$function\$(.*?)\$function\$;",
            sql,
        )
        self.assertIsNotNone(wrapper)
        body = wrapper.group(1)
        self.assertIn("return public.set_active_permission_context", body)
        self.assertNotIn("insert into private.auth_session_permission_modes", body)

    def test_lower_modes_are_bound_to_stored_scope_but_true_super_mode_is_global(self) -> None:
        sql = normalised(MIGRATION)

        self.assertIn("create or replace function private.current_session_scope_allows", sql)
        self.assertIn("v_root_mode = 'super_admin' and v_active_mode = 'super_admin'", sql)
        self.assertIn("and public.is_super_admin()", sql)
        self.assertIn("if v_requested_empty or v_stored_empty then return false", sql)
        self.assertIn("if v_active_mode = 'association' then", sql)
        self.assertIn("v_requested_association_id = v_stored_association_id", sql)
        self.assertIn("if v_active_mode = 'club' then", sql)
        self.assertIn("v_requested_club_id = v_stored_club_id", sql)
        self.assertIn(
            "if v_active_mode in ('team_manager', 'coach', 'player') then",
            sql,
        )
        self.assertIn("v_requested_team_id = v_stored_team_id", sql)

    def test_lower_modes_bootstrap_a_deterministic_assigned_scope(self) -> None:
        sql = normalised(MIGRATION)

        self.assertIn("v_required_role text", sql)
        self.assertIn("role_row.role::text = 'association_admin'", sql)
        self.assertIn("role_row.role::text = 'club_admin'", sql)
        self.assertIn("when 'team_manager' then 'team_manager'", sql)
        self.assertIn("else 'coach'", sql)
        self.assertIn("case membership.membership_type::text", sql)
        self.assertIn("when 'primary' then 0", sql)
        self.assertIn("when 'permanent' then 1", sql)
        self.assertIn("when 'secondary' then 2", sql)
        self.assertIn("no assigned association is available for association admin mode", sql)
        self.assertIn("no assigned club is available for club admin mode", sql)
        self.assertIn("no assigned team is available for the selected mode", sql)

    def test_administration_resolver_and_module_gate_use_stored_context(self) -> None:
        sql = normalised(MIGRATION)

        self.assertIn("v_session_mode := private.active_permission_mode_for_current_session()", sql)
        self.assertIn("v_session_mode <> v_mode", sql)
        self.assertIn("if not private.current_session_scope_allows", sql)
        self.assertIn(
            "rename to resolve_effective_permission_for_mode_unchecked",
            sql,
        )
        self.assertIn(
            "grant execute on function public.resolve_effective_permission_for_mode_unchecked( text, text, uuid, uuid, uuid, uuid ) to service_role",
            sql,
        )
        self.assertIn(
            "create or replace function private.module_allowed_for_current_session",
            sql,
        )
        self.assertIn("v_mode text := private.active_permission_mode_for_current_session()", sql)


class SessionPermissionContextFrontendTests(unittest.TestCase):
    def test_team_context_wraps_mode_context(self) -> None:
        app = normalised(APP)

        team_open = app.index("<teamprovider>")
        mode_open = app.index("<appmodeprovider>")
        mode_close = app.index("</appmodeprovider>")
        team_close = app.index("</teamprovider>")
        self.assertLess(team_open, mode_open)
        self.assertLess(mode_open, mode_close)
        self.assertLess(mode_close, team_close)

    def test_mode_context_writes_and_adopts_mode_and_scope_together(self) -> None:
        source = normalised(APP_MODE_CONTEXT)

        self.assertIn('"set_active_permission_context"', source)
        for argument in (
            "p_association_id:",
            "p_club_id:",
            "p_division_id:",
            "p_team_id:",
        ):
            self.assertIn(argument, source)
        self.assertIn("setselectedscope(serverscope)", source)
        self.assertIn("contextconfirmed: confirmedcontext", source)
        self.assertIn("isservercontextallowed", source)
        self.assertIn('state.active_mode === "association" && boolean(state.association_id)', source)
        self.assertIn('state.active_mode === "club" && boolean(state.club_id)', source)
        self.assertIn('boolean(state.team_id)', source)
        self.assertNotIn('rpc("set_active_permission_mode"', source)

    def test_deliberate_super_admin_view_is_not_replaced_by_cascade(self) -> None:
        context = normalised(APP_MODE_CONTEXT)
        layout = normalised(APP_LAYOUT)

        self.assertIn(
            'setisviewingasoverridden(state.root_mode === "super_admin")',
            context,
        )
        manual_override = layout.index("setisviewingasoverridden(true)")
        server_write = layout.index("void setviewingas(selected)", manual_override)
        self.assertLess(manual_override, server_write)
        self.assertIn("if (!changed) setisviewingasoverridden(false)", layout)
        self.assertNotIn(
            'setisviewingasoverridden(selected !== "super_admin")',
            layout,
        )

    def test_team_selection_hydration_and_protected_hooks_fail_closed(self) -> None:
        team = normalised(TEAM_CONTEXT)
        modules = normalised(MODULE_AVAILABILITY)
        admin = normalised(ADMIN_SCOPE)

        self.assertIn("selectionhydrated: boolean", team)
        self.assertIn("setselectionhydrated(true)", team)
        self.assertGreaterEqual(team.count("if (loading) return"), 4)
        self.assertIn("if (modeloading)", modules)
        self.assertIn("if (!contextconfirmed)", modules)
        self.assertLess(
            modules.index("if (modesyncerror)"),
            modules.index("if (!contextconfirmed)"),
        )
        self.assertIn("const scopeisconfirmed = contextconfirmed && !modesyncerror", admin)
        self.assertIn("scopeloading: loading || !scopeisconfirmed", admin)

    def test_admin_routes_use_the_confirmed_active_mode(self) -> None:
        app = normalised(APP)
        gate = normalised(MODE_ROUTE_GATE)

        self.assertIn("const { activemode, loading, contextconfirmed, modesyncerror", gate)
        self.assertIn("if (!allowedmodes.includes(activemode) || !hasrequiredplayerrole)", gate)
        self.assertIn("requiredroleforplayermode", gate)
        self.assertIn("roles.includes(requiredroleforplayermode)", gate)
        self.assertIn("return <navigate to={fallback} replace />", gate)
        self.assertIn("if (!contextconfirmed)", gate)
        self.assertIn("access could not be confirmed", gate)

        for path in (
            "/admin",
            "/admin/users",
            "/admin/roles-permissions",
            "/admin/analytics",
            "/admin/umpire-voting",
        ):
            self.assertRegex(
                app,
                rf'<route path="{re.escape(path)}" element={{<moderoutegate allowedmodes=',
            )

    def test_player_navigation_does_not_expose_umpire_administration(self) -> None:
        app = normalised(APP)
        layout = normalised(APP_LAYOUT)
        player_section = layout.split("player: [", 1)[1].split("], };", 1)[0]

        self.assertIn('path: "/umpire/vote"', player_section)
        self.assertNotIn('path: "/admin/umpire-voting"', player_section)
        self.assertIn('requiredroleforplayermode="umpire"', app)
        self.assertIn(
            'item.path === "/committee" && !["super_admin", "association", "club"].includes(activemode)',
            layout,
        )


if __name__ == "__main__":
    unittest.main()
