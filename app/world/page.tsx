import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WorldClient } from "./world-client";
import { DesktopGate } from "@/components/native/DesktopGate";

export const metadata = { title: "_unLABS · Lab World" };

/**
 * The lab world — an isometric voxel lab next to the terminal. Lives
 * outside the (game) group so the terminal's tutorial/journal overlays do
 * not render on top of it; its own progress is stored locally.
 */
export default async function WorldPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return (
    <DesktopGate>
      <WorldClient />
    </DesktopGate>
  );
}
