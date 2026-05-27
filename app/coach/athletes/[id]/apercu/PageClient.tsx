"use client";
import { useParams, redirect } from "next/navigation";
export default function ApercuRedirect() {
  const { id } = useParams();
  redirect(`/coach/athletes/${id}`);
  return null;
}
