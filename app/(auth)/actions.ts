"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEmbedNext, loginUrlFor, nextOrDefault, sanitizeNext } from "@/lib/auth/next";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  // `next` (whitelisted): e.g. back into the terminal overlay after an
  // embedded login instead of a nested Lab World.
  redirect(nextOrDefault(formData.get("next")));
}

export async function register(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const username = formData.get("username") as string;
  const next = sanitizeNext(formData.get("next"));

  // Check username availability
  if (username) {
    const { data: existingUser } = await supabase
      .from("profiles")
      .select("username")
      .eq("username", username)
      .single();

    if (existingUser) {
      return { error: "Username already taken" };
    }
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
        display_name: username,
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/callback${
        // An embedded path makes no sense from an e-mail link — only plain pages.
        next && !isEmbedNext(next) ? `?next=${encodeURIComponent(next)}` : ""
      }`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  // If signUp returned an active session (email confirmations disabled in dev),
  // drop the user straight into the game. Otherwise prompt them to check email.
  if (data?.session) {
    revalidatePath("/", "layout");
    redirect(nextOrDefault(next));
  }

  return { success: "Check your email to confirm your account" };
}

export async function logout(formData?: FormData) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  // From the Lab World overlay: stay in the overlay (login page inside it).
  const next = sanitizeNext(formData?.get("next"));
  redirect(isEmbedNext(next) ? loginUrlFor(next) : "/");
}
