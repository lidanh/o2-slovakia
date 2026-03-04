import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { getAuthUser } from "@/lib/auth/authorize";

const UpdateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  password: z.string().min(8).optional(),
  status: z.enum(["active"]).optional(),
});

export async function GET() {
  try {
    const auth = await getAuthUser();
    if (auth.error) return auth.error;

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("users")
      .select("*, team:teams(*)")
      .eq("id", auth.user.id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (auth.error) return auth.error;

    const body = await request.json();
    const parsed = UpdateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Handle password update via admin API (browser can't reach Supabase directly behind proxy)
    if (parsed.data.password) {
      const { error: pwError } = await supabase.auth.admin.updateUserById(auth.user.id, {
        password: parsed.data.password,
      });
      if (pwError) {
        return NextResponse.json({ error: pwError.message }, { status: 500 });
      }
    }

    // Update profile fields (exclude password from DB update)
    const { password: _, ...profileFields } = parsed.data;
    const { data, error } = await supabase
      .from("users")
      .update({ ...profileFields, updated_at: new Date().toISOString() })
      .eq("id", auth.user.id)
      .select("*, team:teams(*)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
