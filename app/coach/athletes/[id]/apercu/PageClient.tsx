"use client";
import { redirect } from "next/navigation";
import { useDynamicParam } from "@/lib/platform/useDynamicParam";
export default function ApercuRedirect() {
  const id = useDynamicParam("id");
  redirect(`/coach/athletes/${id}`);
  return null;
}
